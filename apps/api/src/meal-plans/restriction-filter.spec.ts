import type {
  DietaryRestriction,
  FoodItem,
  Recipe,
} from '@meal-planning/shared-types';
import { filterByRestrictions } from './restriction-filter';
import { toRecipeCandidate } from '../recipes/recipe-candidate';

function food(
  overrides: Partial<FoodItem> & Pick<FoodItem, 'id' | 'name'>,
): FoodItem {
  return {
    company: null,
    category: 'Protein',
    calories: 100,
    proteinG: 1,
    carbsG: 1,
    fatG: 1,
    saturatedFatG: 0,
    sugarG: 1,
    sodiumMg: 1,
    baseUnit: '100g',
    defaultServingWeightGrams: 100,
    ...overrides,
  };
}

function restriction(value: string): DietaryRestriction {
  return {
    id: 'r',
    userId: 'u',
    type: 'allergy',
    value,
    createdAt: new Date().toISOString(),
  };
}

describe('filterByRestrictions', () => {
  it('returns all items unchanged when there are no restrictions', () => {
    const items = [food({ id: 'a', name: 'Peanut Butter' })];
    expect(filterByRestrictions(items, [])).toEqual(items);
  });

  it('excludes items whose name contains a restricted term, case-insensitively', () => {
    const items = [
      food({ id: 'a', name: 'Peanut Butter Toast' }),
      food({ id: 'b', name: 'Chicken Breast' }),
    ];
    const result = filterByRestrictions(items, [restriction('PEANUT')]);
    expect(result.map((i) => i.id)).toEqual(['b']);
  });

  it('applies multiple restrictions as OR — any match excludes the item', () => {
    const items = [
      food({ id: 'a', name: 'Peanut Butter' }),
      food({ id: 'b', name: 'Whole Milk' }),
      food({ id: 'c', name: 'Grilled Chicken' }),
    ];
    const result = filterByRestrictions(items, [
      restriction('peanut'),
      restriction('milk'),
    ]);
    expect(result.map((i) => i.id)).toEqual(['c']);
  });

  it('keeps an item whose name does not contain any restricted term', () => {
    const items = [food({ id: 'a', name: 'Grilled Chicken' })];
    expect(filterByRestrictions(items, [restriction('shellfish')])).toEqual(
      items,
    );
  });

  describe('recipe candidates — checks ingredientNames too, not just the display name', () => {
    function recipe(
      overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>,
    ): Recipe {
      return {
        userId: 'u',
        mealSlot: 'lunch',
        ingredients: [],
        calories: 300,
        proteinG: 20,
        carbsG: 30,
        fatG: 10,
        saturatedFatG: 3,
        sugarG: 2,
        sodiumMg: 100,
        createdAt: new Date().toISOString(),
        ...overrides,
      };
    }

    it('excludes a recipe whose own name is clean but contains a restricted ingredient', () => {
      const spaghetti = recipe({
        id: 'r1',
        name: 'Spaghetti Bolognese',
        ingredients: [
          {
            id: 'i1',
            foodItem: food({ id: 'pasta', name: 'Spaghetti' }),
            amount: 2,
            sortOrder: 0,
          },
          {
            id: 'i2',
            foodItem: food({ id: 'parmesan', name: 'Parmesan Cheese' }),
            amount: 1,
            sortOrder: 1,
          },
        ],
      });
      const candidate = toRecipeCandidate(spaghetti);

      // Substring match, same as everywhere else in this filter — 'dairy'
      // itself wouldn't match "Parmesan Cheese" literally, so the restriction
      // value has to be a real substring, same crude-but-honest tradeoff the
      // plain-FoodItem tests above already exercise.
      const result = filterByRestrictions([candidate], [restriction('cheese')]);
      expect(result).toHaveLength(0);
    });

    it('keeps a recipe whose name and ingredients are both clean', () => {
      const chickenRice = recipe({
        id: 'r2',
        name: 'Chicken and Rice',
        ingredients: [
          {
            id: 'i3',
            foodItem: food({ id: 'chicken', name: 'Chicken Breast' }),
            amount: 1,
            sortOrder: 0,
          },
          {
            id: 'i4',
            foodItem: food({ id: 'rice', name: 'Brown Rice' }),
            amount: 1,
            sortOrder: 1,
          },
        ],
      });
      const candidate = toRecipeCandidate(chickenRice);

      const result = filterByRestrictions([candidate], [restriction('cheese')]);
      expect(result).toHaveLength(1);
    });
  });
});
