import type { ExclusionRule, MacroTargets, MacroWeights, UserProfile } from '@meal-planning/shared-types';

export interface MealGenerationStrategy {
  readonly name: 'weight_loss' | 'weight_gain' | 'maintenance';
  /** `tdee` is passed in separately since computing it is the caller's concern (needs a weight log, not just the profile). */
  calculateDailyCalorieTarget(profile: UserProfile, tdee: number): number;
  calculateMacroTargets(calorieTarget: number): MacroTargets;
  getMacroWeights(): MacroWeights;
  getExclusionRules(): ExclusionRule[];
}
