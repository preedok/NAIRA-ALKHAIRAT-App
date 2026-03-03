import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hotel, CheckCircle, Clock, Eye } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl } from '../../../components/common';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { hotelApi } from '../../../services/api';

const STATUS_LABELS: Record<string, string> = {
  waiting_confirmation: 'Menunggu Konfirmasi',
  confirmed: 'Dikonfirmasi',
  room_assigned: 'Kamar Ditetapkan',
  completed: 'Selesai'
};

const HotelDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await hotelApi.getDashboard();
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

  const d = data || {};
  const byStatus = d.by_status || {};
  const pending = d.pending_room_allocation || [];

  const stats = [
    { label: 'Total Order (Hotel)', value: d.total_orders ?? 0, subtitle: 'Order dengan item hotel', icon: <Hotel className="w-5 h-5" />, iconClassName: 'bg-slate-100 text-slate-600' },
    { label: 'Total Item Hotel', value: d.total_hotel_items ?? 0, subtitle: 'Baris item hotel', icon: <Hotel className="w-5 h-5" />, iconClassName: 'bg-amber-100 text-amber-600' },
    { label: 'Menunggu Konfirmasi', value: byStatus.waiting_confirmation ?? 0, subtitle: 'Perlu diproses', icon: <Clock className="w-5 h-5" />, iconClassName: 'bg-amber-100 text-amber-600' },
    { label: 'Selesai', value: (byStatus.room_assigned ?? 0) + (byStatus.completed ?? 0), subtitle: 'Kamar ditetapkan / selesai', icon: <CheckCircle className="w-5 h-5" />, iconClassName: 'bg-emerald-100 text-emerald-600' }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard Hotel"
        subtitle="Rekapitulasi pekerjaan hotel cabang Anda."
        right={<AutoRefreshControl onRefresh={fetchDashboard} disabled={loading} size="sm" />}
      />

      {/* Statistik card hanya tampil jika sudah ada pembayaran DP dan data invoice muncul di table */}
      {((d.total_orders ?? 0) > 0 || (d.total_hotel_items ?? 0) > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <StatCard key={i} icon={stat.icon} label={stat.label} value={stat.value} subtitle={stat.subtitle} iconClassName={stat.iconClassName} />
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <Card className="p-6 rounded-2xl border border-amber-200/80 shadow-sm bg-amber-50/40">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Perlu Tindakan (Alokasi Kamar / Update Status)</h3>
          <div className="space-y-3">
            {pending.slice(0, 10).map((p: any) => (
              <div key={p.order_item_id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div>
                  <p className="font-semibold text-slate-900">{p.invoice_number || p.order_number}</p>
                  <p className="text-sm text-slate-600">{p.owner_name} · Qty: {p.quantity}</p>
                  <p className="text-xs text-slate-500 mt-1">Status: {STATUS_LABELS[p.status] || p.status}</p>
                </div>
                <Button size="sm" onClick={() => {
                  if (p.invoice_id) {
                    const q = (p.invoice_number || '').trim();
                    const params = new URLSearchParams({ invoice: p.invoice_id });
                    if (q) params.set('q', q);
                    navigate('/dashboard/progress-hotel?' + params.toString());
                  } else {
                    navigate('/dashboard/progress-hotel');
                  }
                }} className="rounded-lg">
                  <Eye className="w-4 h-4 mr-1" /> Kerjakan
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <CardSectionHeader
          icon={<Hotel className="w-6 h-6" />}
          title="Pekerjaan Hotel"
          subtitle="Kelola invoice hotel, alokasi kamar, konfirmasi & meal di menu Progress Hotel."
          right={
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/products/hotel')} className="rounded-xl">
                Produk & Harga
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/progress-hotel')} className="rounded-xl">
                <Hotel className="w-4 h-4 mr-2" /> Buka Progress Hotel
              </Button>
            </>
          }
        />
      </Card>

      {!data && !loading && (
        <Card className="p-8 rounded-2xl border border-slate-200/80 text-center">
          <p className="text-slate-600">Belum ada order dengan item hotel di cabang Anda.</p>
        </Card>
      )}
    </div>
  );
};

export default HotelDashboard;
