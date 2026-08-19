/**
 * Raw Edamam Food Database API v2 (/parser) response shape — only the fields
 * this app actually reads. Field names (ENERC_KCAL, PROCNT, FAT, FASAT,
 * CHOCDF, SUGAR, NA) come straight from Edamam's nutrient ontology, verified
 * against https://developer.edamam.com/food-database-api-docs.
 */
export interface EdamamNutrients {
  ENERC_KCAL?: number;
  PROCNT?: number;
  FAT?: number;
  FASAT?: number;
  CHOCDF?: number;
  SUGAR?: number;
  NA?: number;
}

export interface EdamamMeasure {
  uri: string;
  label: string;
  weight: number;
}

export interface EdamamFood {
  foodId: string;
  label: string;
  brand?: string;
  category?: string;
  nutrients: EdamamNutrients;
}

export interface EdamamHint {
  food: EdamamFood;
  measures: EdamamMeasure[];
}

export interface EdamamParserResponse {
  text?: string;
  parsed?: EdamamHint[];
  hints?: EdamamHint[];
}

/**
 * Raw response shape for POST /api/food-database/v2/nutrients — verified
 * against a real call, since Edamam's published OpenAPI spec omits the
 * numeric `quantity` field entirely (a documentation gap, not a real one).
 * Unlike /parser, values here are already scaled to the requested quantity
 * and measure — no further math needed.
 */
export interface EdamamNutrientEntry {
  label: string;
  quantity: number;
  unit: string;
}

type EdamamNutrientTag =
  'ENERC_KCAL' | 'PROCNT' | 'FAT' | 'FASAT' | 'CHOCDF' | 'SUGAR' | 'NA';

export interface EdamamNutrientsResponse {
  calories?: number;
  totalWeight?: number;
  totalNutrients?: Partial<Record<EdamamNutrientTag, EdamamNutrientEntry>>;
}
