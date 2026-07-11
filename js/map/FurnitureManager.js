'use strict';

class FurnitureManager {
  constructor(catalogByType, gridMap) {
    this.catalogByType = catalogByType;
    this.gridMap = gridMap;
  }

  create(type, gridX, gridY, rotation) {
    return {
      id: 'furniture_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      type: type,
      gridX: gridX,
      gridY: gridY,
      rotation: this.normalizeRotation(rotation)
    };
  }

  normalizeRotation(rotation) {
    const value = Number(rotation) || 0;
    return [0, 90, 180, 270].indexOf(value) >= 0 ? value : 0;
  }

  countByType(items, type) {
    return items.filter((item) => item.type === type).length;
  }

  find(items, id) {
    return items.find((item) => item.id === id) || null;
  }

  canAdd(items, type) {
    const catalogItem = this.catalogByType[type];
    if (!catalogItem) return { ok: false, reason: '未知家具类型。' };
    if (catalogItem.maxCount && this.countByType(items, type) >= catalogItem.maxCount) {
      return { ok: false, reason: '该家具已达到最大数量。' };
    }
    return { ok: true, reason: '' };
  }

  validateAdd(items, item) {
    const count = this.canAdd(items, item.type);
    if (!count.ok) return count;
    return this.gridMap.validatePlacement(items, this.catalogByType, item, item.id);
  }

  validateMove(items, item) {
    return this.gridMap.validatePlacement(items, this.catalogByType, item, item.id);
  }

  add(items, item) {
    return items.concat([item]);
  }

  move(items, id, gridX, gridY) {
    return items.map((item) => item.id === id ? Object.assign({}, item, { gridX: gridX, gridY: gridY }) : item);
  }

  rotate(items, id) {
    return items.map((item) => item.id === id ? Object.assign({}, item, { rotation: (this.normalizeRotation(item.rotation) + 90) % 360 }) : item);
  }

  remove(items, id) {
    return items.filter((item) => item.id !== id);
  }

  sanitize(items) {
    if (!Array.isArray(items)) return [];
    const result = [];
    items.forEach((raw) => {
      if (!raw || typeof raw !== 'object') return;
      const type = raw.type;
      if (!this.catalogByType[type]) return;
      const item = {
        id: String(raw.id || this.create(type, 0, 0, 0).id),
        type: type,
        gridX: Math.floor(Number(raw.gridX)),
        gridY: Math.floor(Number(raw.gridY)),
        rotation: this.normalizeRotation(raw.rotation)
      };
      if (raw.textureVariant != null) item.textureVariant = raw.textureVariant;
      if (raw.sourceSystem) item.sourceSystem = raw.sourceSystem;
      if (!Number.isFinite(item.gridX) || !Number.isFinite(item.gridY)) return;
      if (this.gridMap.validatePlacement(result, this.catalogByType, item, item.id).ok) result.push(item);
    });
    return result;
  }
}

module.exports = FurnitureManager;
