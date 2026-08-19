import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MealPlan, MealSlot, Recipe } from '@meal-planning/shared-types';
import { ApiError, logsApi, mealPlansApi, recipesApi } from '../api/client';
import { FindMealModal } from '../components/FindMealModal';

const SLOT_OPTIONS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFindMealOpen, setIsFindMealOpen] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  const [servingsById, setServingsById] = useState<Record<string, string>>({});
  const [pendingLogId, setPendingLogId] = useState<string | null>(null);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const [recipeList, plans] = await Promise.all([recipesApi.list(), mealPlansApi.list()]);
    setRecipes(recipeList);
    setCurrentPlan(plans[0] ?? null);
  }, []);

  useEffect(() => {
    void refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const handleLogRecipe = async (recipeId: string) => {
    const servings = Number(servingsById[recipeId] ?? '1');
    setError(null);
    setPendingLogId(recipeId);
    try {
      await logsApi.nutrition.create({ source: 'recipe', recipeId, servings });
      setLoggedIds((prev) => new Set(prev).add(recipeId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPendingLogId(null);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    setError(null);
    try {
      await recipesApi.remove(recipeId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  const handleMealAdded = (plan: MealPlan) => {
    setCurrentPlan(plan);
    setAddedMessage(`Added to your plan for ${plan.date}.`);
  };

  if (isLoading) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div className="page recipes-page">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {addedMessage && <p className="field-hint">{addedMessage}</p>}

      <div className="recipes-page-header">
        <span className="recipes-page-title">Your recipes</span>
        <div className="recipes-page-header-actions">
          {currentPlan && (
            <button type="button" onClick={() => setIsFindMealOpen(true)}>
              Find meal
            </button>
          )}
          <Link to="/recipes/new" className="save-recipe-button recipes-page-new-link">
            Make a recipe
          </Link>
        </div>
      </div>

      {recipes.length === 0 ? (
        <p className="field-hint">No saved recipes yet — make your first one.</p>
      ) : (
        SLOT_OPTIONS.map((slot) => {
          const slotRecipes = recipes.filter((recipe) => recipe.mealSlot === slot);
          if (slotRecipes.length === 0) {
            return null;
          }
          return (
            <div className="meal-slot" key={slot}>
              <div className="meal-slot-title">{capitalize(slot)}</div>
              <ul className="log-list">
                {slotRecipes.map((recipe) => (
                  <li key={recipe.id}>
                    <span>
                      {recipe.name} — {Math.round(recipe.calories)} kcal · {Math.round(recipe.proteinG)}g protein ·{' '}
                      {Math.round(recipe.carbsG)}g carbs · {Math.round(recipe.fatG)}g fat ·{' '}
                      {Math.round(recipe.saturatedFatG)}g saturated fat · {Math.round(recipe.sugarG)}g sugar ·{' '}
                      {Math.round(recipe.sodiumMg)}mg sodium
                    </span>
                    <span className="meal-item-actions">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        placeholder="servings"
                        value={servingsById[recipe.id] ?? '1'}
                        onChange={(e) =>
                          setServingsById((prev) => ({ ...prev, [recipe.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="log-item-button"
                        disabled={pendingLogId === recipe.id || loggedIds.has(recipe.id)}
                        onClick={() => void handleLogRecipe(recipe.id)}
                      >
                        {loggedIds.has(recipe.id) ? 'Logged' : pendingLogId === recipe.id ? '…' : 'Log as eaten'}
                      </button>
                      <button type="button" onClick={() => void handleDeleteRecipe(recipe.id)}>
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}

      {isFindMealOpen && currentPlan && (
        <FindMealModal
          planId={currentPlan.id}
          onAdded={handleMealAdded}
          onClose={() => setIsFindMealOpen(false)}
        />
      )}
    </div>
  );
}
