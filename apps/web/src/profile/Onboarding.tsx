import { useState, type FormEvent } from 'react';
import type { ActivityLevel, Goal, Sex, UserProfile } from '@meal-planning/shared-types';
import { ApiError, profileApi } from '../api/client';

export function Onboarding({ onComplete }: { onComplete: (profile: UserProfile) => void }) {
  const [sex, setSex] = useState<Sex>('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<Goal>('maintenance');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const profile = await profileApi.upsert({
        sex,
        dateOfBirth,
        heightCm: Number(heightCm),
        activityLevel,
        goal,
      });
      onComplete(profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
      <h2>Set up your profile</h2>
      <p className="field-hint">This is used to calculate your calorie and macro targets.</p>

      <label htmlFor="sex">Sex</label>
      <select id="sex" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>

      <label htmlFor="dob">Date of birth</label>
      <input id="dob" type="date" required value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />

      <label htmlFor="height">Height (cm)</label>
      <input
        id="height"
        type="number"
        min="1"
        step="0.1"
        required
        value={heightCm}
        onChange={(e) => setHeightCm(e.target.value)}
      />

      <label htmlFor="activity">Activity level</label>
      <select id="activity" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}>
        <option value="sedentary">Sedentary (little to no exercise)</option>
        <option value="light">Light (1-3 days/week)</option>
        <option value="moderate">Moderate (3-5 days/week)</option>
        <option value="active">Active (6-7 days/week)</option>
        <option value="very_active">Very active (physical job or 2x/day)</option>
      </select>

      <label htmlFor="goal">Goal</label>
      <select id="goal" value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
        <option value="weight_loss">Weight loss</option>
        <option value="weight_gain">Weight gain</option>
        <option value="maintenance">Maintenance</option>
      </select>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
