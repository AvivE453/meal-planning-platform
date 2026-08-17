/**
 * Runnable demo of the meal-generation pipeline end to end, using plain
 * sample data instead of a live database or the Edamam API. This is what
 * `POST /meal-plans/generate` will do once it's wired up in apps/api —
 * for now it's the clearest way to see the algorithm actually working.
 *
 * Run with: pnpm --filter @meal-planning/algorithm demo
 */
import type { FoodItem, MealSlot, UserProfile } from '@meal-planning/shared-types';
import { StrategyFactory } from '../src/strategies/StrategyFactory.js';
import { filterExcluded } from '../src/filters/exclusionFilter.js';
import { optimizeSlot } from '../src/optimizer/KnapsackOptimizer.js';
import { MealPlanBuilder } from '../src/builder/MealPlanBuilder.js';

function food(overrides: Omit<FoodItem, 'id' | 'externalId' | 'source' | 'servingQty' | 'servingUnit'>): FoodItem {
  return {
    id: overrides.name.toLowerCase().replace(/\s+/g, '-'),
    externalId: overrides.name,
    source: 'edamam',
    servingQty: 1,
    servingUnit: 'serving',
    ...overrides,
  };
}

// A small, hand-picked candidate pool — a real request would get this from
// the Edamam search results for the user's usual foods/preferences instead.
const candidates: FoodItem[] = [
  food({ name: 'Chicken breast (grilled)', brand: null, calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, sugarG: 0, sodiumMg: 74 }),
  food({ name: 'Salmon fillet', brand: null, calories: 208, proteinG: 20, carbsG: 0, fatG: 13, sugarG: 0, sodiumMg: 59 }),
  food({ name: 'Eggs (2 large)', brand: null, calories: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5, sugarG: 0.4, sodiumMg: 142 }),
  food({ name: 'Greek yogurt (plain)', brand: null, calories: 100, proteinG: 17, carbsG: 6, fatG: 0.7, sugarG: 6, sodiumMg: 60 }),
  food({ name: 'Cottage cheese', brand: null, calories: 98, proteinG: 11, carbsG: 3.4, fatG: 4.3, sugarG: 3.4, sodiumMg: 364 }),
  food({ name: 'Brown rice (cooked)', brand: null, calories: 216, proteinG: 5, carbsG: 45, fatG: 1.8, sugarG: 0.7, sodiumMg: 10 }),
  food({ name: 'Oatmeal (cooked)', brand: null, calories: 150, proteinG: 5, carbsG: 27, fatG: 3, sugarG: 1, sodiumMg: 9 }),
  food({ name: 'Sweet potato', brand: null, calories: 112, proteinG: 2, carbsG: 26, fatG: 0.1, sugarG: 5.4, sodiumMg: 40 }),
  food({ name: 'Broccoli (steamed)', brand: null, calories: 55, proteinG: 3.7, carbsG: 11.2, fatG: 0.6, sugarG: 2.5, sodiumMg: 33 }),
  food({ name: 'Mixed berries', brand: null, calories: 57, proteinG: 0.7, carbsG: 14, fatG: 0.3, sugarG: 10, sodiumMg: 1 }),
  food({ name: 'Almonds (28g)', brand: null, calories: 164, proteinG: 6, carbsG: 6, fatG: 14, sugarG: 1.2, sodiumMg: 0 }),
  food({ name: 'Banana', brand: null, calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, sugarG: 14, sodiumMg: 1 }),
  // These two should get excluded from a weight-loss plan — sugar exceeds the 20g/serving threshold.
  food({ name: 'Protein bar', brand: 'GenericBrand', calories: 220, proteinG: 20, carbsG: 24, fatG: 8, sugarG: 22, sodiumMg: 200 }),
  food({ name: 'Candy bar', brand: 'GenericBrand', calories: 250, proteinG: 2, carbsG: 35, fatG: 12, sugarG: 28, sodiumMg: 60 }),
];

const profile: UserProfile = {
  userId: 'demo-user',
  sex: 'male',
  dateOfBirth: '1995-03-10',
  heightCm: 180,
  activityLevel: 'moderate',
  goal: 'weight_loss',
  targetWeightKg: null,
  weeklyRateKg: null, // uses the strategy's default rate
  updatedAt: new Date().toISOString(),
};

// TDEE would normally come from a Mifflin-St Jeor calculation over the
// profile + latest weight log (that service doesn't exist yet) — hardcoded
// here so this demo doesn't depend on unbuilt pieces.
const tdee = 2500;

const SLOT_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

function run() {
  const strategy = StrategyFactory.forGoal(profile.goal);
  const calorieTarget = strategy.calculateDailyCalorieTarget(profile, tdee);
  const macroTargets = strategy.calculateMacroTargets(calorieTarget);
  const weights = strategy.getMacroWeights();
  const rules = strategy.getExclusionRules();

  console.log(`\nStrategy: ${strategy.name}  (TDEE ${tdee} kcal)`);
  console.log(`Calorie target: ${calorieTarget.toFixed(0)} kcal/day`);
  console.log(
    `Macro targets: protein ${macroTargets.proteinG.toFixed(0)}g, carbs ${macroTargets.carbsG.toFixed(0)}g, fat ${macroTargets.fatG.toFixed(0)}g`,
  );

  const filtered = filterExcluded(candidates, rules);
  const excluded = candidates.filter((c) => !filtered.includes(c));
  console.log(`\nExcluded by hard constraints (${rules.map((r) => `${r.trait} > ${r.maxPerServing}`).join(', ')}):`);
  for (const item of excluded) console.log(`  ✗ ${item.name} (sugar ${item.sugarG}g/serving)`);

  const builder = new MealPlanBuilder().forUser(profile.userId).forDate('2026-08-17').withStrategy(strategy, calorieTarget);

  console.log('\nGenerated plan:');
  for (const slot of Object.keys(SLOT_SHARE) as MealSlot[]) {
    const budget = calorieTarget * SLOT_SHARE[slot];
    const selections = optimizeSlot(filtered, budget, weights);
    builder.addSlot(slot, selections);

    console.log(`\n  ${slot.toUpperCase()} (budget ${budget.toFixed(0)} kcal)`);
    for (const { item, servings } of selections) {
      console.log(
        `    ${servings}x ${item.name} — ${(item.calories * servings).toFixed(0)} kcal, ${(item.proteinG * servings).toFixed(0)}g protein`,
      );
    }
  }

  const plan = builder.build();
  console.log(
    `\nPlan totals: ${plan.totals.calories.toFixed(0)} kcal (target ${plan.calorieTarget.toFixed(0)}), ` +
      `${plan.totals.proteinG.toFixed(0)}g protein, ${plan.totals.carbsG.toFixed(0)}g carbs, ${plan.totals.fatG.toFixed(0)}g fat\n`,
  );
}

run();
