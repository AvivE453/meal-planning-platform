import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WeightLog } from '@meal-planning/shared-types';

export function WeightTrendChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length < 2) {
    return <p className="field-hint">Log at least two weigh-ins to see a trend.</p>;
  }

  const data = [...logs]
    .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime())
    .map((log) => ({
      date: new Date(log.loggedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      weightKg: log.weightKg,
    }));

  return (
    <div className="chart-card">
      <div className="chart-title">Weight trend</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 12, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
          <Tooltip formatter={(value) => [`${Number(value)} kg`, 'Weight']} />
          <Line type="monotone" dataKey="weightKg" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
