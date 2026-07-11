'use strict';

const catalog = require('../data/furnitureCatalog');

const catalogByType = {};
catalog.forEach((item) => {
  catalogByType[item.type] = item;
});

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

class RatingSystem {
  constructor(baseRatings) {
    this.baseRatings = Object.assign({
      environment: 50,
      equipment: 50,
      service: 50,
      hygiene: 50,
      comfort: 50
    }, baseRatings || {});
  }

  calculate(furniture) {
    const result = {
      environment: this.baseRatings.environment,
      equipment: this.baseRatings.equipment,
      service: this.baseRatings.service,
      hygiene: this.baseRatings.hygiene,
      comfort: this.baseRatings.comfort,
      capacity: 0
    };
    (Array.isArray(furniture) ? furniture : []).forEach((item) => {
      const config = catalogByType[item.type];
      if (!config) return;
      const bonus = config.ratingBonus || {};
      result.environment += bonus.environment || 0;
      result.equipment += bonus.equipment || 0;
      result.service += bonus.service || 0;
      result.hygiene += bonus.hygiene || 0;
      result.comfort += bonus.comfort || 0;
      result.capacity += config.capacity || 0;
    });
    result.environment = clamp(result.environment);
    result.equipment = clamp(result.equipment);
    result.service = clamp(result.service);
    result.hygiene = clamp(result.hygiene);
    result.comfort = clamp(result.comfort);
    result.overall = clamp(
      result.environment * 0.2 +
      result.equipment * 0.3 +
      result.service * 0.2 +
      result.hygiene * 0.15 +
      result.comfort * 0.15
    );
    result.satisfaction = result.overall;
    return result;
  }
}

RatingSystem.catalogByType = catalogByType;

module.exports = RatingSystem;
