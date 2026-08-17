import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DailyNutritionLog, FoodItem } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { toFoodItem, upsertFoodItem } from '../nutrition/food-item-persistence';
import type { CreateNutritionLogDto } from './dto/create-nutrition-log.dto';
import type { DateRangeQueryDto } from './dto/date-range-query.dto';

type PrismaLogWithFoodItem = Prisma.DailyNutritionLogGetPayload<{
  include: { foodItem: true };
}>;

@Injectable()
export class NutritionLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateNutritionLogDto,
  ): Promise<DailyNutritionLog> {
    switch (dto.source) {
      case 'manual':
        return this.createManual(userId, dto.date, {
          calories: dto.calories!,
          proteinG: dto.proteinG!,
          carbsG: dto.carbsG!,
          fatG: dto.fatG!,
        });
      case 'meal_plan':
        return this.createFromMealPlan(
          userId,
          dto.date,
          dto.mealPlanItemId!,
          dto.servings,
        );
      case 'search':
        if (dto.servings === undefined) {
          throw new BadRequestException(
            'servings is required when source is "search"',
          );
        }
        return this.createFromSearch(
          userId,
          dto.date,
          {
            ...dto.foodItem!,
            brand: dto.foodItem!.brand ?? null,
          },
          dto.servings,
        );
    }
  }

  async findAllByUserId(
    userId: string,
    range: DateRangeQueryDto,
  ): Promise<DailyNutritionLog[]> {
    const logs = await this.prisma.dailyNutritionLog.findMany({
      where: {
        userId,
        date: {
          gte: range.from ? new Date(range.from) : undefined,
          lte: range.to ? new Date(range.to) : undefined,
        },
      },
      include: { foodItem: true },
      orderBy: { loggedAt: 'desc' },
    });
    return logs.map(toDailyNutritionLog);
  }

  async remove(userId: string, id: string): Promise<void> {
    const log = await this.prisma.dailyNutritionLog.findUnique({
      where: { id },
    });
    if (!log) {
      throw new NotFoundException('Nutrition log not found');
    }
    if (log.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.dailyNutritionLog.delete({ where: { id } });
  }

  private async createManual(
    userId: string,
    date: string | undefined,
    totals: {
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
    },
  ): Promise<DailyNutritionLog> {
    const log = await this.prisma.dailyNutritionLog.create({
      data: {
        userId,
        date: resolveDate(date),
        foodItemId: null,
        mealPlanItemId: null,
        servings: 1,
        calories: totals.calories,
        proteinG: totals.proteinG,
        carbsG: totals.carbsG,
        fatG: totals.fatG,
        source: 'manual',
        loggedAt: new Date(),
      },
      include: { foodItem: true },
    });
    return toDailyNutritionLog(log);
  }

  private async createFromMealPlan(
    userId: string,
    date: string | undefined,
    mealPlanItemId: string,
    servingsOverride: number | undefined,
  ): Promise<DailyNutritionLog> {
    const item = await this.prisma.mealPlanItem.findUnique({
      where: { id: mealPlanItemId },
      include: { mealPlan: true, foodItem: true },
    });
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }
    if (item.mealPlan.userId !== userId) {
      throw new ForbiddenException();
    }

    // Per-serving values live on the durable food_items row (same one
    // meal-plan generation upserted) — scale by whatever was actually eaten,
    // defaulting to what the plan itself called for.
    const servings = servingsOverride ?? Number(item.servings);
    const perServing = item.foodItem;

    const log = await this.prisma.dailyNutritionLog.create({
      data: {
        userId,
        date: resolveDate(date),
        foodItemId: item.foodItemId,
        mealPlanItemId: item.id,
        servings,
        calories: Number(perServing.calories) * servings,
        proteinG: Number(perServing.proteinG) * servings,
        carbsG: Number(perServing.carbsG) * servings,
        fatG: Number(perServing.fatG) * servings,
        source: 'meal_plan',
        loggedAt: new Date(),
      },
      include: { foodItem: true },
    });
    return toDailyNutritionLog(log);
  }

  private async createFromSearch(
    userId: string,
    date: string | undefined,
    foodItem: FoodItem,
    servings: number,
  ): Promise<DailyNutritionLog> {
    return this.prisma.$transaction(async (tx) => {
      const foodItemRow = await upsertFoodItem(tx, foodItem);

      const log = await tx.dailyNutritionLog.create({
        data: {
          userId,
          date: resolveDate(date),
          foodItemId: foodItemRow.id,
          mealPlanItemId: null,
          servings,
          calories: foodItem.calories * servings,
          proteinG: foodItem.proteinG * servings,
          carbsG: foodItem.carbsG * servings,
          fatG: foodItem.fatG * servings,
          source: 'search',
          loggedAt: new Date(),
        },
        include: { foodItem: true },
      });
      return toDailyNutritionLog(log);
    });
  }
}

function resolveDate(date: string | undefined): Date {
  return date ? new Date(date) : new Date();
}

function toDailyNutritionLog(row: PrismaLogWithFoodItem): DailyNutritionLog {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date.toISOString().slice(0, 10),
    foodItem: row.foodItem ? toFoodItem(row.foodItem) : null,
    mealPlanItemId: row.mealPlanItemId,
    servings: Number(row.servings),
    calories: Number(row.calories),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
    source: row.source,
    loggedAt: row.loggedAt.toISOString(),
  };
}
