'use strict';

class EventBus {
  constructor() {
    this.listeners = Object.create(null);
  }

  on(eventName, handler) {
    if (!this.listeners[eventName]) this.listeners[eventName] = [];
    this.listeners[eventName].push(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    const handlers = this.listeners[eventName] || [];
    this.listeners[eventName] = handlers.filter((item) => item !== handler);
  }

  emit(eventName, payload) {
    (this.listeners[eventName] || []).slice().forEach((handler) => handler(payload));
  }
}

module.exports = EventBus;
