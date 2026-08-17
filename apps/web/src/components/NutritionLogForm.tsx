import { useState, type FormEvent } from 'react';
import type { DailyNutritionLog } from '@meal-planning/shared-types';
import { ApiError, logsApi } from '../api/client';

export function NutritionLogForm({ onLogged }: { onLogged: (log: DailyNutritionLog) => void }) {
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const log = await logsApi.nutrition.create({
        source: 'manual',
        calories: Number(calories),
        proteinG: Number(proteinG || 0),
        carbsG: Number(carbsG || 0),
        fatG: Number(fatG || 0),
      });
      setCalories('');
      setProteinG('');
      setCarbsG('');
      setFatG('');
      onLogged(log);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={(e) => void handleSubmit(e)}>
      <label htmlFor="nutrition-calories">Log food eaten (manual)</label>
      <div className="inline-form-row">
        <input
          id="nutrition-calories"
          type="number"
          min="1"
          step="1"
          placeholder="kcal"
          required
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="1"
          placeholder="protein g"
          value={proteinG}
          onChange={(e) => setProteinG(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="1"
          placeholder="carbs g"
          value={carbsG}
          onChange={(e) => setCarbsG(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="1"
          placeholder="fat g"
          value={fatG}
          onChange={(e) => setFatG(e.target.value)}
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
