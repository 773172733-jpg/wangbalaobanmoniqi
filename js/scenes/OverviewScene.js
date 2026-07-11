'use strict';

const DecorationRenderer = require('../map/DecorationRenderer');
const GridMap = require('../map/GridMap');
const Camera2D = require('../map/Camera2D');
const DeviceSystem = require('../systems/DeviceSystem');
const OperatingMetricsSystem = require('../systems/OperatingMetricsSystem');
const CanvasUtils = require('../ui/CanvasUtils');
const BusinessDebugPanel = require('../ui/BusinessDebugPanel');
const operatingConfig = require('../data/operatingConfig');
const ExpansionSystem = require('../systems/ExpansionSystem');
const MapSystem = require('../map/MapSystem');
const MapBoundsManager = require('../map/MapBoundsManager');
const WorldGridSystem = require('../map/WorldGridSystem');

function rect(x, y, width, height) { return { x: x, y: y, width: width, height: height }; }
function inside(point, box) { return point && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height; }
function distance(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

class OverviewScene {
  constructor(dependencies) {
    const deps = dependencies || {};
    this.title = '经营概览';
    this.assetManager = deps.assetManager || deps;
    this.inputManager = deps.inputManager || null;
    this.requestRender = deps.requestRender || function () {};
    this.expansionSystem = new ExpansionSystem(deps.gameState, deps.saveManager);
    this.cellSize = 54;
    this.worldGrid = new WorldGridSystem(this.expansionSystem, this.cellSize);
    this.gridMap = new GridMap(this.worldGrid.columns, this.worldGrid.rows);
    this.decorationRenderer = new DecorationRenderer(this.assetManager, this.gridMap);
    this.deviceSystem = new DeviceSystem();
    this.operatingMetricsSystem = new OperatingMetricsSystem();
    this.gameState = deps.gameState || null;
    const enableDebug = operatingConfig.DEBUG_BUSINESS_SIMULATION;
    this.debugPanel = enableDebug && deps.businessSimulation ? new BusinessDebugPanel(deps.businessSimulation, this.inputManager, this.requestRender) : null;
    this.camera = new Camera2D({
      worldWidth: this.worldGrid.getWorldSize().width,
      worldHeight: this.worldGrid.getWorldSize().height,
      minZoom: 0.66,
      maxZoom: 1.25
    });
    const camBoundsOv = this.worldGrid.getCameraBounds();
    this.camera.setViewPadding(camBoundsOv.paddingX, camBoundsOv.paddingY);
    this.mapBounds = rect(0, 0, 1, 1);
    this.resetHitBox = rect(0, 0, 1, 1);
    this.gesture = null;
    this.hasLayout = false;
    this.showPanHint = true;
    this.cachedState = null;
    this.cachedSummary = null;
    this.gestureHandler = {
      onTouchStart: this.onTouchStart.bind(this),
      onTouchMove: this.onTouchMove.bind(this),
      onTouchEnd: this.onTouchEnd.bind(this),
      onTouchCancel: this.onTouchCancel.bind(this)
    };
  }

  enter() {
    this.gesture = null;
    if (this.inputManager) this.inputManager.setGestureHandler(this.gestureHandler);
    const floorKey = 'floor_concrete_old';
    if (this.assetManager && !this.assetManager.hasImage(floorKey)) {
      this.assetManager.loadImage(floorKey, 'assets/textures/floor/floor_concrete_old_01.png', () => this.requestRender());
    }
    // 预加载电脑变体贴图
    var pcKeys = ['pc_color_01', 'pc_color_02', 'pc_color_03'];
    pcKeys.forEach(function(key) {
      if (this.assetManager && !this.assetManager.hasImage(key)) {
        this.assetManager.loadImage(key, 'assets/textures/furniture/' + key + '.png', function() { this.requestRender(); }.bind(this));
      }
    }.bind(this));
    const wallKeys = ['wall_horizontal', 'wall_vertical', 'wall_corner'];
    const wallPaths = {
      wall_horizontal: 'assets/textures/wall/wall_horizontal_01.png',
      wall_vertical: 'assets/textures/wall/wall_vertical_01.png',
      wall_corner: 'assets/textures/wall/wall_corner_L_01.png'
    };
    wallKeys.forEach((key) => {
      if (this.assetManager && !this.assetManager.hasImage(key)) {
        this.assetManager.loadImage(key, wallPaths[key], () => this.requestRender());
      }
    });
    var barKeyOv = 'bar_counter';
    if (this.assetManager && !this.assetManager.hasImage(barKeyOv)) {
      this.assetManager.loadImage(barKeyOv, 'assets/textures/furniture/bar_counter_01.png', () => this.requestRender());
    }
    this.worldGrid.init();
    this.gridMap.columns = this.worldGrid.columns;
    this.gridMap.rows = this.worldGrid.rows;
    var syncSize = this.worldGrid.getWorldSize();
    this.camera.setWorldSize(syncSize.width, syncSize.height);
    var syncCamBounds = this.worldGrid.getCameraBounds();
    this.camera.setViewPadding(syncCamBounds.paddingX, syncCamBounds.paddingY);
    this.hasLayout = false;
    if (this.gameState && this.gameState.eventBus) {
      if (this._unsubMapExpanded) this._unsubMapExpanded();
      this._unsubMapExpanded = this.gameState.eventBus.on('mapExpanded', () => {
        this.worldGrid.expand();
        this.gridMap.columns = this.worldGrid.columns;
        this.gridMap.rows = this.worldGrid.rows;
        const size = this.worldGrid.getWorldSize();
        this.camera.setWorldSize(size.width, size.height);
        var camBoundsOv2 = this.worldGrid.getCameraBounds();
        this.camera.setViewPadding(camBoundsOv2.paddingX, camBoundsOv2.paddingY);
        this.hasLayout = false;
        this.requestRender();
      });
    }
  }

  leave() {
    if (this.inputManager) this.inputManager.clearGestureHandler(this.gestureHandler);
    this.gesture = null;
  }

  point(touch) { return touch ? { x: touch.clientX, y: touch.clientY } : null; }

  onTouchStart(event) {
    const touches = event.touches || [];
    if (touches.length !== 1) { this.gesture = null; return; }
    const point = this.point(touches[0]);
    if (!inside(point, this.mapBounds) || inside(point, this.resetHitBox)) return;
    this.gesture = { start: point, last: point, moved: false };
  }

  onTouchMove(event) {
    if (!this.gesture || !event.touches || event.touches.length !== 1) return;
    const point = this.point(event.touches[0]);
    if (!point) return;
    if (distance(point, this.gesture.start) > 8) this.gesture.moved = true;
    if (this.gesture.moved) {
      this.camera.panByScreen(point.x - this.gesture.last.x, point.y - this.gesture.last.y);
      this.showPanHint = false;
      this.requestRender();
    }
    this.gesture.last = point;
  }

  onTouchEnd() {
    if (!this.gesture) return false;
    const moved = this.gesture.moved;
    this.gesture = null;
    return moved;
  }

  onTouchCancel() { this.gesture = null; }

  resetView() {
    this.camera.resetView(8);
    this.showPanHint = false;
    this.requestRender();
  }

  getSummary(state) {
    if (this.cachedState !== state) {
      this.cachedState = state;
      this.cachedSummary = this.deviceSystem.getSummary(state);
    }
    return this.cachedSummary;
  }

  getOperatingMetrics(state) {
    if (this.cachedOperatingState !== state) { this.cachedOperatingState = state; this.cachedOperatingMetrics = this.operatingMetricsSystem.getMetrics(state); }
    return this.cachedOperatingMetrics;
  }

  drawSectionTitle(context, x, y) {
    context.fillStyle = '#f0c15b';
    context.fillRect(x, y + 3, 3, 15);
    context.fillStyle = '#f5f0df';
    context.font = 'bold 13px sans-serif';
    context.textAlign = 'left';
    context.fillText('老板视角', x + 9, y + 16);
    context.fillStyle = '#718897';
    context.font = '9px sans-serif';
    context.fillText('只读网吧预览', x + 78, y + 15);
  }

  drawDailyPanel(context, bounds, state) {
    const cafe = state.cafe;
    const business = state.businessSimulation;
    const today = business.today;
    CanvasUtils.fillRoundedRect(context, bounds, 5, '#0d2232');
    CanvasUtils.strokeRoundedRect(context, bounds, 5, '#344a57', 1);
    context.fillStyle = '#f0c15b'; context.font = 'bold 12px sans-serif'; context.textAlign = 'left';
    context.fillText('今日数据', bounds.x + 10, bounds.y + 18);
    const averageSatisfaction = today.satisfactionWeight ? Math.round(today.satisfactionTotal / today.satisfactionWeight) : cafe.satisfaction;
    const rows = [
      ['上机收入', '¥' + today.seatIncome.toLocaleString(), '#f2c45e'], ['商品收入', '¥' + today.productIncome.toLocaleString(), '#65bfa0'],
      ['潜在顾客', today.potentialCustomers + '人', '#dfe7e9'], ['实际到店', today.admittedCustomers + '人', '#65bfa0'],
      ['流失顾客', today.lostCustomers + '人', '#e78555'], ['平均满意', averageSatisfaction + '分', '#f2c45e']
    ];
    const chartHeight = 48;
    const listTop = bounds.y + 26;
    const rowHeight = Math.max(17, (bounds.height - 31 - chartHeight) / rows.length);
    rows.forEach((row, index) => {
      const y = listTop + index * rowHeight + 11;
      context.fillStyle = '#8195a2'; context.font = '9px sans-serif'; context.textAlign = 'left'; context.fillText(row[0], bounds.x + 10, y);
      context.fillStyle = row[2]; context.font = 'bold 9px sans-serif'; context.textAlign = 'right'; context.fillText(row[1], bounds.x + bounds.width - 10, y);
    });
    const chartY = bounds.y + bounds.height - chartHeight;
    context.fillStyle = '#718897'; context.font = '8px sans-serif'; context.textAlign = 'left'; context.fillText('最近7日真实营收', bounds.x + 10, chartY + 10);
    const history = business.dailyHistory.slice(-7); const revenues = history.map((item) => item.totalRevenue || 0); const maxRevenue = Math.max(1, ...revenues);
    const values = Array(Math.max(0, 7 - revenues.length)).fill(0).concat(revenues.map((value) => value / maxRevenue));
    context.strokeStyle = '#e9c34f'; context.lineWidth = 2; context.beginPath();
    values.forEach((value, index) => {
      const x = bounds.x + 10 + index * (bounds.width - 20) / (values.length - 1);
      const y = bounds.y + bounds.height - 5 - value * 27;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
  }

  drawMetricCards(context, bounds, state, summary) {
    const cafe = state.cafe;
    const business = state.businessSimulation; const today = business.today; const metrics = this.getOperatingMetrics(state); const current = Number(cafe.currentCustomers) || 0; const capacity = metrics.equipment.installedComputerCount; const powerShort = metrics.equipment.powerCapacity < metrics.equipment.currentPowerDemand + current * 0.65; const networkSeats = Math.floor(metrics.equipment.networkCapacity);
    const cards = [
      ['正在上机', current + ' / ' + capacity, '#4e8fc1'], ['上座率', cafe.occupancyRate + '%', '#4e8fc1'],
      ['今日顾客', today.admittedCustomers + '人', '#6cad78'], ['今日流失', today.lostCustomers + '人', '#dd8452'],
      ['网络状态', networkSeats >= current ? '正常' : '拥堵', networkSeats >= current ? '#69aa75' : '#cf7654'],
      ['供电状态', powerShort ? '不足' : '正常', powerShort ? '#cf7654' : '#69aa75'], ['服务压力', current <= metrics.employee.serviceCapacity ? '正常' : '过载', current <= metrics.employee.serviceCapacity ? '#69aa75' : '#cf7654']
    ];
    const gap = 4;
    const cardWidth = (bounds.width - gap * (cards.length - 1)) / cards.length;
    cards.forEach((card, index) => {
      const box = rect(bounds.x + index * (cardWidth + gap), bounds.y, cardWidth, bounds.height);
      CanvasUtils.fillRoundedRect(context, box, 4, '#102737'); CanvasUtils.strokeRoundedRect(context, box, 4, index < 5 ? '#294354' : '#5b4929', 1);
      context.fillStyle = card[2]; context.fillRect(box.x, box.y, 3, box.height);
      context.fillStyle = '#8296a3'; context.font = '8px sans-serif'; context.textAlign = 'left'; context.fillText(card[0], box.x + 8, box.y + 14);
      context.fillStyle = '#f4f0df'; context.font = 'bold 11px sans-serif'; context.fillText(card[1], box.x + 8, box.y + 31);
    });
  }

  drawResetButton(context) {
    const visual = rect(this.resetHitBox.x + 4, this.resetHitBox.y + 4, this.resetHitBox.width - 8, this.resetHitBox.height - 8);
    CanvasUtils.fillRoundedRect(context, visual, 4, 'rgba(10,29,43,0.92)'); CanvasUtils.strokeRoundedRect(context, visual, 4, '#c99b3f', 1);
    context.fillStyle = '#f3d47d'; context.font = 'bold 9px sans-serif'; context.textAlign = 'center'; context.fillText('复位', visual.x + visual.width / 2, visual.y + visual.height / 2 + 3);
    this.inputManager.register('overview:reset', this.resetHitBox, () => this.resetView());
  }

  render(context, bounds, state) {
    const padding = Math.max(4, Math.min(5, bounds.width * 0.006));
    const titleHeight = 24;
    const metricsHeight = Math.max(44, Math.min(48, bounds.height * 0.145));
    const bodyY = bounds.y + titleHeight;
    const bodyHeight = Math.max(1, bounds.height - titleHeight - metricsHeight - padding * 2);
    const sideWidth = Math.max(118, Math.min(136, bounds.width * 0.165));
    const mapWidth = Math.max(1, bounds.width - sideWidth - padding * 3);
    const nextMapBounds = rect(bounds.x + padding, bodyY, mapWidth, bodyHeight);
    const sizeChanged = nextMapBounds.x !== this.mapBounds.x || nextMapBounds.y !== this.mapBounds.y || nextMapBounds.width !== this.mapBounds.width || nextMapBounds.height !== this.mapBounds.height;
    this.mapBounds = nextMapBounds;
    const wsOv = this.worldGrid.getWorldSize();
    this.camera.setWorldSize(wsOv.width, wsOv.height);
    this.camera.setViewport(this.mapBounds);
    if (!this.hasLayout) { this.camera.fitToView(8); this.hasLayout = true; }

    const summary = this.getSummary(state);
    this.drawSectionTitle(context, bounds.x + padding, bounds.y + 1);
    CanvasUtils.fillRoundedRect(context, this.mapBounds, 5, '#172a31'); CanvasUtils.strokeRoundedRect(context, this.mapBounds, 5, '#8d682e', 1);
    context.save(); context.imageSmoothingEnabled = false;
    this.decorationRenderer.drawViewport(context, this.camera, state.furniture, { cellSize: this.cellSize, showGrid: false, walls: this.worldGrid.getWalls() });
    context.restore();
    CanvasUtils.strokeRoundedRect(context, this.mapBounds, 5, '#8d682e', 1);
    this.resetHitBox = rect(this.mapBounds.x + this.mapBounds.width - 44, this.mapBounds.y + 4, 40, 40);
    this.drawResetButton(context);
    const usage = state.cafe.currentCustomers || 0;
    if (usage > 0) { const status = rect(this.mapBounds.x + 8, this.mapBounds.y + 7, 88, 20); CanvasUtils.fillRoundedRect(context, status, 4, 'rgba(8,35,45,0.9)'); context.fillStyle = '#65d1ae'; context.font = 'bold 9px sans-serif'; context.textAlign = 'center'; context.fillText('● 使用中 ' + usage + ' 台', status.x + status.width / 2, status.y + 14); }
    if (this.showPanHint) {
      const hint = rect(this.mapBounds.x + 10, this.mapBounds.y + this.mapBounds.height - 28, 132, 21);
      CanvasUtils.fillRoundedRect(context, hint, 4, 'rgba(6,20,30,0.78)');
      context.fillStyle = '#d5dfdf'; context.font = '9px sans-serif'; context.textAlign = 'center'; context.fillText('拖动查看网吧其他区域', hint.x + hint.width / 2, hint.y + 14);
    }
    this.drawDailyPanel(context, rect(bounds.x + padding * 2 + mapWidth, bodyY, sideWidth, bodyHeight), state);
    const settingsReserveWidth = 54;
    const metricsWidth = Math.max(1, bounds.width - padding * 2 - settingsReserveWidth);
    this.drawMetricCards(context, rect(bounds.x + padding, bodyY + bodyHeight + padding, metricsWidth, metricsHeight), state, summary);
    if (this.debugPanel) this.debugPanel.draw(context, rect(this.mapBounds.x + 8, this.mapBounds.y + 30, 178, 93));
  }
}

module.exports = OverviewScene;
