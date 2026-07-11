'use strict';

const CanvasUtils = require('../ui/CanvasUtils');
const MarketingSystem = require('../systems/MarketingSystem');
const catalog = require('../data/marketingCatalog');

function rect(x, y, width, height) { return { x: x, y: y, width: width, height: height }; }

class MarketingScene {
  constructor(dependencies) {
    const deps = dependencies || {};
    this.title = '营销管理';
    this.inputManager = deps.inputManager;
    this.requestRender = deps.requestRender || function () {};
    this.system = new MarketingSystem(deps.gameState, deps.saveManager);
    this.toast = '';
  }

  button(context, id, box, label, enabled, action) {
    CanvasUtils.fillRoundedRect(context, box, 4, enabled ? '#a97022' : '#263845');
    CanvasUtils.strokeRoundedRect(context, box, 4, enabled ? '#efc45c' : '#3a5362', 1);
    context.fillStyle = enabled ? '#f5f0df' : '#728591'; context.font = 'bold 10px sans-serif'; context.textAlign = 'center';
    context.fillText(label, box.x + box.width / 2, box.y + box.height / 2 + 3);
    if (enabled) this.inputManager.register(id, box, action);
  }

  launch(id) {
    const result = this.system.launch(id);
    this.toast = result.message;
    this.requestRender();
  }

  drawSummary(context, box, summary, state) {
    CanvasUtils.fillRoundedRect(context, box, 5, '#10293b'); CanvasUtils.strokeRoundedRect(context, box, 5, '#315063', 1);
    const attraction = summary.customerAttraction;
    const items = [
      ['品牌等级', 'Lv.' + summary.brandLevel + ' ' + summary.brandTitle], ['知名度', summary.brandAwareness + '/100'],
      ['营销评分', summary.marketingScore], ['潜在客流', '×' + attraction.rawMultiplier.toFixed(2)],
      ['有效客流', '×' + attraction.effectiveMultiplier.toFixed(2)], ['累计投入', '¥' + state.marketing.totalSpent.toLocaleString()]
    ];
    const width = box.width / items.length;
    items.forEach((item, index) => {
      const x = box.x + 9 + index * width;
      context.fillStyle = '#8198a7'; context.font = '9px sans-serif'; context.textAlign = 'left'; context.fillText(item[0], x, box.y + 16);
      context.fillStyle = index === 4 ? '#72c984' : (index === 1 || index === 2 ? '#efc35d' : '#f3efe1'); context.font = 'bold 12px sans-serif'; context.fillText(String(item[1]), x, box.y + 36);
    });
  }

  drawCampaign(context, box, config, state) {
    const active = this.system.getActiveCampaigns(state).find((entry) => entry.id === config.id);
    const check = this.system.canLaunch(config.id, state);
    const cooldown = this.system.getCooldownDays(config.id, state);
    CanvasUtils.fillRoundedRect(context, box, 5, active ? '#183b50' : '#122c3d'); CanvasUtils.strokeRoundedRect(context, box, 5, active ? '#efc45c' : '#355063', 1);
    context.fillStyle = config.color; context.fillRect(box.x + 9, box.y + 10, 42, 42);
    context.fillStyle = '#071522'; context.font = 'bold 18px sans-serif'; context.textAlign = 'center'; context.fillText(config.icon, box.x + 30, box.y + 37);
    context.textAlign = 'left'; context.fillStyle = '#f4f0df'; context.font = 'bold 12px sans-serif'; context.fillText(config.name, box.x + 60, box.y + 20);
    context.fillStyle = '#91a6b2'; context.font = '9px sans-serif'; context.fillText(config.description, box.x + 60, box.y + 38);
    context.fillStyle = '#e9ba52'; context.font = 'bold 10px sans-serif'; context.textAlign = 'right'; context.fillText('¥' + config.cost.toLocaleString(), box.x + box.width - 10, box.y + 20);

    const targetNames = catalog.segments.filter((segment) => config.targets[segment.id] > 1.1).map((segment) => segment.name).join('、');
    const lines = [
      '持续 ' + config.duration + '天  ·  冷却 ' + config.cooldown + '天',
      '潜在客流 ×' + config.trafficMultiplier.toFixed(2) + '  ·  知名度 +' + config.awarenessGain,
      '目标客群：' + (targetNames || '综合客群'),
      '回头率加成：+' + Math.round(config.returnRateBonus * 100) + '%'
    ];
    lines.forEach((line, index) => { context.fillStyle = index === 1 ? '#66b8db' : '#91a6b2'; context.font = '9px sans-serif'; context.textAlign = 'left'; context.fillText(line, box.x + 10, box.y + 72 + index * 18); });
    let label = '立即投放';
    if (active) label = '进行中 · 剩' + this.system.getRemainingDays(active, state) + '天';
    else if (cooldown > 0) label = '冷却 ' + cooldown + '天';
    else if (!check.ok) label = check.message.length > 13 ? check.message.slice(0, 13) + '…' : check.message;
    this.button(context, 'marketing:launch:' + config.id, rect(box.x + 9, box.y + box.height - 40, box.width - 18, 32), label, check.ok, () => this.launch(config.id));
  }

