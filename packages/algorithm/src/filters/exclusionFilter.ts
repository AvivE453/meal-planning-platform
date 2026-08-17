import type { ExclusionRule, FoodItem } from '@meal-planning/shared-types';

function traitValue(item: FoodItem, trait: ExclusionRule['trait']): number {
  switch (trait) {
    case 'sugar_g':
      return item.sugarG;
    case 'sodium_mg':
      return item.sodiumMg;
  }
}

/**
 * Phase 1 of meal generation: drop candidates that violate a hard exclusion rule
 * (strategy-defined trait threshold) before they ever reach the knapsack DP. Kept
 * as a pure, independently-testable function so the optimizer never needs a
 * per-trait state axis.
 */
export function filterExcluded(items: FoodItem[], rules: ExclusionRule[]): FoodItem[] {
  if (rules.length === 0) {
    return items;
  }
  return items.filter((item) => rules.every((rule) => traitValue(item, rule.trait) <= rule.maxPerServing));
}
