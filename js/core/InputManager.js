'use strict';

class InputManager {
  constructor() {
    this.regions = [];
    this.gestureHandler = null;
    this.boundStart = this.handleStart.bind(this);
    this.boundMove = this.handleMove.bind(this);
    this.boundEnd = this.handleEnd.bind(this);
    wx.onTouchStart(this.boundStart);
    wx.onTouchMove(this.boundMove);
    wx.onTouchEnd(this.boundEnd);
  }

  clear() { this.regions.length = 0; }
  setGestureHandler(handler) { this.gestureHandler = handler || null; }
  clearGestureHandler(handler) {
    if (!handler || this.gestureHandler === handler) this.gestureHandler = null;
  }
  register(id, bounds, handler) { this.regions.push({ id, bounds, handler }); }
  point(touch) { return touch ? { x: touch.clientX, y: touch.clientY } : null; }

  handleStart(event) {
    if (this.gestureHandler && this.gestureHandler.onTouchStart) this.gestureHandler.onTouchStart(event);
  }

  handleMove(event) {
    if (this.gestureHandler && this.gestureHandler.onTouchMove) this.gestureHandler.onTouchMove(event);
  }

  handleEnd(event) {
    if (this.gestureHandler && this.gestureHandler.onTouchEnd && this.gestureHandler.onTouchEnd(event)) return;
    const point = this.point(event.changedTouches && event.changedTouches[0]);
    if (!point) return;
    for (let index = this.regions.length - 1; index >= 0; index -= 1) {
      const region = this.regions[index];
      const box = region.bounds;
      if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) {
        region.handler({ x: point.x, y: point.y, id: region.id });
        return;
      }
    }
  }

  destroy() {
    if (wx.offTouchStart) wx.offTouchStart(this.boundStart);
    if (wx.offTouchMove) wx.offTouchMove(this.boundMove);
    if (wx.offTouchEnd) wx.offTouchEnd(this.boundEnd);
    this.gestureHandler = null;
    this.clear();
  }
}

module.exports = InputManager;
