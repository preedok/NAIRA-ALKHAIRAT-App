import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Filter, Download, RefreshCw, BarChart3, Users, Building2, Package, List, ExternalLink, TrendingUp, TrendingDown, Search, Calendar, MapPin, Map, Receipt, DollarSign, Eye } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import { StatCard, CardSectionHeader, Input, Autocomplete, ContentLoading, AutoRefreshControl, NominalDisplay, Modal, ModalHeader, ModalBody, ModalBoxLg } from '../../../components/common';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { accountingApi, branchesApi, businessRulesApi, type AccountingFinancialReportData } from '../../../services/api';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { getDisplayRemaining } from '../../../utils/invoiceTableHelpers';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant, type InvoiceForStatusRefund } from '../../../components/common/InvoiceStatusRefundCell';
import Badge from '../../../components/common/Badge';

type ReportTab = 'ringkasan' | 'wilayah' | 'provinsi' | 'cabang' | 'owner' | 'produk' | 'periode' | 'detail';

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel',
  visa: 'Visa',
  ticket: 'Tiket',
  bus: 'Bus',
  siskopatuh: 'Siskopatuh',
  handling: 'Handling'
};

const DATE_PRESETS = [
  { id: 'today', label: 'Hari ini', getValue: () => { const d = new Date(); return { period: 'custom' as const, dateFrom: d.toISOString().slice(0, 10), dateTo: d.toISOString().slice(0, 10) }; } },
  { id: 'this_week', label: 'Minggu ini', getValue: () => { const d = new Date(); const start = new Date(d); start.setDate(d.getDate() - d.getDay()); return { period: 'custom' as const, dateFrom: start.toISOString().slice(0, 10), dateTo: d.toISOString().slice(0, 10) }; } },
  { id: 'this_month', label: 'Bulan ini', getValue: () => { const d = new Date(); return { period: 'month' as const, year: d.getFullYear(), month: d.getMonth() + 1 }; } },
  { id: 'last_month', label: 'Bulan lalu', getValue: () => { const d = new Date(); const m = d.getMonth(); const y = m === 0 ? d.getFullYear() - 1 : d.getFullYear(); return { period: 'month' as const, year: y, month: m === 0 ? 12 : m }; } },
  { id: 'this_year', label: 'Tahun ini', getValue: () => { const d = new Date(); return { period: 'year' as const, year: d.getFullYear() }; } }
];

const formatDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const formatPeriodLabel = (p: string) => {
  const [y, m] = p.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${months[parseInt(m || '1', 10) - 1]} ${y}`;
};

type SortKey = 'name' | 'revenue' | 'pct' | 'count';
const sortAndPaginate = <T extends Record<string, unknown>>(
  arr: T[],
  sortKey: SortKey,
  sortOrder: 'asc' | 'desc',
  page: number,
  limit: number,
  opts: { nameKey: string; revenueKey?: string; totalRevenue?: number }
): { rows: T[]; total: number; totalPages: number } => {
  const total = arr.length;
  const sorted = [...arr].sort((a, b) => {
    let va: string | number = '';
    let vb: string | number = '';
    if (sortKey === 'name') {
      va = String(a[opts.nameKey] ?? '');
      vb = String(b[opts.nameKey] ?? '');
      return sortOrder === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    }
    if (sortKey === 'revenue' && opts.revenueKey) {
      va = Number(a[opts.revenueKey] ?? 0);
      vb = Number(b[opts.revenueKey] ?? 0);
      return sortOrder === 'asc' ? va - vb : vb - va;
    }
    if (sortKey === 'count' && 'invoice_count' in a && 'invoice_count' in b) {
      va = Number(a.invoice_count ?? 0);
      vb = Number(b.invoice_count ?? 0);
      return sortOrder === 'asc' ? va - vb : vb - va;
    }
    return 0;
  });
  const start = (page - 1) * limit;
  const rows = sorted.slice(start, start + limit);
  return { rows, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
};

const REPORT_TABLE_COLUMNS: Record<string, TableColumn[]> = {
  wilayah: [
    { id: 'no', label: 'No', align: 'left' },
    { id: 'name', label: 'Wilayah', align: 'left' },
    { id: 'revenue', label: 'Pendapatan (IDR · SAR · USD)', align: 'right' },
    { id: 'pct', label: '%', align: 'right' },
    { id: 'count', label: 'Invoice', align: 'right' }
  ],
  provinsi: [
    { id: 'no', label: 'No', align: 'left' },
    { id: 'name', label: 'Provinsi', align: 'left' },
    { id: 'revenue', label: 'Pendapatan (IDR · SAR · USD)', align: 'right' },
    { id: 'pct', label: '%', align: 'right' },
    { id: 'count', label: 'Invoice', align: 'right' }
  ],
  cabang: [
    { id: 'no', label: 'No', align: 'left' },
    { id: 'name', label: 'Cabang', align: 'left' },
    { id: 'revenue', label: 'Pendapatan (IDR · SAR · USD)', align: 'right' },
    { id: 'pct', label: '%', align: 'right' },
    { id: 'count', label: 'Invoice', align: 'right' }
  ],
  owner: [
    { id: 'no', label: 'No', align: 'left' },
    { id: 'name', label: 'Owner / Partner', align: 'left' },
    { id: 'revenue', label: 'Pendapatan (IDR · SAR · USD)', align: 'right' },
    { id: 'pct', label: '%', align: 'right' },
    { id: 'count', label: 'Invoice', align: 'right' }
  ],
  produk: [
    { id: 'no', label: 'No', align: 'left' },
    { id: 'name', label: 'Jenis Produk', align: 'left' },
    { id: 'revenue', label: 'Pendapatan (IDR · SAR · USD)', align: 'right' },
    { id: 'pct', label: '%', align: 'right' },
    { id: 'aksi', label: '', align: 'center' }
  ],
  periode: [
    { id: 'no', label: 'No', align: 'left' },
    { id: 'name', label: 'Periode', align: 'left' },
    { id: 'revenue', label: 'Pendapatan (IDR · SAR · USD)', align: 'right' },
    { id: 'pct', label: '%', align: 'right' },
    { id: 'count', label: 'Invoice', align: 'right' }
  ],
  detail: [
    { id: 'invoice', label: 'No. Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'company', label: 'Perusahaan', align: 'left' },
    { id: 'total', label: 'Total (IDR · SAR · USD)', align: 'right' },
    { id: 'dibayar', label: 'Status · Dibayar (IDR · SAR · USD)', align: 'right' },
    { id: 'sisa', label: 'Sisa (IDR · SAR · USD)', align: 'right' },
    { id: 'tanggal', label: 'Tanggal', align: 'left' },
    { id: 'aksi', label: '', align: 'center' }
  ]
};

const AccountingFinancialReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AccountingFinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'custom'>('month');
  const [year, setYear] = useState(new Date().getFullYear());
  const [datePresetId, setDatePresetId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [wilayahId, setWilayahId] = useState('');
  const [provinsiId, setProvinsiId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [status, setStatus] = useState('');
  const [productType, setProductType] = useState('');
  const [search, setSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState('issued_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [provinsiList, setProvinsiList] = useState<{ id: string; name: string; wilayah_id?: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<ReportTab>('ringkasan');
  const [exporting, setExporting] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tableLimit, setTableLimit] = useState(25);
  const [tableSortKey, setTableSortKey] = useState<SortKey>('revenue');
  const [tableSortOrder, setTableSortOrder] = useState<'asc' | 'desc'>('desc');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({ SAR_TO_IDR: 4200, USD_TO_IDR: 15500 });
  const [productInvoiceModalType, setProductInvoiceModalType] = useState<string | null>(null);

  useEffect(() => {
    businessRulesApi.get({}).then((res) => {
      const cr = res.data?.data?.currency_rates;
      if (cr) {
        try {
          const rates = typeof cr === 'string' ? JSON.parse(cr) : cr;
          setCurrencyRates({ SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 });
        } catch { /* keep default */ }
      }
    }).catch(() => { /* keep default */ });
  }, []);

  const sarToIdr = currencyRates.SAR_TO_IDR ?? 4200;
  const usdToIdr = currencyRates.USD_TO_IDR ?? 15500;
  const amountTriple = (idr: number) => ({ idr, sar: idr / sarToIdr, usd: idr / usdToIdr });

  const buildParams = useCallback(() => {
    const params: Record<string, string | number> = {};
    if (period === 'custom' && dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    } else {
      params.period = period;
      params.year = String(year);
      if (period === 'month') params.month = String(month);
      else if (period === 'quarter') params.month = String(Math.ceil(month / 3));
    }
    if (branchId) params.branch_id = branchId;
    else if (provinsiId) params.provinsi_id = provinsiId;
    else if (wilayahId) params.wilayah_id = wilayahId;
    if (ownerId) params.owner_id = ownerId;
    if (status) params.status = status;
    if (productType) params.product_type = productType;
    if (search.trim()) params.search = search.trim();
    if (minAmount) params.min_amount = parseFloat(minAmount) || 0;
    if (maxAmount) params.max_amount = parseFloat(maxAmount) || 0;
    params.page = page;
    params.limit = limit;
    params.sort_by = sortBy;
    params.sort_order = sortOrder;
    return params;
  }, [period, year, month, dateFrom, dateTo, branchId, provinsiId, wilayahId, ownerId, status, productType, search, minAmount, maxAmount, page, limit, sortBy, sortOrder]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await accountingApi.getFinancialReport(buildParams());
      if (res.data.success && res.data.data) {
        setData(res.data.data);
      } else {
        setData(null);
        setFetchError('Format respons tidak valid.');
      }
    } catch (e: any) {
      setData(null);
      const msg = e.response?.data?.message || e.message || 'Gagal memuat laporan. Periksa koneksi dan coba lagi.';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    branchesApi.listWilayah().then((r) => {
      if (r.data.success) setWilayahList(r.data.data || []);
    }).catch(() => setWilayahList([]));
  }, []);

  useEffect(() => {
    branchesApi.listProvinces().then((r) => {
      if (r.data.success) {
        const list = (r.data.data || []).map((p) => ({
          id: String(p.id),
          name: p.name || (p as any).nama || '',
          wilayah_id: (p as any).wilayah_id ? String((p as any).wilayah_id) : undefined
        }));
        setProvinsiList(list);
      }
    }).catch(() => setProvinsiList([]));
  }, []);

  useEffect(() => {
    const params: { provinsi_id?: string; wilayah_id?: string; limit?: number } = { limit: 500 };
    if (provinsiId) params.provinsi_id = provinsiId;
    else if (wilayahId) params.wilayah_id = wilayahId;
    branchesApi.list(params).then((r) => {
      if (r.data.success) setBranches(r.data.data || []);
    }).catch(() => setBranches([]));
  }, [wilayahId, provinsiId]);

  useEffect(() => {
    const params: { branch_id?: string; provinsi_id?: string; wilayah_id?: string } = {};
    if (branchId) params.branch_id = branchId;
    else if (provinsiId) params.provinsi_id = provinsiId;
    else if (wilayahId) params.wilayah_id = wilayahId;
    accountingApi.listAccountingOwners(params).then((r) => {
      if (r.data.success) setOwners(r.data.data || []);
    }).catch(() => setOwners([]));
  }, [branchId, provinsiId, wilayahId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const applyPreset = (preset: typeof DATE_PRESETS[0]) => {
    setDatePresetId(preset.id);
    const v = preset.getValue();
    if ('period' in v) setPeriod(v.period);
    if ('dateFrom' in v) setDateFrom(v.dateFrom);
    if ('dateTo' in v) setDateTo(v.dateTo);
    if ('year' in v) setYear(v.year);
    if ('month' in v) setMonth(v.month);
    setPage(1);
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const p = buildParams();
      delete p.page;
      delete p.limit;
      delete p.sort_by;
      delete p.sort_order;
      const res = await accountingApi.exportFinancialExcel(p);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal export Excel');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const p = buildParams();
      delete p.page;
      delete p.limit;
      delete p.sort_by;
      delete p.sort_order;
      const res = await accountingApi.exportFinancialPdf(p);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal export PDF');
    } finally {
      setExporting(null);
    }
  };

  const resetFilters = () => {
    setDatePresetId('');
    setPeriod('month');
    setYear(new Date().getFullYear());
    setMonth(new Date().getMonth() + 1);
    setDateFrom('');
    setDateTo('');
    setWilayahId('');
    setProvinsiId('');
    setBranchId('');
    setOwnerId('');
    setStatus('');
    setProductType('');
    setSearch('');
    setMinAmount('');
    setMaxAmount('');
    setPage(1);
    setFetchError(null);
  };

  const isCustomRange = period === 'custom';
  const hasActiveFilters =
    !!branchId || !!provinsiId || !!wilayahId || !!ownerId || !!status || !!productType ||
    !!search.trim() || !!minAmount || !!maxAmount ||
    period !== 'month' ||
    (period === 'month' && month !== new Date().getMonth() + 1) ||
    (isCustomRange && (!!dateFrom || !!dateTo));

  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 25, totalPages: 1 };
  const prevPeriod = data?.previous_period;

  const tabs: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ringkasan', label: 'Ringkasan', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'wilayah', label: 'Per Wilayah', icon: <MapPin className="w-4 h-4" /> },
    { id: 'provinsi', label: 'Per Provinsi', icon: <Map className="w-4 h-4" /> },
    { id: 'cabang', label: 'Per Cabang', icon: <Building2 className="w-4 h-4" /> },
    { id: 'owner', label: 'Per Owner', icon: <Users className="w-4 h-4" /> },
    { id: 'produk', label: 'Per Produk', icon: <Package className="w-4 h-4" /> },
    { id: 'periode', label: 'Per Bulan', icon: <Calendar className="w-4 h-4" /> },
    { id: 'detail', label: 'Detail Invoice', icon: <List className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Laporan Keuangan"
        subtitle="Pendapatan per wilayah, provinsi, cabang, owner, dan jenis produk"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <AutoRefreshControl onRefresh={fetchReport} disabled={loading} size="sm" />
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading || !!exporting}>
              <Download className={`w-4 h-4 mr-2 ${exporting === 'excel' ? 'animate-pulse' : ''}`} />
              {exporting === 'excel' ? 'Exporting...' : 'Excel'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={loading || !!exporting}>
              <Download className={`w-4 h-4 mr-2 ${exporting === 'pdf' ? 'animate-pulse' : ''}`} />
              {exporting === 'pdf' ? 'Exporting...' : 'PDF'}
            </Button>
          </div>
        }
      />

      <Card className="travel-card min-h-[200px]">
        <CardSectionHeader icon={<FileText className="w-6 h-6" />} title="Laporan Keuangan" subtitle="Hanya invoice yang sudah ada pembayaran (tagihan DP tidak dihitung). Ringkasan per wilayah, cabang, owner, dan detail invoice." className="mb-4" />
        {loading && !data ? (
          <ContentLoading />
        ) : !loading && !data ? (
        <div className="bg-slate-50 border-slate-200 rounded-xl p-6 text-center">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {fetchError ? 'Gagal memuat laporan' : 'Tidak ada data'}
            </h3>
            <p className="text-slate-500 max-w-md mx-auto mb-4">
              {fetchError || 'Tidak ada data laporan keuangan untuk periode dan filter yang dipilih. Coba ubah periode (mis. Bulan ini / Tahun ini).'}
            </p>
            <Button variant="primary" onClick={fetchReport}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Muat ulang
            </Button>
          </div>
        </div>
        ) : data ? (
        <>
          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-1.5">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={activeTab === tab.id ? 'primary' : 'outline'}
                size="sm"
                onClick={() => { setActiveTab(tab.id); setTablePage(1); }}
                className={activeTab === tab.id ? '' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}
              >
                {tab.icon}
                {tab.label}
              </Button>
            ))}
          </div>

          {activeTab === 'ringkasan' && (
            <Card className="min-w-0">
              <CardSectionHeader icon={<Filter className="w-6 h-6" />} title="Filter Ringkasan" subtitle="Periode & scope ringkasan" right={null} className="mb-2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-3 mb-3 pb-3 border-b border-slate-200 items-end">
                <Autocomplete label="Periode cepat" value={datePresetId} onChange={(v) => { const p = DATE_PRESETS.find((x) => x.id === v); if (p) applyPreset(p); else setDatePresetId(v || ''); }} options={DATE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} emptyLabel="Pilih periode" />
                <Autocomplete label="Jenis Periode" value={period} onChange={(v) => setPeriod(v as typeof period)} options={[{ value: 'month', label: 'Bulanan' }, { value: 'quarter', label: 'Triwulanan' }, { value: 'year', label: 'Tahunan' }, { value: 'custom', label: 'Rentang Tanggal' }]} />
                {period !== 'custom' ? (<><Input label="Tahun" type="number" value={String(year)} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} min={2020} max={2030} />{period === 'month' && <Autocomplete label="Bulan" value={String(month)} onChange={(v) => setMonth(parseInt(v, 10))} options={[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => ({ value: String(m), label: new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' }) }))} />}{period === 'quarter' && <Autocomplete label="Triwulan" value={String(Math.ceil(month / 3))} onChange={(v) => setMonth((parseInt(v, 10) - 1) * 3 + 1)} options={[{ value: '1', label: 'Q1 (Jan–Mar)' }, { value: '2', label: 'Q2 (Apr–Jun)' }, { value: '3', label: 'Q3 (Jul–Sep)' }, { value: '4', label: 'Q4 (Okt–Des)' }]} />}</>) : (<><Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></>)}
                <Autocomplete label="Wilayah" value={wilayahId} onChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }} options={wilayahList.map((w) => ({ value: w.id, label: w.name }))} emptyLabel="Semua wilayah" />
                <Autocomplete label="Provinsi" value={provinsiId} onChange={(v) => { setProvinsiId(v); setBranchId(''); }} options={provinsiList.filter((p) => !wilayahId || p.wilayah_id === wilayahId).map((p) => ({ value: p.id, label: p.name }))} emptyLabel="Semua provinsi" />
                <Autocomplete label="Cabang" value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))} emptyLabel="Semua cabang" />
                <Autocomplete label="Owner" value={ownerId} onChange={setOwnerId} options={owners.map((o) => ({ value: o.id, label: o.name }))} emptyLabel="Semua owner" />
                <Autocomplete label="Status Invoice" value={status} onChange={setStatus} options={Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))} emptyLabel="Semua status" />
                <Autocomplete label="Jenis Produk" value={productType} onChange={setProductType} options={Object.entries(PRODUCT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} emptyLabel="Semua produk" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Pendapatan" value={<NominalDisplay amount={data.total_revenue} currency="IDR" />} subtitle={data.total_revenue > 0 ? <>≈ <NominalDisplay amount={data.total_revenue / sarToIdr} currency="SAR" showCurrency={false} /> · ≈ <NominalDisplay amount={data.total_revenue / usdToIdr} currency="USD" showCurrency={false} /></> : 'Hanya invoice dengan pembayaran (bukan tagihan DP)'} />
                <StatCard icon={<Receipt className="w-5 h-5" />} label="Jumlah Invoice" value={data.invoice_count} subtitle="Dalam periode laporan (sudah ada pembayaran)" />
                <StatCard icon={data.invoice_count > 0 ? <TrendingUp className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />} label="Rata-rata per Invoice" value={data.invoice_count > 0 ? <NominalDisplay amount={data.total_revenue / data.invoice_count} currency="IDR" /> : '–'} subtitle={data.invoice_count > 0 ? <>≈ <NominalDisplay amount={(data.total_revenue / data.invoice_count) / sarToIdr} currency="SAR" showCurrency={false} /> · ≈ <NominalDisplay amount={(data.total_revenue / data.invoice_count) / usdToIdr} currency="USD" showCurrency={false} /></> : undefined} />
                <StatCard icon={<Calendar className="w-5 h-5" />} label="Periode" value={`${formatDate(data.period.start)} – ${formatDate(data.period.end)}`} />
                <StatCard icon={<MapPin className="w-5 h-5" />} label="Wilayah" value={(data.by_wilayah || []).length} subtitle="Wilayah dengan transaksi" />
                <StatCard icon={<Map className="w-5 h-5" />} label="Provinsi" value={(data.by_provinsi || []).length} subtitle="Provinsi dengan transaksi" />
                <StatCard icon={<Building2 className="w-5 h-5" />} label="Cabang" value={data.by_branch.length} subtitle="Cabang dengan transaksi" />
                <StatCard icon={<Users className="w-5 h-5" />} label="Owner" value={(data.by_owner || []).length} subtitle="Owner dengan transaksi" />
                {prevPeriod && (
                  <StatCard
                    icon={prevPeriod.growth_percent != null && parseFloat(prevPeriod.growth_percent) >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    label="Periode Sebelumnya"
                    value={<NominalDisplay amount={prevPeriod.revenue} currency="IDR" />}
                    subtitle={prevPeriod.invoice_count + ' invoice' + (prevPeriod.growth_percent != null ? ` · ${parseFloat(prevPeriod.growth_percent) >= 0 ? '+' : ''}${prevPeriod.growth_percent}% vs periode ini` : '')}
                  />
                )}
              </div>
            </Card>
          )}

          {activeTab === 'wilayah' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <StatCard icon={<MapPin className="w-5 h-5" />} label="Jumlah Wilayah" value={(data.by_wilayah || []).length} subtitle="Wilayah dengan transaksi" />
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Pendapatan" value={<NominalDisplay amount={data.total_revenue} currency="IDR" />} subtitle={(data.by_wilayah || []).length ? <>≈ <NominalDisplay amount={data.total_revenue / sarToIdr} currency="SAR" showCurrency={false} /> · <NominalDisplay amount={data.total_revenue / usdToIdr} currency="USD" showCurrency={false} /></> : undefined} />
                <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Invoice" value={(data.by_wilayah || []).reduce((s, w) => s + (w.invoice_count ?? 0), 0)} subtitle="Seluruh wilayah" />
                {(data.by_wilayah || []).length > 0 && (() => {
                  const top = [...(data.by_wilayah || [])].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];
                  return <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Wilayah Tertinggi" value={top?.wilayah_name || '–'} subtitle={top ? <NominalDisplay amount={top.revenue} currency="IDR" /> : undefined} />;
                })()}
              </div>
              <Card className="min-w-0">
              <CardSectionHeader icon={<Filter className="w-6 h-6" />} title="Filter Per Wilayah" subtitle="Periode laporan" right={null} className="mb-2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3 mb-3 pb-3 border-b border-slate-200 items-end">
                <Autocomplete label="Periode cepat" value={datePresetId} onChange={(v) => { const p = DATE_PRESETS.find((x) => x.id === v); if (p) applyPreset(p); else setDatePresetId(v || ''); }} options={DATE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} emptyLabel="Pilih periode" />
                <Autocomplete label="Jenis Periode" value={period} onChange={(v) => setPeriod(v as typeof period)} options={[{ value: 'month', label: 'Bulanan' }, { value: 'quarter', label: 'Triwulanan' }, { value: 'year', label: 'Tahunan' }, { value: 'custom', label: 'Rentang Tanggal' }]} />
                {period !== 'custom' ? (<><Input label="Tahun" type="number" value={String(year)} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} min={2020} max={2030} />{period === 'month' && <Autocomplete label="Bulan" value={String(month)} onChange={(v) => setMonth(parseInt(v, 10))} options={[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => ({ value: String(m), label: new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' }) }))} />}{period === 'quarter' && <Autocomplete label="Triwulan" value={String(Math.ceil(month / 3))} onChange={(v) => setMonth((parseInt(v, 10) - 1) * 3 + 1)} options={[{ value: '1', label: 'Q1 (Jan–Mar)' }, { value: '2', label: 'Q2 (Apr–Jun)' }, { value: '3', label: 'Q3 (Jul–Sep)' }, { value: '4', label: 'Q4 (Okt–Des)' }]} />}</>) : (<><Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></>)}
              </div>
              <CardSectionHeader
                icon={<MapPin className="w-6 h-6" />}
                title="Pendapatan per Wilayah"
                subtitle={`${(data.by_wilayah || []).length} wilayah`}
                className="mb-2"
              />
              <div className="min-w-0 overflow-x-auto">
              <Table
                columns={REPORT_TABLE_COLUMNS.wilayah}
                data={sortAndPaginate(data.by_wilayah || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'wilayah_name', revenueKey: 'revenue' }).rows}
                emptyMessage="Belum ada data"
                pagination={(data.by_wilayah || []).length > 0 ? {
                  total: (data.by_wilayah || []).length,
                  page: tablePage,
                  limit: tableLimit,
                  totalPages: Math.max(1, Math.ceil((data.by_wilayah || []).length / tableLimit)),
                  onPageChange: setTablePage,
                  onLimitChange: (l) => { setTableLimit(l); setTablePage(1); }
                } : undefined}
                renderRow={(row, idx) => (
                      <tr key={row.wilayah_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                    <td className="py-3 px-4 font-medium">{row.wilayah_name || row.wilayah_id || 'Lainnya'}</td>
                    <td className="py-3 px-4 text-right align-top">
                      <div><NominalDisplay amount={row.revenue} currency="IDR" /></div>
                      {(() => { const t = amountTriple(row.revenue); return <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div>; })()}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                    <td className="py-3 px-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                )}
              />
              </div>
            </Card>
            </>
          )}

          {activeTab === 'provinsi' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <StatCard icon={<Map className="w-5 h-5" />} label="Jumlah Provinsi" value={(data.by_provinsi || []).length} subtitle="Provinsi dengan transaksi" />
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Pendapatan" value={<NominalDisplay amount={data.total_revenue} currency="IDR" />} subtitle={(data.by_provinsi || []).length ? <>≈ <NominalDisplay amount={data.total_revenue / sarToIdr} currency="SAR" showCurrency={false} /> · <NominalDisplay amount={data.total_revenue / usdToIdr} currency="USD" showCurrency={false} /></> : undefined} />
                <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Invoice" value={(data.by_provinsi || []).reduce((s, p) => s + (p.invoice_count ?? 0), 0)} subtitle="Seluruh provinsi" />
                {(data.by_provinsi || []).length > 0 && (() => {
                  const top = [...(data.by_provinsi || [])].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];
                  return <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Provinsi Tertinggi" value={top?.provinsi_name || '–'} subtitle={top ? <NominalDisplay amount={top.revenue} currency="IDR" /> : undefined} />;
                })()}
              </div>
              <Card className="min-w-0">
              <CardSectionHeader icon={<Filter className="w-6 h-6" />} title="Filter Per Provinsi" subtitle="Periode & wilayah" right={null} className="mb-2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3 mb-3 pb-3 border-b border-slate-200 items-end">
                <Autocomplete label="Periode cepat" value={datePresetId} onChange={(v) => { const p = DATE_PRESETS.find((x) => x.id === v); if (p) applyPreset(p); else setDatePresetId(v || ''); }} options={DATE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} emptyLabel="Pilih periode" />
                <Autocomplete label="Jenis Periode" value={period} onChange={(v) => setPeriod(v as typeof period)} options={[{ value: 'month', label: 'Bulanan' }, { value: 'quarter', label: 'Triwulanan' }, { value: 'year', label: 'Tahunan' }, { value: 'custom', label: 'Rentang Tanggal' }]} />
                {period !== 'custom' ? (<><Input label="Tahun" type="number" value={String(year)} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} min={2020} max={2030} />{period === 'month' && <Autocomplete label="Bulan" value={String(month)} onChange={(v) => setMonth(parseInt(v, 10))} options={[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => ({ value: String(m), label: new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' }) }))} />}{period === 'quarter' && <Autocomplete label="Triwulan" value={String(Math.ceil(month / 3))} onChange={(v) => setMonth((parseInt(v, 10) - 1) * 3 + 1)} options={[{ value: '1', label: 'Q1 (Jan–Mar)' }, { value: '2', label: 'Q2 (Apr–Jun)' }, { value: '3', label: 'Q3 (Jul–Sep)' }, { value: '4', label: 'Q4 (Okt–Des)' }]} />}</>) : (<><Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></>)}
                <Autocomplete label="Wilayah" value={wilayahId} onChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }} options={wilayahList.map((w) => ({ value: w.id, label: w.name }))} emptyLabel="Semua wilayah" />
              </div>
              <CardSectionHeader
                icon={<Map className="w-6 h-6" />}
                title="Pendapatan per Provinsi"
                subtitle={`${(data.by_provinsi || []).length} provinsi`}
                className="mb-2"
              />
              <div className="min-w-0 overflow-x-auto">
              <Table
                columns={REPORT_TABLE_COLUMNS.provinsi}
                data={sortAndPaginate(data.by_provinsi || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'provinsi_name', revenueKey: 'revenue' }).rows}
                emptyMessage="Belum ada data"
                pagination={(data.by_provinsi || []).length > 0 ? {
                  total: (data.by_provinsi || []).length,
                  page: tablePage,
                  limit: tableLimit,
                  totalPages: Math.max(1, Math.ceil((data.by_provinsi || []).length / tableLimit)),
                  onPageChange: setTablePage,
                  onLimitChange: (l) => { setTableLimit(l); setTablePage(1); }
                } : undefined}
                renderRow={(row, idx) => (
                      <tr key={row.provinsi_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                    <td className="py-3 px-4 font-medium">{row.provinsi_name || row.provinsi_id || 'Lainnya'}</td>
                    <td className="py-3 px-4 text-right align-top">
                      <div><NominalDisplay amount={row.revenue} currency="IDR" /></div>
                      {(() => { const t = amountTriple(row.revenue); return <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div>; })()}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                    <td className="py-3 px-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                )}
              />
              </div>
            </Card>
            </>
          )}

          {activeTab === 'cabang' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <StatCard icon={<Building2 className="w-5 h-5" />} label="Jumlah Cabang" value={data.by_branch.length} subtitle="Cabang dengan transaksi" />
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Pendapatan" value={<NominalDisplay amount={data.total_revenue} currency="IDR" />} subtitle={data.by_branch.length ? <>≈ <NominalDisplay amount={data.total_revenue / sarToIdr} currency="SAR" showCurrency={false} /> · <NominalDisplay amount={data.total_revenue / usdToIdr} currency="USD" showCurrency={false} /></> : undefined} />
                <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Invoice" value={data.by_branch.reduce((s, b) => s + (b.invoice_count ?? 0), 0)} subtitle="Seluruh cabang" />
                {data.by_branch.length > 0 && (() => {
                  const top = [...data.by_branch].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];
                  return <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Cabang Tertinggi" value={top?.branch_name || '–'} subtitle={top ? <NominalDisplay amount={top.revenue} currency="IDR" /> : undefined} />;
                })()}
              </div>
              <Card className="min-w-0">
              <CardSectionHeader icon={<Filter className="w-6 h-6" />} title="Filter Per Cabang" subtitle="Periode & wilayah/provinsi" right={null} className="mb-2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3 mb-3 pb-3 border-b border-slate-200 items-end">
                <Autocomplete label="Periode cepat" value={datePresetId} onChange={(v) => { const p = DATE_PRESETS.find((x) => x.id === v); if (p) applyPreset(p); else setDatePresetId(v || ''); }} options={DATE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} emptyLabel="Pilih periode" />
                <Autocomplete label="Jenis Periode" value={period} onChange={(v) => setPeriod(v as typeof period)} options={[{ value: 'month', label: 'Bulanan' }, { value: 'quarter', label: 'Triwulanan' }, { value: 'year', label: 'Tahunan' }, { value: 'custom', label: 'Rentang Tanggal' }]} />
                {period !== 'custom' ? (<><Input label="Tahun" type="number" value={String(year)} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} min={2020} max={2030} />{period === 'month' && <Autocomplete label="Bulan" value={String(month)} onChange={(v) => setMonth(parseInt(v, 10))} options={[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => ({ value: String(m), label: new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' }) }))} />}{period === 'quarter' && <Autocomplete label="Triwulan" value={String(Math.ceil(month / 3))} onChange={(v) => setMonth((parseInt(v, 10) - 1) * 3 + 1)} options={[{ value: '1', label: 'Q1 (Jan–Mar)' }, { value: '2', label: 'Q2 (Apr–Jun)' }, { value: '3', label: 'Q3 (Jul–Sep)' }, { value: '4', label: 'Q4 (Okt–Des)' }]} />}</>) : (<><Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></>)}
                <Autocomplete label="Wilayah" value={wilayahId} onChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }} options={wilayahList.map((w) => ({ value: w.id, label: w.name }))} emptyLabel="Semua wilayah" />
                <Autocomplete label="Provinsi" value={provinsiId} onChange={(v) => { setProvinsiId(v); setBranchId(''); }} options={provinsiList.filter((p) => !wilayahId || p.wilayah_id === wilayahId).map((p) => ({ value: p.id, label: p.name }))} emptyLabel="Semua provinsi" />
              </div>
              <CardSectionHeader
                icon={<Building2 className="w-6 h-6" />}
                title="Pendapatan per Cabang"
                subtitle={`${(data.by_branch || []).length} cabang`}
                className="mb-2"
              />
              <div className="min-w-0 overflow-x-auto">
              <Table
                columns={REPORT_TABLE_COLUMNS.cabang}
                data={sortAndPaginate(data.by_branch || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'branch_name', revenueKey: 'revenue' }).rows}
                emptyMessage="Belum ada data"
                pagination={(data.by_branch || []).length > 0 ? {
                  total: (data.by_branch || []).length,
                  page: tablePage,
                  limit: tableLimit,
                  totalPages: Math.max(1, Math.ceil((data.by_branch || []).length / tableLimit)),
                  onPageChange: setTablePage,
                  onLimitChange: (l) => { setTableLimit(l); setTablePage(1); }
                } : undefined}
                renderRow={(row, idx) => (
                      <tr key={row.branch_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                    <td className="py-3 px-4 font-medium">{row.branch_name || row.branch_id || 'Lainnya'}</td>
                    <td className="py-3 px-4 text-right align-top">
                      <div><NominalDisplay amount={row.revenue} currency="IDR" /></div>
                      {(() => { const t = amountTriple(row.revenue); return <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div>; })()}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                    <td className="py-3 px-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                )}
              />
              </div>
            </Card>
            </>
          )}

          {activeTab === 'owner' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <StatCard icon={<Users className="w-5 h-5" />} label="Jumlah Owner" value={(data.by_owner || []).length} subtitle="Owner dengan transaksi" />
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Pendapatan" value={<NominalDisplay amount={data.total_revenue} currency="IDR" />} subtitle={(data.by_owner || []).length ? <>≈ <NominalDisplay amount={data.total_revenue / sarToIdr} currency="SAR" showCurrency={false} /> · <NominalDisplay amount={data.total_revenue / usdToIdr} currency="USD" showCurrency={false} /></> : undefined} />
                <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Invoice" value={(data.by_owner || []).reduce((s, o) => s + (o.invoice_count ?? 0), 0)} subtitle="Seluruh owner" />
                {(data.by_owner || []).length > 0 && (() => {
                  const top = [...(data.by_owner || [])].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];
                  return <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Owner Tertinggi" value={top?.owner_name || '–'} subtitle={top ? <NominalDisplay amount={top.revenue} currency="IDR" /> : undefined} />;
                })()}
              </div>
              <Card className="min-w-0">
              <CardSectionHeader icon={<Filter className="w-6 h-6" />} title="Filter Per Owner" subtitle="Periode & scope cabang" right={null} className="mb-2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3 mb-3 pb-3 border-b border-slate-200 items-end">
                <Autocomplete label="Periode cepat" value={datePresetId} onChange={(v) => { const p = DATE_PRESETS.find((x) => x.id === v); if (p) applyPreset(p); else setDatePresetId(v || ''); }} options={DATE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} emptyLabel="Pilih periode" />
                <Autocomplete label="Jenis Periode" value={period} onChange={(v) => setPeriod(v as typeof period)} options={[{ value: 'month', label: 'Bulanan' }, { value: 'quarter', label: 'Triwulanan' }, { value: 'year', label: 'Tahunan' }, { value: 'custom', label: 'Rentang Tanggal' }]} />
                {period !== 'custom' ? (<><Input label="Tahun" type="number" value={String(year)} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} min={2020} max={2030} />{period === 'month' && <Autocomplete label="Bulan" value={String(month)} onChange={(v) => setMonth(parseInt(v, 10))} options={[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => ({ value: String(m), label: new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' }) }))} />}{period === 'quarter' && <Autocomplete label="Triwulan" value={String(Math.ceil(month / 3))} onChange={(v) => setMonth((parseInt(v, 10) - 1) * 3 + 1)} options={[{ value: '1', label: 'Q1 (Jan–Mar)' }, { value: '2', label: 'Q2 (Apr–Jun)' }, { value: '3', label: 'Q3 (Jul–Sep)' }, { value: '4', label: 'Q4 (Okt–Des)' }]} />}</>) : (<><Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></>)}
                <Autocomplete label="Wilayah" value={wilayahId} onChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }} options={wilayahList.map((w) => ({ value: w.id, label: w.name }))} emptyLabel="Semua wilayah" />
                <Autocomplete label="Provinsi" value={provinsiId} onChange={(v) => { setProvinsiId(v); setBranchId(''); }} options={provinsiList.filter((p) => !wilayahId || p.wilayah_id === wilayahId).map((p) => ({ value: p.id, label: p.name }))} emptyLabel="Semua provinsi" />
                <Autocomplete label="Cabang" value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))} emptyLabel="Semua cabang" />
              </div>
              <CardSectionHeader
                icon={<Users className="w-6 h-6" />}
                title="Pendapatan per Owner"
                subtitle={`${(data.by_owner || []).length} owner`}
                className="mb-2"
              />
              <div className="min-w-0 overflow-x-auto">
              <Table
                columns={REPORT_TABLE_COLUMNS.owner}
                data={sortAndPaginate(data.by_owner || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'owner_name', revenueKey: 'revenue' }).rows}
                emptyMessage="Belum ada data"
                pagination={(data.by_owner || []).length > 0 ? {
                  total: (data.by_owner || []).length,
                  page: tablePage,
                  limit: tableLimit,
                  totalPages: Math.max(1, Math.ceil((data.by_owner || []).length / tableLimit)),
                  onPageChange: setTablePage,
                  onLimitChange: (l) => { setTableLimit(l); setTablePage(1); }
                } : undefined}
                renderRow={(row, idx) => (
                      <tr key={row.owner_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                    <td className="py-3 px-4 font-medium">{row.owner_name || row.owner_id || 'Lainnya'}</td>
                    <td className="py-3 px-4 text-right align-top">
                      <div><NominalDisplay amount={row.revenue} currency="IDR" /></div>
                      {(() => { const t = amountTriple(row.revenue); return <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div>; })()}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                    <td className="py-3 px-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                )}
              />
              </div>
            </Card>
            </>
          )}

          {activeTab === 'produk' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <StatCard icon={<Package className="w-5 h-5" />} label="Jenis Produk" value={(data.by_product_type || []).length} subtitle="Jenis dengan transaksi" />
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Pendapatan" value={<NominalDisplay amount={data.total_revenue} currency="IDR" />} subtitle={(data.by_product_type || []).length ? <>≈ <NominalDisplay amount={data.total_revenue / sarToIdr} currency="SAR" showCurrency={false} /> · <NominalDisplay amount={data.total_revenue / usdToIdr} currency="USD" showCurrency={false} /></> : undefined} />
                {(data.by_product_type || []).length > 0 && (() => {
                  const top = [...(data.by_product_type || [])].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];
                  return <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Produk Tertinggi" value={top ? (PRODUCT_TYPE_LABELS[top.type] || top.type) : '–'} subtitle={top ? <NominalDisplay amount={top.revenue} currency="IDR" /> : undefined} />;
                })()}
              </div>
              <Card className="min-w-0">
              <CardSectionHeader icon={<Filter className="w-6 h-6" />} title="Filter Per Produk" subtitle="Periode laporan" right={null} className="mb-2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3 mb-3 pb-3 border-b border-slate-200 items-end">
                <Autocomplete label="Periode cepat" value={datePresetId} onChange={(v) => { const p = DATE_PRESETS.find((x) => x.id === v); if (p) applyPreset(p); else setDatePresetId(v || ''); }} options={DATE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} emptyLabel="Pilih periode" />
                <Autocomplete label="Jenis Periode" value={period} onChange={(v) => setPeriod(v as typeof period)} options={[{ value: 'month', label: 'Bulanan' }, { value: 'quarter', label: 'Triwulanan' }, { value: 'year', label: 'Tahunan' }, { value: 'custom', label: 'Rentang Tanggal' }]} />
                {period !== 'custom' ? (<><Input label="Tahun" type="number" value={String(year)} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} min={2020} max={2030} />{period === 'month' && <Autocomplete label="Bulan" value={String(month)} onChange={(v) => setMonth(parseInt(v, 10))} options={[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => ({ value: String(m), label: new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' }) }))} />}{period === 'quarter' && <Autocomplete label="Triwulan" value={String(Math.ceil(month / 3))} onChange={(v) => setMonth((parseInt(v, 10) - 1) * 3 + 1)} options={[{ value: '1', label: 'Q1 (Jan–Mar)' }, { value: '2', label: 'Q2 (Apr–Jun)' }, { value: '3', label: 'Q3 (Jul–Sep)' }, { value: '4', label: 'Q4 (Okt–Des)' }]} />}</>) : (<><Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></>)}
              </div>
              <CardSectionHeader
                icon={<Package className="w-6 h-6" />}
                title="Pendapatan per Jenis Produk"
                subtitle={`${(data.by_product_type || []).length} jenis produk`}
                className="mb-2"
              />
              <div className="min-w-0 overflow-x-auto">
              <Table
                columns={REPORT_TABLE_COLUMNS.produk}
                data={sortAndPaginate(data.by_product_type || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'type', revenueKey: 'revenue' }).rows}
                emptyMessage="Belum ada data"
                pagination={(data.by_product_type || []).length > 0 ? {
                  total: (data.by_product_type || []).length,
                  page: tablePage,
                  limit: tableLimit,
                  totalPages: Math.max(1, Math.ceil((data.by_product_type || []).length / tableLimit)),
                  onPageChange: setTablePage,
                  onLimitChange: (l) => { setTableLimit(l); setTablePage(1); }
                } : undefined}
                renderRow={(row, idx) => {
                  const invList = data.invoices_by_product_type?.[row.type] ?? [];
                  const canView = (row.revenue ?? 0) > 0 && invList.length > 0;
                  return (
                      <tr key={row.type} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                    <td className="py-3 px-4 font-medium">{PRODUCT_TYPE_LABELS[row.type] || row.type}</td>
                    <td className="py-3 px-4 text-right align-top">
                      <div><NominalDisplay amount={row.revenue} currency="IDR" /></div>
                      {(() => { const t = amountTriple(row.revenue); return <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div>; })()}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                    <td className="py-3 px-4 text-center">
                      {canView ? (
                        <button
                          type="button"
                          onClick={() => setProductInvoiceModalType(row.type)}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-[#0D1A63] transition-colors"
                          title="Lihat invoice"
                          aria-label={`Lihat daftar invoice ${PRODUCT_TYPE_LABELS[row.type] || row.type}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                      </tr>
                  );
                }}
              />
              </div>
            </Card>
            </>
          )}

          {activeTab === 'periode' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <StatCard icon={<Calendar className="w-5 h-5" />} label="Jumlah Periode" value={(data.by_period || []).length} subtitle="Bulan dalam laporan" />
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Pendapatan" value={<NominalDisplay amount={data.total_revenue} currency="IDR" />} subtitle={(data.by_period || []).length ? <>≈ <NominalDisplay amount={data.total_revenue / sarToIdr} currency="SAR" showCurrency={false} /> · <NominalDisplay amount={data.total_revenue / usdToIdr} currency="USD" showCurrency={false} /></> : undefined} />
                <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Invoice" value={(data.by_period || []).reduce((s, p) => s + (p.invoice_count ?? 0), 0)} subtitle="Seluruh periode" />
                {(data.by_period || []).length > 0 && (() => {
                  const top = [...(data.by_period || [])].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];
                  return <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Bulan Tertinggi" value={top ? formatPeriodLabel(top.period) : '–'} subtitle={top ? <NominalDisplay amount={top.revenue} currency="IDR" /> : undefined} />;
                })()}
              </div>
              <Card className="min-w-0">
              <CardSectionHeader icon={<Filter className="w-6 h-6" />} title="Filter Per Bulan" subtitle="Periode laporan" right={null} className="mb-2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3 mb-3 pb-3 border-b border-slate-200 items-end">
                <Autocomplete label="Periode cepat" value={datePresetId} onChange={(v) => { const p = DATE_PRESETS.find((x) => x.id === v); if (p) applyPreset(p); else setDatePresetId(v || ''); }} options={DATE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} emptyLabel="Pilih periode" />
                <Autocomplete label="Jenis Periode" value={period} onChange={(v) => setPeriod(v as typeof period)} options={[{ value: 'month', label: 'Bulanan' }, { value: 'quarter', label: 'Triwulanan' }, { value: 'year', label: 'Tahunan' }, { value: 'custom', label: 'Rentang Tanggal' }]} />
                {period !== 'custom' ? (<><Input label="Tahun" type="number" value={String(year)} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} min={2020} max={2030} />{period === 'month' && <Autocomplete label="Bulan" value={String(month)} onChange={(v) => setMonth(parseInt(v, 10))} options={[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => ({ value: String(m), label: new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' }) }))} />}{period === 'quarter' && <Autocomplete label="Triwulan" value={String(Math.ceil(month / 3))} onChange={(v) => setMonth((parseInt(v, 10) - 1) * 3 + 1)} options={[{ value: '1', label: 'Q1 (Jan–Mar)' }, { value: '2', label: 'Q2 (Apr–Jun)' }, { value: '3', label: 'Q3 (Jul–Sep)' }, { value: '4', label: 'Q4 (Okt–Des)' }]} />}</>) : (<><Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></>)}
              </div>
              <CardSectionHeader
                icon={<Calendar className="w-6 h-6" />}
                title="Pendapatan per Bulan"
                subtitle={`${(data.by_period || []).length} periode`}
                className="mb-2"
              />
              <div className="min-w-0 overflow-x-auto">
              <Table
                columns={REPORT_TABLE_COLUMNS.periode}
                data={sortAndPaginate(data.by_period || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'period', revenueKey: 'revenue' }).rows}
                emptyMessage="Belum ada data"
                pagination={(data.by_period || []).length > 0 ? {
                  total: (data.by_period || []).length,
                  page: tablePage,
                  limit: tableLimit,
                  totalPages: Math.max(1, Math.ceil((data.by_period || []).length / tableLimit)),
                  onPageChange: setTablePage,
                  onLimitChange: (l) => { setTableLimit(l); setTablePage(1); }
                } : undefined}
                renderRow={(row, idx) => (
                      <tr key={row.period} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                    <td className="py-3 px-4 font-medium">{formatPeriodLabel(row.period)}</td>
                    <td className="py-3 px-4 text-right align-top">
                      <div><NominalDisplay amount={row.revenue} currency="IDR" /></div>
                      {(() => { const t = amountTriple(row.revenue); return <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div>; })()}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                    <td className="py-3 px-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                )}
              />
              </div>
            </Card>
            </>
          )}

          {activeTab === 'detail' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <StatCard icon={<List className="w-5 h-5" />} label="Jumlah Invoice" value={pagination.total} subtitle="Dalam filter periode & filter lain" />
                <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Pendapatan" value={<NominalDisplay amount={data.total_revenue} currency="IDR" />} subtitle={pagination.total > 0 ? <>≈ <NominalDisplay amount={data.total_revenue / sarToIdr} currency="SAR" showCurrency={false} /> · <NominalDisplay amount={data.total_revenue / usdToIdr} currency="USD" showCurrency={false} /></> : undefined} />
                <StatCard icon={pagination.total > 0 ? <TrendingUp className="w-5 h-5" /> : <Receipt className="w-5 h-5" />} label="Rata-rata per Invoice" value={pagination.total > 0 ? <NominalDisplay amount={data.total_revenue / pagination.total} currency="IDR" /> : '–'} subtitle={pagination.total > 0 ? <>≈ <NominalDisplay amount={(data.total_revenue / pagination.total) / sarToIdr} currency="SAR" showCurrency={false} /> · <NominalDisplay amount={(data.total_revenue / pagination.total) / usdToIdr} currency="USD" showCurrency={false} /></> : undefined} />
                <StatCard icon={<FileText className="w-5 h-5" />} label="Periode" value={`${formatDate(data.period.start)} – ${formatDate(data.period.end)}`} subtitle="Rentang laporan" />
              </div>
              <Card className="min-w-0">
              <CardSectionHeader icon={<Filter className="w-6 h-6" />} title="Filter Detail Invoice" subtitle="Periode, lokasi, status, cari & rentang pendapatan" right={null} className="mb-2" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-3 mb-3 pb-3 border-b border-slate-200 items-end">
                <Autocomplete label="Periode cepat" value={datePresetId} onChange={(v) => { const p = DATE_PRESETS.find((x) => x.id === v); if (p) applyPreset(p); else setDatePresetId(v || ''); }} options={DATE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} emptyLabel="Pilih periode" />
                <Autocomplete label="Jenis Periode" value={period} onChange={(v) => setPeriod(v as typeof period)} options={[{ value: 'month', label: 'Bulanan' }, { value: 'quarter', label: 'Triwulanan' }, { value: 'year', label: 'Tahunan' }, { value: 'custom', label: 'Rentang Tanggal' }]} />
                {period !== 'custom' ? (<><Input label="Tahun" type="number" value={String(year)} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} min={2020} max={2030} />{period === 'month' && <Autocomplete label="Bulan" value={String(month)} onChange={(v) => setMonth(parseInt(v, 10))} options={[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => ({ value: String(m), label: new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' }) }))} />}{period === 'quarter' && <Autocomplete label="Triwulan" value={String(Math.ceil(month / 3))} onChange={(v) => setMonth((parseInt(v, 10) - 1) * 3 + 1)} options={[{ value: '1', label: 'Q1 (Jan–Mar)' }, { value: '2', label: 'Q2 (Apr–Jun)' }, { value: '3', label: 'Q3 (Jul–Sep)' }, { value: '4', label: 'Q4 (Okt–Des)' }]} />}</>) : (<><Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></>)}
                <Autocomplete label="Wilayah" value={wilayahId} onChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }} options={wilayahList.map((w) => ({ value: w.id, label: w.name }))} emptyLabel="Semua wilayah" />
                <Autocomplete label="Provinsi" value={provinsiId} onChange={(v) => { setProvinsiId(v); setBranchId(''); }} options={provinsiList.filter((p) => !wilayahId || p.wilayah_id === wilayahId).map((p) => ({ value: p.id, label: p.name }))} emptyLabel="Semua provinsi" />
                <Autocomplete label="Cabang" value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))} emptyLabel="Semua cabang" />
                <Autocomplete label="Owner" value={ownerId} onChange={setOwnerId} options={owners.map((o) => ({ value: o.id, label: o.name }))} emptyLabel="Semua owner" />
                <Autocomplete label="Status Invoice" value={status} onChange={setStatus} options={Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))} emptyLabel="Semua status" />
                <Autocomplete label="Jenis Produk" value={productType} onChange={setProductType} options={Object.entries(PRODUCT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} emptyLabel="Semua produk" />
                <div className="sm:col-span-2"><Input label="Cari" type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice / Order / Owner" icon={<Search className="w-4 h-4" />} /></div>
                <Input label="Min. Pendapatan (Rp)" type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" min={0} />
                <Input label="Maks. Pendapatan (Rp)" type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="0" min={0} />
              </div>
              <CardSectionHeader
                icon={<List className="w-6 h-6" />}
                title="Detail Invoice"
                subtitle={`${pagination.total} invoice`}
                right={
                  <div className="flex flex-wrap items-center gap-2">
                    <Autocomplete
                      value={sortBy}
                      onChange={(v) => { setSortBy(v); setPage(1); }}
                      options={[
                        { value: 'issued_at', label: 'Urut: Tanggal' },
                        { value: 'total_amount', label: 'Urut: Total' },
                        { value: 'paid_amount', label: 'Urut: Dibayar' },
                        { value: 'invoice_number', label: 'Urut: No. Invoice' }
                      ]}
                      fullWidth={false}
                      className="min-w-[160px]"
                    />
                    <Autocomplete
                      value={sortOrder}
                      onChange={(v) => { setSortOrder(v as 'asc' | 'desc'); setPage(1); }}
                      options={[
                        { value: 'desc', label: 'Terbaru dulu' },
                        { value: 'asc', label: 'Terlama dulu' }
                      ]}
                      fullWidth={false}
                      className="min-w-[140px]"
                    />
                  </div>
                }
                className="mb-2"
              />
              <div className="min-w-0 overflow-x-auto">
              <Table
                columns={REPORT_TABLE_COLUMNS.detail}
                data={data.invoices || []}
                emptyMessage="Belum ada data"
                stickyActionsColumn
                pagination={pagination.total > 0 ? {
                  total: pagination.total,
                  page,
                  limit,
                  totalPages: pagination.totalPages,
                  onPageChange: setPage,
                  onLimitChange: (l) => { setLimit(l); setPage(1); }
                } : undefined}
                renderRow={(inv) => {
                  const row = inv as typeof inv & { company_name?: string; wilayah_name?: string; provinsi_name?: string; city?: string; created_at?: string; order_updated_at?: string };
                  const invWithOrderUpdated = { ...inv, order_updated_at: row.order_updated_at };
                  const perusahaanLine2 = [row.wilayah_name, row.provinsi_name, row.city].filter(Boolean).join(' · ') || '–';
                  return (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 align-top">
                      <InvoiceNumberCell inv={invWithOrderUpdated} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan />
                    </td>
                    <td className="py-3 px-4 align-top">{inv.owner_name || '-'}</td>
                    <td className="py-3 px-4 align-top text-sm">
                      <div>{row.company_name || inv.owner_name || inv.branch_name || '–'}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{perusahaanLine2}</div>
                    </td>
                    <td className="py-3 px-4 text-right align-top">
                      <div><NominalDisplay amount={Number(inv.total_amount) || 0} currency="IDR" /></div>
                      {(() => { const t = amountTriple(Number(inv.total_amount) || 0); return <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div>; })()}
                    </td>
                    <td className="py-3 px-4 text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={getEffectiveInvoiceStatusBadgeVariant(inv as InvoiceForStatusRefund)} className="text-xs">
                          {getEffectiveInvoiceStatusLabel(inv as InvoiceForStatusRefund)}
                        </Badge>
                        {(() => {
                          const st = (inv.status || '').toLowerCase();
                          const totalInv = Number(inv.total_amount) || 0;
                          const paid = Number(inv.paid_amount) || 0;
                          const refundAmt = Number((inv as any).cancelled_refund_amount) || 0;
                          const pctPaid = totalInv > 0 ? Math.round((paid / totalInv) * 100) : null;
                          const pctRefund = totalInv > 0 && refundAmt > 0 ? Math.round((refundAmt / totalInv) * 100) : null;
                          const isCancelNoPayment = (st === 'canceled' || st === 'cancelled') && paid <= 0;
                          if (st === 'draft') return <><span className="text-slate-400 text-sm">–</span>{pctPaid != null && <div className="text-xs text-slate-500 mt-0.5">{pctPaid}% dari total tagihan</div>}</>;
                          if (isCancelNoPayment) return <><span className="text-slate-400 text-sm">–</span>{pctPaid != null && <div className="text-xs text-slate-500 mt-0.5">{pctPaid}% dari total tagihan</div>}</>;
                          if (st === 'cancelled_refund' && refundAmt > 0) {
                            const t = amountTriple(refundAmt);
                            return <><div className="text-amber-700 font-medium text-sm">Refund: <NominalDisplay amount={refundAmt} currency="IDR" /></div><div className="text-xs text-slate-500"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div>{pctRefund != null && <div className="text-xs text-slate-600 mt-0.5">{pctRefund}% dari total tagihan</div>}</>;
                          }
                          const t = amountTriple(paid);
                          return <><div className="text-emerald-600 font-medium"><NominalDisplay amount={paid} currency="IDR" /></div><div className="text-xs text-slate-500"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div>{pctPaid != null && <div className="text-xs text-slate-600 mt-0.5">{pctPaid}% dari total tagihan</div>}</>;
                        })()}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right align-top">
                      {(() => {
                        const rem = getDisplayRemaining(inv);
                        const t = amountTriple(rem);
                        return <><div><NominalDisplay amount={rem} currency="IDR" /></div><div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div></>;
                      })()}
                    </td>
                    <td className="py-3 px-4 align-top">{formatDate(inv.issued_at ?? null)}</td>
                    <td className="py-3 px-4 align-top">
                      <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/orders-invoices' + (inv.invoice_number ? '?invoice_number=' + encodeURIComponent(inv.invoice_number) : ''))}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                  );
                }}
              />
              </div>
            </Card>
            </>
          )}
        </>
      ) : null}
      </Card>

      {productInvoiceModalType && data ? (
        <Modal open onClose={() => setProductInvoiceModalType(null)}>
          <ModalBoxLg className="!max-w-5xl">
            <ModalHeader
              title={`Invoice — ${PRODUCT_TYPE_LABELS[productInvoiceModalType] || productInvoiceModalType}`}
              subtitle={`${(data.invoices_by_product_type?.[productInvoiceModalType] ?? []).length} invoice dalam filter laporan`}
              icon={<Eye className="w-5 h-5" />}
              onClose={() => setProductInvoiceModalType(null)}
            />
            <ModalBody className="p-4 sm:p-6 overflow-y-auto flex-1 max-h-[75vh]">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-[1]">
                    <tr>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">No</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">No. Invoice</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">Owner</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">Cabang</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700">Tanggal</th>
                      <th className="text-right py-3 px-3 font-semibold text-slate-700">Alokasi produk</th>
                      <th className="text-right py-3 px-3 font-semibold text-slate-700">Dibayar (inv.)</th>
                      <th className="text-left py-3 px-3 font-semibold text-slate-700 min-w-[12rem]">Rincian item</th>
                      <th className="text-center py-3 px-3 font-semibold text-slate-700 w-[4.5rem]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {(data.invoices_by_product_type?.[productInvoiceModalType] ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          Tidak ada invoice untuk jenis ini pada filter saat ini.
                        </td>
                      </tr>
                    ) : (
                      (data.invoices_by_product_type?.[productInvoiceModalType] ?? []).map((row, i) => {
                        const trip = amountTriple(Number(row.allocated_revenue) || 0);
                        const lineSummary = (row.lines || [])
                          .map((l) => {
                            const lbl = (l.label || '').trim();
                            const tlab = PRODUCT_TYPE_LABELS[l.type] || l.type;
                            return lbl ? `${tlab}: ${lbl}` : tlab;
                          })
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <tr key={row.invoice_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/90 align-top">
                            <td className="py-3 px-3 text-slate-600 tabular-nums">{i + 1}</td>
                            <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">{row.invoice_number}</td>
                            <td className="py-3 px-3 max-w-[10rem]">{row.owner_name || '–'}</td>
                            <td className="py-3 px-3 max-w-[10rem] text-slate-700">{row.branch_name || '–'}</td>
                            <td className="py-3 px-3 whitespace-nowrap text-slate-700">{formatDate(row.issued_at ?? null)}</td>
                            <td className="py-3 px-3 text-right">
                              <div><NominalDisplay amount={Number(row.allocated_revenue) || 0} currency="IDR" /></div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                <span className="text-slate-400">SAR</span>{' '}
                                <NominalDisplay amount={trip.sar} currency="SAR" showCurrency={false} />{' '}
                                <span className="text-slate-400 ml-1">USD</span>{' '}
                                <NominalDisplay amount={trip.usd} currency="USD" showCurrency={false} />
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums">
                              <NominalDisplay amount={Number(row.invoice_paid_amount) || 0} currency="IDR" />
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600 max-w-md">
                              <span className="line-clamp-3" title={lineSummary}>{lineSummary || '–'}</span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  navigate(
                                    '/dashboard/orders-invoices' +
                                      (row.invoice_number ? '?invoice_number=' + encodeURIComponent(row.invoice_number) : '')
                                  )
                                }
                                aria-label="Buka halaman order & invoice"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </ModalBody>
          </ModalBoxLg>
        </Modal>
      ) : null}
    </div>
  );
};

export default AccountingFinancialReportPage;
