'use strict';

const STORAGE_KEY = 'internetCafeOwnerSave';
const CURRENT_VERSION = 9;
const furnitureCatalog = require('../data/furnitureCatalog');
const GridMap = require('../map/GridMap');
const FurnitureManager = require('../map/FurnitureManager');
const RatingSystem = require('../systems/RatingSystem');
const DeviceSystem = require('../systems/DeviceSystem');
const EmployeeSystem = require('../systems/EmployeeSystem');
const FinanceSystem = require('../systems/FinanceSystem');
const OperatingMetricsSystem = require('../systems/OperatingMetricsSystem');
const InventorySystem = require('../systems/InventorySystem');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeDefaults(defaultValue, savedValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(savedValue) ? clone(savedValue) : clone(defaultValue);
  }
  if (isPlainObject(defaultValue)) {
    const result = {};
    const source = isPlainObject(savedValue) ? savedValue : {};
    Object.keys(defaultValue).forEach((key) => {
      result[key] = mergeDefaults(defaultValue[key], source[key]);
    });
    return result;
  }
  return savedValue === undefined || savedValue === null ? defaultValue : savedValue;
}

class SaveManager {
  constructor(defaultState) {
    this.defaultState = defaultState;
    this.catalogByType = {};
    furnitureCatalog.forEach((item) => {
      this.catalogByType[item.type] = item;
    });
    this.gridMap = new GridMap();
    this.furnitureManager = new FurnitureManager(this.catalogByType, this.gridMap);
    this.ratingSystem = new RatingSystem();
    this.deviceSystem = new DeviceSystem();
    this.employeeSystem = new EmployeeSystem();
    this.financeSystem = new FinanceSystem();
    this.operatingMetricsSystem = new OperatingMetricsSystem();
    this.inventorySystem = new InventorySystem();
  }

