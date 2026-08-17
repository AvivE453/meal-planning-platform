export type Sex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type Goal = 'weight_loss' | 'weight_gain' | 'maintenance';

export type RestrictionType = 'allergy' | 'intolerance' | 'preference';

export interface UserProfile {
  userId: string;
  sex: Sex;
  dateOfBirth: string; // ISO date
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetWeightKg: number | null;
  weeklyRateKg: number | null;
  updatedAt: string; // ISO datetime
}

export interface DietaryRestriction {
  id: string;
  userId: string;
  type: RestrictionType;
  value: string;
  createdAt: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface UpsertProfileRequest {
  sex: Sex;
  dateOfBirth: string;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetWeightKg?: number;
  weeklyRateKg?: number;
}

export interface CreateRestrictionRequest {
  type: RestrictionType;
  value: string;
}
