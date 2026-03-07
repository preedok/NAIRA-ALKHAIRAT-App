import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Filter,
  FileSpreadsheet,
  FileType,
  DollarSign,
  Receipt,
  Package,
  Users,
  FileText,
  Eye
} from 'lucide-react';
import Card from '../../../components/common/Card';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import ContentLoading from '../../../components/common/ContentLoading';
import StatCard from '../../../components/common/StatCard';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Table from '../../../components/common/Table'; 
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl } from '../../../components/common';
import { FilterIconButton } from '../../../components/common/PageFilter';
import { useAuth } from '../../../contexts/AuthContext';
import type { TableColumn } from '../../../types';
import { AUTOCOMPLETE_FILTER } from '../../../utils/constants';
import {
  reportsApi,
  invoicesApi,
  businessRulesApi,
  type ReportType,
  type ReportGroupBy,
  type ReportPeriod,
  type ReportsAnalyticsData
} from '../../../services/api';
import { InvoiceStatusRefundCell } from '../../../components/common/InvoiceStatusRefundCell';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { formatIDR } from '../../../utils';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';

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

const DEFAULT_REPORT_TYPE: ReportType = 'revenue';
const DEFAULT_PERIOD: ReportPeriod = 'month';
const DEFAULT_GROUP_BY: ReportGroupBy = 'month';

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>(DEFAULT_REPORT_TYPE);
  const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_PERIOD);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [wilayahId, setWilayahId] = useState('');
  const [provinsiId, setProvinsiId] = useState('');
  const [groupBy, setGroupBy] = useState<ReportGroupBy>(DEFAULT_GROUP_BY);
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
  const [invoiceList, setInvoiceList] = useState<any[]>([]);
  const [invoicePagination, setInvoicePagination] = useState<{ page: number; limit: number; total: number; totalPages: number }>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const tableSectionRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    businessRulesApi.get({}).then((r) => {
      const d = (r.data as any)?.data;
      if (d && (d.SAR_TO_IDR != null || d.USD_TO_IDR != null)) setCurrencyRates({ SAR_TO_IDR: d.SAR_TO_IDR, USD_TO_IDR: d.USD_TO_IDR });
    }).catch(() => {});
  }, []);

  const fetchInvoiceList = useCallback(async () => {
    if (reportType === 'logs') return;
    setLoadingInvoices(true);
    try {
      const params: Record<string, string | number | undefined> = { page, limit, sort_by: 'created_at', sort_order: 'desc' };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (branchId) params.branch_id = branchId;
      if (wilayahId) params.wilayah_id = wilayahId;
      if (provinsiId) params.provinsi_id = provinsiId;
      const res = await invoicesApi.list(params);
      const payload = res.data as { success?: boolean; data?: any[]; pagination?: { page: number; limit: number; total: number; totalPages: number } };
      if (payload.success && Array.isArray(payload.data)) {
        setInvoiceList(payload.data);
        if (payload.pagination) setInvoicePagination(payload.pagination);
      } else setInvoiceList([]);
    } catch {
      setInvoiceList([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [reportType, dateFrom, dateTo, branchId, wilayahId, provinsiId, page, limit]);

  useEffect(() => {
    if (reportType && reportType !== 'logs') fetchInvoiceList();
    else setInvoiceList([]);
  }, [reportType, fetchInvoiceList]);

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

  const logsFilterActive = reportType === 'logs' && (!!logSource || !!logLevel);
  const hasActiveFilters = reportType !== DEFAULT_REPORT_TYPE || period !== DEFAULT_PERIOD || !!dateFrom || !!dateTo || !!branchId || !!wilayahId || !!provinsiId || groupBy !== DEFAULT_GROUP_BY || !!roleFilter || logsFilterActive;
  const resetFilters = () => {
    setReportType(DEFAULT_REPORT_TYPE);
    setPeriod(DEFAULT_PERIOD);
    setDateFrom('');
    setDateTo('');
    setBranchId('');
    setWilayahId('');
    setProvinsiId('');
    setGroupBy(DEFAULT_GROUP_BY);
    setRoleFilter('');
    setLogSource('');
    setLogLevel('');
  };

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
  const detailInvoiceRows = reportType === 'logs' ? [] : invoiceList;
  const detailInvoicePagination = reportType === 'logs' ? null : invoicePagination;

  return (
    <div className="flex flex-col min-h-0 w-full max-w-full space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Laporan lengkap dengan filter periode, cabang, wilayah, dan provinsi"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <AutoRefreshControl onRefresh={fetchAnalytics} disabled={loading} />
            <FilterIconButton open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} hasActiveFilters={hasActiveFilters} />
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!!exporting}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exporting === 'excel' ? '...' : 'Excel'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!!exporting}>
              <FileType className="w-4 h-4 mr-2" />
              {exporting === 'pdf' ? '...' : 'PDF'}
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500 hover:underline">Tutup</button>
        </div>
      )}

      {filtersOpen && (
        <Card className="mt-4 w-full min-w-0 p-5 sm:p-6 bg-slate-50/80 border border-slate-200/80 rounded-xl shadow-sm">
          <CardSectionHeader
            icon={<Filter className="w-6 h-6" />}
            title="Pengaturan Filter"
            subtitle="Pilih tipe, periode, cabang & wilayah. Filter berlaku otomatis."
            className="mb-4 pb-3 border-b border-slate-200/80"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <Autocomplete
              label="Tipe Laporan"
              value={reportType}
              onChange={(v) => setReportType(v as ReportType)}
              options={REPORT_TYPES.map((r) => ({ value: r.value, label: r.label }))}
            />
            <Autocomplete
              label="Periode"
              value={period}
              onChange={(v) => setPeriod(v as ReportPeriod)}
              options={PERIOD_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
            />
            <Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <Autocomplete
              label="Cabang"
              value={branchId}
              onChange={setBranchId}
              options={filterOptions.branches
                .filter((b) => {
                  const pid = (b as { provinsi_id?: string | null }).provinsi_id;
                  if (wilayahId && pid) {
                    const provinsi = filterOptions.provinsi.find((p) => p.id === pid);
                    return provinsi?.Wilayah?.id === wilayahId;
                  }
                  if (provinsiId) return pid === provinsiId;
                  return true;
                })
                .map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
              emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_CABANG}
            />
            <Autocomplete
              label="Wilayah"
              value={wilayahId}
              onChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }}
              options={filterOptions.wilayah.map((w) => ({ value: w.id, label: w.name }))}
              emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_WILAYAH}
            />
            <Autocomplete
              label="Provinsi"
              value={provinsiId}
              onChange={(v) => { setProvinsiId(v); setBranchId(''); }}
              options={filterOptions.provinsi
                .filter((p) => !wilayahId || (p.Wilayah && p.Wilayah.id === wilayahId))
                .map((p) => ({ value: p.id, label: p.name }))}
              emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_PROVINSI}
            />
            {reportType !== 'logs' && reportType !== 'financial' && (
              <Autocomplete
                label="Kelompok Waktu"
                value={groupBy}
                onChange={(v) => setGroupBy(v as ReportGroupBy)}
                options={GROUP_BY_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
              />
            )}
            {(reportType === 'revenue' || reportType === 'orders' || reportType === 'partners') && isSuperAdmin && (
              <Autocomplete
                label="Role"
                value={roleFilter}
                onChange={setRoleFilter}
                options={ROLES_FILTER.map((r) => ({ value: r.value, label: r.label }))}
              />
            )}
            {reportType === 'logs' && (
              <>
                <Input label="Sumber Log" type="text" value={logSource} onChange={(e) => setLogSource(e.target.value)} placeholder="Opsional" />
                <Autocomplete
                  label="Level Log"
                  value={logLevel}
                  onChange={setLogLevel}
                  options={[
                    { value: 'info', label: 'Info' },
                    { value: 'warn', label: 'Warn' },
                    { value: 'error', label: 'Error' },
                    { value: 'debug', label: 'Debug' }
                  ]}
                  emptyLabel={AUTOCOMPLETE_FILTER.SEMUA}
                />
              </>
            )}
          </div>
        </Card>
      )}

      <Card className="travel-card min-h-[200px]">
        <CardSectionHeader icon={<FileText className="w-6 h-6" />} title="Data Laporan" subtitle="Ringkasan dan detail sesuai tipe dan filter." className="mb-4" />
        {loading && !data ? (
          <ContentLoading />
        ) : data ? (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
            {reportType === 'financial' && (
              <>
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Pendapatan" value={formatIDR(summary.total_revenue ?? 0)} iconClassName="bg-[#0D1A63] text-white" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
                <StatCard icon={<Receipt className="w-5 h-5" />} label="Jumlah Invoice" value={summary.invoice_count ?? 0} iconClassName="bg-sky-100 text-sky-600" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
              </>
            )}
            {(reportType === 'revenue' || reportType === 'orders' || reportType === 'partners' || reportType === 'jamaah') && (
              <>
                <StatCard icon={<Package className="w-5 h-5" />} label="Total Order" value={summary.total_orders ?? 0} iconClassName="bg-slate-100 text-slate-600" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Revenue" value={formatIDR(summary.total_revenue ?? 0)} iconClassName="bg-[#0D1A63] text-white" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
                <StatCard icon={<Users className="w-5 h-5" />} label="Total Jamaah" value={summary.total_jamaah ?? 0} iconClassName="bg-emerald-100 text-emerald-600" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
                <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Invoice" value={summary.total_invoices ?? 0} iconClassName="bg-sky-100 text-sky-600" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
              </>
            )}
            {reportType === 'logs' && (
              <StatCard icon={<FileText className="w-5 h-5" />} label="Total Log" value={summary.total_logs ?? 0} iconClassName="bg-slate-100 text-slate-600" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
            )}
          </div>

          <div ref={tableSectionRef}>
          {/* Series (time) */}
          {series.length > 0 && (
            <Card className="travel-card shrink-0">
              <CardSectionHeader title="Trend per Periode" subtitle="Data per periode sesuai filter." className="mb-4" />
              <div className="overflow-x-auto rounded-xl border border-slate-200 min-w-0">
              <Table
                columns={[
                  { id: 'period', label: 'Periode', align: 'left' },
                  { id: 'count', label: 'Jumlah', align: 'right' },
                  { id: 'revenue', label: 'Revenue', align: 'right' },
                  { id: 'jamaah', label: 'Jamaah', align: 'right' }
                ] as TableColumn[]}
                data={series}
                renderRow={(s) => (
                  <tr key={s.period} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">{s.period}</td>
                    <td className="py-3 px-4 text-right text-slate-700">{s.count ?? 0}</td>
                    <td className="py-3 px-4 text-right text-slate-700">{s.revenue != null ? formatIDR(s.revenue) : '-'}</td>
                    <td className="py-3 px-4 text-right text-slate-700">{s.jamaah ?? 0}</td>
                  </tr>
                )}
              />
              </div>
            </Card>
          )}

          {/* Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
            {breakdown.by_branch && breakdown.by_branch.length > 0 && (
              <Card className="travel-card min-w-0">
                <CardSectionHeader title="Per Cabang" className="mb-4" />
                <div className="overflow-auto max-h-96 min-w-0 rounded-xl border border-slate-200">
                  <Table
                    columns={[
                      { id: 'branch', label: 'Cabang', align: 'left' },
                      { id: 'count', label: 'Jumlah', align: 'right' },
                      { id: 'revenue', label: 'Revenue', align: 'right' }
                    ] as TableColumn[]}
                    data={breakdown.by_branch}
                    renderRow={(row: any) => (
                      <tr key={row.branch_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-700">{row.branch_name ?? row.code ?? row.branch_id}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{row.count ?? row.invoice_count ?? 0}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{row.revenue != null ? formatIDR(row.revenue) : '-'}</td>
                      </tr>
                    )}
                  />
                </div>
              </Card>
            )}
            {breakdown.by_status && Object.keys(breakdown.by_status).length > 0 && (
              <Card className="travel-card">
                <CardSectionHeader title="Per Status" className="mb-4" />
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
              <Card className="travel-card min-w-0">
                <CardSectionHeader title="Per Provinsi" className="mb-4" />
                <div className="overflow-auto max-h-96 min-w-0 rounded-xl border border-slate-200">
                  <Table
                    columns={[
                      { id: 'provinsi', label: 'Provinsi', align: 'left' },
                      { id: 'count', label: 'Jumlah', align: 'right' },
                      { id: 'revenue', label: 'Revenue', align: 'right' }
                    ] as TableColumn[]}
                    data={breakdown.by_provinsi}
                    renderRow={(row: any) => (
                      <tr key={row.provinsi_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-700">{row.provinsi_name ?? row.provinsi_id}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{row.count ?? row.invoice_count ?? 0}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{row.revenue != null ? formatIDR(row.revenue) : '-'}</td>
                      </tr>
                    )}
                  />
                </div>
              </Card>
            )}
            {breakdown.by_wilayah && breakdown.by_wilayah.length > 0 && (
              <Card className="travel-card min-w-0">
                <CardSectionHeader title="Per Wilayah" className="mb-4" />
                <div className="overflow-auto max-h-96 min-w-0 rounded-xl border border-slate-200">
                  <Table
                    columns={[
                      { id: 'wilayah', label: 'Wilayah', align: 'left' },
                      { id: 'count', label: 'Jumlah', align: 'right' },
                      { id: 'revenue', label: 'Revenue', align: 'right' }
                    ] as TableColumn[]}
                    data={breakdown.by_wilayah}
                    renderRow={(row: any) => (
                      <tr key={row.wilayah_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-700">{row.wilayah_name ?? row.wilayah_id}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{row.count ?? row.invoice_count ?? 0}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{row.revenue != null ? formatIDR(row.revenue) : '-'}</td>
                      </tr>
                    )}
                  />
                </div>
              </Card>
            )}
          </div>
          </div>

          {/* Detail table — struktur sama seperti tabel Invoice (OrdersInvoicesPage) */}
          <Card className="travel-card">
            <CardSectionHeader
              icon={<FileText className="w-6 h-6" />}
              title={reportType === 'logs' ? 'Log Entri' : 'Detail Invoice'}
              subtitle="Detail data sesuai tipe laporan dan filter."
              className="mb-4"
            />
            <div className="overflow-x-auto rounded-xl border border-slate-200">
            {reportType === 'logs' ? (
              <Table
                columns={[
                  { id: 'created_at', label: 'Waktu', align: 'left' },
                  { id: 'source', label: 'Sumber', align: 'left' },
                  { id: 'level', label: 'Level', align: 'left' },
                  { id: 'message', label: 'Pesan', align: 'left' }
                ] as TableColumn[]}
                data={rows}
                emptyMessage="Tidak ada data"
                renderRow={(log: any, i) => (
                  <tr key={log.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700">{log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}</td>
                    <td className="py-3 px-4 text-slate-700">{log.source ?? '-'}</td>
                    <td className="py-3 px-4"><Badge variant="info">{log.level ?? '-'}</Badge></td>
                    <td className="py-3 px-4 max-w-md truncate text-slate-700">{log.message ?? '-'}</td>
                  </tr>
                )}
              />
            ) : (
              <Table
                columns={[
                  { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
                  { id: 'owner', label: 'Owner', align: 'left' },
                  { id: 'company_wilayah', label: 'Perusahaan', align: 'left' },
                  { id: 'total', label: 'Total (IDR·SAR·USD)', align: 'right' },
                  { id: 'paid', label: 'Status · Dibayar (IDR·SAR·USD)', align: 'right' },
                  { id: 'remaining', label: 'Sisa (IDR·SAR·USD)', align: 'right' },
                  { id: 'date', label: 'Tgl', align: 'left' }
                ] as TableColumn[]}
                data={loadingInvoices ? [] : detailInvoiceRows}
                emptyMessage={loadingInvoices ? 'Memuat...' : 'Tidak ada data'}
                pagination={detailInvoicePagination && detailInvoicePagination.total > 0 ? { total: detailInvoicePagination.total, page: detailInvoicePagination.page, limit: detailInvoicePagination.limit, totalPages: detailInvoicePagination.totalPages, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } } : undefined}
                renderRow={(inv: any) => (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan />
                    </td>
                    <td className="py-3 px-4 text-slate-700">{inv.User?.name ?? inv.User?.company_name ?? '–'}</td>
                    <td className="py-3 px-4 text-slate-700 text-sm">
                      <div>{inv.User?.company_name ?? inv.User?.name ?? '–'}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{inv.Branch?.Provinsi?.Wilayah?.name && inv.Branch?.Provinsi?.name ? `${inv.Branch.Provinsi.Wilayah.name} · ${inv.Branch.Provinsi.name}` : (inv.Branch?.name ?? '–')}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">{formatIDR(parseFloat(inv.total_amount) || 0)}</td>
                    <td className="py-3 px-4 text-right align-top">
                      <InvoiceStatusRefundCell inv={inv} currencyRates={currencyRates} align="right" />
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">{formatIDR(parseFloat(inv.remaining_amount) || 0)}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700">{inv.issued_at || inv.created_at ? new Date(inv.issued_at || inv.created_at).toLocaleDateString('id-ID') : '–'}</td>
                  </tr>
                )}
              />
            )}
            </div>
          </Card>
        </div>
        ) : null}
      </Card>
    </div>
  );
};

export default ReportsPage;
