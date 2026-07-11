'use strict';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class DecorationDraft {
  constructor(state, ratingSystem) {
    this.ratingSystem = ratingSystem;
    this.resetFromState(state);
  }

  resetFromState(state) {
    this.draftFurniture = clone(state.furniture || []);
    this.draftCash = Number(state.player && state.player.cash) || 0;
    this.dirty = false;
    this.selectedFurnitureId = null;
    this.selectedCatalogType = null;
    this.currentMode = 'browse';
    this.previewPosition = null;
    this.previewRotation = 0;
    this.toast = '';
    this.toastUntil = 0;
    this.confirm = null;
    this.cachedRatings = this.recalculate();
  }

  recalculate() {
    this.cachedRatings = this.ratingSystem.calculate(this.draftFurniture);
    return this.cachedRatings;
  }

  setToast(message) {
    this.toast = message;
    this.toastUntil = Date.now() + 2600;
  }

  getToast() {
    return Date.now() <= this.toastUntil ? this.toast : '';
  }

  selectCatalog(type) {
    this.selectedCatalogType = type;
    this.selectedFurnitureId = null;
    this.currentMode = 'place';
    this.previewPosition = null;
    this.previewRotation = 0;
  }

  selectFurniture(id) {
    this.selectedFurnitureId = id;
    this.selectedCatalogType = null;
    this.currentMode = 'browse';
    this.previewPosition = null;
  }

  cancelOperation() {
    this.currentMode = 'browse';
    this.previewPosition = null;
  }

  markDirty() {
    this.dirty = true;
    this.recalculate();
  }
}

module.exports = DecorationDraft;
