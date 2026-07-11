'use strict';

class Camera2D {
  constructor(options) {
    const settings = options || {};
    this.cameraX = 0;
    this.cameraY = 0;
    this.zoom = 1;
    this.minZoom = settings.minZoom || 0.75;
    this.maxZoom = settings.maxZoom || 1.8;
    this.viewportRect = { x: 0, y: 0, width: 1, height: 1 };
    this.worldWidth = settings.worldWidth || 720;
    this.worldHeight = settings.worldHeight || 480;
  }

  setViewport(rect) { this.viewportRect = Object.assign({}, rect); this.clamp(); }
  setWorldSize(width, height) { this.worldWidth = width; this.worldHeight = height; this.clamp(); }

  fitToViewport(padding) {
    const inset = padding || 20;
    const availableW = Math.max(1, this.viewportRect.width - inset * 2);
    const availableH = Math.max(1, this.viewportRect.height - inset * 2);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(availableW / this.worldWidth, availableH / this.worldHeight)));
    this.cameraX = (this.worldWidth - this.viewportRect.width / this.zoom) / 2;
    this.cameraY = (this.worldHeight - this.viewportRect.height / this.zoom) / 2;
    this.clamp();
  }

  worldToScreen(x, y) {
    return { x: this.viewportRect.x + (x - this.cameraX) * this.zoom, y: this.viewportRect.y + (y - this.cameraY) * this.zoom };
  }

  screenToWorld(x, y) {
    return { x: this.cameraX + (x - this.viewportRect.x) / this.zoom, y: this.cameraY + (y - this.viewportRect.y) / this.zoom };
  }

  gridToWorld(gridX, gridY, cellSize) { return { x: gridX * cellSize, y: gridY * cellSize }; }
  worldToGrid(x, y, cellSize) { return { gridX: Math.floor(x / cellSize), gridY: Math.floor(y / cellSize) }; }

  panByScreen(dx, dy) {
    this.cameraX -= dx / this.zoom;
    this.cameraY -= dy / this.zoom;
    this.clamp();
  }

  setZoom(nextZoom, anchorX, anchorY) {
    const before = this.screenToWorld(anchorX, anchorY);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom));
    const after = this.screenToWorld(anchorX, anchorY);
    this.cameraX += before.x - after.x;
    this.cameraY += before.y - after.y;
    this.clamp();
  }

  clamp() {
    const visibleW = this.viewportRect.width / this.zoom;
    const visibleH = this.viewportRect.height / this.zoom;
    const marginW = Math.min(this.worldWidth * 0.25, visibleW * 0.35);
    const marginH = Math.min(this.worldHeight * 0.25, visibleH * 0.35);
    this.cameraX = Math.max(-visibleW + marginW, Math.min(this.cameraX, this.worldWidth - marginW));
    this.cameraY = Math.max(-visibleH + marginH, Math.min(this.cameraY, this.worldHeight - marginH));
  }
}

module.exports = Camera2D;
