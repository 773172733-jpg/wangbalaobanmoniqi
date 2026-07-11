'use strict';

const catalog = require('../data/marketingCatalog');
const EmployeeSystem = require('./EmployeeSystem');

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function dayNumber(time) { const value = time || {}; return ((Number(value.year) || 1) - 1) * 360 + ((Number(value.month) || 1) - 1) * 30 + (Number(value.day) || 1); }

class MarketingSystem {
  constructor(gameState, saveManager) {
    this.gameState = gameState || null;
    this.saveManager = saveManager || null;
    this.employeeSystem = new EmployeeSystem();
  }

  state(source) {
    const root = source || (this.gameState && this.gameState.getState()) || {};
    return root.marketing || { awareness: 0, activeCampaigns: [], cooldowns: {}, totalSpent: 0 };
  }

  getBrandAwareness(source) { return clamp(Math.round(Number(this.state(source).awareness) || 0), 0, 100); }
  getBrandLevel(source) { return clamp(Math.floor(this.getBrandAwareness(source) / 10) + 1, 1, 10); }
  getBrandTitle(source) {
    const level = this.getBrandLevel(source);
    if (level >= 10) return '电竞旗舰';
    if (level >= 7) return '城市品牌';
    if (level >= 4) return '区域知名';
    return '附近小店';
  }

  getActiveCampaigns(source) {
    const root = source || (this.gameState && this.gameState.getState()) || {};
    const today = dayNumber(root.time);
    return (this.state(root).activeCampaigns || []).filter((entry) => entry.endDay >= today && catalog.byId[entry.id]);
  }

  getRemainingDays(entry, source) {
    const root = source || (this.gameState && this.gameState.getState()) || {};
    return Math.max(0, entry.endDay - dayNumber(root.time) + 1);
  }

  getCooldownDays(id, source) {
    const root = source || (this.gameState && this.gameState.getState()) || {};
    return Math.max(0, Number(this.state(root).cooldowns[id]) - dayNumber(root.time) || 0);
  }

  canLaunch(id, source) {
    const root = source || (this.gameState && this.gameState.getState()) || {};
    const config = catalog.byId[id];
    if (!config) return { ok: false, message: '未知营销项目。' };
    if ((root.player && root.player.level || 1) < config.unlockLevel) return { ok: false, message: '老板等级达到 Lv.' + config.unlockLevel + ' 后解锁。' };
    if (this.getActiveCampaigns(root).some((entry) => entry.id === id)) return { ok: false, message: '该营销项目正在进行中。' };
    const cooldown = this.getCooldownDays(id, root);
    if (cooldown > 0) return { ok: false, message: '项目冷却中，还需 ' + cooldown + ' 天。' };
    if (config.requirements && Number(root.cafe && root.cafe.equipment) < config.requirements.equipment) return { ok: false, message: '设备评分达到 ' + config.requirements.equipment + ' 后才能开展。' };
    if (!root.player || root.player.cash < config.cost) return { ok: false, message: '资金不足，无法投放。' };
    return { ok: true, message: '' };
  }

  launch(id) {
    if (!this.gameState) return { ok: false, message: '营销系统尚未连接游戏状态。' };
    const check = this.canLaunch(id);
    if (!check.ok) return check;
    const next = this.gameState.snapshot();
    const config = catalog.byId[id];
    const today = dayNumber(next.time);
    next.player.cash -= config.cost;
    next.marketing.awareness = clamp(next.marketing.awareness + config.awarenessGain, 0, 100);
    next.marketing.totalSpent += config.cost;
    next.marketing.activeCampaigns = this.getActiveCampaigns(next);
    next.marketing.activeCampaigns.push({ id: id, startDay: today, endDay: today + config.duration - 1 });
    next.marketing.cooldowns[id] = today + config.duration + config.cooldown;
    this.commit(next);
    return { ok: true, message: config.name + '已开始，持续 ' + config.duration + ' 天。' };
  }

  commit(next) {
    const normalized = this.saveManager && this.saveManager.normalize ? this.saveManager.normalize(next) : next;
    this.gameState.replace(normalized);
    if (this.saveManager) this.saveManager.save(normalized);
  }

  getRawTrafficMultiplier(source) {
    const root = source || (this.gameState && this.gameState.getState()) || {};
    const staffBonus = this.employeeSystem.getMarketingBonus(root);
    return this.getActiveCampaigns(root).reduce((value, entry) => {
      const config = catalog.byId[entry.id];
      return value + (config.trafficMultiplier - 1) * (1 + staffBonus);
    }, 1);
  }

  getCapacityFactor(source) {
    const root = source || (this.gameState && this.gameState.getState()) || {};
    const cafe = root.cafe || {};
    const quality = clamp((Number(cafe.overall) || 0) / 60, 0.35, 1);
    const capacity = Number(cafe.capacity) || 0;
    const capacityFactor = capacity <= 0 ? 0.35 : clamp(capacity / 20, 0.35, 1);
    return Math.round(quality * capacityFactor * 100) / 100;
  }

  getCustomerAttraction(source) {
    const root = source || (this.gameState && this.gameState.getState()) || {};
    const weights = { students: 1, gamers: 1, officeWorkers: 1, streamers: 1 };
    this.getActiveCampaigns(root).forEach((entry) => {
      const targets = catalog.byId[entry.id].targets;
      Object.keys(weights).forEach((key) => { weights[key] *= targets[key] || 1; });
    });
    const rawMultiplier = this.getRawTrafficMultiplier(root);
    const capacityFactor = this.getCapacityFactor(root);
    return { rawMultiplier: Math.round(rawMultiplier * 100) / 100, effectiveMultiplier: Math.round((1 + (rawMultiplier - 1) * capacityFactor) * 100) / 100, capacityFactor: capacityFactor, segments: weights };
  }

  getReturnRateBonus(source) { return Math.round(this.getActiveCampaigns(source).reduce((sum, entry) => sum + catalog.byId[entry.id].returnRateBonus, 0) * 100) / 100; }
  getMarketingScore(source) {
    const attraction = this.getCustomerAttraction(source);
    return clamp(Math.round(this.getBrandAwareness(source) * 0.6 + (attraction.effectiveMultiplier - 1) * 100), 0, 100);
  }

  getSummary(source) {
    return { marketingScore: this.getMarketingScore(source), brandAwareness: this.getBrandAwareness(source), brandLevel: this.getBrandLevel(source), brandTitle: this.getBrandTitle(source), customerAttraction: this.getCustomerAttraction(source), returnRateBonus: this.getReturnRateBonus(source), activeCampaigns: this.getActiveCampaigns(source) };
  }
}

MarketingSystem.dayNumber = dayNumber;
module.exports = MarketingSystem;
