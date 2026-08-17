import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { FoodItem, MacroWeights } from '@meal-planning/shared-types';
import { optimizeSlot } from './KnapsackOptimizer.js';
import { makeFoodItem, zeroWeights } from '../testing/fixtures.js';

const proteinOnlyWeights: MacroWeights = { ...zeroWeights, protein: 1 };

describe('optimizeSlot — edge cases', () => {
  it('returns nothing for an empty candidate list', () => {
    expect(optimizeSlot([], 600, proteinOnlyWeights)).toEqual([]);
  });

  it('returns nothing when the budget is zero or negative', () => {
    const candidates = [makeFoodItem({ calories: 100 })];
    expect(optimizeSlot(candidates, 0, proteinOnlyWeights)).toEqual([]);
    expect(optimizeSlot(candidates, -50, proteinOnlyWeights)).toEqual([]);
  });

  it('returns nothing when every item is too large for the budget', () => {
    const candidates = [
      makeFoodItem({ calories: 800, proteinG: 40 }),
      makeFoodItem({ calories: 900, proteinG: 50 }),
    ];
    expect(optimizeSlot(candidates, 100, proteinOnlyWeights)).toEqual([]);
  });
});

describe('optimizeSlot — hand-verifiable cases', () => {
  it('picks the single higher-value item when it exactly fills the budget', () => {
    const highValue = makeFoodItem({ id: 'a', calories: 100, proteinG: 10 });
    const lowValue = makeFoodItem({ id: 'b', calories: 100, proteinG: 5 });

    const result = optimizeSlot([highValue, lowValue], 100, proteinOnlyWeights);

    expect(result).toEqual([{ item: highValue, servings: 1 }]);
  });

  it('combines two different items when that beats any single item/serving choice', () => {
    // D: 1x = 60kcal/8 protein, 1.5x = 90kcal/12 protein
    // E: 1x = 40kcal/5 protein
    // Budget 100kcal: D alone at 1.5x scores 12; D@1x + E@1x costs exactly 100kcal and scores 13.
    const itemD = makeFoodItem({ id: 'd', calories: 60, proteinG: 8 });
    const itemE = makeFoodItem({ id: 'e', calories: 40, proteinG: 5 });

    const result = optimizeSlot([itemD, itemE], 100, proteinOnlyWeights);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ item: itemD, servings: 1 });
    expect(result).toContainEqual({ item: itemE, servings: 1 });
  });

  it('never selects more than one serving-option for the same base item', () => {
    const item = makeFoodItem({ id: 'solo', calories: 50, proteinG: 6 });

    const result = optimizeSlot([item], 500, proteinOnlyWeights);

    // Best is the largest serving multiple (2x) that still fits, chosen exactly once.
    expect(result).toEqual([{ item, servings: 2 }]);
  });

  it('excludes items whose smallest serving already exceeds the budget', () => {
    const tooLarge = makeFoodItem({ id: 'big', calories: 1000, proteinG: 80 });
    const fits = makeFoodItem({ id: 'small', calories: 100, proteinG: 5 });

    const result = optimizeSlot([tooLarge, fits], 150, proteinOnlyWeights);

    expect(result.every((s) => s.item.id !== 'big')).toBe(true);
  });
});

describe('optimizeSlot — property-based invariants', () => {
  const foodItemArb: fc.Arbitrary<FoodItem> = fc.record({
    id: fc.uuid(),
    externalId: fc.uuid(),
    source: fc.constantFrom('edamam', 'usda'),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    brand: fc.constant(null),
    calories: fc.integer({ min: 10, max: 800 }),
    proteinG: fc.integer({ min: 0, max: 100 }),
    carbsG: fc.integer({ min: 0, max: 100 }),
    fatG: fc.integer({ min: 0, max: 100 }),
    sugarG: fc.integer({ min: 0, max: 50 }),
    sodiumMg: fc.integer({ min: 0, max: 2000 }),
    servingQty: fc.constant(1),
    servingUnit: fc.constant('serving'),
  });

  const weightsArb: fc.Arbitrary<MacroWeights> = fc.record({
    protein: fc.float({ min: 0, max: 5, noNaN: true }),
    carbs: fc.float({ min: 0, max: 5, noNaN: true }),
    fat: fc.float({ min: 0, max: 5, noNaN: true }),
    sugarPenalty: fc.float({ min: 0, max: 5, noNaN: true }),
    sodiumPenalty: fc.float({ min: 0, max: 5, noNaN: true }),
  });

  it('never selects total calories meaningfully over budget, and never repeats an item', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(foodItemArb, { minLength: 0, maxLength: 15, selector: (item) => item.id }),
        fc.integer({ min: 0, max: 2000 }),
        weightsArb,
        (candidates, calorieBudget, weights) => {
          const result = optimizeSlot(candidates, calorieBudget, weights);

          // Rounding to 10kcal buckets can push actual calories up to ~10kcal over
          // budget per selected item — bounded discretization error, not a bug.
          const totalCalories = result.reduce((sum, s) => sum + s.item.calories * s.servings, 0);
          expect(totalCalories).toBeLessThanOrEqual(calorieBudget + result.length * 10 + 1e-6);

          const ids = result.map((s) => s.item.id);
          expect(new Set(ids).size).toBe(ids.length);

          expect(result.length).toBeLessThanOrEqual(candidates.length);
        },
      ),
    );
  });
});
