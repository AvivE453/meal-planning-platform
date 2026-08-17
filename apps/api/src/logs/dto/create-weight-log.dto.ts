import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateWeightLogDto {
  @IsNumber()
  @IsPositive()
  weightKg!: number;

  @IsOptional()
  @IsDateString()
  loggedAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
