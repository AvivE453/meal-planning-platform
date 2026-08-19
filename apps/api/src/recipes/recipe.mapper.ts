import type { Recipe, RecipeRef } from '@meal-planning/shared-types';
import type { Prisma } from '../../generated/prisma/client';
import { toFoodItem } from '../nutrition/food-item-persistence';
import { aggregateNutrition } from './recipe-nutrition';

export type PrismaRecipeWithIngredients = Prisma.RecipeGetPayload<{
  include: { ingredients: { include: { foodItem: true } } };
}>;

export function toRecipe(row: PrismaRecipeWithIngredients): Recipe {
  const ingredients = row.ingredients
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ingredient) => ({
      id: ingredient.id,
      foodItem: toFoodItem(ingredient.foodItem),
      amount: Number(ingredient.amount),
      sortOrder: ingredient.sortOrder,
    }));

  const totals = aggregateNutrition(ingredients);

  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    mealSlot: row.mealSlot,
    ingredients,
    ...totals,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRecipeRef(row: { id: string; name: string }): RecipeRef {
  return { id: row.id, name: row.name };
}
