'use strict';

const { GAME_VERSION } = require('../data/version');

class VersionDisplay {
  draw(context, viewport) {
    const text = 'V ' + GAME_VERSION;
    context.save();
    context.globalAlpha = 0.35;
    context.fillStyle = '#aabbcc';
    context.font = '9px monospace';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillText(text, viewport.safeLeft + 6, viewport.height - viewport.safeBottom - 4);
    context.restore();
  }
}

module.exports = VersionDisplay;