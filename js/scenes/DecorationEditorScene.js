'use strict';

const CanvasUtils = require('../ui/CanvasUtils');
const Camera2D = require('../map/Camera2D');
const GridMap = require('../map/GridMap');
const FurnitureManager = require('../map/FurnitureManager');
const DecorationRenderer = require('../map/DecorationRenderer');
const DecorationDraft = require('../systems/DecorationDraft');
const RatingSystem = require('../systems/RatingSystem');
const catalog = require('../data/furnitureCatalog');
const FinanceSystem = require('../systems/FinanceSystem');
const ExpansionSystem = require('../systems/ExpansionSystem');
const MapSystem = require('../map/MapSystem');

function rect(x, y, width, height) { return { x, y, width, height }; }
function inside(point, box) { return point && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height; }
function distance(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

class DecorationEditorScene {
  constructor(deps) {
    Object.assign(this, deps);
    this.name = 'DecorationEditorScene';
    this.gridMap = new GridMap();
    this.cellSize = 40;
    this.ratingSystem = new RatingSystem();
    this.catalogByType = RatingSystem.catalogByType;
    this.furnitureManager = new FurnitureManager(this.catalogByType, this.gridMap);
    this.financeSystem = new FinanceSystem(this.gameState, this.saveManager);
    this.expansionSystem = new ExpansionSystem(this.gameState, this.saveManager);
    this.renderer = new DecorationRenderer(this.assetManager, this.gridMap);
    this.camera = new Camera2D({ worldWidth: this.gridMap.columns * this.cellSize, worldHeight: this.gridMap.rows * this.cellSize });
    this.draft = null;
    this.drawerOpen = false;
    this.detailOpen = false;
    this.expansionOpen = false;
    this.category = '全部';
    this.catalogScroll = 0;
    this.showGrid = true;
    this.gesture = null;
    this.mapBounds = rect(0, 0, 1, 1);
    this.drawerBounds = null;
    this.gestureHandler = {
      onTouchStart: this.onTouchStart.bind(this),
      onTouchMove: this.onTouchMove.bind(this),
      onTouchEnd: this.onTouchEnd.bind(this),
      onTouchCancel: () => { this.gesture = null; }
    };
  }

  enter() {
    this.draft = new DecorationDraft(this.gameState.getState(), this.ratingSystem);
    this.drawerOpen = false;
    this.detailOpen = false;
    this.expansionOpen = false;
    this.gesture = null;
    this.inputManager.setGestureHandler(this.gestureHandler);
    catalog.forEach((item) => {
      const visual = item.visual || {};
      if (visual.spriteKey && visual.spritePath && !this.assetManager.hasImage(visual.spriteKey)) {
        this.assetManager.loadImage(visual.spriteKey, visual.spritePath, () => this.requestRender());
      }
    });
    this.render();
  }

  leave() {
    this.inputManager.clearGestureHandler(this.gestureHandler);
    this.gesture = null;
    this.inputManager.clear();
  }

  requestRender() { this.render(); }
  point(touch) { return touch ? { x: touch.clientX, y: touch.clientY } : null; }

  touchPoints(event) {
    return Array.prototype.map.call(event.touches || [], (touch) => this.point(touch));
  }

  onTouchStart(event) {
    if (this.draft.confirm) return;
    const points = this.touchPoints(event);
    if (!points.length) return;
    const point = points[0];
    if (this.drawerOpen && this.drawerBounds && inside(point, this.drawerBounds)) {
      this.gesture = { type: 'drawer', start: point, last: point, moved: false, startScroll: this.catalogScroll };
      return;
    }
    if (!inside(point, this.mapBounds)) return;
    if (points.length >= 2) {
      this.gesture = { type: 'pinch', startDistance: distance(points[0], points[1]), startZoom: this.camera.zoom };
      return;
    }
    this.gesture = { type: 'map', start: point, last: point, moved: false };
  }

  onTouchMove(event) {
    if (!this.gesture || this.draft.confirm) return;
    const points = this.touchPoints(event);
    if (!points.length) return;
    if (points.length >= 2) {
      if (this.gesture.type !== 'pinch') this.gesture = { type: 'pinch', startDistance: distance(points[0], points[1]), startZoom: this.camera.zoom };
      const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      this.camera.setZoom(this.gesture.startZoom * distance(points[0], points[1]) / Math.max(1, this.gesture.startDistance), center.x, center.y);
      this.requestRender();
      return;
    }
    const point = points[0];
    if (this.gesture.type === 'drawer') {
      if (distance(point, this.gesture.start) > 6) this.gesture.moved = true;
      this.catalogScroll = Math.max(0, this.gesture.startScroll + this.gesture.start.y - point.y);
      this.requestRender();
      return;
    }
    if (this.gesture.type === 'map') {
      const dx = point.x - this.gesture.last.x;
      const dy = point.y - this.gesture.last.y;
      if (distance(point, this.gesture.start) > 8) this.gesture.moved = true;
      if (this.gesture.moved && this.draft.currentMode === 'browse') this.camera.panByScreen(dx, dy);
      this.gesture.last = point;
      this.requestRender();
    }
  }

  onTouchEnd(event) {
    if (!this.gesture) return false;
    const gesture = this.gesture;
    this.gesture = null;
    if (gesture.type === 'pinch') return true;
    if (gesture.type === 'drawer') return gesture.moved;
    if (gesture.type === 'map' && gesture.moved) return true;
    return false;
  }

  screenToGrid(point) {
    const world = this.camera.screenToWorld(point.x, point.y);
    const grid = this.camera.worldToGrid(world.x, world.y, this.cellSize);
    if (!this.gridMap.isInside(grid.gridX, grid.gridY, 1, 1)) return null;
    return grid;
  }

  findFurnitureAt(grid) {
    for (let i = this.draft.draftFurniture.length - 1; i >= 0; i -= 1) {
      const item = this.draft.draftFurniture[i];
      const config = this.catalogByType[item.type];
      if (!config) continue;
      const size = this.gridMap.getRotatedSize(config, item.rotation || 0);
      if (grid.gridX >= item.gridX && grid.gridX < item.gridX + size.width && grid.gridY >= item.gridY && grid.gridY < item.gridY + size.height) return item;
    }
    return null;
  }

  mapTap(point) {
    if (this.drawerOpen && this.drawerBounds && inside(point, this.drawerBounds)) return;
    if (this.drawerOpen) { this.drawerOpen = false; this.requestRender(); return; }
    const grid = this.screenToGrid(point);
    if (!grid) return;
    if (this.draft.currentMode === 'place' || this.draft.currentMode === 'move') this.draft.previewPosition = grid;
    else {
      const item = this.findFurnitureAt(grid);
      if (item) { this.draft.selectFurniture(item.id); this.detailOpen = true; }
      else { this.draft.selectedFurnitureId = null; this.detailOpen = false;
    this.expansionOpen = false; }
    }
    this.requestRender();
  }

  preview() {
    const grid = this.draft.previewPosition;
    if (!grid) return null;
    if (this.draft.currentMode === 'place' && this.draft.selectedCatalogType) return { id: 'preview', type: this.draft.selectedCatalogType, gridX: grid.gridX, gridY: grid.gridY, rotation: this.draft.previewRotation };
    if (this.draft.currentMode === 'move') {
      const selected = this.furnitureManager.find(this.draft.draftFurniture, this.draft.selectedFurnitureId);
      return selected ? Object.assign({}, selected, { gridX: grid.gridX, gridY: grid.gridY }) : null;
    }
    return null;
  }

  previewValidation(item) {
    if (!item) return { ok: true, reason: '' };
    return this.draft.currentMode === 'move' ? this.furnitureManager.validateMove(this.draft.draftFurniture, item) : this.furnitureManager.validateAdd(this.draft.draftFurniture, item);
  }

  confirmPlacement() {
    const item = this.preview();
    const validation = this.previewValidation(item);
    if (!item || !validation.ok) { this.draft.setToast(item ? validation.reason : '请先选择摆放位置'); this.requestRender(); return; }
    if (this.draft.currentMode === 'place') {
      const config = this.catalogByType[item.type];
      if (this.draft.draftCash < config.price) { this.draft.setToast('现金不足'); this.requestRender(); return; }
      const created = this.furnitureManager.create(item.type, item.gridX, item.gridY, item.rotation);
      this.draft.draftFurniture = this.furnitureManager.add(this.draft.draftFurniture, created);
      this.draft.draftCash -= config.price;
      this.draft.financeEntries.push({ direction: 'expense', category: 'furniture_purchase', amount: config.price, sourceSystem: 'decoration', sourceId: created.id, description: '购买' + config.name });
      this.draft.selectedFurnitureId = created.id;
      this.detailOpen = true;
    } else {
      this.draft.draftFurniture = this.furnitureManager.move(this.draft.draftFurniture, item.id, item.gridX, item.gridY);
    }
    this.draft.previewPosition = null;
    this.draft.currentMode = 'browse';
    this.draft.markDirty();
    this.requestRender();
  }

  rotateSelected() {
    const item = this.furnitureManager.find(this.draft.draftFurniture, this.draft.selectedFurnitureId);
    if (!item) return;
    const rotated = Object.assign({}, item, { rotation: (this.furnitureManager.normalizeRotation(item.rotation) + 90) % 360 });
    const validation = this.furnitureManager.validateMove(this.draft.draftFurniture, rotated);
    if (!validation.ok) this.draft.setToast(validation.reason);
    else { this.draft.draftFurniture = this.furnitureManager.rotate(this.draft.draftFurniture, item.id); this.draft.markDirty(); }
    this.requestRender();
  }

  sellSelected() {
    const item = this.furnitureManager.find(this.draft.draftFurniture, this.draft.selectedFurnitureId);
    if (!item) return;
    const config = this.catalogByType[item.type];
    const refund = Math.floor(config.price * config.refundRate);
    this.showConfirm('确认出售“' + config.name + '”并返还 ¥' + refund + '？', [
      { label: '取消', action: () => {} },
      { label: '确认出售', action: () => {
        this.draft.draftFurniture = this.furnitureManager.remove(this.draft.draftFurniture, item.id);
        this.draft.draftCash += refund;
        this.draft.financeEntries.push({ direction: 'income', category: 'asset_sale_refund', amount: refund, sourceSystem: 'decoration', sourceId: item.id, description: '出售' + config.name });
        this.draft.selectedFurnitureId = null;
        this.detailOpen = false;
    this.expansionOpen = false;
        this.draft.markDirty();
      } }
    ]);
  }

  savePlan(exitAfter) {
    const furniture = JSON.parse(JSON.stringify(this.draft.draftFurniture));
    const result = this.financeSystem.recordBatch(this.draft.financeEntries, (state) => { state.furniture = furniture; }, '装修方案已保存');
    if (!result.ok) { this.draft.setToast(result.message); this.requestRender(); return; }
    this.draft.resetFromState(this.gameState.getState());
    if (exitAfter) this.exitToMain();
    else { this.draft.setToast('装修方案已保存'); this.requestRender(); }
  }

  showConfirm(text, actions) { this.draft.confirm = { text, actions }; this.requestRender(); }

  requestExit() {
    if (!this.draft.dirty) { this.exitToMain(); return; }
    this.showConfirm('当前装修方案尚未保存。', [
      { label: '继续装修', action: () => {} },
      { label: '放弃修改', action: () => { this.draft.resetFromState(this.gameState.getState()); this.exitToMain(); } },
      { label: '保存并退出', action: () => this.savePlan(true), gold: true }
    ]);
  }

  exitToMain() { this.leave(); this.onExit(); }

  button(context, id, box, label, enabled, action, selected, gold) {
    const fill = !enabled ? '#263845' : (gold || selected ? '#b57a25' : '#102b3d');
    CanvasUtils.fillRoundedRect(context, box, 5, fill);
    CanvasUtils.strokeRoundedRect(context, box, 5, enabled && (gold || selected) ? '#f3cc67' : '#3a5362', 1);
    context.fillStyle = enabled ? '#f8f1db' : '#738591'; context.font = 'bold 11px sans-serif'; context.textAlign = 'center';
    context.fillText(label, box.x + box.width / 2, box.y + box.height / 2 + 4);
    if (enabled) this.inputManager.register(id, box, action);
  }

  drawTop(context, box) {
    context.fillStyle = '#0b1e2d'; context.fillRect(box.x, box.y, box.width, box.height);
    this.button(context, 'editor:back', rect(box.x + 6, box.y + 1, 48, Math.max(40, box.height - 2)), '← 返回', true, () => this.requestExit());
    context.fillStyle = '#f0c15b'; context.font = 'bold 15px sans-serif'; context.textAlign = 'left'; context.fillText('装修模式', box.x + 64, box.y + 27);
    const rating = this.draft.cachedRatings;
    const status = '现金 ¥' + this.draft.draftCash.toLocaleString() + '  |  综合 ' + rating.overall + '  |  容量 ' + rating.capacity;
    context.fillStyle = '#dce6e8'; context.font = '11px sans-serif'; context.fillText(status, box.x + Math.min(180, box.width * 0.25), box.y + 26);
    if (this.draft.dirty) { context.fillStyle = '#f0c15b'; context.fillText('● 未保存', box.x + box.width - 146, box.y + 26); }
    else { context.fillStyle = '#77909e'; context.fillText('已保存', box.x + box.width - 136, box.y + 26); }
    this.button(context, 'editor:save', rect(box.x + box.width - 72, box.y + 1, 66, Math.max(40, box.height - 2)), '保存', true, () => this.savePlan(false), false, true);
  }

  drawToolbar(context, box) {
    context.fillStyle = '#0b1e2d'; context.fillRect(box.x, box.y, box.width, box.height);
    const tools = [
      ['库', true, () => { this.drawerOpen = !this.drawerOpen; this.requestRender(); }, this.drawerOpen],
      ['移动', !!this.draft.selectedFurnitureId, () => { this.draft.currentMode = 'move'; this.draft.previewPosition = null; this.requestRender(); }, this.draft.currentMode === 'move'],
      ['旋转', !!this.draft.selectedFurnitureId, () => this.rotateSelected()],
      ['出售', !!this.draft.selectedFurnitureId, () => this.sellSelected()],
      ['取消', this.draft.currentMode !== 'browse', () => { this.draft.cancelOperation(); this.requestRender(); }],
      ['网格', true, () => { this.showGrid = !this.showGrid; this.requestRender(); }, this.showGrid],
      ['－', true, () => { this.camera.setZoom(this.camera.zoom - 0.15, this.mapBounds.x + this.mapBounds.width / 2, this.mapBounds.y + this.mapBounds.height / 2); this.requestRender(); }],
      ['＋', true, () => { this.camera.setZoom(this.camera.zoom + 0.15, this.mapBounds.x + this.mapBounds.width / 2, this.mapBounds.y + this.mapBounds.height / 2); this.requestRender(); }],
      ['复位', true, () => { this.camera.resetView(10); this.requestRender(); }]
    ];
    const actionW = 84;
    const available = box.width - actionW * 2 - 12;
    const toolW = Math.max(40, Math.min(58, available / tools.length));
    tools.forEach((tool, index) => this.button(context, 'editor:tool:' + index, rect(box.x + 6 + index * toolW, box.y + 4, toolW - 4, box.height - 8), tool[0], tool[1], tool[2], tool[3]));
    const preview = !!this.preview();
    this.button(context, 'editor:cancel', rect(box.x + box.width - actionW * 2 - 8, box.y + 4, actionW - 5, box.height - 8), '取消操作', this.draft.currentMode !== 'browse', () => { this.draft.cancelOperation(); this.requestRender(); });
    this.button(context, 'editor:confirm', rect(box.x + box.width - actionW - 4, box.y + 4, actionW, box.height - 8), '确认放置', preview, () => this.confirmPlacement(), false, true);
  }

  drawDrawer(context, view) {
    if (!this.drawerOpen) { this.drawerBounds = null; return; }
    const width = Math.max(210, Math.min(view.width * 0.3, 270));
    const box = rect(view.x + 8, view.y + 8, width, view.height - 16);
    this.drawerBounds = box;
    CanvasUtils.fillRoundedRect(context, box, 7, '#0d2232'); CanvasUtils.strokeRoundedRect(context, box, 7, '#d3a845', 1);
    context.fillStyle = '#f3d47d'; context.font = 'bold 13px sans-serif'; context.textAlign = 'left'; context.fillText('家具库', box.x + 12, box.y + 22);
    this.button(context, 'drawer:close', rect(box.x + box.width - 46, box.y + 2, 40, 40), '×', true, () => { this.drawerOpen = false; this.requestRender(); });
    const categories = ['全部', '电脑', '功能', '休息', '装饰'];
    const tabW = (box.width - 16) / categories.length;
    categories.forEach((name, index) => this.button(context, 'drawer:cat:' + name, rect(box.x + 8 + index * tabW, box.y + 43, tabW - 3, 40), name, true, () => { this.category = name; this.catalogScroll = 0; this.requestRender(); }, this.category === name));
    const items = this.category === '全部' ? catalog : catalog.filter((item) => item.category === this.category);
    const listTop = box.y + 90;
    const cardH = 62;
    const contentH = items.length * (cardH + 6);
    const visibleH = box.y + box.height - listTop - 8;
    this.catalogScroll = Math.min(this.catalogScroll, Math.max(0, contentH - visibleH));
    context.save(); context.beginPath(); context.rect(box.x + 5, listTop, box.width - 10, visibleH); context.clip();
    items.forEach((item, index) => {
      const card = rect(box.x + 8, listTop + index * (cardH + 6) - this.catalogScroll, box.width - 16, cardH);
      if (card.y + card.height < listTop || card.y > listTop + visibleH) return;
      CanvasUtils.fillRoundedRect(context, card, 5, '#132c3e'); CanvasUtils.strokeRoundedRect(context, card, 5, '#365265', 1);
      context.fillStyle = (item.visual && item.visual.fallbackStyle.body) || item.renderStyle.body; context.fillRect(card.x + 8, card.y + 14, 36, 28);
      context.fillStyle = '#f4f0df'; context.font = 'bold 11px sans-serif'; context.textAlign = 'left'; context.fillText(item.name, card.x + 52, card.y + 18);
      context.fillStyle = '#90a6b3'; context.font = '10px sans-serif'; context.fillText('¥' + item.price + '  ·  ' + item.width + '×' + item.height + '格', card.x + 52, card.y + 36);
      const bonus = Object.keys(item.ratingBonus).find((key) => item.ratingBonus[key] > 0);
      context.fillStyle = '#d8b65b'; context.fillText(bonus ? bonus + ' +' + item.ratingBonus[bonus] : '装饰家具', card.x + 52, card.y + 52);
      this.inputManager.register('drawer:item:' + item.type, card, () => { this.draft.selectCatalog(item.type); this.drawerOpen = false; this.detailOpen = true; this.requestRender(); });
    });
    context.restore();
  }

  drawDetails(context, view) {
    if (!this.detailOpen) return;
    const selected = this.furnitureManager.find(this.draft.draftFurniture, this.draft.selectedFurnitureId);
    const config = selected ? this.catalogByType[selected.type] : this.catalogByType[this.draft.selectedCatalogType];
    if (!config) { this.detailOpen = false;
    this.expansionOpen = false; return; }
    const width = Math.max(184, Math.min(view.width * 0.25, 230));
    const box = rect(view.x + view.width - width - 8, view.y + 8, width, Math.min(view.height - 16, 270));
    CanvasUtils.fillRoundedRect(context, box, 7, '#0d2232'); CanvasUtils.strokeRoundedRect(context, box, 7, '#486273', 1);
    context.fillStyle = '#f3d47d'; context.font = 'bold 13px sans-serif'; context.textAlign = 'left'; context.fillText(config.name, box.x + 12, box.y + 22);
    this.button(context, 'detail:close', rect(box.x + box.width - 46, box.y + 2, 40, 40), '×', true, () => { this.detailOpen = false;
    this.expansionOpen = false; this.requestRender(); });
    const refund = Math.floor(config.price * config.refundRate);
    const rating = this.draft.cachedRatings;
    const rows = [
      ['价格 / 退款', '¥' + config.price + ' / ¥' + refund], ['占地', config.width + '×' + config.height], ['当前现金', '¥' + this.draft.draftCash.toLocaleString()],
      ['环境 / 设备', rating.environment + ' / ' + rating.equipment], ['服务 / 卫生', rating.service + ' / ' + rating.hygiene],
      ['舒适 / 综合', rating.comfort + ' / ' + rating.overall], ['容量', String(rating.capacity)]
    ];
    rows.forEach((row, index) => {
      const y = box.y + 54 + index * 27;
      context.fillStyle = '#89a0ae'; context.font = '10px sans-serif'; context.textAlign = 'left'; context.fillText(row[0], box.x + 12, y);
      context.fillStyle = index >= 5 ? '#f0c15b' : '#eef2e8'; context.textAlign = 'right'; context.fillText(row[1], box.x + box.width - 12, y);
    });
  }


  drawExpansion(context, view) {
    const expanded = this.expansionOpen;
    const metrics = this.expansionSystem.getMetrics();
    const width = expanded ? Math.max(210, Math.min(view.width * 0.35, 280)) : 116;
    const height = expanded ? 196 : 32;
    const box = rect(view.x + view.width - width - 8, view.y + view.height - 106, width, height);
    CanvasUtils.fillRoundedRect(context, box, 7, '#0d2232');
    CanvasUtils.strokeRoundedRect(context, box, 7, '#d3a845', 1);
    context.fillStyle = '#f3d47d'; context.font = 'bold 12px sans-serif'; context.textAlign = 'left';
    context.fillText('空间扩建', box.x + 10, box.y + 20);
    const toggleLabel = expanded ? '收起' : '展开';
    this.button(context, 'expansion:toggle', rect(box.x + box.width - 46, box.y + 2, 40, 26), toggleLabel, true, () => {
      this.expansionOpen = !this.expansionOpen;
      this.requestRender();
    });
    if (!expanded) return;
    const rows = [
      ['当前面积', metrics.currentArea.toLocaleString() + '㎡'],
      ['扩建等级', 'Lv' + metrics.level],
      ['下次增加', '+' + (metrics.nextArea - metrics.currentArea).toLocaleString() + '㎡'],
      ['扩建费用', FinanceSystem.formatMoney(metrics.cost)]
    ];
    rows.forEach((row, index) => {
      const y = box.y + 42 + index * 27;
      context.fillStyle = '#89a0ae'; context.font = '11px sans-serif'; context.textAlign = 'left';
      context.fillText(row[0], box.x + 12, y);
      context.fillStyle = '#eef2e8'; context.textAlign = 'right';
      context.fillText(row[1], box.x + box.width - 12, y);
    });
    const canExpand = this.expansionSystem.canExpand();
    this.button(context, 'expansion:expand', rect(box.x + 16, box.y + height - 38, box.width - 32, 30),
      canExpand ? '立即扩建' : '资金不足',
      true, () => {
        if (!canExpand) return;
        const result = this.expansionSystem.expand();
        if (result.ok) {
          this.draft = new DecorationDraft(this.gameState.getState(), this.ratingSystem);
          this.saveManager.save(this.gameState.getState());
          this.expansionOpen = false;
          this.showToast('网吧面积扩大成功！面积: ' + result.afterArea.toLocaleString() + '㎡');
        }
        this.requestRender();
      }, false, canExpand);
    if (!canExpand) {
      context.fillStyle = '#d93b3b'; context.font = '9px sans-serif'; context.textAlign = 'center';
      context.fillText('现金不足，无法扩建', box.x + box.width / 2, box.y + height - 8);
    }
  }

  showToast(message) {
    this.toastMessage = message;
    this.toastTimer = Date.now();
  }

  drawConfirm(context, full) {
    const confirm = this.draft.confirm;
    if (!confirm) return;
    context.fillStyle = 'rgba(0,0,0,0.62)'; context.fillRect(full.x, full.y, full.width, full.height);
    this.inputManager.register('confirm:blocker', full, () => {});
    const width = Math.min(480, full.width - 40);
    const box = rect(full.x + (full.width - width) / 2, full.y + (full.height - 140) / 2, width, 140);
    CanvasUtils.fillRoundedRect(context, box, 8, '#102638'); CanvasUtils.strokeRoundedRect(context, box, 8, '#f0c15b', 1);
    context.fillStyle = '#f4f0df'; context.font = '13px sans-serif'; context.textAlign = 'center'; context.fillText(confirm.text, box.x + box.width / 2, box.y + 40);
    const count = confirm.actions.length;
    const gap = 8;
    const bw = Math.min(130, (box.width - 32 - gap * (count - 1)) / count);
    const startX = box.x + (box.width - (bw * count + gap * (count - 1))) / 2;
    confirm.actions.forEach((item, index) => this.button(context, 'confirm:' + index, rect(startX + index * (bw + gap), box.y + 78, bw, 42), item.label, true, () => {
      this.draft.confirm = null;
      item.action();
      if (this.inputManager.gestureHandler === this.gestureHandler) this.requestRender();
    }, false, item.gold));
  }

  render() {
    const context = this.context;
    const viewport = this.viewport;
    const full = rect(0, 0, viewport.width, viewport.height);
    const safe = rect(viewport.safeLeft, viewport.safeTop, viewport.width - viewport.safeLeft - viewport.safeRight, viewport.height - viewport.safeTop - viewport.safeBottom);
    const topH = 42;
    const bottomH = 48;
    this.mapBounds = rect(safe.x, safe.y + topH, safe.width, safe.height - topH - bottomH);
    const firstLayout = this.camera.viewportRect.width <= 1;
    this.camera.setViewport(this.mapBounds);
    if (firstLayout) this.camera.fitToView(10);
    this.inputManager.clear();
    context.clearRect(0, 0, viewport.width, viewport.height);
    context.fillStyle = '#071522'; context.fillRect(0, 0, viewport.width, viewport.height);
    this.renderer.drawViewport(context, this.camera, this.draft.draftFurniture, { cellSize: this.cellSize, showGrid: this.showGrid, selectedId: this.draft.selectedFurnitureId, preview: this.preview(), previewValid: this.previewValidation(this.preview()).ok });
    this.inputManager.register('editor:map', this.mapBounds, (point) => this.mapTap(point));
    this.drawTop(context, rect(safe.x, safe.y, safe.width, topH));
    this.drawToolbar(context, rect(safe.x, safe.y + safe.height - bottomH, safe.width, bottomH));
    this.drawDrawer(context, this.mapBounds);
    this.drawDetails(context, this.mapBounds);
    const draftToast = this.draft.getToast();
    const toast = this.toastMessage ? (Date.now() - this.toastTimer < 2500 ? this.toastMessage : null) : draftToast;
    if (!toast && this.toastMessage && Date.now() - this.toastTimer >= 2500) this.toastMessage = null;
    if (toast) { const box = rect(safe.x + safe.width / 2 - 130, safe.y + safe.height - bottomH - 42, 260, 32); CanvasUtils.fillRoundedRect(context, box, 6, 'rgba(5,15,22,0.9)'); context.fillStyle = '#fff3cf'; context.font = '11px sans-serif'; context.textAlign = 'center'; context.fillText(toast, box.x + box.width / 2, box.y + 21); }
    this.drawExpansion(context, this.mapBounds);
    this.drawConfirm(context, full);
  }
}

module.exports = DecorationEditorScene;
