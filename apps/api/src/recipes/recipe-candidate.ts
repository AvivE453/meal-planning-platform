import type { FoodItem, Recipe } from '@meal-planning/shared-types';

/**
 * A saved Recipe, adapted into the exact shape the optimizer/builder already
 * expect (FoodItem) plus the two extra fields the rest of this app needs to
 * recognize it as a recipe. `optimizeSlot`/`MealPlanBuilder` only ever read
 * FoodItem's own fields and carry candidates through by reference — neither
 * clones or spreads them — so `recipeId`/`ingredientNames` survive untouched
 * all the way to persist(), readable there via `recipeIdOf()`. Zero changes
 * needed in packages/algorithm for any of this.
 */
export interface RecipeCandidate extends FoodItem {
  recipeId: string;
  ingredientNames: string[];
}

export function toRecipeCandidate(recipe: Recipe): RecipeCandidate {
  return {
    id: recipe.id,
    name: recipe.name,
    company: null,
    category: 'Recipe',
    calories: recipe.calories,
    proteinG: recipe.proteinG,
    carbsG: recipe.carbsG,
    fatG: recipe.fatG,
    saturatedFatG: recipe.saturatedFatG,
    sugarG: recipe.sugarG,
    sodiumMg: recipe.sodiumMg,
    baseUnit: 'Recipe',
    defaultServingWeightGrams: 0,
    recipeId: recipe.id,
    ingredientNames: recipe.ingredients.map(
      (ingredient) => ingredient.foodItem.name,
    ),
  };
}

/** The runtime discriminant the whole zero-algorithm-changes mechanism depends on. */
export function recipeIdOf(item: FoodItem): string | null {
  return 'recipeId' in item ? (item as RecipeCandidate).recipeId : null;
}

export function ingredientNamesOf(item: FoodItem): string[] | null {
  return 'ingredientNames' in item
    ? (item as RecipeCandidate).ingredientNames
    : null;
}
