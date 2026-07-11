'use strict';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class GameState {
  constructor(initialData, eventBus) {
    this.data = clone(initialData);
    this.eventBus = eventBus;
  }

  getState() {
    return this.data;
  }

  replace(nextData) {
    this.data = clone(nextData);
    this.eventBus.emit('state:changed', this.data);
  }

  update(section, values) {
    if (!this.data[section] || Array.isArray(this.data[section])) {
      throw new Error('无法更新未知或非对象状态分区: ' + section);
    }
    Object.assign(this.data[section], values);
    this.eventBus.emit('state:changed', this.data);
  }

  snapshot() {
    return clone(this.data);
  }
}

module.exports = GameState;
