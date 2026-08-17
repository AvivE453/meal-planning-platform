import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { NutritionLogSource } from '@meal-planning/shared-types';
import { FoodItemDto } from './food-item.dto';

const NUTRITION_LOG_SOURCE_VALUES: NutritionLogSource[] = [
  'meal_plan',
  'manual',
  'search',
];

/**
 * One DTO for all three log sources, fields required conditionally on
 * `source` via @ValidateIf — mirrors the CreateNutritionLogRequest
 * discriminated union in shared-types without needing three separate routes.
 */
export class CreateNutritionLogDto {
  @IsIn(NUTRITION_LOG_SOURCE_VALUES)
  source!: NutritionLogSource;

  @IsOptional()
  @IsDateString()
  date?: string;

  // source: 'manual' — raw totals, no food/plan reference.
  @ValidateIf((o: CreateNutritionLogDto) => o.source === 'manual')
  @IsNumber()
  @IsPositive()
  calories?: number;

  @ValidateIf((o: CreateNutritionLogDto) => o.source === 'manual')
  @IsNumber()
  @Min(0)
  proteinG?: number;

  @ValidateIf((o: CreateNutritionLogDto) => o.source === 'manual')
  @IsNumber()
  @Min(0)
  carbsG?: number;

  @ValidateIf((o: CreateNutritionLogDto) => o.source === 'manual')
  @IsNumber()
  @Min(0)
  fatG?: number;

  // source: 'meal_plan' — references an item from an already-generated plan.
  @ValidateIf((o: CreateNutritionLogDto) => o.source === 'meal_plan')
  @IsString()
  @MinLength(1)
  mealPlanItemId?: string;

  // source: 'search' — the FoodItem the client already has from a prior search response.
  @ValidateIf((o: CreateNutritionLogDto) => o.source === 'search')
  @ValidateNested()
  @Type(() => FoodItemDto)
  foodItem?: FoodItemDto;

  // Servings eaten: optional for 'meal_plan' (defaults to the plan item's own
  // serving count), meaningless for 'manual' (the totals given already
  // represent what was eaten). Required for 'search', but class-validator
  // can't express "optional for A, required for B" on one property cleanly —
  // NutritionLogsService enforces that one at the service layer instead.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  servings?: number;
}
