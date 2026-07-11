'use strict';

const CanvasUtils = require('../ui/CanvasUtils');

class PlaceholderScene {
  constructor(title, description) {
    this.title = title;
    this.description = description;
  }

  render(context, bounds) {
    context.save();
    context.fillStyle = '#f0c15b';
    context.font = 'bold 20px sans-serif';
    context.textAlign = 'center';
    context.fillText(this.title, bounds.x + bounds.width / 2, bounds.y + 72);
    context.fillStyle = '#8296a3';
    context.font = '14px sans-serif';
    context.fillText(this.description, bounds.x + bounds.width / 2, bounds.y + 108);
    CanvasUtils.fillRoundedRect(context, { x: bounds.x + 24, y: bounds.y + 138, width: bounds.width - 48, height: 80 }, 7, '#102737');
    CanvasUtils.strokeRoundedRect(context, { x: bounds.x + 24, y: bounds.y + 138, width: bounds.width - 48, height: 80 }, 7, '#294354', 1);
    context.fillStyle = '#8296a3';
    context.font = '13px sans-serif';
    context.fillText('第一阶段功能占位', bounds.x + bounds.width / 2, bounds.y + 183);
    context.restore();
  }
}

module.exports = PlaceholderScene;
