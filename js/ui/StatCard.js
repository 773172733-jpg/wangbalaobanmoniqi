'use strict';

class StatCard {
  static draw(context, bounds, label, value, accent) {
    context.save();
    context.fillStyle = '#ffffff';
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.fillStyle = accent || '#4f8f68';
    context.fillRect(bounds.x, bounds.y, 4, bounds.height);
    context.fillStyle = '#718078';
    context.font = '11px sans-serif';
    context.textAlign = 'left';
    context.fillText(label, bounds.x + 12, bounds.y + 18);
    context.fillStyle = '#24332b';
    context.font = 'bold 16px sans-serif';
    context.fillText(value, bounds.x + 12, bounds.y + 40);
    context.restore();
  }
}

module.exports = StatCard;
