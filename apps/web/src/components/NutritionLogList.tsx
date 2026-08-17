import type { DailyNutritionLog } from '@meal-planning/shared-types';

function describe(log: DailyNutritionLog): string {
  if (log.foodItem) {
    return `${log.foodItem.name} × ${log.servings}`;
  }
  return 'Manual entry';
}

export function NutritionLogList({ logs }: { logs: DailyNutritionLog[] }) {
  if (logs.length === 0) {
    return <p className="field-hint">Nothing logged yet.</p>;
  }

  return (
    <ul className="log-list">
      {logs.map((log) => (
        <li key={log.id}>
          <span>{describe(log)}</span>
          <span className="log-date">
            {Math.round(log.calories)} kcal · {new Date(log.loggedAt).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
