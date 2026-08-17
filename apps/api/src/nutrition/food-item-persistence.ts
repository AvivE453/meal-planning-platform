import type { FoodItem } from '@meal-planning/shared-types';
import type { Prisma } from '../../generated/prisma/client';

export type PrismaFoodItem = Prisma.FoodItemGetPayload<Record<string, never>>;

/**
 * Upserts the durable food_items row for a normalized FoodItem (keyed on
 * source+externalId — not every search hit gets a row, only foods actually
 * referenced by a plan or log, for FK integrity). Shared by anything that
 * persists a FoodItem: meal plan generation and nutrition logging both need
 * this same "resolve to a durable row" step. Takes a transaction client, not
 * PrismaService, so callers can upsert inside their own atomic write.
 */
export async function upsertFoodItem(
  tx: Prisma.TransactionClient,
  item: FoodItem,
): Promise<PrismaFoodItem> {
  return tx.foodItem.upsert({
    where: {
      source_externalId: { source: item.source, externalId: item.externalId },
    },
    update: {},
    create: {
      externalId: item.externalId,
      source: item.source,
      name: item.name,
      brand: item.brand,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      sugarG: item.sugarG,
      sodiumMg: item.sodiumMg,
      servingQty: item.servingQty,
      servingUnit: item.servingUnit,
      // Not Edamam's literal raw payload — callers only ever have the
      // normalized shape. Still satisfies this column's audit/FK-integrity
      // purpose. Cast needed: a named interface has no index signature, which
      // Prisma's structural InputJsonObject type requires.
      rawJson: item as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Reconstructs the normalized FoodItem from a durable food_items row. `id` is
 * deliberately the provider's external id, not the Postgres row's own uuid —
 * stays consistent with FoodItems coming straight out of search, both usable
 * with GET /foods/:id/nutrients the same way. */
export function toFoodItem(row: PrismaFoodItem): FoodItem {
  return {
    id: row.externalId,
    externalId: row.externalId,
    source: row.source,
    name: row.name,
    brand: row.brand,
    calories: Number(row.calories),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
    sugarG: Number(row.sugarG),
    sodiumMg: Number(row.sodiumMg),
    servingQty: Number(row.servingQty),
    servingUnit: row.servingUnit,
  };
}
