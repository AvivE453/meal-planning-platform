import type { ExclusionRule, MacroTargets, MacroWeights, UserProfile } from '@meal-planning/shared-types';
import type { MealGenerationStrategy } from './MealGenerationStrategy.js';

const KCAL_PER_KG_BODY_MASS = 7700;
const DEFAULT_WEEKLY_RATE_KG = 0.25; // conservative lean-gain default; aggressive surpluses mostly add fat

export class WeightGainStrategy implements MealGenerationStrategy {
  readonly name = 'weight_gain' as const;

  calculateDailyCalorieTarget(profile: UserProfile, tdee: number): number {
    const weeklyRateKg = profile.weeklyRateKg ?? DEFAULT_WEEKLY_RATE_KG;
    const dailySurplus = (weeklyRateKg * KCAL_PER_KG_BODY_MASS) / 7;
    return tdee + dailySurplus;
  }

  calculateMacroTargets(calorieTarget: number): MacroTargets {
    // More balanced protein/carb split — calorie-dense carbs make the surplus easier to hit.
    return {
      proteinG: (calorieTarget * 0.25) / 4,
      carbsG: (calorieTarget * 0.45) / 4,
      fatG: (calorieTarget * 0.3) / 9,
    };
  }

  getMacroWeights(): MacroWeights {
    // Favor calorie-dense, protein+carb items roughly equally; lighter penalties since
    // hitting a calorie surplus matters more here than restricting sugar/sodium.
    return { protein: 1.5, carbs: 1.5, fat: 1.0, sugarPenalty: 0.5, sodiumPenalty: 0.3 };
  }

  getExclusionRules(): ExclusionRule[] {
    return [];
  }
}
