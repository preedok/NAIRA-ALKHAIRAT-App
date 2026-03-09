import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Receipt, DollarSign, TrendingUp, Building2, MapPin, BarChart3, ChevronRight, X, FileText, Wallet, Landmark, ShoppingCart, Eye } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { DashboardFilterBar, PageFilter, FilterIconButton, PageHeader, StatCard, CardSectionHeader, ContentLoading, AutoRefreshControl } from '../../../components/common';
import Table from '../../../components/common/Table';
import { accountingApi, branchesApi, invoicesApi, type AccountingDashboardData, type ProvinceItem } from '../../../services/api';
import { NominalDisplay } from '../../../components/common';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant } from '../../../components/common/InvoiceStatusRefundCell';
import type { TableColumn } from '../../../types';

/** Modal daftar invoice lengkap dengan filter dan pagination */
const InvoiceListModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  presetFilter?: { branch_id?: string; provinsi_id?: string; wilayah_id?: string; date_from?: string; date_to?: string; status?: string };
}> = ({ open, onClose, title, presetFilter = {} }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<ProvinceItem[]>([]);
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [fBranch, setFBranch] = useState(presetFilter.branch_id || '');
  const [fProvinsi, setFProvinsi] = useState(presetFilter.provinsi_id || '');
  const [fWilayah, setFWilayah] = useState(presetFilter.wilayah_id || '');
  const [fDateFrom, setFDateFrom] = useState(presetFilter.date_from || '');
  const [fDateTo, setFDateTo] = useState(presetFilter.date_to || '');
  const [fStatus, setFStatus] = useState(presetFilter.status || '');
  const [limit, setLimit] = useState(20);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { limit, page, sort_by: 'created_at', sort_order: 'desc' };
      if (fBranch) params.branch_id = fBranch;
      if (fProvinsi) params.provinsi_id = fProvinsi;
      if (fWilayah) params.wilayah_id = fWilayah;
      if (fDateFrom) params.date_from = fDateFrom;
      if (fDateTo) params.date_to = fDateTo;
      if (fStatus) params.status = fStatus;
      const res = await invoicesApi.list(params);
      if (res.data.success) {
        setInvoices((res.data as any).data || []);
        setPagination((res.data as any).pagination || null);
        setSummary((res.data as any).summary || null);
      }
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, fBranch, fProvinsi, fWilayah, fDateFrom, fDateTo, fStatus]);

  useEffect(() => {
    if (open) {
      setFBranch(presetFilter.branch_id || '');
      setFProvinsi(presetFilter.provinsi_id || '');
      setFWilayah(presetFilter.wilayah_id || '');
      setFDateFrom(presetFilter.date_from || '');
      setFDateTo(presetFilter.date_to || '');
      setFStatus(presetFilter.status || '');
      setPage(1);
    }
  }, [open, presetFilter]);

  useEffect(() => {
    if (open) fetchInvoices();
  }, [open, fetchInvoices]);

  useEffect(() => {
    if (open) {
      branchesApi.list({ limit: 500 }).then((r) => { if (r.data.success) setBranches(r.data.data || []); }).catch(() => {});
      branchesApi.listProvinces().then((r) => { if (r.data.success) setProvinces(r.data.data || []); }).catch(() => {});
      branchesApi.listWilayah().then((r) => { if (r.data.success) setWilayahList(r.data.data || []); }).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6">
            <DashboardFilterBar
              variant="modal"
              loading={loading}
              showWilayah
              showProvinsi
              showBranch
              showStatus
              statusType="invoice"
              showDateRange
              wilayahId={fWilayah}
              provinsiId={fProvinsi}
              branchId={fBranch}
              status={fStatus}
              dateFrom={fDateFrom}
              dateTo={fDateTo}
              onWilayahChange={setFWilayah}
              onProvinsiChange={setFProvinsi}
              onBranchChange={setFBranch}
              onStatusChange={setFStatus}
              onDateFromChange={setFDateFrom}
              onDateToChange={setFDateTo}
              onApply={() => { setPage(1); fetchInvoices(); }}
              wilayahList={wilayahList}
              provinces={provinces}
              branches={branches}
            />
          </div>
          {summary && (
            <div className="flex flex-wrap gap-4 mb-4 p-3 bg-slate-50 rounded-lg text-sm">
              <span>Total: <strong>{summary.total_invoices}</strong> invoice</span>
              <span>Total amount: <strong><NominalDisplay amount={parseFloat(summary.total_amount || 0)} currency="IDR" /></strong></span>
              <span>Terbayar: <strong className="text-blue-600"><NominalDisplay amount={parseFloat(summary.total_paid || 0)} currency="IDR" /></strong></span>
              <span>Sisa: <strong className="text-amber-600"><NominalDisplay amount={parseFloat(summary.total_remaining || 0)} currency="IDR" /></strong></span>
            </div>
          )}
          <Table
            columns={[
              { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
              { id: 'owner', label: 'Owner', align: 'left' },
              { id: 'company', label: 'Perusahaan', align: 'left' },
              { id: 'total', label: 'Total', align: 'right' },
              { id: 'paid', label: 'Terbayar', align: 'right' },
              { id: 'remaining', label: 'Sisa', align: 'right' },
              { id: 'status', label: 'Status', align: 'left' }
            ] as TableColumn[]}
            data={loading ? [] : invoices}
            emptyMessage={loading ? 'Memuat data...' : 'Tidak ada data'}
            pagination={
              pagination && pagination.total > 0
                ? {
                    total: pagination.total,
                    page: pagination.page,
                    limit: pagination.limit,
                    totalPages: pagination.totalPages,
                    onPageChange: setPage,
                    onLimitChange: (l) => { setLimit(l); setPage(1); }
                  }
                : undefined
            }
            renderRow={(inv) => {
              const statusLabel = getEffectiveInvoiceStatusLabel(inv);
              const statusBadgeVariant = getEffectiveInvoiceStatusBadgeVariant(inv);
              return (
                <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 align-top">
                    <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan />
                  </td>
                  <td className="px-4 py-3 align-top">{inv.User?.name ?? inv.User?.company_name ?? '-'}</td>
                  <td className="px-4 py-3 align-top text-sm">
                    <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                  </td>
                  <td className="px-4 py-3 text-right align-top"><NominalDisplay amount={parseFloat((inv.total_amount_idr ?? inv.total_amount) || 0)} currency="IDR" /></td>
                  <td className="px-4 py-3 text-right text-blue-600 align-top"><NominalDisplay amount={parseFloat(inv.paid_amount || 0)} currency="IDR" /></td>
                  <td className="px-4 py-3 text-right align-top"><NominalDisplay amount={parseFloat(inv.remaining_amount || 0)} currency="IDR" /></td>
                  <td className="px-4 py-3 align-top"><Badge variant={statusBadgeVariant}>{statusLabel}</Badge></td>
                </tr>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

const AccountingDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AccountingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string>('');
  const [provinsiId, setProvinsiId] = useState<string>('');
  const [wilayahId, setWilayahId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [modalType, setModalType] = useState<'all' | 'status' | 'branch' | 'wilayah' | 'provinsi' | 'recent' | null>(null);
  const [modalPreset, setModalPreset] = useState<Record<string, string>>({});
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<ProvinceItem[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (branchId) params.branch_id = branchId;
      if (provinsiId) params.provinsi_id = provinsiId;
      if (wilayahId) params.wilayah_id = wilayahId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await accountingApi.getDashboard(params);
      if (res.data.success && res.data.data) setData(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
    }
  }, [branchId, provinsiId, wilayahId, dateFrom, dateTo]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);
  useEffect(() => {
    branchesApi.listWilayah().then((r) => { if (r.data.success) setWilayahList(r.data.data || []); }).catch(() => {});
    branchesApi.listProvinces().then((r) => { if (r.data.success) setProvinces(r.data.data || []); }).catch(() => {});
  }, []);

  const summary = data?.summary ?? { total_invoices: 0, total_receivable: 0, total_paid: 0, by_status: {}, by_branch: [], by_provinsi: [], by_wilayah: [] };
  const branches = data?.branches ?? [];
  const recent = data?.invoices_recent ?? [];

  const openModal = (type: 'all' | 'status' | 'branch' | 'wilayah' | 'provinsi' | 'recent', status?: string) => {
    setModalType(type);
    const preset: Record<string, string> = {};
    if (branchId) preset.branch_id = branchId;
    if (provinsiId) preset.provinsi_id = provinsiId;
    if (wilayahId) preset.wilayah_id = wilayahId;
    if (dateFrom) preset.date_from = dateFrom;
    if (dateTo) preset.date_to = dateTo;
    if (status) preset.status = status;
    setModalPreset(preset);
  };

  const getModalTitle = () => {
    if (modalType === 'all') return 'Semua Invoice';
    if (modalType === 'status') return 'Invoice per Status';
    if (modalType === 'branch') return 'Invoice per Cabang';
    if (modalType === 'wilayah') return 'Invoice per Wilayah';
    if (modalType === 'provinsi') return 'Invoice per Provinsi';
    if (modalType === 'recent') return 'Invoice Terbaru';
    return 'Daftar Invoice';
  };

  const hasActiveFilters = !!(branchId || provinsiId || wilayahId || dateFrom || dateTo);
  const resetFilters = () => {
    setBranchId('');
    setProvinsiId('');
    setWilayahId('');
    setDateFrom('');
    setDateTo('');
    setTimeout(() => fetchDashboard(), 0);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={user?.name ? `Selamat datang, ${user.name}` : 'Accounting'}
        subtitle="Rekapitulasi piutang, pembayaran, dan laporan keuangan"
        right={
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={fetchDashboard} disabled={loading} size="sm" />
            <FilterIconButton open={showFilters} onToggle={() => setShowFilters((v: boolean) => !v)} hasActiveFilters={hasActiveFilters} />
          </div>
        }
      />

      <PageFilter
        open={showFilters}
        onToggle={() => setShowFilters((v: boolean) => !v)}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
        hideToggleRow
        className="w-full"
      >
        <DashboardFilterBar
          variant="page"
          loading={loading}
          showWilayah
          showProvinsi
          showBranch
          showDateRange
          hideActions
          wilayahId={wilayahId}
          provinsiId={provinsiId}
          branchId={branchId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onWilayahChange={setWilayahId}
          onProvinsiChange={setProvinsiId}
          onBranchChange={setBranchId}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onApply={fetchDashboard}
          wilayahList={wilayahList}
          provinces={provinces}
          branches={branches}
        />
      </PageFilter>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3">{error}</div>
      )}

      <Card className="travel-card min-h-[200px]">
        <CardSectionHeader icon={<Activity className="w-6 h-6" />} title="Ringkasan Accounting" subtitle="Total invoice, terbayar, dan piutang per status, cabang, wilayah." className="mb-4" />
        {loading && !data ? (
          <ContentLoading />
        ) : data ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              icon={<Receipt className="w-5 h-5" />}
              label="Total Invoice"
              value={summary.total_invoices}
              iconClassName="bg-[#0D1A63] text-white"
              onClick={() => openModal('all')}
              action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => openModal('all')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
            />
            <StatCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Total Terbayar"
              value={<NominalDisplay amount={summary.total_paid} currency="IDR" />}
              iconClassName="bg-[#0D1A63] text-white"
              onClick={() => openModal('all')}
              action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => openModal('all')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Piutang (Sisa)"
              value={<NominalDisplay amount={summary.total_receivable} currency="IDR" />}
              iconClassName="bg-amber-100 text-amber-600"
              onClick={() => openModal('all')}
              action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => openModal('all')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Invoice per Status
                </h3>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => openModal('status')}>
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 flex-1">
                {Object.entries(summary.by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                    <Badge variant="info">{status}</Badge>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
                {Object.keys(summary.by_status || {}).length === 0 && <p className="text-slate-500 text-sm">Belum ada data</p>}
              </div>
            </Card>
            <Card className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  Per Cabang
                </h3>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => openModal('branch')}>
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 flex-1">
                {(summary.by_branch || []).map((row: any) => (
                  <div key={row.branch_id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <span className="text-slate-800">{row.branch_name || row.code}</span>
                    <span className="text-sm font-semibold">{row.count} inv · Terbayar <NominalDisplay amount={row.paid} currency="IDR" /> · Sisa <NominalDisplay amount={row.receivable} currency="IDR" /></span>
                  </div>
                ))}
                {(summary.by_branch || []).length === 0 && <p className="text-slate-500 text-sm">Belum ada data</p>}
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-500" />
                  Per Wilayah
                </h3>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => openModal('wilayah')}>
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 flex-1">
                {(summary.by_wilayah || []).map((row: any) => (
                  <div key={row.wilayah_id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <span className="text-slate-800">{row.wilayah_name}</span>
                    <span className="text-sm font-semibold">{row.count} inv · Terbayar <NominalDisplay amount={row.paid} currency="IDR" /> · Sisa <NominalDisplay amount={row.receivable} currency="IDR" /></span>
                  </div>
                ))}
                {(summary.by_wilayah || []).length === 0 && <p className="text-slate-500 text-sm">Belum ada data</p>}
              </div>
            </Card>
            <Card className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Per Provinsi
                </h3>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => openModal('provinsi')}>
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 flex-1">
                {(summary.by_provinsi || []).map((row: any) => (
                  <div key={row.provinsi_id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <span className="text-slate-800">{row.provinsi_name}</span>
                    <span className="text-sm font-semibold">{row.count} inv · Terbayar <NominalDisplay amount={row.paid} currency="IDR" /> · Sisa <NominalDisplay amount={row.receivable} currency="IDR" /></span>
                  </div>
                ))}
                {(summary.by_provinsi || []).length === 0 && <p className="text-slate-500 text-sm">Belum ada data</p>}
              </div>
            </Card>
          </div>

          <Card>
            <CardSectionHeader
              icon={<Receipt className="w-6 h-6" />}
              title="Invoice Terbaru"
              subtitle="Daftar invoice terbaru"
              right={
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => openModal('recent')}>
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              }
              className="mb-4"
            />
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <Table
                columns={[
                  { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
                  { id: 'owner', label: 'Owner', align: 'left' },
                  { id: 'branch', label: 'Cabang', align: 'left' },
                  { id: 'total', label: 'Total', align: 'left' },
                  { id: 'paid', label: 'Terbayar', align: 'left' },
                  { id: 'remaining', label: 'Sisa', align: 'left' },
                  { id: 'status', label: 'Status', align: 'left' }
                ] as TableColumn[]}
                data={recent.slice(0, 10)}
                emptyMessage="Belum ada invoice"
                emptyDescription="Tidak ada invoice terbaru. Ubah filter atau lihat View All."
                pagination={
                  recent.length > 0
                    ? {
                        total: recent.length,
                        page: 1,
                        limit: 10,
                        totalPages: Math.ceil(recent.length / 10) || 1,
                        onPageChange: () => {},
                        onLimitChange: () => {}
                      }
                    : undefined
                }
                renderRow={(inv: any) => (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pr-4 font-mono"><InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} compact /></td>
                    <td className="py-3 pr-4">{inv.User?.name ?? '-'}</td>
                    <td className="py-3 pr-4">{inv.Branch?.name ?? '-'}</td>
                    <td className="py-3 pr-4"><NominalDisplay amount={parseFloat(inv.total_amount || 0)} currency="IDR" /></td>
                    <td className="py-3 pr-4 text-blue-600"><NominalDisplay amount={parseFloat(inv.paid_amount || 0)} currency="IDR" /></td>
                    <td className="py-3 pr-4"><NominalDisplay amount={parseFloat(inv.remaining_amount || 0)} currency="IDR" /></td>
                    <td className="py-3"><Badge variant={getEffectiveInvoiceStatusBadgeVariant(inv)}>{getEffectiveInvoiceStatusLabel(inv)}</Badge></td>
                  </tr>
                )}
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Aksi Cepat</h3>
            <p className="text-sm text-slate-500 mb-4">Akses langsung ke modul accounting dan laporan</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/accounting/financial-report')}>
                <Activity className="w-5 h-5 text-primary-600 shrink-0" />
                <span className="text-xs font-medium text-center leading-tight">Laporan Keuangan</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/accounting/aging')}>
                <TrendingUp className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-xs font-medium text-center leading-tight">Piutang (AR)</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/accounting/chart-of-accounts')}>
                <Landmark className="w-5 h-5 text-slate-600 shrink-0" />
                <span className="text-xs font-medium text-center leading-tight">Data Rekening Bank</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/orders-invoices')}>
                <Receipt className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-center leading-tight">Order & Invoice</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/reports')}>
                <BarChart3 className="w-5 h-5 text-purple-600 shrink-0" />
                <span className="text-xs font-medium text-center leading-tight">Reports</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/refunds')}>
                <Wallet className="w-5 h-5 text-sky-600 shrink-0" />
                <span className="text-xs font-medium text-center leading-tight">Refund</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/accounting/purchasing')}>
                <ShoppingCart className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-medium text-center leading-tight">Pembelian</span>
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
      </Card>

      <InvoiceListModal
        open={!!modalType}
        onClose={() => setModalType(null)}
        title={getModalTitle()}
        presetFilter={modalPreset}
      />
    </div>
  );
};

export default AccountingDashboard;
