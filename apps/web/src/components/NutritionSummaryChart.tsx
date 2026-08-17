import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NutritionSummaryDay } from '@meal-planning/shared-types';

export function NutritionSummaryChart({ days }: { days: NutritionSummaryDay[] }) {
  const hasAnyData = days.some((day) => day.actualCalories > 0 || day.plannedCalories !== null);
  if (!hasAnyData) {
    return <p className="field-hint">Generate a plan or log food to see planned vs. actual calories.</p>;
  }

  const data = days.map((day) => ({
    date: new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    Planned: day.plannedCalories ?? 0,
    Actual: day.actualCalories,
  }));

  return (
    <div className="chart-card">
      <div className="chart-title">Calories: planned vs. actual (last 14 days)</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 12, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => [`${Math.round(Number(value))} kcal`, undefined]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Planned" fill="#a8d5b5" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Actual" fill="#1a7f37" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
