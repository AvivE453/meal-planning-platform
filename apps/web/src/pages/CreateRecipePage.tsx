import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FoodItem, MealSlot } from '@meal-planning/shared-types';
import { ApiError, foodsApi, recipesApi } from '../api/client';

const SLOT_OPTIONS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type QtyUnit = 'qty' | 'grams';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Rounds to 2 decimals — enough to keep gram<->qty round-tripping tidy. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `amount` is always the canonical multiplier of foodItem.baseUnit — this
 * just converts it to/from a grams value for display/entry in that unit. */
function amountToDisplay(amount: number, foodItem: FoodItem, unit: QtyUnit): number {
  return unit === 'grams' ? round(amount * foodItem.defaultServingWeightGrams) : amount;
}

function displayToAmount(value: number, foodItem: FoodItem, unit: QtyUnit): number {
  return unit === 'grams' ? value / foodItem.defaultServingWeightGrams : value;
}

interface DraftIngredient {
  foodItem: FoodItem;
  amount: number;
  unit: QtyUnit;
}

function sumNutrition(ingredients: DraftIngredient[]) {
  return ingredients.reduce(
    (totals, { foodItem, amount }) => ({
      calories: totals.calories + foodItem.calories * amount,
      proteinG: totals.proteinG + foodItem.proteinG * amount,
      carbsG: totals.carbsG + foodItem.carbsG * amount,
      fatG: totals.fatG + foodItem.fatG * amount,
      saturatedFatG: totals.saturatedFatG + foodItem.saturatedFatG * amount,
      sugarG: totals.sugarG + foodItem.sugarG * amount,
      sodiumMg: totals.sodiumMg + foodItem.sodiumMg * amount,
    }),
    {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      saturatedFatG: 0,
      sugarG: 0,
      sodiumMg: 0,
    },
  );
}

