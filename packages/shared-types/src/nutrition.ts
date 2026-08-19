import type { Goal } from './user.js';

/**
 * An ingredient from the app's own curated food_items dataset. Every
 * nutrition value is defined per one `baseUnit` — almost always "100g", but
 * a genuinely discrete food (e.g. egg) instead uses a unit like "1 medium
 * egg" with its own per-egg values, so a recipe's `amount` multiplier never
 * needs unit-conversion math (amount=2 against a "1 medium egg" item means
 * "2 eggs"). `defaultServingWeightGrams` is the gram-equivalent of one
 * baseUnit, always populated (100 for the 100g default).
 */
export interface FoodItem {
  id: string;
  name: string;
  /** Brand/manufacturer this data is specific to (e.g. "Tnuva") — null for generic entries. */
  company: string | null;
  category: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  saturatedFatG: number;
  sugarG: number;
  sodiumMg: number;
  baseUnit: string;
  defaultServingWeightGrams: number;
}

/** Full nutrient breakdown — the accurate figures search results don't carry. */
export interface NutrientBreakdown {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  saturatedFatG: number;
  sugarG: number;
  sodiumMg: number;
}

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MacroWeights {
  protein: number;
  carbs: number;
  fat: number;
  sugarPenalty: number;
  sodiumPenalty: number;
}

export interface ExclusionRule {
  trait: 'sugar_g' | 'sodium_mg';
  maxPerServing: number;
}

export interface NutritionTargets {
  calorieTarget: number;
  macroTargets: MacroTargets;
  tdee: number;
  goal: Goal;
}
