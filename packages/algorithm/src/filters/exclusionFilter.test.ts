import { describe, expect, it } from 'vitest';
import { filterExcluded } from './exclusionFilter.js';
import { makeFoodItem } from '../testing/fixtures.js';

describe('filterExcluded', () => {
  it('returns all items unchanged when there are no rules', () => {
    const items = [makeFoodItem({ sugarG: 999 })];
    expect(filterExcluded(items, [])).toEqual(items);
  });

  it('drops items that exceed a sugar threshold', () => {
    const ok = makeFoodItem({ id: 'ok', sugarG: 10 });
    const tooSweet = makeFoodItem({ id: 'sweet', sugarG: 25 });

    const result = filterExcluded([ok, tooSweet], [{ trait: 'sugar_g', maxPerServing: 20 }]);

    expect(result).toEqual([ok]);
  });

  it('keeps an item exactly at the threshold (inclusive bound)', () => {
    const atLimit = makeFoodItem({ sugarG: 20 });
    expect(filterExcluded([atLimit], [{ trait: 'sugar_g', maxPerServing: 20 }])).toEqual([atLimit]);
  });

  it('applies multiple rules as AND — an item must pass every rule', () => {
    const failsSugar = makeFoodItem({ id: 'a', sugarG: 30, sodiumMg: 10 });
    const failsSodium = makeFoodItem({ id: 'b', sugarG: 5, sodiumMg: 900 });
    const passesBoth = makeFoodItem({ id: 'c', sugarG: 5, sodiumMg: 10 });

    const rules = [
      { trait: 'sugar_g' as const, maxPerServing: 20 },
      { trait: 'sodium_mg' as const, maxPerServing: 500 },
    ];

    expect(filterExcluded([failsSugar, failsSodium, passesBoth], rules)).toEqual([passesBoth]);
  });
});
