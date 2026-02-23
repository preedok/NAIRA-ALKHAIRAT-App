import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, UserRole } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mapUser = (raw: any): User => ({
    id: raw.id,
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    role: raw.role,
    branch_id: raw.branch_id,
    branch_name: raw.branch_name ?? raw.Branch?.name,
    wilayah_id: raw.wilayah_id,
    company_name: raw.company_name,
    is_active: raw.is_active !== false,
    owner_status: raw.owner_status,
    has_special_price: raw.has_special_price,
    created_at: raw.created_at,
    last_login: raw.last_login_at
  });

  const refreshUser = async () => {
    const token = localStorage.getItem('bintang_global_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await authApi.me();
      if (res.data.success && res.data.data) {
        setUser(mapUser(res.data.data));
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    try {
      const res = await authApi.login(credentials.email, credentials.password);
      const data = res.data;
      if (!data.success || !data.data?.token) {
        setIsLoading(false);
        return { success: false, message: data.message || 'Login gagal' };
      }
      const u = data.data.user;
      localStorage.setItem('bintang_global_token', data.data.token);
      setUser(mapUser(u));
      setIsLoading(false);
      return { success: true, message: data.message };
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Terjadi kesalahan';
      setIsLoading(false);
      return { success: false, message };
    }
  };

  const logout = () => {
    localStorage.removeItem('bintang_global_user');
    localStorage.removeItem('bintang_global_token');
    setUser(null);
  };

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) return role.includes(user.role);
    return user.role === role;
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasRole,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
