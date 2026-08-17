import { useCallback, useEffect, useState } from 'react';
import type {
  DailyNutritionLog,
  MealPlan,
  NutritionSummaryDay,
  NutritionTargets,
  UserProfile,
  WeightLog,
} from '@meal-planning/shared-types';
import { analyticsApi, ApiError, logsApi, mealPlansApi, profileApi } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { Onboarding } from '../profile/Onboarding';
import { MealPlanCard } from './MealPlanCard';
import { NutritionLogForm } from './NutritionLogForm';
import { NutritionLogList } from './NutritionLogList';
import { NutritionSummaryChart } from './NutritionSummaryChart';
import { TargetsCard } from './TargetsCard';
import { WeightLogForm } from './WeightLogForm';
import { WeightLogList } from './WeightLogList';
import { WeightTrendChart } from './WeightTrendChart';

export function Dashboard() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [latestPlan, setLatestPlan] = useState<MealPlan | null>(null);
  const [nutritionLogs, setNutritionLogs] = useState<DailyNutritionLog[]>([]);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummaryDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTargetsAndLogs = useCallback(async () => {
    setWeightLogs(await logsApi.weight.list());
    try {
      setTargets(await profileApi.targets());
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setTargets(null);
      } else {
        throw err;
      }
    }
  }, []);

  const refreshNutritionSummary = useCallback(async () => {
    setNutritionSummary(await analyticsApi.nutritionSummary());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const loadedProfile = await profileApi.get();
        setProfile(loadedProfile);
        await refreshTargetsAndLogs();
        const plans = await mealPlansApi.list();
        setLatestPlan(plans[0] ?? null);
        setNutritionLogs(await logsApi.nutrition.list());
        await refreshNutritionSummary();
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setProfile(null);
        } else {
          throw err;
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshTargetsAndLogs, refreshNutritionSummary]);

  if (isLoading) {
    return <div className="dashboard-shell">Loading…</div>;
  }

  if (!profile) {
    return (
      <div className="dashboard-shell">
        <Onboarding
          onComplete={(newProfile) => {
            setProfile(newProfile);
            void refreshTargetsAndLogs();
          }}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <h1>Meal Planning &amp; Tracking Platform</h1>
      <p>Signed in as {user?.email}</p>

      <TargetsCard targets={targets} />

      <MealPlanCard
        plan={latestPlan}
        onGenerated={(plan) => {
          setLatestPlan(plan);
          void refreshNutritionSummary();
        }}
        onLogged={(log) => {
          setNutritionLogs((prev) => [log, ...prev]);
          void refreshNutritionSummary();
        }}
      />

      <WeightLogForm
        onLogged={(log) => {
          setWeightLogs((prev) => [log, ...prev]);
          void refreshTargetsAndLogs();
        }}
      />
      <WeightLogList logs={weightLogs} />
      <WeightTrendChart logs={weightLogs} />

      <NutritionLogForm
        onLogged={(log) => {
          setNutritionLogs((prev) => [log, ...prev]);
          void refreshNutritionSummary();
        }}
      />
      <NutritionLogList logs={nutritionLogs} />
      <NutritionSummaryChart days={nutritionSummary} />

      <button type="button" onClick={() => void logout()}>
        Log out
      </button>
    </div>
  );
}
