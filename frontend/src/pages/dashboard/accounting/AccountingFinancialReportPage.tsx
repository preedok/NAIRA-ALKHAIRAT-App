import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Filter, Download, RefreshCw, BarChart3, Users, Building2, Package, List, ExternalLink, TrendingUp, TrendingDown, Search, Calendar, MapPin, Map, ArrowUpDown, ArrowUp, ArrowDown, Receipt } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import PageFilter from '../../../components/common/PageFilter';
import { FilterIconButton, StatCard, Input, Autocomplete } from '../../../components/common';
import TablePagination from '../../../components/common/TablePagination';
import { accountingApi, branchesApi, type AccountingFinancialReportData } from '../../../services/api';
import { formatIDR } from '../../../utils';
import { formatInvoiceDisplay } from '../../../utils';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';

type ReportTab = 'ringkasan' | 'wilayah' | 'provinsi' | 'cabang' | 'owner' | 'produk' | 'periode' | 'detail';

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel',
  visa: 'Visa',
  ticket: 'Tiket',
  bus: 'Bus',
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

const SortableTh: React.FC<{ label: string; sortKey: SortKey; currentSort: SortKey; sortOrder: 'asc' | 'desc'; onClick: () => void }> = ({ label, sortKey, currentSort, sortOrder, onClick }) => (
  <th className="pb-2 pr-4 cursor-pointer hover:bg-slate-100 select-none" onClick={onClick}>
    <span className="flex items-center gap-1">
      {label}
      {currentSort === sortKey ? (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />}
    </span>
  </th>
);

const AccountingFinancialReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AccountingFinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'custom'>('month');
  const [year, setYear] = useState(new Date().getFullYear());
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
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>('ringkasan');
  const [exporting, setExporting] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tableLimit, setTableLimit] = useState(25);
  const [tableSortKey, setTableSortKey] = useState<SortKey>('revenue');
  const [tableSortOrder, setTableSortOrder] = useState<'asc' | 'desc'>('desc');
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    <div className="space-y-6">
      <PageHeader
        title="Laporan Keuangan"
        subtitle="Pendapatan per wilayah, provinsi, cabang, owner, dan jenis produk"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" size="sm" onClick={fetchReport} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <FilterIconButton open={showFilters} onToggle={() => setShowFilters((v: boolean) => !v)} hasActiveFilters={hasActiveFilters} />
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

      <PageFilter
        open={showFilters}
        onToggle={() => setShowFilters((v: boolean) => !v)}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        onApply={() => { setShowFilters(false); fetchReport(); }}
        loading={loading}
        applyLabel="Terapkan"
        hideToggleRow
      >
          <div className="flex flex-wrap gap-2 mb-4">
            {DATE_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => applyPreset(p)} className="px-3 py-1.5 text-sm rounded-lg bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300">
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <Autocomplete
              label="Wilayah"
              value={wilayahId}
              onChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }}
              options={wilayahList.map((w) => ({ value: w.id, label: w.name }))}
              emptyLabel="Semua wilayah"
            />
            <Autocomplete
              label="Provinsi"
              value={provinsiId}
              onChange={(v) => { setProvinsiId(v); setBranchId(''); }}
              options={provinsiList.filter((p) => !wilayahId || p.wilayah_id === wilayahId).map((p) => ({ value: p.id, label: p.name }))}
              emptyLabel="Semua provinsi"
            />
            <Autocomplete
              label="Cabang"
              value={branchId}
              onChange={setBranchId}
              options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
              emptyLabel="Semua cabang"
            />
            <Autocomplete
              label="Owner"
              value={ownerId}
              onChange={setOwnerId}
              options={owners.map((o) => ({ value: o.id, label: o.name }))}
              emptyLabel="Semua owner"
            />
            <Autocomplete
              label="Status Invoice"
              value={status}
              onChange={setStatus}
              options={Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              emptyLabel="Semua status"
            />
            <Autocomplete
              label="Jenis Produk"
              value={productType}
              onChange={setProductType}
              options={Object.entries(PRODUCT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              emptyLabel="Semua produk"
            />
            <div className="sm:col-span-2">
              <Input
                label="Cari (Invoice / Order / Owner)"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="No. invoice atau nama owner..."
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Input
              label="Min. Pendapatan (Rp)"
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="0"
              min={0}
            />
            <Input
              label="Maks. Pendapatan (Rp)"
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="0"
              min={0}
            />
            <Autocomplete
              label="Jenis Periode"
              value={period}
              onChange={(v) => setPeriod(v as typeof period)}
              options={[
                { value: 'month', label: 'Bulanan' },
                { value: 'quarter', label: 'Triwulanan' },
                { value: 'year', label: 'Tahunan' },
                { value: 'custom', label: 'Rentang Tanggal' }
              ]}
            />
            {period !== 'custom' ? (
              <>
                <Input
                  label="Tahun"
                  type="number"
                  value={String(year)}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
                  min={2020}
                  max={2030}
                />
                {period === 'month' && (
                  <Autocomplete
                    label="Bulan"
                    value={String(month)}
                    onChange={(v) => setMonth(parseInt(v, 10))}
                    options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
                      value: String(m),
                      label: new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' })
                    }))}
                  />
                )}
                {period === 'quarter' && (
                  <Autocomplete
                    label="Triwulan"
                    value={String(Math.ceil(month / 3))}
                    onChange={(v) => setMonth((parseInt(v, 10) - 1) * 3 + 1)}
                    options={[
                      { value: '1', label: 'Q1 (Jan–Mar)' },
                      { value: '2', label: 'Q2 (Apr–Jun)' },
                      { value: '3', label: 'Q3 (Jul–Sep)' },
                      { value: '4', label: 'Q4 (Okt–Des)' }
                    ]}
                  />
                )}
              </>
            ) : (
              <>
                <Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </>
            )}
          </div>
      </PageFilter>

      {loading && !data && <div className="text-center py-12 text-slate-500">Memuat...</div>}

      {!loading && !data && (
        <Card className="bg-slate-50 border-slate-200">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {fetchError ? 'Gagal memuat laporan' : 'Tidak ada data'}
            </h3>
            <p className="text-slate-500 max-w-md mx-auto mb-4">
              {fetchError || 'Tidak ada data laporan keuangan untuk periode dan filter yang dipilih. Coba ubah periode (mis. Bulan ini / Tahun ini) atau reset filter.'}
            </p>
            <Button variant="primary" onClick={fetchReport}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Muat ulang
            </Button>
          </div>
        </Card>
      )}

      {data && (
        <>
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setTablePage(1); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'ringkasan' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={<FileText className="w-5 h-5" />} label="Total Pendapatan" value={formatIDR(data.total_revenue)} subtitle="Dari pembayaran terverifikasi" />
                <StatCard icon={<Receipt className="w-5 h-5" />} label="Jumlah Invoice" value={data.invoice_count} subtitle="Dalam periode laporan" />
                <StatCard icon={<Calendar className="w-5 h-5" />} label="Periode" value={`${formatDate(data.period.start)} – ${formatDate(data.period.end)}`} />
                <StatCard icon={<Building2 className="w-5 h-5" />} label="Cabang" value={data.by_branch.length} subtitle="Cabang dengan transaksi" />
                {prevPeriod && (
                  <StatCard
                    icon={prevPeriod.growth_percent != null && parseFloat(prevPeriod.growth_percent) >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    label="Periode Sebelumnya"
                    value={formatIDR(prevPeriod.revenue)}
                    subtitle={prevPeriod.invoice_count + ' invoice' + (prevPeriod.growth_percent != null ? ` · ${parseFloat(prevPeriod.growth_percent) >= 0 ? '+' : ''}${prevPeriod.growth_percent}% vs periode ini` : '')}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'wilayah' && (
            <Card>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-emerald-600" /> Pendapatan per Wilayah</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">No</th>
                    <SortableTh label="Wilayah" sortKey="name" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('name'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <SortableTh label="Pendapatan" sortKey="revenue" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('revenue'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <th className="pb-2 pr-4 text-right">%</th>
                    <SortableTh label="Invoice" sortKey="count" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('count'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                  </tr></thead>
                  <tbody>
                    {sortAndPaginate(data.by_wilayah || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'wilayah_name', revenueKey: 'revenue' }).rows.map((row, idx) => (
                      <tr key={row.wilayah_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 pr-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                        <td className="py-3 pr-4 font-medium">{row.wilayah_name || row.wilayah_id || 'Lainnya'}</td>
                        <td className="py-3 pr-4 text-right">{formatIDR(row.revenue)}</td>
                        <td className="py-3 pr-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                        <td className="py-3 pr-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data.by_wilayah || []).length === 0 && <p className="text-slate-500 py-8 text-center">Belum ada data</p>}
              {(data.by_wilayah || []).length > 0 && (
                <TablePagination total={(data.by_wilayah || []).length} page={tablePage} limit={tableLimit} onPageChange={setTablePage} onLimitChange={(l) => { setTableLimit(l); setTablePage(1); }} loading={loading} />
              )}
            </Card>
          )}

          {activeTab === 'provinsi' && (
            <Card>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Map className="w-5 h-5 text-emerald-600" /> Pendapatan per Provinsi</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">No</th>
                    <SortableTh label="Provinsi" sortKey="name" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('name'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <SortableTh label="Pendapatan" sortKey="revenue" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('revenue'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <th className="pb-2 pr-4 text-right">%</th>
                    <SortableTh label="Invoice" sortKey="count" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('count'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                  </tr></thead>
                  <tbody>
                    {sortAndPaginate(data.by_provinsi || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'provinsi_name', revenueKey: 'revenue' }).rows.map((row, idx) => (
                      <tr key={row.provinsi_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 pr-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                        <td className="py-3 pr-4 font-medium">{row.provinsi_name || row.provinsi_id || 'Lainnya'}</td>
                        <td className="py-3 pr-4 text-right">{formatIDR(row.revenue)}</td>
                        <td className="py-3 pr-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                        <td className="py-3 pr-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data.by_provinsi || []).length === 0 && <p className="text-slate-500 py-8 text-center">Belum ada data</p>}
              {(data.by_provinsi || []).length > 0 && (
                <TablePagination total={(data.by_provinsi || []).length} page={tablePage} limit={tableLimit} onPageChange={setTablePage} onLimitChange={(l) => { setTableLimit(l); setTablePage(1); }} loading={loading} />
              )}
            </Card>
          )}

          {activeTab === 'cabang' && (
            <Card>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-emerald-600" /> Pendapatan per Cabang</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">No</th>
                    <SortableTh label="Cabang" sortKey="name" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('name'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <SortableTh label="Pendapatan" sortKey="revenue" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('revenue'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <th className="pb-2 pr-4 text-right">%</th>
                    <SortableTh label="Invoice" sortKey="count" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('count'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                  </tr></thead>
                  <tbody>
                    {sortAndPaginate(data.by_branch || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'branch_name', revenueKey: 'revenue' }).rows.map((row, idx) => (
                      <tr key={row.branch_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 pr-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                        <td className="py-3 pr-4 font-medium">{row.branch_name || row.branch_id || 'Lainnya'}</td>
                        <td className="py-3 pr-4 text-right">{formatIDR(row.revenue)}</td>
                        <td className="py-3 pr-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                        <td className="py-3 pr-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data.by_branch || []).length === 0 && <p className="text-slate-500 py-8 text-center">Belum ada data</p>}
              {(data.by_branch || []).length > 0 && (
                <TablePagination total={(data.by_branch || []).length} page={tablePage} limit={tableLimit} onPageChange={setTablePage} onLimitChange={(l) => { setTableLimit(l); setTablePage(1); }} loading={loading} />
              )}
            </Card>
          )}

          {activeTab === 'owner' && (
            <Card>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-emerald-600" /> Pendapatan per Owner</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">No</th>
                    <SortableTh label="Owner / Partner" sortKey="name" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('name'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <SortableTh label="Pendapatan" sortKey="revenue" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('revenue'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <th className="pb-2 pr-4 text-right">%</th>
                    <SortableTh label="Invoice" sortKey="count" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('count'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                  </tr></thead>
                  <tbody>
                    {sortAndPaginate(data.by_owner || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'owner_name', revenueKey: 'revenue' }).rows.map((row, idx) => (
                      <tr key={row.owner_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 pr-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                        <td className="py-3 pr-4 font-medium">{row.owner_name || row.owner_id || 'Lainnya'}</td>
                        <td className="py-3 pr-4 text-right">{formatIDR(row.revenue)}</td>
                        <td className="py-3 pr-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                        <td className="py-3 pr-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data.by_owner || []).length === 0 && <p className="text-slate-500 py-8 text-center">Belum ada data</p>}
              {(data.by_owner || []).length > 0 && (
                <TablePagination total={(data.by_owner || []).length} page={tablePage} limit={tableLimit} onPageChange={setTablePage} onLimitChange={(l) => { setTableLimit(l); setTablePage(1); }} loading={loading} />
              )}
            </Card>
          )}

          {activeTab === 'produk' && (
            <Card>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-emerald-600" /> Pendapatan per Jenis Produk</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">No</th>
                    <SortableTh label="Jenis Produk" sortKey="name" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('name'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <SortableTh label="Pendapatan" sortKey="revenue" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('revenue'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <th className="pb-2 pr-4 text-right">%</th>
                  </tr></thead>
                  <tbody>
                    {sortAndPaginate(data.by_product_type || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'type', revenueKey: 'revenue' }).rows.map((row, idx) => (
                      <tr key={row.type} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 pr-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                        <td className="py-3 pr-4 font-medium">{PRODUCT_TYPE_LABELS[row.type] || row.type}</td>
                        <td className="py-3 pr-4 text-right">{formatIDR(row.revenue)}</td>
                        <td className="py-3 pr-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data.by_product_type || []).length === 0 && <p className="text-slate-500 py-8 text-center">Belum ada data</p>}
              {(data.by_product_type || []).length > 0 && (
                <TablePagination total={(data.by_product_type || []).length} page={tablePage} limit={tableLimit} onPageChange={setTablePage} onLimitChange={(l) => { setTableLimit(l); setTablePage(1); }} loading={loading} />
              )}
            </Card>
          )}

          {activeTab === 'periode' && (
            <Card>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-emerald-600" /> Pendapatan per Bulan</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">No</th>
                    <SortableTh label="Periode" sortKey="name" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('name'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <SortableTh label="Pendapatan" sortKey="revenue" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('revenue'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                    <th className="pb-2 pr-4 text-right">%</th>
                    <SortableTh label="Invoice" sortKey="count" currentSort={tableSortKey} sortOrder={tableSortOrder} onClick={() => { setTableSortKey('count'); setTableSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setTablePage(1); }} />
                  </tr></thead>
                  <tbody>
                    {sortAndPaginate(data.by_period || [], tableSortKey, tableSortOrder, tablePage, tableLimit, { nameKey: 'period', revenueKey: 'revenue' }).rows.map((row, idx) => (
                      <tr key={row.period} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 pr-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                        <td className="py-3 pr-4 font-medium">{formatPeriodLabel(row.period)}</td>
                        <td className="py-3 pr-4 text-right">{formatIDR(row.revenue)}</td>
                        <td className="py-3 pr-4 text-right text-slate-500">{data.total_revenue > 0 ? ((row.revenue / data.total_revenue) * 100).toFixed(1) : 0}%</td>
                        <td className="py-3 pr-4 text-right">{row.invoice_count ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data.by_period || []).length === 0 && <p className="text-slate-500 py-8 text-center">Belum ada data</p>}
              {(data.by_period || []).length > 0 && (
                <TablePagination total={(data.by_period || []).length} page={tablePage} limit={tableLimit} onPageChange={setTablePage} onLimitChange={(l) => { setTableLimit(l); setTablePage(1); }} loading={loading} />
              )}
            </Card>
          )}

          {activeTab === 'detail' && (
            <Card>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><List className="w-5 h-5 text-emerald-600" /> Detail Invoice ({pagination.total})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="pb-2 pr-4">Invoice</th>
                      <th className="pb-2 pr-4">Owner</th>
                      <th className="pb-2 pr-4">Cabang</th>
                      <th className="pb-2 pr-4 text-right">Total</th>
                      <th className="pb-2 pr-4 text-right">Dibayar</th>
                      <th className="pb-2 pr-4 text-right">Sisa</th>
                      <th className="pb-2 pr-4">Status Invoice</th>
                      <th className="pb-2 pr-4">Tanggal</th>
                      <th className="pb-2 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.invoices || []).map((inv) => (
                      <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 pr-4 font-medium">{formatInvoiceDisplay(inv.status, inv.invoice_number, INVOICE_STATUS_LABELS)}</td>
                        <td className="py-3 pr-4">{inv.owner_name || '-'}</td>
                        <td className="py-3 pr-4">{inv.branch_name || '-'}</td>
                        <td className="py-3 pr-4 text-right">{formatIDR(inv.total_amount)}</td>
                        <td className="py-3 pr-4 text-right text-emerald-600">{formatIDR(inv.paid_amount)}</td>
                        <td className="py-3 pr-4 text-right">{formatIDR(inv.remaining_amount)}</td>
                        <td className="py-3 pr-4"><span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">{INVOICE_STATUS_LABELS[inv.status] || inv.status}</span></td>
                        <td className="py-3 pr-4">{formatDate(inv.issued_at ?? null)}</td>
                        <td className="py-3 pr-4">
                          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/orders-invoices' + (inv.invoice_number ? '?invoice_number=' + encodeURIComponent(inv.invoice_number) : ''))}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data.invoices || []).length === 0 && !loading && <p className="text-slate-500 py-8 text-center">Belum ada data</p>}
              {pagination.total > 0 && (
                <>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-t border-slate-200">
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
                  <TablePagination total={pagination.total} page={page} limit={limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} loading={loading} limitOptions={[25, 50, 100, 200]} />
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default AccountingFinancialReportPage;
