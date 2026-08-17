import { describe, expect, it } from 'vitest';
import { WeightLossStrategy } from './WeightLossStrategy.js';
import { makeUserProfile } from '../testing/fixtures.js';

const strategy = new WeightLossStrategy();

describe('WeightLossStrategy', () => {
  it('applies the default ~0.45kg/week deficit when the user has no custom rate', () => {
    const profile = makeUserProfile({ weeklyRateKg: null });
    const target = strategy.calculateDailyCalorieTarget(profile, 2500);
    expect(target).toBeCloseTo(2500 - (0.45 * 7700) / 7, 5);
  });

  it('scales the deficit with the user-provided weekly rate', () => {
    const profile = makeUserProfile({ weeklyRateKg: 0.9 });
    const target = strategy.calculateDailyCalorieTarget(profile, 2500);
    expect(target).toBeCloseTo(2500 - (0.9 * 7700) / 7, 5);
  });

  it('produces macro grams that reconstruct the calorie target', () => {
    const calorieTarget = 1800;
    const macros = strategy.calculateMacroTargets(calorieTarget);
    const reconstructed = macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9;
    expect(reconstructed).toBeCloseTo(calorieTarget, 5);
  });

  it('weights protein highest to preserve lean mass under a deficit', () => {
    const weights = strategy.getMacroWeights();
    expect(weights.protein).toBeGreaterThan(weights.carbs);
    expect(weights.protein).toBeGreaterThan(weights.fat);
  });

  it('excludes high-sugar items at 20g/serving', () => {
    const [rule] = strategy.getExclusionRules();
    expect(rule).toEqual({ trait: 'sugar_g', maxPerServing: 20 });
  });
});
