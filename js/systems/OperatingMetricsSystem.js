'use strict';

const RatingSystem = require('./RatingSystem');
const DeviceSystem = require('./DeviceSystem');
const EmployeeSystem = require('./EmployeeSystem');
const MarketingSystem = require('./MarketingSystem');
const config = require('../data/operatingConfig');

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function weightedAverage(items) {
  const totalWeight = items.reduce((sum, item) => sum + item[1], 0);
  return totalWeight ? items.reduce((sum, item) => sum + item[0] * item[1], 0) / totalWeight : 0;
}

class OperatingMetricsSystem {
  constructor() { this.ratingSystem = new RatingSystem(); this.deviceSystem = new DeviceSystem(); this.employeeSystem = new EmployeeSystem(); this.marketingSystem = new MarketingSystem(); }
  getMetrics(state) {
    const root = state || {}; const cafe = root.cafe || {};
    const employee = this.employeeSystem.getOperatingMetrics(root); if (!Array.isArray(root.employees) || !root.employees.length) { employee.serviceCapacity = config.baseServiceCapacity; employee.serviceScore = config.baseServiceScore; }
    const equipment = this.deviceSystem.getOperatingMetrics(root);
    const layout = this.ratingSystem.calculate(root.furniture);
    const marketing = this.marketingSystem.getOperatingMetrics(root);
    const decoration = {
      environmentScore: clamp(layout.environment + equipment.climateSupport, 0, 100),
      comfortScore: clamp(layout.comfort + equipment.climateSupport * 0.75, 0, 100),
      hygieneScore: clamp(layout.hygiene + employee.hygieneSupport * 0.12, 0, 100)
    };
    const infrastructureScore = weightedAverage([
      [equipment.networkQuality, 0.35], [equipment.powerQuality, 0.25],
      [equipment.climateQuality, 0.2], [equipment.averageCondition, 0.2]
    ]);
    const decorationScore = weightedAverage([[decoration.environmentScore, 0.4], [decoration.comfortScore, 0.35], [decoration.hygieneScore, 0.25]]);
    const marketingScore = clamp(marketing.awareness + Math.max(0, marketing.trafficMultiplier - 1) * 60, 0, 100);
    const reputation = clamp(Number(root.player && root.player.reputation) || 0, 0, 100);
    const businessScore = equipment.installedComputerCount ? Math.round(weightedAverage([
      [equipment.computerQuality, 0.3], [infrastructureScore, 0.2], [decorationScore, 0.2],
      [employee.serviceScore, 0.15], [marketingScore, 0.1], [reputation, 0.05]
    ])) : 0;
    const level = config.businessLevelThresholds.reduce((result, threshold, index) => businessScore >= threshold ? index + 1 : result, 1);
    const naturalTrafficMultiplier = clamp(
      config.minimumNaturalTrafficMultiplier + businessScore / 100 * (config.maximumNaturalTrafficMultiplier - config.minimumNaturalTrafficMultiplier),
      config.minimumNaturalTrafficMultiplier,
      config.maximumNaturalTrafficMultiplier
    );
    return {
      decoration: decoration, equipment: equipment, employee: employee, marketing: marketing,
      cafe: { reputation: reputation, satisfaction: clamp(Number(cafe.satisfaction) || 50, 0, 100), hourlyPrice: Math.max(0, Number(cafe.pricing && cafe.pricing.hourlyRate) || config.hourlyRate), areaLevel: Math.max(1, Number(cafe.areaLevel) || 1), businessScore: businessScore, level: level, naturalTrafficMultiplier: Math.round(naturalTrafficMultiplier * 100) / 100 }
    };
  }
}

module.exports = OperatingMetricsSystem;
