import { useCallback, useEffect, useState } from 'react';
import type { NutritionTargets, WeightLog } from '@meal-planning/shared-types';
import { ApiError, logsApi, profileApi } from '../api/client';
import { TargetsCard } from '../components/TargetsCard';
import { WeightLogForm } from '../components/WeightLogForm';
import { WeightLogList } from '../components/WeightLogList';
import { WeightTrendChart } from '../components/WeightTrendChart';

export function WeightPage() {
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div className="page">
      <TargetsCard targets={targets} />
      <WeightLogForm onLogged={() => void refresh()} />
      <WeightLogList logs={logs} />
      <WeightTrendChart logs={logs} />
    </div>
  );
}
