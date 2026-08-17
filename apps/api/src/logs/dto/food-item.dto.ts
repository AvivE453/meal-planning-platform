import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { FoodSource } from '@meal-planning/shared-types';

const FOOD_SOURCE_VALUES: FoodSource[] = ['edamam', 'usda'];

/** Validates the FoodItem a client sends back from a prior search when logging it as eaten. */
export class FoodItemDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  externalId!: string;

  @IsIn(FOOD_SOURCE_VALUES)
  source!: FoodSource;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsNumber()
  calories!: number;

  @IsNumber()
  proteinG!: number;

  @IsNumber()
  carbsG!: number;

  @IsNumber()
  fatG!: number;

  @IsNumber()
  sugarG!: number;

  @IsNumber()
  sodiumMg!: number;

  @IsNumber()
  servingQty!: number;

  @IsString()
  @MinLength(1)
  servingUnit!: string;

  @IsOptional()
  @IsString()
  measureUri?: string;
}
