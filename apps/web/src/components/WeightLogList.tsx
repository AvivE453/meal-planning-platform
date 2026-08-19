import { useState } from 'react';
import type { WeightLog } from '@meal-planning/shared-types';

export function WeightLogList({
  logs,
  onDelete,
}: {
  logs: WeightLog[];
  onDelete: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (logs.length === 0) {
    return <p className="field-hint">No weight logged yet.</p>;
  }

  return (
    <ul className="log-list">
      {logs.map((log) => (
        <li
          key={log.id}
          className="log-list-clickable"
          onClick={() => setSelectedId((prev) => (prev === log.id ? null : log.id))}
        >
          <span>{log.weightKg} kg</span>
          <span className="meal-item-actions">
            <span className="log-date">{new Date(log.loggedAt).toLocaleDateString()}</span>
            {selectedId === log.id && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(log.id);
                }}
              >
                Delete
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
