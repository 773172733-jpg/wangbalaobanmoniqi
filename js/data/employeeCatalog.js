'use strict';

const roles = [
  { type: 'cashier', name: '收银员', baseSalary: 2500, weight: 30, attributes: { service: 70, efficiency: 75, technology: 20, marketing: 20 }, trait: '亲和', effect: '会员转化 +10%' },
  { type: 'network_admin', name: '网管', baseSalary: 3500, weight: 25, attributes: { service: 50, efficiency: 70, technology: 85, marketing: 20 }, trait: '电竞达人', effect: '电竞顾客满意度 +10%' },
  { type: 'cleaner', name: '保洁员', baseSalary: 2200, weight: 25, attributes: { service: 60, efficiency: 85, technology: 20, marketing: 10 }, trait: '勤快', effect: '卫生下降速度 -30%' },
  { type: 'technician', name: '技术员', baseSalary: 4500, weight: 15, attributes: { service: 40, efficiency: 70, technology: 95, marketing: 20 }, trait: '硬件专家', effect: '设备维护费用 -20%' },
  { type: 'operator', name: '运营人员', baseSalary: 6000, weight: 5, attributes: { service: 60, efficiency: 60, technology: 40, marketing: 90 }, trait: '营销高手', effect: '广告效果 +20%' },
  { type: 'manager', name: '店长', baseSalary: 10000, weight: 1, attributes: { service: 90, efficiency: 90, technology: 70, marketing: 80 }, trait: '管理', effect: '所有员工效率 +10%' }
];

const qualities = [
  { id: 'normal', name: '普通', weight: 70, min: 60, max: 75, salaryFactor: 1, color: '#a9b5bd' },
  { id: 'excellent', name: '优秀', weight: 25, min: 75, max: 90, salaryFactor: 1.3, color: '#61b8e8' },
  { id: 'rare', name: '稀有', weight: 5, min: 90, max: 100, salaryFactor: 1.8, color: '#e8b94f' }
];

const byType = {};
roles.forEach((role) => { byType[role.type] = role; });

module.exports = {
  roles: roles,
  qualities: qualities,
  byType: byType,
  surnames: ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙'],
  givenNames: ['伟', '强', '芳', '娜', '敏', '静', '磊', '洋', '勇', '杰', '婷', '超', '晨', '宇', '欣']
};
