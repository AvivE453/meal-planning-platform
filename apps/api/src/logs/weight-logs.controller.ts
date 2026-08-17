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
import type { AuthenticatedUser, WeightLog } from '@meal-planning/shared-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWeightLogDto } from './dto/create-weight-log.dto';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { WeightLogsService } from './weight-logs.service';

@Controller('logs/weight')
@UseGuards(JwtAuthGuard)
export class WeightLogsController {
  constructor(private readonly weightLogsService: WeightLogsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWeightLogDto,
  ): Promise<WeightLog> {
    return this.weightLogsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() range: DateRangeQueryDto,
  ): Promise<WeightLog[]> {
    return this.weightLogsService.findAllByUserId(user.id, range);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.weightLogsService.remove(user.id, id);
  }
}
