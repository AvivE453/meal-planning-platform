import { IsIn, IsString, MinLength } from 'class-validator';
import type { RestrictionType } from '@meal-planning/shared-types';

const RESTRICTION_TYPE_VALUES: RestrictionType[] = [
  'allergy',
  'intolerance',
  'preference',
];

export class CreateRestrictionDto {
  @IsIn(RESTRICTION_TYPE_VALUES)
  type!: RestrictionType;

  @IsString()
  @MinLength(1)
  value!: string;
}
