import { describe, expect, it } from 'vitest';
import { MealPlanBuilder } from './MealPlanBuilder.js';
import { MaintenanceStrategy } from '../strategies/MaintenanceStrategy.js';
import { makeFoodItem } from '../testing/fixtures.js';

const strategy = new MaintenanceStrategy();

describe('MealPlanBuilder', () => {
  it('throws if build() is called before the required fields are set', () => {
    expect(() => new MealPlanBuilder().build()).toThrow(/forUser/);
    expect(() => new MealPlanBuilder().forUser('u1').build()).toThrow(/forDate/);
    expect(() => new MealPlanBuilder().forUser('u1').forDate('2026-01-01').build()).toThrow(/withStrategy/);
  });

  it('assembles items from multiple slots in a fixed slot order, with sequential sort order', () => {
    const breakfastItem = makeFoodItem({ id: 'b', calories: 300, proteinG: 20 });
    const lunchItem = makeFoodItem({ id: 'l', calories: 500, proteinG: 30 });

    const plan = new MealPlanBuilder()
      .forUser('user-1')
      .forDate('2026-01-01')
      .withStrategy(strategy, 2000)
      .addSlot('lunch', [{ item: lunchItem, servings: 1 }])
      .addSlot('breakfast', [{ item: breakfastItem, servings: 1 }])
      .build();

    expect(plan.items.map((i) => i.mealSlot)).toEqual(['breakfast', 'lunch']);
    expect(plan.items.map((i) => i.sortOrder)).toEqual([0, 1]);
  });

  it('computes per-item and plan-level totals from servings', () => {
    const item = makeFoodItem({ calories: 200, proteinG: 10, carbsG: 20, fatG: 5 });

    const plan = new MealPlanBuilder()
      .forUser('user-1')
      .forDate('2026-01-01')
      .withStrategy(strategy, 2000)
      .addSlot('snack', [{ item, servings: 1.5 }])
      .build();

    expect(plan.items[0]).toMatchObject({ calories: 300, proteinG: 15, carbsG: 30, fatG: 7.5 });
    expect(plan.totals).toEqual({ calories: 300, proteinG: 15, carbsG: 30, fatG: 7.5 });
  });

  it('records goalSnapshot from the strategy used and macro targets from calorieTarget', () => {
    const plan = new MealPlanBuilder()
      .forUser('user-1')
      .forDate('2026-01-01')
      .withStrategy(strategy, 2000)
      .build();

    expect(plan.goalSnapshot).toBe('maintenance');
    expect(plan.macroTargets).toEqual(strategy.calculateMacroTargets(2000));
  });

  it('rejects a plan whose totals exceed the tolerance over the calorie target', () => {
    const hugeItem = makeFoodItem({ calories: 3000, proteinG: 100 });

    expect(() =>
      new MealPlanBuilder()
        .forUser('user-1')
        .forDate('2026-01-01')
        .withStrategy(strategy, 2000)
        .addSlot('dinner', [{ item: hugeItem, servings: 1 }])
        .build(),
    ).toThrow(/exceeding/);
  });

  it('returns a frozen (immutable) plan', () => {
    const plan = new MealPlanBuilder().forUser('user-1').forDate('2026-01-01').withStrategy(strategy, 2000).build();

    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.items)).toBe(true);
  });
});
