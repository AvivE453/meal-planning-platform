import type { ExclusionRule, MacroTargets, MacroWeights, UserProfile } from '@meal-planning/shared-types';
import type { MealGenerationStrategy } from './MealGenerationStrategy.js';

export class MaintenanceStrategy implements MealGenerationStrategy {
  readonly name = 'maintenance' as const;

  calculateDailyCalorieTarget(_profile: UserProfile, tdee: number): number {
    return tdee;
  }

  calculateMacroTargets(calorieTarget: number): MacroTargets {
    return {
      proteinG: (calorieTarget * 0.3) / 4,
      carbsG: (calorieTarget * 0.4) / 4,
      fatG: (calorieTarget * 0.3) / 9,
    };
  }

  getMacroWeights(): MacroWeights {
    return { protein: 1.5, carbs: 1.0, fat: 1.0, sugarPenalty: 1.0, sodiumPenalty: 0.5 };
  }

  getExclusionRules(): ExclusionRule[] {
    return [];
  }
}
