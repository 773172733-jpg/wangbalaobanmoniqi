'use strict';

const initialState = {
  saveVersion: 5,
  player: {
    level: 1,
    cash: 50000,
    reputation: 0
  },
  time: {
    year: 1,
    month: 1,
    day: 1
  },
  cafe: {
    satisfaction: 50,
    hygiene: 50,
    service: 50,
    environment: 50,
    equipment: 0,
    layoutEquipment: 0,
    deviceEquipment: 0,
    comfort: 50,
    capacity: 0,
    overall: 50,
    areaLevel: 1,
    occupancyRate: 0,
    todayIncome: 0,
    customerCount: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    monthlyProfit: 0
  },
  employees: [],
  employeeMarket: {
    refreshTime: '',
    candidates: []
  },
  marketing: {
    awareness: 0,
    activeCampaigns: [],
    cooldowns: {},
    totalSpent: 0
  },
  customers: {},
  furniture: [],
  devices: {}
};

module.exports = initialState;
