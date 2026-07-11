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
  assert.strictEqual(loaded.saveVersion, 4);
  assert.strictEqual(loaded.player.cash, 43210);
  assert.strictEqual(loaded.player.level, 4);
  assert.strictEqual(loaded.furniture.length, 1);
  assert.strictEqual(loaded.devices.basic_pc.owned, 2);
  assert.strictEqual(loaded.devices.basic_pc.installed, 1);
  assert.strictEqual(loaded.devices.basic_pc.level, 5);
  assert.strictEqual(loaded.devices.basic_pc.condition, 0);
  assert.deepStrictEqual(loaded.employees, []);
  assert.ok(Array.isArray(loaded.employeeMarket.candidates));

  global.wx = createWx({ storage: '{broken-json' });
  const recovered = new SaveManager(initialState).load();
  assert.strictEqual(recovered.saveVersion, 4);
  assert.strictEqual(recovered.player.cash, 50000);
  assert.ok(recovered.devices.basic_pc);
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
  assert.strictEqual(gameState.getState().player.cash, 47500);
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
  game.mainScene.switchScene('overview');
  assert.strictEqual(game.inputManager.gestureHandler, overview.gestureHandler);
  return overview.mapBounds.width * overview.mapBounds.height;
}

function run() {
  testMigrationAndRecovery();
  testDeviceRules();
  testEmployeeRules();
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
