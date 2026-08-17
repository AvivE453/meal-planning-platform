import type { MealSlot } from '@meal-planning/shared-types';

export const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Rough calorie split across the day; must sum to 1. */
export const SLOT_CALORIE_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

/**
 * Edamam's Food Database API is search-by-text, not browse-by-category, so
 * there's no "give me breakfast foods" call to make. Candidate pools per slot
 * instead come from a small, fixed set of representative search terms — a
 * deliberate scope simplification for a portfolio project (a production
 * system would let users pick preferred foods/cuisines, or index a much
 * larger food catalog directly rather than round-tripping a text search API).
 */
export const SLOT_CANDIDATE_QUERIES: Record<MealSlot, string[]> = {
  breakfast: ['eggs', 'oatmeal', 'greek yogurt'],
  lunch: ['chicken breast', 'brown rice', 'mixed vegetables'],
  dinner: ['salmon', 'sweet potato', 'broccoli'],
  snack: ['almonds', 'apple', 'cottage cheese'],
};
