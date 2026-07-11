'use strict';

const Button = require('./Button');

class BottomTabBar {
  constructor(tabs) {
    this.tabs = tabs;
  }

  draw(context, bounds, activeId, inputManager, onSelect) {
    const titleHeight = Math.min(64, bounds.height * 0.16);
    const tabHeight = Math.min(52, (bounds.height - titleHeight - 12) / this.tabs.length);
    context.save();
    context.fillStyle = '#091b29';
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.fillStyle = '#f0c15b';
    context.font = 'bold ' + (bounds.width < 90 ? 14 : 17) + 'px sans-serif';
    context.textAlign = 'center';
    context.fillText('网吧老板', bounds.x + bounds.width / 2, bounds.y + 25);
    context.fillStyle = '#718897';
    context.font = '9px sans-serif';
    context.fillText('经营管理', bounds.x + bounds.width / 2, bounds.y + 42);
    context.restore();

    this.tabs.forEach((tab, index) => {
      const button = new Button({
        x: bounds.x + 7,
        y: bounds.y + titleHeight + index * tabHeight,
        width: bounds.width - 14,
        height: Math.max(40, tabHeight - 5),
        label: tab.label,
        icon: ['⌂', '▦', '▣', '♟', '▥', '¥'][index],
        selected: tab.id === activeId,
        horizontal: true
      });
      button.draw(context);
      inputManager.register('tab:' + tab.id, button.getBounds(), () => onSelect(tab.id));
    });
  }
}

module.exports = BottomTabBar;
