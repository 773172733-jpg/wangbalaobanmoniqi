'use strict';

const CanvasUtils = require('./CanvasUtils');

class TopBar {
  draw(context, bounds, state, dateText) {
    const cafe = state.cafe;
    const items = [
      ['网吧等级', 'Lv.' + state.player.level],
      ['现金', '¥' + state.player.cash.toLocaleString() + (state.player.cash < 0 ? ' 赤字' : '')],
      ['今日收入', '\¥' + cafe.todayIncome.toLocaleString()],
      ['满意度', cafe.satisfaction + '%'],
      ['当前日期', dateText]
    ];
    const columnWidth = bounds.width / items.length;
    const compact = bounds.width < 650;

    context.save();
    context.fillStyle = '#0c2030';
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.fillStyle = '#d7a84b';
    context.fillRect(bounds.x, bounds.y + bounds.height - 2, bounds.width, 2);
    items.forEach((item, index) => {
      const centerX = bounds.x + index * columnWidth + columnWidth / 2;
      if (index > 0) {
        context.fillStyle = '#263b4a';
        context.fillRect(bounds.x + index * columnWidth, bounds.y + 12, 1, bounds.height - 24);
      }
      context.fillStyle = '#8fa5b4';
      context.font = (compact ? '9px' : '11px') + ' sans-serif';
      context.textAlign = 'center';
      context.fillText(item[0], centerX, bounds.y + bounds.height * 0.36);
      context.fillStyle = index === 1 || index === 2 ? '#f2c45e' : '#f4f0df';
      context.font = (index === 4 ? '' : 'bold ') + (compact ? '11px' : '15px') + ' sans-serif';
      context.fillText(item[1], centerX, bounds.y + bounds.height * 0.7);
    });
    CanvasUtils.strokeRoundedRect(context, bounds, 0, '#1c3547', 1);
    context.restore();
  }
}

module.exports = TopBar;
