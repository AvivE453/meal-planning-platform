import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  DailyNutritionLog,
} from '@meal-planning/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateNutritionLogDto } from './dto/create-nutrition-log.dto';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { NutritionLogsService } from './nutrition-logs.service';

@Controller('logs/nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionLogsController {
  constructor(private readonly nutritionLogsService: NutritionLogsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNutritionLogDto,
  ): Promise<DailyNutritionLog> {
    return this.nutritionLogsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() range: DateRangeQueryDto,
  ): Promise<DailyNutritionLog[]> {
    return this.nutritionLogsService.findAllByUserId(user.id, range);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.nutritionLogsService.remove(user.id, id);
  }
}
