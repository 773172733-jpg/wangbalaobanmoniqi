'use strict';

const CanvasUtils = require('../ui/CanvasUtils');
const DeviceSystem = require('../systems/DeviceSystem');
const equipmentCatalog = require('../data/equipmentCatalog');
const ExpansionSystem = require('../systems/ExpansionSystem');

function rect(x, y, width, height) { return { x: x, y: y, width: width, height: height }; }
function inside(point, box) { return point && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height; }
function distance(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

class DeviceScene {
  constructor(dependencies) {
    const deps = dependencies || {};
    this.title = '设备管理';
    this.inputManager = deps.inputManager;
    this.assetManager = deps.assetManager || null;
    this.requestRender = deps.requestRender || function () {};
    this.deviceSystem = new DeviceSystem(deps.gameState, deps.saveManager);
    this.expansionSystem = new ExpansionSystem(deps.gameState, deps.saveManager);
    this.selectedCategory = 'computer';
    this.selectedType = 'basic_pc';
    this.listScroll = 0;
    this.listBounds = rect(0, 0, 1, 1);
    this.gesture = null;
    this.toast = '';
    this.cachedState = null;
    this.cachedSummary = null;
    this.gestureHandler = {
      onTouchStart: this.onTouchStart.bind(this),
      onTouchMove: this.onTouchMove.bind(this),
      onTouchEnd: this.onTouchEnd.bind(this),
      onTouchCancel: () => { this.gesture = null; }
    };
  }

  enter() {
    this.gesture = null;
    this.placementMode = false;
    this.placementType = null;
    this.placementGridCell = null;
    if (!this.worldGrid) {
      this.worldGrid = new WorldGridSystem(this.expansionSystem, 40);
      this.gridMap = new GridMap(this.worldGrid.columns, this.worldGrid.rows);
      this.renderer = new DecorationRenderer(this.assetManager, this.gridMap);
      const ws = this.worldGrid.getWorldSize();
      this.camera = new Camera2D({ worldWidth: ws.width, worldHeight: ws.height });
    }
    equipmentCatalog.items.forEach((item) => {
      const visual = item.visual || {};
      if (this.assetManager && visual.spriteKey && visual.spritePath && !this.assetManager.hasImage(visual.spriteKey)) {
        this.assetManager.loadImage(visual.spriteKey, visual.spritePath, () => this.requestRender());
      }
      (visual.variants || []).forEach((variant) => {
        if (this.assetManager && variant.spriteKey && variant.spritePath && !this.assetManager.hasImage(variant.spriteKey)) {
          this.assetManager.loadImage(variant.spriteKey, variant.spritePath, () => this.requestRender());
        }
      });
    });
    this.inputManager.setGestureHandler(this.gestureHandler);
  }

  leave() {
    this.inputManager.clearGestureHandler(this.gestureHandler);
    this.gesture = null;
  }

  point(touch) { return touch ? { x: touch.clientX, y: touch.clientY } : null; }

  onTouchStart(event) {
    if (this.placementMode) {
      if (!event.touches || event.touches.length !== 1) return;
      const pt = this.point(event.touches[0]);
      if (pt && this.placementMapBounds && inside(pt, this.placementMapBounds)) {
        this.updatePlacementCell(pt);
        this.requestRender();
      }
      return;
    }
    if (!event.touches || event.touches.length !== 1) return;
    const point = this.point(event.touches[0]);
    if (inside(point, this.listBounds)) this.gesture = { start: point, startScroll: this.listScroll, moved: false };
  }

  onTouchMove(event) {
    if (!this.gesture || !event.touches || event.touches.length !== 1) return;
    const point = this.point(event.touches[0]);
    if (!point) return;
    if (distance(point, this.gesture.start) > 8) this.gesture.moved = true;
    if (this.gesture.moved) {
      this.listScroll = Math.max(0, this.gesture.startScroll + this.gesture.start.y - point.y);
      this.requestRender();
    }
  }

  onTouchEnd() {
    if (!this.gesture) return false;
    const moved = this.gesture.moved;
    this.gesture = null;
    return moved;
  }

  getSummary(state) {
    if (this.cachedState !== state) {
      this.cachedState = state;
      this.cachedSummary = this.deviceSystem.getSummary(state);
    }
    return this.cachedSummary;
  }

  button(context, id, box, label, enabled, action, selected, gold) {
    const fill = !enabled ? '#263845' : (gold || selected ? '#a97022' : '#153247');
    CanvasUtils.fillRoundedRect(context, box, 4, fill);
    CanvasUtils.strokeRoundedRect(context, box, 4, enabled && (gold || selected) ? '#efc45c' : '#3a5362', 1);
    context.fillStyle = enabled ? '#f5f0df' : '#728591'; context.font = 'bold 10px sans-serif'; context.textAlign = 'center';
    context.fillText(label, box.x + box.width / 2, box.y + box.height / 2 + 3);
    if (enabled) this.inputManager.register(id, box, action);
  }

  perform(action) {
    if (action === 'purchase') {
      const config = equipmentCatalog.byType[this.selectedType];
      if (config && config.requiresComputerSlot) {
        const state = this.gameState.getState();
        const price = config.purchasePrice;
        if (state.player.cash < price) {
          this.toast = '资金不足！需要\xA5' + price.toLocaleString();
          this.requestRender();
          return;
        }
        this.placementMode = true;
        this.placementType = this.selectedType;
        this.placementGridCell = null;
        this.placementCell = null;
        this.placementValid = false;
        this.toast = '请在地图上点击选择电脑放置位置';
        this.requestRender();
        return;
      }
    }
    const result = this.deviceSystem[action](this.selectedType);
    this.toast = result.message;
    this.cachedState = null;
    this.requestRender();
  }

  drawSummary(context, box, summary) {
    const items = [
      ['电脑位', summary.computerSlots], ['已安装', summary.installedComputers], ['空闲位', summary.freeComputerSlots],
      ['设备评分', summary.equipmentScore], ['平均状态', summary.averageCondition + '%'], ['预计电费', '¥' + summary.dailyElectricity + '/日']
    ];
    const gap = 5;
    const width = (box.width - gap * (items.length - 1)) / items.length;
    items.forEach((item, index) => {
      const card = rect(box.x + index * (width + gap), box.y, width, box.height);
      CanvasUtils.fillRoundedRect(context, card, 5, '#10293b'); CanvasUtils.strokeRoundedRect(context, card, 5, '#315063', 1);
      context.fillStyle = '#8198a7'; context.font = '9px sans-serif'; context.textAlign = 'left'; context.fillText(item[0], card.x + 8, card.y + 16);
      context.fillStyle = index === 2 ? '#66bf78' : (index === 5 ? '#e9ba52' : '#f3efe1'); context.font = 'bold 13px sans-serif';
      context.fillText(String(item[1]), card.x + 8, card.y + 36);
    });
  }

  drawCategories(context, box) {
    CanvasUtils.fillRoundedRect(context, box, 5, '#0d2232'); CanvasUtils.strokeRoundedRect(context, box, 5, '#314958', 1);
    context.fillStyle = '#8198a7'; context.font = '9px sans-serif'; context.textAlign = 'center'; context.fillText('分类', box.x + box.width / 2, box.y + 17);
    const top = box.y + 25;
    const height = Math.max(42, Math.min(50, (box.height - 29) / equipmentCatalog.categories.length));
    equipmentCatalog.categories.forEach((category, index) => {
      const hit = rect(box.x + 4, top + index * height, box.width - 8, Math.max(40, height - 4));
      this.button(context, 'device:category:' + category.id, hit, category.label, true, () => {
        this.selectedCategory = category.id;
        const first = equipmentCatalog.items.find((item) => item.category === category.id);
        if (first) this.selectedType = first.type;
        this.listScroll = 0;
        this.toast = '';
        this.requestRender();
      }, this.selectedCategory === category.id);
    });
  }

  drawDeviceIcon(context, box, config) {
    const visual = config.visual || {};
    const image = visual.spriteKey && this.assetManager ? this.assetManager.getImage(visual.spriteKey) : null;
    CanvasUtils.fillRoundedRect(context, box, 4, visual.color || '#4f5a61');
    if (image && image.width && image.height) {
      const padding = 3;
      const scale = Math.min((box.width - padding * 2) / image.width, (box.height - padding * 2) / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      context.save();
      context.imageSmoothingEnabled = false;
      context.drawImage(image, Math.round(box.x + (box.width - width) / 2), Math.round(box.y + (box.height - height) / 2), width, height);
      context.restore();
      return;
    }
    context.fillStyle = visual.accent || '#72c5e8';
    context.font = 'bold 9px sans-serif';
    context.textAlign = 'center';
    context.fillText(visual.icon || '', box.x + box.width / 2, box.y + box.height / 2 + 3);
  }

  drawList(context, box, state) {
    this.listBounds = box;
    CanvasUtils.fillRoundedRect(context, box, 5, '#0b2030'); CanvasUtils.strokeRoundedRect(context, box, 5, '#314958', 1);
    const items = equipmentCatalog.items.filter((item) => item.category === this.selectedCategory);
    const padding = 7;
    const cardHeight = 66;
    const contentHeight = items.length * (cardHeight + 6);
    this.listScroll = Math.min(this.listScroll, Math.max(0, contentHeight - box.height + padding * 2));
    context.save(); context.beginPath(); context.rect(box.x + 1, box.y + 1, box.width - 2, box.height - 2); context.clip();
    items.forEach((config, index) => {
      const card = rect(box.x + padding, box.y + padding + index * (cardHeight + 6) - this.listScroll, box.width - padding * 2, cardHeight);
      if (card.y + card.height < box.y || card.y > box.y + box.height) return;
      const selected = config.type === this.selectedType;
      CanvasUtils.fillRoundedRect(context, card, 5, selected ? '#183b50' : '#122c3d');
      CanvasUtils.strokeRoundedRect(context, card, 5, selected ? '#d8a947' : '#355063', 1);
      this.drawDeviceIcon(context, rect(card.x + 7, card.y + 9, 42, 42), config);
      const record = this.deviceSystem.getRecord(state.devices, config.type);
      context.textAlign = 'left'; context.fillStyle = '#f4f0df'; context.font = 'bold 11px sans-serif'; context.fillText(config.name, card.x + 58, card.y + 18);
      context.fillStyle = '#90a5b1'; context.font = '9px sans-serif'; context.fillText('数量 ' + record.owned + ' · 生效 ' + record.installed + ' · Lv.' + record.level, card.x + 58, card.y + 35);
      const property = config.requiresComputerSlot ? '性能 ' + Math.round(config.performance * (1 + (record.level - 1) * 0.15)) : '容量/加成 ' + config.capacity;
      context.fillStyle = '#66b8db'; context.fillText(property, card.x + 58, card.y + 52);
      context.fillStyle = '#e5b84e'; context.font = 'bold 10px sans-serif'; context.textAlign = 'right'; context.fillText('¥' + config.purchasePrice.toLocaleString(), card.x + card.width - 9, card.y + 20);
      context.fillStyle = '#6fc27c'; context.font = '9px sans-serif'; context.fillText('状态 ' + record.condition + '%', card.x + card.width - 9, card.y + 48);
      const hitY = Math.max(card.y, box.y);
      const hitBottom = Math.min(card.y + card.height, box.y + box.height);
      if (hitBottom - hitY >= 20) this.inputManager.register('device:item:' + config.type, rect(card.x, hitY, card.width, hitBottom - hitY), () => { this.selectedType = config.type; this.toast = ''; this.requestRender(); });
    });
    context.restore();
  }

  drawDetails(context, box, state, summary) {
    const config = equipmentCatalog.byType[this.selectedType] || equipmentCatalog.items[0];
    const record = this.deviceSystem.getRecord(state.devices, config.type);
    CanvasUtils.fillRoundedRect(context, box, 5, '#0d2232'); CanvasUtils.strokeRoundedRect(context, box, 5, '#5d5034', 1);
    context.fillStyle = '#efc35d'; context.font = 'bold 13px sans-serif'; context.textAlign = 'left'; context.fillText(config.name, box.x + 10, box.y + 19);
    const category = equipmentCatalog.categories.find((item) => item.id === config.category);
    const levelFactor = 1 + (record.level - 1) * 0.15;
    const rows = [
      ['分类 / 单价', category.label + ' / ¥' + config.purchasePrice.toLocaleString()], ['数量 / 生效', record.owned + ' / ' + record.installed],
      ['等级 / 状态', 'Lv.' + record.level + ' / ' + record.condition + '%'], ['性能 / 评分', Math.round(config.performance * levelFactor) + ' / ' + Math.round(config.score * levelFactor)],
      ['功耗 / 维护', config.powerUsage + ' / ¥' + config.dailyMaintenance + '日'], ['支持容量', String(config.capacity)]
    ];
    const compactDetails = box.height < 235;
    const visibleRows = compactDetails ? rows.slice(0, 4) : rows;
    visibleRows.forEach((row, index) => {
      const y = box.y + 39 + index * (compactDetails ? 17 : 19);
      context.fillStyle = '#849ba8'; context.font = '9px sans-serif'; context.textAlign = 'left'; context.fillText(row[0], box.x + 10, y);
      context.fillStyle = '#edf0e5'; context.textAlign = 'right'; context.fillText(row[1], box.x + box.width - 10, y);
    });
    if (!compactDetails) {
      context.fillStyle = '#78909d'; context.font = '8px sans-serif'; context.textAlign = 'left';
      const description = config.description.length > 19 ? config.description.slice(0, 19) + '…' : config.description;
      context.fillText(description, box.x + 10, box.y + 145);
    }

    const gap = 5;
    const buttonW = (box.width - 30) / 3;
    const buttonH = 40;
    const actionY = box.y + box.height - buttonH * 2 - gap - 7;
    const upgradeCost = config.upgradeBasePrice * record.level;
    const actions = [
      ['购买1台', true, 'purchase', true],
      ['售出1台', record.owned > 0, 'sell'],
      ['升级 ¥' + upgradeCost.toLocaleString(), record.owned > 0 && record.level < config.maxLevel, 'upgrade'],
      ['维修', record.condition < 100, 'repair']
    ];
    actions.forEach((action, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const buttonBox = rect(box.x + 8 + column * (buttonW + gap), actionY + row * (buttonH + gap), buttonW, buttonH);
      this.button(context, 'device:action:' + action[2], buttonBox, action[0], action[1], () => this.perform(action[2]), false, action[3]);
    });
    if (this.toast) {
      const warning = this.toast.indexOf('不足') >= 0 || this.toast.indexOf('没有') >= 0 || this.toast.indexOf('最高') >= 0;
      context.fillStyle = warning ? '#e68a56' : '#72c984'; context.font = '8px sans-serif'; context.textAlign = 'left';
      const message = this.toast.length > 25 ? this.toast.slice(0, 25) + '…' : this.toast;
      context.fillText(message, box.x + 10, actionY - 7);
    }
  }

  confirmPlacement() {
    if (!this.placementGridCell) return;
    const state = this.gameState.getState();
    const config = equipmentCatalog.byType[this.placementType];
    if (!config) return;
    const gx = this.placementGridCell.gridX;
    const gy = this.placementGridCell.gridY;
    const deskType = this.placementType === 'gaming_pc' || this.placementType === 'premium_pc' ? 'double_gaming_desk' : 'standard_pc_desk';
    const deskConfig = this.deviceSystem.furnitureByType[deskType];
    if (!deskConfig || !this.gridMap.isInside(gx, gy, deskConfig.width, deskConfig.height)) {
      this.toast = '位置无效';
      this.requestRender();
      return;
    }
    if (!this.deviceSystem.isFurnitureAreaFree(state.furniture, deskType, gx, gy)) {
      this.toast = '该位置已被占用';
      this.requestRender();
      return;
    }
    const price = config.purchasePrice;
    if (state.player.cash < price) {
      this.toast = '资金不足';
      this.requestRender();
      return;
    }
    state.player.cash -= price;
    state.devices = this.deviceSystem.sanitizeDevices(state.devices, state.furniture).devices;
    state.devices[this.placementType].owned += 1;
    state.devices[this.placementType].installed += 1;
    this.deviceSystem.createComputerDeskAt(state, this.placementType, gx, gy);
    this.toast = '已购买并放置于(' + (gx+1) + ',' + (gy+1) + ')';
    this.placementMode = false;
    this.placementType = null;
    this.placementGridCell = null;
    this.cachedState = null;
    this.cachedSummary = null;
    this.saveManager.save(state);
    this.requestRender();
  }

  cancelPlacement() {
    this.placementMode = false;
    this.placementType = null;
    this.placementGridCell = null;
    this.toast = '已取消放置';
    this.requestRender();
  }

  updatePlacementCell(point) {
    const g = this.gridMap.getGridFromPoint(this.placementMapBounds, point.x, point.y);
    if (!g) { this.placementGridCell = null; this.placementValid = false; return; }
    this.placementGridCell = g;
    const deskType = this.placementType === 'gaming_pc' || this.placementType === 'premium_pc' ? 'double_gaming_desk' : 'standard_pc_desk';
    const deskConfig = this.deviceSystem.furnitureByType[deskType];
    const state = this.gameState.getState();
    if (deskConfig) {
      this.placementValid = this.gridMap.isInside(g.gridX, g.gridY, deskConfig.width, deskConfig.height) &&
        this.deviceSystem.isFurnitureAreaFree(state.furniture, deskType, g.gridX, g.gridY);
    } else {
      this.placementValid = false;
    }
  }

  drawPlacementOverlay(context, full) {
    const state = this.gameState.getState();
    const mapW = Math.min(full.width - 40, 480);
    const mapH = Math.min(full.height - 180, mapW * 0.65);
    const mapX = full.x + (full.width - mapW) / 2;
    const mapY = full.y + 65;
    this.placementMapBounds = { x: mapX, y: mapY, width: mapW, height: mapH };

    context.fillStyle = 'rgba(0,0,0,0.72)';
    context.fillRect(full.x, full.y, full.width, full.height);

    const config = equipmentCatalog.byType[this.placementType];
    context.fillStyle = '#f3d47d';
    context.font = 'bold 14px sans-serif';
    context.textAlign = 'center';
    context.fillText('放置' + (config ? config.name : '电脑') + ' - 点击地图选择位置', full.x + full.width / 2, full.y + 38);

    CanvasUtils.fillRoundedRect(context, this.placementMapBounds, 6, '#172a31');

    const inner = this.gridMap.getInnerBounds(this.placementMapBounds);
    context.save();
    context.beginPath();
    context.rect(inner.x, inner.y, inner.width, inner.height);
    context.clip();
    context.fillStyle = '#2a1f15';
    context.fillRect(inner.x, inner.y, inner.width, inner.height);

    // Draw existing furniture as occupied
    const furniture = Array.isArray(state.furniture) ? state.furniture : [];
    furniture.forEach(item => {
      const catConfig = this.deviceSystem.furnitureByType[item.type];
      if (!catConfig) return;
      const cellRect = this.gridMap.getCellRect(this.placementMapBounds, item.gridX, item.gridY, catConfig.width, catConfig.height);
      context.fillStyle = 'rgba(120,90,60,0.45)';
      context.fillRect(cellRect.x + 1, cellRect.y + 1, cellRect.width - 2, cellRect.height - 2);
    });

    // Grid lines
    context.strokeStyle = 'rgba(224,186,117,0.15)';
    context.lineWidth = 1;
    for (let x = 0; x <= this.gridMap.columns; x++) {
      const px = inner.x + x * inner.cell;
      context.beginPath(); context.moveTo(px, inner.y); context.lineTo(px, inner.y + inner.height); context.stroke();
    }
    for (let y = 0; y <= this.gridMap.rows; y++) {
      const py = inner.y + y * inner.cell;
      context.beginPath(); context.moveTo(inner.x, py); context.lineTo(inner.x + inner.width, py); context.stroke();
    }

    // Placement preview
    if (this.placementGridCell) {
      const deskType = this.placementType === 'gaming_pc' || this.placementType === 'premium_pc' ? 'double_gaming_desk' : 'standard_pc_desk';
      const deskConfig = this.deviceSystem.furnitureByType[deskType];
      if (deskConfig) {
        const previewRect = this.gridMap.getCellRect(this.placementMapBounds, this.placementGridCell.gridX, this.placementGridCell.gridY, deskConfig.width, deskConfig.height);
        context.fillStyle = this.placementValid ? 'rgba(105,196,123,0.35)' : 'rgba(221,93,82,0.35)';
        context.fillRect(previewRect.x + 1, previewRect.y + 1, previewRect.width - 2, previewRect.height - 2);
        context.strokeStyle = this.placementValid ? '#69c47b' : '#dd5d52';
        context.lineWidth = 2;
        context.strokeRect(previewRect.x, previewRect.y, previewRect.width, previewRect.height);
      }
    }
    context.restore();

    CanvasUtils.strokeRoundedRect(context, this.placementMapBounds, 6, '#8d682e', 2);

    // Buttons
    const btnY = this.placementMapBounds.y + this.placementMapBounds.height + 12;
    const btnW = 120;
    const btnH = 42;
    const centerX = this.placementMapBounds.x + this.placementMapBounds.width / 2;

    const confirmBox = { x: centerX - btnW - 10, y: btnY, width: btnW, height: btnH };
    const canConfirm = this.placementGridCell && this.placementValid;
    CanvasUtils.fillRoundedRect(context, confirmBox, 6, canConfirm ? '#2d6a3f' : '#263845');
    CanvasUtils.strokeRoundedRect(context, confirmBox, 6, canConfirm ? '#69c47b' : '#3a5362', 1);
    context.fillStyle = canConfirm ? '#f5f0df' : '#728591';
    context.font = 'bold 12px sans-serif';
    context.textAlign = 'center';
    context.fillText('确认放置', confirmBox.x + confirmBox.width / 2, confirmBox.y + confirmBox.height / 2 + 4);
    if (canConfirm) this.inputManager.register('placement:confirm', confirmBox, () => this.confirmPlacement());

    const cancelBox = { x: centerX + 10, y: btnY, width: btnW, height: btnH };
    CanvasUtils.fillRoundedRect(context, cancelBox, 6, '#4a2632');
    CanvasUtils.strokeRoundedRect(context, cancelBox, 6, '#cf6858', 1);
    context.fillStyle = '#f5f0df';
    context.font = 'bold 12px sans-serif';
    context.fillText('取消', cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2 + 4);
    this.inputManager.register('placement:cancel', cancelBox, () => this.cancelPlacement());

    context.fillStyle = '#f0c15b';
    context.font = '10px sans-serif';
    context.textAlign = 'center';
    context.fillText(this.toast, centerX, btnY - 10);
  }

  render(context, bounds, state) {
    this.inputManager.clear();
    if (this.placementMode) {
      this.drawPlacementOverlay(context, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
      return;
    }
    const padding = 7;
    const summaryHeight = 48;
    const summary = this.getSummary(state);
    const expansionArea = this.expansionSystem.getCurrentArea();
    context.fillStyle = '#081824'; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.drawSummary(context, rect(bounds.x + padding, bounds.y + padding, bounds.width - padding * 2, summaryHeight), summary);
    const contentY = bounds.y + padding * 2 + summaryHeight;
    const contentHeight = Math.max(1, bounds.y + bounds.height - contentY - padding);
    const categoryWidth = Math.max(64, Math.min(76, bounds.width * 0.1));
    const detailWidth = Math.max(205, Math.min(232, bounds.width * 0.29));
    const listX = bounds.x + padding + categoryWidth + padding;
    const listWidth = Math.max(140, bounds.width - padding * 4 - categoryWidth - detailWidth);
    this.drawCategories(context, rect(bounds.x + padding, contentY, categoryWidth, contentHeight));
    this.drawList(context, rect(listX, contentY, listWidth, contentHeight), state);
    this.drawDetails(context, rect(listX + listWidth + padding, contentY, detailWidth, contentHeight), state, summary);
  }
}

module.exports = DeviceScene;
