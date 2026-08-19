import type { Goal } from './user.js';
import type { FoodItem } from './nutrition.js';
import type { RecipeRef } from './recipe.js';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealPlanStatus = 'draft' | 'active' | 'completed';

export interface MealPlanItem {
  id: string;
  mealPlanId: string;
  /** Exactly one of foodItem/recipe is set, depending on where this item came from. */
  foodItem: FoodItem | null;
  recipe: RecipeRef | null;
  mealSlot: MealSlot;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sortOrder: number;
}

export interface MealPlan {
  id: string;
  userId: string;
  date: string; // ISO date
  goalSnapshot: Goal;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  status: MealPlanStatus;
  items: MealPlanItem[];
  createdAt: string;
}

export interface GenerateMealPlanRequest {
  date: string; // ISO date
}

export interface AddMealPlanItemRequest {
  mealSlot: MealSlot;
  /** Exactly one of recipeId/foodItemId must be set. */
  recipeId?: string;
  foodItemId?: number;
  servings: number;
}
