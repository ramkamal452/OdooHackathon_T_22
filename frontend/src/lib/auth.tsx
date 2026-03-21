'use client';

import {
  ACCESS_KEY,
  REFRESH_KEY,
  User,
  api,
  clearStoredTokens,
} from '@/lib/api';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export interface RegisterPayload {
  email: string;
  password: string;
  password2: string;
  first_name: string;
  last_name: string;
  role: 'instructor' | 'learner';
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null;
    if (!token) {
      setUser(null);
      return;
    }
    const { data } = await api.get<User>('/api/auth/me/');
    setUser(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token =
          typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null;
        if (!token) {
          setUser(null);
          return;
        }
        const { data } = await api.get<User>('/api/auth/me/');
        if (!cancelled) setUser(data);
      } catch {
        if (!cancelled) {
          setUser(null);
          clearStoredTokens();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{
      access: string;
      refresh: string;
      user: User;
    }>('/api/auth/login/', { email, password });
    localStorage.setItem(ACCESS_KEY, data.access);
    localStorage.setItem(REFRESH_KEY, data.refresh);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { data } = await api.post<{
      access: string;
      refresh: string;
      user: User;
    }>('/api/auth/register/', payload);
    localStorage.setItem(ACCESS_KEY, data.access);
    localStorage.setItem(REFRESH_KEY, data.refresh);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearStoredTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
