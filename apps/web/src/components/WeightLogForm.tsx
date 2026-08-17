import { useState, type FormEvent } from 'react';
import type { WeightLog } from '@meal-planning/shared-types';
import { ApiError, logsApi } from '../api/client';

export function WeightLogForm({ onLogged }: { onLogged: (log: WeightLog) => void }) {
  const [weightKg, setWeightKg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const log = await logsApi.weight.create({ weightKg: Number(weightKg) });
      setWeightKg('');
      onLogged(log);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={(e) => void handleSubmit(e)}>
      <label htmlFor="weight-kg">Log weight (kg)</label>
      <div className="inline-form-row">
        <input
          id="weight-kg"
          type="number"
          min="1"
          step="0.1"
          required
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging…' : 'Log'}
        </button>
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
