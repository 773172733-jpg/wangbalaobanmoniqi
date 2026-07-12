'use strict';

const categories = require('../data/financeCategories');
const equipmentCatalog = require('../data/equipmentCatalog');
const furnitureCatalog = require('../data/furnitureCatalog');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function money(value) { const result = Math.round(Number(value)); return Number.isFinite(result) ? result : 0; }
function validDate(date) { return date && Number.isInteger(Number(date.year)) && Number(date.year) > 0 && Number.isInteger(Number(date.month)) && Number(date.month) >= 1 && Number(date.month) <= 12 && Number.isInteger(Number(date.day)) && Number(date.day) >= 1 && Number(date.day) <= 30; }
function sameMonth(date, year, month) { return date && Number(date.year) === Number(year) && Number(date.month) === Number(month); }
function defaultFinance() { return { transactions: [], settledKeys: [], monthlySnapshots: {}, settings: { currentViewMonth: null, recurring: { rent: 0, networkFee: 0 } } }; }
function signed(transaction) { return transaction.direction === 'income' ? transaction.amount : -transaction.amount; }

class FinanceSystem {
  constructor(gameState, saveManager) {
    this.gameState = gameState || null;
    this.saveManager = saveManager || null;
    this.summaryCache = {};
  }

  static formatMoney(value) { return '¥' + money(value).toLocaleString(); }
  static formatCompact(value) { const number = money(value); const sign = number < 0 ? '-' : ''; const absolute = Math.abs(number); return absolute >= 10000 ? sign + (Math.round(absolute / 1000) / 10) + '万' : sign + absolute; }
  static defaultState() { return defaultFinance(); }

  getRoot(source) { return source || (this.gameState && this.gameState.getState()) || {}; }
  getCash(source) { const value = Number(this.getRoot(source).player && this.getRoot(source).player.cash); return Number.isFinite(value) ? money(value) : 0; }
  canAfford(amount, source) { return money(amount) > 0 && this.getCash(source) >= money(amount); }

