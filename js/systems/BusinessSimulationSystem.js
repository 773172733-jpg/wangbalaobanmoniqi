'use strict';

const segments = require('../data/customerSegments');
const config = require('../data/operatingConfig');
const OperatingMetricsSystem = require('./OperatingMetricsSystem');
const SeatAllocator = require('./SeatAllocator');
const FinanceSystem = require('./FinanceSystem');
const InventorySystem = require('./InventorySystem');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function dateKey(time) { return [time.year, time.month, time.day].join('_'); }
function hourKey(time) { return 'year_' + time.year + '_month_' + time.month + '_day_' + time.day + '_hour_' + time.hour; }
function emptyToday() { return { potentialCustomers: 0, admittedCustomers: 0, admittedBySegment: { student: 0, gamer: 0, office_worker: 0, streamer: 0 }, lostCustomers: 0, lostNoSeat: 0, lostLowPerformance: 0, lostNetwork: 0, lostPower: 0, lostService: 0, servedSeatHours: 0, seatIncome: 0, productIncome: 0, productUnitsSold: 0, satisfactionTotal: 0, satisfactionWeight: 0, peakOccupancy: 0, occupancySamples: [] }; }

class BusinessSimulationSystem {
  constructor(gameState, saveManager, timeManager, eventBus) {
    this.gameState = gameState; this.saveManager = saveManager; this.timeManager = timeManager; this.eventBus = eventBus;
    this.metricsSystem = new OperatingMetricsSystem(); this.seatAllocator = new SeatAllocator(); this.financeSystem = new FinanceSystem(gameState, saveManager); this.inventorySystem = new InventorySystem(gameState, saveManager); this.unsubscribers = [];
  }

  start() {
    if (this.unsubscribers.length || !this.eventBus) return;
    this.unsubscribers.push(this.eventBus.on('time:hourChanged', (time) => this.processHour(time)));
    this.unsubscribers.push(this.eventBus.on('time:dayEnded', (date) => this.settleDay(date)));
    const lastSummary = this.gameState.getState().businessSimulation.lastDailySummary;
    if (lastSummary && lastSummary.date) this.ensureDailyFinance(lastSummary);
    this.processHour(this.timeManager.getCurrentGameTime());
  }
  stop() { this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.unsubscribers = []; }
  seeded(key) { let hash = 2166136261; for (let index = 0; index < key.length; index += 1) { hash ^= key.charCodeAt(index); hash = Math.imul(hash, 16777619); } return ((hash >>> 0) % 10000) / 10000; }
  getPeriod(hour) { return config.timePeriods.find((period) => hour >= period.start && hour < period.end) || config.timePeriods[0]; }
  getPriceFit(segment, price) { if (price <= segment.idealHourlyPrice) return 1; const over = (price - segment.idealHourlyPrice) / Math.max(1, segment.idealHourlyPrice); return clamp(1 - over * segment.priceSensitivity, 0, 1); }

  getWillingness(segment, metrics, priceFit) {
    const values = { equipment: clamp(metrics.equipment.averagePerformance / Math.max(1, segment.idealPerformance), 0, 1), network: clamp(metrics.equipment.networkQuality / Math.max(1, segment.networkDemand), 0, 1), environment: clamp(metrics.decoration.environmentScore / Math.max(1, segment.environmentDemand), 0, 1), comfort: clamp(metrics.decoration.comfortScore / Math.max(1, segment.comfortDemand), 0, 1), service: clamp(metrics.employee.serviceScore / Math.max(1, segment.serviceDemand), 0, 1), price: priceFit, reputation: clamp(0.5 + metrics.cafe.reputation / 200, 0, 1) };
    let total = 0, weight = 0; Object.keys(segment.weights).forEach((key) => { total += (values[key] || 0) * segment.weights[key]; weight += segment.weights[key]; }); return clamp(total / Math.max(0.01, weight), 0, 1.2);
  }

