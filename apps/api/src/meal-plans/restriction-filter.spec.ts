import type { DietaryRestriction, FoodItem } from '@meal-planning/shared-types';
import { filterByRestrictions } from './restriction-filter';

function food(
  overrides: Partial<FoodItem> & Pick<FoodItem, 'id' | 'name'>,
): FoodItem {
  return {
    externalId: overrides.id,
    source: 'edamam',
    brand: null,
    calories: 100,
    proteinG: 1,
    carbsG: 1,
    fatG: 1,
    sugarG: 1,
    sodiumMg: 1,
    servingQty: 1,
    servingUnit: 'Gram',
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
});
