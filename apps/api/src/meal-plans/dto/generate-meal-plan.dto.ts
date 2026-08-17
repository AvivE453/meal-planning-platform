import { IsDateString, IsOptional } from 'class-validator';

export class GenerateMealPlanDto {
  /** Defaults to today (server date) when omitted. */
  @IsOptional()
  @IsDateString()
  date?: string;
}
