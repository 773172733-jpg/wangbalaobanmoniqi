'use strict';

const CanvasUtils = require('../ui/CanvasUtils');
const InventorySystem = require('../systems/InventorySystem');
const catalog = require('../data/inventoryCatalog');

function rect(x, y, width, height) { return { x: x, y: y, width: width, height: height }; }
function inside(point, box) { return point && box && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height; }

class WarehouseScene {
  constructor(deps) {
    Object.assign(this, deps);
    this.title = '仓库管理';
    this.system = new InventorySystem(this.gameState, this.saveManager);
    this.category = '全部';
    this.selectedId = catalog.items[0].id;
    this.shopOpen = false;
    this.orderQuantity = catalog.items[0].minimumOrder;
    this.scroll = 0;
    this.listBounds = null;
    this.toast = '';
    this.gesture = null;
    this.gestureHandler = {
      onTouchStart: this.onTouchStart.bind(this), onTouchMove: this.onTouchMove.bind(this), onTouchEnd: this.onTouchEnd.bind(this),
      onTouchCancel: () => { this.gesture = null; }
    };
  }

  enter() {
    this.inputManager.setGestureHandler(this.gestureHandler);
    catalog.items.forEach((item) => {
      if (!this.assetManager.hasImage(item.spriteKey)) this.assetManager.loadImage(item.spriteKey, item.spritePath, () => this.requestRender());
    });
    this.requestRender();
  }

  leave() { this.inputManager.clearGestureHandler(this.gestureHandler); this.gesture = null; this.inputManager.clear(); }
  requestRender() { if (this._lastBounds) this.render(this.context, this._lastBounds, this.gameState.getState()); }
  point(event) { const touch = event && event.touches && event.touches[0]; return touch ? { x: touch.clientX, y: touch.clientY } : null; }
  onTouchStart(event) { const point = this.point(event); if (inside(point, this.listBounds)) this.gesture = { startY: point.y, lastY: point.y, moved: false }; }
  onTouchMove(event) { if (!this.gesture) return; const point = this.point(event); if (!point) return; const delta = point.y - this.gesture.lastY; if (Math.abs(point.y - this.gesture.startY) > 6) this.gesture.moved = true; this.scroll = Math.max(0, this.scroll - delta); this.gesture.lastY = point.y; this.requestRender(); }
  onTouchEnd() { const moved = !!(this.gesture && this.gesture.moved); this.gesture = null; return moved; }

  button(context, id, box, label, enabled, action, selected, gold) {
    CanvasUtils.fillRoundedRect(context, box, 5, !enabled ? '#243744' : (selected || gold ? '#a76f22' : '#173247'));
    CanvasUtils.strokeRoundedRect(context, box, 5, selected || gold ? '#efc15b' : '#355164', 1);
    context.fillStyle = enabled ? (selected || gold ? '#fff1c8' : '#dce6e5') : '#687d89';
    context.font = 'bold 10px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(label, box.x + box.width / 2, box.y + box.height / 2);
    if (enabled) this.inputManager.register(id, box, action);
  }

  drawIcon(context, box, item) {
    CanvasUtils.fillRoundedRect(context, box, 5, '#162b3b');
    const image = this.assetManager.getImage(item.spriteKey);
    if (image && image.width && image.height) {
      const scale = Math.min((box.width - 6) / image.width, (box.height - 6) / image.height);
      const width = Math.round(image.width * scale); const height = Math.round(image.height * scale);
      context.save(); context.imageSmoothingEnabled = false;
      context.drawImage(image, Math.round(box.x + (box.width - width) / 2), Math.round(box.y + (box.height - height) / 2), width, height);
      context.restore();
    }
  }

  filteredItems() { return this.category === '全部' ? catalog.items : catalog.items.filter((item) => item.category === this.category); }

