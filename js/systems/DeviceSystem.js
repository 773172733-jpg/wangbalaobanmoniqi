'use strict';

const equipmentCatalog = require('../data/equipmentCatalog');
const furnitureCatalog = require('../data/furnitureCatalog');
const expansionConfig = require('../data/expansionConfig');
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

  getMapDimensions(state) {
    const expansion = state && state.expansion;
    const area = Number(expansion && expansion.currentArea) || expansionConfig.baseArea;
    const ratio = expansionConfig.defaultGridColumns / expansionConfig.defaultGridRows;
    const scale = Math.sqrt(area) / Math.sqrt(expansionConfig.baseArea);
    const columns = Math.max(1, Math.round(expansionConfig.defaultGridColumns * scale));
    const rows = Math.max(1, Math.round(columns / ratio));
    return { columns: columns, rows: rows };
  }

  isFurnitureAreaFree(furniture, type, gridX, gridY) {
    const target = this.furnitureByType[type];
    if (!target) return false;
    return !(Array.isArray(furniture) ? furniture : []).some((item) => {
      const config = item && this.furnitureByType[item.type];
      if (!config) return false;
      return gridX < item.gridX + config.width && gridX + target.width > item.gridX &&
        gridY < item.gridY + config.height && gridY + target.height > item.gridY;
    });
  }

  createComputerDesk(state, deviceType) {
    const type = deviceType === 'gaming_pc' || deviceType === 'premium_pc' ? 'double_gaming_desk' : 'standard_pc_desk';
    const config = this.furnitureByType[type];
    if (!config) return null;
    const dims = this.getMapDimensions(state);
    state.furniture = Array.isArray(state.furniture) ? state.furniture : [];
    for (let y = 0; y <= dims.rows - config.height; y += 1) {
      for (let x = 0; x <= dims.columns - config.width; x += 1) {
        if (this.isFurnitureAreaFree(state.furniture, type, x, y)) {
          const item = {
            id: 'device_desk_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            type: type,
            gridX: x,
            gridY: y,
            rotation: 0,
            sourceSystem: 'device',
            sourceDeviceType: deviceType
          };
          state.furniture = state.furniture.concat([item]);
          return item;
        }
      }
    }
    return null;
  }

  createComputerDeskAt(state, deviceType, gridX, gridY) {
    const type = deviceType === 'gaming_pc' || deviceType === 'premium_pc' ? 'double_gaming_desk' : 'standard_pc_desk';
    const config = this.furnitureByType[type];
    if (!config) return null;
    state.furniture = Array.isArray(state.furniture) ? state.furniture : [];
    if (!this.isFurnitureAreaFree(state.furniture, type, gridX, gridY)) return null;
    const item = {
      id: 'device_desk_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      type: type,
      gridX: gridX,
      gridY: gridY,
      rotation: 0,
      sourceSystem: 'device',
      sourceDeviceType: deviceType
    };
    state.furniture = state.furniture.concat([item]);
    return item;
  }

  removeComputerDesk(state, deviceType) {
    const furniture = Array.isArray(state.furniture) ? state.furniture : [];
    const preferredIndex = furniture.map((item, index) => ({ item: item, index: index })).reverse().find((entry) => (
      entry.item && entry.item.sourceSystem === 'device' && entry.item.sourceDeviceType === deviceType
    ));
    const fallbackTypes = deviceType === 'gaming_pc' || deviceType === 'premium_pc' ? ['double_gaming_desk'] : ['standard_pc_desk'];
    const fallbackIndex = preferredIndex || furniture.map((item, index) => ({ item: item, index: index })).reverse().find((entry) => (
      entry.item && fallbackTypes.indexOf(entry.item.type) >= 0
    ));
    if (!fallbackIndex) return null;
    state.furniture = furniture.filter((item, index) => index !== fallbackIndex.index);
    return fallbackIndex.item;
  }

  sanitizeDevices(devices, furniture) {
    const source = this.convertLegacyDevices(devices);
    const normalized = {};
    const warnings = [];
    this.catalog.items.forEach((config) => {
      const raw = source[config.type] || {};
      const owned = Math.max(0, integer(raw.owned, 0));
      normalized[config.type] = {
        owned: owned,
        installed: clamp(integer(raw.installed, owned), 0, owned),
        level: clamp(integer(raw.level, 1), 1, config.maxLevel),
        condition: clamp(Number.isFinite(Number(raw.condition)) ? Number(raw.condition) : 100, 0, 100)
      };
    });

    const computerTypes = this.catalog.items.filter((item) => item.requiresComputerSlot).map((item) => item.type);
    const slots = this.getComputerSlots(furniture);
    const installed = computerTypes.reduce((total, type) => total + normalized[type].installed, 0);
    if (installed > slots) {
      let excess = installed - slots;
      computerTypes.slice().reverse().forEach((type) => {
        const removed = Math.min(excess, normalized[type].installed);
        normalized[type].installed -= removed;
        normalized[type].owned = Math.min(normalized[type].owned, normalized[type].installed);
        excess -= removed;
      });
      warnings.push('Installed computers exceeded map desks; extra computers were removed.');
    }
    return { devices: normalized, warnings: warnings };
  }

  getInstalledComputers(devices) {
    return this.catalog.items.reduce((total, config) => {
      if (!config.requiresComputerSlot) return total;
      return total + this.getRecord(devices, config.type).installed;
    }, 0);
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
    const root = state || {};
    const slots = this.getComputerSlots(root.furniture);
    const installedComputers = this.getInstalledComputers(root.devices);
    return {
      computerSlots: slots,
      installedComputers: installedComputers,
      freeComputerSlots: Math.max(0, slots - installedComputers),
      equipmentScore: this.calculateScore(root.devices),
      averageCondition: this.calculateAverageCondition(root.devices),
      dailyElectricity: this.calculateDailyElectricity(root.devices)
    };
  }

  getOperatingMetrics(state) {
    const root = state || (this.gameState && this.gameState.getState()) || {};
    const pools = [
      { tier: 'basic', type: 'basic_pc' },
      { tier: 'gaming', type: 'gaming_pc' },
      { tier: 'premium', type: 'premium_pc' }
    ].map((item) => {
      const config = this.catalog.byType[item.type];
      const record = this.getRecord(root.devices, item.type);
      return {
        tier: item.tier,
        count: record.installed,
        performance: Math.round(config.performance * (1 + (record.level - 1) * 0.15) * record.condition / 100),
        powerUsage: config.powerUsage
      };
    });
    const router = this.getRecord(root.devices, 'gigabit_router');
    const routerConfig = this.catalog.byType.gigabit_router;
    const ups = this.getRecord(root.devices, 'ups_power');
    const upsConfig = this.catalog.byType.ups_power;
    const count = pools.reduce((sum, pool) => sum + pool.count, 0);
    const performance = pools.reduce((sum, pool) => sum + pool.count * pool.performance, 0);
    return {
      installedComputerCount: count,
      computerPools: pools,
      averagePerformance: count ? Math.round(performance / count) : 0,
      equipmentScore: this.calculateScore(root.devices),
      networkQuality: Math.min(100, 25 + router.installed * 35 + (router.level - 1) * 8),
      networkCapacity: 5 + router.installed * routerConfig.capacity * (1 + (router.level - 1) * 0.25),
      powerCapacity: 4 + ups.installed * upsConfig.capacity * (1 + (ups.level - 1) * 0.25),
      currentPowerDemand: Math.round(this.catalog.items.reduce((sum, config) => sum + this.getRecord(root.devices, config.type).installed * config.powerUsage * (config.requiresComputerSlot ? 0.15 : 1), 0) * 10) / 10
    };
  }

  purchase(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: 'Unknown device type.' };
    if (!this.financeSystem) return { ok: false, message: 'Device finance is not ready.' };
    if (config.requiresComputerSlot) {
      const snapshot = this.gameState.snapshot();
      if (!this.createComputerDesk(snapshot, type)) return { ok: false, message: 'No room to place this computer. Expand first.' };
    }
    return this.financeSystem.recordExpense({
      category: 'equipment_purchase',
      amount: config.purchasePrice,
      sourceSystem: 'device',
      sourceId: type,
      description: 'Purchase ' + config.name,
      successMessage: 'Purchased 1 ' + config.name + '.',
      mutate: (state) => {
        state.devices = this.sanitizeDevices(state.devices, state.furniture).devices;
        if (config.requiresComputerSlot) this.createComputerDesk(state, type);
        state.devices[type].owned += 1;
        state.devices[type].installed += 1;
      }
    });
  }

  sell(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: 'Unknown device type.' };
    if (!this.financeSystem) return { ok: false, message: 'Device finance is not ready.' };
    const record = this.getRecord(this.gameState.getState().devices, type);
    if (record.owned <= 0) return { ok: false, message: 'No device to sell.' };
    const refund = Math.max(1, Math.floor(config.purchasePrice * 0.5));
    return this.financeSystem.recordIncome({
      category: 'asset_sale_refund',
      amount: refund,
      sourceSystem: 'device',
      sourceId: type,
      description: 'Sell ' + config.name,
      successMessage: 'Sold 1 ' + config.name + '.',
      isOperating: false,
      mutate: (state) => {
        state.devices = this.sanitizeDevices(state.devices, state.furniture).devices;
        state.devices[type].owned = Math.max(0, state.devices[type].owned - 1);
        state.devices[type].installed = Math.max(0, state.devices[type].installed - 1);
        if (config.requiresComputerSlot) this.removeComputerDesk(state, type);
      }
    });
  }

  upgrade(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: 'Unknown device type.' };
    const record = this.getRecord(this.gameState.getState().devices, type);
    if (record.owned <= 0) return { ok: false, message: 'Purchase this device first.' };
    if (record.level >= config.maxLevel) return { ok: false, message: 'Already at max level.' };
    const cost = config.upgradeBasePrice * record.level;
    return this.financeSystem.recordExpense({
      category: 'equipment_upgrade',
      amount: cost,
      sourceSystem: 'device',
      sourceId: type,
      description: 'Upgrade ' + config.name,
      successMessage: 'Device upgraded to Lv.' + (record.level + 1) + '.',
      mutate: (state) => {
        state.devices = this.sanitizeDevices(state.devices, state.furniture).devices;
        state.devices[type].level += 1;
      }
    });
  }

  repair(type) {
    const config = this.catalog.byType[type];
    if (!config) return { ok: false, message: 'Unknown device type.' };
    const record = this.getRecord(this.gameState.getState().devices, type);
    if (record.condition >= 100) return { ok: false, message: 'Device condition is already good.' };
    const cost = Math.ceil((100 - record.condition) * config.dailyMaintenance);
    return this.financeSystem.recordExpense({
      category: 'equipment_maintenance',
      amount: cost,
      sourceSystem: 'device',
      sourceId: type,
      description: 'Repair ' + config.name,
      successMessage: 'Device repaired.',
      mutate: (state) => {
        state.devices = this.sanitizeDevices(state.devices, state.furniture).devices;
        state.devices[type].condition = 100;
      }
    });
  }
}

module.exports = DeviceSystem;
