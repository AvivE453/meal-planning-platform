import { createContext } from 'react';
import type { AuthenticatedUser } from '@meal-planning/shared-types';

export interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
