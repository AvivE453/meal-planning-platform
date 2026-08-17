import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { EdamamApiClient } from './edamam-api-client';
import type { NutritionApiClient } from './nutrition-api-client.interface';

/** Search rankings can shift as Edamam's index changes — a day is a reasonable balance. */
const SEARCH_CACHE_TTL_SECONDS = 60 * 60 * 24;
/** A specific food+measure's nutrient facts are effectively immutable — cache far longer. */
const NUTRIENTS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Proxy: same interface as the real client, transparently serving cached
 * results when available. Caches the *raw* provider JSON, not the normalized
 * FoodItem — normalization (the Adapter's job) stays fully decoupled from
 * caching, so a schema change in one never requires touching the other.
 */
@Injectable()
export class CachedNutritionApiClient implements NutritionApiClient {
  constructor(
    private readonly realClient: EdamamApiClient,
    private readonly redis: RedisService,
  ) {}

  async search(query: string): Promise<unknown> {
    const key = this.searchCacheKey(query);

    const cached = await this.redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as unknown;
    }

    const result = await this.realClient.search(query);
    await this.redis.set(
      key,
      JSON.stringify(result),
      'EX',
      SEARCH_CACHE_TTL_SECONDS,
    );
    return result;
  }

  async getNutrients(
    foodId: string,
    measureUri: string,
    quantity: number,
  ): Promise<unknown> {
    const key = this.nutrientsCacheKey(foodId, measureUri, quantity);

    const cached = await this.redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as unknown;
    }

    const result = await this.realClient.getNutrients(
      foodId,
      measureUri,
      quantity,
    );
    await this.redis.set(
      key,
      JSON.stringify(result),
      'EX',
      NUTRIENTS_CACHE_TTL_SECONDS,
    );
    return result;
  }

  private searchCacheKey(query: string): string {
    const normalized = query.trim().toLowerCase();
    const hash = createHash('sha1').update(normalized).digest('hex');
    return `food:search:edamam:${hash}`;
  }

  private nutrientsCacheKey(
    foodId: string,
    measureUri: string,
    quantity: number,
  ): string {
    const hash = createHash('sha1')
      .update(`${foodId}|${measureUri}|${quantity}`)
      .digest('hex');
    return `food:nutrients:edamam:${hash}`;
  }
}
