import { Injectable, NotFoundException } from '@nestjs/common';
import {
  calculateAge,
  calculateTdee,
  StrategyFactory,
} from '@meal-planning/algorithm';
import type { NutritionTargets } from '@meal-planning/shared-types';
import { ProfileService } from './profile.service';
import { WeightLogsService } from '../logs/weight-logs.service';
import { RedisService } from '../redis/redis.service';

/** Exported so RecalculateTargetsListener invalidates the exact key this service writes. */
export function targetsCacheKey(userId: string): string {
  return `user:${userId}:targets`;
}

@Injectable()
export class TargetsService {
  constructor(
    private readonly profileService: ProfileService,
    private readonly weightLogsService: WeightLogsService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Cache-aside, deliberately with no TTL: unlike search results, stale
   * targets have a real UX cost (a user sees numbers computed from an old
   * weight), so correctness comes from explicit invalidation — see
   * RecalculateTargetsListener — rather than a "good enough" expiry window.
   */
  async getTargets(userId: string): Promise<NutritionTargets> {
    const key = targetsCacheKey(userId);
    const cached = await this.redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as NutritionTargets;
    }

    const targets = await this.computeTargets(userId);
    await this.redis.set(key, JSON.stringify(targets));
    return targets;
  }

  private async computeTargets(userId: string): Promise<NutritionTargets> {
    const profile = await this.profileService.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Profile not set up yet');
    }

    const latestWeight =
      await this.weightLogsService.findLatestByUserId(userId);
    if (!latestWeight) {
      throw new NotFoundException(
        'Log a weight entry before requesting targets',
      );
    }

    const tdee = calculateTdee({
      sex: profile.sex,
      age: calculateAge(profile.dateOfBirth),
      heightCm: profile.heightCm,
      weightKg: latestWeight.weightKg,
      activityLevel: profile.activityLevel,
    });

    const strategy = StrategyFactory.forGoal(profile.goal);
    const calorieTarget = strategy.calculateDailyCalorieTarget(profile, tdee);
    const macroTargets = strategy.calculateMacroTargets(calorieTarget);

    return { calorieTarget, macroTargets, tdee, goal: profile.goal };
  }
}
