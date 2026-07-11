'use strict';

const UIManager = require('../ui/UIManager');
const TopBar = require('../ui/TopBar');
const BottomTabBar = require('../ui/BottomTabBar');
const OverviewScene = require('./OverviewScene');
const DeviceScene = require('./DeviceScene');
const EmployeeScene = require('./EmployeeScene');
const MarketingScene = require('./MarketingScene');
const FinanceScene = require('./FinanceScene');
const VersionDisplay = require('../ui/VersionDisplay');
const CanvasUtils = require('../ui/CanvasUtils');
const settings = require('../data/settings');
const { GAME_VERSION } = require('../data/version');

class MainScene {
  constructor(dependencies) {
    Object.assign(this, dependencies);
    this.name = 'MainScene'; this.settingsOpen = false;
    this.activeSceneId = 'overview';
    this.uiManager = new UIManager(this.inputManager);
    this.topBar = new TopBar();
    this.tabs = [
      { id: 'overview', label: '概览' },
      { id: 'decoration', label: '购买' },
      { id: 'device', label: '基础' },
      { id: 'employee', label: '员工' },
      { id: 'marketing', label: '营销' },
      { id: 'finance', label: '财务' }
    ];
    this.bottomTabBar = new BottomTabBar(this.tabs);
    this.versionDisplay = new VersionDisplay();
    const sceneDependencies = Object.assign({}, dependencies, { requestRender: () => this.render(), onOpenDecorationEditor: () => { if (this.onOpenDecorationEditor) this.onOpenDecorationEditor(); } });
    this.scenes = {
      overview: new OverviewScene(sceneDependencies),
      device: new DeviceScene(sceneDependencies),
      employee: new EmployeeScene(sceneDependencies),
      marketing: new MarketingScene(sceneDependencies),
      finance: new FinanceScene(sceneDependencies)
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


  toggleSettings() { this.settingsOpen = !this.settingsOpen; this.render(); }

  drawSettingsOverlay(context, viewport) {
    if (!this.settingsOpen) return;
    // Backdrop
    context.fillStyle = 'rgba(0,0,0,0.45)';
    context.fillRect(0, 0, viewport.width, viewport.height);
    const config = settings.getSettings();
    const w = Math.min(280, viewport.width - 40);
    const h = 190;
    const x = (viewport.width - w) / 2;
    const y = (viewport.height - h) / 2;

    CanvasUtils.fillRoundedRect(context, { x, y, width: w, height: h }, 8, '#0d2232');
    CanvasUtils.strokeRoundedRect(context, { x, y, width: w, height: h }, 8, '#efc45c', 2);

    context.fillStyle = '#f0c15b'; context.font = 'bold 14px sans-serif'; context.textAlign = 'center';
    context.fillText('游戏设置', x + w / 2, y + 28);

    // BGM
    context.fillStyle = '#e8eeea'; context.font = '12px sans-serif'; context.textAlign = 'left';
    context.fillText('背景音乐', x + 20, y + 62);
    this.drawToggleBtn(context, 'settings:bgm', { x: x + w - 86, y: y + 44, width: 66, height: 26 },
      config.bgmEnabled, () => { settings.setBgm(!settings.isBgmEnabled()); this.render(); });

    // SFX
    context.fillText('按键音', x + 20, y + 96);
    this.drawToggleBtn(context, 'settings:sfx', { x: x + w - 86, y: y + 78, width: 66, height: 26 },
      config.sfxEnabled, () => { settings.setSfx(!settings.isSfxEnabled()); this.render(); });

    // Version
    context.fillStyle = '#718897'; context.font = '10px monospace'; context.textAlign = 'center';
    context.fillText('版本号: V ' + GAME_VERSION, x + w / 2, y + 148);

    // Close area (tap backdrop)
    this.inputManager.register('settings:close', { x: 0, y: 0, width: viewport.width, height: viewport.height },
      () => { this.settingsOpen = false; this.render(); });
  }

  drawToggleBtn(context, id, box, enabled, action) {
    CanvasUtils.fillRoundedRect(context, box, 4, enabled ? '#a97022' : '#263845');
    CanvasUtils.strokeRoundedRect(context, box, 4, enabled ? '#efc45c' : '#3a5362', 1);
    context.fillStyle = enabled ? '#f5f0df' : '#728591';
    context.font = 'bold 10px sans-serif'; context.textAlign = 'center';
    context.fillText(enabled ? 'ON' : 'OFF', box.x + box.width / 2, box.y + box.height / 2 + 3);
    this.inputManager.register(id, box, action);
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
    const topBarWidth = contentWidth - navWidth - 44;
    this.topBar.draw(context, {
      x: contentLeft + navWidth,
      y: topY,
      width: topBarWidth,
      height: topHeight
    }, state, this.timeManager.getDisplayDate());
    // Settings gear button
    const gearX = contentLeft + navWidth + topBarWidth + 2;
    const gearW = 36;
    const gearBox = { x: gearX, y: topY + 8, width: gearW, height: topHeight - 16 };
    CanvasUtils.fillRoundedRect(context, gearBox, 4, '#153247');
    CanvasUtils.strokeRoundedRect(context, gearBox, 4, '#3a5362', 1);
    context.fillStyle = '#f0c15b'; context.font = 'bold 16px sans-serif'; context.textAlign = 'center';
    context.fillText('⚙', gearBox.x + gearBox.width / 2, gearBox.y + gearBox.height / 2 + 5);
    this.inputManager.register('settings:gear', gearBox, () => this.toggleSettings());
    this.drawSettingsOverlay(context, viewport);

    this.scenes[this.activeSceneId].render(context, {
      x: contentLeft + navWidth,
      y: topY + topHeight,
      width: contentWidth - navWidth,
      height: Math.max(0, contentBottom - topY - topHeight)
    }, state);

    this.versionDisplay.draw(context, this.viewport);
    this.bottomTabBar.draw(context, {
      x: contentLeft,
      y: topY,
      width: navWidth,
      height: contentBottom - topY
    }, this.activeSceneId, this.inputManager, this.switchScene.bind(this));
  }
}

module.exports = MainScene;
