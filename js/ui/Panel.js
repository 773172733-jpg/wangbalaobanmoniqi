'use strict';

class Panel {
  static draw(context, bounds, color) {
    context.save();
    context.fillStyle = color || '#ffffff';
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.restore();
  }
}

module.exports = Panel;
