import type { FoodItem } from './nutrition.js';

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

export type NutritionLogSource = 'meal_plan' | 'manual' | 'search';

export interface DailyNutritionLog {
  id: string;
  userId: string;
  date: string;
  /** Resolved food, not just an id — a manual entry has neither this nor a mealPlanItemId. */
  foodItem: FoodItem | null;
  mealPlanItemId: string | null;
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
  /** The full FoodItem the client already has in hand from a prior search — the server has no other way to resolve nutrition from just an id. */
  foodItem: FoodItem;
  servings: number;
}

export type CreateNutritionLogRequest =
  | CreateManualNutritionLogRequest
  | CreateMealPlanNutritionLogRequest
  | CreateSearchNutritionLogRequest;
