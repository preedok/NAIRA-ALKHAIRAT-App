import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hotel, CheckCircle, Clock, RefreshCw, Eye } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
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

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  const d = data || {};
  const byStatus = d.by_status || {};
  const pending = d.pending_room_allocation || [];

  const stats = [
    { title: 'Total Order (Hotel)', value: d.total_orders ?? 0, subtitle: 'Order dengan item hotel', icon: <Hotel className="w-6 h-6" />, bg: 'bg-slate-100', text: 'text-slate-600' },
    { title: 'Total Item Hotel', value: d.total_hotel_items ?? 0, subtitle: 'Baris item hotel', icon: <Hotel className="w-6 h-6" />, bg: 'bg-amber-100', text: 'text-amber-600' },
    { title: 'Menunggu Konfirmasi', value: byStatus.waiting_confirmation ?? 0, subtitle: 'Perlu diproses', icon: <Clock className="w-6 h-6" />, bg: 'bg-amber-100', text: 'text-amber-600' },
    { title: 'Selesai', value: (byStatus.room_assigned ?? 0) + (byStatus.completed ?? 0), subtitle: 'Kamar ditetapkan / selesai', icon: <CheckCircle className="w-6 h-6" />, bg: 'bg-emerald-100', text: 'text-emerald-600' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-2xl shadow-sm shrink-0">
            <Hotel className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Hotel</h1>
            <p className="text-slate-600 text-sm mt-1">Rekapitulasi pekerjaan hotel cabang Anda.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading} className="rounded-xl">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 bg-white">
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl shrink-0 ${stat.bg} ${stat.text}`}>{stat.icon}</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{stat.title}</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.subtitle}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-100 text-amber-600 shrink-0">
              <Hotel className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Pekerjaan Hotel</h3>
              <p className="text-sm text-slate-600 mt-0.5">Kelola invoice hotel, alokasi kamar, konfirmasi & meal di menu Progress Hotel.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/products/hotel')} className="rounded-xl">
              Produk & Harga
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/progress-hotel')} className="rounded-xl">
              <Hotel className="w-4 h-4 mr-2" /> Buka Progress Hotel
            </Button>
          </div>
        </div>
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
