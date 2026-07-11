'use strict';

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius || 0, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function fillRoundedRect(context, bounds, radius, color) {
  context.save();
  roundedRect(context, bounds.x, bounds.y, bounds.width, bounds.height, radius);
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function strokeRoundedRect(context, bounds, radius, color, lineWidth) {
  context.save();
  roundedRect(context, bounds.x, bounds.y, bounds.width, bounds.height, radius);
  context.strokeStyle = color;
  context.lineWidth = lineWidth || 1;
  context.stroke();
  context.restore();
}

module.exports = {
  roundedRect: roundedRect,
  fillRoundedRect: fillRoundedRect,
  strokeRoundedRect: strokeRoundedRect
};
