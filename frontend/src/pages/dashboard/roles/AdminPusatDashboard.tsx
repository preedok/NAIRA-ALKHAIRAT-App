import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Building2,
  Users,
  FileText,
  DollarSign,
  ChevronRight,
  X,
  Eye,
  MapPin,
  BarChart3,
  TrendingUp,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { DashboardFilterBar, AutoRefreshControl } from '../../../components/common';
import { adminPusatApi, branchesApi, ordersApi, invoicesApi, type AdminPusatDashboardData, type ProvinceItem } from '../../../services/api';
import { formatIDR } from '../../../utils';
import { ORDER_STATUS_LABELS, INVOICE_STATUS_LABELS } from '../../../utils/constants';

/** Modal daftar order dengan filter lengkap */
const OrderListModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  presetFilter?: { status?: string; branch_id?: string; wilayah_id?: string; provinsi_id?: string; date_from?: string; date_to?: string };
}> = ({ open, onClose, title, presetFilter = {} }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<ProvinceItem[]>([]);
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [fStatus, setFStatus] = useState(presetFilter.status || '');
  const [fBranch, setFBranch] = useState(presetFilter.branch_id || '');
  const [fWilayah, setFWilayah] = useState(presetFilter.wilayah_id || '');
  const [fProvinsi, setFProvinsi] = useState(presetFilter.provinsi_id || '');
  const [fDateFrom, setFDateFrom] = useState(presetFilter.date_from || '');
  const [fDateTo, setFDateTo] = useState(presetFilter.date_to || '');
  const [fOrderNumber, setFOrderNumber] = useState('');
  const [sortBy] = useState('created_at');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { limit: 20, page, sort_by: sortBy, sort_order: sortOrder };
      if (fStatus) params.status = fStatus;
      if (fBranch) params.branch_id = fBranch;
      if (fWilayah) params.wilayah_id = fWilayah;
      if (fProvinsi) params.provinsi_id = fProvinsi;
      if (fDateFrom) params.date_from = fDateFrom;
      if (fDateTo) params.date_to = fDateTo;
      if (fOrderNumber.trim()) params.order_number = fOrderNumber.trim();
      const res = await ordersApi.list(params);
      if (res.data.success) {
        setOrders(res.data.data || []);
        setPagination((res.data as any).pagination || null);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, fStatus, fBranch, fWilayah, fProvinsi, fDateFrom, fDateTo, fOrderNumber]);

  useEffect(() => {
    if (open) {
      setFStatus(presetFilter.status || '');
      setFBranch(presetFilter.branch_id || '');
      setFWilayah(presetFilter.wilayah_id || '');
      setFProvinsi(presetFilter.provinsi_id || '');
      setFDateFrom(presetFilter.date_from || '');
      setFDateTo(presetFilter.date_to || '');
      setPage(1);
    }
  }, [open, presetFilter]);

  useEffect(() => {
    if (open) fetchOrders();
  }, [open, fetchOrders]);

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
              statusType="order"
              showDateRange
              showSearch
              searchPlaceholder="No. Order..."
              showReset
              wilayahId={fWilayah}
              provinsiId={fProvinsi}
              branchId={fBranch}
              status={fStatus}
              dateFrom={fDateFrom}
              dateTo={fDateTo}
              search={fOrderNumber}
              onWilayahChange={setFWilayah}
              onProvinsiChange={setFProvinsi}
              onBranchChange={setFBranch}
              onStatusChange={setFStatus}
              onDateFromChange={setFDateFrom}
              onDateToChange={setFDateTo}
              onSearchChange={setFOrderNumber}
              onApply={() => { setPage(1); fetchOrders(); }}
              onReset={() => { setFStatus(''); setFBranch(''); setFWilayah(''); setFProvinsi(''); setFDateFrom(''); setFDateTo(''); setFOrderNumber(''); setPage(1); }}
              wilayahList={wilayahList}
              provinces={provinces}
              branches={branches}
              orderStatusOptions={ORDER_STATUS_LABELS}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-semibold">No. Order</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                  <th className="px-4 py-3 font-semibold w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Memuat...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada data</td></tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono">{o.order_number}</td>
                      <td className="px-4 py-3">{o.User?.name ?? '-'}</td>
                      <td className="px-4 py-3">{o.Branch?.name ?? '-'}</td>
                      <td className="px-4 py-3"><Badge variant="info">{ORDER_STATUS_LABELS[o.status] || o.status}</Badge></td>
                      <td className="px-4 py-3">{formatIDR(o.total_amount || 0)}</td>
                      <td className="px-4 py-3">{o.created_at ? new Date(o.created_at).toLocaleDateString('id-ID') : '-'}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => { onClose(); navigate('/dashboard/orders-invoices'); }}>
                          <Eye className="w-4 h-4" /> Lihat
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-slate-600">Total {pagination.total} order</span>
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