  load() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY);
      if (!saved) return this.createNew();
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
      if (!isPlainObject(parsed)) throw new Error('存档根节点不是对象');
      const migrated = this.normalize(this.migrate(parsed));
      console.log('[存档] 存档读取成功');
      return migrated;
    } catch (error) {
      console.warn('[存档] 存档解析失败，已恢复默认数据:', error.message);
      return this.createNew();
    }
  }

  createNew() {
    const data = this.normalize(clone(this.defaultState));
    this.save(data);
    console.log('[存档] 已创建新存档');
    return data;
  }

  save(data) {
    try {
      wx.setStorageSync(STORAGE_KEY, clone(data));
      return true;
    } catch (error) {
      console.warn('[存档] 保存失败:', error.message);
      return false;
    }
  }

  migrate(savedData) {
    const version = Number(savedData.saveVersion) || 1;
    let migrated = clone(savedData);
    if (version < 2) migrated = this.migrateV1ToV2(migrated);
    if (version < 3) migrated = this.migrateV2ToV3(migrated);
    if (version < 4) migrated = this.migrateV3ToV4(migrated);
    if (version < 5) migrated = this.migrateV4ToV5(migrated);
    if (version < 6) migrated = this.migrateV5ToV6(migrated);
    if (version < 7) migrated = this.migrateV6ToV7(migrated);
    if (version < 8) migrated = this.migrateV7ToV8(migrated);
    if (version < 9) migrated = this.migrateV8ToV9(migrated);
    if (version > CURRENT_VERSION) {
      console.warn('[存档] 检测到更高版本存档，将使用兼容字段读取');
    }
    migrated.saveVersion = CURRENT_VERSION;
    return migrated;
  }

  migrateV1ToV2(data) {
    if (!isPlainObject(data.cafe)) data.cafe = {};
    if (!Array.isArray(data.furniture)) data.furniture = [];
    if (data.cafe.comfort === undefined) data.cafe.comfort = 50;
    if (data.cafe.capacity === undefined) data.cafe.capacity = 0;
    if (data.cafe.overall === undefined) data.cafe.overall = data.cafe.satisfaction || 50;
    return data;
  }

  migrateV2ToV3(data) {
    if (data.devices === undefined || data.devices === null) data.devices = {};
    return data;
  }

  migrateV3ToV4(data) {
    if (!Array.isArray(data.employees)) data.employees = [];
    if (!isPlainObject(data.employeeMarket)) data.employeeMarket = { refreshTime: '', candidates: [] };
    if (!Array.isArray(data.employeeMarket.candidates)) data.employeeMarket.candidates = [];
    return data;
  }

  migrateV4ToV5(data) {
    if (!isPlainObject(data.marketing)) data.marketing = { awareness: 0, activeCampaigns: [], cooldowns: {}, totalSpent: 0 };
    return data;
  }

  migrateV5ToV6(data) {
    if (!isPlainObject(data.finance)) data.finance = FinanceSystem.defaultState();
    return data;
  }

  migrateV6ToV7(data) {
    if (!isPlainObject(data.cafe)) data.cafe = {};
    if (!isPlainObject(data.cafe.pricing)) data.cafe.pricing = { hourlyRate: 8 };
    if (!isPlainObject(data.time)) data.time = { year: 1, month: 1, day: 1, hour: 8 };
    if (!Number.isFinite(Number(data.time.hour))) data.time.hour = 8;
    if (!isPlainObject(data.businessSimulation)) data.businessSimulation = clone(this.defaultState.businessSimulation);
    return data;
  }

  migrateV7ToV8(data) {
    const expansionConfig = require('../data/expansionConfig');
    if (!isPlainObject(data.expansion)) {
      data.expansion = {
        level: 0,
        currentArea: expansionConfig.baseArea,
        baseArea: expansionConfig.baseArea,
        history: []
      };
    }
    return data;
  }

  migrateV8ToV9(data) {
    if (!Array.isArray(data.furniture)) data.furniture = [];
    data.devices = this.deviceSystem.convertLegacyDevices(data.devices);
    const infrastructureTypes = ['gigabit_router', 'commercial_ac', 'ups_power'];
    infrastructureTypes.forEach((type) => {
      const legacy = data.devices[type];
      const alreadyPlaced = data.furniture.some((item) => item && item.type === type);
      if (!alreadyPlaced && legacy && Number(legacy.owned || legacy.installed) > 0) {
        const config = this.catalogByType[type];
        let placed = null;
        for (let y = 0; y < this.gridMap.rows && !placed; y += 1) {
          for (let x = 0; x < this.gridMap.columns && !placed; x += 1) {
            const candidate = { id: 'migrated_' + type, type: type, gridX: x, gridY: y, rotation: 0, level: Math.max(1, Math.min(config.maxLevel || 5, Math.floor(Number(legacy.level) || 1))), condition: Math.max(0, Math.min(100, Math.round(Number(legacy.condition) || 100))) };
            if (this.gridMap.validatePlacement(data.furniture, this.catalogByType, candidate, candidate.id).ok) placed = candidate;
          }
        }
        if (!placed) {
          const rightEdge = data.furniture.reduce((max, item) => { const itemConfig = item && this.catalogByType[item.type]; return itemConfig ? Math.max(max, (Number(item.gridX) || 0) + itemConfig.width) : max; }, 0);
          placed = { id: 'migrated_' + type, type: type, gridX: rightEdge + 1, gridY: 0, rotation: 0, level: Math.max(1, Math.min(config.maxLevel || 5, Math.floor(Number(legacy.level) || 1))), condition: Math.max(0, Math.min(100, Math.round(Number(legacy.condition) || 100))) };
        }
        if (placed) data.furniture.push(placed);
      }
      delete data.devices[type];
    });
    data.inventory = this.inventorySystem.normalize(data.inventory);
    return data;
  }
  normalize(data) {
    const merged = mergeDefaults(this.defaultState, data);
    merged.saveVersion = CURRENT_VERSION;
    var maxGX = 11, maxGY = 7;
    (Array.isArray(merged.furniture) ? merged.furniture : []).forEach(function(f) {
      if (f && typeof f.gridX === 'number') maxGX = Math.max(maxGX, f.gridX);
      if (f && typeof f.gridY === 'number') maxGY = Math.max(maxGY, f.gridY);
    });
    this.gridMap.columns = Math.max(this.gridMap.columns || 12, maxGX + 2);
    this.gridMap.rows = Math.max(this.gridMap.rows || 8, maxGY + 2);
    merged.furniture = this.furnitureManager.sanitize(merged.furniture);
    merged.devices = this.deviceSystem.convertLegacyDevices(data && data.devices);
    const normalizedDevices = this.deviceSystem.sanitizeDevices(merged.devices, merged.furniture);
    merged.devices = normalizedDevices.devices;
    if (!Array.isArray(merged.employees)) merged.employees = [];
    if (!isPlainObject(merged.employeeMarket)) merged.employeeMarket = { refreshTime: '', candidates: [] };
    if (!Array.isArray(merged.employeeMarket.candidates)) merged.employeeMarket.candidates = [];
    if (!isPlainObject(merged.marketing)) merged.marketing = clone(this.defaultState.marketing);
    if (!Array.isArray(merged.marketing.activeCampaigns)) merged.marketing.activeCampaigns = [];
    merged.marketing.cooldowns = isPlainObject(data && data.marketing && data.marketing.cooldowns) ? clone(data.marketing.cooldowns) : {};
    merged.finance = this.financeSystem.normalizeFinance(data && data.finance);
    merged.inventory = this.inventorySystem.normalize(data && data.inventory);
    merged.time.hour = Math.max(0, Math.min(23, Math.floor(Number(merged.time.hour) || 0)));
    if (!isPlainObject(merged.cafe.pricing)) merged.cafe.pricing = { hourlyRate: 8 };
    merged.cafe.pricing.hourlyRate = Math.max(0, Number(merged.cafe.pricing.hourlyRate) || 8);
    if (!isPlainObject(merged.businessSimulation)) merged.businessSimulation = clone(this.defaultState.businessSimulation);
    if (!isPlainObject(merged.expansion)) merged.expansion = clone(this.defaultState.expansion);
    merged.businessSimulation.lastProcessedHourKey = typeof merged.businessSimulation.lastProcessedHourKey === 'string' ? merged.businessSimulation.lastProcessedHourKey : null;
    merged.businessSimulation.currentDayKey = typeof merged.businessSimulation.currentDayKey === 'string' ? merged.businessSimulation.currentDayKey : null;
    merged.businessSimulation.activeCohorts = (Array.isArray(merged.businessSimulation.activeCohorts) ? merged.businessSimulation.activeCohorts : []).filter((item) => item && ['student', 'gamer', 'office_worker', 'streamer'].indexOf(item.segmentType) >= 0 && ['basic', 'gaming', 'premium'].indexOf(item.computerTier) >= 0 && Number(item.count) > 0 && Number(item.remainingHours) > 0).map((item) => ({ id: String(item.id || 'cohort_recovered'), segmentType: item.segmentType, computerTier: item.computerTier, count: Math.floor(Number(item.count)), remainingHours: Math.floor(Number(item.remainingHours)), hourlyRate: Math.max(0, Number(item.hourlyRate) || 8), satisfaction: Math.max(0, Math.min(100, Math.round(Number(item.satisfaction) || 50))) }));
    merged.businessSimulation.dailyHistory = (Array.isArray(merged.businessSimulation.dailyHistory) ? merged.businessSimulation.dailyHistory : []).filter((item) => item && isPlainObject(item.date)).slice(-30);
    if (!Number.isFinite(Number(merged.player.cash))) merged.player.cash = 0;
    else merged.player.cash = Math.round(Number(merged.player.cash));
    const deviceScore = this.deviceSystem.calculateScore(merged.devices);
    let ratings = this.ratingSystem.combineDeviceRating(this.ratingSystem.calculate(merged.furniture), deviceScore);
    ratings = this.ratingSystem.combineEmployeeRating(ratings, this.employeeSystem.getServiceScore(merged));
    ratings.satisfaction = Math.max(0, Math.min(100, Math.round(Number(merged.cafe.satisfaction) || ratings.overall)));
    merged.cafe = Object.assign({}, merged.cafe, ratings);
    const operating = this.operatingMetricsSystem.getMetrics(merged);
    merged.player.level = Math.max(1, Math.min(10, Math.max(Number(merged.player.level) || 1, operating.cafe.level)));
    merged.cafe.businessScore = operating.cafe.businessScore;
    merged.cafe.environment = operating.decoration.environmentScore;
    merged.cafe.comfort = operating.decoration.comfortScore;
    merged.cafe.hygiene = operating.decoration.hygieneScore;
    return merged;
  }
}

SaveManager.STORAGE_KEY = STORAGE_KEY;
SaveManager.CURRENT_VERSION = CURRENT_VERSION;

module.exports = SaveManager;
