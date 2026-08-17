import { useCallback, useEffect, useState } from 'react';
import type { DailyNutritionLog, NutritionSummaryDay } from '@meal-planning/shared-types';
import { analyticsApi, logsApi } from '../api/client';
import { NutritionLogForm } from '../components/NutritionLogForm';
import { NutritionLogList } from '../components/NutritionLogList';
import { NutritionSummaryChart } from '../components/NutritionSummaryChart';

export function NutritionPage() {
  const [logs, setLogs] = useState<DailyNutritionLog[]>([]);
  const [summary, setSummary] = useState<NutritionSummaryDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLogs(await logsApi.nutrition.list());
    setSummary(await analyticsApi.nutritionSummary());
  }, []);

  useEffect(() => {
    void refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  if (isLoading) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div className="page">
      <NutritionLogForm onLogged={() => void refresh()} />
      <NutritionLogList logs={logs} />
      <NutritionSummaryChart days={summary} />
    </div>
  );
}
