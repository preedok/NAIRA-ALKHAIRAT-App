import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import MaintenanceGate from '../components/MaintenanceGate';
import DashboardLayout from '../layouts/DashboardLayout';
import LandingPage from '../pages/landing/LandingPage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import VerifyOtpPage from '../pages/auth/VerifyOtpPage';
import DashboardRouter from '../pages/dashboard/DashboardRouter';
import PackagesPage from '../pages/dashboard/components/PackagesPage';
import OrderFormPage from '../pages/dashboard/components/OrderFormPage';
import UsersPage from '../pages/dashboard/components/UsersPage';
import ReportsPage from '../pages/dashboard/components/ReportsPage';
import SettingsPage from '../pages/dashboard/components/SettingsPage';
import ProfilePage from '../pages/dashboard/components/ProfilePage';
import OrdersInvoicesPage from '../pages/dashboard/components/OrdersInvoicesPage';
import InstallmentsPage from '../pages/dashboard/components/InstallmentsPage';
import KlotersPage from '../pages/dashboard/components/KlotersPage';
import FlyersPage from '../pages/dashboard/components/FlyersPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />
  },
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/register',
    element: <RegisterPage />
  },
  {
    path: '/verify-otp',
    element: <VerifyOtpPage />
  },
  {
    path: '/dashboard',
    element: <ProtectedRoute />,
    children: [
      {
        element: <MaintenanceGate />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              {
                index: true,
                element: <DashboardRouter />
              },
          {
            path: 'packages',
            element: <PackagesPage />
          },
          {
            path: 'orders/new',
            element: <OrderFormPage />
          },
          {
            path: 'orders/:id/edit',
            element: <OrderFormPage />
          },
          {
            path: 'orders',
            element: <Navigate to="/dashboard/orders-invoices" replace />
          },
          {
            path: 'orders-invoices',
            element: <OrdersInvoicesPage />
          },
          {
            path: 'invoices',
            element: <Navigate to="/dashboard/orders-invoices" replace />
          },
          {
            path: 'installments',
            element: <InstallmentsPage />
          },
          {
            path: 'kloters',
            element: <KlotersPage />
          },
          {
            path: 'flyers',
            element: <FlyersPage />
          },
          {
            path: 'users',
            element: <UsersPage />
          },
          {
            path: 'reports',
            element: <ReportsPage />
          },
          {
            path: 'settings',
            element: <SettingsPage />
          },
          {
            path: 'profile',
            element: <ProfilePage />
          },
          {
            path: '*',
            element: <Navigate to="/dashboard" replace />
          }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
]);

export default router;