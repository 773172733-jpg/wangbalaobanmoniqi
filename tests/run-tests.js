'use strict';

const assert = require('assert');
const initialState = require('../js/data/initialState');
const EventBus = require('../js/core/EventBus');
const GameState = require('../js/core/GameState');
const SaveManager = require('../js/core/SaveManager');
const DeviceSystem = require('../js/systems/DeviceSystem');
const Camera2D = require('../js/map/Camera2D');
const Game = require('../js/core/Game');
const EmployeeSystem = require('../js/systems/EmployeeSystem');
const MarketingSystem = require('../js/systems/MarketingSystem');
const FinanceSystem = require('../js/systems/FinanceSystem');
const FinanceChartRenderer = require('../js/ui/charts/FinanceChartRenderer');
const TimeManager = require('../js/core/TimeManager');
const BusinessSimulationSystem = require('../js/systems/BusinessSimulationSystem');
const ExpansionSystem = require('../js/systems/ExpansionSystem');
const expansionConfig = require('../js/data/expansionConfig');
const MapSystem = require('../js/map/MapSystem');
const GridMap = require('../js/map/GridMap');
const OperatingMetricsSystem = require('../js/systems/OperatingMetricsSystem');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function createContext() {
  const target = { measureText: (text) => ({ width: String(text).length * 8 }) };
  return new Proxy(target, {
    get: (object, key) => key in object ? object[key] : function () {},
    set: (object, key, value) => { object[key] = value; return true; }
  });
}

function createWx(options) {
  const settings = options || {};
  const storage = { value: settings.storage };
  const listeners = {};
  const context = createContext();
  return {
    storage: storage,
    listeners: listeners,
    context: context,
    createCanvas: () => ({ width: 0, height: 0, getContext: () => context }),
    getSystemInfoSync: () => ({
      windowWidth: settings.width || 844,
      windowHeight: settings.height || 390,
      pixelRatio: settings.pixelRatio || 3,
      safeArea: settings.safeArea || { left: 0, right: settings.width || 844, top: 0, bottom: settings.height || 390 }
    }),
    getStorageSync: () => storage.value,
    setStorageSync: (key, value) => { storage.key = key; storage.value = clone(value); },
    onTouchStart: (handler) => { listeners.start = handler; },
    onTouchMove: (handler) => { listeners.move = handler; },
    onTouchEnd: (handler) => { listeners.end = handler; },
    onTouchCancel: (handler) => { listeners.cancel = handler; },
    offTouchStart: () => {}, offTouchMove: () => {}, offTouchEnd: () => {}, offTouchCancel: () => {},
    createImage: () => ({})
  };
}

function testMigrationAndRecovery() {
  global.wx = createWx({ storage: {
    saveVersion: 2,
    player: { level: 4, cash: 43210, reputation: 9 },
    furniture: [{ id: 'desk', type: 'standard_pc_desk', gridX: 0, gridY: 0, rotation: 0 }],
    devices: [{ type: 'basic_pc', owned: 2, installed: 5, level: 99, condition: -20 }]
  } });
  const manager = new SaveManager(initialState);
  const loaded = manager.load();
  assert.strictEqual(loaded.saveVersion, 8);
  assert.strictEqual(loaded.player.cash, 43210);
  assert.strictEqual(loaded.player.level, 4);
  assert.strictEqual(loaded.furniture.length, 1);
  assert.strictEqual(loaded.devices.basic_pc.owned, 2);
  assert.strictEqual(loaded.devices.basic_pc.installed, 1);
  assert.strictEqual(loaded.devices.basic_pc.level, 5);
  assert.strictEqual(loaded.devices.basic_pc.condition, 0);
  assert.deepStrictEqual(loaded.employees, []);
  assert.ok(Array.isArray(loaded.employeeMarket.candidates));
  assert.strictEqual(loaded.marketing.awareness, 0);
  assert.deepStrictEqual(loaded.marketing.activeCampaigns, []);
  assert.deepStrictEqual(loaded.finance.transactions, []);
  assert.strictEqual(loaded.cafe.pricing.hourlyRate, 8);
  assert.deepStrictEqual(loaded.businessSimulation.activeCohorts, []);

  global.wx = createWx({ storage: '{broken-json' });
  const recovered = new SaveManager(initialState).load();
  assert.strictEqual(recovered.saveVersion, 8);
  assert.strictEqual(recovered.player.cash, initialState.player.cash);
  assert.ok(recovered.devices.basic_pc);
}

function simulationFixture(options) {
  const settings = options || {}; global.wx = createWx(); const saveManager = new SaveManager(initialState); const raw = clone(initialState);
  const computerCount = settings.basic || settings.gaming || settings.premium || 0; raw.furniture = Array.from({ length: computerCount }, (_, index) => ({ id: 'desk_' + index, type: 'standard_pc_desk', gridX: (index % 6) * 2, gridY: Math.floor(index / 6), rotation: 0 }));
  (settings.decor || []).forEach((type, index) => raw.furniture.push({ id: 'decor_' + index, type: type, gridX: index * 2, gridY: 4, rotation: 0 }));
  raw.devices = {
    basic_pc: { owned: settings.basic || 0, installed: settings.basic || 0, level: 1, condition: 100 },
    gaming_pc: { owned: settings.gaming || 0, installed: settings.gaming || 0, level: 1, condition: 100 },
    premium_pc: { owned: settings.premium || 0, installed: settings.premium || 0, level: 1, condition: 100 },
    gigabit_router: { owned: settings.router ? 1 : 0, installed: settings.router ? 1 : 0, level: settings.routerLevel || 1, condition: 100 },
    ups_power: { owned: settings.ups ? 1 : 0, installed: settings.ups ? 1 : 0, level: settings.upsLevel || 1, condition: 100 }
  };
  raw.employees = settings.employees || []; if (settings.marketing) raw.marketing.activeCampaigns = [{ id: 'online_ads', startDay: 1, endDay: 99 }];
  const gameState = new GameState(saveManager.normalize(raw), new EventBus()); const eventBus = gameState.eventBus; const timeManager = new TimeManager(gameState, eventBus); const business = new BusinessSimulationSystem(gameState, saveManager, timeManager, eventBus); business.start(); return { gameState: gameState, saveManager: saveManager, timeManager: timeManager, business: business };
}

