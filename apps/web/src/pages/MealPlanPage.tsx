import { useEffect, useState } from 'react';
import type { MealPlan } from '@meal-planning/shared-types';
import { mealPlansApi } from '../api/client';
import { MealPlanCard } from '../components/MealPlanCard';

export function MealPlanPage() {
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const plans = await mealPlansApi.list();
      setPlan(plans[0] ?? null);
      setIsLoading(false);
    })();
  }, []);

  if (isLoading) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div className="page">
      {/* Logging an item here only affects the Nutrition page's own data,
          which it re-fetches on navigation — no cross-page state to sync. */}
      <MealPlanCard plan={plan} onGenerated={setPlan} onLogged={() => {}} />
    </div>
  );
}
