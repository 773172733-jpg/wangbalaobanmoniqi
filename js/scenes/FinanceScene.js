'use strict';

const CanvasUtils = require('../ui/CanvasUtils');
const FinanceSystem = require('../systems/FinanceSystem');
const categories = require('../data/financeCategories');
const ChartRenderer = require('../ui/charts/FinanceChartRenderer');

function rect(x, y, width, height) { return { x: x, y: y, width: width, height: height }; }
function monthIndex(year, month) { return (year - 1) * 12 + month - 1; }
function fromMonthIndex(value) { return { year: Math.floor(value / 12) + 1, month: value % 12 + 1 }; }

class FinanceScene {
  constructor(dependencies) {
    const deps = dependencies || {}; this.title = '财务管理'; this.inputManager = deps.inputManager; this.requestRender = deps.requestRender || function () {};
    this.system = new FinanceSystem(deps.gameState, deps.saveManager); this.chart = new ChartRenderer(); this.tab = 'overview'; this.metric = 'net'; this.direction = null; this.category = null; this.selectedDay = null; this.selectedTransaction = null; this.selectedPie = null; this.viewMonth = null; this.cacheKey = ''; this.summary = null;
  }

  enter() { const time = this.system.getRoot().time; if (!this.viewMonth) this.viewMonth = { year: time.year, month: time.month }; this.invalidate(); }
  invalidate() { this.cacheKey = ''; }
  getSummary(state) { const key = this.viewMonth.year + '-' + this.viewMonth.month + '-' + state.finance.transactions.length; if (key !== this.cacheKey) { this.summary = this.system.getMonthlySummary(this.viewMonth.year, this.viewMonth.month); this.cacheKey = key; } return this.summary; }
  money(value) { return FinanceSystem.formatMoney(value); }

  button(context, id, box, label, enabled, action, selected) { CanvasUtils.fillRoundedRect(context, box, 4, !enabled ? '#263845' : selected ? '#a97022' : '#153247'); CanvasUtils.strokeRoundedRect(context, box, 4, enabled && selected ? '#efc45c' : '#3a5362', 1); context.fillStyle = enabled ? '#f5f0df' : '#728591'; context.font = 'bold 9px sans-serif'; context.textAlign = 'center'; context.fillText(label, box.x + box.width / 2, box.y + box.height / 2 + 3); if (enabled) this.inputManager.register(id, box, action); }

  drawTabs(context, box) { const tabs = [['overview', '财务总览'], ['report', '月度报表'], ['ledger', '收支流水']]; tabs.forEach((tab, index) => this.button(context, 'finance:tab:' + tab[0], rect(box.x + index * 104, box.y, 98, box.height), tab[1], true, () => { this.tab = tab[0]; this.selectedTransaction = null; this.requestRender(); }, this.tab === tab[0])); }

  drawCards(context, box, state, summary) {
    const values = [['当前现金', this.system.getCash(state)], ['营业收入', summary.operatingIncome], ['经营支出', summary.operatingExpense], ['投资支出', summary.capitalExpense], ['经营利润', summary.operatingProfit], ['现金净流量', summary.netCashFlow]]; const gap = 5; const width = (box.width - gap * 5) / 6;
    values.forEach((item, index) => { const card = rect(box.x + index * (width + gap), box.y, width, box.height); CanvasUtils.fillRoundedRect(context, card, 5, '#10293b'); CanvasUtils.strokeRoundedRect(context, card, 5, '#315063', 1); context.fillStyle = '#8198a7'; context.font = '8px sans-serif'; context.textAlign = 'left'; context.fillText(item[0], card.x + 7, card.y + 14); const negative = item[1] < 0; context.fillStyle = negative ? '#ed765f' : index === 1 ? '#56bfa0' : index >= 4 ? '#e8b94f' : '#f3efe1'; context.font = 'bold 11px sans-serif'; context.fillText(this.money(item[1]), card.x + 7, card.y + 33); });
    if (this.system.getCash(state) < 0) { context.fillStyle = '#ed765f'; context.font = 'bold 8px sans-serif'; context.textAlign = 'right'; context.fillText('资金赤字', box.x + width - 7, box.y + box.height - 4); }
  }