export function CreateRecipePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [mealSlot, setMealSlot] = useState<MealSlot>('breakfast');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [searchAmounts, setSearchAmounts] = useState<Record<string, string>>({});
  const [searchUnits, setSearchUnits] = useState<Record<string, QtyUnit>>({});

  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void foodsApi.categories().then(setCategories);
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() && !selectedCategory) {
      return;
    }
    setError(null);
    setIsSearching(true);
    try {
      setSearchResults(await foodsApi.search(searchQuery, selectedCategory));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsSearching(false);
    }
  };

  const addIngredient = (foodItem: FoodItem) => {
    const unit = searchUnits[foodItem.id] ?? 'qty';
    const rawValue = Number(searchAmounts[foodItem.id] ?? '1') || 1;
    const amount = displayToAmount(rawValue, foodItem, unit);
    setDraftIngredients((prev) => [...prev, { foodItem, amount, unit }]);
    setSearchAmounts((prev) => {
      const next = { ...prev };
      delete next[foodItem.id];
      return next;
    });
    setSearchUnits((prev) => {
      const next = { ...prev };
      delete next[foodItem.id];
      return next;
    });
  };

  const removeIngredient = (index: number) => {
    setDraftIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const setIngredientAmount = (index: number, displayValue: number) => {
    setDraftIngredients((prev) =>
      prev.map((ingredient, i) =>
        i === index
          ? { ...ingredient, amount: displayToAmount(displayValue, ingredient.foodItem, ingredient.unit) }
          : ingredient,
      ),
    );
  };

  const setIngredientUnit = (index: number, unit: QtyUnit) => {
    setDraftIngredients((prev) => prev.map((ingredient, i) => (i === index ? { ...ingredient, unit } : ingredient)));
  };

  const handleSaveRecipe = async () => {
    if (!name.trim() || draftIngredients.length === 0) {
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await recipesApi.create({
        name,
        mealSlot,
        ingredients: draftIngredients.map(({ foodItem, amount }) => ({
          foodItemId: Number(foodItem.id),
          amount,
        })),
      });
      navigate('/recipes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  const preview = sumNutrition(draftIngredients);

  return (
    <div className="page recipes-page">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <div className="recipe-builder">
        <div className="recipe-builder-header">
          <span className="recipe-builder-title">Create a recipe</span>
          <Link to="/recipes" className="recipe-builder-back-link">
            ← All recipes
          </Link>
        </div>

        <label htmlFor="recipe-name">Recipe name</label>
        <div className="inline-form-row">
          <input
            id="recipe-name"
            type="text"
            placeholder="e.g. Spaghetti Bolognese"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <label htmlFor="recipe-meal-slot">Meal</label>
        <select
          id="recipe-meal-slot"
          value={mealSlot}
          onChange={(e) => setMealSlot(e.target.value as MealSlot)}
        >
          {SLOT_OPTIONS.map((slot) => (
            <option key={slot} value={slot}>
              {capitalize(slot)}
            </option>
          ))}
        </select>

        <form className="inline-form" onSubmit={(e) => void handleSearch(e)}>
          <label htmlFor="ingredient-search">Search ingredients</label>
          <div className="inline-form-row">
            <input
              id="ingredient-search"
              type="text"
              placeholder="e.g. chicken breast, egg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              id="ingredient-search-category"
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button type="submit" disabled={isSearching}>
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>

        {searchResults.length > 0 && (
          <ul className="log-list">
            {searchResults.map((foodItem) => {
              const unit = searchUnits[foodItem.id] ?? 'qty';
              return (
                <li key={foodItem.id}>
                  <span>
                    {foodItem.name}
                    {foodItem.company && ` (${foodItem.company})`} — {Math.round(foodItem.calories)} kcal /{' '}
                    {foodItem.baseUnit} (≈ {Math.round(foodItem.defaultServingWeightGrams)}g)
                  </span>
                  <span className="meal-item-actions">
                    <span className="qty-control">
                      <select
                        className="qty-unit-select"
                        aria-label={`Quantity unit for ${foodItem.name}`}
                        value={unit}
                        onChange={(e) =>
                          setSearchUnits((prev) => ({
                            ...prev,
                            [foodItem.id]: e.target.value as QtyUnit,
                          }))
                        }
                      >
                        <option value="qty">Qty</option>
                        <option value="grams">Grams</option>
                      </select>
                      <input
                        type="number"
                        min={unit === 'grams' ? '1' : '0.5'}
                        step={unit === 'grams' ? '1' : '0.5'}
                        aria-label={`${unit === 'grams' ? 'Grams' : 'Quantity'} of ${foodItem.name}`}
                        value={searchAmounts[foodItem.id] ?? '1'}
                        onChange={(e) =>
                          setSearchAmounts((prev) => ({ ...prev, [foodItem.id]: e.target.value }))
                        }
                      />
                      <span className="field-hint">
                        {unit === 'grams' ? 'g' : `× ${foodItem.baseUnit}`}
                      </span>
                    </span>
                    <button type="button" onClick={() => addIngredient(foodItem)}>
                      Add
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {draftIngredients.length === 0 ? (
          <p className="field-hint">Search above and add ingredients to build this recipe.</p>
        ) : (
          <>
            <ul className="log-list">
              {draftIngredients.map((ingredient, index) => (
                <li key={`${ingredient.foodItem.id}-${index}`}>
                  <span>
                    {ingredient.foodItem.name}
                    {ingredient.foodItem.company && ` (${ingredient.foodItem.company})`}
                  </span>
                  <span className="meal-item-actions">
                    <span className="qty-control">
                      <select
                        className="qty-unit-select"
                        aria-label={`Quantity unit for ${ingredient.foodItem.name}`}
                        value={ingredient.unit}
                        onChange={(e) => setIngredientUnit(index, e.target.value as QtyUnit)}
                      >
                        <option value="qty">Qty</option>
                        <option value="grams">Grams</option>
                      </select>
                      <input
                        type="number"
                        min={ingredient.unit === 'grams' ? '1' : '0.5'}
                        step={ingredient.unit === 'grams' ? '1' : '0.5'}
                        aria-label={`${ingredient.unit === 'grams' ? 'Grams' : 'Quantity'} of ${ingredient.foodItem.name}`}
                        value={amountToDisplay(ingredient.amount, ingredient.foodItem, ingredient.unit)}
                        onChange={(e) => setIngredientAmount(index, Number(e.target.value))}
                      />
                      <span className="field-hint">
                        {ingredient.unit === 'grams' ? 'g' : `× ${ingredient.foodItem.baseUnit}`}
                      </span>
                    </span>
                    <button type="button" onClick={() => removeIngredient(index)}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="field-hint">
              Preview: {Math.round(preview.calories)} kcal · {Math.round(preview.proteinG)}g protein ·{' '}
              {Math.round(preview.carbsG)}g carbs · {Math.round(preview.fatG)}g fat ·{' '}
              {Math.round(preview.saturatedFatG)}g saturated fat · {Math.round(preview.sugarG)}g sugar ·{' '}
              {Math.round(preview.sodiumMg)}mg sodium
            </p>
          </>
        )}

        <button
          type="button"
          className="save-recipe-button"
          disabled={isSaving || draftIngredients.length === 0 || !name.trim()}
          onClick={() => void handleSaveRecipe()}
        >
          {isSaving ? 'Saving…' : 'Save recipe'}
        </button>
      </div>
    </div>
  );
}
