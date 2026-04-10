import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SuperAdminDashboard from './roles/SuperAdminDashboard';
import AdminPusatDashboard from './roles/AdminPusatDashboard';
import KoordinatorDashboard from './roles/KoordinatorDashboard';
import VisaDashboard from './roles/VisaDashboard';
import TicketDashboard from './roles/TicketDashboard';
import OwnerDashboard from './roles/OwnerDashboard';
import InvoiceDashboard from './roles/InvoiceDashboard';
import HotelDashboard from './roles/HotelDashboard';
import BusDashboard from './roles/BusDashboard';
import HandlingDashboard from './roles/HandlingDashboard';
import SiskopatuhDashboard from './roles/SiskopatuhDashboard';
import AccountingDashboard from './roles/AccountingDashboard';
import { isKoordinatorRole } from '../../types';

/**
 * Menampilkan dashboard sesuai role user.
 * Super Admin & Admin Pusat: monitoring semua kota.
 * Koordinator: dashboard wilayah.
 * Owner / Invoice / Hotel / Visa / Ticket / Bus: rekapitulasi pekerjaan masing-masing.
 */
const DashboardRouter: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role;
  const isOwner = role === 'owner_mou' || role === 'owner_non_mou';

  if (isOwner && user?.owner_status && user.owner_status !== 'active') {
    return <Navigate to="/dashboard/owner-activation" replace />;
  }

  switch (role) {
    case 'super_admin':
      return <SuperAdminDashboard />;
    case 'admin_pusat':
      return <AdminPusatDashboard />;
    case 'invoice_koordinator':
      return <KoordinatorDashboard />;
    case 'visa_koordinator':
      return <VisaDashboard />;
    case 'tiket_koordinator':
      return <TicketDashboard />;
    case 'owner_mou':
    case 'owner_non_mou':
      return <OwnerDashboard />;
    case 'invoice_saudi':
      return <InvoiceDashboard />;
    case 'role_hotel':
      return <HotelDashboard />;
    case 'role_bus':
      return <BusDashboard />;
    case 'handling':
      return <HandlingDashboard />;
    case 'role_siskopatuh':
      return <SiskopatuhDashboard />;
    case 'role_accounting':
      return <AccountingDashboard />;
    default:
      if (role && isKoordinatorRole(role as any)) return <KoordinatorDashboard />;
      return <OwnerDashboard />;
  }
};

export default DashboardRouter;
