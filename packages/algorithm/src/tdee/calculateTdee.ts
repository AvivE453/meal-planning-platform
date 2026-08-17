import type { ActivityLevel, Sex } from '@meal-planning/shared-types';

export interface TdeeInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Mifflin-St Jeor — the most widely-validated BMR formula for a general population. */
export function calculateBmr(input: Pick<TdeeInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === 'male' ? base + 5 : base - 161;
}

export function calculateTdee(input: TdeeInput): number {
  return calculateBmr(input) * ACTIVITY_MULTIPLIERS[input.activityLevel];
}

export function calculateAge(dateOfBirth: string, asOf: Date = new Date()): number {
  const dob = new Date(dateOfBirth);
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const hasHadBirthdayThisYear =
    asOf.getUTCMonth() > dob.getUTCMonth() ||
    (asOf.getUTCMonth() === dob.getUTCMonth() && asOf.getUTCDate() >= dob.getUTCDate());
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}
