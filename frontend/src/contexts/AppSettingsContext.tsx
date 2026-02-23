import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { publicApi } from '../services/api';

export interface AppSettingsState {
  locale: string;
  primary_color: string;
  background_color: string;
  text_color: string;
  font_size: string;
  ui_template: string;
}

const defaults: AppSettingsState = {
  locale: 'id',
  primary_color: '#059669',
  background_color: '#f8fafc',
  text_color: '#0f172a',
  font_size: '14',
  ui_template: 'default'
};

const AppSettingsContext = createContext<{
  settings: AppSettingsState;
  loading: boolean;
  refresh: () => Promise<void>;
}>({ settings: defaults, loading: false, refresh: async () => {} });

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettingsState>(defaults);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await publicApi.getPublicSettings();
      if (res.data.success && res.data.data) {
        setSettings({ ...defaults, ...res.data.data });
        applyCssVars(res.data.data);
      }
    } catch {
      applyCssVars(defaults);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

function applyCssVars(s: Partial<AppSettingsState>) {
  const root = document.documentElement;
  if (s.primary_color) root.style.setProperty('--app-primary', s.primary_color);
  if (s.background_color) root.style.setProperty('--app-bg', s.background_color);
  if (s.text_color) root.style.setProperty('--app-text', s.text_color);
  if (s.font_size) root.style.setProperty('--app-font-size', `${s.font_size}px`);
}

export const useAppSettings = () => useContext(AppSettingsContext);