  getPotential(segment, time, metrics) {
    const period = this.getPeriod(time.hour); const segmentTime = segment.timeMultipliers[period.id] || 1; const scale = 1 + (metrics.cafe.areaLevel - 1) * config.areaTrafficPerLevel; const awareness = 1 + metrics.marketing.awareness * config.awarenessTrafficWeight; const reputation = 1 + metrics.cafe.reputation * config.reputationTrafficWeight; const raw = config.baseDailyTraffic / 24 * period.multiplier * segmentTime * scale * awareness * reputation * metrics.cafe.naturalTrafficMultiplier * metrics.marketing.trafficMultiplier * (metrics.marketing.segmentMultipliers[segment.type] || 1) * segment.baseShare; const floor = Math.floor(raw); return floor + (this.seeded(hourKey(time) + '_' + segment.type) < raw - floor ? 1 : 0);
  }

  processHour(time) {
    const current = time || this.timeManager.getCurrentGameTime(); const key = hourKey(current); const state = this.gameState.getState();
    if (state.businessSimulation.lastProcessedHourKey === key) return { ok: false, duplicate: true, message: '该游戏小时已经处理。' };
    const next = this.gameState.snapshot(); const business = next.businessSimulation;
    if (business.currentDayKey !== dateKey(current)) { business.currentDayKey = dateKey(current); business.today = emptyToday(); }
    business.activeCohorts = (Array.isArray(business.activeCohorts) ? business.activeCohorts : []).filter((item) => item && item.count > 0 && item.remainingHours > 0);
    const metrics = this.metricsSystem.getMetrics(next); const occupied = { basic: 0, gaming: 0, premium: 0 }; business.activeCohorts.forEach((cohort) => { occupied[cohort.computerTier] = (occupied[cohort.computerTier] || 0) + cohort.count; });
    const activeBefore = business.activeCohorts.reduce((sum, item) => sum + item.count, 0); const requests = []; let potential = 0;
    segments.forEach((segment) => { const segmentPotential = this.getPotential(segment, current, metrics); potential += segmentPotential; const priceFit = this.getPriceFit(segment, metrics.cafe.hourlyPrice); const willingness = this.getWillingness(segment, metrics, priceFit); const rawArrivals = segmentPotential * willingness; const count = Math.floor(rawArrivals) + (this.seeded(key + '_arrival_' + segment.type) < rawArrivals - Math.floor(rawArrivals) ? 1 : 0); const range = segment.sessionHours; const sessionHours = range[0] + Math.floor(this.seeded(key + '_duration_' + segment.type) * (range[1] - range[0] + 1)); if (count > 0) requests.push({ segment: segment, count: count, sessionHours: sessionHours, priceFit: priceFit }); });
    requests.sort((a, b) => ({ streamer: 0, gamer: 1, office_worker: 2, student: 3 }[a.segment.type] - { streamer: 0, gamer: 1, office_worker: 2, student: 3 }[b.segment.type]));
    const allocation = this.seatAllocator.allocate(requests, metrics, occupied, activeBefore);
    allocation.allocations.forEach((item) => { const existing = business.activeCohorts.find((cohort) => cohort.segmentType === item.segmentType && cohort.computerTier === item.computerTier && cohort.remainingHours === item.sessionHours && cohort.satisfaction === item.satisfaction); if (existing) existing.count += item.count; else business.activeCohorts.push({ id: 'cohort_' + key + '_' + item.segmentType + '_' + item.computerTier, segmentType: item.segmentType, computerTier: item.computerTier, count: item.count, remainingHours: item.sessionHours, hourlyRate: metrics.cafe.hourlyPrice, satisfaction: item.satisfaction }); });
    const activeThisHour = business.activeCohorts.reduce((sum, item) => sum + item.count, 0); const seatIncome = Math.round(business.activeCohorts.reduce((sum, item) => sum + item.count * item.hourlyRate, 0)); const productSale = this.inventorySystem.fulfillProductDemand(next, allocation.admitted, Math.floor(this.seeded(key + '_products') * 10000)); const productIncome = productSale.revenue;
    const satisfactionTotal = allocation.allocations.reduce((sum, item) => sum + item.count * item.satisfaction, 0); const rejected = allocation.rejectedNoSeat + allocation.rejectedLowPerformance + allocation.rejectedNetworkLimit + allocation.rejectedPowerLimit + allocation.rejectedServiceLimit;
    allocation.allocations.forEach((item) => { business.today.admittedBySegment[item.segmentType] = (business.today.admittedBySegment[item.segmentType] || 0) + item.count; });
    Object.assign(business.today, { potentialCustomers: business.today.potentialCustomers + potential, admittedCustomers: business.today.admittedCustomers + allocation.admitted, lostCustomers: business.today.lostCustomers + rejected, lostNoSeat: business.today.lostNoSeat + allocation.rejectedNoSeat, lostLowPerformance: business.today.lostLowPerformance + allocation.rejectedLowPerformance, lostNetwork: business.today.lostNetwork + allocation.rejectedNetworkLimit, lostPower: business.today.lostPower + allocation.rejectedPowerLimit, lostService: business.today.lostService + allocation.rejectedServiceLimit, servedSeatHours: business.today.servedSeatHours + activeThisHour, seatIncome: business.today.seatIncome + seatIncome, productIncome: business.today.productIncome + productIncome, productUnitsSold: (business.today.productUnitsSold || 0) + productSale.unitsSold, satisfactionTotal: business.today.satisfactionTotal + satisfactionTotal, satisfactionWeight: business.today.satisfactionWeight + allocation.admitted, peakOccupancy: Math.max(business.today.peakOccupancy, activeThisHour) });
    const capacity = metrics.equipment.installedComputerCount; business.today.occupancySamples.push(capacity ? activeThisHour / capacity : 0); business.today.occupancySamples = business.today.occupancySamples.slice(-24);
    business.activeCohorts.forEach((cohort) => { cohort.remainingHours -= 1; }); business.activeCohorts = business.activeCohorts.filter((cohort) => cohort.remainingHours > 0 && cohort.count > 0);
    business.lastProcessedHourKey = key; business.lastHourResult = { hourKey: key, potentialCustomers: potential, admittedCustomers: allocation.admitted, activeCustomers: activeThisHour, seatIncome: seatIncome, productIncome: productIncome, allocation: allocation };
    next.player.level = Math.max(Number(next.player.level) || 1, metrics.cafe.level); next.cafe.businessScore = metrics.cafe.businessScore; next.cafe.occupancyRate = capacity ? Math.round(activeThisHour / capacity * 100) : 0; next.cafe.customerCount = business.today.admittedCustomers; next.cafe.todayIncome = business.today.seatIncome + business.today.productIncome; next.cafe.currentCustomers = activeThisHour; next.cafe.availableComputers = Math.max(0, capacity - activeThisHour);
    this.gameState.replace(next); this.saveManager.save(next); return { ok: true, result: business.lastHourResult };
  }

