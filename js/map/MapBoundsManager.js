'use strict';

const expansionConfig = require('../data/expansionConfig');

class MapBoundsManager {
  constructor(expansionSystem, cellSize) {
    this.expansionSystem = expansionSystem;
    this.cellSize = cellSize || 40;
  }

  getArea() {
    if (!this.expansionSystem) return expansionConfig.baseArea;
    return this.expansionSystem.getCurrentArea();
  }

  getDimensions() {
    const area = this.getArea();
    const baseSide = Math.sqrt(expansionConfig.baseArea);
    const ratio = expansionConfig.defaultGridColumns / expansionConfig.defaultGridRows;
    const scale = Math.sqrt(area) / baseSide;
    const columns = Math.max(1, Math.round(expansionConfig.defaultGridColumns * scale));
    const rows = Math.max(1, Math.round(columns / ratio));
    return {
      columns: columns,
      rows: rows,
      worldWidth: columns * this.cellSize,
      worldHeight: rows * this.cellSize
    };
  }

  getWorldSize() {
    const dims = this.getDimensions();
    return { width: dims.worldWidth, height: dims.worldHeight };
  }

  getBounds() {
    const { width, height } = this.getWorldSize();
    return { minX: 0, maxX: width, minY: 0, maxY: height };
  }

  refresh() {
    return this.getDimensions();
  }
}

module.exports = MapBoundsManager;