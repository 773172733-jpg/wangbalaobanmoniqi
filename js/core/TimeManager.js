'use strict';

class TimeManager {
  constructor(gameState, eventBus) {
    this.gameState = gameState;
    this.eventBus = eventBus || null;
    this.timer = null;
  }

  getCurrentGameTime() { const time = this.gameState.getState().time; return { year: time.year, month: time.month, day: time.day, hour: time.hour || 0 }; }

  getDisplayDate() {
    const time = this.gameState.getState().time;
    return '第' + time.year + '年' + time.month + '月' + time.day + '日 ' + String(time.hour || 0).padStart(2, '0') + ':00';
  }

  advanceHour() {
    const ended = this.getCurrentGameTime(); const next = this.gameState.snapshot(); next.time.hour = (Number(next.time.hour) || 0) + 1; let dayEnded = false, monthEnded = false;
    if (next.time.hour >= 24) { next.time.hour = 0; next.time.day += 1; dayEnded = true; if (next.time.day > 30) { next.time.day = 1; next.time.month += 1; monthEnded = true; if (next.time.month > 12) { next.time.month = 1; next.time.year += 1; } } }
    this.gameState.replace(next); const current = this.getCurrentGameTime();
    if (this.eventBus && dayEnded) this.eventBus.emit('time:dayEnded', ended);
    if (this.eventBus && monthEnded) this.eventBus.emit('time:monthEnded', { year: ended.year, month: ended.month });
    if (this.eventBus) this.eventBus.emit('time:hourChanged', current);
    return current;
  }

  startAuto(milliseconds) { if (this.timer) return; this.timer = setInterval(() => this.advanceHour(), Math.max(1000, Number(milliseconds) || 15000)); if (this.timer && this.timer.unref) this.timer.unref(); }
  stopAuto() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

module.exports = TimeManager;
