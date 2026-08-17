import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type {
  AuthenticatedUser,
  NutritionSummaryDay,
} from '@meal-planning/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DateRangeQueryDto } from '../logs/dto/date-range-query.dto';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('nutrition-summary')
  getNutritionSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() range: DateRangeQueryDto,
  ): Promise<NutritionSummaryDay[]> {
    return this.analyticsService.getNutritionSummary(user.id, range);
  }
}
