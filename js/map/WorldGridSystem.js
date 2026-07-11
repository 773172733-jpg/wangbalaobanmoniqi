'use strict';

const MapBoundsManager = require('./MapBoundsManager');

class WorldGridSystem {
  constructor(expansionSystem, cellSize) {
    this.boundsManager = new MapBoundsManager(expansionSystem, cellSize);
    this.cellSize = cellSize || 40;
    this.columns = 0;
    this.rows = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.init();
  }

  init() {
    const dims = this.boundsManager.getDimensions();
    this.columns = dims.columns;
    this.rows = dims.rows;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  expand() {
    const oldColumns = this.columns;
    const oldRows = this.rows;
    const dims = this.boundsManager.refresh();
    const newColumns = dims.columns;
    const newRows = dims.rows;
    this.offsetX = Math.floor((newColumns - oldColumns) / 2);
    this.offsetY = Math.floor((newRows - oldRows) / 2);
    this.columns = newColumns;
    this.rows = newRows;
    return {
      oldColumns, oldRows,
      newColumns, newRows,
      offsetX: this.offsetX,
      offsetY: this.offsetY
    };
  }

  getWorldSize() {
    return { width: this.columns * this.cellSize, height: this.rows * this.cellSize };
  }

  getBounds() {
    const { width, height } = this.getWorldSize();
    return { minX: 0, maxX: width, minY: 0, maxY: height };
  }

  getCameraBounds() {
    return this.boundsManager.getCameraBounds();
  }

  isInside(gridX, gridY, w, h) {
    return gridX >= 0 && gridY >= 0 && gridX + w <= this.columns && gridY + h <= this.rows;
  }
}

module.exports = WorldGridSystem;