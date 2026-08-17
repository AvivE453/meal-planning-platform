import type { DietaryRestriction, FoodItem } from '@meal-planning/shared-types';

/**
 * Edamam's basic parser response carries no structured allergen/health-label
 * tags, so a restriction is matched against the food name as a case-insensitive
 * substring — crude (would also catch "buttermilk" for a "milk" restriction)
 * but honest given the data actually available. A real product would use
 * Edamam's health-labels field or a proper allergen taxonomy.
 */
export function filterByRestrictions(
  items: FoodItem[],
  restrictions: DietaryRestriction[],
): FoodItem[] {
  if (restrictions.length === 0) {
    return items;
  }
  const terms = restrictions.map((r) => r.value.toLowerCase());
  return items.filter((item) => {
    const name = item.name.toLowerCase();
    return !terms.some((term) => name.includes(term));
  });
}
