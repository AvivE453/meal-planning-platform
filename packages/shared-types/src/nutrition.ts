import type { Goal } from './user.js';

export type FoodSource = 'edamam' | 'usda';

/**
 * Normalized food item shape produced by a FoodItemAdapter (Adapter pattern),
 * regardless of which external provider it came from.
 */
export interface FoodItem {
  id: string;
  externalId: string;
  source: FoodSource;
  name: string;
  brand: string | null;
  calories: number; // per serving
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  sodiumMg: number;
  servingQty: number;
  servingUnit: string;
  /**
   * Provider-specific handle for the exact serving measure this item was
   * scaled to — needed to request a full, accurate nutrient breakdown
   * (search results carry Edamam's fast/incomplete nutrient set; sugar and
   * sodium in particular need a follow-up GET /foods/:id/nutrients call).
   */
  measureUri?: string;
}

/** Full, per-serving nutrient breakdown — the accurate figures search results don't carry. */
export interface NutrientBreakdown {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
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
