'use strict';

module.exports = {
  DEBUG_BUSINESS_SIMULATION: false,
  millisecondsPerGameHour: 15000,
  daysPerMonth: 30,
  monthsPerYear: 12,
  baseDailyTraffic: 40,
  hourlyRate: 8,
  baseServiceCapacity: 5,
  baseServiceScore: 40,
  baseNetworkQuality: 25,
  baseNetworkCapacity: 5,
  bandwidthPerSeat: 1,
  basePowerCapacity: 4,
  baseFixedElectricity: 2,
  electricityPerSeatHour: 0.65,
  electricityPrice: 1.2,
  maintenancePerSeatHour: 0.12,
  dailyHistoryLimit: 30,
  reputationTrafficWeight: 0.005,
  awarenessTrafficWeight: 0.006,
  areaTrafficPerLevel: 0.15,
  satisfactionSmoothing: 0.2,
  timePeriods: [
    { id: 'late_night', start: 0, end: 6, multiplier: 0.25 }, { id: 'morning', start: 6, end: 9, multiplier: 0.35 },
    { id: 'forenoon', start: 9, end: 12, multiplier: 0.65 }, { id: 'afternoon', start: 12, end: 17, multiplier: 0.9 },
    { id: 'evening', start: 17, end: 22, multiplier: 1.35 }, { id: 'night', start: 22, end: 24, multiplier: 0.8 }
  ]
};
