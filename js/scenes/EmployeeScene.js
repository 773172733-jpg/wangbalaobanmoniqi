'use strict';

const CanvasUtils = require('../ui/CanvasUtils');
const EmployeeSystem = require('../systems/EmployeeSystem');
const catalog = require('../data/employeeCatalog');

function rect(x, y, width, height) { return { x: x, y: y, width: width, height: height }; }
function roleName(type) { return catalog.byType[type] ? catalog.byType[type].name : type; }
function quality(id) { return catalog.qualities.find((item) => item.id === id) || catalog.qualities[0]; }

class EmployeeScene {
  constructor(dependencies) {
    const deps = dependencies || {};
    this.title = '员工管理';
    this.inputManager = deps.inputManager;
    this.requestRender = deps.requestRender || function () {};
    this.system = new EmployeeSystem(deps.gameState, deps.saveManager);
    this.tab = 'mine';
    this.selectedId = null;
    this.toast = '';
  }

  enter() {
    this.system.ensureMarket(false);
    const employees = this.system.employees();
    if (!this.selectedId && employees.length) this.selectedId = employees[0].id;
  }

  button(context, id, box, label, enabled, action, selected, gold) {
    CanvasUtils.fillRoundedRect(context, box, 4, !enabled ? '#263845' : ((selected || gold) ? '#a97022' : '#153247'));
    CanvasUtils.strokeRoundedRect(context, box, 4, enabled && (selected || gold) ? '#efc45c' : '#3a5362', 1);
    context.fillStyle = enabled ? '#f5f0df' : '#728591'; context.font = 'bold 10px sans-serif'; context.textAlign = 'center';
    context.fillText(label, box.x + box.width / 2, box.y + box.height / 2 + 3);
    if (enabled) this.inputManager.register(id, box, action);
  }

  act(callback) {
    const result = callback();
    this.toast = result.message;
    if (result.ok && this.tab === 'mine') {
      const employees = this.system.employees();
      if (!employees.some((item) => item.id === this.selectedId)) this.selectedId = employees[0] && employees[0].id;
    }
    this.requestRender();
  }

  drawHeader(context, box, state) {
    CanvasUtils.fillRoundedRect(context, box, 5, '#10293b'); CanvasUtils.strokeRoundedRect(context, box, 5, '#315063', 1);
    const employees = this.system.employees(state);
    const items = [['当前员工', employees.length + '人'], ['月工资', '¥' + this.system.getMonthlySalary(state).toLocaleString()], ['每日工资', '¥' + this.system.getDailySalary(state)], ['服务评分', this.system.getServiceScore(state)]];
    items.forEach((item, index) => {
      const x = box.x + 12 + index * (box.width / 4);
      context.fillStyle = '#8198a7'; context.font = '9px sans-serif'; context.textAlign = 'left'; context.fillText(item[0], x, box.y + 16);
      context.fillStyle = index === 3 ? '#efc35d' : '#f3efe1'; context.font = 'bold 13px sans-serif'; context.fillText(String(item[1]), x, box.y + 36);
    });
  }

  drawTabs(context, box) {
    const width = 112;
    this.button(context, 'employee:tab:mine', rect(box.x, box.y, width, box.height), '我的员工', true, () => { this.tab = 'mine'; this.toast = ''; this.requestRender(); }, this.tab === 'mine');
    this.button(context, 'employee:tab:market', rect(box.x + width + 6, box.y, width, box.height), '人才市场', true, () => { this.tab = 'market'; this.toast = ''; this.system.ensureMarket(false); this.requestRender(); }, this.tab === 'market');
    if (this.toast) {
      context.fillStyle = this.toast.indexOf('不足') >= 0 ? '#e68a56' : '#72c984'; context.font = '9px sans-serif'; context.textAlign = 'right';
      context.fillText(this.toast.length > 34 ? this.toast.slice(0, 34) + '…' : this.toast, box.x + box.width, box.y + 20);
    }
  }

  drawEmployeeCard(context, box, employee) {
    const selected = employee.id === this.selectedId;
    CanvasUtils.fillRoundedRect(context, box, 5, selected ? '#183b50' : '#122c3d'); CanvasUtils.strokeRoundedRect(context, box, 5, selected ? '#d8a947' : '#355063', 1);
    context.fillStyle = '#244b61'; context.fillRect(box.x + 8, box.y + 9, 42, 42);
    context.fillStyle = '#e9ba52'; context.font = 'bold 18px sans-serif'; context.textAlign = 'center'; context.fillText(employee.name.slice(-1), box.x + 29, box.y + 36);
    context.textAlign = 'left'; context.fillStyle = '#f4f0df'; context.font = 'bold 11px sans-serif'; context.fillText(employee.name, box.x + 58, box.y + 18);
    context.fillStyle = '#91a6b2'; context.font = '9px sans-serif'; context.fillText(roleName(employee.type) + ' · Lv.' + employee.level + ' · ¥' + employee.salary + '/月', box.x + 58, box.y + 35);
    context.fillStyle = '#66b8db'; context.fillText('服务 ' + employee.attributes.service + '  效率 ' + employee.attributes.efficiency + '  · ' + employee.traits.join('、'), box.x + 58, box.y + 52);
    this.inputManager.register('employee:item:' + employee.id, box, () => { this.selectedId = employee.id; this.toast = ''; this.requestRender(); });
  }

