'use strict';

class AssetManager {
  constructor() {
    this.images = Object.create(null);
    this.imagePaths = Object.create(null);
  }

  getImage(key) {
    return this.images[key] || null;
  }

  registerImage(key, image) {
    if (!key || !image) return false;
    this.images[key] = image;
    return true;
  }

  hasImage(key) {
    return Boolean(this.images[key]);
  }

  loadImage(key, path, callback) {
    if (!key || !path) return null;
    if (this.images[key]) {
      if (callback) callback(this.images[key]);
      return this.images[key];
    }
    if (this.imagePaths[path]) {
      this.images[key] = this.imagePaths[path];
      if (callback) callback(this.images[key]);
      return this.images[key];
    }
    const image = wx.createImage();
    this.images[key] = image;
    this.imagePaths[path] = image;
    image.onload = () => { if (callback) callback(image); };
    image.onerror = () => {
      delete this.images[key];
      delete this.imagePaths[path];
      if (callback) callback(null);
    };
    image.src = path;
    return image;
  }
}

module.exports = AssetManager;
