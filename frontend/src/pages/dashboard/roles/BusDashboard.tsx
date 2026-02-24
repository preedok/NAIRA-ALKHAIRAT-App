import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, RefreshCw, ClipboardList, Ticket, MapPin, Plane, RotateCcw, AlertCircle, ChevronRight } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
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

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

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
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Bus</h1>
          <p className="text-slate-600 mt-1">Rekap statistik pekerjaan bus (tiket bis, kedatangan, keberangkatan, kepulangan) cabang Anda.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Rekap statistik lengkap */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <Card hover className="travel-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-600">Total Order</p>
              <p className="text-xl font-bold tabular-nums text-stone-900">{totalOrders}</p>
              <p className="text-[10px] text-stone-500 mt-0.5">Invoice dengan item bus</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Bus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-600">Item Bus</p>
              <p className="text-xl font-bold tabular-nums text-stone-900">{totalItems}</p>
              <p className="text-[10px] text-stone-500 mt-0.5">Total item di cabang</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Ticket className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-600">Tiket Pending</p>
              <p className="text-xl font-bold tabular-nums text-stone-900">{ticketPending}</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <Ticket className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-600">Tiket Terbit</p>
              <p className="text-xl font-bold tabular-nums text-stone-900">{ticketIssued}</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-600">Kedatangan</p>
              <p className="text-lg font-bold tabular-nums text-stone-900">{arrival.completed ?? 0} selesai</p>
              <p className="text-[10px] text-stone-400 mt-0.5">P {arrival.pending ?? 0} · T {arrival.scheduled ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Plane className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-600">Keberangkatan</p>
              <p className="text-lg font-bold tabular-nums text-stone-900">{departure.completed ?? 0} selesai</p>
              <p className="text-[10px] text-stone-400 mt-0.5">P {departure.pending ?? 0} · T {departure.scheduled ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-600">Kepulangan</p>
              <p className="text-lg font-bold tabular-nums text-stone-900">{returnStat.completed ?? 0} selesai</p>
              <p className="text-[10px] text-stone-400 mt-0.5">P {returnStat.pending ?? 0} · T {returnStat.scheduled ?? 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Progress & Perlu Tindakan */}
      {totalItems > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-primary-100 bg-primary-50/30">
            <p className="text-sm font-medium text-stone-700 mb-2">Progress Pekerjaan</p>
            <div className="flex items-center gap-3">
              <div className="h-3 flex-1 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${Math.min(100, completionPct)}%` }} />
              </div>
              <span className="text-sm font-bold tabular-nums text-stone-800 min-w-[3rem]">{Math.min(100, completionPct)}%</span>
            </div>
            <p className="text-xs text-stone-500 mt-1.5">Item dengan tiket + kedatangan + keberangkatan + kepulangan semua selesai</p>
          </Card>
          {pendingList.length > 0 && (
            <Card className="border-amber-200/60 bg-amber-50/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-stone-800">{pendingList.length} item perlu tindakan</p>
                  <p className="text-xs text-stone-500">Belum lengkap (tiket / kedatangan / keberangkatan / kepulangan)</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/dashboard/bus')}>
                Kelola di Menu Bus <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Card>
          )}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Pekerjaan Bus</h3>
            <p className="text-sm text-slate-600 mt-0.5">Kelola invoice bus, update status tiket bis, kedatangan, keberangkatan, kepulangan.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/bus')}>
            <Bus className="w-4 h-4 mr-2" /> Buka Menu Bus
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default BusDashboard;
