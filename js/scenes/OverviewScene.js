'use strict';

const DecorationRenderer = require('../map/DecorationRenderer');
const GridMap = require('../map/GridMap');
const Camera2D = require('../map/Camera2D');
const DeviceSystem = require('../systems/DeviceSystem');
const CanvasUtils = require('../ui/CanvasUtils');

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
    this.gridMap = new GridMap();
    this.cellSize = 54;
    this.decorationRenderer = new DecorationRenderer(this.assetManager, this.gridMap);
    this.deviceSystem = new DeviceSystem();
    this.camera = new Camera2D({
      worldWidth: this.gridMap.columns * this.cellSize,
      worldHeight: this.gridMap.rows * this.cellSize,
      minZoom: 0.66,
      maxZoom: 1.25
    });
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
    CanvasUtils.fillRoundedRect(context, bounds, 5, '#0d2232');
    CanvasUtils.strokeRoundedRect(context, bounds, 5, '#344a57', 1);
    context.fillStyle = '#f0c15b'; context.font = 'bold 12px sans-serif'; context.textAlign = 'left';
    context.fillText('今日数据', bounds.x + 10, bounds.y + 18);
    const rows = [
      ['营业收入', '¥' + cafe.todayIncome.toLocaleString(), '#f2c45e'], ['会员收入', '¥0', '#dfe7e9'],
      ['商品收入', '¥0', '#dfe7e9'], ['电费', '-¥0', '#e78555'], ['维护费', '-¥0', '#e78555'],
      ['净利润', '¥' + cafe.todayIncome.toLocaleString(), '#f2c45e']
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
    context.fillStyle = '#718897'; context.font = '8px sans-serif'; context.textAlign = 'left'; context.fillText('收入趋势', bounds.x + 10, chartY + 10);
    const values = [0.18, 0.45, 0.37, 0.66, 0.42, 0.54, 0.78];
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
    const cards = [
      ['上座率', cafe.occupancyRate + '%', '#4e8fc1'], ['环境', cafe.environment + '分', '#6cad78'],
      ['设备', summary.equipmentScore + '分', '#dd8452'], ['服务', cafe.service + '分', '#b78bc1'],
      ['卫生', cafe.hygiene + '分', '#7fae65'], ['月收入', '¥' + cafe.monthlyIncome.toLocaleString(), '#d9a941'],
      ['月支出', '¥' + cafe.monthlyExpense.toLocaleString(), '#cf7654'], ['月利润', '¥' + cafe.monthlyProfit.toLocaleString(), '#69aa75']
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
    const padding = Math.max(5, Math.min(6, bounds.width * 0.008));
    const titleHeight = 24;
    const metricsHeight = Math.max(44, Math.min(48, bounds.height * 0.145));
    const bodyY = bounds.y + titleHeight;
    const bodyHeight = Math.max(1, bounds.height - titleHeight - metricsHeight - padding * 2);
    const sideWidth = Math.max(135, Math.min(150, bounds.width * 0.19));
    const mapWidth = Math.max(1, bounds.width - sideWidth - padding * 3);
    const nextMapBounds = rect(bounds.x + padding, bodyY, mapWidth, bodyHeight);
    const sizeChanged = nextMapBounds.x !== this.mapBounds.x || nextMapBounds.y !== this.mapBounds.y || nextMapBounds.width !== this.mapBounds.width || nextMapBounds.height !== this.mapBounds.height;
    this.mapBounds = nextMapBounds;
    this.camera.setWorldSize(this.gridMap.columns * this.cellSize, this.gridMap.rows * this.cellSize);
    this.camera.setViewport(this.mapBounds);
    if (!this.hasLayout || sizeChanged) { this.camera.fitToView(8); this.hasLayout = true; }

    const summary = this.getSummary(state);
    this.drawSectionTitle(context, bounds.x + padding, bounds.y + 1);
    CanvasUtils.fillRoundedRect(context, this.mapBounds, 5, '#172a31'); CanvasUtils.strokeRoundedRect(context, this.mapBounds, 5, '#8d682e', 1);
    context.save(); context.imageSmoothingEnabled = false;
    this.decorationRenderer.drawViewport(context, this.camera, state.furniture, { cellSize: this.cellSize, showGrid: false });
    context.restore();
    CanvasUtils.strokeRoundedRect(context, this.mapBounds, 5, '#8d682e', 1);
    this.resetHitBox = rect(this.mapBounds.x + this.mapBounds.width - 44, this.mapBounds.y + 4, 40, 40);
    this.drawResetButton(context);
    if (this.showPanHint) {
      const hint = rect(this.mapBounds.x + 10, this.mapBounds.y + this.mapBounds.height - 28, 132, 21);
      CanvasUtils.fillRoundedRect(context, hint, 4, 'rgba(6,20,30,0.78)');
      context.fillStyle = '#d5dfdf'; context.font = '9px sans-serif'; context.textAlign = 'center'; context.fillText('拖动查看网吧其他区域', hint.x + hint.width / 2, hint.y + 14);
    }
    this.drawDailyPanel(context, rect(bounds.x + padding * 2 + mapWidth, bodyY, sideWidth, bodyHeight), state);
    this.drawMetricCards(context, rect(bounds.x + padding, bodyY + bodyHeight + padding, bounds.width - padding * 2, metricsHeight), state, summary);
  }
}

module.exports = OverviewScene;
