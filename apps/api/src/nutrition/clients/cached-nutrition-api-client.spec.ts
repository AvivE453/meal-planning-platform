import Redis from 'ioredis';
import { CachedNutritionApiClient } from './cached-nutrition-api-client';
import type { EdamamApiClient } from './edamam-api-client';
import type { RedisService } from '../../redis/redis.service';

describe('CachedNutritionApiClient (Proxy, against a real Redis)', () => {
  let redis: Redis;
  let realClient: { search: jest.Mock; getNutrients: jest.Mock };
  let proxy: CachedNutritionApiClient;

  beforeAll(() => {
    // A dedicated DB index keeps this from polluting (or being polluted by)
    // whatever the app itself has cached on the default DB 0 — same Redis
    // instance, isolated data.
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      db: 15,
    });
  });

  afterAll(async () => {
    await redis.flushdb();
    redis.disconnect();
  });

  beforeEach(async () => {
    await redis.flushdb();
    realClient = {
      search: jest
        .fn()
        .mockResolvedValue({ hints: [{ food: { foodId: 'x' } }] }),
      getNutrients: jest
        .fn()
        .mockResolvedValue({ calories: 326, totalNutrients: {} }),
    };
    proxy = new CachedNutritionApiClient(
      realClient as unknown as EdamamApiClient,
      redis as unknown as RedisService,
    );
  });

  describe('search', () => {
    it('calls the real client and caches the result on a miss', async () => {
      const result = await proxy.search('chicken breast');

      expect(realClient.search).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ hints: [{ food: { foodId: 'x' } }] });
    });

    it('serves from cache on a hit, without calling the real client again', async () => {
      await proxy.search('chicken breast');
      const result = await proxy.search('chicken breast');

      expect(realClient.search).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ hints: [{ food: { foodId: 'x' } }] });
    });

    it('normalizes query case/whitespace to the same cache key', async () => {
      await proxy.search('Chicken Breast');
      await proxy.search('  chicken breast  ');

      expect(realClient.search).toHaveBeenCalledTimes(1);
    });

    it('uses separate cache entries for different queries', async () => {
      await proxy.search('chicken breast');
      await proxy.search('salmon');

      expect(realClient.search).toHaveBeenCalledTimes(2);
    });

    it('sets a TTL on the cached entry', async () => {
      await proxy.search('chicken breast');

      const keys = await redis.keys('food:search:edamam:*');
      expect(keys).toHaveLength(1);
      const ttl = await redis.ttl(keys[0]);
      expect(ttl).toBeGreaterThan(0);
    });
  });

  describe('getNutrients', () => {
    const measureUri = 'edamam.owl#Measure_serving';

    it('calls the real client and caches the result on a miss', async () => {
      const result = await proxy.getNutrients('food_chicken', measureUri, 1);

      expect(realClient.getNutrients).toHaveBeenCalledWith(
        'food_chicken',
        measureUri,
        1,
      );
      expect(result).toEqual({ calories: 326, totalNutrients: {} });
    });

    it('serves from cache on a hit, without calling the real client again', async () => {
      await proxy.getNutrients('food_chicken', measureUri, 1);
      await proxy.getNutrients('food_chicken', measureUri, 1);

      expect(realClient.getNutrients).toHaveBeenCalledTimes(1);
    });

    it('uses separate cache entries for different quantities of the same food', async () => {
      await proxy.getNutrients('food_chicken', measureUri, 1);
      await proxy.getNutrients('food_chicken', measureUri, 2);

      expect(realClient.getNutrients).toHaveBeenCalledTimes(2);
    });

    it('does not share cache entries with search results', async () => {
      await proxy.search('chicken breast');
      await proxy.getNutrients('food_chicken', measureUri, 1);

      const searchKeys = await redis.keys('food:search:edamam:*');
      const nutrientKeys = await redis.keys('food:nutrients:edamam:*');
      expect(searchKeys).toHaveLength(1);
      expect(nutrientKeys).toHaveLength(1);
    });

    it('sets a (long) TTL on the cached entry', async () => {
      await proxy.getNutrients('food_chicken', measureUri, 1);

      const keys = await redis.keys('food:nutrients:edamam:*');
      expect(keys).toHaveLength(1);
      const ttl = await redis.ttl(keys[0]);
      expect(ttl).toBeGreaterThan(60 * 60 * 24); // longer than the search TTL
    });
  });
});
