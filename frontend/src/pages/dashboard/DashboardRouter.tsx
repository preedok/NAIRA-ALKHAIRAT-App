import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminDashboard from './roles/AdminDashboard';
import UserDashboard from './roles/UserDashboard';
import { normalizeUserRole } from '../../types';

/**
 * Menampilkan dashboard sesuai role user.
 * Super Admin & Admin Pusat: monitoring semua kota.
 * Koordinator: dashboard wilayah.
 * Owner / Invoice / Hotel / Visa / Ticket / Bus: rekapitulasi pekerjaan masing-masing.
 */
const DashboardRouter: React.FC = () => {
  const { user } = useAuth();
  const role = normalizeUserRole(user?.role || 'jamaah');
  if (role === 'admin') return <AdminDashboard />;
  return <UserDashboard />;
};

export default DashboardRouter;
