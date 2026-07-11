'use strict';

const zeroBonus = {
  environment: 0,
  equipment: 0,
  service: 0,
  hygiene: 0,
  comfort: 0
};

function bonus(values) {
  return Object.assign({}, zeroBonus, values || {});
}

function visual(fallbackStyle) {
  return {
    spriteKey: null,
    spritePath: null,
    renderScale: 1,
    renderOffsetX: 0,
    renderOffsetY: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    fallbackStyle: fallbackStyle
  };
}

module.exports = [
  {
    type: 'standard_pc_desk',
    name: '普通电脑桌',
    category: '设备',
    width: 2,
    height: 1,
    price: 1000,
    refundRate: 0.5,
    maxCount: 0,
    capacity: 1,
    ratingBonus: bonus({ equipment: 4 }),
    renderStyle: { body: '#5b3826', accent: '#2d91c7' },
    visual: Object.assign(visual({ body: '#5b3826', accent: '#2d91c7' }), {
      spriteKey: 'standard_pc_desk',
      spritePath: 'assets/textures/furniture/standard_pc_desk_01.png'
    })
  },
  {
    type: 'double_gaming_desk',
    name: '双人电竞桌',
    category: '设备',
    width: 3,
    height: 1,
    price: 1800,
    refundRate: 0.5,
    maxCount: 0,
    capacity: 2,
    ratingBonus: bonus({ equipment: 7 }),
    renderStyle: { body: '#4b2e22', accent: '#38a7df' },
    visual: Object.assign(visual({ body: '#4b2e22', accent: '#38a7df' }), {
      spriteKey: 'double_gaming_desk',
      spritePath: 'assets/textures/furniture/double_gaming_desk_01.png'
    })
  },
  {
    type: 'vip_pc_set',
    name: 'VIP电脑区',
    category: '设备',
    width: 3,
    height: 2,
    price: 3500,
    refundRate: 0.5,
    maxCount: 0,
    capacity: 2,
    ratingBonus: bonus({ equipment: 10, comfort: 4 }),
    renderStyle: { body: '#24242f', accent: '#d8a83f' },
    visual: visual({ body: '#24242f', accent: '#d8a83f' })
  },
  {
    type: 'cashier_counter',
    name: '收银台',
    category: '家具',
    width: 2,
    height: 1,
    price: 1500,
    refundRate: 0.5,
    maxCount: 1,
    capacity: 0,
    ratingBonus: bonus({ service: 8 }),
    renderStyle: { body: '#7a4a2a', accent: '#e0a84d' },
    visual: visual({ body: '#7a4a2a', accent: '#e0a84d' })
  },
  {
    type: 'sofa',
    name: '休息沙发',
    category: '家具',
    width: 2,
    height: 1,
    price: 800,
    refundRate: 0.5,
    maxCount: 0,
    capacity: 0,
    ratingBonus: bonus({ comfort: 6 }),
    renderStyle: { body: '#2f6047', accent: '#6ea36f' },
    visual: visual({ body: '#2f6047', accent: '#6ea36f' })
  },
  {
    type: 'plant',
    name: '绿植',
    category: '装饰',
    width: 1,
    height: 1,
    price: 200,
    refundRate: 0.5,
    maxCount: 0,
    capacity: 0,
    ratingBonus: bonus({ environment: 3 }),
    renderStyle: { body: '#7d4c29', accent: '#3f9b47' },
    visual: visual({ body: '#7d4c29', accent: '#3f9b47' })
  },
  {
    type: 'decorative_light',
    name: '装饰灯',
    category: '装饰',
    width: 1,
    height: 1,
    price: 300,
    refundRate: 0.5,
    maxCount: 0,
    capacity: 0,
    ratingBonus: bonus({ environment: 2, comfort: 1 }),
    renderStyle: { body: '#6b4f23', accent: '#ffd15a' },
    visual: visual({ body: '#6b4f23', accent: '#ffd15a' })
  },
  {
    type: 'trash_bin',
    name: '垃圾桶',
    category: '家具',
    width: 1,
    height: 1,
    price: 150,
    refundRate: 0.5,
    maxCount: 0,
    capacity: 0,
    ratingBonus: bonus({ hygiene: 2 }),
    renderStyle: { body: '#4f5a61', accent: '#7e8a91' },
    visual: visual({ body: '#4f5a61', accent: '#7e8a91' })
  }
];
