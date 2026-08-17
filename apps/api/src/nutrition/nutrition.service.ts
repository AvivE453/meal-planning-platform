import { Inject, Injectable } from '@nestjs/common';
import type { FoodItem, NutrientBreakdown } from '@meal-planning/shared-types';
import { EdamamFoodAdapter } from './adapters/edamam-food-adapter';
import {
  NUTRITION_API_CLIENT,
  type NutritionApiClient,
} from './clients/nutrition-api-client.interface';

@Injectable()
export class NutritionService {
  constructor(
    @Inject(NUTRITION_API_CLIENT) private readonly client: NutritionApiClient,
    private readonly adapter: EdamamFoodAdapter,
  ) {}

  async search(query: string): Promise<FoodItem[]> {
    const raw = await this.client.search(query);
    return this.adapter.adapt(raw);
  }

  async getNutrients(
    foodId: string,
    measureUri: string,
    quantity: number,
  ): Promise<NutrientBreakdown> {
    const raw = await this.client.getNutrients(foodId, measureUri, quantity);
    return this.adapter.adaptNutrients(raw);
  }
}