  drawOverview(context, box, state, summary) {
    const leftWidth = box.width * 0.52; const trend = rect(box.x, box.y, leftWidth, box.height * 0.58);
    ['income', 'expense', 'net'].forEach((metric, index) => this.button(context, 'finance:metric:' + metric, rect(trend.x + trend.width - 126 + index * 42, trend.y + 3, 39, 24), metric === 'income' ? '收入' : metric === 'expense' ? '支出' : '净流量', true, () => { this.metric = metric; this.requestRender(); }, this.metric === metric));
    const hits = this.chart.drawTrend(context, trend, summary.daily, this.metric, this.selectedDay); hits.forEach((hit) => this.inputManager.register('finance:day:' + hit.day, hit.bounds, () => { this.selectedDay = hit.day; this.requestRender(); }));
    if (this.selectedDay) { const day = summary.daily[this.selectedDay - 1]; const tip = rect(trend.x + 40, trend.y + 26, 148, 34); CanvasUtils.fillRoundedRect(context, tip, 4, '#071522'); context.fillStyle = '#e8d9ae'; context.font = '8px sans-serif'; context.textAlign = 'left'; context.fillText('第' + day.day + '日  收 ' + this.money(day.income) + '  支 ' + this.money(day.expense) + '  净 ' + this.money(day.net), tip.x + 6, tip.y + 20); }
    const labels = {}; categories.items.forEach((item) => { labels[item.id] = item.name; });
    const incomeBox = rect(box.x + leftWidth + 6, box.y, (box.width - leftWidth - 12) / 2, trend.height); const expenseBox = rect(incomeBox.x + incomeBox.width + 6, box.y, incomeBox.width, trend.height);
    const incomeSlices = this.chart.drawPie(context, incomeBox, summary.incomeBreakdown, labels, this.selectedPie); const expenseSlices = this.chart.drawPie(context, expenseBox, summary.expenseBreakdown, labels, this.selectedPie);
    this.inputManager.register('finance:pie:income', incomeBox, (point) => { const hit = this.chart.hitPie(point, incomeSlices); this.selectedPie = hit && hit.id; this.requestRender(); });
    this.inputManager.register('finance:pie:expense', expenseBox, (point) => { const hit = this.chart.hitPie(point, expenseSlices); this.selectedPie = hit && hit.id; this.requestRender(); });
    const recent = rect(box.x, box.y + trend.height + 6, box.width, box.height - trend.height - 6); CanvasUtils.fillRoundedRect(context, recent, 5, '#0d2232'); context.fillStyle = '#91a6b2'; context.font = 'bold 9px sans-serif'; context.textAlign = 'left'; context.fillText('最近流水', recent.x + 8, recent.y + 15);
    summary.transactions.slice(0, 5).forEach((item, index) => { const x = recent.x + 75 + index * ((recent.width - 82) / 5); context.fillStyle = item.direction === 'income' ? '#56bfa0' : '#e9855d'; context.font = 'bold 9px sans-serif'; context.fillText((item.direction === 'income' ? '+' : '-') + this.money(item.amount), x, recent.y + 15); context.fillStyle = '#849ba8'; context.font = '8px sans-serif'; context.fillText(item.description.slice(0, 9), x, recent.y + 31); });
  }

  switchMonth(delta, state) { const current = monthIndex(state.time.year, state.time.month); const target = Math.max(0, Math.min(current, monthIndex(this.viewMonth.year, this.viewMonth.month) + delta)); this.viewMonth = fromMonthIndex(target); this.invalidate(); this.requestRender(); }
  drawMonthNav(context, box, state) { this.button(context, 'finance:prev', rect(box.x, box.y, 58, box.height), '上一月', monthIndex(this.viewMonth.year, this.viewMonth.month) > 0, () => this.switchMonth(-1, state)); context.fillStyle = '#efc35d'; context.font = 'bold 11px sans-serif'; context.textAlign = 'center'; context.fillText('第' + this.viewMonth.year + '年' + this.viewMonth.month + '月', box.x + box.width / 2, box.y + 20); this.button(context, 'finance:next', rect(box.x + box.width - 58, box.y, 58, box.height), '下一月', monthIndex(this.viewMonth.year, this.viewMonth.month) < monthIndex(state.time.year, state.time.month), () => this.switchMonth(1, state)); }

