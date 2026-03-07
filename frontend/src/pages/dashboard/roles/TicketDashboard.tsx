import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, ClipboardList, Ticket, Clock, Inbox, Armchair, CalendarCheck, CreditCard, CheckCircle, AlertCircle, ChevronRight, Eye } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { AutoRefreshControl } from '../../../components/common';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { ticketApi } from '../../../services/api';
import type { TicketDashboardData } from '../../../services/api';

const RECAP_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  data_received: 'Data Diterima',
  seat_reserved: 'Kursi Reserved',
  booking: 'Booking',
  payment_airline: 'Bayar Maskapai',
  ticket_issued: 'Terbit'
};

const STATUS_ORDER = ['pending', 'data_received', 'seat_reserved', 'booking', 'payment_airline', 'ticket_issued'];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-5 w-5" />,
  data_received: <Inbox className="h-5 w-5" />,
  seat_reserved: <Armchair className="h-5 w-5" />,
  booking: <CalendarCheck className="h-5 w-5" />,
  payment_airline: <CreditCard className="h-5 w-5" />,
  ticket_issued: <CheckCircle className="h-5 w-5" />
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-600',
  data_received: 'bg-sky-100 text-sky-600',
  seat_reserved: 'bg-violet-100 text-violet-600',
  booking: 'bg-teal-100 text-teal-600',
  payment_airline: 'bg-orange-100 text-orange-600',
  ticket_issued: 'bg-emerald-100 text-emerald-600'
};

const TicketDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<TicketDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ticketApi.getDashboard();
      if (res.data.success && res.data.data) setData(res.data.data);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const byStatus = data?.by_status || {};
  const totalInvoices = data?.total_invoices ?? 0;
  const totalItems = data?.total_ticket_items ?? 0;
  const pendingList = data?.pending_list ?? [];
  const ticketIssued = byStatus.ticket_issued ?? 0;
  const completionPct = totalItems > 0 ? Math.round((ticketIssued / totalItems) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-100 rounded-2xl shadow-sm shrink-0">
            <Plane className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Tiket</h1>
            <p className="text-slate-600 text-sm mt-1">Rekap statistik pekerjaan tiket (penerbitan) cabang Anda.</p>
          </div>
        </div>
        <AutoRefreshControl onRefresh={fetchDashboard} disabled={loading} size="sm" />
      </div>

      {/* Stat cards - 2 utama + status breakdown */}
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Invoice" value={totalInvoices} subtitle="Invoice dengan item tiket" iconClassName="bg-slate-100 text-slate-600" onClick={() => navigate('/dashboard/progress-ticket')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/progress-ticket')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Ticket className="w-5 h-5" />} label="Item Tiket" value={totalItems} subtitle="Item tiket di cabang" iconClassName="bg-emerald-100 text-emerald-600" onClick={() => navigate('/dashboard/progress-ticket')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/progress-ticket')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Per Status</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {STATUS_ORDER.map((status) => (
              <StatCard
                key={status}
                icon={STATUS_ICONS[status] || <Ticket className="w-5 h-5" />}
                label={RECAP_STATUS_LABELS[status] || status}
                value={byStatus[status] ?? 0}
                onClick={() => navigate('/dashboard/progress-ticket')}
                action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/progress-ticket')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Progress & Perlu Tindakan */}
      {totalItems > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="p-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white">
            <p className="text-sm font-semibold text-slate-700 mb-4">Progress Penerbitan</p>
            <div className="flex items-center gap-4">
              <div className="h-4 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, completionPct)}%` }} />
              </div>
              <span className="text-lg font-bold tabular-nums text-slate-900 min-w-[3.5rem]">{Math.min(100, completionPct)}%</span>
            </div>
            <p className="text-xs text-slate-500 mt-3">Item dengan status Tiket Terbit</p>
          </Card>
          {pendingList.length > 0 && (
            <Card className="p-6 rounded-2xl border border-amber-200/80 shadow-sm bg-amber-50/40">
              <h3 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Perlu Tindakan
              </h3>
              <p className="text-xs text-slate-600 mb-4">Update status & upload dokumen tiket terbit.</p>
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {pendingList.slice(0, 10).map((p: any) => (
                  <div key={p.order_item_id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{p.invoice_number || '–'}</p>
                      <p className="text-sm text-slate-600">{p.owner_name} · Qty: {p.quantity}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Status: {RECAP_STATUS_LABELS[p.status] || p.status}</p>
                    </div>
                    <Button size="sm" onClick={() => {
                      if (p.invoice_id) {
                        const q = (p.invoice_number || '').trim();
                        const params = new URLSearchParams({ invoice: p.invoice_id });
                        if (q) params.set('q', q);
                        navigate('/dashboard/progress-tiket?' + params.toString());
                      } else {
                        navigate('/dashboard/progress-tiket');
                      }
                    }} className="rounded-xl shrink-0">
                      <Eye className="w-4 h-4 mr-1" /> Kerjakan
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-4 rounded-xl w-full sm:w-auto" onClick={() => navigate('/dashboard/progress-tiket')}>
                Buka Progress Tiket <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Card>
          )}
        </div>
      )}

      <Card className="p-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white">
        <CardSectionHeader
          icon={<Plane className="w-6 h-6" />}
          title="Progress Tiket"
          subtitle="Kelola invoice tiket, update status, dan upload dokumen terbit di menu Progress Tiket."
          right={
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/progress-tiket')} className="rounded-xl">
              <Plane className="w-4 h-4 mr-2" /> Buka Progress Tiket
            </Button>
          }
        />
      </Card>
    </div>
  );
};

export default TicketDashboard;
