export { optimizeSlot } from './optimizer/KnapsackOptimizer.js';
export type { SelectedItem } from './optimizer/types.js';

export type { MealGenerationStrategy } from './strategies/MealGenerationStrategy.js';
export { WeightLossStrategy } from './strategies/WeightLossStrategy.js';
export { WeightGainStrategy } from './strategies/WeightGainStrategy.js';
export { MaintenanceStrategy } from './strategies/MaintenanceStrategy.js';
export { StrategyFactory } from './strategies/StrategyFactory.js';

export { filterExcluded } from './filters/exclusionFilter.js';

export { MealPlanBuilder } from './builder/MealPlanBuilder.js';
export type { MealPlanDraft, MealPlanItemDraft, MealPlanTotals } from './builder/types.js';

export { calculateAge, calculateBmr, calculateTdee } from './tdee/calculateTdee.js';
export type { TdeeInput } from './tdee/calculateTdee.js';