function runSimulationDays(fixture, days) { fixture.business.simulateHours(days * 24); return fixture.gameState.getState().businessSimulation.dailyHistory; }

function testBusinessSimulation() {
  const empty = simulationFixture({}); const emptyHistory = runSimulationDays(empty, 2); assert.ok(emptyHistory.length >= 1); const emptyDay = emptyHistory[0]; assert.ok(emptyDay.potentialCustomers > 0); assert.strictEqual(emptyDay.admittedCustomers, 0); assert.strictEqual(emptyDay.seatIncome, 0); assert.ok(emptyDay.lostNoSeat > 0);
  assert.strictEqual(new FinanceSystem(empty.gameState, empty.saveManager).getTransactions({ category: 'seat_income' }).length, 0);

  const basic = simulationFixture({ basic: 5, router: true, ups: true }); const basicHistory = runSimulationDays(basic, 3); const basicTotals = basicHistory.reduce((sum, day) => ({ admitted: sum.admitted + day.admittedCustomers, revenue: sum.revenue + day.totalRevenue, occupancy: Math.max(sum.occupancy, day.peakOccupancy) }), { admitted: 0, revenue: 0, occupancy: 0 }); assert.ok(basicTotals.admitted > 0); assert.ok(basicTotals.revenue > 0); assert.ok(basicTotals.occupancy > 0); assert.ok(new FinanceSystem(basic.gameState, basic.saveManager).getTransactions({ category: 'seat_income' }).length > 0);
  const basicFinance = new FinanceSystem(basic.gameState, basic.saveManager); const cashDelta = basicFinance.getTransactions({}).reduce((sum, item) => sum + (item.direction === 'income' ? item.amount : -item.amount), 0); assert.strictEqual(basicFinance.getCash(), initialState.player.cash + cashDelta);

  const gaming = simulationFixture({ gaming: 5, router: true, ups: true }); const gamingHistory = runSimulationDays(gaming, 7); assert.ok(gamingHistory.reduce((sum, day) => sum + day.admittedBySegment.gamer, 0) > 0); assert.ok(gamingHistory.reduce((sum, day) => sum + day.servedSeatHours, 0) >= gamingHistory.reduce((sum, day) => sum + day.admittedCustomers, 0));

  const premium = simulationFixture({ premium: 5, router: true, routerLevel: 3, ups: true }); const premiumHistory = runSimulationDays(premium, 15); assert.ok(premiumHistory.reduce((sum, day) => sum + day.admittedBySegment.streamer, 0) > 0);

  const constrained = simulationFixture({ gaming: 10, router: false, ups: false }); const constrainedHistory = runSimulationDays(constrained, 5); assert.ok(constrainedHistory.reduce((sum, day) => sum + day.lostNetwork + day.lostPower + day.lostService, 0) > 0);

  const unstaffed = simulationFixture({ gaming: 10, router: true, ups: true }); const unstaffedHistory = runSimulationDays(unstaffed, 5);
  const staffed = simulationFixture({ gaming: 10, router: true, ups: true, employees: [{ id: 'manager', type: 'manager', salary: 10000, attributes: { service: 90, efficiency: 90, technology: 70, marketing: 80 }, traits: ['管理'] }] }); const staffedHistory = runSimulationDays(staffed, 5); assert.ok(staffedHistory.reduce((sum, day) => sum + day.admittedCustomers, 0) >= unstaffedHistory.reduce((sum, day) => sum + day.admittedCustomers, 0)); assert.ok(staffedHistory.reduce((sum, day) => sum + day.lostService, 0) <= unstaffedHistory.reduce((sum, day) => sum + day.lostService, 0)); assert.ok(new OperatingMetricsSystem().getMetrics(staffed.gameState.getState()).employee.serviceCapacity > 5);

  const marketBase = simulationFixture({ basic: 2, router: true, ups: true }); runSimulationDays(marketBase, 2); const basePotential = marketBase.gameState.getState().businessSimulation.dailyHistory.reduce((sum, day) => sum + day.potentialCustomers, 0);
  const marketed = simulationFixture({ basic: 2, router: true, ups: true, marketing: true }); runSimulationDays(marketed, 2); const marketedState = marketed.gameState.getState(); const marketedPotential = marketedState.businessSimulation.dailyHistory.reduce((sum, day) => sum + day.potentialCustomers, 0); assert.ok(marketedPotential >= basePotential); assert.ok(marketedState.businessSimulation.dailyHistory.reduce((sum, day) => sum + day.lostCustomers, 0) > 0);

  const plain = simulationFixture({ basic: 5, router: true, ups: true }); const plainHistory = runSimulationDays(plain, 5);
  const decorated = simulationFixture({ basic: 5, router: true, ups: true, decor: ['plant', 'plant', 'sofa', 'decorative_light', 'trash_bin'] }); const decoratedHistory = runSimulationDays(decorated, 5); assert.ok(new OperatingMetricsSystem().getMetrics(decorated.gameState.getState()).decoration.environmentScore > new OperatingMetricsSystem().getMetrics(plain.gameState.getState()).decoration.environmentScore); assert.ok(decoratedHistory.reduce((sum, day) => sum + day.averageSatisfaction, 0) >= plainHistory.reduce((sum, day) => sum + day.averageSatisfaction, 0));

  const finance = new FinanceSystem(basic.gameState, basic.saveManager); const firstDay = basic.gameState.getState().businessSimulation.dailyHistory[0].date; const beforeCount = finance.getTransactions({ category: 'seat_income' }).length; const duplicate = basic.business.settleDay(firstDay); assert.ok(duplicate.skipped || duplicate.results.every((item) => item.duplicate)); assert.strictEqual(finance.getTransactions({ category: 'seat_income' }).length, beforeCount);
  const lastKey = basic.gameState.getState().businessSimulation.lastProcessedHourKey; const current = basic.timeManager.getCurrentGameTime(); basic.business.processHour(current); assert.strictEqual(basic.gameState.getState().businessSimulation.lastProcessedHourKey, lastKey);
  const transactionCountBeforeReload = basicFinance.getTransactions({}).length; global.wx = createWx({ storage: basic.gameState.snapshot() }); const reloadSaveManager = new SaveManager(initialState); const reloadedState = new GameState(reloadSaveManager.load(), new EventBus()); const reloadedTime = new TimeManager(reloadedState, reloadedState.eventBus); const reloadedBusiness = new BusinessSimulationSystem(reloadedState, reloadSaveManager, reloadedTime, reloadedState.eventBus); reloadedBusiness.start(); assert.strictEqual(new FinanceSystem(reloadedState, reloadSaveManager).getTransactions({}).length, transactionCountBeforeReload); assert.strictEqual(reloadedState.getState().businessSimulation.lastProcessedHourKey, lastKey);
  assert.ok(basic.gameState.getState().businessSimulation.activeCohorts.length < 100); assert.ok(basic.gameState.getState().businessSimulation.dailyHistory.length <= 30);
  const longRun = simulationFixture({ gaming: 10, router: true, ups: true }); runSimulationDays(longRun, 31); assert.strictEqual(longRun.gameState.getState().businessSimulation.dailyHistory.length, 30); assert.ok(longRun.gameState.getState().businessSimulation.activeCohorts.length < 100);
  const fs = require('fs'), path = require('path'); const sources = ['BusinessSimulationSystem.js', 'SeatAllocator.js', 'OperatingMetricsSystem.js'].map((file) => fs.readFileSync(path.join(__dirname, '../js/systems/' + file), 'utf8')).join('\n'); ['pathfinding', 'collision', 'NPC', '寻路', '碰撞'].forEach((term) => assert.strictEqual(sources.indexOf(term), -1));
}

