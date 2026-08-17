import type { NutritionApiClient } from '../clients/nutrition-api-client.interface';
import type {
  EdamamNutrientsResponse,
  EdamamParserResponse,
} from '../adapters/edamam-response.type';

/**
 * Stands in for the real network client in tests, behind the same interface
 * the Proxy implements — the rest of the pipeline (guard, service, the real
 * Adapter) runs unmodified, only the network call is replaced.
 */
export class FakeNutritionApiClient implements NutritionApiClient {
  calls: string[] = [];
  nutrientCalls: { foodId: string; measureUri: string; quantity: number }[] =
    [];

  search(query: string): Promise<EdamamParserResponse> {
    this.calls.push(query);
    return Promise.resolve({
      hints: [
        {
          food: {
            foodId: 'food_fake_chicken',
            label: `${query} (fake result)`,
            category: 'generic-foods',
            nutrients: {
              ENERC_KCAL: 165,
              PROCNT: 31,
              FAT: 3.6,
              CHOCDF: 0,
              SUGAR: 0,
              NA: 74,
            },
          },
          measures: [
            { uri: 'x#gram', label: 'Gram', weight: 1 },
            { uri: 'x#serving', label: 'Serving', weight: 100 },
          ],
        },
      ],
    });
  }

  getNutrients(
    foodId: string,
    measureUri: string,
    quantity: number,
  ): Promise<EdamamNutrientsResponse> {
    this.nutrientCalls.push({ foodId, measureUri, quantity });
    // Shape matches a real verified response (see EdamamNutrientsResponse doc comment).
    return Promise.resolve({
      calories: 326,
      totalWeight: 272,
      totalNutrients: {
        ENERC_KCAL: { label: 'Energy', quantity: 326.4, unit: 'kcal' },
        PROCNT: { label: 'Protein', quantity: 61.2, unit: 'g' },
        FAT: { label: 'Fat', quantity: 7.13, unit: 'g' },
        CHOCDF: { label: 'Carbs', quantity: 0, unit: 'g' },
        SUGAR: { label: 'Sugars', quantity: 2.5, unit: 'g' },
        NA: { label: 'Sodium', quantity: 122.4, unit: 'mg' },
      },
    });
  }
}
