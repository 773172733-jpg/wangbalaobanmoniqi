'use strict';

const config = require('../data/expansionConfig');
const FinanceSystem = require('./FinanceSystem');

function money(value) {
  const result = Math.round(Number(value));
  return Number.isFinite(result) ? result : 0;
}

class ExpansionSystem {
  constructor(gameState, saveManager) {
    this.gameState = gameState || null;
    this.saveManager = saveManager || null;
  }

  getState() {
    return this.gameState ? this.gameState.getState() : {};
  }

  getExpansionData() {
    const state = this.getState();
    if (!state.expansion) {
      return { level: 0, currentArea: config.baseArea, baseArea: config.baseArea, history: [] };
    }
    return state.expansion;
  }

  getLevel() {
    return Number(this.getExpansionData().level) || 0;
  }

  getCurrentArea() {
    return Number(this.getExpansionData().currentArea) || config.baseArea;
  }

  getNextArea() {
    return Math.round(this.getCurrentArea() * (1 + config.expansionRate));
  }

  getExpansionCost() {
    return config.baseCost * (this.getLevel() + 2);
  }

  canExpand() {
    if (!this.gameState || !this.saveManager) return false;
    const financeSystem = new FinanceSystem(this.gameState, this.saveManager);
    return financeSystem.canAfford(this.getExpansionCost());
  }

  expand() {
    if (!this.gameState || !this.saveManager) {
      return { ok: false, reason: '游戏状态未初始化。' };
    }
    const financeSystem = new FinanceSystem(this.gameState, this.saveManager);
    const cost = this.getExpansionCost();
    if (!financeSystem.canAfford(cost)) {
      return { ok: false, reason: '资金不足，无法扩建。' };
    }
    const beforeArea = this.getCurrentArea();
    const afterArea = this.getNextArea();
    const newLevel = this.getLevel() + 1;
    const recordResult = financeSystem.recordExpense({
      category: 'expansion',
      amount: cost,
      sourceSystem: 'expansion',
      description: '第 ' + newLevel + ' 次空间扩建（' + beforeArea + '㎡ → ' + afterArea + '㎡）',
      gameDate: this.getGameDate(),
      allowNegative: true,
      dedupeKey: 'expansion_' + newLevel,
      metadata: { expansionLevel: newLevel, beforeArea: beforeArea, afterArea: afterArea }
    });
    if (!recordResult.ok) {
      return { ok: false, reason: '财务记录失败: ' + (recordResult.message || '未知错误') };
    }
    const expansionData = this.getExpansionData();
    const historyEntry = {
      level: newLevel,
      beforeArea: beforeArea,
      afterArea: afterArea,
      cost: cost,
      date: this.getGameDate()
    };
    this.gameState.update('expansion', {
      level: newLevel,
      currentArea: afterArea,
      baseArea: config.baseArea,
      history: (expansionData.history || []).concat([historyEntry])
    });
    if (this.gameState && this.gameState.eventBus) {
      this.gameState.eventBus.emit('mapExpanded', {
        level: newLevel,
        beforeArea: beforeArea,
        afterArea: afterArea,
        dimensions: this.getMapDimensions()
      });
    }
    return { ok: true, cost: cost, beforeArea: beforeArea, afterArea: afterArea, level: newLevel };
  }

  getMetrics() {
    return {
      level: this.getLevel(),
      currentArea: this.getCurrentArea(),
      nextArea: this.getNextArea(),
      cost: this.getExpansionCost()
    };
  }

  getBuildCapacity() {
    const area = this.getCurrentArea();
    return {
      area: area,
      buildableTiles: area
    };
  }

  getMapDimensions() {
    const area = this.getCurrentArea();
    const baseSide = Math.sqrt(config.baseArea);
    const ratio = config.defaultGridColumns / config.defaultGridRows;
    const newSide = Math.sqrt(area);
    const scale = newSide / baseSide;
    const newColumns = Math.max(1, Math.round(config.defaultGridColumns * scale));
    const newRows = Math.max(1, Math.round(newColumns / ratio));
    return {
      columns: newColumns,
      rows: newRows,
      worldWidth: newColumns * 40,
      worldHeight: newRows * 40
    };
  }

  getGameDate() {
    const state = this.getState();
    if (state.time) {
      return {
        year: Number(state.time.year) || 1,
        month: Number(state.time.month) || 1,
        day: Number(state.time.day) || 1
      };
    }
    return { year: 1, month: 1, day: 1 };
  }
}

module.exports = ExpansionSystem;