  drawReport(context, box, summary) {
    const groups = [
      { title: '收入', color: '#56bfa0', rows: [['营业收入', summary.operatingIncome], ['非经营流入', summary.nonOperatingIncome], ['总现金流入', summary.totalIncome]] },
      { title: '经营支出', color: '#e9855d', rows: [['工资', summary.expenseBreakdown.payroll || 0], ['营销', summary.expenseBreakdown.marketing || 0], ['维护/日常', (summary.expenseBreakdown.equipment_maintenance || 0) + (summary.expenseBreakdown.daily_operation || 0)], ['经营支出合计', summary.operatingExpense]] },
      { title: '投资支出', color: '#d78b5f', rows: [['设备购买/升级', (summary.expenseBreakdown.equipment_purchase || 0) + (summary.expenseBreakdown.equipment_upgrade || 0)], ['家具/装修', (summary.expenseBreakdown.furniture_purchase || 0) + (summary.expenseBreakdown.decoration || 0)], ['投资支出合计', summary.capitalExpense]] },
      { title: '经营结果与现金流', color: '#e8b94f', rows: [['经营利润', summary.operatingProfit], ['利润率', summary.profitMargin + '%'], ['现金净流量', summary.netCashFlow], ['月初/月末现金', summary.openingCash === null ? '无法还原' : this.money(summary.openingCash) + ' / ' + this.money(summary.closingCash)]] }
    ]; const gap = 6; const width = (box.width - gap * 3) / 4;
    groups.forEach((group, index) => { const card = rect(box.x + index * (width + gap), box.y, width, box.height); CanvasUtils.fillRoundedRect(context, card, 5, '#0d2232'); CanvasUtils.strokeRoundedRect(context, card, 5, group.color, 1); context.fillStyle = group.color; context.font = 'bold 10px sans-serif'; context.textAlign = 'left'; context.fillText(group.title, card.x + 9, card.y + 18); group.rows.forEach((row, rowIndex) => { const y = card.y + 44 + rowIndex * 35; context.fillStyle = '#849ba8'; context.font = '8px sans-serif'; context.fillText(row[0], card.x + 9, y); context.fillStyle = typeof row[1] === 'number' && row[1] < 0 ? '#ed765f' : '#edf0e5'; context.font = 'bold 9px sans-serif'; context.textAlign = 'right'; context.fillText(typeof row[1] === 'number' ? this.money(row[1]) : String(row[1]), card.x + card.width - 9, y); context.textAlign = 'left'; }); });
  }

