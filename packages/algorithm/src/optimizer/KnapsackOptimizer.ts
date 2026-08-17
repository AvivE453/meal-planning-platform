import type { FoodItem, MacroWeights } from '@meal-planning/shared-types';
import type { SelectedItem } from './types.js';

/** Serving multiples offered per candidate food item — the MCKP "group" of mutually-exclusive options. */
const SERVING_MULTIPLES = [0.5, 1, 1.5, 2] as const;

/** Calorie discretization granularity. Bounds DP state count; rounding error per item is at most half a bucket. */
const BUCKET_SIZE_KCAL = 10;

interface Option {
  item: FoodItem;
  servings: number;
  calorieCost: number; // in buckets
  value: number;
}

function scoreOption(item: FoodItem, servings: number, weights: MacroWeights): number {
  return (
    weights.protein * item.proteinG * servings +
    weights.carbs * item.carbsG * servings +
    weights.fat * item.fatG * servings -
    weights.sugarPenalty * item.sugarG * servings -
    (weights.sodiumPenalty * (item.sodiumMg * servings)) / 100
  );
}

/**
 * Builds one MCKP "group" per candidate item: its available serving-multiple options,
 * each with a bucketed calorie cost and a weighted macro-value score. Options that
 * don't fit the budget at all are dropped up front so the DP never has to consider them.
 */
function buildGroups(candidates: FoodItem[], budgetBuckets: number, weights: MacroWeights): Option[][] {
  const groups: Option[][] = [];
  for (const item of candidates) {
    const options: Option[] = [];
    for (const servings of SERVING_MULTIPLES) {
      const calorieCost = Math.round((item.calories * servings) / BUCKET_SIZE_KCAL);
      if (calorieCost > 0 && calorieCost <= budgetBuckets) {
        options.push({ item, servings, calorieCost, value: scoreOption(item, servings, weights) });
      }
    }
    if (options.length > 0) {
      groups.push(options);
    }
  }
  return groups;
}

/**
 * Multiple-Choice Knapsack: selects at most one serving-option per candidate food item
 * to maximize total weighted macro value within a calorie budget.
 *
 * Standard MCKP DP: dp[c] = best value achievable with total cost <= c using groups
 * processed so far. Each group's contribution is computed against the previous groups'
 * dp table only (never the in-progress table), which is what enforces "at most one
 * option per group" instead of collapsing into unrestricted 0/1 knapsack over options.
 */
export function optimizeSlot(
  candidates: FoodItem[],
  calorieBudget: number,
  weights: MacroWeights,
): SelectedItem[] {
  if (calorieBudget <= 0 || candidates.length === 0) {
    return [];
  }

  const budgetBuckets = Math.floor(calorieBudget / BUCKET_SIZE_KCAL);
  if (budgetBuckets <= 0) {
    return [];
  }

  const groups = buildGroups(candidates, budgetBuckets, weights);
  if (groups.length === 0) {
    return [];
  }

  let dp: number[] = new Array(budgetBuckets + 1).fill(0);
  const choice: (Option | null)[][] = groups.map(() => new Array(budgetBuckets + 1).fill(null));

  groups.forEach((options, g) => {
    const nextDp = dp.slice(); // baseline: this group contributes nothing
    for (const opt of options) {
      for (let c = budgetBuckets; c >= opt.calorieCost; c--) {
        const candidateValue = dp[c - opt.calorieCost]! + opt.value;
        if (candidateValue > nextDp[c]!) {
          nextDp[c] = candidateValue;
          choice[g]![c] = opt;
        }
      }
    }
    dp = nextDp;
  });

  return reconstruct(choice, budgetBuckets);
}

function reconstruct(choice: (Option | null)[][], startBucket: number): SelectedItem[] {
  const result: SelectedItem[] = [];
  let c = startBucket;
  for (let g = choice.length - 1; g >= 0; g--) {
    const chosen = choice[g]![c];
    if (chosen) {
      result.push({ item: chosen.item, servings: chosen.servings });
      c -= chosen.calorieCost;
    }
  }
  return result.reverse();
}
