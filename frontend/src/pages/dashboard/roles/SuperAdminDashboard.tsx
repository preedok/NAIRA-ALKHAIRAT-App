import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  Users,
  DollarSign,
  Receipt,
  Activity,
  FileText,
  Bell,
  RefreshCw,
  FileCheck,
  FileDown,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { formatIDR, DONUT_COLORS } from '../../../utils';
import { superAdminApi, branchesApi } from '../../../services/api';
import { ROLE_NAMES } from '../../../types';
import type { UserRole } from '../../../types';

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

async function readBlobError(blob: Blob): Promise<string> {
  const text = await blob.text();
  try {
    const j = JSON.parse(text);
    return j.message || 'Gagal export';
  } catch {
    return text || 'Gagal export';
  }
}

const MONITORING_ROLES: UserRole[] = [
  'admin_pusat', 'owner', 'invoice_koordinator', 'role_invoice_saudi', 'role_hotel', 'role_bus', 'role_accounting'
];

const SuperAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportPeriod, setExportPeriod] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const params: { period: string; branch_id?: string; role?: string } = { period: exportPeriod };
      if (filterBranch) params.branch_id = filterBranch;
      if (filterRole) params.role = filterRole;
      const res = await superAdminApi.exportMonitoringExcel(params);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data as Blob, `rekap-monitoring-${exportPeriod}-${date}.xlsx`);
    } catch (err: any) {
      if (err.response?.data instanceof Blob) {
        const msg = await readBlobError(err.response.data);
        alert(msg);
      } else {
        alert(err.response?.data?.message || 'Gagal export Excel');
      }
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const params: { period: string; branch_id?: string; role?: string } = { period: exportPeriod };
      if (filterBranch) params.branch_id = filterBranch;
      if (filterRole) params.role = filterRole;
      const res = await superAdminApi.exportMonitoringPdf(params);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data as Blob, `rekap-monitoring-${exportPeriod}-${date}.pdf`);
    } catch (err: any) {
      if (err.response?.data instanceof Blob) {
        const msg = await readBlobError(err.response.data);
        alert(msg);
      } else {
        alert(err.response?.data?.message || 'Gagal export PDF');
      }
    } finally {
      setExporting(null);
    }
  };

  const fetchMonitoring = async () => {
    setLoading(true);
    try {
      const params: { branch_id?: string; role?: string } = {};
      if (filterBranch) params.branch_id = filterBranch;
      if (filterRole) params.role = filterRole;
      const res = await superAdminApi.getMonitoring(params);
      if (res.data.success) setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    branchesApi.list().then((r) => {
      if (r.data.success && Array.isArray(r.data.data)) {
        setBranches(r.data.data.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchMonitoring();
    const intervalId = setInterval(fetchMonitoring, 30000);
    return () => clearInterval(intervalId);
  }, [filterBranch, filterRole]);

  const o = data?.overview || {};
  const perf = data?.performance || {};
  const ordersByStatus = data?.orders_by_status || {};

  const quickActions = [
    { label: 'System Logs', path: '/dashboard/super-admin/logs', icon: <FileText className="w-6 h-6" />, color: 'from-purple-500 to-pink-500' },
    { label: 'Maintenance', path: '/dashboard/super-admin/maintenance', icon: <Bell className="w-6 h-6" />, color: 'from-primary-500 to-primary-600' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Selamat datang, {user?.name}
          </h1>
          <p className="text-slate-600 mt-1">Super Admin – Informasi transaksi & monitoring sistem</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600">Filter:</span>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[140px]"
            title="Per cabang"
          >
            <option value="">Semua cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[140px]"
            title="Per role"
          >
            <option value="">Semua role</option>
            {MONITORING_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_NAMES[r] || r}</option>
            ))}
          </select>
          <span className="text-sm text-slate-600">Rekap periode:</span>
          <select
            value={exportPeriod}
            onChange={(e) => setExportPeriod(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="today">Harian</option>
            <option value="week">Mingguan</option>
            <option value="month">Bulanan</option>
            <option value="year">Tahunan</option>
            <option value="all">Semua</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!!exporting}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {exporting === 'excel' ? '...' : 'Export Excel'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!!exporting}>
            <FileDown className="w-4 h-4 mr-2" />
            {exporting === 'pdf' ? '...' : 'Export PDF'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMonitoring} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <Card className="travel-card"><div className="py-12 text-center text-stone-500">Memuat...</div></Card>
      ) : (
        <>
          {/* Informasi transaksi keseluruhan */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card hover className="travel-card relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm text-stone-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900">{formatIDR(o.total_revenue || 0)}</p>
              <p className="text-xs text-slate-500 mt-1">Hari ini: {formatIDR(o.revenue_today || 0)}</p>
            </Card>
            <Card hover className="travel-card relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white">
                  <Receipt className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-1">Total Order</p>
              <p className="text-2xl font-bold text-slate-900">{o.total_orders ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">Hari ini: {o.orders_today ?? 0}</p>
            </Card>
            <Card hover className="travel-card relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white">
                  <FileCheck className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-1">Total Faktur</p>
              <p className="text-2xl font-bold text-slate-900">{o.total_invoices ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">Hari ini: {o.invoices_today ?? 0}</p>
            </Card>
            <Card hover className="travel-card relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-1">Pengguna Aktif (24j)</p>
              <p className="text-2xl font-bold text-slate-900">{o.active_users_24h ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">Total: {o.total_users ?? 0}</p>
            </Card>
            <Card hover className="travel-card relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl text-white ${perf.database === 'ok' ? 'bg-gradient-to-br from-primary-500 to-primary-600' : 'bg-gradient-to-br from-red-500 to-rose-500'}`}>
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-1">Kesehatan Sistem</p>
              <p className="text-2xl font-bold text-slate-900">{perf.database === 'ok' ? 'OK' : 'Error'}</p>
              <p className="text-xs text-slate-500 mt-1">Uptime: {perf.uptime_human || '-'}</p>
            </Card>
          </div>

          {/* Chart Invoice per Status + Performance */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="travel-card">
              <h3 className="text-lg font-bold text-stone-900 mb-4">Invoice per Status</h3>
              {Object.keys(ordersByStatus).length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(ordersByStatus).map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Number(count) }))}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {Object.entries(ordersByStatus).map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, 'Jumlah']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-slate-500 text-sm py-8">Belum ada order</p>
              )}
            </Card>
            <Card className="travel-card">
              <h3 className="text-lg font-bold text-stone-900 mb-4">Performa Aplikasi</h3>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-slate-600">Database</span><span className={perf.database === 'ok' ? 'text-primary-600 font-medium' : 'text-red-600 font-medium'}>{perf.database === 'ok' ? 'OK' : 'Error'}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Memory</span><span className="font-medium">{perf.memory_mb ?? '-'} MB</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Uptime</span><span className="font-medium">{perf.uptime_human || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Cabang aktif</span><span className="font-medium">{o.active_branches ?? 0}</span></div>
              </div>
            </Card>
          </div>

          <Card className="travel-card">
            <h3 className="text-xl font-bold text-stone-900 mb-4">Menu</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="flex-col h-24 gap-2"
                  onClick={() => navigate(action.path)}
                >
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${action.color} text-white`}>
                    {action.icon}
                  </div>
                  <span className="text-xs text-center">{action.label}</span>
                </Button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
