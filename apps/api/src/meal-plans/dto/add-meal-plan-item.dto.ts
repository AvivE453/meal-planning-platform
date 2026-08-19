import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import type { MealSlot } from '@meal-planning/shared-types';

const MEAL_SLOT_VALUES: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Adds a single item to an existing plan — the "Find meal" flow, distinct
 * from whole-plan generation. Exactly one of recipeId/foodItemId must be set;
 * class-validator can't express that as one declarative rule (same pattern
 * as CreateRecipeIngredientDto), so MealPlansService checks it.
 */
export class AddMealPlanItemDto {
  @IsIn(MEAL_SLOT_VALUES)
  mealSlot!: MealSlot;

  @IsOptional()
  @IsString()
  @MinLength(1)
  recipeId?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  foodItemId?: number;

  @IsNumber()
  @IsPositive()
  servings!: number;
}
