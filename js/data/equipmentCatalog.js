'use strict';

const electricityPricePerUnit = 1.2;

const categories = [
  { id: 'computer', label: '电脑' }
];

const items = [
  {
    type: 'basic_pc', name: '普通电脑', category: 'computer', description: '适合基础办公与轻度娱乐的入门电脑。',
    purchasePrice: 2500, upgradeBasePrice: 1500, score: 4, performance: 35,
    powerUsage: 0.8, dailyMaintenance: 2, requiresComputerSlot: true, capacity: 1,
    ratingBonus: 0, maxLevel: 5, visual: { color: '#4f86a8', accent: '#72c5e8', icon: 'PC' }
  },
  {
    type: 'gaming_pc', name: '电竞电脑', category: 'computer', description: '兼顾主流电竞游戏帧率与稳定性的中端电脑。',
    purchasePrice: 5500, upgradeBasePrice: 3000, score: 8, performance: 65,
    powerUsage: 1.4, dailyMaintenance: 4, requiresComputerSlot: true, capacity: 1,
    ratingBonus: 0, maxLevel: 5, visual: { color: '#365f91', accent: '#49b9ef', icon: '电竞' }
  },
  {
    type: 'premium_pc', name: '高端电竞电脑', category: 'computer', description: '面向高画质竞技与高需求玩家的旗舰电脑。',
    purchasePrice: 10000, upgradeBasePrice: 5500, score: 14, performance: 90,
    powerUsage: 2.2, dailyMaintenance: 7, requiresComputerSlot: true, capacity: 1,
    ratingBonus: 0, maxLevel: 5, visual: { color: '#5d477f', accent: '#b784e8', icon: '高端' }
  }
];

const byType = {};
items.forEach((item) => { byType[item.type] = item; });

module.exports = {
  electricityPricePerUnit: electricityPricePerUnit,
  categories: categories,
  items: items,
  byType: byType
};
