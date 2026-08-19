import { useState, type FormEvent } from 'react';
import type { MealPlan, MealSlot, Recipe } from '@meal-planning/shared-types';
import { ApiError, mealPlansApi, recipesApi } from '../api/client';

const SLOT_OPTIONS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function FindMealModal({
  planId,
  onAdded,
  onClose,
}: {
  planId: string;
  onAdded: (plan: MealPlan) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recipeResults, setRecipeResults] = useState<Recipe[]>([]);

  const [selection, setSelection] = useState<Recipe | null>(null);
  const [mealSlot, setMealSlot] = useState<MealSlot>('breakfast');
  const [servings, setServings] = useState('1');
  const [isAdding, setIsAdding] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      return;
    }
    setError(null);
    setIsSearching(true);
    try {
      setRecipeResults(await recipesApi.list(query));
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsSearching(false);
    }
  };

  const selectRecipe = (recipe: Recipe) => {
    setSelection(recipe);
    setMealSlot(recipe.mealSlot);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!selection) {
      return;
    }
    setError(null);
    setIsAdding(true);
    try {
      const plan = await mealPlansApi.addItem(planId, {
        mealSlot,
        servings: Number(servings),
        recipeId: selection.id,
      });
      onAdded(plan);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Find a meal</span>
          <button type="button" className="modal-close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!selection ? (
          <>
            <form className="inline-form" onSubmit={(e) => void handleSearch(e)}>
              <div className="inline-form-row">
                <input
                  type="text"
                  placeholder="Search your recipes"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" disabled={isSearching}>
                  {isSearching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </form>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            {hasSearched && recipeResults.length === 0 && (
              <p className="field-hint">No recipes match &quot;{query}&quot;.</p>
            )}

            {recipeResults.length > 0 && (
              <ul className="log-list">
                {recipeResults.map((recipe) => (
                  <li key={recipe.id}>
                    <span>
                      {recipe.name} ({Math.round(recipe.calories)} kcal · {capitalize(recipe.mealSlot)})
                    </span>
                    <button type="button" onClick={() => selectRecipe(recipe)}>
                      Select
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <form className="inline-form" onSubmit={(e) => void handleAdd(e)}>
            <p className="field-hint">
              Adding <strong>{selection.name}</strong>
            </p>

            <label htmlFor="find-meal-slot">Meal</label>
            <select
              id="find-meal-slot"
              value={mealSlot}
              onChange={(e) => setMealSlot(e.target.value as MealSlot)}
            >
              {SLOT_OPTIONS.map((slot) => (
                <option key={slot} value={slot}>
                  {capitalize(slot)}
                </option>
              ))}
            </select>

            <label htmlFor="find-meal-servings">Servings</label>
            <input
              id="find-meal-servings"
              type="number"
              min="0.1"
              step="0.1"
              required
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <div className="inline-form-row">
              <button type="button" onClick={() => setSelection(null)}>
                Back
              </button>
              <button type="submit" disabled={isAdding}>
                {isAdding ? 'Adding…' : 'Add to plan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
