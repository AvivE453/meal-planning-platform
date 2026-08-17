import { useState } from 'react';
import type { DailyNutritionLog, MealPlan, MealSlot } from '@meal-planning/shared-types';
import { ApiError, logsApi, mealPlansApi } from '../api/client';

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function MealPlanCard({
  plan,
  onGenerated,
  onLogged,
}: {
  plan: MealPlan | null;
  onGenerated: (plan: MealPlan) => void;
  onLogged: (log: DailyNutritionLog) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [loggedItemIds, setLoggedItemIds] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      onGenerated(await mealPlansApi.generate());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogItem = async (mealPlanItemId: string) => {
    setError(null);
    setPendingItemId(mealPlanItemId);
    try {
      const log = await logsApi.nutrition.create({ source: 'meal_plan', mealPlanItemId });
      setLoggedItemIds((prev) => new Set(prev).add(mealPlanItemId));
      onLogged(log);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPendingItemId(null);
    }
  };

  const totalCalories = plan?.items.reduce((sum, item) => sum + item.calories, 0) ?? 0;

  return (
    <div className="meal-plan-card">
      <div className="meal-plan-header">
        <span>{plan ? `Plan for ${plan.date}` : 'No meal plan yet'}</span>
        <button type="button" onClick={() => void handleGenerate()} disabled={isGenerating}>
          {isGenerating ? 'Generating…' : plan ? 'Regenerate' : 'Generate meal plan'}
        </button>
      </div>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {plan && plan.items.length === 0 && (
        <p className="field-hint">
          No candidates fit your targets this time — try regenerating or adjusting your profile.
        </p>
      )}

      {plan && plan.items.length > 0 && (
        <>
          <div className="meal-plan-totals">
            {Math.round(totalCalories)} / {Math.round(plan.calorieTarget)} kcal
          </div>
          {SLOT_ORDER.map((slot) => {
            const items = plan.items.filter((item) => item.mealSlot === slot);
            if (items.length === 0) {
              return null;
            }
            return (
              <div className="meal-slot" key={slot}>
                <div className="meal-slot-title">{capitalize(slot)}</div>
                <ul className="meal-item-list">
                  {items.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.foodItem.name} × {item.servings}
                      </span>
                      <span className="meal-item-actions">
                        <span>{Math.round(item.calories)} kcal</span>
                        <button
                          type="button"
                          className="log-item-button"
                          disabled={pendingItemId === item.id || loggedItemIds.has(item.id)}
                          onClick={() => void handleLogItem(item.id)}
                        >
                          {loggedItemIds.has(item.id)
                            ? 'Logged'
                            : pendingItemId === item.id
                              ? '…'
                              : 'Log as eaten'}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
