import type { MealSlot } from '@meal-planning/shared-types';
import type { MealGenerationStrategy } from '../strategies/MealGenerationStrategy.js';
import type { SelectedItem } from '../optimizer/types.js';
import type { MealPlanDraft, MealPlanItemDraft, MealPlanTotals } from './types.js';

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** How far assembled totals may drift over the calorie target before build() rejects the plan. */
const CALORIE_TOLERANCE_RATIO = 0.15;

/**
 * Accumulates per-slot optimizer output into a single validated, immutable
 * meal plan. Deliberately fluent/step-by-step: slots are generated and added
 * one at a time by the caller, and the plan is only assembled — with totals
 * computed and invariants checked — once build() is called.
 */
export class MealPlanBuilder {
  private userId?: string;
  private date?: string;
  private strategy?: MealGenerationStrategy;
  private calorieTarget?: number;
  private readonly slots = new Map<MealSlot, SelectedItem[]>();

  forUser(userId: string): this {
    this.userId = userId;
    return this;
  }

  forDate(date: string): this {
    this.date = date;
    return this;
  }

  withStrategy(strategy: MealGenerationStrategy, calorieTarget: number): this {
    this.strategy = strategy;
    this.calorieTarget = calorieTarget;
    return this;
  }

  addSlot(slot: MealSlot, selections: SelectedItem[]): this {
    this.slots.set(slot, selections);
    return this;
  }

  build(): Readonly<MealPlanDraft> {
    if (!this.userId) {
      throw new Error('MealPlanBuilder: forUser() must be called before build()');
    }
    if (!this.date) {
      throw new Error('MealPlanBuilder: forDate() must be called before build()');
    }
    if (!this.strategy || this.calorieTarget === undefined) {
      throw new Error('MealPlanBuilder: withStrategy() must be called before build()');
    }

    const items = this.assembleItems();
    const totals = sumTotals(items);
    this.assertWithinTolerance(totals);

    const draft: MealPlanDraft = {
      userId: this.userId,
      date: this.date,
      goalSnapshot: this.strategy.name,
      calorieTarget: this.calorieTarget,
      macroTargets: this.strategy.calculateMacroTargets(this.calorieTarget),
      items,
      totals,
    };

    return Object.freeze({ ...draft, items: Object.freeze(items) });
  }

  private assembleItems(): MealPlanItemDraft[] {
    const items: MealPlanItemDraft[] = [];
    let sortOrder = 0;
    for (const slot of SLOT_ORDER) {
      const selections = this.slots.get(slot) ?? [];
      for (const { item, servings } of selections) {
        items.push({
          foodItem: item,
          mealSlot: slot,
          servings,
          calories: item.calories * servings,
          proteinG: item.proteinG * servings,
          carbsG: item.carbsG * servings,
          fatG: item.fatG * servings,
          sortOrder: sortOrder++,
        });
      }
    }
    return items;
  }

  private assertWithinTolerance(totals: MealPlanTotals): void {
    const maxAllowed = this.calorieTarget! * (1 + CALORIE_TOLERANCE_RATIO);
    if (totals.calories > maxAllowed) {
      throw new Error(
        `MealPlanBuilder: assembled plan totals ${totals.calories.toFixed(0)}kcal, exceeding the ` +
          `${(CALORIE_TOLERANCE_RATIO * 100).toFixed(0)}% tolerance over the ${this.calorieTarget}kcal target`,
      );
    }
  }
}

function sumTotals(items: MealPlanItemDraft[]): MealPlanTotals {
  return items.reduce<MealPlanTotals>(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      proteinG: acc.proteinG + item.proteinG,
      carbsG: acc.carbsG + item.carbsG,
      fatG: acc.fatG + item.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
