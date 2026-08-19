import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsIn,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { MealSlot } from '@meal-planning/shared-types';

const MEAL_SLOT_VALUES: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export class CreateRecipeIngredientDto {
  /** An ingredient from our durable food_items table. */
  @IsInt()
  @IsPositive()
  foodItemId!: number;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class CreateRecipeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(MEAL_SLOT_VALUES)
  mealSlot!: MealSlot;

  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  @ArrayMinSize(1)
  ingredients!: CreateRecipeIngredientDto[];
}
