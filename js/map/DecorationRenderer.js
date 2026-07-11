'use strict';

const GridMap = require('./GridMap');
const CanvasUtils = require('../ui/CanvasUtils');
const RatingSystem = require('../systems/RatingSystem');

class DecorationRenderer {
  constructor(assetManager, gridMap) {
    this.assetManager = assetManager || null;
    this.gridMap = gridMap || new GridMap();
    this.catalogByType = RatingSystem.catalogByType;
  }

  drawComputer(context, rect, config, count) {
    context.fillStyle = config.renderStyle.body;
    context.fillRect(rect.x + 3, rect.y + rect.height * 0.36, rect.width - 6, rect.height * 0.32);
    context.fillStyle = '#8b5c36';
    context.fillRect(rect.x + 5, rect.y + rect.height * 0.36 + 2, rect.width - 10, 3);
    const monitors = count || 1;
    for (let i = 0; i < monitors; i += 1) {
      const w = Math.max(12, (rect.width - 12) / monitors - 5);
      const x = rect.x + 6 + i * ((rect.width - 12) / monitors);
      const y = rect.y + 5;
      context.fillStyle = '#132a38';
      context.fillRect(x, y, w, Math.max(8, rect.height * 0.22));
      context.fillStyle = config.renderStyle.accent;
      context.fillRect(x + 2, y + 2, w - 4, Math.max(4, rect.height * 0.22 - 4));
      context.fillStyle = '#263a3c';
      context.fillRect(x + 2, rect.y + rect.height - 11, Math.max(8, w - 4), 8);
    }
  }

  drawFurnitureShape(context, rect, config) {
    const type = config.type;
    if (type === 'standard_pc_desk') return this.drawComputer(context, rect, config, 1);
    if (type === 'double_gaming_desk') return this.drawComputer(context, rect, config, 2);
    if (type === 'vip_pc_set') {
      CanvasUtils.fillRoundedRect(context, rect, 4, '#24242f');
      context.fillStyle = '#d8a83f';
      context.font = 'bold 12px sans-serif';
      context.textAlign = 'center';
      context.fillText('VIP', rect.x + rect.width / 2, rect.y + 16);
      this.drawComputer(context, { x: rect.x + 4, y: rect.y + 14, width: rect.width - 8, height: rect.height - 16 }, config, 2);
      return;
    }
    if (type === 'cashier_counter') {
      context.fillStyle = '#7a4a2a';
      context.fillRect(rect.x + 3, rect.y + rect.height * 0.35, rect.width - 6, rect.height * 0.42);
      context.fillStyle = '#e0a84d';
      context.fillRect(rect.x + 3, rect.y + rect.height * 0.35, rect.width - 6, 5);
      context.fillStyle = '#315160';
      context.fillRect(rect.x + rect.width * 0.58, rect.y + 6, 14, 10);
      return;
    }
    if (type === 'sofa') {
      CanvasUtils.fillRoundedRect(context, { x: rect.x + 4, y: rect.y + 9, width: rect.width - 8, height: rect.height - 15 }, 5, '#2f6047');
      context.fillStyle = '#6ea36f';
      context.fillRect(rect.x + 7, rect.y + 5, rect.width - 14, 8);
      return;
    }
    if (type === 'plant') {
      context.fillStyle = '#7d4c29';
      context.fillRect(rect.x + rect.width / 2 - 5, rect.y + rect.height - 13, 10, 10);
      context.fillStyle = '#3f9b47';
      context.fillRect(rect.x + rect.width / 2 - 3, rect.y + 8, 6, rect.height - 18);
      context.fillRect(rect.x + rect.width / 2 - 12, rect.y + 12, 12, 8);
      context.fillRect(rect.x + rect.width / 2 + 1, rect.y + 9, 12, 10);
      return;
    }
    if (type === 'decorative_light') {
      context.fillStyle = '#6b4f23';
      context.fillRect(rect.x + rect.width / 2 - 4, rect.y + 7, 8, rect.height - 14);
      context.fillStyle = '#ffd15a';
      context.fillRect(rect.x + rect.width / 2 - 11, rect.y + 11, 22, 18);
      return;
    }
    if (type === 'trash_bin') {
      context.fillStyle = '#4f5a61';
      context.fillRect(rect.x + rect.width * 0.28, rect.y + 10, rect.width * 0.44, rect.height - 17);
      context.fillStyle = '#7e8a91';
      context.fillRect(rect.x + rect.width * 0.24, rect.y + 7, rect.width * 0.52, 5);
    }
  }

  drawSprite(context, rect, config, rotation) {
    const visual = config.visual || {};
    const image = visual.spriteKey && this.assetManager ? this.assetManager.getImage(visual.spriteKey) : null;
    if (!image || !image.width || !image.height) return false;
    const scale = visual.renderScale || 1;
    const width = Math.round(rect.width * scale);
    const height = Math.round(rect.height * scale);
    const centerX = Math.round(rect.x + rect.width * (visual.anchorX == null ? 0.5 : visual.anchorX) + (visual.renderOffsetX || 0));
    const centerY = Math.round(rect.y + rect.height * (visual.anchorY == null ? 0.5 : visual.anchorY) + (visual.renderOffsetY || 0));
    context.save();
    context.imageSmoothingEnabled = false;
    context.translate(centerX, centerY);
    context.rotate((rotation || 0) * Math.PI / 180);
    context.drawImage(image, Math.round(-width / 2), Math.round(-height / 2), width, height);
    context.restore();
    return true;
  }

