'use strict';

const items = [
  ['seat_income', '上机收入', 'income', true, false], ['membership_income', '会员收入', 'income', true, false],
  ['product_income', '商品收入', 'income', true, false], ['event_income', '赛事收入', 'income', true, false],
  ['sponsorship_income', '合作收入', 'income', true, false], ['asset_sale_refund', '资产出售回款', 'income', false, false],
  ['other_income', '其他收入', 'income', true, false], ['payroll', '员工工资', 'expense', true, false],
  ['rent', '房租', 'expense', true, false], ['electricity', '电费', 'expense', true, false],
  ['network_fee', '网络费用', 'expense', true, false], ['equipment_maintenance', '设备维护', 'expense', true, false],
  ['marketing', '营销费用', 'expense', true, false], ['daily_operation', '日常运营', 'expense', true, false],
  ['recruitment', '招聘费用', 'expense', true, false], ['equipment_purchase', '设备购买', 'expense', false, true],
  ['equipment_upgrade', '设备升级', 'expense', false, true], ['furniture_purchase', '家具购买', 'expense', false, true],
  ['decoration', '装修支出', 'expense', false, true], ['expansion', '扩建支出', 'expense', false, true],
  ['tax_and_fee', '税费', 'expense', true, false], ['other_expense', '其他支出', 'expense', true, false]
].map((row) => ({ id: row[0], name: row[1], direction: row[2], isOperating: row[3], isCapitalExpenditure: row[4] }));

const byId = {};
items.forEach((item) => { byId[item.id] = item; });

module.exports = {
  items: items, byId: byId,
  income: items.filter((item) => item.direction === 'income'),
  expense: items.filter((item) => item.direction === 'expense')
};
