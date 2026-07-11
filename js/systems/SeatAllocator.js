'use strict';

const config = require('../data/operatingConfig');

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

class SeatAllocator {
  getPreferences(segmentType) {
    return { streamer: ['premium', 'gaming'], gamer: ['gaming', 'premium', 'basic'], office_worker: ['basic', 'gaming', 'premium'], student: ['basic', 'gaming', 'premium'] }[segmentType] || ['basic', 'gaming', 'premium'];
  }

  allocate(requests, metrics, occupiedByTier, activeCount) {
    const pools = {}; metrics.equipment.computerPools.forEach((pool) => { pools[pool.tier] = Object.assign({}, pool, { available: Math.max(0, pool.count - (occupiedByTier[pool.tier] || 0)) }); });
    const result = { admitted: 0, rejectedNoSeat: 0, rejectedLowPerformance: 0, rejectedNetworkLimit: 0, rejectedPowerLimit: 0, rejectedServiceLimit: 0, allocations: [] };
    let networkAvailable = Math.max(0, Math.floor(metrics.equipment.networkCapacity / config.bandwidthPerSeat) - activeCount);
    let serviceAvailable = Math.max(0, Math.floor(metrics.employee.serviceCapacity) - activeCount);
    let sparePower = Math.max(0, metrics.equipment.powerCapacity - metrics.equipment.currentPowerDemand);
    (requests || []).forEach((request) => {
      let remaining = Math.max(0, Math.floor(request.count)); const totalFree = Object.keys(pools).reduce((sum, key) => sum + pools[key].available, 0);
      if (!totalFree) { result.rejectedNoSeat += remaining; return; }
      const eligible = this.getPreferences(request.segment.type).filter((tier) => pools[tier] && pools[tier].available > 0 && pools[tier].performance >= request.segment.minimumPerformance);
      if (!eligible.length) { result.rejectedLowPerformance += remaining; return; }
      if (networkAvailable <= 0) { result.rejectedNetworkLimit += remaining; return; }
      if (serviceAvailable <= 0) { result.rejectedServiceLimit += remaining; return; }
      eligible.forEach((tier) => {
        if (remaining <= 0) return; const pool = pools[tier]; const powerSeats = pool.powerUsage > 0 ? Math.floor(sparePower / (pool.powerUsage * 0.65)) : remaining;
        if (powerSeats <= 0) return;
        const count = Math.min(remaining, pool.available, networkAvailable, serviceAvailable, powerSeats); if (count <= 0) return;
        const performanceFit = clamp(pool.performance / request.segment.idealPerformance, 0, 1); const networkFit = clamp(metrics.equipment.networkQuality / request.segment.networkDemand, 0, 1);
        const satisfaction = clamp(Math.round((performanceFit * 0.3 + networkFit * 0.22 + metrics.decoration.environmentScore / 100 * 0.15 + metrics.decoration.comfortScore / 100 * 0.08 + metrics.decoration.hygieneScore / 100 * 0.08 + metrics.employee.serviceScore / 100 * 0.12 + request.priceFit * 0.05) * 100), 0, 100);
        result.allocations.push({ segmentType: request.segment.type, computerTier: tier, count: count, sessionHours: request.sessionHours, satisfaction: satisfaction }); result.admitted += count; remaining -= count; pool.available -= count; networkAvailable -= count; serviceAvailable -= count; sparePower -= count * pool.powerUsage * 0.65;
      });
      if (remaining > 0) {
        const freeEligible = eligible.reduce((sum, tier) => sum + pools[tier].available, 0);
        if (freeEligible <= 0) result.rejectedNoSeat += remaining;
        else if (networkAvailable <= 0) result.rejectedNetworkLimit += remaining;
        else if (serviceAvailable <= 0) result.rejectedServiceLimit += remaining;
        else result.rejectedPowerLimit += remaining;
      }
    });
    return result;
  }
}

module.exports = SeatAllocator;
