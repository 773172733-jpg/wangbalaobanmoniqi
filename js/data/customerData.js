'use strict';

module.exports = {
  segments: {
    students: { name: '学生党', priceSensitivity: 0.9 },
    gamers: { name: '电竞玩家', equipmentDemand: 0.9 },
    officeWorkers: { name: '上班族', environmentDemand: 0.7 },
    streamers: { name: '主播', equipmentDemand: 1.0 }
  },
  fields: ['share', 'spendingPower', 'priceSensitivity', 'equipmentDemand', 'environmentDemand']
};