  drawStockCards(context, box, state) {
    this.listBounds = box;
    CanvasUtils.fillRoundedRect(context, box, 6, '#0b2030'); CanvasUtils.strokeRoundedRect(context, box, 6, '#314b5c', 1);
    const items = this.filteredItems(); const columns = box.width > 470 ? 3 : 2; const gap = 7; const padding = 8;
    const cardWidth = (box.width - padding * 2 - gap * (columns - 1)) / columns; const cardHeight = 76;
    const rows = Math.ceil(items.length / columns); const contentHeight = rows * (cardHeight + gap) + padding;
    this.scroll = Math.min(this.scroll, Math.max(0, contentHeight - box.height));
    context.save(); context.beginPath(); context.rect(box.x + 1, box.y + 1, box.width - 2, box.height - 2); context.clip();
    items.forEach((item, index) => {
      const column = index % columns; const row = Math.floor(index / columns);
      const card = rect(box.x + padding + column * (cardWidth + gap), box.y + padding + row * (cardHeight + gap) - this.scroll, cardWidth, cardHeight);
      if (card.y + card.height < box.y || card.y > box.y + box.height) return;
      const selected = item.id === this.selectedId;
      CanvasUtils.fillRoundedRect(context, card, 5, selected ? '#183c51' : '#122c3d'); CanvasUtils.strokeRoundedRect(context, card, 5, selected ? '#d8aa48' : '#324e61', 1);
      this.drawIcon(context, rect(card.x + 7, card.y + 8, 56, 56), item);
      context.textAlign = 'left'; context.textBaseline = 'alphabetic'; context.fillStyle = '#f3efe3'; context.font = 'bold 11px sans-serif'; context.fillText(item.name, card.x + 72, card.y + 22);
      context.fillStyle = '#78c78c'; context.font = 'bold 13px sans-serif'; context.fillText('库存 ' + this.system.getQuantity(item.id, state), card.x + 72, card.y + 43);
      context.fillStyle = '#8199a7'; context.font = '9px sans-serif'; context.fillText(item.category, card.x + 72, card.y + 61);
      const hitY = Math.max(card.y, box.y); const hitBottom = Math.min(card.y + card.height, box.y + box.height);
      if (hitBottom - hitY > 20) this.inputManager.register('warehouse:item:' + item.id, rect(card.x, hitY, card.width, hitBottom - hitY), () => { if (this.shopOpen) this.selectShopItem(item.id); else { this.selectedId = item.id; this.toast = ''; this.requestRender(); } });
    });
    context.restore();
  }

  openShop() { const item = catalog.byId[this.selectedId] || catalog.items[0]; this.orderQuantity = item.minimumOrder; this.shopOpen = true; this.scroll = 0; this.toast = ''; this.requestRender(); }
  selectShopItem(id) { const item = catalog.byId[id]; if (!item) return; this.selectedId = id; this.orderQuantity = item.minimumOrder; this.toast = ''; this.requestRender(); }
  changeQuantity(direction) { const item = catalog.byId[this.selectedId]; this.orderQuantity = Math.max(item.minimumOrder, this.orderQuantity + direction * item.minimumOrder); this.requestRender(); }
  purchase() { const result = this.system.purchase(this.selectedId, this.orderQuantity); this.toast = result.message; if (result.ok) this.orderQuantity = catalog.byId[this.selectedId].minimumOrder; this.requestRender(); }

  drawShop(context, bounds, state) {
    context.fillStyle = 'rgba(0,0,0,0.68)'; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.inputManager.register('warehouse:shop:blocker', bounds, () => {});
    const panel = rect(bounds.x + 18, bounds.y + 12, bounds.width - 36, bounds.height - 24);
    CanvasUtils.fillRoundedRect(context, panel, 8, '#0c2131'); CanvasUtils.strokeRoundedRect(context, panel, 8, '#e4b64f', 2);
    context.fillStyle = '#f0c15b'; context.font = 'bold 14px sans-serif'; context.textAlign = 'left'; context.textBaseline = 'alphabetic'; context.fillText('批发采购商城', panel.x + 15, panel.y + 25);
    this.button(context, 'warehouse:shop:close', rect(panel.x + panel.width - 48, panel.y + 4, 40, 36), '×', true, () => { this.shopOpen = false; this.scroll = 0; this.requestRender(); });
    const detailWidth = Math.max(190, Math.min(230, panel.width * 0.29));
    const list = rect(panel.x + 10, panel.y + 43, panel.width - detailWidth - 28, panel.height - 53);
    this.listBounds = list;
    const previousCategory = this.category; this.category = '全部'; this.drawStockCards(context, list, state); this.category = previousCategory;
    const item = catalog.byId[this.selectedId] || catalog.items[0]; const detail = rect(list.x + list.width + 8, list.y, detailWidth, list.height);
    CanvasUtils.fillRoundedRect(context, detail, 6, '#112b3d'); CanvasUtils.strokeRoundedRect(context, detail, 6, '#3f5e70', 1);
    this.drawIcon(context, rect(detail.x + 12, detail.y + 12, 72, 72), item);
    context.textAlign = 'left'; context.fillStyle = '#f4f0df'; context.font = 'bold 13px sans-serif'; context.fillText(item.name, detail.x + 94, detail.y + 31);
    context.fillStyle = '#8ea4b0'; context.font = '9px sans-serif'; context.fillText('批发单价 ¥' + item.wholesalePrice, detail.x + 94, detail.y + 51); context.fillText('最低起批 ' + item.minimumOrder + ' 个', detail.x + 94, detail.y + 68);
    context.fillStyle = '#abc0c8'; context.font = '9px sans-serif'; context.fillText(item.description, detail.x + 12, detail.y + 104);
    const quantityY = detail.y + detail.height - 105;
    this.button(context, 'warehouse:qty:minus', rect(detail.x + 12, quantityY, 42, 36), '－', this.orderQuantity > item.minimumOrder, () => this.changeQuantity(-1));
    context.fillStyle = '#f2c35b'; context.font = 'bold 15px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(this.orderQuantity), detail.x + detail.width / 2, quantityY + 18);
    this.button(context, 'warehouse:qty:plus', rect(detail.x + detail.width - 54, quantityY, 42, 36), '＋', true, () => this.changeQuantity(1));
    const total = item.wholesalePrice * this.orderQuantity;
    this.button(context, 'warehouse:buy', rect(detail.x + 12, detail.y + detail.height - 58, detail.width - 24, 42), '确认采购 ¥' + total.toLocaleString(), state.player.cash >= total, () => this.purchase(), false, true);
    if (this.toast) { context.fillStyle = this.toast.indexOf('成功') >= 0 ? '#72c984' : '#e88b60'; context.font = '9px sans-serif'; context.textAlign = 'center'; context.fillText(this.toast.slice(0, 28), detail.x + detail.width / 2, detail.y + detail.height - 67); }
  }

