import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { publicApi } from '../services/api';

export type LocaleCode = 'en' | 'id' | 'ar';

const defaultTranslations: Record<string, string> = {
  app_name: 'Bintang Global',
  dashboard: 'Dashboard',
  orders: 'Orders',
  invoices: 'Invoices',
  users: 'Users',
  branches: 'Branches',
  settings: 'Settings',
  reports: 'Reports',
  hotels: 'Hotels',
  visa: 'Visa',
  tickets: 'Tickets',
  bus: 'Bus',
  packages: 'Packages',
  super_admin: 'Super Admin',
  monitoring: 'Monitoring',
  order_statistics: 'Order Statistics',
  system_logs: 'System Logs',
  maintenance: 'Maintenance',
  language: 'Language',
  deployment: 'Deployment',
  welcome: 'Welcome back',
  total_orders: 'Total Orders',
  total_revenue: 'Total Revenue',
  active_users: 'Active Users',
  system_health: 'System Health'
};

const I18nContext = createContext<{
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  t: (key: string) => string;
  loading: boolean;
}>({
  locale: 'id',
  setLocale: () => {},
  t: (k) => k,
  loading: false
});

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<LocaleCode>('id');
  const [translations, setTranslations] = useState<Record<string, string>>(defaultTranslations);
  const [loading, setLoading] = useState(false);

  const setLocale = (l: LocaleCode) => {
    setLocaleState(l);
    setLoading(true);
    publicApi.getI18n(l)
      .then((res: any) => setTranslations(res.data?.data || defaultTranslations))
      .catch(() => setTranslations(defaultTranslations))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    publicApi.getPublicSettings()
      .then((res) => (res.data?.data?.locale as LocaleCode) || 'id')
      .then((loc) => {
        setLocaleState(loc);
        return publicApi.getI18n(loc);
      })
      .then((res: any) => setTranslations(res.data?.data || defaultTranslations))
      .catch(() => setTranslations(defaultTranslations))
      .finally(() => setLoading(false));
  }, []);

  const t = (key: string) => translations[key] ?? key;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, loading }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
