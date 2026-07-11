'use strict';

const STORAGE_KEY = 'internetCafeOwnerSave';
const CURRENT_VERSION = 3;
const furnitureCatalog = require('../data/furnitureCatalog');
const GridMap = require('../map/GridMap');
const FurnitureManager = require('../map/FurnitureManager');
const RatingSystem = require('../systems/RatingSystem');
const DeviceSystem = require('../systems/DeviceSystem');

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

  normalize(data) {
    const merged = mergeDefaults(this.defaultState, data);
    merged.saveVersion = CURRENT_VERSION;
    merged.furniture = this.furnitureManager.sanitize(merged.furniture);
    merged.devices = this.deviceSystem.convertLegacyDevices(data && data.devices);
    const normalizedDevices = this.deviceSystem.sanitizeDevices(merged.devices, merged.furniture);
    merged.devices = normalizedDevices.devices;
    normalizedDevices.warnings.forEach((message) => console.warn('[存档] ' + message));
    const deviceScore = this.deviceSystem.calculateScore(merged.devices);
    const ratings = this.ratingSystem.combineDeviceRating(this.ratingSystem.calculate(merged.furniture), deviceScore);
    merged.cafe = Object.assign({}, merged.cafe, ratings);
    return merged;
  }
}

SaveManager.STORAGE_KEY = STORAGE_KEY;
SaveManager.CURRENT_VERSION = CURRENT_VERSION;

module.exports = SaveManager;
