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
    this.viewPaddingX = 0;
    this.viewPaddingY = 0;
  }

  setViewport(rect) { this.viewportRect = Object.assign({}, rect); this.clampCamera(); }
  setWorldSize(width, height) {
    this.worldWidth = Math.max(1, Number(width) || 1);
    this.worldHeight = Math.max(1, Number(height) || 1);
    this.clampCamera();
  }
  setViewPadding(padX, padY) {
    this.viewPaddingX = Math.max(0, Number(padX) || 0);
    this.viewPaddingY = Math.max(0, Number(padY) || 0);
    this.clampCamera();
  }

  fitToViewport(padding) {
    const inset = padding || 20;
    const totalW = this.worldWidth + this.viewPaddingX * 2;
    const totalH = this.worldHeight + this.viewPaddingY * 2;
    const availableW = Math.max(1, this.viewportRect.width - inset * 2);
    const availableH = Math.max(1, this.viewportRect.height - inset * 2);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(availableW / totalW, availableH / totalH)));
    this.cameraX = (totalW - this.viewportRect.width / this.zoom) / 2 - this.viewPaddingX;
    this.cameraY = (totalH - this.viewportRect.height / this.zoom) / 2 - this.viewPaddingY;
    this.clampCamera();
  }

  fitToView(padding) { this.fitToViewport(padding); }
  resetView(padding) { this.fitToView(padding); }

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
    this.clampCamera();
  }

  setZoom(nextZoom, anchorX, anchorY) {
    const before = this.screenToWorld(anchorX, anchorY);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom));
    const after = this.screenToWorld(anchorX, anchorY);
    this.cameraX += before.x - after.x;
    this.cameraY += before.y - after.y;
    this.clampCamera();
  }

  clampCamera() {
    const padX = this.viewPaddingX || 0;
    const padY = this.viewPaddingY || 0;
    const visibleW = this.viewportRect.width / this.zoom;
    const visibleH = this.viewportRect.height / this.zoom;
    const totalW = this.worldWidth + padX * 2;
    const totalH = this.worldHeight + padY * 2;
    if (totalW <= visibleW) this.cameraX = (totalW - visibleW) / 2 - padX;
    else this.cameraX = Math.max(-padX, Math.min(this.cameraX, this.worldWidth + padX - visibleW));
    if (totalH <= visibleH) this.cameraY = (totalH - visibleH) / 2 - padY;
    else this.cameraY = Math.max(-padY, Math.min(this.cameraY, this.worldHeight + padY - visibleH));
  }

  clamp() { this.clampCamera(); }
}

module.exports = Camera2D;