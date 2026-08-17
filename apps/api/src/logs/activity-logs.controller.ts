import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type {
  ActivityLog,
  AuthenticatedUser,
} from '@meal-planning/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { ActivityLogsService } from './activity-logs.service';

@Controller('logs/activity')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateActivityLogDto,
  ): Promise<ActivityLog> {
    return this.activityLogsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() range: DateRangeQueryDto,
  ): Promise<ActivityLog[]> {
    return this.activityLogsService.findAllByUserId(user.id, range);
  }
}
