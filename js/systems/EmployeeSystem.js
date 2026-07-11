'use strict';

const catalog = require('../data/employeeCatalog');
const FinanceSystem = require('./FinanceSystem');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

class EmployeeSystem {
  constructor(gameState, saveManager, random) {
    this.gameState = gameState || null;
    this.saveManager = saveManager || null;
    this.random = random || Math.random;
    this.financeSystem = gameState ? new FinanceSystem(gameState, saveManager) : null;
  }

  static dateKey(time) {
    const value = time || {};
    return [Number(value.year) || 1, Number(value.month) || 1, Number(value.day) || 1].join('-');
  }

  pickWeighted(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.random() * total;
    for (let index = 0; index < items.length; index += 1) {
      roll -= items[index].weight;
      if (roll < 0) return items[index];
    }
    return items[items.length - 1];
  }

  randomInt(min, max) { return min + Math.floor(this.random() * (max - min + 1)); }

  createCandidate(index) {
    const role = this.pickWeighted(catalog.roles);
    const quality = this.pickWeighted(catalog.qualities);
    const attributes = {};
    Object.keys(role.attributes).forEach((key) => {
      const base = role.attributes[key];
      const qualityValue = this.randomInt(quality.min, quality.max);
      attributes[key] = clamp(Math.round(base * 0.45 + qualityValue * 0.55 + this.randomInt(-3, 3)), quality.min, quality.max);
    });
    const salaryVariance = 0.92 + this.random() * 0.16;
    return {
      id: 'candidate_' + Date.now() + '_' + index + '_' + this.randomInt(100, 999),
      name: catalog.surnames[this.randomInt(0, catalog.surnames.length - 1)] + catalog.givenNames[this.randomInt(0, catalog.givenNames.length - 1)],
      type: role.type,
      quality: quality.id,
      level: 1,
      salary: Math.round(role.baseSalary * quality.salaryFactor * salaryVariance / 100) * 100,
      experience: 0,
      morale: this.randomInt(80, 100),
      attributes: attributes,
      traits: [role.trait]
    };
  }

  generateMarket(time) {
    const candidates = [];
    const count = this.randomInt(3, 5);
    for (let index = 0; index < count; index += 1) candidates.push(this.createCandidate(index));
    return { refreshTime: EmployeeSystem.dateKey(time), candidates: candidates };
  }

  ensureMarket(force) {
    if (!this.gameState) return null;
    const state = this.gameState.getState();
    const key = EmployeeSystem.dateKey(state.time);
    if (!force && state.employeeMarket && state.employeeMarket.refreshTime === key && Array.isArray(state.employeeMarket.candidates) && state.employeeMarket.candidates.length) return state.employeeMarket;
    const next = this.gameState.snapshot();
    next.employeeMarket = this.generateMarket(next.time);
    this.commit(next);
    return this.gameState.getState().employeeMarket;
  }

  commit(next) {
    if (!this.gameState) return;
    const normalized = this.saveManager && this.saveManager.normalize ? this.saveManager.normalize(next) : next;
    this.gameState.replace(normalized);
    if (this.saveManager) this.saveManager.save(normalized);
  }

  hire(candidateId) {
    const state = this.gameState.getState();
    const candidates = state.employeeMarket && state.employeeMarket.candidates || [];
    const index = candidates.findIndex((item) => item.id === candidateId);
    if (index < 0) return { ok: false, message: '该候选人已不在人才市场。' };
    const candidate = candidates[index];
    const employee = clone(candidate);
    employee.id = 'emp_' + Date.now() + '_' + this.randomInt(100, 999);
    delete employee.quality;
    const result = this.financeSystem.recordExpense({ category: 'recruitment', amount: candidate.salary, sourceSystem: 'employee', sourceId: candidate.id, description: '招聘' + employee.name + '（预付首月工资）', successMessage: '成功招聘' + employee.name + '，已预付首月工资。', mutate: (next) => { const list = next.employeeMarket.candidates; const currentIndex = list.findIndex((item) => item.id === candidate.id); if (currentIndex < 0) throw new Error('候选人已不存在'); list.splice(currentIndex, 1); next.employees.push(employee); } });
    if (result.ok) result.employee = employee;
    return result;
  }

  dismiss(employeeId) {
    const next = this.gameState.snapshot();
    const index = next.employees.findIndex((item) => item.id === employeeId);
    if (index < 0) return { ok: false, message: '未找到该员工。' };
    const name = next.employees[index].name;
    next.employees.splice(index, 1);
    this.commit(next);
    return { ok: true, message: '已解雇' + name + '。' };
  }

  upgrade(employeeId) {
    const employee = this.gameState.getState().employees.find((item) => item.id === employeeId);
    if (!employee) return { ok: false, message: '未找到该员工。' };
    const cost = Math.round(employee.salary * 0.5);
    return this.financeSystem.recordExpense({ category: 'daily_operation', amount: cost, sourceSystem: 'employee', sourceId: employeeId, description: employee.name + '员工培训', successMessage: employee.name + '已升级至 Lv.' + (employee.level + 1) + '。', mutate: (next) => { const target = next.employees.find((item) => item.id === employeeId); if (!target) throw new Error('员工已不存在'); target.level += 1; target.salary = Math.round(target.salary * 1.08 / 10) * 10; Object.keys(target.attributes).forEach((key) => { target.attributes[key] = clamp(target.attributes[key] + 2, 0, 100); }); } });
  }

  processWorkDay() {
    const next = this.gameState.snapshot();
    next.employees.forEach((employee) => {
      employee.experience += 5;
      while (employee.experience >= 100) {
        employee.experience -= 100;
        employee.level += 1;
        employee.salary = Math.round(employee.salary * 1.05 / 10) * 10;
        Object.keys(employee.attributes).forEach((key) => { employee.attributes[key] = clamp(employee.attributes[key] + 1, 0, 100); });
      }
    });
    this.commit(next);
  }

  employees(state) { return Array.isArray((state || (this.gameState && this.gameState.getState()) || {}).employees) ? (state || this.gameState.getState()).employees : []; }
  getMonthlySalary(state) { return this.employees(state).reduce((sum, employee) => sum + (Number(employee.salary) || 0), 0); }
  getDailySalary(state) { return Math.round(this.getMonthlySalary(state) / 30); }
  getServiceScore(state) {
    const employees = this.employees(state);
    if (!employees.length) return 40;
    const hasManager = employees.some((item) => item.type === 'manager');
    const total = employees.reduce((sum, employee) => {
      const service = Number(employee.attributes && employee.attributes.service) || 0;
      let efficiency = Number(employee.attributes && employee.attributes.efficiency) || 0;
      if (hasManager && employee.type !== 'manager') efficiency *= 1.1;
      return sum + service * clamp(efficiency / 70, 0.7, 1.15);
    }, 0);
    return clamp(Math.round(total / employees.length), 0, 100);
  }
  getMaintenanceBonus(state) { return this.employees(state).some((item) => item.traits && item.traits.indexOf('硬件专家') >= 0) ? 0.2 : 0; }
  getMarketingBonus(state) { return this.employees(state).some((item) => item.traits && item.traits.indexOf('营销高手') >= 0) ? 0.2 : 0; }
}

module.exports = EmployeeSystem;
