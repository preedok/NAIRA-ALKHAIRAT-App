import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandHelping, CheckCircle, Clock, Eye } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import { AutoRefreshControl } from '../../../components/common';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { handlingApi } from '../../../services/api';
import type { HandlingDashboardData } from '../../../services/api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu',
  in_progress: 'Dalam Proses',
  completed: 'Selesai'
};

const HandlingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<HandlingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await handlingApi.getDashboard();
      if (res.data.success) setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const defaultData: HandlingDashboardData = {
    total_orders: 0,
    total_handling_items: 0,
    by_status: {},
    pending_list: []
  };
  const d: HandlingDashboardData = data ?? defaultData;
  const byStatus = d.by_status ?? {};
  const pending = d.pending_list ?? [];

  const stats = [
    { label: 'Total Order (Handling)', value: d.total_orders ?? 0, subtitle: 'Order dengan item handling', icon: <HandHelping className="w-5 h-5" />, iconClassName: 'bg-slate-100 text-slate-600' },
    { label: 'Total Item Handling', value: d.total_handling_items ?? 0, subtitle: 'Baris item handling', icon: <HandHelping className="w-5 h-5" />, iconClassName: 'bg-amber-100 text-amber-600' },
    { label: 'Menunggu / Dalam Proses', value: (byStatus.pending ?? 0) + (byStatus.in_progress ?? 0), subtitle: 'Perlu diproses', icon: <Clock className="w-5 h-5" />, iconClassName: 'bg-amber-100 text-amber-600' },
    { label: 'Selesai', value: byStatus.completed ?? 0, subtitle: 'Handling selesai', icon: <CheckCircle className="w-5 h-5" />, iconClassName: 'bg-emerald-100 text-emerald-600' }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard Handling"
        subtitle="Rekapitulasi pekerjaan handling. Update status item handling (menunggu → dalam proses → selesai)."
        right={<AutoRefreshControl onRefresh={fetchDashboard} disabled={loading} size="sm" />}
      />

      {/* Statistik card hanya tampil jika sudah ada pembayaran DP dan data invoice muncul di table */}
      {((d.total_orders ?? 0) > 0 || (d.total_handling_items ?? 0) > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <StatCard key={i} icon={stat.icon} label={stat.label} value={stat.value} subtitle={stat.subtitle} iconClassName={stat.iconClassName} />
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <Card className="p-6 rounded-2xl border border-amber-200/80 shadow-sm bg-amber-50/40">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Perlu Tindakan (Update Status Handling)</h3>
          <div className="space-y-3">
            {pending.slice(0, 10).map((p: HandlingDashboardData['pending_list'][number]) => (
              <div key={p.order_item_id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div>
                  <p className="font-semibold text-slate-900">{p.invoice_number || '–'}</p>
                  <p className="text-sm text-slate-600">{p.owner_name} · {p.product_name || 'Handling'} · Qty: {p.quantity}</p>
                  <p className="text-xs text-slate-500 mt-1">Status: {STATUS_LABELS[p.status] || p.status}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (p.invoice_id) params.set('invoice_id', p.invoice_id);
                    navigate('/dashboard/progress-handling?' + params.toString());
                  }}
                  className="rounded-lg"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Kerjakan
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <CardSectionHeader
          icon={<HandHelping className="w-6 h-6" />}
          title="Progress Handling"
          subtitle="Daftar invoice dengan item handling. Update status per item: Menunggu → Dalam Proses → Selesai."
          right={
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/progress-handling')} className="rounded-xl">
              <HandHelping className="w-4 h-4 mr-2" />
              Buka Progress Handling
            </Button>
          }
        />
      </Card>

      {!data && !loading && (
        <Card className="p-8 rounded-2xl border border-slate-200/80 text-center">
          <p className="text-slate-600">Belum ada order dengan item handling.</p>
        </Card>
      )}
    </div>
  );
};

export default HandlingDashboard;
