import type { FoodItem } from '@meal-planning/shared-types';
import type { Prisma } from '../../generated/prisma/client';

export type PrismaFoodItem = Prisma.FoodItemGetPayload<Record<string, never>>;

/**
 * Upserts a food_items row for a normalized FoodItem, keyed on the unique
 * `name`. Only ever called from the one-time seed script now — every food a
 * client can reference at runtime already has a durable row (search reads
 * food_items directly, and nothing creates fresh rows from client input).
 */
export async function upsertFoodItem(
  tx: Prisma.TransactionClient,
  item: Omit<FoodItem, 'id'>,
): Promise<PrismaFoodItem> {
  const data = {
    name: item.name,
    company: item.company,
    category: item.category,
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
    saturatedFatG: item.saturatedFatG,
    sugarG: item.sugarG,
    sodiumMg: item.sodiumMg,
    baseUnit: item.baseUnit,
    defaultServingWeightGrams: item.defaultServingWeightGrams,
  };
  return tx.foodItem.upsert({
    where: { name: item.name },
    update: data,
    create: data,
  });
}

/** Reconstructs the normalized FoodItem from a durable food_items row. */
export function toFoodItem(row: PrismaFoodItem): FoodItem {
  return {
    id: String(row.foodId),
    name: row.name,
    company: row.company,
    category: row.category,
    calories: Number(row.calories),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
    saturatedFatG: Number(row.saturatedFatG),
    sugarG: Number(row.sugarG),
    sodiumMg: Number(row.sodiumMg),
    baseUnit: row.baseUnit,
    defaultServingWeightGrams: Number(row.defaultServingWeightGrams),
  };
}