  settleDay(date) {
    const state = this.gameState.getState(); const today = state.businessSimulation.today || emptyToday(); if (state.businessSimulation.currentDayKey !== dateKey(date)) return { ok: true, skipped: true };
    const metrics = this.metricsSystem.getMetrics(state); const averageSatisfaction = today.satisfactionWeight ? Math.round(today.satisfactionTotal / today.satisfactionWeight) : state.cafe.satisfaction; const averageOccupancyRate = today.occupancySamples.length ? Math.round(today.occupancySamples.reduce((sum, value) => sum + value, 0) / today.occupancySamples.length * 100) : 0; const electricityCost = Math.round((config.baseFixedElectricity + today.servedSeatHours * config.electricityPerSeatHour) * config.electricityPrice); const maintenanceCost = Math.max(0, Math.round(today.servedSeatHours * config.maintenancePerSeatHour * (1 - Math.min(0.5, metrics.employee.technicalSupport / 250))));
    const summary = { date: clone(date), potentialCustomers: today.potentialCustomers, admittedCustomers: today.admittedCustomers, admittedBySegment: clone(today.admittedBySegment), uniqueVisitors: today.admittedCustomers, lostCustomers: today.lostCustomers, lostNoSeat: today.lostNoSeat, lostLowPerformance: today.lostLowPerformance, lostNetwork: today.lostNetwork, lostPower: today.lostPower, lostService: today.lostService, servedSeatHours: today.servedSeatHours, peakOccupancy: today.peakOccupancy, averageOccupancyRate: averageOccupancyRate, averageSatisfaction: averageSatisfaction, seatIncome: today.seatIncome, productIncome: today.productIncome, productUnitsSold: today.productUnitsSold || 0, totalRevenue: today.seatIncome + today.productIncome, electricityCost: electricityCost, maintenanceCost: maintenanceCost };
    const next = this.gameState.snapshot(); next.businessSimulation.lastDailySummary = summary; next.businessSimulation.dailyHistory.push(summary); next.businessSimulation.dailyHistory = next.businessSimulation.dailyHistory.slice(-config.dailyHistoryLimit); next.cafe.satisfaction = Math.round(next.cafe.satisfaction * (1 - config.satisfactionSmoothing) + averageSatisfaction * config.satisfactionSmoothing); if (averageSatisfaction > 70) next.player.reputation = clamp(next.player.reputation + 1, 0, 100); else if (averageSatisfaction < 50) next.player.reputation = clamp(next.player.reputation - 1, 0, 100); this.gameState.replace(next); this.saveManager.save(next);
    const financeResult = this.ensureDailyFinance(summary); return { ok: financeResult.ok, summary: summary, results: financeResult.results };
  }

