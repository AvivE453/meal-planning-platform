import type { ExclusionRule, MacroTargets, MacroWeights, UserProfile } from '@meal-planning/shared-types';
import type { MealGenerationStrategy } from './MealGenerationStrategy.js';

const KCAL_PER_KG_BODY_FAT = 7700;
const DEFAULT_WEEKLY_RATE_KG = 0.45; // ~1lb/week, a widely-cited safe default deficit rate
const MAX_SUGAR_G_PER_SERVING = 20;

export class WeightLossStrategy implements MealGenerationStrategy {
  readonly name = 'weight_loss' as const;

  calculateDailyCalorieTarget(profile: UserProfile, tdee: number): number {
    const weeklyRateKg = profile.weeklyRateKg ?? DEFAULT_WEEKLY_RATE_KG;
    const dailyDeficit = (weeklyRateKg * KCAL_PER_KG_BODY_FAT) / 7;
    return tdee - dailyDeficit;
  }

  calculateMacroTargets(calorieTarget: number): MacroTargets {
    // Higher protein ratio under a deficit: preserves lean mass and aids satiety.
    return {
      proteinG: (calorieTarget * 0.35) / 4,
      carbsG: (calorieTarget * 0.35) / 4,
      fatG: (calorieTarget * 0.3) / 9,
    };
  }

  getMacroWeights(): MacroWeights {
    return { protein: 3.0, carbs: 1.0, fat: 1.0, sugarPenalty: 2.5, sodiumPenalty: 1.0 };
  }

  getExclusionRules(): ExclusionRule[] {
    return [{ trait: 'sugar_g', maxPerServing: MAX_SUGAR_G_PER_SERVING }];
  }
}
