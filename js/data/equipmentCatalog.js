'use strict';

const electricityPricePerUnit = 1.2;

const categories = [
  { id: 'computer', label: '电脑' },
  { id: 'network', label: '网络' },
  { id: 'environment', label: '环境' },
  { id: 'power', label: '电力' }
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
  },
  {
    type: 'gigabit_router', name: '千兆路由器', category: 'network', description: '为网吧设备提供稳定的千兆网络接入。',
    purchasePrice: 1800, upgradeBasePrice: 1000, score: 4, performance: 0,
    powerUsage: 0.2, dailyMaintenance: 1, requiresComputerSlot: false, capacity: 20,
    ratingBonus: 0, maxLevel: 5, visual: { color: '#3d765f', accent: '#6bd6a5', icon: '网络' }
  },
  {
    type: 'commercial_ac', name: '商用空调', category: 'environment', description: '改善营业区域温度与整体舒适度。',
    purchasePrice: 6000, upgradeBasePrice: 3500, score: 5, performance: 4,
    powerUsage: 4, dailyMaintenance: 5, requiresComputerSlot: false, capacity: 6,
    ratingBonus: 4, maxLevel: 5, visual: { color: '#477884', accent: '#8bd9e8', icon: '空调' }
  },
  {
    type: 'ups_power', name: 'UPS备用电源', category: 'power', description: '在供电波动时为关键设备提供基础保护。',
    purchasePrice: 4000, upgradeBasePrice: 2200, score: 4, performance: 20,
    powerUsage: 0.3, dailyMaintenance: 2, requiresComputerSlot: false, capacity: 20,
    ratingBonus: 0, maxLevel: 5, visual: { color: '#7b653c', accent: '#e7bd55', icon: 'UPS' }
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
