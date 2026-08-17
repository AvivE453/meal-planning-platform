import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NutritionTargets } from '@meal-planning/shared-types';
import { ApiError, profileApi } from '../api/client';
import { TargetsCard } from '../components/TargetsCard';

export function HomePage() {
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setTargets(await profileApi.targets());
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          throw err;
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div className="page">
      <TargetsCard targets={targets} />
      <div className="nav-cards">
        <Link className="nav-card" to="/plan">
          <span className="nav-card-title">Meal Plan</span>
          <span className="field-hint">Generate a goal-based plan and log what you eat from it.</span>
        </Link>
        <Link className="nav-card" to="/weight">
          <span className="nav-card-title">Weight</span>
          <span className="field-hint">Log weigh-ins and see your trend.</span>
        </Link>
        <Link className="nav-card" to="/nutrition">
          <span className="nav-card-title">Nutrition Log</span>
          <span className="field-hint">Log food manually and see planned vs. actual.</span>
        </Link>
      </div>
    </div>
  );
}