/** Modal daftar invoice dengan filter preset dari dashboard */
const InvoiceListModalAdmin: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  presetFilter?: Record<string, string>;
}> = ({ open, onClose, title, presetFilter = {} }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [summary, setSummary] = useState<any>(null);

  const fetchInvoices = React.useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 20, page, sort_by: 'created_at', sort_order: 'desc' };
      if (presetFilter.branch_id) params.branch_id = presetFilter.branch_id;
      if (presetFilter.provinsi_id) params.provinsi_id = presetFilter.provinsi_id;
      if (presetFilter.wilayah_id) params.wilayah_id = presetFilter.wilayah_id;
      if (presetFilter.date_from) params.date_from = presetFilter.date_from;
      if (presetFilter.date_to) params.date_to = presetFilter.date_to;
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
  }, [open, page, presetFilter.branch_id, presetFilter.provinsi_id, presetFilter.wilayah_id, presetFilter.date_from, presetFilter.date_to]);

  React.useEffect(() => {
    if (open) {
      setPage(1);
    }
  }, [open]);

  React.useEffect(() => {
    if (open) fetchInvoices();
  }, [open, fetchInvoices]);

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

const AdminPusatDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AdminPusatDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [provinsiId, setProvinsiId] = useState<string>('');
  const [wilayahId, setWilayahId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [modalType, setModalType] = useState<'status' | 'branch' | 'wilayah' | 'provinsi' | 'orders' | 'invoices' | null>(null);
  const [modalPreset, setModalPreset] = useState<Record<string, string>>({});
  const [provinces, setProvinces] = useState<ProvinceItem[]>([]);
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (branchId) params.branch_id = branchId;
      if (statusFilter) params.status = statusFilter;
      if (provinsiId) params.provinsi_id = provinsiId;
      if (wilayahId) params.wilayah_id = wilayahId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await adminPusatApi.getDashboard(params);
      if (res.data.success && res.data.data) setData(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
    }
  }, [branchId, statusFilter, provinsiId, wilayahId, dateFrom, dateTo]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => {
    branchesApi.listProvinces().then((r) => { if (r.data.success) setProvinces(r.data.data || []); }).catch(() => {});
    branchesApi.listWilayah().then((r) => { if (r.data.success) setWilayahList(r.data.data || []); }).catch(() => {});
  }, []);

  const orders = data?.orders ?? { total: 0, by_status: {}, by_branch: [], by_wilayah: [], by_provinsi: [], total_revenue: 0 };
  const branches = data?.branches ?? [];
  const ordersRecent = data?.orders_recent ?? [];
  const invoices = data?.invoices ?? { total: 0, by_status: {} };

  const buildPreset = (extra?: Record<string, string>) => {
    const p: Record<string, string> = {};
    if (branchId) p.branch_id = branchId;
    if (wilayahId) p.wilayah_id = wilayahId;
    if (provinsiId) p.provinsi_id = provinsiId;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if (extra) Object.assign(p, extra);
    return p;
  };

  const openModal = (type: 'status' | 'branch' | 'wilayah' | 'provinsi' | 'orders' | 'invoices', preset?: Record<string, string>) => {
    setModalType(type);
    if (preset) {
      setModalPreset(preset);
    } else if (type === 'status') {
      setModalPreset(buildPreset({ status: statusFilter }));
    } else {
      setModalPreset(buildPreset());
    }
  };

  const getModalTitle = () => {
    if (modalType === 'status') return 'Daftar Invoice per Status';
    if (modalType === 'branch') return 'Daftar Invoice per Cabang';
    if (modalType === 'wilayah') return 'Daftar Invoice per Wilayah';
    if (modalType === 'provinsi') return 'Daftar Invoice per Provinsi';
    if (modalType === 'orders') return 'Semua Invoice';
    if (modalType === 'invoices') return 'Semua Invoice';
    return 'Daftar Invoice';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {user?.name ? `Selamat datang, ${user.name}` : 'Admin Pusat'}
          </h1>
          <p className="text-slate-600 mt-1">Rekapitulasi transaksi dan pekerjaan cabang</p>
        </div>
        <AutoRefreshControl onRefresh={fetchDashboard} disabled={loading} />
      </div>

      <Card className="border-slate-200/80 shadow-sm">
        <DashboardFilterBar
          variant="page"
          loading={loading}
          showWilayah
          showProvinsi
          showBranch
          showStatus
          statusType="order"
          showDateRange
          showReset={false}
          wilayahId={wilayahId}
          provinsiId={provinsiId}
          branchId={branchId}
          status={statusFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onWilayahChange={setWilayahId}
          onProvinsiChange={setProvinsiId}
          onBranchChange={setBranchId}
          onStatusChange={setStatusFilter}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onApply={fetchDashboard}
          wilayahList={wilayahList}
          provinces={provinces}
          branches={branches}
          orderStatusOptions={ORDER_STATUS_LABELS}
        />
      </Card>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex items-center gap-2">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-16 text-slate-500">Memuat data...</div>
      )}

      {data && (
        <>
          {/* Cards total lengkap */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card hover className="overflow-hidden flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Invoice</p>
                  <p className="text-3xl font-bold text-slate-900">{orders.total}</p>
                  <p className="text-xs text-slate-400 mt-1">Semua status</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                  <Receipt className="w-8 h-8" />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 self-start gap-1" onClick={() => openModal('orders')}>
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
            <Card hover className="overflow-hidden flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">{formatIDR(orders.total_revenue)}</p>
                  <p className="text-xs text-slate-400 mt-1">Excl. draft & cancelled</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                  <DollarSign className="w-8 h-8" />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 self-start gap-1" onClick={() => openModal('orders')}>
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
            <Card hover className="overflow-hidden flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Invoice</p>
                  <p className="text-3xl font-bold text-slate-900">{invoices.total}</p>
                  <p className="text-xs text-slate-400 mt-1">{Object.keys(invoices.by_status || {}).length} status</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg">
                  <FileText className="w-8 h-8" />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 self-start gap-1" onClick={() => openModal('invoices')}>
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
            <Card hover className="overflow-hidden flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Owner</p>
                  <p className="text-3xl font-bold text-slate-900">{data.owners_total ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Terdaftar</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                  <Users className="w-8 h-8" />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 self-start gap-1" onClick={() => navigate('/dashboard/admin-pusat/users')}>
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
          </div>

          {/* Order per Status, Cabang, Wilayah, Provinsi - 2x2 grid */}
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
                {Object.entries(orders.by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-slate-50">
                    <Badge variant="info">{INVOICE_STATUS_LABELS[status] || status}</Badge>
                    <span className="font-semibold text-slate-800">{count}</span>
                  </div>
                ))}
                {Object.keys(orders.by_status || {}).length === 0 && (
                  <p className="text-slate-500 text-sm py-4">Belum ada data</p>
                )}
              </div>
            </Card>
            <Card className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-500" />
                  Invoice per Cabang
                </h3>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => openModal('branch')}>
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 flex-1">
                {(orders.by_branch || []).map((row: any) => (
                  <div key={row.branch_id} className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-slate-50">
                    <span className="text-slate-800 font-medium">{row.branch_name || row.code}</span>
                    <span className="text-sm font-semibold">{row.count} · {formatIDR(row.revenue || 0)}</span>
                  </div>
                ))}
                {(orders.by_branch || []).length === 0 && (
                  <p className="text-slate-500 text-sm py-4">Belum ada data</p>
                )}
              </div>
            </Card>
            <Card className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-500" />
                  Invoice per Wilayah
                </h3>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => openModal('wilayah')}>
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 flex-1">
                {(orders.by_wilayah || []).map((row: any, i: number) => (
                  <div key={row.wilayah_id || `w-${i}`} className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-slate-50">
                    <span className="text-slate-800 font-medium">{row.wilayah_name}</span>
                    <span className="text-sm font-semibold">{row.count} · {formatIDR(row.revenue || 0)}</span>
                  </div>
                ))}
                {(orders.by_wilayah || []).length === 0 && (
                  <p className="text-slate-500 text-sm py-4">Belum ada data</p>
                )}
              </div>
            </Card>
            <Card className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  Invoice per Provinsi
                </h3>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => openModal('provinsi')}>
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 flex-1">
                {(orders.by_provinsi || []).map((row: any, i: number) => (
                  <div key={row.provinsi_id || `p-${i}`} className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-slate-50">
                    <span className="text-slate-800 font-medium">{row.provinsi_name}</span>
                    <span className="text-sm font-semibold">{row.count} · {formatIDR(row.revenue || 0)}</span>
                  </div>
                ))}
                {(orders.by_provinsi || []).length === 0 && (
                  <p className="text-slate-500 text-sm py-4">Belum ada data</p>
                )}
              </div>
            </Card>
          </div>

          {/* Order Terbaru dengan View All & Aksi */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Invoice Terbaru</h3>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/dashboard/orders-invoices')}>
                View All <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-semibold">No. Invoice</th>
                    <th className="px-4 py-3 font-semibold">Owner</th>
                    <th className="px-4 py-3 font-semibold">Cabang</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersRecent.slice(0, 10).map((inv: any) => (
                    <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono">{inv.invoice_number ?? inv.Order?.order_number ?? '-'}</td>
                      <td className="px-4 py-3">{inv.User?.name ?? '-'}</td>
                      <td className="px-4 py-3">{inv.Branch?.name ?? '-'}</td>
                      <td className="px-4 py-3"><Badge variant="info">{INVOICE_STATUS_LABELS[inv.status] || inv.status}</Badge></td>
                      <td className="px-4 py-3">{formatIDR(inv.total_amount || 0)}</td>
                      <td className="px-4 py-3">{inv.created_at ? new Date(inv.created_at).toLocaleDateString('id-ID') : '-'}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/dashboard/orders-invoices')}>
                          <Eye className="w-4 h-4" /> Lihat
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ordersRecent.length === 0 && <p className="text-slate-500 py-8 text-center">Belum ada invoice</p>}
          </Card>

          {/* Aksi Cepat */}
          <Card>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Aksi Cepat</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="flex flex-col h-24 gap-2 justify-center hover:border-emerald-500 hover:bg-emerald-50" onClick={() => navigate('/dashboard/orders-invoices')}>
                <Receipt className="w-6 h-6" />
                <span className="text-sm">Invoice</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-24 gap-2 justify-center hover:border-emerald-500 hover:bg-emerald-50" onClick={() => navigate('/dashboard/branches')}>
                <Building2 className="w-6 h-6" />
                <span className="text-sm">Cabang & Akun</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-24 gap-2 justify-center hover:border-emerald-500 hover:bg-emerald-50" onClick={() => navigate('/dashboard/admin-pusat/users')}>
                <Users className="w-6 h-6" />
                <span className="text-sm">Buat Akun Bus/Hotel</span>
              </Button>
            </div>
          </Card>
        </>
      )}

      <OrderListModal
        open={modalType !== null && modalType !== 'invoices'}
        onClose={() => setModalType(null)}
        title={getModalTitle()}
        presetFilter={modalPreset}
      />
      <InvoiceListModalAdmin
        open={modalType === 'invoices'}
        onClose={() => setModalType(null)}
        title={getModalTitle()}
        presetFilter={modalPreset}
      />
    </div>
  );
};

export default AdminPusatDashboard;
