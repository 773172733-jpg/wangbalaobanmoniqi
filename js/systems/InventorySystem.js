'use strict';

const catalog = require('../data/inventoryCatalog');
const FinanceSystem = require('./FinanceSystem');

function integer(value) { const result = Math.floor(Number(value)); return Number.isFinite(result) ? result : 0; }

class InventorySystem {
  constructor(gameState, saveManager) {
    this.gameState = gameState || null;
    this.saveManager = saveManager || null;
    this.financeSystem = gameState ? new FinanceSystem(gameState, saveManager) : null;
  }

  static defaultState() { return { items: {}, totalPurchased: 0, totalSold: 0 }; }

  normalize(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const result = InventorySystem.defaultState();
    const sourceItems = source.items && typeof source.items === 'object' && !Array.isArray(source.items) ? source.items : {};
    catalog.items.forEach((item) => { result.items[item.id] = Math.max(0, integer(sourceItems[item.id])); });
    result.totalPurchased = Math.max(0, integer(source.totalPurchased));
    result.totalSold = Math.max(0, integer(source.totalSold));
    return result;
  }

  getState(source) {
    const root = source || (this.gameState && this.gameState.getState()) || {};
    return this.normalize(root.inventory);
  }

  getQuantity(id, source) { return this.getState(source).items[id] || 0; }

  getTotalUnits(source) { return Object.keys(this.getState(source).items).reduce((sum, id) => sum + this.getQuantity(id, source), 0); }

  getStockedKinds(source) { return catalog.items.filter((item) => this.getQuantity(item.id, source) > 0).length; }

  validateOrder(id, quantity) {
    const item = catalog.byId[id];
    const amount = integer(quantity);
    if (!item) return { ok: false, message: '未知商品。' };
    if (amount < item.minimumOrder) return { ok: false, message: '该商品最低起批 ' + item.minimumOrder + ' 个。' };
    if (amount % item.minimumOrder !== 0) return { ok: false, message: '采购数量必须是 ' + item.minimumOrder + ' 的整数倍。' };
    return { ok: true, item: item, quantity: amount, totalCost: amount * item.wholesalePrice };
  }

  purchase(id, quantity) {
    if (!this.gameState) return { ok: false, message: '仓库系统尚未连接游戏状态。' };
    const order = this.validateOrder(id, quantity);
    if (!order.ok) return order;
    return this.financeSystem.recordExpense({
      category: 'inventory_purchase', amount: order.totalCost, sourceSystem: 'inventory', sourceId: id,
      description: '采购' + order.item.name + ' ×' + order.quantity,
      successMessage: '采购成功，' + order.item.name + '入库 ' + order.quantity + ' 个。',
      mutate: (state) => {
        state.inventory = this.normalize(state.inventory);
        state.inventory.items[id] += order.quantity;
        state.inventory.totalPurchased += order.quantity;
      }
    });
  }

  fulfillProductDemand(state, customerCount, seedValue) {
    const root = state || {};
    root.inventory = this.normalize(root.inventory);
    const customers = Math.max(0, integer(customerCount));
    const seed = Math.max(0, integer(seedValue));
    const desired = Math.min(customers, Math.floor(customers * 0.55) + (customers > 0 && seed % 100 < 55 ? 1 : 0));
    const saleItems = catalog.items.filter((item) => item.retailPrice > 0);
    let revenue = 0; let unitsSold = 0;
    for (let index = 0; index < desired; index += 1) {
      let sold = null;
      for (let offset = 0; offset < saleItems.length; offset += 1) {
        const item = saleItems[(seed + index + offset) % saleItems.length];
        if (root.inventory.items[item.id] > 0) { sold = item; break; }
      }
      if (!sold) break;
      root.inventory.items[sold.id] -= 1;
      revenue += sold.retailPrice;
      unitsSold += 1;
    }
    root.inventory.totalSold += unitsSold;
    return { revenue: revenue, unitsSold: unitsSold };
  }
}

module.exports = InventorySystem;
