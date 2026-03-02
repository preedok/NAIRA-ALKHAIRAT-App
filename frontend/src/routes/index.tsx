import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import MaintenanceGate from '../components/MaintenanceGate';
import DashboardLayout from '../layouts/DashboardLayout';
import LandingPage from '../pages/landing/LandingPage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import DashboardRouter from '../pages/dashboard/DashboardRouter';
import SuperAdminDashboard from '../pages/dashboard/roles/SuperAdminDashboard';
import SuperAdminLogsPage from '../pages/dashboard/superadmin/SuperAdminLogsPage';
import SuperAdminMaintenancePage from '../pages/dashboard/superadmin/SuperAdminMaintenancePage';
import ProductsPage from '../pages/dashboard/components/ProductsPage';
import ProductHotelPage from '../pages/dashboard/components/ProductHotelPage';
import HotelWorkPage from '../pages/dashboard/components/HotelWorkPage';
import ProductVisaPage from '../pages/dashboard/components/ProductVisaPage';
import VisaPage from '../pages/dashboard/components/VisaPage';
import VisaWorkPage from '../pages/dashboard/components/VisaWorkPage';
import TicketsPage from '../pages/dashboard/components/TicketsPage';
import ProductTicketPage from '../pages/dashboard/components/ProductTicketPage';
import TicketWorkPage from '../pages/dashboard/components/TicketWorkPage';
import HotelsPage from '../pages/dashboard/components/HotelsPage';
import BusPage from '../pages/dashboard/components/BusPage';
import ProductBusPage from '../pages/dashboard/components/ProductBusPage';
import BusWorkPage from '../pages/dashboard/components/BusWorkPage';
import PackagesPage from '../pages/dashboard/components/PackagesPage';
import HandlingPage from '../pages/dashboard/components/HandlingPage';
import OrderFormPage from '../pages/dashboard/components/OrderFormPage';
import UsersPage from '../pages/dashboard/components/UsersPage';
import BranchesPage from '../pages/dashboard/components/BranchesPage';
import ReportsPage from '../pages/dashboard/components/ReportsPage';
import SettingsPage from '../pages/dashboard/components/SettingsPage';
import ProfilePage from '../pages/dashboard/components/ProfilePage';
import KoordinatorOwnersPage from '../pages/dashboard/components/KoordinatorOwnersPage';
import OwnerActivationPage from '../pages/dashboard/owner/OwnerActivationPage';
import AdminPusatCreateUserPage from '../pages/dashboard/adminpusat/AdminPusatCreateUserPage';
import OrdersInvoicesPage from '../pages/dashboard/components/OrdersInvoicesPage';
import RefundsPage from '../pages/dashboard/components/RefundsPage';
import AccountingFinancialReportPage from '../pages/dashboard/accounting/AccountingFinancialReportPage';
import AccountingAgingPage from '../pages/dashboard/accounting/AccountingAgingPage';
import AccountingChartOfAccountsPage from '../pages/dashboard/accounting/AccountingChartOfAccountsPage';

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
            path: 'owner-activation',
            element: <OwnerActivationPage />
          },
          {
            path: 'owner/mou',
            element: <Navigate to="/dashboard/profile" replace />
          },
          // Fallback for direct path (optional): /dashboard/super-admin
          {
            path: 'super-admin',
            element: <SuperAdminDashboard />
          },
          {
            path: 'super-admin/logs',
            element: <SuperAdminLogsPage />
          },
          {
            path: 'super-admin/maintenance',
            element: <SuperAdminMaintenancePage />
          },
          {
            path: 'products',
            element: <Navigate to="/dashboard/products/hotel" replace />
          },
          {
            path: 'products/hotel',
            element: <ProductHotelPage />
          },
          {
            path: 'progress-hotel',
            element: <HotelWorkPage />
          },
          {
            path: 'progress-tiket',
            element: <TicketWorkPage />
          },
          {
            path: 'progress-visa',
            element: <VisaWorkPage />
          },
          {
            path: 'progress-bus',
            element: <BusWorkPage />
          },
          {
            path: 'products/visa',
            element: <ProductVisaPage />
          },
          {
            path: 'products/visa/pekerjaan',
            element: <Navigate to="/dashboard/progress-visa" replace />
          },
          {
            path: 'products/tickets',
            element: <ProductTicketPage />
          },
          {
            path: 'products/tickets/pekerjaan',
            element: <Navigate to="/dashboard/progress-tiket" replace />
          },
          {
            path: 'products/bus',
            element: <ProductBusPage />
          },
          {
            path: 'products/packages',
            element: <PackagesPage />
          },
          {
            path: 'products/handling',
            element: <HandlingPage />
          },
          {
            path: 'hotels',
            element: <Navigate to="/dashboard/products/hotel" replace />
          },
          {
            path: 'visa',
            element: <Navigate to="/dashboard/products/visa" replace />
          },
          {
            path: 'tickets',
            element: <Navigate to="/dashboard/products/tickets" replace />
          },
          {
            path: 'bus',
            element: <Navigate to="/dashboard/products/bus" replace />
          },
          {
            path: 'handling',
            element: <Navigate to="/dashboard/products/handling" replace />
          },
          {
            path: 'packages',
            element: <Navigate to="/dashboard/products/packages" replace />
          },
          // Invoice: satu menu untuk semua role. Data sesuai hak akses. Tambah/Edit/Hapus invoice hanya owner & invoice_koordinator.
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
            path: 'refunds',
            element: <RefundsPage />
          },
          {
            path: 'users',
            element: <UsersPage />
          },
          {
            path: 'branches',
            element: <BranchesPage />
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
            path: 'koordinator/owners',
            element: <KoordinatorOwnersPage />
          },
          {
            path: 'admin-pusat/users',
            element: <AdminPusatCreateUserPage />
          },
          {
            path: 'accounting/financial-report',
            element: <AccountingFinancialReportPage />
          },
          {
            path: 'accounting/chart-of-accounts',
            element: <AccountingChartOfAccountsPage />
          },
          {
            path: 'accounting/aging',
            element: <AccountingAgingPage />
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