  drawOne(context, bounds, item, options) {
    const config = this.catalogByType[item.type];
    if (!config) return;
    const renderConfig = Object.assign({}, config, { renderStyle: (config.visual && config.visual.fallbackStyle) || config.renderStyle });
    const size = this.gridMap.getRotatedSize(config, item.rotation || 0);
    const rect = this.gridMap.getCellRect(bounds, item.gridX, item.gridY, size.width, size.height);
    const pad = Math.max(2, Math.floor(rect.cell * 0.08));
    const box = { x: rect.x + pad, y: rect.y + pad, width: rect.width - pad * 2, height: rect.height - pad * 2 };
    context.save();
    if (options && options.alpha) context.globalAlpha = options.alpha;
    if (!this.drawSprite(context, box, config, item.rotation)) this.drawFurnitureShape(context, box, renderConfig);
    context.restore();
    if (options && options.selected) {
      context.strokeStyle = '#f0c15b';
      context.lineWidth = 2;
      context.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    }
  }

  drawPreview(context, bounds, item, valid) {
    if (!item) return;
    this.drawOne(context, bounds, item, { alpha: 0.58 });
    const config = this.catalogByType[item.type];
    if (!config) return;
    const size = this.gridMap.getRotatedSize(config, item.rotation || 0);
    const rect = this.gridMap.getCellRect(bounds, item.gridX, item.gridY, size.width, size.height);
    context.strokeStyle = valid ? '#69c47b' : '#dd5d52';
    context.lineWidth = 3;
    context.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
  }

  draw(context, bounds, furniture, options) {
    const settings = Object.assign({
      showGrid: true,
      subtleGrid: false,
      selectedId: null,
      preview: null,
      previewValid: true
    }, options || {});
    CanvasUtils.fillRoundedRect(context, bounds, 6, '#172a31');
    CanvasUtils.strokeRoundedRect(context, bounds, 6, '#8d682e', 1);
    const room = { x: bounds.x + 8, y: bounds.y + 8, width: bounds.width - 16, height: bounds.height - 16 };
    context.save();
    context.beginPath();
    context.rect(room.x, room.y, room.width, room.height);
    context.clip();
    this.gridMap.draw(context, room, { subtle: settings.subtleGrid || !settings.showGrid });
    (Array.isArray(furniture) ? furniture : []).forEach((item) => {
      this.drawOne(context, room, item, { selected: item.id === settings.selectedId });
    });
    this.drawPreview(context, room, settings.preview, settings.previewValid);
    context.restore();
    return room;
  }


  drawViewport(context, camera, furniture, options) {
    const settings = Object.assign({ cellSize: 60, showGrid: true, selectedId: null, preview: null, previewValid: true }, options || {});
    const view = camera.viewportRect;
    const cell = settings.cellSize;
    context.save();
    context.beginPath();
    context.rect(view.x, view.y, view.width, view.height);
    context.clip();
    context.fillStyle = '#172a31';
    context.fillRect(view.x, view.y, view.width, view.height);
    const origin = camera.worldToScreen(0, 0);
    const worldW = this.gridMap.columns * cell * camera.zoom;
    const worldH = this.gridMap.rows * cell * camera.zoom;
    context.fillStyle = '#76543b';
    context.fillRect(Math.round(origin.x), Math.round(origin.y), Math.round(worldW), Math.round(worldH));
    if (settings.showGrid) {
      context.strokeStyle = 'rgba(224,186,117,0.18)';
      context.lineWidth = 1;
      for (let x = 0; x <= this.gridMap.columns; x += 1) {
        const p = camera.worldToScreen(x * cell, 0);
        context.beginPath(); context.moveTo(Math.round(p.x) + 0.5, origin.y); context.lineTo(Math.round(p.x) + 0.5, origin.y + worldH); context.stroke();
      }
      for (let y = 0; y <= this.gridMap.rows; y += 1) {
        const p = camera.worldToScreen(0, y * cell);
        context.beginPath(); context.moveTo(origin.x, Math.round(p.y) + 0.5); context.lineTo(origin.x + worldW, Math.round(p.y) + 0.5); context.stroke();
      }
    }
    const drawItem = (item, alpha, selected, valid) => {
      const config = this.catalogByType[item.type];
      if (!config) return;
      const renderConfig = Object.assign({}, config, { renderStyle: (config.visual && config.visual.fallbackStyle) || config.renderStyle });
      const size = this.gridMap.getRotatedSize(config, item.rotation || 0);
      const p = camera.worldToScreen(item.gridX * cell, item.gridY * cell);
      const box = { x: Math.round(p.x + 3), y: Math.round(p.y + 3), width: Math.round(size.width * cell * camera.zoom - 6), height: Math.round(size.height * cell * camera.zoom - 6) };
      context.save(); context.globalAlpha = alpha || 1;
      if (!this.drawSprite(context, box, config, item.rotation)) this.drawFurnitureShape(context, box, renderConfig);
      context.restore();
      if (selected || valid != null) {
        context.strokeStyle = valid == null ? '#f0c15b' : (valid ? '#69c47b' : '#dd5d52');
        context.lineWidth = valid == null ? 2 : 3;
        context.strokeRect(box.x, box.y, box.width, box.height);
      }
    };
    (furniture || []).forEach((item) => drawItem(item, 1, item.id === settings.selectedId, null));
    if (settings.preview) drawItem(settings.preview, 0.58, false, settings.previewValid);
    context.restore();
  }
}

module.exports = DecorationRenderer;
