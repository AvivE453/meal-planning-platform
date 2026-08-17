import { EdamamFoodAdapter } from './edamam-food-adapter';
import type {
  EdamamHint,
  EdamamNutrientsResponse,
  EdamamParserResponse,
} from './edamam-response.type';

const adapter = new EdamamFoodAdapter();

function hint(
  overrides: Partial<EdamamHint['food']>,
  measures: EdamamHint['measures'] = [],
): EdamamHint {
  return {
    food: {
      foodId: 'food_default',
      label: 'Default Food',
      category: 'generic-foods',
      nutrients: {
        ENERC_KCAL: 100,
        PROCNT: 10,
        FAT: 5,
        CHOCDF: 10,
        SUGAR: 2,
        NA: 50,
      },
      ...overrides,
    },
    measures,
  };
}

describe('EdamamFoodAdapter', () => {
  it('returns an empty array when hints is missing or empty', () => {
    expect(adapter.adapt({})).toEqual([]);
    expect(adapter.adapt({ hints: [] })).toEqual([]);
  });

  it('scales per-100g nutrients by the chosen serving measure weight', () => {
    // Chicken breast: 165 kcal/100g, a "Serving" measure of 172g -> scale 1.72
    const response: EdamamParserResponse = {
      hints: [
        hint(
          {
            foodId: 'food_chicken',
            label: 'Chicken breast, meat only, cooked',
            nutrients: {
              ENERC_KCAL: 165,
              PROCNT: 31,
              FAT: 3.6,
              CHOCDF: 0,
              SUGAR: 0,
              NA: 74,
            },
          },
          [
            { uri: 'x#gram', label: 'Gram', weight: 1 },
            { uri: 'x#serving', label: 'Serving', weight: 172 },
          ],
        ),
      ],
    };

    const [item] = adapter.adapt(response);

    expect(item).toMatchObject({
      id: 'food_chicken',
      externalId: 'food_chicken',
      source: 'edamam',
      name: 'Chicken breast, meat only, cooked',
      brand: null,
      servingUnit: 'Serving',
      servingQty: 1,
    });
    expect(item.calories).toBeCloseTo(165 * 1.72, 2);
    expect(item.proteinG).toBeCloseTo(31 * 1.72, 2);
    expect(item.sodiumMg).toBeCloseTo(74 * 1.72, 2);
  });

  it('falls back to a "Gram" measure when no "Serving" measure is present', () => {
    const response: EdamamParserResponse = {
      hints: [
        hint(
          { foodId: 'food_bar', label: 'Protein Bar', brand: 'GenericBrand' },
          [{ uri: 'x#gram', label: 'Gram', weight: 1 }],
        ),
      ],
    };

    const [item] = adapter.adapt(response);

    expect(item.brand).toBe('GenericBrand');
    expect(item.servingUnit).toBe('Gram');
    // weight 1 -> scale 0.01, i.e. per-gram values
    expect(item.calories).toBeCloseTo(1, 2);
  });

  it('falls back to the first listed measure when neither Serving nor Gram is present', () => {
    const response: EdamamParserResponse = {
      hints: [
        hint({ foodId: 'food_pkg' }, [
          { uri: 'x#package', label: 'Package', weight: 350 },
        ]),
      ],
    };

    const [item] = adapter.adapt(response);

    expect(item.servingUnit).toBe('Package');
    expect(item.calories).toBeCloseTo(100 * 3.5, 2);
  });

  it('falls back to a 100g default when a food has no measures at all', () => {
    const response: EdamamParserResponse = {
      hints: [hint({ foodId: 'food_nomeasure' }, [])],
    };

    const [item] = adapter.adapt(response);

    expect(item.servingUnit).toBe('Gram');
    expect(item.calories).toBeCloseTo(100, 2);
  });

  it('skips hints with no usable calorie data', () => {
    const response: EdamamParserResponse = {
      hints: [
        hint({ foodId: 'food_water', label: 'Water', nutrients: {} }, [
          { uri: 'x', label: 'Gram', weight: 1 },
        ]),
        hint({ foodId: 'food_valid' }, [
          { uri: 'x', label: 'Gram', weight: 1 },
        ]),
      ],
    };

    const items = adapter.adapt(response);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('food_valid');
  });

  it('maps multiple hints to multiple food items, preserving order', () => {
    const response: EdamamParserResponse = {
      hints: [
        hint({ foodId: 'food_a', label: 'A' }, [
          { uri: 'x', label: 'Gram', weight: 1 },
        ]),
        hint({ foodId: 'food_b', label: 'B' }, [
          { uri: 'x', label: 'Gram', weight: 1 },
        ]),
      ],
    };

    const items = adapter.adapt(response);

    expect(items.map((i) => i.id)).toEqual(['food_a', 'food_b']);
  });

  it('carries the chosen measure URI, needed for a later detailed-nutrients lookup', () => {
    const response: EdamamParserResponse = {
      hints: [
        hint({ foodId: 'food_chicken' }, [
          { uri: 'edamam.owl#Measure_serving', label: 'Serving', weight: 172 },
        ]),
      ],
    };

    const [item] = adapter.adapt(response);

    expect(item.measureUri).toBe('edamam.owl#Measure_serving');
  });
});

describe('EdamamFoodAdapter.adaptNutrients', () => {
  // Fixture matches a real verified POST /nutrients response for a chicken
  // breast (272g serving) — captured live against the actual Edamam API.
  const realChickenBreastResponse: EdamamNutrientsResponse = {
    calories: 326,
    totalWeight: 272,
    totalNutrients: {
      ENERC_KCAL: { label: 'Energy', quantity: 326.4, unit: 'kcal' },
      FAT: { label: 'Fat', quantity: 7.1264, unit: 'g' },
      CHOCDF: { label: 'Carbs', quantity: 0, unit: 'g' },
      SUGAR: { label: 'Sugars', quantity: 0, unit: 'g' },
      PROCNT: { label: 'Protein', quantity: 61.2, unit: 'g' },
      NA: { label: 'Sodium', quantity: 122.4, unit: 'mg' },
    },
  };

  it('maps totalNutrients quantities into a NutrientBreakdown', () => {
    const breakdown = adapter.adaptNutrients(realChickenBreastResponse);

    expect(breakdown).toEqual({
      calories: 326.4,
      proteinG: 61.2,
      carbsG: 0,
      fatG: 7.13,
      sugarG: 0,
      sodiumMg: 122.4,
    });
  });

  it('defaults missing nutrient entries to 0 rather than throwing', () => {
    expect(adapter.adaptNutrients({})).toEqual({
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      sugarG: 0,
      sodiumMg: 0,
    });
  });
});
