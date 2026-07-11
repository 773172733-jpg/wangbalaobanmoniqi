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


  generateWalls() {
    var cols = this.columns;
    var rows = this.rows;
    var walls = [];
    // Top horizontal walls (normal)
    for (var x = 0; x < cols; x++) {
      walls.push({ type: "wall_horizontal", gridX: x, gridY: -1, rotation: 0, flipH: false, flipV: false });
    }
    // Bottom horizontal walls (mirrored vertically)
    for (var x = 0; x < cols; x++) {
      walls.push({ type: "wall_horizontal", gridX: x, gridY: rows, rotation: 0, flipH: false, flipV: true });
    }
    // Left vertical walls (normal)
    for (var y = 0; y < rows; y++) {
      walls.push({ type: "wall_vertical", gridX: -1, gridY: y, rotation: 0, flipH: false, flipV: false });
    }
    // Right vertical walls (mirrored horizontally)
    for (var y = 0; y < rows; y++) {
      walls.push({ type: "wall_vertical", gridX: cols, gridY: y, rotation: 0, flipH: true, flipV: false });
    }
    // 4 corners with rotation
    walls.push({ type: "wall_corner", gridX: -1, gridY: -1, rotation: 0, flipH: false, flipV: false });
    walls.push({ type: "wall_corner", gridX: cols, gridY: -1, rotation: 90, flipH: false, flipV: false });
    walls.push({ type: "wall_corner", gridX: cols, gridY: rows, rotation: 180, flipH: false, flipV: false });
    walls.push({ type: "wall_corner", gridX: -1, gridY: rows, rotation: 270, flipH: false, flipV: false });
    this.walls = walls;
    return walls;
  }

  getWalls() {
    if (!this.walls || !this.walls.length) this.generateWalls();
    return this.walls;
  }

  expand() {
    var oldColumns = this.columns;
    var oldRows = this.rows;
    var dims = this.boundsManager.refresh();
    var newColumns = dims.columns;
    var newRows = dims.rows;
    this.offsetX = Math.floor((newColumns - oldColumns) / 2);
    this.offsetY = Math.floor((newRows - oldRows) / 2);
    this.columns = newColumns;
    this.rows = newRows;
    this.generateWalls();
    return {
      oldColumns: oldColumns, oldRows: oldRows,
      newColumns: newColumns, newRows: newRows,
      offsetX: this.offsetX,
      offsetY: this.offsetY
    };
  }
  getWorldSize() {
    return { width: this.columns * this.cellSize, height: this.rows * this.cellSize };
  }

  getBounds() {
    var size = this.getWorldSize();
    return { minX: 0, maxX: size.width, minY: 0, maxY: size.height };
  }

  getCameraBounds() {
    return this.boundsManager.getCameraBounds();
  }

  isInside(gridX, gridY, w, h) {
    return gridX >= 0 && gridY >= 0 && gridX + w <= this.columns && gridY + h <= this.rows;
  }
}

module.exports = WorldGridSystem;