import type { FoodItem, NutrientBreakdown } from '@meal-planning/shared-types';

export interface FoodItemAdapter {
  adapt(raw: unknown): FoodItem[];
  adaptNutrients(raw: unknown): NutrientBreakdown;
}
