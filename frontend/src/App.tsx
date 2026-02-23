import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppSettingsProvider } from './contexts/AppSettingsContext';
import { I18nProvider } from './contexts/I18nContext';
import { ToastProvider } from './contexts/ToastContext';
import router from './routes';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <AppSettingsProvider>
        <I18nProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </I18nProvider>
      </AppSettingsProvider>
    </AuthProvider>
  );
}

export default App;