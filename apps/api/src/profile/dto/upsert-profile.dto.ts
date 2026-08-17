import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';
import type { ActivityLevel, Goal, Sex } from '@meal-planning/shared-types';

const SEX_VALUES: Sex[] = ['male', 'female'];
const ACTIVITY_LEVEL_VALUES: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];
const GOAL_VALUES: Goal[] = ['weight_loss', 'weight_gain', 'maintenance'];

export class UpsertProfileDto {
  @IsIn(SEX_VALUES)
  sex!: Sex;

  @IsDateString()
  dateOfBirth!: string;

  @IsNumber()
  @IsPositive()
  heightCm!: number;

  @IsIn(ACTIVITY_LEVEL_VALUES)
  activityLevel!: ActivityLevel;

  @IsIn(GOAL_VALUES)
  goal!: Goal;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  weeklyRateKg?: number;
}
