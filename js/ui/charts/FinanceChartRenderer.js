'use strict';

const FinanceSystem = require('../../systems/FinanceSystem');

const COLORS = ['#56bfa0', '#61aee8', '#e8b94f', '#e9855d', '#9d7be8', '#cf6f91'];
function compact(value) { return FinanceSystem.formatCompact(value); }

class FinanceChartRenderer {
  drawTrend(context, box, daily, metric, selectedDay) {
    const values = daily.map((item) => Number(item[metric]) || 0); const hasData = values.some((value) => value !== 0);
    context.fillStyle = '#0d2232'; context.fillRect(box.x, box.y, box.width, box.height);
    context.fillStyle = '#91a6b2'; context.font = '9px sans-serif'; context.textAlign = 'left'; context.fillText('本月每日' + ({ income: '收入', expense: '支出', net: '净现金流' }[metric]), box.x + 9, box.y + 16);
    if (!hasData) { context.fillStyle = '#718794'; context.textAlign = 'center'; context.fillText('本月暂无' + (metric === 'net' ? '现金流' : metric === 'income' ? '收入' : '支出') + '记录', box.x + box.width / 2, box.y + box.height / 2); return []; }
    const chart = { x: box.x + 35, y: box.y + 25, width: box.width - 45, height: box.height - 43 };
    let min = Math.min(0, ...values), max = Math.max(0, ...values); if (min === max) max = min + 1;
    const range = max - min; const zeroY = chart.y + max / range * chart.height;
    context.strokeStyle = '#385064'; context.lineWidth = 1; context.beginPath(); context.moveTo(chart.x, zeroY); context.lineTo(chart.x + chart.width, zeroY); context.stroke();
    context.fillStyle = '#718794'; context.font = '8px sans-serif'; context.textAlign = 'right'; context.fillText(compact(max), chart.x - 4, chart.y + 3); context.fillText(compact(min), chart.x - 4, chart.y + chart.height);
    const points = values.map((value, index) => ({ x: chart.x + index * chart.width / 29, y: chart.y + (max - value) / range * chart.height, day: index + 1 }));
    context.strokeStyle = metric === 'income' ? '#56bfa0' : metric === 'expense' ? '#e9855d' : '#e8b94f'; context.lineWidth = 2; context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke();
    points.forEach((point, index) => { if (point.day === selectedDay || index % 5 === 0 || index === 29) { context.fillStyle = point.day === selectedDay ? '#ffffff' : context.strokeStyle; context.beginPath(); context.arc(point.x, point.y, point.day === selectedDay ? 3 : 2, 0, Math.PI * 2); context.fill(); } });
    [1, 5, 10, 15, 20, 25, 30].forEach((day) => { context.fillStyle = '#718794'; context.font = '8px sans-serif'; context.textAlign = 'center'; context.fillText(String(day), chart.x + (day - 1) * chart.width / 29, box.y + box.height - 5); });
    return points.map((point) => ({ day: point.day, bounds: { x: point.x - chart.width / 58, y: chart.y, width: chart.width / 29, height: chart.height } }));
  }

  preparePie(data) {
    const list = Object.keys(data || {}).map((id) => ({ id: id, value: Number(data[id]) || 0 })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
    if (list.length <= 5) return list;
    return list.slice(0, 5).concat([{ id: 'other', value: list.slice(5).reduce((sum, item) => sum + item.value, 0) }]);
  }

  drawPie(context, box, data, labels, selectedId) {
    const items = this.preparePie(data); const total = items.reduce((sum, item) => sum + item.value, 0);
    context.fillStyle = '#0d2232'; context.fillRect(box.x, box.y, box.width, box.height);
    if (!total) { context.fillStyle = '#718794'; context.font = '9px sans-serif'; context.textAlign = 'center'; context.fillText('本月暂无记录', box.x + box.width / 2, box.y + box.height / 2); return []; }
    const radius = Math.min(box.height * 0.34, box.width * 0.19); const center = { x: box.x + radius + 12, y: box.y + box.height / 2 }; let start = -Math.PI / 2;
    const slices = items.map((item, index) => { const end = start + item.value / total * Math.PI * 2; context.fillStyle = COLORS[index % COLORS.length]; context.beginPath(); context.moveTo(center.x, center.y); context.arc(center.x, center.y, item.id === selectedId ? radius + 3 : radius, start, end); context.closePath(); context.fill(); const result = { id: item.id, value: item.value, start: start, end: end, center: center, radius: radius }; start = end; return result; });
    items.forEach((item, index) => { const y = box.y + 15 + index * 17; context.fillStyle = COLORS[index % COLORS.length]; context.fillRect(box.x + radius * 2 + 24, y - 7, 7, 7); context.fillStyle = '#a8b8c1'; context.font = '8px sans-serif'; context.textAlign = 'left'; const name = item.id === 'other' ? '其他' : (labels[item.id] || item.id); context.fillText(name + ' ' + Math.round(item.value / total * 100) + '% · ' + compact(item.value), box.x + radius * 2 + 35, y); });
    return slices;
  }

  hitPie(point, slices) {
    if (!point || !slices || !slices.length) return null; const center = slices[0].center; const dx = point.x - center.x, dy = point.y - center.y; if (Math.sqrt(dx * dx + dy * dy) > slices[0].radius + 5) return null;
    let angle = Math.atan2(dy, dx); if (angle < -Math.PI / 2) angle += Math.PI * 2;
    return slices.find((slice) => angle >= slice.start && angle <= slice.end) || null;
  }
}

FinanceChartRenderer.COLORS = COLORS;
module.exports = FinanceChartRenderer;
