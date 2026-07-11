'use strict';

class GridMap {
  constructor(columns, rows) {
    this.columns = columns || 12;
    this.rows = rows || 8;
  }

  getCellSize(bounds) {
    return Math.floor(Math.min(bounds.width / this.columns, bounds.height / this.rows));
  }

  getInnerBounds(bounds) {
    const cell = this.getCellSize(bounds);
    const width = cell * this.columns;
    const height = cell * this.rows;
    return {
      x: Math.round(bounds.x + (bounds.width - width) / 2),
      y: Math.round(bounds.y + (bounds.height - height) / 2),
      width: width,
      height: height,
      cell: cell
    };
  }

  getRotatedSize(catalogItem, rotation) {
    const rotated = rotation === 90 || rotation === 270;
    return {
      width: rotated ? catalogItem.height : catalogItem.width,
      height: rotated ? catalogItem.width : catalogItem.height
    };
  }

  isInside(gridX, gridY, width, height) {
    return gridX >= 0 && gridY >= 0 && gridX + width <= this.columns && gridY + height <= this.rows;
  }

  getOccupiedCells(furniture, catalogItem) {
    const size = this.getRotatedSize(catalogItem, furniture.rotation || 0);
    const cells = [];
    for (let y = 0; y < size.height; y += 1) {
      for (let x = 0; x < size.width; x += 1) {
        cells.push({ x: furniture.gridX + x, y: furniture.gridY + y });
      }
    }
    return cells;
  }

  isAreaOccupied(items, catalogByType, target, ignoreId) {
    const targetItem = catalogByType[target.type];
    if (!targetItem) return true;
    const targetSize = this.getRotatedSize(targetItem, target.rotation || 0);
    const targetCells = {};
    for (let y = 0; y < targetSize.height; y += 1) {
      for (let x = 0; x < targetSize.width; x += 1) {
        targetCells[(target.gridX + x) + ',' + (target.gridY + y)] = true;
      }
    }
    return items.some((item) => {
      if (ignoreId && item.id === ignoreId) return false;
      const itemCatalog = catalogByType[item.type];
      if (!itemCatalog) return false;
      return this.getOccupiedCells(item, itemCatalog).some((cell) => targetCells[cell.x + ',' + cell.y]);
    });
  }

  validatePlacement(items, catalogByType, target, ignoreId) {
    const catalogItem = catalogByType[target.type];
    if (!catalogItem) return { ok: false, reason: '未知家具类型。' };
    const size = this.getRotatedSize(catalogItem, target.rotation || 0);
    if (!this.isInside(target.gridX, target.gridY, size.width, size.height)) {
      return { ok: false, reason: '家具超出可装修区域。' };
    }
    if (this.isAreaOccupied(items, catalogByType, target, ignoreId)) {
      return { ok: false, reason: '该位置已有其他家具。' };
    }
    return { ok: true, reason: '' };
  }

  getGridFromPoint(bounds, x, y) {
    const inner = this.getInnerBounds(bounds);
    if (x < inner.x || y < inner.y || x >= inner.x + inner.width || y >= inner.y + inner.height) return null;
    return {
      gridX: Math.floor((x - inner.x) / inner.cell),
      gridY: Math.floor((y - inner.y) / inner.cell)
    };
  }

  getCellRect(bounds, gridX, gridY, width, height) {
    const inner = this.getInnerBounds(bounds);
    return {
      x: inner.x + gridX * inner.cell,
      y: inner.y + gridY * inner.cell,
      width: width * inner.cell,
      height: height * inner.cell,
      cell: inner.cell
    };
  }

  draw(context, bounds, options) {
    const settings = options || {};
    const inner = this.getInnerBounds(bounds);
    context.save();
    context.fillStyle = '#76543b';
    context.fillRect(inner.x, inner.y, inner.width, inner.height);
    context.strokeStyle = settings.subtle ? 'rgba(224, 186, 117, 0.06)' : 'rgba(224, 186, 117, 0.18)';
    context.lineWidth = 1;
    for (let x = 0; x <= this.columns; x += 1) {
      const px = inner.x + x * inner.cell;
      context.beginPath();
      context.moveTo(px, inner.y);
      context.lineTo(px, inner.y + inner.height);
      context.stroke();
    }
    for (let y = 0; y <= this.rows; y += 1) {
      const py = inner.y + y * inner.cell;
      context.beginPath();
      context.moveTo(inner.x, py);
      context.lineTo(inner.x + inner.width, py);
      context.stroke();
    }
    context.strokeStyle = '#8d682e';
    context.lineWidth = 2;
    context.strokeRect(inner.x, inner.y, inner.width, inner.height);
    context.restore();
    return inner;
  }
}

module.exports = GridMap;
