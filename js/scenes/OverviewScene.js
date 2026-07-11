'use strict';

const DecorationRenderer = require('../map/DecorationRenderer');
const CanvasUtils = require('../ui/CanvasUtils');

class OverviewScene {
  constructor(assetManager) {
    this.title = '经营概览';
    this.decorationRenderer = new DecorationRenderer(assetManager);
  }

  drawSectionTitle(context, x, y, title, subtitle) {
    context.fillStyle = '#f0c15b';
    context.fillRect(x, y + 3, 4, 17);
    context.fillStyle = '#f5f0df';
    context.font = 'bold 15px sans-serif';
    context.textAlign = 'left';
    context.fillText(title, x + 11, y + 17);
    if (subtitle) {
      context.fillStyle = '#718897';
      context.font = '10px sans-serif';
      context.fillText(subtitle, x + 85, y + 16);
    }
  }

  drawDailyPanel(context, bounds, state) {
    const cafe = state.cafe;
    CanvasUtils.fillRoundedRect(context, bounds, 6, '#0d2232');
    CanvasUtils.strokeRoundedRect(context, bounds, 6, '#344a57', 1);
    context.fillStyle = '#f0c15b';
    context.font = 'bold 14px sans-serif';
    context.textAlign = 'left';
    context.fillText('今日数据', bounds.x + 13, bounds.y + 22);

    const rows = [
      ['营业收入', '¥' + cafe.todayIncome.toLocaleString(), '#f2c45e'],
      ['会员收入', '¥0', '#dfe7e9'],
      ['商品收入', '¥0', '#dfe7e9'],
      ['电费', '-¥0', '#e78555'],
      ['维护费', '-¥0', '#e78555'],
      ['净利润', '¥' + cafe.todayIncome.toLocaleString(), '#f2c45e']
    ];
    const startY = bounds.y + 39;
    const rowHeight = Math.max(20, (bounds.height - 106) / rows.length);
    rows.forEach((row, index) => {
      const y = startY + index * rowHeight;
      context.fillStyle = '#8195a2';
      context.font = '10px sans-serif';
      context.fillText(row[0], bounds.x + 13, y + 12);
      context.fillStyle = row[2];
      context.font = 'bold 10px sans-serif';
      context.textAlign = 'right';
      context.fillText(row[1], bounds.x + bounds.width - 13, y + 12);
      context.textAlign = 'left';
      context.fillStyle = '#263d4c';
      context.fillRect(bounds.x + 13, y + rowHeight - 2, bounds.width - 26, 1);
    });

    const chartY = bounds.y + bounds.height - 56;
    context.fillStyle = '#718897';
    context.font = '9px sans-serif';
    context.fillText('收入趋势（7日）', bounds.x + 13, chartY);
    const values = [0.18, 0.45, 0.37, 0.66, 0.42, 0.54, 0.78];
    context.strokeStyle = '#e9c34f';
    context.lineWidth = 2;
    context.beginPath();
    values.forEach((value, index) => {
      const x = bounds.x + 14 + index * (bounds.width - 28) / (values.length - 1);
      const y = bounds.y + bounds.height - 10 - value * 34;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
  }

  drawMetricCards(context, bounds, state) {
    const cafe = state.cafe;
    const cards = [
      ['上座率', cafe.occupancyRate + '%', '#4e8fc1'],
      ['环境评分', cafe.environment + '分', '#6cad78'],
      ['设备评分', cafe.equipment + '分', '#dd8452'],
      ['服务评分', cafe.service + '分', '#b78bc1'],
      ['卫生评分', cafe.hygiene + '分', '#7fae65'],
      ['本月收入', '¥' + cafe.monthlyIncome.toLocaleString(), '#d9a941'],
      ['本月支出', '¥' + cafe.monthlyExpense.toLocaleString(), '#cf7654'],
      ['本月利润', '¥' + cafe.monthlyProfit.toLocaleString(), '#69aa75']
    ];
    const gap = 6;
    const cardWidth = (bounds.width - gap * (cards.length - 1)) / cards.length;
    cards.forEach((card, index) => {
      const box = { x: bounds.x + index * (cardWidth + gap), y: bounds.y, width: cardWidth, height: bounds.height };
      CanvasUtils.fillRoundedRect(context, box, 5, '#102737');
      CanvasUtils.strokeRoundedRect(context, box, 5, index < 5 ? '#294354' : '#5b4929', 1);
      context.fillStyle = card[2];
      context.fillRect(box.x, box.y, 4, box.height);
      context.fillStyle = '#8296a3';
      context.font = '9px sans-serif';
      context.textAlign = 'left';
      context.fillText(card[0], box.x + 10, box.y + 17);
      context.fillStyle = '#f4f0df';
      context.font = 'bold 12px sans-serif';
      context.fillText(card[1], box.x + 10, box.y + 36);
    });
  }

  render(context, bounds, state) {
    const padding = 10;
    const titleHeight = 29;
    const metricsHeight = Math.min(54, Math.max(44, bounds.height * 0.18));
    const bodyY = bounds.y + titleHeight;
    const bodyHeight = bounds.height - titleHeight - metricsHeight - padding * 2;
    const sideWidth = Math.max(125, Math.min(175, bounds.width * 0.23));
    const mapWidth = bounds.width - sideWidth - padding * 3;

    this.drawSectionTitle(context, bounds.x + padding, bounds.y + 2, '老板视角', '静态网吧平面预览');
    this.decorationRenderer.draw(context, {
      x: bounds.x + padding,
      y: bodyY,
      width: mapWidth,
      height: bodyHeight
    }, state.furniture, {
      showGrid: false,
      subtleGrid: true
    });
    this.drawDailyPanel(context, {
      x: bounds.x + padding * 2 + mapWidth,
      y: bodyY,
      width: sideWidth,
      height: bodyHeight
    }, state);
    this.drawMetricCards(context, {
      x: bounds.x + padding,
      y: bodyY + bodyHeight + padding,
      width: bounds.width - padding * 2,
      height: metricsHeight
    }, state);
  }
}

module.exports = OverviewScene;
