import Redis from 'ioredis';
import { NotFoundException } from '@nestjs/common';
import { targetsCacheKey, TargetsService } from './targets.service';
import type { ProfileService } from './profile.service';
import type { WeightLogsService } from '../logs/weight-logs.service';
import type { RedisService } from '../redis/redis.service';

const PROFILE = {
  userId: 'user-1',
  sex: 'male' as const,
  dateOfBirth: '1995-06-15',
  heightCm: 180,
  activityLevel: 'moderate' as const,
  goal: 'weight_loss' as const,
  targetWeightKg: null,
  weeklyRateKg: null,
  updatedAt: new Date().toISOString(),
};

const WEIGHT_LOG = {
  id: 'log-1',
  userId: 'user-1',
  weightKg: 82.5,
  loggedAt: new Date().toISOString(),
  note: null,
};

describe('TargetsService (cache-aside over a real Redis)', () => {
  let redis: Redis;
  let profileService: { findByUserId: jest.Mock };
  let weightLogsService: { findLatestByUserId: jest.Mock };
  let service: TargetsService;

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
    profileService = { findByUserId: jest.fn().mockResolvedValue(PROFILE) };
    weightLogsService = {
      findLatestByUserId: jest.fn().mockResolvedValue(WEIGHT_LOG),
    };
    service = new TargetsService(
      profileService as unknown as ProfileService,
      weightLogsService as unknown as WeightLogsService,
      redis as unknown as RedisService,
    );
  });

  it('computes and caches targets on a miss', async () => {
    const result = await service.getTargets('user-1');

    expect(profileService.findByUserId).toHaveBeenCalledTimes(1);
    expect(result.goal).toBe('weight_loss');
    expect(result.calorieTarget).toBeLessThan(result.tdee);

    const cached = await redis.get(targetsCacheKey('user-1'));
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!)).toEqual(result);
  });

  it('serves from cache on a hit, without recomputing', async () => {
    const first = await service.getTargets('user-1');
    const second = await service.getTargets('user-1');

    expect(profileService.findByUserId).toHaveBeenCalledTimes(1);
    expect(weightLogsService.findLatestByUserId).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('uses separate cache entries for different users', async () => {
    await service.getTargets('user-1');
    await service.getTargets('user-2');

    expect(profileService.findByUserId).toHaveBeenCalledTimes(2);
    expect(await redis.get(targetsCacheKey('user-1'))).not.toBeNull();
    expect(await redis.get(targetsCacheKey('user-2'))).not.toBeNull();
  });

  it('caches with no TTL — invalidation is explicit, not time-based', async () => {
    await service.getTargets('user-1');

    const ttl = await redis.ttl(targetsCacheKey('user-1'));
    expect(ttl).toBe(-1);
  });

  it('does not cache a missing-profile failure', async () => {
    profileService.findByUserId.mockResolvedValue(null);

    await expect(service.getTargets('user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(await redis.get(targetsCacheKey('user-1'))).toBeNull();
  });
});
