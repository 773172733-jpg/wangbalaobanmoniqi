'use strict';

const CanvasUtils = require('./CanvasUtils');

class Button {
  constructor(options) {
    Object.assign(this, options);
  }

  draw(context) {
    context.save();
    CanvasUtils.fillRoundedRect(context, this, 5, this.selected ? '#b57a25' : '#102638');
    if (this.selected) CanvasUtils.strokeRoundedRect(context, this, 5, '#f0c15b', 1);
    context.fillStyle = this.selected ? '#fff3cf' : '#b4c1ca';
    context.font = this.horizontal ? '13px sans-serif' : '13px sans-serif';
    context.textAlign = this.horizontal ? 'left' : 'center';
    context.textBaseline = 'middle';
    if (this.horizontal) {
      context.fillStyle = this.selected ? '#ffd36b' : '#7f96a6';
      context.font = 'bold 15px sans-serif';
      context.fillText(this.icon || '•', this.x + 12, this.y + this.height / 2);
      context.fillStyle = this.selected ? '#fff3cf' : '#b4c1ca';
      context.font = '12px sans-serif';
      context.fillText(this.label, this.x + 34, this.y + this.height / 2);
    } else {
      context.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);
    }
    context.restore();
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}

module.exports = Button;
