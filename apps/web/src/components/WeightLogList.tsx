import type { WeightLog } from '@meal-planning/shared-types';

export function WeightLogList({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return <p className="field-hint">No weight logged yet.</p>;
  }

  return (
    <ul className="log-list">
      {logs.map((log) => (
        <li key={log.id}>
          <span>{log.weightKg} kg</span>
          <span className="log-date">{new Date(log.loggedAt).toLocaleDateString()}</span>
        </li>
      ))}
    </ul>
  );
}