  drawMine(context, box, state) {
    const employees = this.system.employees(state);
    const detailWidth = Math.max(205, Math.min(235, box.width * 0.31));
    const list = rect(box.x, box.y, box.width - detailWidth - 7, box.height);
    CanvasUtils.fillRoundedRect(context, list, 5, '#0b2030'); CanvasUtils.strokeRoundedRect(context, list, 5, '#314958', 1);
    if (!employees.length) {
      context.fillStyle = '#8ba0ad'; context.font = '12px sans-serif'; context.textAlign = 'center'; context.fillText('暂无员工，请前往人才市场招聘', list.x + list.width / 2, list.y + list.height / 2);
    }
    employees.slice(0, 4).forEach((employee, index) => this.drawEmployeeCard(context, rect(list.x + 7, list.y + 7 + index * 67, list.width - 14, 61), employee));
    const detail = rect(list.x + list.width + 7, box.y, detailWidth, box.height);
    CanvasUtils.fillRoundedRect(context, detail, 5, '#0d2232'); CanvasUtils.strokeRoundedRect(context, detail, 5, '#5d5034', 1);
    const employee = employees.find((item) => item.id === this.selectedId) || employees[0];
    if (!employee) return;
    context.fillStyle = '#efc35d'; context.font = 'bold 13px sans-serif'; context.textAlign = 'left'; context.fillText(employee.name + ' · ' + roleName(employee.type), detail.x + 10, detail.y + 20);
    const rows = [['服务', employee.attributes.service], ['效率', employee.attributes.efficiency], ['技术', employee.attributes.technology], ['营销', employee.attributes.marketing], ['经验', employee.experience + '/100'], ['忠诚度', employee.morale], ['技能', employee.traits.join('、')]];
    rows.forEach((row, index) => { const y = detail.y + 43 + index * 20; context.fillStyle = '#849ba8'; context.font = '9px sans-serif'; context.fillText(row[0], detail.x + 10, y); context.fillStyle = '#edf0e5'; context.textAlign = 'right'; context.fillText(String(row[1]), detail.x + detail.width - 10, y); context.textAlign = 'left'; });
    const y = detail.y + detail.height - 47; const w = (detail.width - 25) / 2;
    this.button(context, 'employee:upgrade', rect(detail.x + 8, y, w, 40), '升级 ¥' + Math.round(employee.salary * 0.5), true, () => this.act(() => this.system.upgrade(employee.id)), false, true);
    this.button(context, 'employee:dismiss', rect(detail.x + 13 + w, y, w, 40), '解雇', true, () => this.act(() => this.system.dismiss(employee.id)));
  }

  drawMarket(context, box, state) {
    const market = state.employeeMarket || { candidates: [] };
    context.fillStyle = '#8ba0ad'; context.font = '9px sans-serif'; context.textAlign = 'right'; context.fillText('距离明日刷新：游戏时间 1 天', box.x + box.width, box.y - 7);
    const candidates = market.candidates || [];
    const gap = 7; const cardWidth = (box.width - gap * 2) / 3;
    candidates.slice(0, 5).forEach((candidate, index) => {
      const column = index % 3; const row = Math.floor(index / 3);
      const cardHeight = (box.height - gap) / 2;
      const card = rect(box.x + column * (cardWidth + gap), box.y + row * (cardHeight + gap), cardWidth, cardHeight);
      const q = quality(candidate.quality); const role = catalog.byType[candidate.type];
      CanvasUtils.fillRoundedRect(context, card, 5, '#122c3d'); CanvasUtils.strokeRoundedRect(context, card, 5, q.color, 1);
      context.fillStyle = '#f4f0df'; context.font = 'bold 12px sans-serif'; context.textAlign = 'left'; context.fillText(candidate.name, card.x + 9, card.y + 20);
      context.fillStyle = q.color; context.font = 'bold 9px sans-serif'; context.textAlign = 'right'; context.fillText(q.name, card.x + card.width - 9, card.y + 20);
      const main = candidate.type === 'technician' || candidate.type === 'network_admin' ? '技术 ' + candidate.attributes.technology : (candidate.type === 'operator' ? '营销 ' + candidate.attributes.marketing : '服务 ' + candidate.attributes.service);
      const lines = ['职位：' + role.name, '核心能力：' + main, '工资：¥' + candidate.salary + '/月', '技能：' + candidate.traits.join('、')];
      lines.forEach((line, lineIndex) => { context.fillStyle = lineIndex === 2 ? '#e9ba52' : '#91a6b2'; context.font = '9px sans-serif'; context.textAlign = 'left'; context.fillText(line, card.x + 9, card.y + 42 + lineIndex * 17); });
      this.button(context, 'employee:hire:' + candidate.id, rect(card.x + 8, card.y + card.height - 38, card.width - 16, 31), '招聘', true, () => this.act(() => this.system.hire(candidate.id)), false, true);
    });
  }

  render(context, bounds, state) {
    const padding = 7; context.fillStyle = '#081824'; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.drawHeader(context, rect(bounds.x + padding, bounds.y + padding, bounds.width - padding * 2, 47), state);
    this.drawTabs(context, rect(bounds.x + padding, bounds.y + 61, bounds.width - padding * 2, 34));
    const content = rect(bounds.x + padding, bounds.y + 102, bounds.width - padding * 2, Math.max(1, bounds.height - 109));
    if (this.tab === 'mine') this.drawMine(context, content, state); else this.drawMarket(context, content, state);
  }
}

module.exports = EmployeeScene;
