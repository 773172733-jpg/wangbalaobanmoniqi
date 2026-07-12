'use strict';

const items = [
  ['snack', '休闲零食', '食品饮料', 3, 6, 10, '袋装薯片与小零食。'],
  ['instant_noodles', '方便面', '食品饮料', 5, 10, 10, '网吧常备桶装方便面。'],
  ['cigarettes', '香烟', '食品饮料', 18, 25, 10, '成人顾客商品，按条批发。'],
  ['soda', '碳酸饮料', '食品饮料', 3, 6, 10, '罐装清凉饮料。'],
  ['bottled_water', '矿泉水', '食品饮料', 1, 3, 10, '瓶装饮用水。'],
  ['energy_drink', '能量饮料', '食品饮料', 5, 10, 10, '适合长时间上机顾客。'],
  ['chocolate', '巧克力', '食品饮料', 4, 8, 10, '独立包装甜食。'],
  ['tissues', '纸巾', '日用品', 2, 0, 10, '前台与顾客区日常消耗品。'],
  ['rental_keyboard', '租赁键盘', '租赁设备', 160, 0, 1, '备用机械键盘，可供顾客租赁。'],
  ['rental_mouse', '租赁鼠标', '租赁设备', 90, 0, 1, '备用游戏鼠标。'],
  ['rental_headset', '租赁耳机', '租赁设备', 120, 0, 1, '备用包耳式游戏耳机。'],
  ['rental_power_bank', '租赁充电宝', '租赁设备', 80, 0, 1, '供顾客临时租赁使用。']
].map((row) => ({
  id: row[0], name: row[1], category: row[2], wholesalePrice: row[3], retailPrice: row[4], minimumOrder: row[5], description: row[6],
  spriteKey: 'inventory_' + row[0], spritePath: 'assets/textures/inventory/' + row[0] + '.png'
}));

const byId = {};
items.forEach((item) => { byId[item.id] = item; });

module.exports = { categories: ['全部', '食品饮料', '日用品', '租赁设备'], items: items, byId: byId };
