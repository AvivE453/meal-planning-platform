import type { Goal } from './user.js';
import type { FoodItem } from './nutrition.js';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealPlanStatus = 'draft' | 'active' | 'completed';

export interface MealPlanItem {
  id: string;
  mealPlanId: string;
  foodItem: FoodItem;
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
