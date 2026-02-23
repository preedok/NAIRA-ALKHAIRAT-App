import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Hotel,
  CheckCircle,
  Clock,
  Calendar,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { hotelApi } from '../../../services/api';

const STATUS_LABELS: Record<string, string> = {
  waiting_confirmation: 'Menunggu Konfirmasi',
  confirmed: 'Dikonfirmasi',
  room_assigned: 'Kamar Ditetapkan',
  completed: 'Selesai'
};

const HotelDashboard: React.FC = () => {
  const { user } = useAuth();
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
    { title: 'Total Order (Hotel)', value: d.total_orders ?? 0, subtitle: 'Order dengan item hotel', icon: <Hotel className="w-6 h-6" />, color: 'from-blue-500 to-cyan-500' },
    { title: 'Total Item Hotel', value: d.total_hotel_items ?? 0, subtitle: 'Baris item hotel', icon: <Hotel className="w-6 h-6" />, color: 'from-indigo-500 to-purple-500' },
    { title: 'Menunggu Konfirmasi', value: byStatus.waiting_confirmation ?? 0, subtitle: 'Perlu diproses', icon: <Clock className="w-6 h-6" />, color: 'from-yellow-500 to-orange-500' },
    { title: 'Selesai', value: (byStatus.room_assigned ?? 0) + (byStatus.completed ?? 0), subtitle: 'Kamar ditetapkan / selesai', icon: <CheckCircle className="w-6 h-6" />, color: 'from-emerald-500 to-teal-500' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Hotel</h1>
          <p className="text-slate-600 mt-1">Rekapitulasi pekerjaan hotel cabang Anda</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} hover>
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white`}>{stat.icon}</div>
            </div>
            <p className="text-sm text-slate-600 mt-2">{stat.title}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.subtitle}</p>
          </Card>
        ))}
      </div>

      {pending.length > 0 && (
        <Card>
          <h3 className="text-xl font-bold text-slate-900 mb-4">Perlu Tindakan (Alokasi Kamar / Update Status)</h3>
          <div className="space-y-3">
            {pending.slice(0, 10).map((p: any) => (
              <div key={p.order_item_id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-900">{p.order_number}</p>
                  <p className="text-sm text-slate-600">{p.owner_name} · Qty: {p.quantity}</p>
                  <p className="text-xs text-slate-500 mt-1">Status: {STATUS_LABELS[p.status] || p.status}</p>
                </div>
                <Button size="sm" onClick={() => navigate('/dashboard/hotels?order=' + p.order_id)}>
                  <Eye className="w-4 h-4 mr-2" /> Kerjakan
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate('/dashboard/hotels')}>
          Daftar Order Hotel
        </Button>
        <Button variant="ghost" onClick={() => navigate('/dashboard/hotels?tab=products')}>
          Lihat Produk & Harga (read-only)
        </Button>
      </div>

      {!data && !loading && (
        <Card>
          <p className="text-slate-600 text-center py-8">Belum ada order dengan item hotel di cabang Anda.</p>
        </Card>
      )}
    </div>
  );
};

export default HotelDashboard;
