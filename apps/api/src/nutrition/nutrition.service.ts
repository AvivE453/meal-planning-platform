import { Inject, Injectable } from '@nestjs/common';
import type { FoodItem, NutrientBreakdown } from '@meal-planning/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { EdamamFoodAdapter } from './adapters/edamam-food-adapter';
import {
  NUTRITION_API_CLIENT,
  type NutritionApiClient,
} from './clients/nutrition-api-client.interface';
import { toFoodItem } from './food-item-persistence';

/** Postgres row cap for a search — roughly the size of a single live Edamam
 * hint list once was, kept as a sane result-set limit. */
const LOCAL_SEARCH_TAKE = 20;

@Injectable()
export class NutritionService {
  constructor(
    @Inject(NUTRITION_API_CLIENT) private readonly client: NutritionApiClient,
    private readonly adapter: EdamamFoodAdapter,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Search is local-only: the food_items table (seeded from a one-time USDA
   * import, plus historically from Edamam) is now the sole source — no live
   * external call. Edamam's own client stays wired up (see getNutrients)
   * purely so that integration remains real and working, just no longer in
   * the search path. `query`/`category` are both optional — the controller
   * enforces that at least one is given — so this doubles as "search by
   * name" and "browse a whole category".
   */
  async search(query?: string, category?: string): Promise<FoodItem[]> {
    const trimmed = query?.trim();
    const rows = await this.prisma.foodItem.findMany({
      where: {
        name: trimmed ? { contains: trimmed, mode: 'insensitive' } : undefined,
        category: category || undefined,
      },
      take: LOCAL_SEARCH_TAKE,
      orderBy: { name: 'asc' },
    });
    return rows.map(toFoodItem);
  }

  /** Distinct categories currently in food_items, for a "browse by category" filter. */
  async listCategories(): Promise<string[]> {
    const rows = await this.prisma.foodItem.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
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
