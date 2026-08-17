import { describe, expect, it } from 'vitest';
import { MaintenanceStrategy } from './MaintenanceStrategy.js';
import { makeUserProfile } from '../testing/fixtures.js';

const strategy = new MaintenanceStrategy();

describe('MaintenanceStrategy', () => {
  it('targets TDEE exactly, regardless of weekly rate', () => {
    const profile = makeUserProfile({ weeklyRateKg: 0.9 });
    expect(strategy.calculateDailyCalorieTarget(profile, 2500)).toBe(2500);
  });

  it('produces macro grams that reconstruct the calorie target', () => {
    const calorieTarget = 2200;
    const macros = strategy.calculateMacroTargets(calorieTarget);
    const reconstructed = macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9;
    expect(reconstructed).toBeCloseTo(calorieTarget, 5);
  });

  it('has no hard exclusion rules', () => {
    expect(strategy.getExclusionRules()).toEqual([]);
  });
});
