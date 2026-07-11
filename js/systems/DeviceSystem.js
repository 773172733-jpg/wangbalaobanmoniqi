'use strict';

const equipmentCatalog = require('../data/equipmentCatalog');
const furnitureCatalog = require('../data/furnitureCatalog');
const FinanceSystem = require('./FinanceSystem');

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function integer(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

class DeviceSystem {
  constructor(gameState, saveManager) {
    this.gameState = gameState || null;
    this.saveManager = saveManager || null;
    this.financeSystem = gameState ? new FinanceSystem(gameState, saveManager) : null;
    this.catalog = equipmentCatalog;
    this.furnitureByType = {};
    furnitureCatalog.forEach((item) => { this.furnitureByType[item.type] = item; });
  }

  defaultRecord() { return { owned: 0, installed: 0, level: 1, condition: 100 }; }

  getRecord(devices, type) {
    const source = devices && !Array.isArray(devices) ? devices[type] : null;
    return Object.assign(this.defaultRecord(), source || {});
  }

  convertLegacyDevices(devices) {
    if (!Array.isArray(devices)) return devices && typeof devices === 'object' ? devices : {};
    const converted = {};
    devices.forEach((entry) => {
      if (!entry || !this.catalog.byType[entry.type]) return;
      const current = converted[entry.type] || this.defaultRecord();
      const amount = Math.max(1, integer(entry.owned, 1));
      current.owned += amount;
      current.installed += Math.max(0, integer(entry.installed, entry.isInstalled ? amount : 0));
      current.level = Math.max(current.level, integer(entry.level, 1));
      current.condition = Math.min(current.condition, Number(entry.condition) || 100);
      converted[entry.type] = current;
    });
    return converted;
  }

  getComputerSlots(furniture) {
    return (Array.isArray(furniture) ? furniture : []).reduce((total, item) => {
      const config = item && this.furnitureByType[item.type];
      return total + (config ? Math.max(0, integer(config.capacity, 0)) : 0);
    }, 0);
  }

  sanitizeDevices(devices, furniture) {
    const source = this.convertLegacyDevices(devices);
    const normalized = {};
    const warnings = [];
    this.catalog.items.forEach((config) => {
      const raw = source[config.type] || {};
      const owned = Math.max(0, integer(raw.owned, 0));
      const record = {
        owned: owned,
        installed: owned,
        level: clamp(integer(raw.level, 1), 1, config.maxLevel),
        condition: clamp(Number.isFinite(Number(raw.condition)) ? Number(raw.condition) : 100, 0, 100)
      };
      normalized[config.type] = record;
    });

    const computerTypes = this.catalog.items.filter((item) => item.requiresComputerSlot).map((item) => item.type);
    const slots = this.getComputerSlots(furniture);
    let installed = computerTypes.reduce((total, type) => total + normalized[type].installed, 0);
    if (installed > slots) {
      let excess = installed - slots;
      computerTypes.slice().reverse().forEach((type) => {
        const removed = Math.min(excess, normalized[type].installed);
        normalized[type].installed -= removed;
        normalized[type].owned = normalized[type].installed;
        excess -= removed;
      });
      warnings.push('已安装电脑超过现有电脑位，已安全卸下 ' + (installed - slots) + ' 台。');
    }
    return { devices: normalized, warnings: warnings };
  }

  getInstalledComputers(devices, furniture) {
    const furs = Array.isArray(furniture) ? furniture : [];
    const deskTypes = ['standard_pc_desk', 'double_gaming_desk', 'vip_pc_set'];
    return furs.filter(f => f && deskTypes.includes(f.type)).length;
  }

  calculateScore(devices) {
    const score = this.catalog.items.reduce((total, config) => {
      const record = this.getRecord(devices, config.type);
      const levelFactor = 1 + (record.level - 1) * 0.15;
      return total + record.installed * config.score * levelFactor * (record.condition / 100);
    }, 0);
    return clamp(Math.round(score), 0, 100);
  }

  calculateAverageCondition(devices) {
    let installed = 0;
    let weighted = 0;
    this.catalog.items.forEach((config) => {
      const record = this.getRecord(devices, config.type);
      installed += record.installed;
      weighted += record.installed * record.condition;
    });
    return installed ? Math.round(weighted / installed) : 100;
  }

  calculateDailyElectricity(devices) {
    const usage = this.catalog.items.reduce((total, config) => {
      const record = this.getRecord(devices, config.type);
      const levelPowerFactor = 1 + (record.level - 1) * 0.04;
      return total + record.installed * config.powerUsage * levelPowerFactor;
    }, 0);
    return Math.round(usage * this.catalog.electricityPricePerUnit * 10) / 10;
  }

  getSummary(state) {
    const slots = this.getComputerSlots(state.furniture);
    const installedComputers = this.getInstalledComputers(state.devices);
    return {
      computerSlots: slots,
      installedComputers: installedComputers,
      freeComputerSlots: 0,
      equipmentScore: this.calculateScore(state.devices),
      averageCondition: this.calculateAverageCondition(state.devices),
      dailyElectricity: this.calculateDailyElectricity(state.devices)
    };
  }

  getOperatingMetrics(state) {
    const root = state || (this.gameState && this.gameState.getState()) || {};
    const deskMapDev = { standard_pc_desk: 'basic_pc', double_gaming_desk: 'gaming_pc', vip_pc_set: 'premium_pc' };
    var furnitureDeviceCounts = {};
    (Array.isArray(root.furniture) ? root.furniture : []).forEach(function(f) {
      var dt = deskMapDev[f.type];
      if (dt) furnitureDeviceCounts[dt] = (furnitureDeviceCounts[dt] || 0) + 1;
    });
    const pools = [
      { tier: 'basic', type: 'basic_pc' }, { tier: 'gaming', type: 'gaming_pc' }, { tier: 'premium', type: 'premium_pc' }
    ].map((item) => {
      const config = this.catalog.byType[item.type]; const record = this.getRecord(root.devices, item.type);
      var count = record.installed || 0;
      if (count === 0) count = furnitureDeviceCounts[item.type] || 0;
      return { tier: item.tier, count: count, performance: Math.round(config.performance * (1 + (record.level - 1) * 0.15) * record.condition / 100), powerUsage: config.powerUsage };
    });
    const router = this.getRecord(root.devices, 'gigabit_router'); const routerConfig = this.catalog.byType.gigabit_router;
    const ups = this.getRecord(root.devices, 'ups_power'); const upsConfig = this.catalog.byType.ups_power;
    const count = pools.reduce((sum, pool) => sum + pool.count, 0); const performance = pools.reduce((sum, pool) => sum + pool.count * pool.performance, 0);
    return { installedComputerCount: count, computerPools: pools, averagePerformance: count ? Math.round(performance / count) : 0, equipmentScore: this.calculateScore(root.devices), networkQuality: Math.min(100, 25 + router.installed * 35 + (router.level - 1) * 8), networkCapacity: 5 + router.installed * routerConfig.capacity * (1 + (router.level - 1) * 0.25), powerCapacity: 4 + ups.installed * upsConfig.capacity * (1 + (ups.level - 1) * 0.25), currentPowerDemand: Math.round(this.catalog.items.reduce((sum, config) => sum + this.getRecord(root.devices, config.type).installed * config.powerUsage * (config.requiresComputerSlot ? 0.15 : 1), 0) * 10) / 10 };
  }

  commit(mutator) {
    if (!this.gameState) return { ok: false, message: '设备系统尚未连接游戏状态。' };
    const next = this.gameState.snapshot();
    const sanitized = this.sanitizeDevices(next.devices, next.furniture);
    next.devices = sanitized.devices;
    const result = mutator(next);
    if (!result.ok) return result;
    const finalData = this.sanitizeDevices(next.devices, next.furniture);
    next.devices = finalData.devices;
    const committed = this.saveManager && this.saveManager.normalize ? this.saveManager.normalize(next) : next;
    this.gameState.replace(committed);
    if (this.saveManager) this.saveManager.save(committed);
    return result;
  }

  purchase(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: '未知设备类型。' };
    return this.financeSystem.recordExpense({ category: 'equipment_purchase', amount: config.purchasePrice, sourceSystem: 'device', sourceId: type, description: '购买' + config.name, successMessage: '已购买一台' + config.name + '。', mutate: (state) => { state.devices = this.sanitizeDevices(state.devices, state.furniture).devices; state.devices[type].owned += 1;
        state.devices[type].installed += 1; } });
  }

  install(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: 'Unknown device type.' };
    const record = this.getRecord(this.gameState.getState().devices, type);
    if (record.owned <= 0) return { ok: false, message: 'No devices to install.' };
    return { ok: true, message: 'Device already active.' };
  }

  _old_install(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: '未知设备类型。' };
    return this.commit((state) => {
      const record = state.devices[type];
      if (record.installed >= record.owned) return { ok: false, message: '没有可安装的库存设备。' };
      if (config.requiresComputerSlot && this.getInstalledComputers(state.devices) >= this.getComputerSlots(state.furniture)) {
        return { ok: false, message: '当前没有空闲电脑位，请先在装修页面增加电脑桌。' };
      }
      record.installed += 1;
      return { ok: true, message: '设备已安装，不会重复扣款。' };
    });
  }

  uninstall(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: 'Unknown device type.' };
    return { ok: true, message: 'Use sell to remove devices.' };
  }

  _old_uninstall(type) {
    if (!this.catalog.byType[type]) return { ok: false, message: '未知设备类型。' };
    return this.commit((state) => {
      const record = state.devices[type];
      if (record.installed <= 0) return { ok: false, message: '当前没有已安装设备。' };
      record.installed -= 1;
      return { ok: true, message: '已卸下一台设备，库存数量不变。' };
    });
  }

  upgrade(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: '未知设备类型。' };
    const record = this.getRecord(this.gameState.getState().devices, type);
    if (record.owned <= 0) return { ok: false, message: '请先购买该设备。' };
    if (record.level >= config.maxLevel) return { ok: false, message: '已达到最高等级。' };
    const cost = config.upgradeBasePrice * record.level;
    return this.financeSystem.recordExpense({ category: 'equipment_upgrade', amount: cost, sourceSystem: 'device', sourceId: type, description: '升级' + config.name, successMessage: '设备已升级至 Lv.' + (record.level + 1) + '。', mutate: (state) => { state.devices = this.sanitizeDevices(state.devices, state.furniture).devices; state.devices[type].level += 1; } });
  }

  repair(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: '未知设备类型。' };
    const record = this.getRecord(this.gameState.getState().devices, type);
    if (record.condition >= 100) return { ok: false, message: '设备状态良好，无需维修。' };
    const cost = Math.ceil((100 - record.condition) * config.dailyMaintenance);
    return this.financeSystem.recordExpense({ category: 'equipment_maintenance', amount: cost, sourceSystem: 'device', sourceId: type, description: '维修' + config.name, successMessage: '设备维修完成。', mutate: (state) => { state.devices = this.sanitizeDevices(state.devices, state.furniture).devices; state.devices[type].condition = 100; } });
  }
}

module.exports = DeviceSystem;
