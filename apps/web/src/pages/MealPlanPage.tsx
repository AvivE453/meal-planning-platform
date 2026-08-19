import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MealPlan } from '@meal-planning/shared-types';
import { mealPlansApi } from '../api/client';
import { MealPlanCard } from '../components/MealPlanCard';

export function MealPlanPage() {
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date') ?? undefined;
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    void (async () => {
      const plans = await mealPlansApi.list();
      setPlan((date ? plans.find((p) => p.date === date) : plans[0]) ?? null);
      setIsLoading(false);
    })();
  }, [date]);

  if (isLoading) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div className="page">
      {date && !plan && <p className="field-hint">No plan yet for {date} — generate one below.</p>}
      {/* Logging an item here only affects the Nutrition page's own data,
          which it re-fetches on navigation — no cross-page state to sync. */}
      <MealPlanCard plan={plan} date={date} onGenerated={setPlan} onLogged={() => {}} />
    </div>
  );
}
