'use strict';

class TimeManager {
  constructor(gameState) {
    this.gameState = gameState;
  }

  getDisplayDate() {
    const time = this.gameState.getState().time;
    return '第' + time.year + '年' + time.month + '月' + time.day + '日';
  }
}

module.exports = TimeManager;
