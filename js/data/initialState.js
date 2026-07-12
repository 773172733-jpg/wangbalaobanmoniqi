'use strict';

const initialState = {
  saveVersion: 9,
  player: {
    level: 1,
    cash: 5000000,
    reputation: 0
  },
  time: {
    year: 1,
    month: 1,
    day: 1,
    hour: 8
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
    monthlyProfit: 0,
    pricing: { hourlyRate: 8 }
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
  finance: {
    transactions: [],
    settledKeys: [],
    monthlySnapshots: {},
    settings: { currentViewMonth: null, recurring: { rent: 0, networkFee: 0 } }
  },
  businessSimulation: {
    lastProcessedHourKey: null,
    currentDayKey: null,
    activeCohorts: [],
    today: {
      potentialCustomers: 0, admittedCustomers: 0, admittedBySegment: { student: 0, gamer: 0, office_worker: 0, streamer: 0 }, lostCustomers: 0, lostNoSeat: 0,
      lostLowPerformance: 0, lostNetwork: 0, lostPower: 0, lostService: 0,
      servedSeatHours: 0, seatIncome: 0, productIncome: 0, productUnitsSold: 0,
      satisfactionTotal: 0, satisfactionWeight: 0, peakOccupancy: 0, occupancySamples: []
    },
    lastDailySummary: null,
    lastHourResult: null,
    dailyHistory: []
  },
  customers: {},
  inventory: {
    items: {},
    totalPurchased: 0,
    totalSold: 0
  },
  expansion: {
    level: 0,
    currentArea: 10000,
    baseArea: 10000,
    history: []
  },
  furniture: [],
  devices: {}
};

module.exports = initialState;
