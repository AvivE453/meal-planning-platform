import type { FoodItem, NutrientBreakdown } from '@meal-planning/shared-types';

/**
 * A Recipe's aggregate nutrition — the sum of each ingredient's per-serving
 * values scaled by its amount. Deliberately the only scaling math a Recipe
 * has: there's no separate "yield" concept to divide by, so 1x a Recipe is
 * exactly this sum.
 */
export function aggregateNutrition(
  ingredients: { foodItem: FoodItem; amount: number }[],
): NutrientBreakdown {
  return ingredients.reduce<NutrientBreakdown>(
    (totals, { foodItem, amount }) => ({
      calories: totals.calories + foodItem.calories * amount,
      proteinG: totals.proteinG + foodItem.proteinG * amount,
      carbsG: totals.carbsG + foodItem.carbsG * amount,
      fatG: totals.fatG + foodItem.fatG * amount,
      saturatedFatG: totals.saturatedFatG + foodItem.saturatedFatG * amount,
      sugarG: totals.sugarG + foodItem.sugarG * amount,
      sodiumMg: totals.sodiumMg + foodItem.sodiumMg * amount,
    }),
    {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      saturatedFatG: 0,
      sugarG: 0,
      sodiumMg: 0,
    },
  );
}
