import type { Goal } from '@meal-planning/shared-types';
import type { MealGenerationStrategy } from './MealGenerationStrategy.js';
import { WeightLossStrategy } from './WeightLossStrategy.js';
import { WeightGainStrategy } from './WeightGainStrategy.js';
import { MaintenanceStrategy } from './MaintenanceStrategy.js';

const weightLoss = new WeightLossStrategy();
const weightGain = new WeightGainStrategy();
const maintenance = new MaintenanceStrategy();

const strategiesByGoal: Record<Goal, MealGenerationStrategy> = {
  weight_loss: weightLoss,
  weight_gain: weightGain,
  maintenance,
};

export const StrategyFactory = {
  forGoal(goal: Goal): MealGenerationStrategy {
    return strategiesByGoal[goal];
  },
};
