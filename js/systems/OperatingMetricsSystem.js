'use strict';

const RatingSystem = require('./RatingSystem');
const DeviceSystem = require('./DeviceSystem');
const EmployeeSystem = require('./EmployeeSystem');
const MarketingSystem = require('./MarketingSystem');
const config = require('../data/operatingConfig');

class OperatingMetricsSystem {
  constructor() { this.ratingSystem = new RatingSystem(); this.deviceSystem = new DeviceSystem(); this.employeeSystem = new EmployeeSystem(); this.marketingSystem = new MarketingSystem(); }
  getMetrics(state) {
    const root = state || {}; const cafe = root.cafe || {};
    const employee = this.employeeSystem.getOperatingMetrics(root); if (!Array.isArray(root.employees) || !root.employees.length) { employee.serviceCapacity = config.baseServiceCapacity; employee.serviceScore = config.baseServiceScore; }
    return {
      decoration: this.ratingSystem.getOperatingRatings(root), equipment: this.deviceSystem.getOperatingMetrics(root), employee: employee,
      marketing: this.marketingSystem.getOperatingMetrics(root),
      cafe: { reputation: Math.max(0, Math.min(100, Number(root.player && root.player.reputation) || 0)), satisfaction: Math.max(0, Math.min(100, Number(cafe.satisfaction) || 50)), hourlyPrice: Math.max(0, Number(cafe.pricing && cafe.pricing.hourlyRate) || config.hourlyRate), areaLevel: Math.max(1, Number(cafe.areaLevel) || 1) }
    };
  }
}

module.exports = OperatingMetricsSystem;
