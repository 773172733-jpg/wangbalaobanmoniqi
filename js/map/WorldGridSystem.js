'use strict';

const MapBoundsManager = require('./MapBoundsManager');

const WALL_DEPTH_CELLS = 1;

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
    for (var x = 0; x < cols; x++) {
      walls.push({ type: 'wall_horizontal', side: 'top', index: x });
    }
    for (var x = 0; x < cols; x++) {
      walls.push({ type: 'wall_horizontal', side: 'bottom', index: x });
    }
    for (var y = 0; y < rows; y++) {
      walls.push({ type: 'wall_vertical', side: 'left', index: y });
    }
    for (var y = 0; y < rows; y++) {
      walls.push({ type: 'wall_vertical', side: 'right', index: y });
    }
    walls.push({ type: 'wall_corner', corner: 'topLeft', flipH: false, flipV: false });
    walls.push({ type: 'wall_corner', corner: 'topRight', flipH: true, flipV: false });
    walls.push({ type: 'wall_corner', corner: 'bottomLeft', flipH: false, flipV: true });
    walls.push({ type: 'wall_corner', corner: 'bottomRight', flipH: true, flipV: true });
    this.walls = walls;
    return walls;
  }

  getWalls() {
    if (!this.walls || !this.walls.length) this.generateWalls();
    return this.walls;
  }

  getWallWorldRects() {
    var all = this.getWalls();
    var cell = this.cellSize;
    var wallDepth = cell * WALL_DEPTH_CELLS;
    var worldWidth = this.columns * cell;
    var worldHeight = this.rows * cell;
    var rects = [];
    for (var i = 0; i < all.length; i++) {
      var w = all[i];
      var rect = null;
      if (w.type === 'wall_horizontal') {
        if (w.side === 'top') rect = { x: w.index * cell, y: -wallDepth, width: cell, height: wallDepth };
        else rect = { x: w.index * cell, y: worldHeight, width: cell, height: wallDepth };
      } else if (w.type === 'wall_vertical') {
        if (w.side === 'left') rect = { x: -wallDepth, y: w.index * cell, width: wallDepth, height: cell };
        else rect = { x: worldWidth, y: w.index * cell, width: wallDepth, height: cell };
      } else if (w.type === 'wall_corner') {
        if (w.corner === 'topLeft') rect = { x: -wallDepth, y: -wallDepth, width: wallDepth, height: wallDepth };
        else if (w.corner === 'topRight') rect = { x: worldWidth, y: -wallDepth, width: wallDepth, height: wallDepth };
        else if (w.corner === 'bottomLeft') rect = { x: -wallDepth, y: worldHeight, width: wallDepth, height: wallDepth };
        else if (w.corner === 'bottomRight') rect = { x: worldWidth, y: worldHeight, width: wallDepth, height: wallDepth };
      }
      if (rect) rects.push({ type: w.type, side: w.side, corner: w.corner, index: w.index, rect: rect });
    }
    return rects;
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

WorldGridSystem.WALL_DEPTH_CELLS = WALL_DEPTH_CELLS;

module.exports = WorldGridSystem;