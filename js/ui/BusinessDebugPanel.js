'use strict';

const CanvasUtils = require('./CanvasUtils');

class BusinessDebugPanel {
  constructor(system, inputManager, requestRender) { this.system = system; this.inputManager = inputManager; this.requestRender = requestRender || function () {}; this.mode = 'metrics'; }
  button(context, id, box, label, action) { CanvasUtils.fillRoundedRect(context, box, 3, '#493516'); context.fillStyle = '#f5d77d'; context.font = 'bold 8px sans-serif'; context.textAlign = 'center'; context.fillText(label, box.x + box.width / 2, box.y + box.height / 2 + 3); this.inputManager.register('business:debug:' + id, box, action); }
  resetSave() { if (!this.saveManager || !this.gameState) return; if (!this.inputManager) return; const confirmed = true; if (confirmed) { const fresh = this.saveManager.createNew(); this.gameState.replace(fresh); this.requestRender(); } }
  draw(context, box) {
    const data = this.system.getDebugSnapshot(); CanvasUtils.fillRoundedRect(context, box, 5, 'rgba(5,18,27,0.96)'); CanvasUtils.strokeRoundedRect(context, box, 5, '#c99b3f', 1);
    context.fillStyle = '#f0c15b'; context.font = 'bold 9px sans-serif'; context.textAlign = 'left'; context.fillText('经营模拟 DEBUG', box.x + 7, box.y + 14);
    const buttons = [['hour', '+1小时', () => this.system.simulateHours(1)], ['day', '+24小时', () => this.system.simulateHours(24)], ['week', '+7天', () => this.system.simulateHours(168)], ['metrics', '经营指标', () => { this.mode = 'metrics'; }], ['loss', '流失原因', () => { this.mode = 'loss'; }], ['clear', '清空今日', () => this.system.clearToday()]];
    buttons.forEach((item, index) => this.button(context, item[0], { x: box.x + 6 + (index % 3) * 57, y: box.y + 20 + Math.floor(index / 3) * 25, width: 53, height: 21 }, item[1], () => { item[2](); this.requestRender(); }));
    const last = data.lastHour || {}; const today = data.today;
    const text = this.mode === 'loss' ? ['无座 ' + today.lostNoSeat, '性能 ' + today.lostLowPerformance, '网络 ' + today.lostNetwork, '电力 ' + today.lostPower, '服务 ' + today.lostService] : ['时刻 ' + data.time.hour + ':00', '潜客 ' + (last.potentialCustomers || 0), '入店 ' + (last.admittedCustomers || 0), '上机 ' + data.activeCustomers + '/' + data.metrics.equipment.installedComputerCount, '小时收入 ¥' + ((last.seatIncome || 0) + (last.productIncome || 0))];
    context.fillStyle = '#9eb0b9'; context.font = '8px sans-serif'; context.textAlign = 'left'; context.fillText(text.join(' · '), box.x + 7, box.y + box.height - 8);
  }
}

module.exports = BusinessDebugPanel;
