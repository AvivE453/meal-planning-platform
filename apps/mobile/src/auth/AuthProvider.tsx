import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { AuthenticatedUser } from '@meal-planning/shared-types';
import { ApiError, authApi, setAccessToken } from '../api/client';
import { AuthContext } from './auth-context';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback(async (accessToken: string, refreshToken: string, sessionUser: AuthenticatedUser) => {
    setAccessToken(accessToken);
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    setUser(sessionUser);
  }, []);

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    setUser(null);
  }, []);

  // On load, try to silently resume a session from the stored refresh token.
  useEffect(() => {
    void (async () => {
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!storedRefreshToken) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await authApi.refresh({ refreshToken: storedRefreshToken });
        await applySession(res.accessToken, res.refreshToken, res.user);
      } catch {
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [applySession, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const res = await authApi.login({ email, password });
        await applySession(res.accessToken, res.refreshToken, res.user);
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
        await applySession(res.accessToken, res.refreshToken, res.user);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong');
        throw err;
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (storedRefreshToken) {
      // Best-effort: revoke server-side, but the user is logged out locally
      // either way — a network hiccup shouldn't trap them in a signed-in UI.
      await authApi.logout({ refreshToken: storedRefreshToken }).catch(() => {});
    }
    await clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, isLoading, error, login, register, logout }),
    [user, isLoading, error, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
