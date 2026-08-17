import type { FoodItem, UserProfile } from '@meal-planning/shared-types';

let counter = 0;

export function makeFoodItem(overrides: Partial<FoodItem> = {}): FoodItem {
  counter += 1;
  return {
    id: `food-${counter}`,
    externalId: `ext-${counter}`,
    source: 'edamam',
    name: `Test Food ${counter}`,
    brand: null,
    calories: 100,
    proteinG: 5,
    carbsG: 10,
    fatG: 2,
    sugarG: 1,
    sodiumMg: 50,
    servingQty: 1,
    servingUnit: 'serving',
    ...overrides,
  };
}

export function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    userId: 'user-1',
    sex: 'male',
    dateOfBirth: '1995-01-01',
    heightCm: 180,
    activityLevel: 'moderate',
    goal: 'maintenance',
    targetWeightKg: null,
    weeklyRateKg: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export const zeroWeights = {
  protein: 0,
  carbs: 0,
  fat: 0,
  sugarPenalty: 0,
  sodiumPenalty: 0,
};
