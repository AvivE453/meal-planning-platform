import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DailyNutritionLog } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { toFoodItem } from '../nutrition/food-item-persistence';
import { toRecipeRef } from '../recipes/recipe.mapper';
import { aggregateNutrition } from '../recipes/recipe-nutrition';
import type { CreateNutritionLogDto } from './dto/create-nutrition-log.dto';
import type { DateRangeQueryDto } from './dto/date-range-query.dto';

type PrismaLogWithRelations = Prisma.DailyNutritionLogGetPayload<{
  include: { foodItem: true; recipe: true };
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
          dto.foodItemId!,
          dto.servings,
        );
      case 'recipe':
        if (dto.servings === undefined) {
          throw new BadRequestException(
            'servings is required when source is "recipe"',
          );
        }
        return this.createFromRecipe(
          userId,
          dto.date,
          dto.recipeId!,
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
      include: { foodItem: true, recipe: true },
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
      include: { foodItem: true, recipe: true },
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
      include: {
        mealPlan: true,
        foodItem: true,
        recipe: { include: { ingredients: { include: { foodItem: true } } } },
      },
    });
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }
    if (item.mealPlan.userId !== userId) {
      throw new ForbiddenException();
    }

    const servings = servingsOverride ?? Number(item.servings);
    // Per-serving values come from wherever the item originally got its
    // nutrition — the durable food_items row meal-plan generation upserted,
    // or a recipe's own aggregate (1x) if it was a recipe-sourced item.
    const perServing = item.foodItem
      ? {
          calories: Number(item.foodItem.calories),
          proteinG: Number(item.foodItem.proteinG),
          carbsG: Number(item.foodItem.carbsG),
          fatG: Number(item.foodItem.fatG),
        }
      : aggregateNutrition(
          item.recipe!.ingredients.map((ingredient) => ({
            foodItem: toFoodItem(ingredient.foodItem),
            amount: Number(ingredient.amount),
          })),
        );

    const log = await this.prisma.dailyNutritionLog.create({
      data: {
        userId,
        date: resolveDate(date),
        foodItemId: item.foodItemId,
        mealPlanItemId: item.id,
        recipeId: item.recipeId,
        servings,
        calories: perServing.calories * servings,
        proteinG: perServing.proteinG * servings,
        carbsG: perServing.carbsG * servings,
        fatG: perServing.fatG * servings,
        source: 'meal_plan',
        loggedAt: new Date(),
      },
      include: { foodItem: true, recipe: true },
    });
    return toDailyNutritionLog(log);
  }

  private async createFromSearch(
    userId: string,
    date: string | undefined,
    foodItemId: number,
    servings: number,
  ): Promise<DailyNutritionLog> {
    const foodItem = await this.prisma.foodItem.findUnique({
      where: { foodId: foodItemId },
    });
    if (!foodItem) {
      throw new NotFoundException(`Food item ${foodItemId} not found`);
    }

    const log = await this.prisma.dailyNutritionLog.create({
      data: {
        userId,
        date: resolveDate(date),
        foodItemId: foodItem.foodId,
        mealPlanItemId: null,
        servings,
        calories: Number(foodItem.calories) * servings,
        proteinG: Number(foodItem.proteinG) * servings,
        carbsG: Number(foodItem.carbsG) * servings,
        fatG: Number(foodItem.fatG) * servings,
        source: 'search',
        loggedAt: new Date(),
      },
      include: { foodItem: true, recipe: true },
    });
    return toDailyNutritionLog(log);
  }

  private async createFromRecipe(
    userId: string,
    date: string | undefined,
    recipeId: string,
    servings: number,
  ): Promise<DailyNutritionLog> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: { include: { foodItem: true } } },
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }
    if (recipe.userId !== userId) {
      throw new ForbiddenException();
    }

    const perServing = aggregateNutrition(
      recipe.ingredients.map((ingredient) => ({
        foodItem: toFoodItem(ingredient.foodItem),
        amount: Number(ingredient.amount),
      })),
    );

    const log = await this.prisma.dailyNutritionLog.create({
      data: {
        userId,
        date: resolveDate(date),
        foodItemId: null,
        mealPlanItemId: null,
        recipeId: recipe.id,
        servings,
        calories: perServing.calories * servings,
        proteinG: perServing.proteinG * servings,
        carbsG: perServing.carbsG * servings,
        fatG: perServing.fatG * servings,
        source: 'recipe',
        loggedAt: new Date(),
      },
      include: { foodItem: true, recipe: true },
    });
    return toDailyNutritionLog(log);
  }
}

function resolveDate(date: string | undefined): Date {
  return date ? new Date(date) : new Date();
}

function toDailyNutritionLog(row: PrismaLogWithRelations): DailyNutritionLog {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date.toISOString().slice(0, 10),
    foodItem: row.foodItem ? toFoodItem(row.foodItem) : null,
    mealPlanItemId: row.mealPlanItemId,
    recipe: row.recipe ? toRecipeRef(row.recipe) : null,
    servings: Number(row.servings),
    calories: Number(row.calories),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
    source: row.source,
    loggedAt: row.loggedAt.toISOString(),
  };
}