  ensureDailyFinance(summary) {
    const date = summary.date; const suffix = date.year + '_' + date.month + '_' + date.day; const entries = [
      ['income', 'seat_income', summary.seatIncome, '当日上机收入', 'seat_income_' + suffix], ['income', 'product_income', summary.productIncome, '当日商品收入', 'product_income_' + suffix],
      ['expense', 'electricity', summary.electricityCost, '当日实际电费', 'electricity_' + suffix], ['expense', 'equipment_maintenance', summary.maintenanceCost, '当日设备维护', 'maintenance_' + suffix]
    ];
    const results = entries.filter((entry) => entry[2] > 0).map((entry) => this.financeSystem[entry[0] === 'income' ? 'recordIncome' : 'recordExpense']({ category: entry[1], amount: entry[2], sourceSystem: 'business_simulation', description: entry[3], gameDate: date, dedupeKey: entry[4], allowNegative: entry[0] === 'expense', metadata: { dailySummaryDate: suffix } })); return { ok: results.every((item) => item.ok || item.duplicate), results: results };
  }

  simulateHours(count) { const results = []; for (let index = 0; index < count; index += 1) results.push(this.timeManager.advanceHour()); return results; }
  getDebugSnapshot() { const state = this.gameState.getState(); const metrics = this.metricsSystem.getMetrics(state); return { time: this.timeManager.getCurrentGameTime(), metrics: metrics, today: clone(state.businessSimulation.today), lastHour: clone(state.businessSimulation.lastHourResult), activeCustomers: (state.businessSimulation.activeCohorts || []).reduce((sum, item) => sum + item.count, 0) }; }
  clearToday() { const next = this.gameState.snapshot(); next.businessSimulation.today = emptyToday(); next.cafe.todayIncome = 0; next.cafe.customerCount = 0; next.cafe.occupancyRate = 0; this.gameState.replace(next); this.saveManager.save(next); return { ok: true, message: '当日调试数据已清空。' }; }
}

BusinessSimulationSystem.emptyToday = emptyToday; BusinessSimulationSystem.hourKey = hourKey; module.exports = BusinessSimulationSystem;
