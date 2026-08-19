import type { FoodItem } from './nutrition.js';
import type { MealSlot } from './meal-plan.js';

export interface RecipeIngredient {
  id: string;
  foodItem: FoodItem;
  amount: number;
  sortOrder: number;
}

/**
 * A user's own reusable composed meal — 1x a Recipe is defined as the sum of
 * all its ingredients at their given amounts. No separate yield/serving-count
 * field: that would need its own scaling math on top of what each
 * ingredient's `amount` already does.
 */
export interface Recipe {
  id: string;
  userId: string;
  name: string;
  mealSlot: MealSlot;
  ingredients: RecipeIngredient[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  saturatedFatG: number;
  sugarG: number;
  sodiumMg: number;
  createdAt: string;
}

/**
 * Just enough to identify a recipe when embedded in a MealPlanItem or
 * DailyNutritionLog — deliberately not the recipe's own base macros, since
 * the embedding item already has its own servings-scaled calories/macros.
 * Carrying both would put two different calorie numbers on screen for one item.
 */
export interface RecipeRef {
  id: string;
  name: string;
}

export interface CreateRecipeIngredientRequest {
  /** An ingredient from our durable food_items table. */
  foodItemId: number;
  amount: number;
}

export interface CreateRecipeRequest {
  name: string;
  mealSlot: MealSlot;
  ingredients: CreateRecipeIngredientRequest[];
}
