import Redis from 'ioredis';
import { RecalculateTargetsListener } from './recalculate-targets.listener';
import { targetsCacheKey } from '../targets.service';
import type { RedisService } from '../../redis/redis.service';

describe('RecalculateTargetsListener (Observer, against a real Redis)', () => {
  let redis: Redis;
  let listener: RecalculateTargetsListener;

  beforeAll(() => {
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
    listener = new RecalculateTargetsListener(redis as unknown as RedisService);
  });

  it('deletes the cached targets entry for the user in the event payload', async () => {
    await redis.set(
      targetsCacheKey('user-1'),
      JSON.stringify({ calorieTarget: 2000 }),
    );

    await listener.handleWeightLogged({ userId: 'user-1' });

    expect(await redis.get(targetsCacheKey('user-1'))).toBeNull();
  });

  it("does not touch another user's cached targets", async () => {
    await redis.set(
      targetsCacheKey('user-1'),
      JSON.stringify({ calorieTarget: 2000 }),
    );
    await redis.set(
      targetsCacheKey('user-2'),
      JSON.stringify({ calorieTarget: 1800 }),
    );

    await listener.handleWeightLogged({ userId: 'user-1' });

    expect(await redis.get(targetsCacheKey('user-1'))).toBeNull();
    expect(await redis.get(targetsCacheKey('user-2'))).not.toBeNull();
  });

  it('is a no-op, not an error, when there was nothing cached', async () => {
    await expect(
      listener.handleWeightLogged({ userId: 'user-with-no-cache' }),
    ).resolves.toBeUndefined();
  });
});