function testFinanceLedger() {
  global.wx = createWx();
  const saveManager = new SaveManager(initialState);
  const state = saveManager.createNew();
  state.player.cash = 10000;
  state.employees = [{ id: 'emp_test', salary: 12000 }];
  const gameState = new GameState(state, new EventBus());
  const finance = new FinanceSystem(gameState, saveManager);

  const furniture = finance.recordExpense({ category: 'furniture_purchase', amount: 1000, sourceSystem: 'decoration', sourceId: 'chair', description: '购买测试家具', mutate: (next) => { next.furniture = []; } });
  assert.ok(furniture.ok);
  assert.strictEqual(gameState.getState().player.cash, 9000);
  assert.strictEqual(finance.getOperatingProfit(1, 1), 0);
  assert.strictEqual(finance.getNetCashFlow(1, 1), -1000);

  const refund = finance.recordIncome({ category: 'asset_sale_refund', amount: 500, sourceSystem: 'decoration', description: '出售测试家具' });
  assert.ok(refund.ok);
  assert.strictEqual(gameState.getState().player.cash, 9500);
  let summary = finance.getMonthlySummary(1, 1);
  assert.strictEqual(summary.operatingIncome, 0);
  assert.strictEqual(summary.nonOperatingIncome, 500);
  assert.strictEqual(summary.netCashFlow, -500);

  assert.ok(finance.recordIncome({ category: 'seat_income', amount: 2000, sourceSystem: 'test', description: '开发测试上机收入' }).ok);
  assert.ok(finance.recordExpense({ category: 'marketing', amount: 300, sourceSystem: 'test', description: '开发测试营销' }).ok);
  summary = finance.getMonthlySummary(1, 1);
  assert.strictEqual(summary.operatingIncome, 2000);
  assert.strictEqual(summary.operatingExpense, 300);
  assert.strictEqual(summary.operatingProfit, 1700);
  assert.strictEqual(summary.netCashFlow, 1200);
  assert.strictEqual(summary.daily[0].net, 1200);

  const beforePayroll = gameState.getState().player.cash;
  assert.ok(finance.settlePayroll(1, 1).ok);
  assert.strictEqual(gameState.getState().player.cash, beforePayroll - 12000);
  assert.ok(gameState.getState().player.cash < 0);
  const payrollCount = finance.getTransactions({ category: 'payroll' }).length;
  const duplicate = finance.settlePayroll(1, 1);
  assert.ok(!duplicate.ok && duplicate.duplicate);
  assert.strictEqual(finance.getTransactions({ category: 'payroll' }).length, payrollCount);
  assert.strictEqual(saveManager.load().finance.settledKeys.filter((key) => key === 'payroll_1_1').length, 1);

  const beforeFailed = gameState.getState().player.cash;
  const failed = finance.recordExpense({ category: 'equipment_purchase', amount: 99999, sourceSystem: 'device' });
  assert.ok(!failed.ok);
  assert.strictEqual(gameState.getState().player.cash, beforeFailed);

  const validation = finance.validateFinanceData({ player: { cash: 'bad' }, finance: { transactions: [
    { id: 'a', gameDate: { year: 1, month: 1, day: 1 }, direction: 'income', category: 'missing', amount: 10 },
    { id: 'a', gameDate: { year: 1, month: 1, day: 1 }, direction: 'income', category: 'seat_income', amount: 20 },
    { id: 'bad', gameDate: {}, direction: 'wrong', category: 'seat_income', amount: -5 }
  ], settledKeys: ['x', 'x'] } });
  assert.strictEqual(validation.cash, 0);
  assert.strictEqual(validation.finance.transactions.length, 1);
  assert.strictEqual(validation.finance.transactions[0].category, 'other_income');
  assert.deepStrictEqual(validation.finance.settledKeys, ['x']);

  const incomeFiltered = finance.getTransactions({ direction: 'income', year: 1, month: 1 });
  assert.ok(incomeFiltered.every((item) => item.direction === 'income'));
  assert.ok(finance.getIncomeBreakdown(1, 1).seat_income > 0);
  assert.ok(finance.getExpenseBreakdown(1, 1).payroll > 0);
}

