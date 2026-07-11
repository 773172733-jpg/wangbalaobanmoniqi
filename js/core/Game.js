'use strict';

const initialState = require('../data/initialState');
const EventBus = require('./EventBus');
const GameState = require('./GameState');
const SaveManager = require('./SaveManager');
const TimeManager = require('./TimeManager');
const InputManager = require('./InputManager');
const AssetManager = require('./AssetManager');
const MainScene = require('../scenes/MainScene');
const DecorationEditorScene = require('../scenes/DecorationEditorScene');

class Game {
  constructor() {
    this.canvas = wx.createCanvas();
    this.context = this.canvas.getContext('2d');
    this.eventBus = new EventBus();
    this.saveManager = new SaveManager(initialState);
    this.gameState = new GameState(this.saveManager.load(), this.eventBus);
    this.timeManager = new TimeManager(this.gameState);
    this.inputManager = new InputManager();
    this.assetManager = new AssetManager();
    this.viewport = this.configureCanvas();
    this.scene = null;
  }

  configureCanvas() {
    const info = wx.getSystemInfoSync();
    const width = info.windowWidth || info.screenWidth || 375;
    const height = info.windowHeight || info.screenHeight || 667;
    const ratio = info.pixelRatio || 1;
    const safe = info.safeArea || { left: 0, right: width, top: 0, bottom: height };

    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.context.scale(ratio, ratio);

    return {
      width: width,
      height: height,
      pixelRatio: ratio,
      safeTop: Math.max(0, safe.top || 0),
      safeBottom: Math.max(0, height - (safe.bottom || height)),
      safeLeft: Math.max(0, safe.left || 0),
      safeRight: Math.max(0, width - (safe.right || width))
    };
  }

  start() {
    const dependencies = {
      context: this.context,
      viewport: this.viewport,
      gameState: this.gameState,
      saveManager: this.saveManager,
      timeManager: this.timeManager,
      inputManager: this.inputManager,
      assetManager: this.assetManager
    };
    this.mainScene = new MainScene(Object.assign({}, dependencies, {
      onOpenDecorationEditor: () => this.openDecorationEditor()
    }));
    this.decorationEditorScene = new DecorationEditorScene(Object.assign({}, dependencies, {
      onExit: () => this.openMainScene()
    }));
    this.scene = this.mainScene;
    this.scene.enter();
    console.log('[游戏] 游戏初始化完成');
    console.log('[场景] 当前场景名称: ' + this.scene.name);
  }

  openDecorationEditor() {
    this.scene = this.decorationEditorScene;
    this.scene.enter();
    console.log('[场景] 当前场景名称: ' + this.scene.name);
  }

  openMainScene() {
    this.scene = this.mainScene;
    this.scene.activeSceneId = 'overview';
    this.scene.enter();
    console.log('[场景] 当前场景名称: ' + this.scene.name);
  }
}

module.exports = Game;
