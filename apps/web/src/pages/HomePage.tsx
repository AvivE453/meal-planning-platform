import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { NutritionTargets } from '@meal-planning/shared-types';
import { ApiError, profileApi } from '../api/client';
import { Calendar } from '../components/Calendar';
import { GoalHero } from '../components/GoalHero';
import { HomeHero } from '../components/HomeHero';
import type { DashboardContext } from '../layout/DashboardLayout';

export function HomePage() {
  const { profile } = useOutletContext<DashboardContext>();
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadTargets = useCallback(async () => {
    try {
      setTargets(await profileApi.targets());
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        throw err;
      }
    }
  }, []);

  useEffect(() => {
    void loadTargets().finally(() => setIsLoading(false));
  }, [loadTargets]);

  if (isLoading) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div className="page">
      <HomeHero />
      <GoalHero goal={profile.goal} targets={targets} />
      <Calendar />
    </div>
  );
}