function testFinanceCharts() {
  const renderer = new FinanceChartRenderer(); const context = createContext();
  const empty = Array.from({ length: 30 }, (_, index) => ({ day: index + 1, income: 0, expense: 0, net: 0 }));
  assert.deepStrictEqual(renderer.drawTrend(context, { x: 0, y: 0, width: 300, height: 120 }, empty, 'net'), []);
  empty[0] = { day: 1, income: 100, expense: 300, net: -200 };
  assert.strictEqual(renderer.drawTrend(context, { x: 0, y: 0, width: 300, height: 120 }, empty, 'net').length, 30);
  assert.deepStrictEqual(renderer.drawPie(context, { x: 0, y: 0, width: 200, height: 120 }, {}, {}, null), []);
  const slices = renderer.drawPie(context, { x: 0, y: 0, width: 200, height: 120 }, { a: 60, b: 40 }, { a: 'A', b: 'B' }, null);
  assert.strictEqual(slices.length, 2);
  assert.ok(renderer.hitPie({ x: slices[0].center.x, y: slices[0].center.y }, slices));
  assert.strictEqual(renderer.preparePie({ a: 6, b: 5, c: 4, d: 3, e: 2, f: 1 }).length, 6);
  assert.strictEqual(renderer.preparePie({ a: 6, b: 5, c: 4, d: 3, e: 2, f: 1 })[5].id, 'other');
}

function testDecorationFinanceBatch() {
  global.wx = createWx(); const saveManager = new SaveManager(initialState); const gameState = new GameState(saveManager.createNew(), new EventBus()); const finance = new FinanceSystem(gameState, saveManager);
  const start = finance.getCash();
  const result = finance.recordBatch([
    { direction: 'expense', category: 'furniture_purchase', amount: 1000, sourceSystem: 'decoration', sourceId: 'new_chair', description: '购买普通电脑椅' },
    { direction: 'income', category: 'asset_sale_refund', amount: 500, sourceSystem: 'decoration', sourceId: 'old_chair', description: '出售普通电脑椅' }
  ], (next) => { next.furniture = []; });
  assert.ok(result.ok); assert.strictEqual(finance.getCash(), start - 500); assert.strictEqual(result.transactions.length, 2);
  assert.strictEqual(finance.getTransactions({ category: 'furniture_purchase' }).length, 1); assert.strictEqual(finance.getTransactions({ category: 'asset_sale_refund' }).length, 1);
  const summary = finance.getMonthlySummary(1, 1); assert.strictEqual(summary.operatingProfit, 0); assert.strictEqual(summary.netCashFlow, -500);
}

function testMarketingRules() {
  global.wx = createWx();
  const saveManager = new SaveManager(initialState);
  const state = saveManager.createNew();
  state.cafe.overall = 80;
  state.cafe.capacity = 20;
  const gameState = new GameState(state, new EventBus());
  const system = new MarketingSystem(gameState, saveManager);

  const base = system.getSummary();
  assert.strictEqual(base.marketingScore, 0);
  assert.strictEqual(base.brandLevel, 1);
  assert.strictEqual(base.customerAttraction.rawMultiplier, 1);
  const beforeCash = gameState.getState().player.cash;
  assert.ok(system.launch('online_ads').ok);
  assert.strictEqual(gameState.getState().player.cash, beforeCash - 500);
  assert.strictEqual(gameState.getState().marketing.awareness, 2);
  assert.strictEqual(gameState.getState().marketing.totalSpent, 500);
  assert.strictEqual(gameState.getState().finance.transactions.slice(-1)[0].category, 'marketing');
  assert.strictEqual(system.getActiveCampaigns().length, 1);
  assert.ok(system.getCustomerAttraction().rawMultiplier > 1);
  assert.ok(system.getCustomerAttraction().effectiveMultiplier <= system.getCustomerAttraction().rawMultiplier);
  assert.ok(system.getCustomerAttraction().segments.students > 1);
  assert.ok(!system.launch('online_ads').ok);

  const saved = saveManager.load();
  assert.strictEqual(saved.marketing.activeCampaigns.length, 1);
  assert.strictEqual(saved.marketing.awareness, 2);

  const next = gameState.snapshot();
  next.time.day = 8;
  gameState.replace(next);
  assert.strictEqual(system.getActiveCampaigns().length, 0);
  assert.strictEqual(system.getCooldownDays('online_ads'), 3);
  assert.ok(!system.canLaunch('online_ads').ok);
  const later = gameState.snapshot();
  later.time.day = 11;
  gameState.replace(later);
  assert.strictEqual(system.getCooldownDays('online_ads'), 0);
  assert.ok(system.canLaunch('online_ads').ok);

  const weak = gameState.snapshot(); weak.cafe.overall = 10; weak.cafe.capacity = 0;
  assert.ok(system.getCapacityFactor(weak) < 0.5);
  assert.ok(system.getMarketingScore(weak) >= 0 && system.getMarketingScore(weak) <= 100);
}

