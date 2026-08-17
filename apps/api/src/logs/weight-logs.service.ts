import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { WeightLog } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { WeightLog as PrismaWeightLog } from '../../generated/prisma/client';
import type { CreateWeightLogDto } from './dto/create-weight-log.dto';
import type { DateRangeQueryDto } from './dto/date-range-query.dto';
import { WEIGHT_LOGGED_EVENT } from './events/weight-logged.event';

@Injectable()
export class WeightLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateWeightLogDto): Promise<WeightLog> {
    const log = await this.prisma.weightLog.create({
      data: {
        userId,
        weightKg: dto.weightKg,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
        note: dto.note,
      },
    });
    // Observer: Subject = EventEmitter2, Observer = RecalculateTargetsListener.
    // A new weight entry can change TDEE, so any cached targets are now stale.
    // emitAsync (not emit) so this awaits the listener's cache deletion before
    // returning — a client polling targets right after this response should
    // never observe a stale cached value. Small added latency (one Redis DEL)
    // for a hard consistency guarantee, deliberately, not fire-and-forget.
    await this.eventEmitter.emitAsync(WEIGHT_LOGGED_EVENT, { userId });
    return toWeightLog(log);
  }

  async findAllByUserId(
    userId: string,
    range: DateRangeQueryDto,
  ): Promise<WeightLog[]> {
    const logs = await this.prisma.weightLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: range.from ? new Date(range.from) : undefined,
          lte: range.to ? new Date(range.to) : undefined,
        },
      },
      orderBy: { loggedAt: 'desc' },
    });
    return logs.map(toWeightLog);
  }

  async findLatestByUserId(userId: string): Promise<WeightLog | null> {
    const log = await this.prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
    });
    return log ? toWeightLog(log) : null;
  }

  async remove(userId: string, id: string): Promise<void> {
    const log = await this.prisma.weightLog.findUnique({ where: { id } });
    if (!log) {
      throw new NotFoundException('Weight log not found');
    }
    if (log.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.weightLog.delete({ where: { id } });
    // Deleting the latest entry changes what "latest weight" resolves to just
    // as much as logging a new one does — same staleness risk, same event.
    await this.eventEmitter.emitAsync(WEIGHT_LOGGED_EVENT, { userId });
  }
}

function toWeightLog(log: PrismaWeightLog): WeightLog {
  return {
    id: log.id,
    userId: log.userId,
    weightKg: Number(log.weightKg),
    loggedAt: log.loggedAt.toISOString(),
    note: log.note,
  };
}
