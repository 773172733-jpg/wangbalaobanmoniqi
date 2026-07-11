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
    this.name = 'MainScene';
    this.settingsOpen = false;
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
    this.versionDisplay = new VersionDisplay();

    const sceneDependencies = Object.assign({}, dependencies, {
      requestRender: () => this.render(),
      onOpenDecorationEditor: () => {
        if (this.onOpenDecorationEditor) this.onOpenDecorationEditor();
      }
    });

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

  toggleSettings() {
    this.settingsOpen = !this.settingsOpen;
    this.render();
  }

  drawSettingsGear(context, box) {
    context.save();
    CanvasUtils.fillRoundedRect(context, box, 8, '#102638');
    CanvasUtils.strokeRoundedRect(context, box, 8, '#d7a84b', 1);
    context.fillStyle = '#f0c15b';
    context.font = 'bold 23px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('\u2699', box.x + box.width / 2, box.y + box.height / 2 + 1);
    context.restore();

    this.inputManager.register('settings:gear', box, () => this.toggleSettings());
  }

  drawToggleBtn(context, id, box, enabled, action) {
    CanvasUtils.fillRoundedRect(context, box, 12, enabled ? '#b57a25' : '#243747');
    CanvasUtils.strokeRoundedRect(context, box, 12, enabled ? '#f0c15b' : '#3a5362', 1);

    const knobSize = box.height - 8;
    const knobX = enabled ? box.x + box.width - knobSize - 4 : box.x + 4;
    CanvasUtils.fillRoundedRect(
      context,
      { x: knobX, y: box.y + 4, width: knobSize, height: knobSize },
      knobSize / 2,
      enabled ? '#fff3cf' : '#8fa5b4'
    );

    context.fillStyle = enabled ? '#fff3cf' : '#8fa5b4';
    context.font = 'bold 9px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(enabled ? 'ON' : 'OFF', enabled ? box.x + 17 : box.x + box.width - 17, box.y + box.height / 2);

    this.inputManager.register(id, box, action);
  }

  drawSettingsOverlay(context, viewport) {
    if (!this.settingsOpen) return;

    this.inputManager.register('settings:backdrop', { x: 0, y: 0, width: viewport.width, height: viewport.height }, () => {
      this.settingsOpen = false;
      this.render();
    });

    context.save();
    context.fillStyle = 'rgba(0,0,0,0.58)';
    context.fillRect(0, 0, viewport.width, viewport.height);

    const config = settings.getSettings();
    const width = Math.min(320, viewport.width - 48);
    const height = 210;
    const x = Math.round((viewport.width - width) / 2);
    const y = Math.round((viewport.height - height) / 2);
    const panel = { x, y, width, height };

    CanvasUtils.fillRoundedRect(context, panel, 10, '#0d2232');
    CanvasUtils.strokeRoundedRect(context, panel, 10, '#efc45c', 2);
    context.fillStyle = '#071522';
    context.fillRect(x + 1, y + 44, width - 2, 1);

    context.fillStyle = '#f0c15b';
    context.font = 'bold 15px sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText('游戏设置', x + 18, y + 29);

    const closeBox = { x: x + width - 42, y: y + 8, width: 32, height: 32 };
    CanvasUtils.fillRoundedRect(context, closeBox, 6, '#162f42');
    CanvasUtils.strokeRoundedRect(context, closeBox, 6, '#3a5362', 1);
    context.fillStyle = '#d7e3e7';
    context.font = 'bold 16px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('×', closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
    this.inputManager.register('settings:close', closeBox, () => {
      this.settingsOpen = false;
      this.render();
    });

    const rows = [
      ['背景音乐', '控制主界面背景音乐', config.bgmEnabled, () => { settings.setBgm(!settings.isBgmEnabled()); this.render(); }, 'settings:bgm'],
      ['按键音效', '控制点击与操作反馈音', config.sfxEnabled, () => { settings.setSfx(!settings.isSfxEnabled()); this.render(); }, 'settings:sfx']
    ];

    rows.forEach((row, index) => {
      const rowY = y + 66 + index * 48;
      context.fillStyle = '#e8eeea';
      context.font = 'bold 12px sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
      context.fillText(row[0], x + 20, rowY);
      context.fillStyle = '#718897';
      context.font = '9px sans-serif';
      context.fillText(row[1], x + 20, rowY + 17);
      this.drawToggleBtn(context, row[4], { x: x + width - 90, y: rowY - 20, width: 66, height: 28 }, row[2], row[3]);
    });

    context.fillStyle = '#718897';
    context.font = '10px monospace';
    context.textAlign = 'center';
    context.fillText('版本 V ' + GAME_VERSION, x + width / 2, y + height - 22);
    context.restore();
  }

  render() {
    const context = this.context;
    const viewport = this.viewport;
    const contentLeft = viewport.safeLeft;
    const contentWidth = viewport.width - viewport.safeLeft - viewport.safeRight;
    const topY = viewport.safeTop;
    const topHeight = Math.max(52, Math.min(58, viewport.height * 0.135));
    const contentBottom = viewport.height - viewport.safeBottom;
    const navWidth = Math.max(80, Math.min(92, contentWidth * 0.105));
    const gearSize = 38;
    const gearGap = 8;

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

    const sceneBounds = {
      x: contentLeft + navWidth,
      y: topY + topHeight,
      width: contentWidth - navWidth,
      height: Math.max(0, contentBottom - topY - topHeight)
    };
    this.scenes[this.activeSceneId].render(context, sceneBounds, state);

    this.bottomTabBar.draw(context, {
      x: contentLeft,
      y: topY,
      width: navWidth,
      height: contentBottom - topY
    }, this.activeSceneId, this.inputManager, this.switchScene.bind(this));

    this.drawSettingsGear(context, {
      x: contentLeft + contentWidth - gearSize - gearGap,
      y: contentBottom - gearSize - 6,
      width: gearSize,
      height: gearSize
    });

    this.versionDisplay.draw(context, this.viewport);
    this.drawSettingsOverlay(context, viewport);
  }
}

module.exports = MainScene;
