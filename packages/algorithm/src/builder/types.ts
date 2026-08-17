import type { FoodItem, Goal, MacroTargets, MealSlot } from '@meal-planning/shared-types';

/**
 * Pre-persistence shapes: no id/createdAt yet — those are assigned when
 * MealPlansService writes the built draft to Postgres.
 */
export interface MealPlanItemDraft {
  foodItem: FoodItem;
  mealSlot: MealSlot;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sortOrder: number;
}

export interface MealPlanTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealPlanDraft {
  userId: string;
  date: string;
  goalSnapshot: Goal;
  calorieTarget: number;
  macroTargets: MacroTargets;
  items: readonly MealPlanItemDraft[];
  totals: MealPlanTotals;
}
