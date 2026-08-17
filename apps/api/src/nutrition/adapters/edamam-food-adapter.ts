import { Injectable } from '@nestjs/common';
import type { FoodItem, NutrientBreakdown } from '@meal-planning/shared-types';
import type { FoodItemAdapter } from './food-item-adapter.interface';
import type {
  EdamamHint,
  EdamamMeasure,
  EdamamNutrientsResponse,
  EdamamParserResponse,
} from './edamam-response.type';

const SERVING_LABEL_PATTERN = /serving/i;
const GRAM_LABEL_PATTERN = /^gram/i;
const FALLBACK_MEASURE: EdamamMeasure = { uri: '', label: 'Gram', weight: 100 };

/**
 * Normalizes Edamam's raw parser response into internal FoodItem objects.
 * Everything downstream of the Proxy only ever sees FoodItem — this is the
 * only place that knows Edamam's field names (ENERC_KCAL, PROCNT, ...) exist.
 */
@Injectable()
export class EdamamFoodAdapter implements FoodItemAdapter {
  adapt(raw: unknown): FoodItem[] {
    const response = raw as EdamamParserResponse;
    const hints = response?.hints ?? [];
    return hints
      .map((hint) => this.adaptHint(hint))
      .filter((item): item is FoodItem => item !== null);
  }

  /**
   * Maps a POST /nutrients response — already scaled to the requested
   * quantity/measure, no further math needed — into our internal shape.
   * Search's /parser endpoint doesn't return sugar/sodium for most items;
   * this is the accurate follow-up call for a specific chosen food.
   */
  adaptNutrients(raw: unknown): NutrientBreakdown {
    const response = raw as EdamamNutrientsResponse;
    const n = response?.totalNutrients ?? {};
    return {
      calories: round(n.ENERC_KCAL?.quantity ?? 0),
      proteinG: round(n.PROCNT?.quantity ?? 0),
      carbsG: round(n.CHOCDF?.quantity ?? 0),
      fatG: round(n.FAT?.quantity ?? 0),
      sugarG: round(n.SUGAR?.quantity ?? 0),
      sodiumMg: round(n.NA?.quantity ?? 0),
    };
  }

  private adaptHint(hint: EdamamHint): FoodItem | null {
    const { food, measures } = hint;
    if (!food?.nutrients?.ENERC_KCAL) {
      // Some hints (e.g. generic "water") carry no usable macro data — skip
      // rather than surface a food the optimizer can't meaningfully score.
      return null;
    }

    const measure = pickServingMeasure(measures ?? []);
    // Edamam reports nutrients per 100g regardless of the chosen measure.
    const scale = measure.weight / 100;
    const nutrients = food.nutrients;

    return {
      id: food.foodId,
      externalId: food.foodId,
      source: 'edamam',
      name: food.label,
      brand: food.brand ?? null,
      calories: scaleNutrient(nutrients.ENERC_KCAL, scale),
      proteinG: scaleNutrient(nutrients.PROCNT, scale),
      carbsG: scaleNutrient(nutrients.CHOCDF, scale),
      fatG: scaleNutrient(nutrients.FAT, scale),
      sugarG: scaleNutrient(nutrients.SUGAR, scale),
      sodiumMg: scaleNutrient(nutrients.NA, scale),
      servingQty: 1,
      servingUnit: measure.label,
      measureUri: measure.uri || undefined,
    };
  }
}

/** Prefers a named "Serving" measure, falls back to "Gram", then whatever Edamam listed first. */
function pickServingMeasure(measures: EdamamMeasure[]): EdamamMeasure {
  return (
    measures.find((m) => SERVING_LABEL_PATTERN.test(m.label)) ??
    measures.find((m) => GRAM_LABEL_PATTERN.test(m.label)) ??
    measures[0] ??
    FALLBACK_MEASURE
  );
}

function scaleNutrient(value: number | undefined, scale: number): number {
  return round((value ?? 0) * scale);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
