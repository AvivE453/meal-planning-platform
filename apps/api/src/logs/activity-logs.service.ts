import { Injectable } from '@nestjs/common';
import type { ActivityLog } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { ActivityLog as PrismaActivityLog } from '../../generated/prisma/client';
import type { CreateActivityLogDto } from './dto/create-activity-log.dto';
import type { DateRangeQueryDto } from './dto/date-range-query.dto';

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateActivityLogDto,
  ): Promise<ActivityLog> {
    const log = await this.prisma.activityLog.create({
      data: {
        userId,
        activityType: dto.activityType,
        durationMinutes: dto.durationMinutes,
        caloriesBurned: dto.caloriesBurned,
        intensity: dto.intensity,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      },
    });
    return toActivityLog(log);
  }

  async findAllByUserId(
    userId: string,
    range: DateRangeQueryDto,
  ): Promise<ActivityLog[]> {
    const logs = await this.prisma.activityLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: range.from ? new Date(range.from) : undefined,
          lte: range.to ? new Date(range.to) : undefined,
        },
      },
      orderBy: { loggedAt: 'desc' },
    });
    return logs.map(toActivityLog);
  }
}

function toActivityLog(log: PrismaActivityLog): ActivityLog {
  return {
    id: log.id,
    userId: log.userId,
    activityType: log.activityType,
    durationMinutes: log.durationMinutes,
    caloriesBurned:
      log.caloriesBurned !== null ? Number(log.caloriesBurned) : null,
    intensity: log.intensity,
    loggedAt: log.loggedAt.toISOString(),
  };
}
