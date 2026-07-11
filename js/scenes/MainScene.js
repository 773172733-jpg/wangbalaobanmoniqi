'use strict';

const UIManager = require('../ui/UIManager');
const TopBar = require('../ui/TopBar');
const BottomTabBar = require('../ui/BottomTabBar');
const OverviewScene = require('./OverviewScene');
const DeviceScene = require('./DeviceScene');
const EmployeeScene = require('./EmployeeScene');
const MarketingScene = require('./MarketingScene');
const FinanceScene = require('./FinanceScene');

class MainScene {
  constructor(dependencies) {
    Object.assign(this, dependencies);
    this.name = 'MainScene';
    this.activeSceneId = 'overview';
    this.uiManager = new UIManager(this.inputManager);
    this.topBar = new TopBar();
    this.tabs = [
      { id: 'overview', label: '概览' },
      { id: 'decoration', label: '装修' },
      { id: 'device', label: '设备' },
      { id: 'employee', label: '员工' },
      { id: 'marketing', label: '营销' },
      { id: 'finance', label: '财务' }
    ];
    this.bottomTabBar = new BottomTabBar(this.tabs);
    const sceneDependencies = Object.assign({}, dependencies, { requestRender: () => this.render() });
    this.scenes = {
      overview: new OverviewScene(sceneDependencies),
      device: new DeviceScene(sceneDependencies),
      employee: new EmployeeScene(sceneDependencies),
      marketing: new MarketingScene(),
      finance: new FinanceScene()
    };
  }

  enter() {
    const current = this.scenes[this.activeSceneId];
    if (current && current.enter) current.enter();
    this.render();
  }

  switchScene(sceneId) {
    if (sceneId === 'decoration') {
      const current = this.scenes[this.activeSceneId];
      if (current && current.leave) current.leave();
      if (this.onOpenDecorationEditor) this.onOpenDecorationEditor();
      return;
    }
    if (!this.scenes[sceneId] || sceneId === this.activeSceneId) return;
    const current = this.scenes[this.activeSceneId];
    if (current && current.beforeLeave) {
      const canLeave = current.beforeLeave(() => this.forceSwitchScene(sceneId));
      if (!canLeave) {
        this.render();
        return;
      }
    }
    this.forceSwitchScene(sceneId);
  }

  forceSwitchScene(sceneId) {
    const current = this.scenes[this.activeSceneId];
    if (current && current.leave) current.leave();
    this.activeSceneId = sceneId;
    if (this.scenes[sceneId].enter) this.scenes[sceneId].enter();
    this.render();
    console.log('[场景] 当前页面: ' + this.scenes[sceneId].title);
  }

  render() {
    const context = this.context;
    const viewport = this.viewport;
    const contentLeft = viewport.safeLeft;
    const contentWidth = viewport.width - viewport.safeLeft - viewport.safeRight;
    const topY = viewport.safeTop;
    const topHeight = Math.max(52, Math.min(58, viewport.height * 0.135));
    const navWidth = Math.max(80, Math.min(92, contentWidth * 0.105));
    const contentBottom = viewport.height - viewport.safeBottom;

    this.uiManager.beginFrame();
    context.clearRect(0, 0, viewport.width, viewport.height);
    context.fillStyle = '#071522';
    context.fillRect(0, 0, viewport.width, viewport.height);

    const state = this.gameState.getState();
    this.topBar.draw(context, {
      x: contentLeft + navWidth,
      y: topY,
      width: contentWidth - navWidth,
      height: topHeight
    }, state, this.timeManager.getDisplayDate());

    this.scenes[this.activeSceneId].render(context, {
      x: contentLeft + navWidth,
      y: topY + topHeight,
      width: contentWidth - navWidth,
      height: Math.max(0, contentBottom - topY - topHeight)
    }, state);

    this.bottomTabBar.draw(context, {
      x: contentLeft,
      y: topY,
      width: navWidth,
      height: contentBottom - topY
    }, this.activeSceneId, this.inputManager, this.switchScene.bind(this));
  }
}

module.exports = MainScene;