  drawInsight(context, box, summary) {
    CanvasUtils.fillRoundedRect(context, box, 5, '#0d2232'); CanvasUtils.strokeRoundedRect(context, box, 5, '#5d5034', 1);
    context.fillStyle = '#efc35d'; context.font = 'bold 12px sans-serif'; context.textAlign = 'left'; context.fillText('经营放大效果', box.x + 10, box.y + 20);
    const attraction = summary.customerAttraction;
    const rows = [
      ['基础承载效率', Math.round(attraction.capacityFactor * 100) + '%'], ['潜在客流倍率', '×' + attraction.rawMultiplier.toFixed(2)],
      ['有效客流倍率', '×' + attraction.effectiveMultiplier.toFixed(2)], ['回头率加成', '+' + Math.round(summary.returnRateBonus * 100) + '%']
    ];
    catalog.segments.forEach((segment) => rows.push([segment.name + '吸引', '×' + attraction.segments[segment.id].toFixed(2)]));
    rows.forEach((row, index) => {
      const y = box.y + 43 + index * 20; context.fillStyle = '#849ba8'; context.font = '9px sans-serif'; context.textAlign = 'left'; context.fillText(row[0], box.x + 10, y);
      context.fillStyle = index === 2 ? '#72c984' : '#edf0e5'; context.textAlign = 'right'; context.fillText(row[1], box.x + box.width - 10, y);
    });
    context.fillStyle = '#728996'; context.font = '8px sans-serif'; context.textAlign = 'left';
    context.fillText('环境、设备、容量不足会压低实际效果', box.x + 10, box.y + box.height - 13);
  }

  render(context, bounds, state) {
    const padding = 7; context.fillStyle = '#081824'; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    const summary = this.system.getSummary(state);
    this.drawSummary(context, rect(bounds.x + padding, bounds.y + padding, bounds.width - padding * 2, 47), summary, state);
    if (this.toast) { context.fillStyle = this.toast.indexOf('不足') >= 0 || this.toast.indexOf('达到') >= 0 ? '#e68a56' : '#72c984'; context.font = '9px sans-serif'; context.textAlign = 'right'; context.fillText(this.toast, bounds.x + bounds.width - padding, bounds.y + 69); }
    const contentY = bounds.y + 79; const contentHeight = bounds.height - 86;
    const insightWidth = Math.max(178, Math.min(205, bounds.width * 0.25));
    const campaignArea = rect(bounds.x + padding, contentY, bounds.width - insightWidth - padding * 3, contentHeight);
    const gap = 7; const cardWidth = (campaignArea.width - gap * 2) / 3;
    catalog.campaigns.forEach((config, index) => this.drawCampaign(context, rect(campaignArea.x + index * (cardWidth + gap), campaignArea.y, cardWidth, campaignArea.height), config, state));
    this.drawInsight(context, rect(campaignArea.x + campaignArea.width + padding, contentY, insightWidth, contentHeight), summary);
  }
}

module.exports = MarketingScene;
