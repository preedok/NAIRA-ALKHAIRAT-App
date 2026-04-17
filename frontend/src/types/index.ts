import type { ReactNode } from 'react';

export type UserRole = 'admin' | 'jamaah';
export type CanonicalUserRole = UserRole;

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branch_id?: string;
  branch_name?: string;
  wilayah_id?: string;
  company_name?: string;
  is_active: boolean;
  owner_status?: string;
  has_special_price?: boolean;
  created_at: string;
  last_login?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export const ROLE_NAMES: Record<UserRole, string> = {
  admin: 'Admin',
  jamaah: 'Jamaah'
};

export function normalizeUserRole(role: string): CanonicalUserRole {
  const raw = String(role || '').toLowerCase();
  if (raw === 'admin' || raw === 'admin_pusat' || raw === 'admin_cabang') return 'admin';
  return 'jamaah';
}

export interface MenuItem {
  title: string;
  icon: ReactNode;
  path: string;
  roles: UserRole[];
  badge?: string;
  children?: MenuItem[];
}

export interface TableColumn {
  id: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sortKey?: string;
}

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';
export type BadgeSize = 'sm' | 'md' | 'lg';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  divider?: boolean;
  danger?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
