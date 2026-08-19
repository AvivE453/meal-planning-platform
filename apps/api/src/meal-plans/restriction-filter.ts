import type { DietaryRestriction, FoodItem } from '@meal-planning/shared-types';
import { ingredientNamesOf } from '../recipes/recipe-candidate';

/**
 * Edamam's basic parser response carries no structured allergen/health-label
 * tags, so a restriction is matched against the food name as a case-insensitive
 * substring — crude (would also catch "buttermilk" for a "milk" restriction)
 * but honest given the data actually available. A real product would use
 * Edamam's health-labels field or a proper allergen taxonomy.
 *
 * For a recipe candidate, checking only its own display name isn't enough —
 * "Spaghetti Bolognese" wouldn't match a "dairy" restriction even if the
 * recipe contains parmesan, which is a real safety gap, not just an
 * inherited limitation. RecipeCandidate carries ingredientNames specifically
 * so those get checked too.
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
    const names = [item.name, ...(ingredientNamesOf(item) ?? [])].map((n) =>
      n.toLowerCase(),
    );
    return !terms.some((term) => names.some((name) => name.includes(term)));
  });
}
