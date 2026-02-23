import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Receipt, DollarSign, TrendingUp, Building2, MapPin, BarChart3, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { DashboardFilterBar } from '../../../components/common';
import { accountingApi, branchesApi, invoicesApi, type AccountingDashboardData, type ProvinceItem } from '../../../services/api';
import { formatIDR } from '../../../utils';

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
  const limit = 20;

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
  }, [page, fBranch, fProvinsi, fWilayah, fDateFrom, fDateTo, fStatus]);

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
              showReset
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
              onReset={() => { setFBranch(''); setFProvinsi(''); setFWilayah(''); setFDateFrom(''); setFDateTo(''); setFStatus(''); setPage(1); }}
              wilayahList={wilayahList}
              provinces={provinces}
              branches={branches}
            />
          </div>
          {summary && (
            <div className="flex flex-wrap gap-4 mb-4 p-3 bg-slate-50 rounded-lg text-sm">
              <span>Total: <strong>{summary.total_invoices}</strong> invoice</span>
              <span>Total amount: <strong>{formatIDR(parseFloat(summary.total_amount || 0))}</strong></span>
              <span>Terbayar: <strong className="text-emerald-600">{formatIDR(parseFloat(summary.total_paid || 0))}</strong></span>
              <span>Sisa: <strong className="text-amber-600">{formatIDR(parseFloat(summary.total_remaining || 0))}</strong></span>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-semibold">No. Invoice</th>
                  <th className="px-4 py-3 font-semibold">No. Order</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Terbayar</th>
                  <th className="px-4 py-3 font-semibold">Sisa</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Memuat...</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Tidak ada data</td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono">{inv.invoice_number}</td>
                      <td className="px-4 py-3 font-mono">{inv.Order?.order_number ?? '-'}</td>
                      <td className="px-4 py-3">{inv.User?.name ?? inv.User?.company_name ?? '-'}</td>
                      <td className="px-4 py-3">{inv.Branch?.name ?? '-'}</td>
                      <td className="px-4 py-3">{formatIDR(parseFloat(inv.total_amount || 0))}</td>
                      <td className="px-4 py-3 text-emerald-600">{formatIDR(parseFloat(inv.paid_amount || 0))}</td>
                      <td className="px-4 py-3">{formatIDR(parseFloat(inv.remaining_amount || 0))}</td>
                      <td className="px-4 py-3"><Badge variant="info">{inv.status}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-slate-600">Total {pagination.total} invoice</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Sebelumnya</Button>
                <span className="py-2 text-sm text-slate-600">Halaman {page} / {pagination.totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Selanjutnya</Button>
              </div>
            </div>
          )}
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

  const fetchDashboard = async () => {
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
  };

  useEffect(() => {
    fetchDashboard();
  }, []);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {user?.name ? `Selamat datang, ${user.name}` : 'Accounting'}
        </h1>
        <p className="text-slate-600 mt-1">Rekapitulasi piutang, pembayaran, dan laporan keuangan</p>
      </div>

      <Card>
        <DashboardFilterBar
          variant="page"
          loading={loading}
          showWilayah
          showProvinsi
          showBranch
          showDateRange
          showReset={false}
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
      </Card>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3">{error}</div>
      )}

      {loading && !data && <div className="text-center py-12 text-slate-500">Memuat data...</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card hover className="flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Invoice</p>
                  <p className="text-3xl font-bold text-slate-900">{summary.total_invoices}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                  <Receipt className="w-6 h-6" />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 self-start gap-1" onClick={() => openModal('all')}>
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
            <Card hover className="flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Terbayar</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatIDR(summary.total_paid)}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 self-start gap-1" onClick={() => openModal('all')}>
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
            <Card hover className="flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Piutang (Sisa)</p>
                  <p className="text-2xl font-bold text-amber-600">{formatIDR(summary.total_receivable)}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 self-start gap-1" onClick={() => openModal('all')}>
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
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
                  <Building2 className="w-5 h-5 text-emerald-500" />
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
                    <span className="text-sm font-semibold">{row.count} inv · Terbayar {formatIDR(row.paid)} · Sisa {formatIDR(row.receivable)}</span>
                  </div>
                ))}
                {(summary.by_branch || []).length === 0 && <p className="text-slate-500 text-sm">Belum ada data</p>}
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
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
                    <span className="text-sm font-semibold">{row.count} inv · Terbayar {formatIDR(row.paid)} · Sisa {formatIDR(row.receivable)}</span>
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
                    <span className="text-sm font-semibold">{row.count} inv · Terbayar {formatIDR(row.paid)} · Sisa {formatIDR(row.receivable)}</span>
                  </div>
                ))}
                {(summary.by_provinsi || []).length === 0 && <p className="text-slate-500 text-sm">Belum ada data</p>}
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Invoice Terbaru</h3>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => openModal('recent')}>
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">No. Invoice</th>
                    <th className="pb-2 pr-4">Owner</th>
                    <th className="pb-2 pr-4">Cabang</th>
                    <th className="pb-2 pr-4">Total</th>
                    <th className="pb-2 pr-4">Terbayar</th>
                    <th className="pb-2 pr-4">Sisa</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, 10).map((inv: any) => (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pr-4 font-mono">{inv.invoice_number}</td>
                      <td className="py-3 pr-4">{inv.User?.name ?? '-'}</td>
                      <td className="py-3 pr-4">{inv.Branch?.name ?? '-'}</td>
                      <td className="py-3 pr-4">{formatIDR(parseFloat(inv.total_amount || 0))}</td>
                      <td className="py-3 pr-4 text-emerald-600">{formatIDR(parseFloat(inv.paid_amount || 0))}</td>
                      <td className="py-3 pr-4">{formatIDR(parseFloat(inv.remaining_amount || 0))}</td>
                      <td className="py-3"><Badge variant="info">{inv.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recent.length === 0 && <p className="text-slate-500 py-4 text-center">Belum ada invoice</p>}
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Aksi Cepat</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center" onClick={() => navigate('/dashboard/accounting/financial-report')}>
                <Activity className="w-5 h-5" />
                <span className="text-sm">Laporan Keuangan</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center" onClick={() => navigate('/dashboard/accounting/aging')}>
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm">Piutang (AR)</span>
              </Button>
            </div>
          </Card>
        </>
      )}

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
