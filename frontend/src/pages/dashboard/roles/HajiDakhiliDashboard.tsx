import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, Clock, Eye } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import { AutoRefreshControl } from '../../../components/common';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { hajiDakhiliApi } from '../../../services/api';
import type { HajiDakhiliDashboardData } from '../../../services/api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu',
  in_progress: 'Dalam Proses',
  completed: 'Selesai'
};

const HajiDakhiliDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<HajiDakhiliDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await hajiDakhiliApi.getDashboard();
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

  const defaultData: HajiDakhiliDashboardData = {
    total_orders: 0,
    total_haji_dakhili_items: 0,
    by_status: {},
    pending_list: []
  };
  const d: HajiDakhiliDashboardData = data ?? defaultData;
  const byStatus = d.by_status ?? {};
  const pending = d.pending_list ?? [];

  const stats = [
    { label: 'Total Order (Haji Dakhili)', value: d.total_orders ?? 0, subtitle: 'Order dengan item Haji Dakhili', icon: <FileText className="w-5 h-5" />, iconClassName: 'bg-slate-100 text-slate-600' },
    { label: 'Total Item Haji Dakhili', value: d.total_haji_dakhili_items ?? 0, subtitle: 'Baris item Haji Dakhili', icon: <FileText className="w-5 h-5" />, iconClassName: 'bg-teal-100 text-teal-700' },
    { label: 'Menunggu / Dalam Proses', value: (byStatus.pending ?? 0) + (byStatus.in_progress ?? 0), subtitle: 'Perlu diproses', icon: <Clock className="w-5 h-5" />, iconClassName: 'bg-amber-100 text-amber-600' },
    { label: 'Selesai', value: byStatus.completed ?? 0, subtitle: 'Haji Dakhili selesai', icon: <CheckCircle className="w-5 h-5" />, iconClassName: 'bg-emerald-100 text-emerald-600' }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard Haji Dakhili"
        subtitle="Rekapitulasi pekerjaan Haji Dakhili. Update status item (menunggu → dalam proses → selesai)."
        right={<AutoRefreshControl onRefresh={fetchDashboard} disabled={loading} size="sm" />}
      />

      {((d.total_orders ?? 0) > 0 || (d.total_haji_dakhili_items ?? 0) > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <StatCard
              key={i}
              icon={stat.icon}
              label={stat.label}
              value={stat.value}
              subtitle={stat.subtitle}
              iconClassName={stat.iconClassName}
              onClick={() => navigate('/dashboard/progress-haji-dakhili')}
              action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/progress-haji-dakhili')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
            />
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <Card className="p-6 rounded-2xl border border-teal-200/80 shadow-sm bg-teal-50/40">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Perlu Tindakan (Update Status Haji Dakhili)</h3>
          <div className="space-y-3">
            {pending.slice(0, 10).map((p: HajiDakhiliDashboardData['pending_list'][number]) => (
              <div key={p.order_item_id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div>
                  <p className="font-semibold text-slate-900">{p.invoice_number || '–'}</p>
                  <p className="text-sm text-slate-600">{p.owner_name} · {p.product_name || 'Haji Dakhili'} · Qty: {p.quantity}</p>
                  <p className="text-xs text-slate-500 mt-1">Status: {STATUS_LABELS[p.status] || p.status}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (p.invoice_id) params.set('invoice', p.invoice_id);
                    navigate('/dashboard/progress-haji-dakhili?' + params.toString());
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
          icon={<FileText className="w-6 h-6" />}
          title="Progress Haji Dakhili"
          subtitle="Daftar invoice dengan item Haji Dakhili. Update status per item: Menunggu → Dalam Proses → Selesai."
          right={
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/progress-haji-dakhili')} className="rounded-xl">
              <FileText className="w-4 h-4 mr-2" />
              Buka Progress Haji Dakhili
            </Button>
          }
        />
      </Card>

      {!data && !loading && (
        <Card className="p-8 rounded-2xl border border-slate-200/80 text-center">
          <p className="text-slate-600">Belum ada order dengan item Haji Dakhili.</p>
        </Card>
      )}
    </div>
  );
};

export default HajiDakhiliDashboard;
