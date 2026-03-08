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
  FileCheck,
  FileDown,
  FileSpreadsheet,
  Eye
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, Button, PageHeader, StatCard, CardSectionHeader, ContentLoading, AutoRefreshControl, NominalDisplay } from '../../../components/common';
import { DONUT_COLORS } from '../../../utils';
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
  'admin_pusat', 'owner_mou', 'owner_non_mou', 'invoice_koordinator', 'invoice_saudi', 'handling', 'role_hotel', 'role_bus', 'role_accounting'
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
      <PageHeader
        title={`Selamat datang, ${user?.name ?? 'Admin'}`}
        subtitle="Informasi transaksi & monitoring sistem"
      />

      {/* Toolbar: Filter & Export — terpisah dari header agar tidak overlap */}
      <Card className="rounded-xl border-slate-200/80 shadow-sm">
        <div className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 w-full lg:w-auto">Filter</span>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white min-w-[160px] focus:ring-2 focus:ring-[#0D1A63]/20 focus:border-[#0D1A63] transition-shadow"
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
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white min-w-[160px] focus:ring-2 focus:ring-[#0D1A63]/20 focus:border-[#0D1A63] transition-shadow"
                title="Per role"
              >
                <option value="">Semua role</option>
                {MONITORING_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_NAMES[r] || r}</option>
                ))}
              </select>
              <span className="hidden sm:inline text-slate-300">|</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 whitespace-nowrap">Rekap periode:</span>
                <select
                  value={exportPeriod}
                  onChange={(e) => setExportPeriod(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#0D1A63]/20 focus:border-[#0D1A63] transition-shadow"
                >
                  <option value="today">Harian</option>
                  <option value="week">Mingguan</option>
                  <option value="month">Bulanan</option>
                  <option value="year">Tahunan</option>
                  <option value="all">Semua</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6">
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!!exporting} className="rounded-xl">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {exporting === 'excel' ? 'Mengunduh...' : 'Export Excel'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!!exporting} className="rounded-xl">
                <FileDown className="w-4 h-4 mr-2" />
                {exporting === 'pdf' ? 'Mengunduh...' : 'Export PDF'}
              </Button>
              <AutoRefreshControl onRefresh={fetchMonitoring} disabled={loading} size="sm" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="travel-card">
        <CardSectionHeader icon={<Activity className="w-6 h-6" />} title="Dashboard Super Admin" subtitle="Rekap transaksi dan kesehatan sistem." className="mb-4" />
        {loading && !data ? (
          <ContentLoading />
        ) : (
        <div className="space-y-8">
          {/* Informasi transaksi keseluruhan */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Revenue" value={loading && !data ? '–' : <NominalDisplay amount={o.total_revenue || 0} currency="IDR" />} subtitle={loading && !data ? '–' : <>Hari ini: <NominalDisplay amount={o.revenue_today || 0} currency="IDR" /></>} iconClassName="bg-[#0D1A63] text-white" onClick={() => navigate('/dashboard/orders-invoices')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/orders-invoices')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
            <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Order" value={loading && !data ? '–' : (o.total_orders ?? 0)} subtitle={loading && !data ? '–' : `Hari ini: ${o.orders_today ?? 0}`} iconClassName="bg-[#0D1A63] text-white" onClick={() => navigate('/dashboard/orders-invoices')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/orders-invoices')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
            <StatCard icon={<FileCheck className="w-5 h-5" />} label="Total Faktur" value={loading && !data ? '–' : (o.total_invoices ?? 0)} subtitle={loading && !data ? '–' : `Hari ini: ${o.invoices_today ?? 0}`} iconClassName="bg-[#0D1A63] text-white" onClick={() => navigate('/dashboard/orders-invoices')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/orders-invoices')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
            <StatCard icon={<Users className="w-5 h-5" />} label="Pengguna Aktif (24j)" value={loading && !data ? '–' : (o.active_users_24h ?? 0)} subtitle={loading && !data ? '–' : `Total: ${o.total_users ?? 0}`} iconClassName="bg-[#0D1A63] text-white" onClick={() => navigate('/dashboard/users')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/users')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
            <StatCard icon={<Activity className="w-5 h-5" />} label="Kesehatan Sistem" value={loading && !data ? '–' : (perf.database === 'ok' ? 'OK' : 'Error')} subtitle={loading && !data ? '–' : `Uptime: ${perf.uptime_human || '-'}`} iconClassName={perf.database === 'ok' ? 'bg-[#0D1A63] text-white' : 'bg-red-100 text-red-600'} onClick={() => navigate('/dashboard/superadmin/logs')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/superadmin/logs')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          </div>

          {/* Chart Invoice per Status + Performance */}
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="travel-card">
              <h3 className="text-lg font-bold text-stone-900 mb-4">Invoice per Status</h3>
              {loading && !data ? (
                <ContentLoading />
              ) : Object.keys(ordersByStatus).length > 0 ? (
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
        </div>
      )}
      </Card>
    </div>
  );
};

export default SuperAdminDashboard;
