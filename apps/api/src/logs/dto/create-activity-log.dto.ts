import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import type { ActivityIntensity } from '@meal-planning/shared-types';

const ACTIVITY_INTENSITY_VALUES: ActivityIntensity[] = [
  'low',
  'moderate',
  'high',
];

export class CreateActivityLogDto {
  @IsString()
  @MinLength(1)
  activityType!: string;

  @IsInt()
  @IsPositive()
  durationMinutes!: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  caloriesBurned?: number;

  @IsIn(ACTIVITY_INTENSITY_VALUES)
  intensity!: ActivityIntensity;

  @IsOptional()
  @IsDateString()
  loggedAt?: string;
}
