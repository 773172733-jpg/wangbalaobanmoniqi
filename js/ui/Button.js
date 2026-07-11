'use strict';

const CanvasUtils = require('./CanvasUtils');

class Button {
  constructor(options) {
    Object.assign(this, options);
  }

  draw(context) {
    context.save();
    CanvasUtils.fillRoundedRect(context, this, 6, this.selected ? '#b57a25' : '#102638');
    CanvasUtils.strokeRoundedRect(context, this, 6, this.selected ? '#f0c15b' : '#213b4d', 1);
    context.textBaseline = 'middle';

    if (this.horizontal) {
      context.textAlign = 'left';
      context.fillStyle = this.selected ? '#ffd36b' : '#7f96a6';
      context.font = 'bold 13px sans-serif';
      context.fillText(this.icon || '•', this.x + 10, this.y + this.height / 2);

      context.fillStyle = this.selected ? '#fff3cf' : '#b4c1ca';
      context.font = '11px sans-serif';
      context.fillText(this.label, this.x + 32, this.y + this.height / 2);
    } else {
      context.fillStyle = this.selected ? '#fff3cf' : '#b4c1ca';
      context.font = '13px sans-serif';
      context.textAlign = 'center';
      context.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);
    }

    context.restore();
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}

module.exports = Button;