  drawLedger(context, box) {
    const controls = rect(box.x, box.y, box.width, 31); [['all', '全部', null], ['income', '收入', 'income'], ['expense', '支出', 'expense']].forEach((item, index) => this.button(context, 'finance:filter:' + item[0], rect(controls.x + index * 58, controls.y, 53, 27), item[1], true, () => { this.direction = item[2]; this.selectedTransaction = null; this.requestRender(); }, this.direction === item[2]));
    const categoryOptions = [null, 'payroll', 'marketing', 'equipment_purchase', 'furniture_purchase']; const categoryIndex = categoryOptions.indexOf(this.category); this.button(context, 'finance:category', rect(controls.x + 184, controls.y, 108, 27), this.category ? categories.byId[this.category].name : '全部类别', true, () => { this.category = categoryOptions[(categoryIndex + 1) % categoryOptions.length]; this.requestRender(); });
    const list = this.system.getTransactions({ year: this.viewMonth.year, month: this.viewMonth.month, direction: this.direction, category: this.category }); const detailWidth = this.selectedTransaction ? 225 : 0; const listBox = rect(box.x, box.y + 36, box.width - detailWidth - (detailWidth ? 6 : 0), box.height - 36); CanvasUtils.fillRoundedRect(context, listBox, 5, '#0d2232');
    if (!list.length) { context.fillStyle = '#718794'; context.font = '10px sans-serif'; context.textAlign = 'center'; context.fillText('当前筛选条件下暂无真实流水', listBox.x + listBox.width / 2, listBox.y + listBox.height / 2); }
    list.slice(0, 6).forEach((item, index) => { const row = rect(listBox.x + 6, listBox.y + 5 + index * 36, listBox.width - 12, 32); context.fillStyle = index % 2 ? '#102638' : '#122c3d'; context.fillRect(row.x, row.y, row.width, row.height); context.fillStyle = item.direction === 'income' ? '#56bfa0' : '#e9855d'; context.font = 'bold 10px sans-serif'; context.textAlign = 'left'; context.fillText((item.direction === 'income' ? '+' : '-') + this.money(item.amount), row.x + 7, row.y + 20); context.fillStyle = '#dfe8e5'; context.fillText(categories.byId[item.category].name + ' · ' + item.description, row.x + 100, row.y + 20); context.fillStyle = '#718794'; context.textAlign = 'right'; context.fillText('第' + item.gameDate.year + '年' + item.gameDate.month + '月' + item.gameDate.day + '日 · ' + item.sourceSystem, row.x + row.width - 7, row.y + 20); this.inputManager.register('finance:txn:' + item.id, row, () => { this.selectedTransaction = item; this.requestRender(); }); });
    if (this.selectedTransaction) this.drawTransactionDetail(context, rect(listBox.x + listBox.width + 6, listBox.y, detailWidth, listBox.height), this.selectedTransaction);
  }

  drawTransactionDetail(context, box, item) { CanvasUtils.fillRoundedRect(context, box, 5, '#102638'); CanvasUtils.strokeRoundedRect(context, box, 5, '#d3a845', 1); context.fillStyle = '#efc35d'; context.font = 'bold 10px sans-serif'; context.textAlign = 'left'; context.fillText('流水详情', box.x + 9, box.y + 18); const rows = [['编号', item.id.slice(-14)], ['日期', '第' + item.gameDate.year + '年' + item.gameDate.month + '月' + item.gameDate.day + '日'], ['类别', categories.byId[item.category].name], ['金额', (item.direction === 'income' ? '+' : '-') + this.money(item.amount)], ['描述', item.description], ['来源', item.sourceSystem], ['现金变化', this.money(item.cashBefore) + ' → ' + this.money(item.cashAfter)]]; rows.forEach((row, index) => { const y = box.y + 42 + index * 24; context.fillStyle = '#8299a7'; context.font = '8px sans-serif'; context.fillText(row[0], box.x + 9, y); context.fillStyle = '#e8eeea'; context.textAlign = 'right'; context.fillText(String(row[1]).slice(0, 24), box.x + box.width - 9, y); context.textAlign = 'left'; }); }

  render(context, bounds, state) {
    context.fillStyle = '#081824'; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height); const padding = 7; const summary = this.getSummary(state);
    this.drawCards(context, rect(bounds.x + padding, bounds.y + padding, bounds.width - padding * 2, 42), state, summary); this.drawTabs(context, rect(bounds.x + padding, bounds.y + 55, bounds.width - padding * 2, 31));
    if (this.tab !== 'overview') this.drawMonthNav(context, rect(bounds.x + bounds.width - 245, bounds.y + 55, 238, 31), state);
    const content = rect(bounds.x + padding, bounds.y + 93, bounds.width - padding * 2, Math.max(1, bounds.height - 100));
    if (this.tab === 'overview') this.drawOverview(context, content, state, summary); else if (this.tab === 'report') this.drawReport(context, content, summary); else this.drawLedger(context, content);
  }
}

module.exports = FinanceScene;
