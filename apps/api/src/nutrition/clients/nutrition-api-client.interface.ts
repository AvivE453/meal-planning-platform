/**
 * Deliberately provider-agnostic: `search` returns raw, unnormalized provider
 * JSON (typed `unknown` here) — normalization is the Adapter's job, entirely
 * decoupled from whether the result came from cache or a live call. Adding a
 * second provider (e.g. USDA, per the plan's stretch goal) means adding a new
 * client + adapter pair, not touching this interface.
 */
export interface NutritionApiClient {
  search(query: string): Promise<unknown>;
  /** Full nutrient breakdown for one specific food + serving measure. */
  getNutrients(
    foodId: string,
    measureUri: string,
    quantity: number,
  ): Promise<unknown>;
}

export const NUTRITION_API_CLIENT = Symbol('NUTRITION_API_CLIENT');
