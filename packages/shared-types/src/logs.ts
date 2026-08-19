import type { FoodItem } from './nutrition.js';
import type { RecipeRef } from './recipe.js';

export interface WeightLog {
  id: string;
  userId: string;
  weightKg: number;
  loggedAt: string;
  note: string | null;
}

export interface CreateWeightLogRequest {
  weightKg: number;
  loggedAt?: string;
  note?: string;
}

export type ActivityIntensity = 'low' | 'moderate' | 'high';

export interface ActivityLog {
  id: string;
  userId: string;
  activityType: string;
  durationMinutes: number;
  caloriesBurned: number | null;
  intensity: ActivityIntensity;
  loggedAt: string;
}

export interface CreateActivityLogRequest {
  activityType: string;
  durationMinutes: number;
  caloriesBurned?: number;
  intensity: ActivityIntensity;
  loggedAt?: string;
}

export type NutritionLogSource = 'meal_plan' | 'manual' | 'search' | 'recipe';

export interface DailyNutritionLog {
  id: string;
  userId: string;
  date: string;
  /** Resolved food, not just an id — a manual entry has none of these three. */
  foodItem: FoodItem | null;
  mealPlanItemId: string | null;
  recipe: RecipeRef | null;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: NutritionLogSource;
  loggedAt: string;
}

export interface CreateManualNutritionLogRequest {
  source: 'manual';
  date?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface CreateMealPlanNutritionLogRequest {
  source: 'meal_plan';
  date?: string;
  mealPlanItemId: string;
  /** Defaults to the plan item's own serving count — "I ate what was planned." */
  servings?: number;
}

export interface CreateSearchNutritionLogRequest {
  source: 'search';
  date?: string;
  /** A food from a prior search result. */
  foodItemId: number;
  servings: number;
}

export interface CreateRecipeNutritionLogRequest {
  source: 'recipe';
  date?: string;
  recipeId: string;
  servings: number;
}

export type CreateNutritionLogRequest =
  | CreateManualNutritionLogRequest
  | CreateMealPlanNutritionLogRequest
  | CreateSearchNutritionLogRequest
  | CreateRecipeNutritionLogRequest;
