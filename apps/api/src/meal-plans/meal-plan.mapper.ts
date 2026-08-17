import type { MealPlan, MealPlanItem } from '@meal-planning/shared-types';
import type { Prisma } from '../../generated/prisma/client';
import { toFoodItem } from '../nutrition/food-item-persistence';

type PrismaMealPlanWithItems = Prisma.MealPlanGetPayload<{
  include: { items: { include: { foodItem: true } } };
}>;

function toMealPlanItem(
  row: PrismaMealPlanWithItems['items'][number],
): MealPlanItem {
  return {
    id: row.id,
    mealPlanId: row.mealPlanId,
    foodItem: toFoodItem(row.foodItem),
    mealSlot: row.mealSlot,
    servings: Number(row.servings),
    calories: Number(row.calories),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
    sortOrder: row.sortOrder,
  };
}

export function toMealPlan(row: PrismaMealPlanWithItems): MealPlan {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date.toISOString().slice(0, 10),
    goalSnapshot: row.goalSnapshot,
    calorieTarget: Number(row.calorieTarget),
    proteinTargetG: Number(row.proteinTargetG),
    carbsTargetG: Number(row.carbsTargetG),
    fatTargetG: Number(row.fatTargetG),
    status: row.status,
    items: row.items.map(toMealPlanItem),
    createdAt: row.createdAt.toISOString(),
  };
}
