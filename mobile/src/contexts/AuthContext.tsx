import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken, setToken as saveToken, clearToken } from '../api/client';
import { authApi } from '../api/client';

type User = { id: string; name?: string; email?: string; role?: string; company_name?: string } | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await authApi.me();
      if (res.data.success && res.data.data) setUser(res.data.data);
      else setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await authApi.login(email, password);
      if (res.data.success && res.data.data?.token) {
        await saveToken(res.data.data.token);
        setUser(res.data.data.user ?? null);
        return { ok: true };
      }
      return { ok: false, message: res.data.message || 'Login gagal' };
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Login gagal';
      return { ok: false, message: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
