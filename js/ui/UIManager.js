'use strict';

class UIManager {
  constructor(inputManager) {
    this.inputManager = inputManager;
  }

  beginFrame() {
    this.inputManager.clear();
  }
}

module.exports = UIManager;
