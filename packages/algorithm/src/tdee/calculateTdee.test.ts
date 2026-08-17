import { describe, expect, it } from 'vitest';
import { calculateAge, calculateBmr, calculateTdee } from './calculateTdee.js';

describe('calculateBmr', () => {
  it('computes BMR for a male using Mifflin-St Jeor', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const bmr = calculateBmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 });
    expect(bmr).toBeCloseTo(1780, 5);
  });

  it('computes BMR for a female using Mifflin-St Jeor', () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    const bmr = calculateBmr({ sex: 'female', age: 25, heightCm: 165, weightKg: 60 });
    expect(bmr).toBeCloseTo(1345.25, 5);
  });
});

describe('calculateTdee', () => {
  it('scales BMR by the activity-level multiplier', () => {
    const tdee = calculateTdee({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activityLevel: 'moderate' });
    expect(tdee).toBeCloseTo(1780 * 1.55, 5);
  });

  it('produces a higher TDEE for a more active level, all else equal', () => {
    const base = { sex: 'male' as const, age: 30, heightCm: 180, weightKg: 80 };
    const sedentary = calculateTdee({ ...base, activityLevel: 'sedentary' });
    const veryActive = calculateTdee({ ...base, activityLevel: 'very_active' });
    expect(veryActive).toBeGreaterThan(sedentary);
  });
});

describe('calculateAge', () => {
  it('counts a full year when the birthday has already passed this year', () => {
    expect(calculateAge('1995-06-15', new Date('2026-06-16T00:00:00Z'))).toBe(31);
  });

  it('counts the birthday itself as having passed', () => {
    expect(calculateAge('1995-06-15', new Date('2026-06-15T00:00:00Z'))).toBe(31);
  });

  it('does not count the year yet when the birthday has not occurred', () => {
    expect(calculateAge('1995-06-15', new Date('2026-06-14T00:00:00Z'))).toBe(30);
  });
});