  normalizeFinance(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const result = defaultFinance(); const ids = {}; const dedupe = {};
    (Array.isArray(source.transactions) ? source.transactions : []).forEach((entry) => {
      if (!entry || (entry.direction !== 'income' && entry.direction !== 'expense')) return;
      const amount = money(entry.amount); if (amount <= 0 || !validDate(entry.gameDate)) return;
      let id = String(entry.id || 'txn_recovered_' + result.transactions.length); if (ids[id]) return; ids[id] = true;
      let category = categories.byId[entry.category] && categories.byId[entry.category].direction === entry.direction ? entry.category : (entry.direction === 'income' ? 'other_income' : 'other_expense');
      const config = categories.byId[category]; const key = entry.dedupeKey ? String(entry.dedupeKey) : null;
      if (key && dedupe[key]) return; if (key) dedupe[key] = true;
      result.transactions.push({ id: id, gameDate: { year: Number(entry.gameDate.year), month: Number(entry.gameDate.month), day: Number(entry.gameDate.day) }, direction: entry.direction, category: category, subcategory: entry.subcategory || null, amount: amount, sourceSystem: String(entry.sourceSystem || 'unknown'), sourceId: entry.sourceId || null, description: String(entry.description || config.name), cashBefore: Number.isFinite(Number(entry.cashBefore)) ? money(entry.cashBefore) : null, cashAfter: Number.isFinite(Number(entry.cashAfter)) ? money(entry.cashAfter) : null, isOperating: entry.isOperating === undefined ? config.isOperating : !!entry.isOperating, isCapitalExpenditure: entry.isCapitalExpenditure === undefined ? config.isCapitalExpenditure : !!entry.isCapitalExpenditure, dedupeKey: key, metadata: entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata) ? clone(entry.metadata) : {}, createdAt: Number(entry.createdAt) || 0 });
    });
    const settled = (Array.isArray(source.settledKeys) ? source.settledKeys : []).map(String).concat(Object.keys(dedupe));
    result.settledKeys = settled.filter((key, index) => key && settled.indexOf(key) === index);
    result.monthlySnapshots = source.monthlySnapshots && typeof source.monthlySnapshots === 'object' && !Array.isArray(source.monthlySnapshots) ? clone(source.monthlySnapshots) : {};
    result.settings = source.settings && typeof source.settings === 'object' && !Array.isArray(source.settings) ? clone(source.settings) : { currentViewMonth: null };
    return result;
  }

  validateFinanceData(source) {
    const root = this.getRoot(source); const normalized = this.normalizeFinance(root.finance);
    return { ok: true, finance: normalized, cash: Number.isFinite(Number(root.player && root.player.cash)) ? money(root.player.cash) : 0, repaired: JSON.stringify(normalized) !== JSON.stringify(root.finance || {}) };
  }

  recordIncome(options) { return this.record('income', options); }
  recordExpense(options) { return this.record('expense', options); }

  record(direction, options) {
    if (!this.gameState) return { ok: false, message: '财务系统尚未连接游戏状态。' };
    const input = options || {}; const amount = money(input.amount); const config = categories.byId[input.category];
    if (amount <= 0) return { ok: false, message: '交易金额必须是正整数。' };
    if (!config || config.direction !== direction) return { ok: false, message: '财务分类与收支方向不匹配。' };
    const root = this.gameState.getState(); const finance = this.normalizeFinance(root.finance); const dedupeKey = input.dedupeKey ? String(input.dedupeKey) : null;
    if (dedupeKey && (finance.settledKeys.indexOf(dedupeKey) >= 0 || finance.transactions.some((item) => item.dedupeKey === dedupeKey))) return { ok: false, duplicate: true, message: '该结算已完成，未重复记账。' };
    if (direction === 'expense' && input.allowNegative !== true && this.getCash(root) < amount) return { ok: false, message: '资金不足，交易未发生。' };
    const next = this.gameState.snapshot(); next.finance = finance; const before = this.getCash(next); const after = before + (direction === 'income' ? amount : -amount);
    next.player.cash = after;
    if (typeof input.mutate === 'function') { try { input.mutate(next); } catch (error) { return { ok: false, message: '业务更新失败，交易已取消：' + error.message }; } }
    const date = clone(input.gameDate || next.time); const transaction = { id: 'txn_' + Date.now() + '_' + Math.floor(Math.random() * 100000), gameDate: { year: Number(date.year), month: Number(date.month), day: Number(date.day) }, direction: direction, category: config.id, subcategory: input.subcategory || null, amount: amount, sourceSystem: String(input.sourceSystem || 'unknown'), sourceId: input.sourceId || null, description: String(input.description || config.name), cashBefore: before, cashAfter: after, isOperating: input.isOperating === undefined ? config.isOperating : !!input.isOperating, isCapitalExpenditure: input.isCapitalExpenditure === undefined ? config.isCapitalExpenditure : !!input.isCapitalExpenditure, dedupeKey: dedupeKey, metadata: input.metadata && typeof input.metadata === 'object' ? clone(input.metadata) : {}, createdAt: Date.now() };
    if (!validDate(transaction.gameDate)) return { ok: false, message: '游戏日期无效，交易已取消。' };
    next.finance.transactions.push(transaction); if (dedupeKey) next.finance.settledKeys.push(dedupeKey);
    this.commit(next, input.save !== false); return { ok: true, message: input.successMessage || config.name + '已记账。', transaction: transaction };
  }

  recordBatch(entries, mutate, description) {
    const list = Array.isArray(entries) ? entries.filter((item) => money(item.amount) > 0) : [];
    if (!list.length) { if (typeof mutate === 'function') { const next = this.gameState.snapshot(); mutate(next); this.commit(next, true); } return { ok: true, message: description || '数据已保存。', transactions: [] }; }
    const expense = list.filter((item) => item.direction === 'expense').reduce((sum, item) => sum + money(item.amount), 0);
    const income = list.filter((item) => item.direction === 'income').reduce((sum, item) => sum + money(item.amount), 0);
    if (this.getCash() + income < expense) return { ok: false, message: '资金不足，无法保存本次方案。' };
    const next = this.gameState.snapshot(); next.finance = this.normalizeFinance(next.finance); let cash = this.getCash(next); const transactions = [];
    for (let index = 0; index < list.length; index += 1) {
      const item = list[index]; const config = categories.byId[item.category]; if (!config || config.direction !== item.direction) return { ok: false, message: '批量交易分类无效。' };
      const before = cash; cash += item.direction === 'income' ? money(item.amount) : -money(item.amount);
      const txn = { id: 'txn_' + Date.now() + '_' + index + '_' + Math.floor(Math.random() * 10000), gameDate: clone(next.time), direction: item.direction, category: item.category, subcategory: null, amount: money(item.amount), sourceSystem: item.sourceSystem || 'decoration', sourceId: item.sourceId || null, description: item.description || config.name, cashBefore: before, cashAfter: cash, isOperating: config.isOperating, isCapitalExpenditure: config.isCapitalExpenditure, dedupeKey: null, metadata: item.metadata || {}, createdAt: Date.now() };
      transactions.push(txn); next.finance.transactions.push(txn);
    }
    next.player.cash = cash;
    if (typeof mutate === 'function') { try { mutate(next); } catch (error) { return { ok: false, message: '业务更新失败，批量交易已取消：' + error.message }; } }
    this.commit(next, true); return { ok: true, message: description || '方案和财务流水已保存。', transactions: transactions };
  }

  commit(next, save) { const normalized = this.saveManager && this.saveManager.normalize ? this.saveManager.normalize(next) : next; this.gameState.replace(normalized); if (save && this.saveManager) this.saveManager.save(normalized); this.summaryCache = {}; }

  getTransactions(filters, source) {
    const query = filters || {}; let list = this.normalizeFinance(this.getRoot(source).finance).transactions;
    if (query.direction) list = list.filter((item) => item.direction === query.direction);
    if (query.category) list = list.filter((item) => item.category === query.category);
    if (query.year && query.month) list = list.filter((item) => sameMonth(item.gameDate, query.year, query.month));
    return list.slice().sort((a, b) => (b.gameDate.year * 360 + b.gameDate.month * 30 + b.gameDate.day) - (a.gameDate.year * 360 + a.gameDate.month * 30 + a.gameDate.day) || b.createdAt - a.createdAt);
  }

  summarize(year, month, source) {
    const useCache = !source; const key = year + '-' + month; if (useCache && this.summaryCache[key]) return this.summaryCache[key];
    const transactions = this.getTransactions({ year: year, month: month }, source); const daily = Array.from({ length: 30 }, (_, index) => ({ day: index + 1, income: 0, expense: 0, net: 0 }));
    const incomeBreakdown = {}; const expenseBreakdown = {}; let operatingIncome = 0; let nonOperatingIncome = 0; let operatingExpense = 0; let capitalExpense = 0;
    transactions.forEach((item) => { const target = daily[item.gameDate.day - 1]; if (item.direction === 'income') { target.income += item.amount; incomeBreakdown[item.category] = (incomeBreakdown[item.category] || 0) + item.amount; if (item.isOperating) operatingIncome += item.amount; else nonOperatingIncome += item.amount; } else { target.expense += item.amount; expenseBreakdown[item.category] = (expenseBreakdown[item.category] || 0) + item.amount; if (item.isCapitalExpenditure) capitalExpense += item.amount; else if (item.isOperating) operatingExpense += item.amount; } target.net += signed(item); });
    const totalIncome = operatingIncome + nonOperatingIncome; const totalExpense = operatingExpense + capitalExpense; const ordered = transactions.slice().reverse();
    const result = { year: Number(year), month: Number(month), transactions: transactions, daily: daily, incomeBreakdown: incomeBreakdown, expenseBreakdown: expenseBreakdown, operatingIncome: operatingIncome, nonOperatingIncome: nonOperatingIncome, totalIncome: totalIncome, operatingExpense: operatingExpense, capitalExpense: capitalExpense, totalExpense: totalExpense, operatingProfit: operatingIncome - operatingExpense, netCashFlow: totalIncome - totalExpense, profitMargin: operatingIncome ? Math.round((operatingIncome - operatingExpense) / operatingIncome * 1000) / 10 : 0, openingCash: ordered.length ? ordered[0].cashBefore : null, closingCash: ordered.length ? ordered[ordered.length - 1].cashAfter : null };
    if (useCache) this.summaryCache[key] = result; return result;
  }

  getDailySummary(year, month, source) { return this.summarize(year, month, source).daily; }
  getMonthlySummary(year, month, source) { return this.summarize(year, month, source); }
  getIncomeBreakdown(year, month, source) { return this.summarize(year, month, source).incomeBreakdown; }
  getExpenseBreakdown(year, month, source) { return this.summarize(year, month, source).expenseBreakdown; }
  getOperatingProfit(year, month, source) { return this.summarize(year, month, source).operatingProfit; }
  getNetCashFlow(year, month, source) { return this.summarize(year, month, source).netCashFlow; }

  getCurrentMonthForecast(source) { const root = this.getRoot(source); const employees = Array.isArray(root.employees) ? root.employees : []; const payroll = employees.reduce((sum, employee) => sum + money(employee.salary), 0); const devices = root.devices || {}; const deviceUsage = equipmentCatalog.items.reduce((sum, config) => { const record = devices[config.type] || {}; return sum + (Number(record.installed) || 0) * config.powerUsage * (1 + ((Number(record.level) || 1) - 1) * 0.04); }, 0); const furnitureByType = {}; furnitureCatalog.forEach((item) => { furnitureByType[item.type] = item; }); const infrastructureUsage = (Array.isArray(root.furniture) ? root.furniture : []).reduce((sum, item) => { const config = item && furnitureByType[item.type]; return sum + (config && config.infrastructure ? config.powerUsage * (1 + ((Number(item.level) || 1) - 1) * 0.04) : 0); }, 0); const electricity = Math.round((deviceUsage + infrastructureUsage) * equipmentCatalog.electricityPricePerUnit * 10 * 30); const recurring = this.stateSettings(root).recurring || {}; const rent = Math.max(0, money(recurring.rent)); const network = Math.max(0, money(recurring.networkFee)); return { estimatedPayroll: payroll, estimatedElectricity: electricity, estimatedRent: rent, estimatedNetworkFee: network, estimatedMarketing: 0, estimatedTotalExpense: payroll + electricity + rent + network }; }
  stateSettings(source) { return this.normalizeFinance(this.getRoot(source).finance).settings; }
  settlePayroll(year, month) { const root = this.getRoot(); const employees = Array.isArray(root.employees) ? root.employees : []; const amount = employees.reduce((sum, employee) => sum + money(employee.salary), 0); if (amount <= 0) return { ok: true, skipped: true, message: '当前没有员工工资需要结算。' }; return this.recordExpense({ category: 'payroll', amount: amount, sourceSystem: 'employee', description: '第' + year + '年第' + month + '月员工工资', gameDate: { year: year, month: month, day: 30 }, allowNegative: true, dedupeKey: 'payroll_' + year + '_' + month, metadata: { employeeCount: employees.length, totalSalary: amount } }); }
  settleRecurringExpenses(year, month) { const forecast = this.getCurrentMonthForecast(); const hasDailyElectricity = this.getTransactions({ year: year, month: month, category: 'electricity' }).some((item) => item.sourceSystem === 'business_simulation'); const definitions = [['rent', forecast.estimatedRent, '房租'], ['electricity', hasDailyElectricity ? 0 : forecast.estimatedElectricity, '电费'], ['network_fee', forecast.estimatedNetworkFee, '网络费']]; const results = definitions.filter((item) => item[1] > 0).map((item) => this.recordExpense({ category: item[0], amount: item[1], sourceSystem: 'finance', description: '第' + year + '年第' + month + '月' + item[2], gameDate: { year: year, month: month, day: 30 }, allowNegative: true, dedupeKey: item[0] + '_' + year + '_' + month })); return results.length ? { ok: results.every((item) => item.ok || item.duplicate), results: results, message: '固定费用结算完成。' } : { ok: true, skipped: true, message: '当前没有固定费用需要结算。' }; }
}

module.exports = FinanceSystem;
