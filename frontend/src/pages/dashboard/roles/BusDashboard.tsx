import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, RefreshCw, ClipboardList, Ticket, MapPin, Plane, RotateCcw, AlertCircle, ChevronRight } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { busApi } from '../../../services/api';
import type { BusDashboardData } from '../../../services/api';

const BusDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<BusDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await busApi.getDashboard();
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

  const totalOrders = data?.total_orders ?? 0;
  const totalItems = data?.total_bus_items ?? 0;
  const ticketPending = data?.bus_ticket?.pending ?? 0;
  const ticketIssued = data?.bus_ticket?.issued ?? 0;
  const arrival = data?.arrival ?? { pending: 0, scheduled: 0, completed: 0 };
  const departure = data?.departure ?? { pending: 0, scheduled: 0, completed: 0 };
  const returnStat = data?.return ?? { pending: 0, scheduled: 0, completed: 0 };
  const pendingList = data?.pending_list ?? [];
  const completionPct = totalItems > 0 ? Math.round(((totalItems - pendingList.length) / totalItems) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-violet-100 rounded-2xl shadow-sm shrink-0">
            <Bus className="w-8 h-8 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Bus</h1>
            <p className="text-slate-600 text-sm mt-1">Rekap statistik pekerjaan bus (tiket bis, kedatangan, keberangkatan, kepulangan) cabang Anda.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading} className="rounded-xl">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Statistik card hanya tampil jika sudah ada pembayaran DP dan data invoice muncul di table */}
      {(totalOrders > 0 || totalItems > 0) && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Order" value={totalOrders} subtitle="Invoice dengan item bus" />
            <StatCard icon={<Bus className="w-5 h-5" />} label="Item Bus" value={totalItems} subtitle="Total item di cabang" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Per Status</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard icon={<Ticket className="w-5 h-5" />} label="Tiket Pending" value={ticketPending} />
              <StatCard icon={<Ticket className="w-5 h-5" />} label="Tiket Terbit" value={ticketIssued} />
              <StatCard icon={<MapPin className="w-5 h-5" />} label="Kedatangan" value={arrival.completed ?? 0} subtitle={`P ${arrival.pending ?? 0} · T ${arrival.scheduled ?? 0}`} />
              <StatCard icon={<Plane className="w-5 h-5" />} label="Keberangkatan" value={departure.completed ?? 0} subtitle={`P ${departure.pending ?? 0} · T ${departure.scheduled ?? 0}`} />
              <StatCard icon={<RotateCcw className="w-5 h-5" />} label="Kepulangan" value={returnStat.completed ?? 0} subtitle={`P ${returnStat.pending ?? 0} · T ${returnStat.scheduled ?? 0}`} />
            </div>
          </div>
        </div>
      )}

      {totalItems > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="p-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white">
            <p className="text-sm font-semibold text-slate-700 mb-4">Progress Pekerjaan</p>
            <div className="flex items-center gap-4">
              <div className="h-4 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, completionPct)}%` }} />
              </div>
              <span className="text-lg font-bold tabular-nums text-slate-900 min-w-[3.5rem]">{Math.min(100, completionPct)}%</span>
            </div>
            <p className="text-xs text-slate-500 mt-3">Item dengan tiket + kedatangan + keberangkatan + kepulangan semua selesai</p>
          </Card>
          {pendingList.length > 0 && (
            <Card className="p-6 rounded-2xl border border-amber-200/80 shadow-sm bg-amber-50/40">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{pendingList.length} item perlu tindakan</p>
                  <p className="text-xs text-slate-500">Belum lengkap (tiket / kedatangan / keberangkatan / kepulangan)</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate('/dashboard/orders-invoices')}>
                Buka Invoice <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Card>
          )}
        </div>
      )}

      <Card className="p-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white">
        <CardSectionHeader
          icon={<Bus className="w-6 h-6" />}
          title="Pekerjaan Bus"
          subtitle="Kelola invoice bus, update status tiket bis, kedatangan, keberangkatan, kepulangan."
          right={
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/products/bus')} className="rounded-xl">
                Produk Bus
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/orders-invoices')} className="rounded-xl">
                <ClipboardList className="w-4 h-4 mr-2" /> Invoice
              </Button>
            </>
          }
        />
      </Card>
    </div>
  );
};

export default BusDashboard;
