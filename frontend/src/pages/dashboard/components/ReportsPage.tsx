import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileType
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import TablePagination from '../../../components/common/TablePagination';
import { useAuth } from '../../../contexts/AuthContext';
import {
  reportsApi,
  type ReportType,
  type ReportGroupBy,
  type ReportPeriod,
  type ReportsAnalyticsData
} from '../../../services/api';
import { formatIDR } from '../../../utils';

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
  { value: 'partners', label: 'Partners' },
  { value: 'jamaah', label: 'Jamaah' },
  { value: 'financial', label: 'Laporan Keuangan' },
  { value: 'logs', label: 'System Logs' }
];

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Hari ini' },
  { value: 'week', label: 'Minggu ini' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'quarter', label: 'Kuartal ini' },
  { value: 'year', label: 'Tahun ini' },
  { value: 'all', label: 'Semua' }
];

const GROUP_BY_OPTIONS: { value: ReportGroupBy; label: string }[] = [
  { value: 'day', label: 'Harian' },
  { value: 'week', label: 'Mingguan' },
  { value: 'month', label: 'Bulanan' },
  { value: 'quarter', label: 'Kuartal' },
  { value: 'year', label: 'Tahunan' }
];

const ROLES_FILTER = [
  { value: '', label: 'Semua role' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin_pusat', label: 'Admin Pusat' },
  { value: 'role_accounting', label: 'Accounting' }
];

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [reportType, setReportType] = useState<ReportType>('revenue');
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [wilayahId, setWilayahId] = useState('');
  const [provinsiId, setProvinsiId] = useState('');
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('month');
  const [roleFilter, setRoleFilter] = useState('');
  const [logSource, setLogSource] = useState('');
  const [logLevel, setLogLevel] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [filterOptions, setFilterOptions] = useState<{
    branches: { id: string; code: string; name: string; provinsi_id?: string | null }[];
    wilayah: { id: string; name: string }[];
    provinsi: { id: string; name: string; Wilayah?: { id: string; name: string } }[];
  }>({ branches: [], wilayah: [], provinsi: [] });
  const [data, setData] = useState<ReportsAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  const loadFilters = useCallback(async () => {
    try {
      const res = await reportsApi.getFilters();
      if (res.data.success && res.data.data) {
        setFilterOptions({
          branches: res.data.data.branches || [],
          wilayah: res.data.data.wilayah || [],
          provinsi: res.data.data.provinsi || []
        });
      }
    } catch {
      setFilterOptions({ branches: [], wilayah: [], provinsi: [] });
    }
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const buildParams = useCallback(() => {
    const params: Record<string, string | number | undefined> = {
      report_type: reportType,
      period,
      group_by: reportType !== 'logs' && reportType !== 'financial' ? groupBy : undefined,
      page,
      limit
    };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (branchId) params.branch_id = branchId;
    if (wilayahId) params.wilayah_id = wilayahId;
    if (provinsiId) params.provinsi_id = provinsiId;
    if (roleFilter && (reportType === 'partners' || reportType === 'revenue' || reportType === 'orders')) params.role = roleFilter;
    if (reportType === 'logs') {
      if (logSource) params.source = logSource;
      if (logLevel) params.level = logLevel;
    }
    return params;
  }, [reportType, period, dateFrom, dateTo, branchId, wilayahId, provinsiId, groupBy, roleFilter, logSource, logLevel, page, limit]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getAnalytics(buildParams());
      if (res.data.success && res.data.data) setData(res.data.data);
      else setData(null);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Gagal memuat data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    if (reportType && (period || dateFrom || dateTo)) fetchAnalytics();
  }, [reportType, period, dateFrom, dateTo, branchId, wilayahId, provinsiId, groupBy, roleFilter, logSource, logLevel, page, limit]);

  const getExportParams = () => {
    const p: Record<string, string | undefined> = {
      report_type: reportType,
      period: period === 'all' ? undefined : period
    };
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if (branchId) p.branch_id = branchId;
    if (wilayahId) p.wilayah_id = wilayahId;
    if (provinsiId) p.provinsi_id = provinsiId;
    if (roleFilter) p.role = roleFilter;
    if (reportType === 'logs') {
      if (logSource) p.source = logSource;
      if (logLevel) p.level = logLevel;
    }
    return p;
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const res = await reportsApi.exportExcel(getExportParams());
      const blob = res.data;
      if (blob instanceof Blob && blob.size > 0) {
        const ct = res.headers?.['content-type'] || '';
        if (ct.includes('application/json')) {
          const text = await blob.text();
          const json = JSON.parse(text);
          if (!json.success && json.message) throw new Error(json.message);
        }
        downloadBlob(blob, `reports-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else throw new Error('Respons kosong');
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Gagal unduh Excel';
      alert(msg);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const res = await reportsApi.exportPdf(getExportParams());
      const blob = res.data;
      if (blob instanceof Blob && blob.size > 0) {
        const ct = res.headers?.['content-type'] || '';
        if (ct.includes('application/json')) {
          const text = await blob.text();
          const json = JSON.parse(text);
          if (!json.success && json.message) throw new Error(json.message);
        }
        downloadBlob(blob, `reports-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
      } else throw new Error('Respons kosong');
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Gagal unduh PDF';
      alert(msg);
    } finally {
      setExporting(null);
    }
  };

  const summary = data?.summary ?? {};
  const breakdown = data?.breakdown ?? {};
  const rows = data?.rows ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 };
  const series = data?.series ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-600 mt-1">Laporan lengkap dengan filter periode, cabang, wilayah, dan provinsi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen((v) => !v)}>
            <Filter className="w-4 h-4 mr-2" />
            {filtersOpen ? 'Sembunyikan Filter' : 'Tampilkan Filter'}
          </Button>
          <Button variant="primary" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Memuat...' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!!exporting}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {exporting === 'excel' ? '...' : 'Excel'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!!exporting}>
            <FileType className="w-4 h-4 mr-2" />
            {exporting === 'pdf' ? '...' : 'PDF'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500 hover:underline">Tutup</button>
        </div>
      )}

      {/* Filter panel */}
      <Card className="travel-card">
        <button
          type="button"
          className="w-full flex items-center justify-between text-left font-semibold text-stone-900"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500" />
            Filter Laporan
          </span>
          {filtersOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
        {filtersOpen && (
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tipe Laporan</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {REPORT_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Periode</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cabang</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Semua cabang</option>
                {filterOptions.branches
                  .filter((b) => {
                    const pid = (b as { provinsi_id?: string | null }).provinsi_id;
                    if (wilayahId && pid) {
                      const provinsi = filterOptions.provinsi.find((p) => p.id === pid);
                      return provinsi?.Wilayah?.id === wilayahId;
                    }
                    if (provinsiId) return pid === provinsiId;
                    return true;
                  })
                  .map((b) => (
                    <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Wilayah</label>
              <select
                value={wilayahId}
                onChange={(e) => { setWilayahId(e.target.value); setProvinsiId(''); setBranchId(''); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Semua wilayah</option>
                {filterOptions.wilayah.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Provinsi</label>
              <select
                value={provinsiId}
                onChange={(e) => { setProvinsiId(e.target.value); setBranchId(''); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Semua provinsi</option>
                {filterOptions.provinsi
                  .filter((p) => !wilayahId || (p.Wilayah && p.Wilayah.id === wilayahId))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
            {reportType !== 'logs' && reportType !== 'financial' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Kelompok Waktu</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as ReportGroupBy)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {GROUP_BY_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            )}
            {(reportType === 'revenue' || reportType === 'orders' || reportType === 'partners') && isSuperAdmin && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {ROLES_FILTER.map((r) => (
                    <option key={r.value || 'all'} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}
            {reportType === 'logs' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sumber Log</label>
                  <input
                    type="text"
                    value={logSource}
                    onChange={(e) => setLogSource(e.target.value)}
                    placeholder="Opsional"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Level Log</label>
                  <select
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Semua</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {loading && !data && (
        <div className="text-center py-12 text-slate-500">Memuat data...</div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {reportType === 'financial' && (
              <>
                <Card hover className="travel-card">
                  <p className="text-sm text-slate-600 mb-1">Total Pendapatan</p>
                  <p className="text-2xl font-bold text-primary-600">{formatIDR(summary.total_revenue ?? 0)}</p>
                </Card>
                <Card hover className="travel-card">
                  <p className="text-sm text-slate-600 mb-1">Jumlah Invoice</p>
                  <p className="text-2xl font-bold text-slate-900">{summary.invoice_count ?? 0}</p>
                </Card>
              </>
            )}
            {(reportType === 'revenue' || reportType === 'orders' || reportType === 'partners' || reportType === 'jamaah') && (
              <>
                <Card hover className="travel-card">
                  <p className="text-sm text-slate-600 mb-1">Total Order</p>
                  <p className="text-2xl font-bold text-slate-900">{summary.total_orders ?? 0}</p>
                </Card>
                <Card hover className="travel-card">
                  <p className="text-sm text-slate-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-primary-600">{formatIDR(summary.total_revenue ?? 0)}</p>
                </Card>
                <Card hover className="travel-card">
                  <p className="text-sm text-slate-600 mb-1">Total Jamaah</p>
                  <p className="text-2xl font-bold text-slate-900">{summary.total_jamaah ?? 0}</p>
                </Card>
                <Card hover className="travel-card">
                  <p className="text-sm text-slate-600 mb-1">Total Invoice</p>
                  <p className="text-2xl font-bold text-slate-900">{summary.total_invoices ?? 0}</p>
                </Card>
              </>
            )}
            {reportType === 'logs' && (
              <Card hover className="travel-card">
                <p className="text-sm text-slate-600 mb-1">Total Log</p>
                <p className="text-2xl font-bold text-slate-900">{summary.total_logs ?? 0}</p>
              </Card>
            )}
          </div>

          {/* Series (time) */}
          {series.length > 0 && (
            <Card className="travel-card">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Trend per Periode</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="pb-2 pr-4">Periode</th>
                      <th className="pb-2 pr-4 text-right">Jumlah</th>
                      <th className="pb-2 pr-4 text-right">Revenue</th>
                      <th className="pb-2 text-right">Jamaah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((s) => (
                      <tr key={s.period} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 pr-4 font-medium">{s.period}</td>
                        <td className="py-2 pr-4 text-right">{s.count ?? 0}</td>
                        <td className="py-2 pr-4 text-right">{s.revenue != null ? formatIDR(s.revenue) : '-'}</td>
                        <td className="py-2 text-right">{s.jamaah ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {breakdown.by_branch && breakdown.by_branch.length > 0 && (
              <Card className="travel-card">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Per Cabang</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-600">
                        <th className="pb-2 pr-4">Cabang</th>
                        <th className="pb-2 pr-4 text-right">Jumlah</th>
                        <th className="pb-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.by_branch.map((row: any) => (
                        <tr key={row.branch_id} className="border-b border-slate-100">
                          <td className="py-2 pr-4">{row.branch_name ?? row.code ?? row.branch_id}</td>
                          <td className="py-2 pr-4 text-right">{row.count ?? row.invoice_count ?? 0}</td>
                          <td className="py-2 text-right">{row.revenue != null ? formatIDR(row.revenue) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {breakdown.by_status && Object.keys(breakdown.by_status).length > 0 && (
              <Card className="travel-card">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Per Status</h3>
                <div className="space-y-2">
                  {Object.entries(breakdown.by_status).map(([status, count]) => (
                    <div key={status} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                      <Badge variant="info">{status}</Badge>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {breakdown.by_provinsi && breakdown.by_provinsi.length > 0 && (
              <Card className="travel-card">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Per Provinsi</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-600">
                        <th className="pb-2 pr-4">Provinsi</th>
                        <th className="pb-2 pr-4 text-right">Jumlah</th>
                        <th className="pb-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.by_provinsi.map((row: any) => (
                        <tr key={row.provinsi_id} className="border-b border-slate-100">
                          <td className="py-2 pr-4">{row.provinsi_name ?? row.provinsi_id}</td>
                          <td className="py-2 pr-4 text-right">{row.count ?? row.invoice_count ?? 0}</td>
                          <td className="py-2 text-right">{row.revenue != null ? formatIDR(row.revenue) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {breakdown.by_wilayah && breakdown.by_wilayah.length > 0 && (
              <Card className="travel-card">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Per Wilayah</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-600">
                        <th className="pb-2 pr-4">Wilayah</th>
                        <th className="pb-2 pr-4 text-right">Jumlah</th>
                        <th className="pb-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.by_wilayah.map((row: any) => (
                        <tr key={row.wilayah_id} className="border-b border-slate-100">
                          <td className="py-2 pr-4">{row.wilayah_name ?? row.wilayah_id}</td>
                          <td className="py-2 pr-4 text-right">{row.count ?? row.invoice_count ?? 0}</td>
                          <td className="py-2 text-right">{row.revenue != null ? formatIDR(row.revenue) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Detail table */}
          <Card className="travel-card">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {reportType === 'logs' ? 'Log Entri' : reportType === 'financial' ? 'Detail Invoice' : 'Detail Order'}
            </h3>
            <div className="overflow-x-auto">
              {reportType === 'logs' ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="pb-2 pr-4">Waktu</th>
                      <th className="pb-2 pr-4">Sumber</th>
                      <th className="pb-2 pr-4">Level</th>
                      <th className="pb-2">Pesan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((log: any, i) => (
                      <tr key={log.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 pr-4 whitespace-nowrap">{log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}</td>
                        <td className="py-2 pr-4">{log.source ?? '-'}</td>
                        <td className="py-2 pr-4"><Badge variant="info">{log.level ?? '-'}</Badge></td>
                        <td className="py-2 max-w-md truncate">{log.message ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : reportType === 'financial' ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="pb-2 pr-4">No. Invoice</th>
                      <th className="pb-2 pr-4">Cabang</th>
                      <th className="pb-2 pr-4">Owner</th>
                      <th className="pb-2 pr-4 text-right">Total</th>
                      <th className="pb-2 pr-4 text-right">Terbayar</th>
                      <th className="pb-2 pr-4 text-right">Sisa</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 pr-4 font-mono">{inv.invoice_number}</td>
                        <td className="py-2 pr-4">{inv.branch_name ?? '-'}</td>
                        <td className="py-2 pr-4">{inv.owner_name ?? '-'}</td>
                        <td className="py-2 pr-4 text-right">{formatIDR(inv.total_amount ?? 0)}</td>
                        <td className="py-2 pr-4 text-right text-primary-600">{formatIDR(inv.paid_amount ?? 0)}</td>
                        <td className="py-2 pr-4 text-right">{formatIDR(inv.remaining_amount ?? 0)}</td>
                        <td className="py-2"><Badge variant="info">{inv.status ?? '-'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-600">
                        <th className="pb-2 pr-4">No. Order</th>
                        <th className="pb-2 pr-4">Wilayah</th>
                        <th className="pb-2 pr-4">Provinsi</th>
                        <th className="pb-2 pr-4">Cabang</th>
                        <th className="pb-2 pr-4">Owner</th>
                        <th className="pb-2 pr-4">Role</th>
                        <th className="pb-2 pr-4 text-right">Subtotal</th>
                        <th className="pb-2 pr-4 text-right">Diskon</th>
                        <th className="pb-2 pr-4 text-right">Penalty</th>
                        <th className="pb-2 pr-4 text-right">Total</th>
                        <th className="pb-2 pr-4">Currency</th>
                        <th className="pb-2 pr-4 text-right">Jamaah</th>
                        <th className="pb-2 pr-4">Item Types</th>
                        <th className="pb-2 pr-4">Tanggal</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((o: any) => (
                        <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-4 font-mono">{o.order_number}</td>
                          <td className="py-2 pr-4">{o.wilayah_name ?? '-'}</td>
                          <td className="py-2 pr-4">{o.provinsi_name ?? '-'}</td>
                          <td className="py-2 pr-4">{o.branch_name ?? '-'}</td>
                          <td className="py-2 pr-4">{o.owner_name ?? '-'}</td>
                          <td className="py-2 pr-4">{o.role ?? '-'}</td>
                          <td className="py-2 pr-4 text-right">{formatIDR(o.subtotal ?? 0)}</td>
                          <td className="py-2 pr-4 text-right">{o.discount ? formatIDR(o.discount) : '-'}</td>
                          <td className="py-2 pr-4 text-right">{o.penalty_amount ? formatIDR(o.penalty_amount) : '-'}</td>
                          <td className="py-2 pr-4 text-right font-medium">{formatIDR(o.total_amount ?? 0)}</td>
                          <td className="py-2 pr-4">{o.currency ?? 'IDR'}</td>
                          <td className="py-2 pr-4 text-right">{o.total_jamaah ?? 0}</td>
                          <td className="py-2 pr-4">
                            {o.item_types && o.item_types.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {o.item_types.map((t: string, i: number) => (
                                  <Badge key={i} variant="info" className="text-xs">{t}</Badge>
                                ))}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">{o.created_at ? new Date(o.created_at).toLocaleString('id-ID') : '-'}</td>
                          <td className="py-2"><Badge variant="info">{o.status ?? '-'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {rows.length === 0 && (
              <p className="text-slate-500 py-6 text-center">Tidak ada data</p>
            )}
            {reportType !== 'logs' && pagination.totalPages > 1 && (
              <TablePagination
                total={pagination.total}
                page={pagination.page}
                limit={pagination.limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
                loading={loading}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