function testEmployeeRules() {
  global.wx = createWx();
  const saveManager = new SaveManager(initialState);
  const gameState = new GameState(saveManager.createNew(), new EventBus());
  const sequence = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  let index = 0;
  const system = new EmployeeSystem(gameState, saveManager, () => sequence[index++ % sequence.length]);

  assert.strictEqual(system.getServiceScore(), 40);
  const market = system.ensureMarket(false);
  assert.ok(market.candidates.length >= 3 && market.candidates.length <= 5);
  assert.strictEqual(market.refreshTime, '1-1-1');
  const firstIds = market.candidates.map((item) => item.id).join(',');
  assert.strictEqual(system.ensureMarket(false).candidates.map((item) => item.id).join(','), firstIds);

  const candidate = gameState.getState().employeeMarket.candidates[0];
  const beforeCash = gameState.getState().player.cash;
  assert.ok(system.hire(candidate.id).ok);
  assert.strictEqual(gameState.getState().employees.length, 1);
  assert.strictEqual(gameState.getState().player.cash, beforeCash - candidate.salary);
  assert.strictEqual(gameState.getState().finance.transactions.slice(-1)[0].category, 'recruitment');
  assert.ok(system.getDailySalary() > 0);
  assert.ok(system.getServiceScore() !== 40);
  const salary = system.getMonthlySalary();
  const employeeId = gameState.getState().employees[0].id;
  system.processWorkDay();
  assert.strictEqual(gameState.getState().employees[0].experience, 5);

  const reloaded = saveManager.load();
  assert.strictEqual(reloaded.employees.length, 1);
  assert.strictEqual(reloaded.employees[0].id, employeeId);
  assert.ok(system.dismiss(employeeId).ok);
  assert.strictEqual(system.getMonthlySalary(), 0);
  assert.ok(salary > system.getMonthlySalary());

  const source = require('fs').readFileSync(require('path').join(__dirname, '../js/systems/EmployeeSystem.js'), 'utf8');
  ['pathfinding', 'collision', 'NPC', '寻路', '碰撞'].forEach((term) => assert.strictEqual(source.indexOf(term), -1));
}

function testDeviceRules() {
  global.wx = createWx();
  const saveManager = new SaveManager(initialState);
  const state = saveManager.normalize(Object.assign(clone(initialState), {
    furniture: [{ id: 'desk', type: 'standard_pc_desk', gridX: 0, gridY: 0, rotation: 0 }]
  }));
  const gameState = new GameState(state, new EventBus());
  const system = new DeviceSystem(gameState, saveManager);

  assert.ok(system.purchase('basic_pc').ok);
  assert.strictEqual(gameState.getState().player.cash, initialState.player.cash - 2500);
  assert.strictEqual(gameState.getState().finance.transactions.slice(-1)[0].category, 'equipment_purchase');
  const cashAfterPurchase = gameState.getState().player.cash;
  assert.ok(system.install('basic_pc').ok);
  assert.strictEqual(gameState.getState().player.cash, cashAfterPurchase);
  assert.strictEqual(system.getSummary(gameState.getState()).freeComputerSlots, 0);

  assert.ok(system.purchase('basic_pc').ok);
  assert.ok(!system.install('basic_pc').ok);
  assert.strictEqual(gameState.getState().devices.basic_pc.installed, 1);
  const owned = gameState.getState().devices.basic_pc.owned;
  assert.ok(system.uninstall('basic_pc').ok);
  assert.strictEqual(gameState.getState().devices.basic_pc.owned, owned);
  assert.strictEqual(gameState.getState().devices.basic_pc.installed, 0);

  const beforeUpgrade = gameState.getState().player.cash;
  assert.ok(system.upgrade('basic_pc').ok);
  assert.strictEqual(gameState.getState().player.cash, beforeUpgrade - 1500);
  assert.strictEqual(gameState.getState().devices.basic_pc.level, 2);
  assert.strictEqual(gameState.getState().finance.transactions.slice(-1)[0].category, 'equipment_upgrade');
  while (gameState.getState().devices.basic_pc.level < 5) assert.ok(system.upgrade('basic_pc').ok);
  assert.ok(!system.upgrade('basic_pc').ok);

  assert.ok(system.purchase('gigabit_router').ok);
  assert.ok(system.install('gigabit_router').ok);
  assert.strictEqual(gameState.getState().devices.gigabit_router.installed, 1);
  assert.ok(system.getSummary(gameState.getState()).equipmentScore > 0);
}

