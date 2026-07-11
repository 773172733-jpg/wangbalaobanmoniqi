'use strict';

const Button = require('./Button');

class BottomTabBar {
  constructor(tabs) {
    this.tabs = tabs;
  }

  draw(context, bounds, activeId, inputManager, onSelect) {
    const padding = 7;
    const headerHeight = Math.max(64, Math.min(76, bounds.height * 0.18));
    const availableHeight = Math.max(0, bounds.height - headerHeight - padding * 2);
    const gap = 6;
    const buttonHeight = Math.max(42, Math.min(56, (availableHeight - gap * (this.tabs.length - 1)) / this.tabs.length));
    const buttonWidth = Math.max(1, bounds.width - padding * 2);

    context.save();
    context.fillStyle = '#071522';
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.fillStyle = '#d7a84b';
    context.fillRect(bounds.x + bounds.width - 2, bounds.y, 2, bounds.height);

    context.fillStyle = '#f0c15b';
    context.font = 'bold 12px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('\u7f51\u5427\u8001\u677f', bounds.x + bounds.width / 2, bounds.y + 24);

    context.fillStyle = '#6f8797';
    context.font = '9px sans-serif';
    context.fillText('\u7ecf\u8425\u7ba1\u7406', bounds.x + bounds.width / 2, bounds.y + 43);
    context.restore();

    const icons = ['\u2302', '\u25a6', '\u25a3', '\u265f', '\u25a5', '\u00a5'];
    let startY = bounds.y + headerHeight + padding;
    const maxTotalHeight = this.tabs.length * buttonHeight + (this.tabs.length - 1) * gap;
    if (startY + maxTotalHeight > bounds.y + bounds.height - padding) {
      startY = bounds.y + bounds.height - padding - maxTotalHeight;
    }

    this.tabs.forEach((tab, index) => {
      const button = new Button({
        x: bounds.x + padding,
        y: startY + index * (buttonHeight + gap),
        width: buttonWidth,
        height: buttonHeight,
        label: tab.label,
        icon: icons[index],
        selected: tab.id === activeId,
        horizontal: true
      });
      button.draw(context);
      inputManager.register('tab:' + tab.id, button.getBounds(), () => onSelect(tab.id));
    });
  }
}

module.exports = BottomTabBar;
