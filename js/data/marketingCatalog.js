'use strict';

const campaigns = [
  {
    id: 'online_ads', name: '线上广告', description: '在本地社交平台投放精准广告', cost: 500, duration: 7, cooldown: 3,
    trafficMultiplier: 1.15, awarenessGain: 2, returnRateBonus: 0.01, unlockLevel: 1,
    targets: { students: 1.2, gamers: 1.15, officeWorkers: 1.1, streamers: 1.05 }, color: '#61b8e8', icon: '广'
  },
  {
    id: 'student_discount', name: '学生优惠', description: '通过限时优惠吸引学生客群', cost: 800, duration: 5, cooldown: 5,
    trafficMultiplier: 1.2, awarenessGain: 2, returnRateBonus: 0.03, unlockLevel: 1,
    targets: { students: 1.6, gamers: 1.1, officeWorkers: 1.05, streamers: 1 }, color: '#72c984', icon: '学'
  },
  {
    id: 'esports_promotion', name: '电竞宣传', description: '围绕硬件配置推广电竞主题活动', cost: 3000, duration: 7, cooldown: 10,
    trafficMultiplier: 1.35, awarenessGain: 5, returnRateBonus: 0.02, unlockLevel: 3,
    requirements: { equipment: 30 },
    targets: { students: 1.05, gamers: 1.7, officeWorkers: 1, streamers: 1.45 }, color: '#e8b94f', icon: '竞'
  }
];

const byId = {};
campaigns.forEach((item) => { byId[item.id] = item; });

module.exports = {
  campaigns: campaigns,
  byId: byId,
  segments: [
    { id: 'students', name: '学生党' }, { id: 'gamers', name: '电竞玩家' },
    { id: 'officeWorkers', name: '上班族' }, { id: 'streamers', name: '主播' }
  ]
};