function testCamera() {
  const first = new Camera2D({ worldWidth: 800, worldHeight: 400, minZoom: 0.5, maxZoom: 2 });
  const second = new Camera2D({ worldWidth: 800, worldHeight: 400, minZoom: 0.5, maxZoom: 2 });
  first.setViewport({ x: 10, y: 20, width: 400, height: 200 });
  second.setViewport({ x: 10, y: 20, width: 400, height: 200 });
  first.setZoom(1, 210, 120);
  const secondX = second.cameraX;
  first.panByScreen(-10000, -10000);
  assert.strictEqual(first.cameraX, 400);
  assert.strictEqual(first.cameraY, 200);
  assert.strictEqual(second.cameraX, secondX);
  first.resetView(0);
  assert.ok(first.zoom >= first.minZoom && first.zoom <= first.maxZoom);
  const world = first.screenToWorld(110, 70);
  const screen = first.worldToScreen(world.x, world.y);
  assert.ok(Math.abs(screen.x - 110) < 0.001 && Math.abs(screen.y - 70) < 0.001);
}

function testRuntimeAtSize(width, height, pixelRatio) {
  global.wx = createWx({ width: width, height: height, pixelRatio: pixelRatio });
  const game = new Game();
  game.start();
  assert.strictEqual(game.canvas.width, Math.round(width * pixelRatio));
  assert.strictEqual(game.canvas.height, Math.round(height * pixelRatio));
  const overview = game.mainScene.scenes.overview;
  assert.ok(overview.mapBounds.width > overview.mapBounds.height);
  assert.notStrictEqual(overview.camera, game.decorationEditorScene.camera);
  const beforeFurniture = JSON.stringify(game.gameState.getState().furniture);
  const start = { clientX: overview.mapBounds.x + overview.mapBounds.width / 2, clientY: overview.mapBounds.y + overview.mapBounds.height / 2 };
  const beforeY = overview.camera.cameraY;
  const canPanVertically = overview.camera.worldHeight > overview.mapBounds.height / overview.camera.zoom;
  overview.onTouchStart({ touches: [start] });
  overview.onTouchMove({ touches: [{ clientX: start.clientX, clientY: start.clientY - 30 }] });
  if (canPanVertically) assert.notStrictEqual(overview.camera.cameraY, beforeY);
  else assert.strictEqual(overview.camera.cameraY, beforeY);
  assert.ok(overview.onTouchEnd());
  assert.strictEqual(JSON.stringify(game.gameState.getState().furniture), beforeFurniture);
  overview.resetView();

  const tabRegions = game.inputManager.regions.filter((item) => item.id.indexOf('tab:') === 0);
  assert.strictEqual(tabRegions.length, 6);
  tabRegions.forEach((item) => assert.ok(item.bounds.width >= 40 && item.bounds.height >= 40));
  game.mainScene.switchScene('device');
  assert.strictEqual(game.inputManager.gestureHandler, game.mainScene.scenes.device.gestureHandler);
  const actionRegions = game.inputManager.regions.filter((item) => item.id.indexOf('device:action:') === 0);
  actionRegions.forEach((item) => assert.ok(item.bounds.width >= 40 && item.bounds.height >= 40));
  game.mainScene.switchScene('marketing');
  const marketingRegions = game.inputManager.regions.filter((item) => item.id.indexOf('marketing:launch:') === 0);
  assert.ok(marketingRegions.length >= 2);
  marketingRegions.forEach((item) => assert.ok(item.bounds.height >= 30));
  game.mainScene.switchScene('finance');
  const financeTabs = game.inputManager.regions.filter((item) => item.id.indexOf('finance:tab:') === 0);
  assert.strictEqual(financeTabs.length, 3);
  for (let index = 0; index < 10; index += 1) game.mainScene.render();
  assert.strictEqual(game.inputManager.regions.filter((item) => item.id.indexOf('finance:tab:') === 0).length, 3);
  game.mainScene.switchScene('overview');
  assert.strictEqual(game.inputManager.gestureHandler, overview.gestureHandler);
  return overview.mapBounds.width * overview.mapBounds.height;
}


