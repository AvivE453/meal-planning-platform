import { describe, expect, it } from 'vitest';
import { StrategyFactory } from './StrategyFactory.js';
import { WeightLossStrategy } from './WeightLossStrategy.js';
import { WeightGainStrategy } from './WeightGainStrategy.js';
import { MaintenanceStrategy } from './MaintenanceStrategy.js';

describe('StrategyFactory', () => {
  it('maps each goal to its matching strategy implementation', () => {
    expect(StrategyFactory.forGoal('weight_loss')).toBeInstanceOf(WeightLossStrategy);
    expect(StrategyFactory.forGoal('weight_gain')).toBeInstanceOf(WeightGainStrategy);
    expect(StrategyFactory.forGoal('maintenance')).toBeInstanceOf(MaintenanceStrategy);
  });

  it('returns the same strategy name as the goal it was requested for', () => {
    expect(StrategyFactory.forGoal('weight_loss').name).toBe('weight_loss');
    expect(StrategyFactory.forGoal('weight_gain').name).toBe('weight_gain');
    expect(StrategyFactory.forGoal('maintenance').name).toBe('maintenance');
  });
});
