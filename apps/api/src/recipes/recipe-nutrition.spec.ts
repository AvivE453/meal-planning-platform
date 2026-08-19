import type { FoodItem } from '@meal-planning/shared-types';
import { aggregateNutrition } from './recipe-nutrition';

function food(overrides: Partial<FoodItem> & Pick<FoodItem, 'id'>): FoodItem {
  return {
    name: 'Food',
    company: null,
    category: 'Grain',
    calories: 100,
    proteinG: 10,
    carbsG: 10,
    fatG: 5,
    saturatedFatG: 1,
    sugarG: 2,
    sodiumMg: 50,
    baseUnit: '100g',
    defaultServingWeightGrams: 100,
    ...overrides,
  };
}

describe('aggregateNutrition', () => {
  it('returns all zeros for no ingredients', () => {
    expect(aggregateNutrition([])).toEqual({
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      saturatedFatG: 0,
      sugarG: 0,
      sodiumMg: 0,
    });
  });

  it('scales a single ingredient by amount — "1 large egg"', () => {
    const egg = food({
      id: 'egg',
      name: 'Egg, large',
      category: 'Protein',
      calories: 72,
      proteinG: 6.3,
      carbsG: 0.4,
      fatG: 4.8,
      saturatedFatG: 1.6,
      sugarG: 0.2,
      sodiumMg: 71,
      baseUnit: '1 large egg',
      defaultServingWeightGrams: 50,
    });

    expect(aggregateNutrition([{ foodItem: egg, amount: 1 }])).toEqual({
      calories: 72,
      proteinG: 6.3,
      carbsG: 0.4,
      fatG: 4.8,
      saturatedFatG: 1.6,
      sugarG: 0.2,
      sodiumMg: 71,
    });
  });

  it('sums multiple ingredients, each scaled by its own amount', () => {
    const spaghetti = food({
      id: 'spaghetti',
      calories: 200,
      proteinG: 7,
      carbsG: 40,
      fatG: 1,
      saturatedFatG: 0.2,
      sugarG: 2,
      sodiumMg: 5,
    });
    const beef = food({
      id: 'beef',
      calories: 250,
      proteinG: 26,
      carbsG: 0,
      fatG: 17,
      saturatedFatG: 6,
      sugarG: 0,
      sodiumMg: 75,
    });

    const totals = aggregateNutrition([
      { foodItem: spaghetti, amount: 2 }, // 400 kcal
      { foodItem: beef, amount: 1.5 }, // 375 kcal
    ]);

    expect(totals.calories).toBeCloseTo(775, 5);
    expect(totals.proteinG).toBeCloseTo(53, 5); // 14 + 39
    expect(totals.carbsG).toBeCloseTo(80, 5);
    expect(totals.fatG).toBeCloseTo(27.5, 5); // 2 + 25.5
    expect(totals.saturatedFatG).toBeCloseTo(9.4, 5); // 0.4 + 9
    expect(totals.sugarG).toBeCloseTo(4, 5);
    expect(totals.sodiumMg).toBeCloseTo(122.5, 5); // 10 + 112.5
  });
});