function testExpansion() {
  global.wx = createWx();
  const saveManager = new SaveManager(initialState);
  const raw = clone(initialState);
  raw.player.cash = 5000000;
  const data = saveManager.normalize(raw);
  const eventBus = new EventBus();
  const gameState = new GameState(data, eventBus);
  const expansion = new ExpansionSystem(gameState, saveManager);

  // 1. New game has default expansion data
  assert.strictEqual(expansion.getLevel(), 0);
  assert.strictEqual(expansion.getCurrentArea(), expansionConfig.baseArea);
  assert.strictEqual(expansion.getNextArea(), Math.round(expansionConfig.baseArea * (1 + expansionConfig.expansionRate)));
  assert.strictEqual(expansion.getExpansionCost(), 20000);

  // 2. First expansion: 10000 → 13000
  let result = expansion.expand();
  assert.ok(result.ok, 'First expansion should succeed');
  assert.strictEqual(result.beforeArea, 10000);
  assert.strictEqual(result.afterArea, 13000);
  assert.strictEqual(result.level, 1);
  assert.strictEqual(gameState.getState().expansion.level, 1);
  assert.strictEqual(gameState.getState().expansion.currentArea, 13000);
  assert.strictEqual(gameState.getState().expansion.history.length, 1);
  gameState.getState().player.cash = 5000000;

  // 3. Second: 13000 → 16900
  result = expansion.expand();
  assert.ok(result.ok, 'Second expansion should succeed');
  assert.strictEqual(result.beforeArea, 13000);
  assert.strictEqual(result.afterArea, 16900);
  assert.strictEqual(result.level, 2);
  gameState.getState().player.cash = 5000000;

  // 4. Costs: 20000, 30000, 40000 (test separately)
  let costTestData = clone(initialState);
  costTestData.player.cash = 5000000;
  let costState = new GameState(saveManager.normalize(costTestData), new EventBus());
  let costExpansion = new ExpansionSystem(costState, saveManager);
  assert.strictEqual(costExpansion.getExpansionCost(), 20000);
  costExpansion.expand();
  costState.getState().player.cash = 5000000;
  assert.strictEqual(costExpansion.getExpansionCost(), 30000);
  costExpansion.expand();
  costState.getState().player.cash = 5000000;
  assert.strictEqual(costExpansion.getExpansionCost(), 40000);

  // 5. Can't expand without cash
  let poorData = clone(initialState);
  poorData.player.cash = 1000;
  let poorState = new GameState(saveManager.normalize(poorData), new EventBus());
  let poorExpansion = new ExpansionSystem(poorState, saveManager);
  assert.ok(!poorExpansion.canExpand(), 'Should not be able to expand with insufficient cash');
  let poorResult = poorExpansion.expand();
  assert.ok(!poorResult.ok, 'Expansion should fail with insufficient cash');
  assert.strictEqual(poorResult.reason, '资金不足，无法扩建。');

  // 6. Successful expansion creates finance expansion record
  assert.ok(gameState.getState().finance.transactions.some(
    t => t.category === 'expansion' && t.sourceSystem === 'expansion'
  ), 'Finance should have expansion transaction');

  // 7. Re-enter game preserves data
  saveManager.save(gameState.getState());
  let reloaded = saveManager.load();
  assert.strictEqual(reloaded.expansion.level, 2);
  assert.strictEqual(reloaded.expansion.currentArea, 16900);
  global.wx = createWx();

  // 8. Old save loads correctly (no expansion field)
  let oldData = clone(initialState);
  delete oldData.expansion;
  oldData.saveVersion = 6;
  global.wx = createWx({ storage: oldData });
  let oldManager = new SaveManager(initialState);
  let migrated = oldManager.load();
  assert.strictEqual(migrated.saveVersion, 8);
  assert.ok(migrated.expansion, 'Old save should get expansion field');
  assert.strictEqual(migrated.expansion.level, 0);
  assert.strictEqual(migrated.expansion.currentArea, expansionConfig.baseArea);

  // 9 & 10 & 11: Verify no side effects on unrelated systems
  let cleanData = clone(initialState);
  cleanData.player.cash = 5000000;
  let cleanManager = new SaveManager(initialState);
  let cleanNormalized = cleanManager.normalize(cleanData);
  let cleanState = new GameState(cleanNormalized, new EventBus());
  let cleanExpansion = new ExpansionSystem(cleanState, cleanManager);
  let beforeFurniture = JSON.stringify(cleanState.getState().furniture);
  let beforeDevices = JSON.stringify(cleanState.getState().devices);
  let beforeEmployees = JSON.stringify(cleanState.getState().employees);
  cleanState.getState().player.cash = 5000000;
  cleanExpansion.expand();
  assert.strictEqual(JSON.stringify(cleanState.getState().furniture), beforeFurniture, 'Furniture should not change');
  assert.strictEqual(JSON.stringify(cleanState.getState().devices), beforeDevices, 'Devices should not change');
  assert.strictEqual(JSON.stringify(cleanState.getState().employees), beforeEmployees, 'Employees should not change');

  // Metrics & capacity
  let metrics = cleanExpansion.getMetrics();
  assert.ok(metrics.level >= 0);
  assert.ok(metrics.currentArea > 0);
  assert.ok(metrics.nextArea > metrics.currentArea);
  assert.ok(metrics.cost > 0);
  let capacity = cleanExpansion.getBuildCapacity();
  assert.ok(capacity.area > 0);
  assert.ok(capacity.buildableTiles > 0);
  let dims = cleanExpansion.getMapDimensions();
  assert.ok(dims.columns > 0);
  assert.ok(dims.rows > 0);
  assert.ok(dims.worldWidth > 0);
  assert.ok(dims.worldHeight > 0);
}


