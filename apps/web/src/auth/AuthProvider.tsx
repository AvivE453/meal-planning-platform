import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthenticatedUser } from '@meal-planning/shared-types';
import { ApiError, authApi, setAccessToken } from '../api/client';
import { AuthContext } from './auth-context';

const REFRESH_TOKEN_KEY = 'meal-planning:refreshToken';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback((accessToken: string, refreshToken: string, sessionUser: AuthenticatedUser) => {
    setAccessToken(accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    setUser(sessionUser);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setUser(null);
  }, []);

  // On load, try to silently resume a session from the refresh token that
  // survived a page reload (the access token itself never does).
  useEffect(() => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      setIsLoading(false);
      return;
    }
    authApi
      .refresh({ refreshToken: storedRefreshToken })
      .then((res) => applySession(res.accessToken, res.refreshToken, res.user))
      .catch(() => clearSession())
      .finally(() => setIsLoading(false));
  }, [applySession, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const res = await authApi.login({ email, password });
        applySession(res.accessToken, res.refreshToken, res.user);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong');
        throw err;
      }
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const res = await authApi.register({ email, password });
        applySession(res.accessToken, res.refreshToken, res.user);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong');
        throw err;
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (storedRefreshToken) {
      // Best-effort: revoke server-side, but the user is logged out locally
      // either way — a network hiccup shouldn't trap them in a signed-in UI.
      await authApi.logout({ refreshToken: storedRefreshToken }).catch(() => {});
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, isLoading, error, login, register, logout }),
    [user, isLoading, error, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
