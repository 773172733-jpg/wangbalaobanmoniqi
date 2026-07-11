'use strict';

class MapSystem {
  constructor(expansionSystem, cellSize) {
    this.expansionSystem = expansionSystem;
    this.cellSize = cellSize || 40;
  }

  getDimensions() {
    if (!this.expansionSystem) {
      return { columns: 12, rows: 8, worldWidth: 480, worldHeight: 320 };
    }
    return this.expansionSystem.getMapDimensions();
  }

  getWorldSize() {
    const dims = this.getDimensions();
    return { width: dims.worldWidth, height: dims.worldHeight };
  }

  getBounds() {
    const { width, height } = this.getWorldSize();
    return { minX: 0, maxX: width, minY: 0, maxY: height };
  }

  getColumns() {
    return this.getDimensions().columns;
  }

  getRows() {
    return this.getDimensions().rows;
  }
}

module.exports = MapSystem;