  render(context, bounds, state) {
    this._lastBounds = bounds;
    this.inputManager.clear();
    context.fillStyle = '#081824'; context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    const padding = 7; const header = rect(bounds.x + padding, bounds.y + padding, bounds.width - padding * 2, 48);
    CanvasUtils.fillRoundedRect(context, header, 6, '#10293b'); CanvasUtils.strokeRoundedRect(context, header, 6, '#315063', 1);
    const inventory = this.system.getState(state);
    const summary = [['库存总数', this.system.getTotalUnits(state)], ['已有品类', this.system.getStockedKinds(state) + '/' + catalog.items.length], ['累计售出', inventory.totalSold], ['当前现金', '¥' + state.player.cash.toLocaleString()]];
    summary.forEach((row, index) => { const width = header.width / summary.length; context.textAlign = 'left'; context.fillStyle = '#8299a7'; context.font = '9px sans-serif'; context.fillText(row[0], header.x + index * width + 10, header.y + 17); context.fillStyle = index === 3 ? '#f1c15c' : '#eef1e6'; context.font = 'bold 13px sans-serif'; context.fillText(String(row[1]), header.x + index * width + 10, header.y + 37); });
    const contentY = header.y + header.height + padding; const contentHeight = bounds.y + bounds.height - contentY - padding;
    const categoryBox = rect(bounds.x + padding, contentY, 92, contentHeight);
    CanvasUtils.fillRoundedRect(context, categoryBox, 6, '#0d2232'); CanvasUtils.strokeRoundedRect(context, categoryBox, 6, '#314958', 1);
    context.fillStyle = '#849aa7'; context.font = '9px sans-serif'; context.textAlign = 'center'; context.fillText('库存分类', categoryBox.x + categoryBox.width / 2, categoryBox.y + 18);
    catalog.categories.forEach((name, index) => this.button(context, 'warehouse:category:' + name, rect(categoryBox.x + 6, categoryBox.y + 28 + index * 47, categoryBox.width - 12, 40), name, true, () => { this.category = name; this.scroll = 0; this.requestRender(); }, this.category === name));
    this.button(context, 'warehouse:shop:open', rect(categoryBox.x + 6, categoryBox.y + categoryBox.height - 52, categoryBox.width - 12, 44), '去采购商城', true, () => this.openShop(), false, true);
    const stockBox = rect(categoryBox.x + categoryBox.width + padding, contentY, bounds.x + bounds.width - (categoryBox.x + categoryBox.width + padding) - padding, contentHeight);
    this.drawStockCards(context, stockBox, state);
    if (!this.shopOpen && this.toast) { context.fillStyle = '#72c984'; context.font = '9px sans-serif'; context.textAlign = 'right'; context.fillText(this.toast.slice(0, 36), header.x + header.width - 10, header.y + 43); }
    if (this.shopOpen) this.drawShop(context, bounds, state);
  }
}

module.exports = WarehouseScene;
