import { Injectable } from '@nestjs/common';
import type { NutritionSummaryDay } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { DateRangeQueryDto } from '../logs/dto/date-range-query.dto';

const DEFAULT_RANGE_DAYS = 14;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One row per calendar day in range: actual totals summed from
   * daily_nutrition_logs, planned totals from that day's most-recently-created
   * MealPlan (null if none was ever generated for that day — not zero).
   */
  async getNutritionSummary(
    userId: string,
    range: DateRangeQueryDto,
  ): Promise<NutritionSummaryDay[]> {
    const to = range.to ? new Date(range.to) : startOfTodayUtc();
    const from = range.from
      ? new Date(range.from)
      : new Date(
          Date.UTC(
            to.getUTCFullYear(),
            to.getUTCMonth(),
            to.getUTCDate() - (DEFAULT_RANGE_DAYS - 1),
          ),
        );

    const [actualRows, plans] = await Promise.all([
      this.prisma.dailyNutritionLog.groupBy({
        by: ['date'],
        where: { userId, date: { gte: from, lte: to } },
        _sum: { calories: true, proteinG: true, carbsG: true, fatG: true },
      }),
      this.prisma.mealPlan.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        select: {
          date: true,
          calorieTarget: true,
          proteinTargetG: true,
          carbsTargetG: true,
          fatTargetG: true,
        },
      }),
    ]);

    const actualByDate = new Map(
      actualRows.map((row) => [dateKey(row.date), row._sum]),
    );
    // Plans are ordered newest-created-first, so the first one seen per date
    // is the most recent — later duplicates for the same date are ignored.
    const plannedByDate = new Map<string, (typeof plans)[number]>();
    for (const plan of plans) {
      const key = dateKey(plan.date);
      if (!plannedByDate.has(key)) {
        plannedByDate.set(key, plan);
      }
    }

    const days: NutritionSummaryDay[] = [];
    for (
      let cursor = new Date(from);
      cursor.getTime() <= to.getTime();
      cursor = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate() + 1,
        ),
      )
    ) {
      const key = dateKey(cursor);
      const actual = actualByDate.get(key);
      const planned = plannedByDate.get(key);
      days.push({
        date: key,
        actualCalories: Number(actual?.calories ?? 0),
        actualProteinG: Number(actual?.proteinG ?? 0),
        actualCarbsG: Number(actual?.carbsG ?? 0),
        actualFatG: Number(actual?.fatG ?? 0),
        plannedCalories: planned ? Number(planned.calorieTarget) : null,
        plannedProteinG: planned ? Number(planned.proteinTargetG) : null,
        plannedCarbsG: planned ? Number(planned.carbsTargetG) : null,
        plannedFatG: planned ? Number(planned.fatTargetG) : null,
      });
    }
    return days;
  }
}
