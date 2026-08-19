import type { FoodItem, Recipe } from '@meal-planning/shared-types';
import {
  ingredientNamesOf,
  recipeIdOf,
  toRecipeCandidate,
} from './recipe-candidate';

function food(
  overrides: Partial<FoodItem> & Pick<FoodItem, 'id' | 'name'>,
): FoodItem {
  return {
    company: null,
    category: 'Grain',
    calories: 100,
    proteinG: 10,
    carbsG: 10,
    fatG: 5,
    saturatedFatG: 1,
    sugarG: 2,
    sodiumMg: 50,
    baseUnit: '100g',
    defaultServingWeightGrams: 100,
    ...overrides,
  };
}

const recipe: Recipe = {
  id: 'recipe-1',
  userId: 'user-1',
  name: 'Spaghetti Bolognese',
  mealSlot: 'dinner',
  ingredients: [
    {
      id: 'ing-1',
      foodItem: food({ id: 'spaghetti', name: 'Spaghetti' }),
      amount: 2,
      sortOrder: 0,
    },
    {
      id: 'ing-2',
      foodItem: food({ id: 'beef', name: 'Ground Beef' }),
      amount: 1,
      sortOrder: 1,
    },
  ],
  calories: 300,
  proteinG: 30,
  carbsG: 30,
  fatG: 15,
  saturatedFatG: 4,
  sugarG: 6,
  sodiumMg: 150,
  createdAt: new Date().toISOString(),
};

describe('toRecipeCandidate', () => {
  it('produces a valid FoodItem-shaped object carrying the recipe aggregate', () => {
    const candidate = toRecipeCandidate(recipe);

    expect(candidate).toMatchObject({
      id: 'recipe-1',
      name: 'Spaghetti Bolognese',
      category: 'Recipe',
      calories: 300,
      proteinG: 30,
      carbsG: 30,
      fatG: 15,
      saturatedFatG: 4,
      sugarG: 6,
      sodiumMg: 150,
      baseUnit: 'Recipe',
      defaultServingWeightGrams: 0,
    });
  });

  it('carries recipeId and ingredientNames for downstream use', () => {
    const candidate = toRecipeCandidate(recipe);

    expect(candidate.recipeId).toBe('recipe-1');
    expect(candidate.ingredientNames).toEqual(['Spaghetti', 'Ground Beef']);
  });
});

describe('recipeIdOf / ingredientNamesOf — the by-reference discriminant', () => {
  it('returns null for a plain FoodItem', () => {
    const item = food({ id: 'plain', name: 'Plain Food' });
    expect(recipeIdOf(item)).toBeNull();
    expect(ingredientNamesOf(item)).toBeNull();
  });

  it('returns the recipeId/ingredientNames for a RecipeCandidate', () => {
    const candidate = toRecipeCandidate(recipe);
    expect(recipeIdOf(candidate)).toBe('recipe-1');
    expect(ingredientNamesOf(candidate)).toEqual(['Spaghetti', 'Ground Beef']);
  });
});
