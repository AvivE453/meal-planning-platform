import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Goal, NutritionTargets, WeightLog } from '@meal-planning/shared-types';
import { ApiError, logsApi, profileApi } from '../api/client';
import { GoalHero } from '../components/GoalHero';
import { TargetsCard } from '../components/TargetsCard';
import { WeightLogForm } from '../components/WeightLogForm';
import { WeightLogList } from '../components/WeightLogList';
import { WeightTrendChart } from '../components/WeightTrendChart';
import type { DashboardContext } from '../layout/DashboardLayout';

export function WeightPage() {
  const { profile, onProfileUpdated } = useOutletContext<DashboardContext>();
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingGoal, setIsChangingGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLogs(await logsApi.weight.list());
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

  useEffect(() => {
    void refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const handleChangeGoal = async (goal: Goal) => {
    if (goal === profile.goal) {
      return;
    }
    setError(null);
    setIsChangingGoal(true);
    try {
      const updated = await profileApi.upsert({
        sex: profile.sex,
        dateOfBirth: profile.dateOfBirth,
        heightCm: profile.heightCm,
        activityLevel: profile.activityLevel,
        goal,
        targetWeightKg: profile.targetWeightKg ?? undefined,
        weeklyRateKg: profile.weeklyRateKg ?? undefined,
      });
      onProfileUpdated(updated);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsChangingGoal(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    setError(null);
    try {
      await logsApi.weight.remove(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  };

  if (isLoading) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div className="page tracking-page">
      <div className="tracking-page-title">Tracking</div>

      <GoalHero
        goal={profile.goal}
        targets={targets}
        isChanging={isChangingGoal}
        onChangeGoal={(goal) => void handleChangeGoal(goal)}
      />

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <TargetsCard targets={targets} />
      <WeightLogForm onLogged={() => void refresh()} />
      <WeightLogList logs={logs} onDelete={(id) => void handleDeleteLog(id)} />
      <WeightTrendChart logs={logs} />
    </div>
  );
}
