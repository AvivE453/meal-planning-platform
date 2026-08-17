import type {
  ActivityLog,
  AuthenticatedUser,
  AuthResponse,
  CreateActivityLogRequest,
  CreateNutritionLogRequest,
  CreateRestrictionRequest,
  CreateWeightLogRequest,
  DailyNutritionLog,
  DietaryRestriction,
  GenerateMealPlanRequest,
  LoginRequest,
  MealPlan,
  NutritionSummaryDay,
  NutritionTargets,
  RefreshRequest,
  RegisterRequest,
  UpsertProfileRequest,
  UserProfile,
  WeightLog,
} from '@meal-planning/shared-types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Access token lives in memory only (not localStorage) to limit exposure to
// XSS — a documented tradeoff, not a claim this is production-hardened.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : res.statusText;
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const authApi = {
  register: (body: RegisterRequest) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: LoginRequest) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  refresh: (body: RefreshRequest) =>
    request<AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify(body) }),
  logout: (body: RefreshRequest) => request<void>('/auth/logout', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request<AuthenticatedUser>('/users/me'),
};

export const profileApi = {
  get: () => request<UserProfile>('/users/me/profile'),
  upsert: (body: UpsertProfileRequest) =>
    request<UserProfile>('/users/me/profile', { method: 'PUT', body: JSON.stringify(body) }),
  targets: () => request<NutritionTargets>('/users/me/targets'),
};

export const restrictionsApi = {
  list: () => request<DietaryRestriction[]>('/users/me/restrictions'),
  create: (body: CreateRestrictionRequest) =>
    request<DietaryRestriction>('/users/me/restrictions', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => request<void>(`/users/me/restrictions/${id}`, { method: 'DELETE' }),
};

export const mealPlansApi = {
  list: () => request<MealPlan[]>('/meal-plans'),
  generate: (body: Partial<GenerateMealPlanRequest> = {}) =>
    request<MealPlan>('/meal-plans/generate', { method: 'POST', body: JSON.stringify(body) }),
};

export const logsApi = {
  weight: {
    list: () => request<WeightLog[]>('/logs/weight'),
    create: (body: CreateWeightLogRequest) =>
      request<WeightLog>('/logs/weight', { method: 'POST', body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/logs/weight/${id}`, { method: 'DELETE' }),
  },
  activity: {
    list: () => request<ActivityLog[]>('/logs/activity'),
    create: (body: CreateActivityLogRequest) =>
      request<ActivityLog>('/logs/activity', { method: 'POST', body: JSON.stringify(body) }),
  },
  nutrition: {
    list: () => request<DailyNutritionLog[]>('/logs/nutrition'),
    create: (body: CreateNutritionLogRequest) =>
      request<DailyNutritionLog>('/logs/nutrition', { method: 'POST', body: JSON.stringify(body) }),
  },
};

export const analyticsApi = {
  nutritionSummary: () => request<NutritionSummaryDay[]>('/analytics/nutrition-summary'),
};