function testExpansionMapLinkage() {
  // Setup
  global.wx = createWx();
  const saveManager = new SaveManager(initialState);
  const raw = clone(initialState);
  raw.player.cash = 5000000;
  const data = saveManager.normalize(raw);
  const eventBus = new EventBus();
  const gameState = new GameState(data, eventBus);
  const expansionSystem = new ExpansionSystem(gameState, saveManager);
  const mapSystem = new MapSystem(expansionSystem, 40);
  const gridMap = new GridMap(mapSystem.getColumns(), mapSystem.getRows());

  // 1. Initial map size is correct
  let worldSize = mapSystem.getWorldSize();
  assert.ok(worldSize.width > 0, 'World width should be positive');
  assert.ok(worldSize.height > 0, 'World height should be positive');
  let bounds = mapSystem.getBounds();
  assert.strictEqual(bounds.minX, 0);
  assert.strictEqual(bounds.minY, 0);
  assert.ok(bounds.maxX > 0);
  assert.ok(bounds.maxY > 0);

  // 2. After expansion, map size increases
  let mapExpandedFired = false;
  let eventPayload = null;
  eventBus.on('mapExpanded', (payload) => {
    mapExpandedFired = true;
    eventPayload = payload;
  });

  gameState.getState().player.cash = 5000000;
  const result = expansionSystem.expand();
  assert.ok(result.ok, 'Expansion should succeed');
  assert.ok(mapExpandedFired, 'mapExpanded event should fire');
  assert.ok(eventPayload, 'Event payload should exist');
  assert.ok(eventPayload.dimensions, 'Event should include dimensions');
  assert.ok(eventPayload.dimensions.columns > 0);
  assert.ok(eventPayload.dimensions.rows > 0);

  // 3. MapSystem reflects expanded size
  worldSize = mapSystem.getWorldSize();
  assert.ok(worldSize.width > 480, 'World width should increase after expansion');
  assert.ok(worldSize.height > 320, 'World height should increase after expansion');

  // 4. GridMap can be updated from MapSystem
  const newColumns = mapSystem.getColumns();
  const newRows = mapSystem.getRows();
  assert.ok(newColumns >= 12, 'Columns should increase or stay at minimum');
  gridMap.columns = newColumns;
  gridMap.rows = newRows;
  assert.ok(gridMap.isInside(0, 0, 1, 1), 'Grid should still be valid');
  assert.ok(!gridMap.isInside(newColumns, 0, 1, 1), 'Should not place outside new bounds');

  // 5. Camera bounds work with new dimensions
  const Camera2D = require('../js/map/Camera2D');
  const camera = new Camera2D({ worldWidth: worldSize.width, worldHeight: worldSize.height });
  camera.setViewport({ x: 0, y: 0, width: 400, height: 300 });
  
  // Camera should stay within bounds
  camera.cameraX = -100;
  camera.clamp();
  assert.ok(camera.cameraX >= 0, 'Camera X should be clamped to min 0');
  
  camera.cameraX = worldSize.width + 1000;
  camera.clamp();
  assert.ok(camera.cameraX <= worldSize.width, 'Camera X should be clamped to max');

  camera.cameraY = -100;
  camera.clamp();
  assert.ok(camera.cameraY >= 0, 'Camera Y should be clamped to min 0');

  camera.cameraY = worldSize.height + 1000;
  camera.clamp();
  assert.ok(camera.cameraY <= worldSize.height, 'Camera Y should be clamped to max');

  // 6. Multiple expansions continue to increase size
  gameState.getState().player.cash = 5000000;
  const beforeMulti = mapSystem.getWorldSize();
  expansionSystem.expand();
  gameState.getState().player.cash = 5000000;
  expansionSystem.expand();
  const afterMulti = mapSystem.getWorldSize();
  assert.ok(afterMulti.width > beforeMulti.width, 'Multiple expansions increase world width');
  assert.ok(afterMulti.height > beforeMulti.height, 'Multiple expansions increase world height');

  // 7. Save and verify expansion data persists
  saveManager.save(gameState.getState());
  const reloaded = saveManager.load();
  assert.ok(reloaded.expansion, 'Expansion data should exist after reload');
  assert.strictEqual(reloaded.expansion.level, 3, 'Expansion level should persist');
  assert.strictEqual(reloaded.expansion.currentArea, 21970, 'Expansion area should persist');

  // 8. MapSystem with null expansionSystem returns defaults
  const defaultMap = new MapSystem(null, 40);
  const defaultSize = defaultMap.getWorldSize();
  assert.ok(defaultSize.width > 0);
  assert.ok(defaultSize.height > 0);
  const defaultBounds = defaultMap.getBounds();
  assert.strictEqual(defaultBounds.minX, 0);
  assert.strictEqual(defaultBounds.minY, 0);
}


function testDebugSaveReset() {
  global.wx = createWx();
  const saveManager = new SaveManager(initialState);
  const eventBus = new EventBus();
  
  // 1. Create initial save with non-default cash
  let data = saveManager.load();
  data.player.cash = 99999;
  saveManager.save(data);
  
  // 2. Reload and verify custom cash
  let gameState = new GameState(saveManager.load(), eventBus);
  assert.strictEqual(gameState.getState().player.cash, 99999);
  
  // 3. Reset save via createNew
  saveManager.createNew();
  gameState.replace(saveManager.load());
  
  // 4. Verify reset to default cash
  assert.strictEqual(gameState.getState().player.cash, initialState.player.cash);
  assert.strictEqual(gameState.getState().expansion.level, 0);
  assert.strictEqual(gameState.getState().expansion.currentArea, 10000);
  assert.deepStrictEqual(gameState.getState().expansion.history, []);
  assert.strictEqual(gameState.getState().saveVersion, 8);
}

function run() {
  testMigrationAndRecovery();
  testExpansion();
  testExpansionMapLinkage();
  testDebugSaveReset();
  testDeviceRules();
  testEmployeeRules();
  testMarketingRules();
  testFinanceLedger();
  testFinanceCharts();
  testDecorationFinanceBatch();
  testBusinessSimulation();
  testCamera();
  const area = testRuntimeAtSize(844, 390, 3);
  testRuntimeAtSize(667, 375, 2);
  testRuntimeAtSize(932, 430, 3);
  testRuntimeAtSize(568, 320, 2);
  const oldArea = (740 - Math.max(125, Math.min(175, 740 * 0.23)) - 30) * (324 - 29 - 54 - 20);
  assert.ok(area / oldArea >= 1.25, '844×390 地图面积提升不足 25%');
  console.log('All tests passed. 844×390 map area increase: ' + Math.round((area / oldArea - 1) * 100) + '%');
}

run();
