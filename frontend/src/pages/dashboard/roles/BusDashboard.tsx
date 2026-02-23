import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bus,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { busApi } from '../../../services/api';

const TRIP_LABELS: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Terjadwal',
  completed: 'Selesai'
};

const BusDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await busApi.getDashboard();
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

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const res = await busApi.exportExcel();
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-bus-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await busApi.exportPdf();
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-bus-${Date.now()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  const d = data || {};
  const pending = d.pending_list || [];

  const stats = [
    { title: 'Total Order (Bus)', value: d.total_orders ?? 0, subtitle: 'Order dengan item bus', icon: <Bus className="w-6 h-6" />, color: 'from-sky-600 to-blue-700' },
    { title: 'Total Item Bus', value: d.total_bus_items ?? 0, subtitle: 'Baris item bus', icon: <Bus className="w-6 h-6" />, color: 'from-indigo-500 to-purple-500' },
    { title: 'Tiket Bis Pending', value: d.bus_ticket?.pending ?? 0, subtitle: 'Belum terbit', icon: <Clock className="w-6 h-6" />, color: 'from-amber-500 to-orange-500' },
    { title: 'Tiket Terbit', value: d.bus_ticket?.issued ?? 0, subtitle: 'Sudah terbit', icon: <CheckCircle className="w-6 h-6" />, color: 'from-emerald-500 to-teal-500' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Bus Saudi</h1>
          <p className="text-slate-600 mt-1">Rekapitulasi pekerjaan bus: tiket bis, kedatangan, keberangkatan, kepulangan</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exportingExcel}>
            <FileSpreadsheet className={`w-4 h-4 mr-2 ${exportingExcel ? 'animate-spin' : ''}`} />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
            <FileText className={`w-4 h-4 mr-2 ${exportingPdf ? 'animate-spin' : ''}`} />
            PDF
          </Button>
        </div>
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

      {(d.arrival || d.departure || d.return) && (
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Status Perjalanan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-semibold text-slate-700 mb-1">Kedatangan (jemput jamaah)</p>
              <p className="text-slate-600">Pending: {d.arrival?.pending ?? 0} · Terjadwal: {d.arrival?.scheduled ?? 0} · Selesai: {d.arrival?.completed ?? 0}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">Keberangkatan</p>
              <p className="text-slate-600">Pending: {d.departure?.pending ?? 0} · Terjadwal: {d.departure?.scheduled ?? 0} · Selesai: {d.departure?.completed ?? 0}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">Kepulangan</p>
              <p className="text-slate-600">Pending: {d.return?.pending ?? 0} · Terjadwal: {d.return?.scheduled ?? 0} · Selesai: {d.return?.completed ?? 0}</p>
            </div>
          </div>
        </Card>
      )}

      {pending.length > 0 && (
        <Card>
          <h3 className="text-xl font-bold text-slate-900 mb-4">Perlu Tindakan</h3>
          <div className="space-y-3">
            {pending.slice(0, 15).map((p: any) => (
              <div key={p.order_item_id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-900">{p.order_number}</p>
                  <p className="text-sm text-slate-600">{p.owner_name} · Qty: {p.quantity}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Tiket: {p.bus_ticket_status} · Kedatangan: {TRIP_LABELS[p.arrival_status] || p.arrival_status} · Keberangkatan: {TRIP_LABELS[p.departure_status] || p.departure_status} · Kepulangan: {TRIP_LABELS[p.return_status] || p.return_status}
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate('/dashboard/bus?order=' + p.order_id)}>
                  <Eye className="w-4 h-4 mr-2" /> Kerjakan
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate('/dashboard/bus')}>
          Daftar Order Bus
        </Button>
        <Button variant="ghost" onClick={() => navigate('/dashboard/bus?tab=products')}>
          Lihat Harga (General / Cabang / Khusus)
        </Button>
      </div>

      {!data && !loading && (
        <Card>
          <p className="text-slate-600 text-center py-8">Belum ada order dengan item bus di cabang Anda.</p>
        </Card>
      )}
    </div>
  );
};

export default BusDashboard;
