import React, { useState, useEffect, useCallback } from 'react';
import { Filter, RefreshCw, Download, ExternalLink, Eye, Receipt, FileText, X, FileSpreadsheet, CreditCard, ChevronLeft, ChevronRight, Check, LayoutGrid, Unlock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { accountingApi, branchesApi, invoicesApi, businessRulesApi, type AccountingAgingData } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { formatIDR, formatInvoiceDisplay } from '../../../utils';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { useToast } from '../../../contexts/ToastContext';

const API_BASE = process.env.REACT_APP_API_URL?.replace(/\/api\/v1\/?$/, '') || '';

/** URL file untuk preview/download (uploads) */
const getFileUrl = (path: string) => {
  if (!path || path === 'issued-saudi') return null;
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
};

const INVOICE_STATUS_OPTIONS = Object.keys(INVOICE_STATUS_LABELS).sort();

type BucketTab = 'all' | 'current' | 'days_1_30' | 'days_31_60' | 'days_61_plus';

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const getProofStatus = (p: any) => {
  if (p.verified_status === 'rejected') return { status: 'rejected', label: 'Tidak valid', variant: 'error' as const };
  if (p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')) return { status: 'verified', label: 'Diverifikasi', variant: 'success' as const };
  return { status: 'pending', label: 'Menunggu verifikasi', variant: 'warning' as const };
};

const getProofTypeLabel = (type: string) => (type === 'dp' ? 'DP' : type === 'partial' ? 'Cicilan' : 'Lunas');

const AccountingAgingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<AccountingAgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [wilayahId, setWilayahId] = useState('');
  const [provinsiId, setProvinsiId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [search, setSearch] = useState('');
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [provinsiList, setProvinsiList] = useState<{ id: string; name: string; wilayah_id?: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedBucketTab, setSelectedBucketTab] = useState<BucketTab>('all');
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'invoice' | 'payments'>('invoice');
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});

  const buildParams = useCallback(() => {
    const params: Record<string, string | number> = {};
    if (branchId) params.branch_id = branchId;
    else if (provinsiId) params.provinsi_id = provinsiId;
    else if (wilayahId) params.wilayah_id = wilayahId;
    if (ownerId) params.owner_id = ownerId;
    if (status) params.status = status;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (dueFrom) params.due_from = dueFrom;
    if (dueTo) params.due_to = dueTo;
    if (search.trim()) params.search = search.trim();
    params.page = page;
    params.limit = limit;
    params.bucket = selectedBucketTab;
    return params;
  }, [branchId, provinsiId, wilayahId, ownerId, status, dateFrom, dateTo, dueFrom, dueTo, search, page, limit, selectedBucketTab]);

  const fetchAging = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.getAgingReport(buildParams());
      if (res.data.success && res.data.data) setData(res.data.data);
      else setData(null);
    } catch {
      setData(null);
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
          name: p.name || p.nama || '',
          wilayah_id: p.wilayah_id ? String(p.wilayah_id) : undefined
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
    fetchAging();
  }, [fetchAging]);

  const resetFilters = () => {
    setWilayahId('');
    setProvinsiId('');
    setBranchId('');
    setOwnerId('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setDueFrom('');
    setDueTo('');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = wilayahId || provinsiId || branchId || ownerId || status || dateFrom || dateTo || dueFrom || dueTo || search.trim();

  const filteredProvinsi = wilayahId ? provinsiList.filter((p) => p.wilayah_id === wilayahId) : provinsiList;

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const res = await accountingApi.exportAgingExcel(buildParams());
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `piutang-usaha-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      const res = await accountingApi.exportAgingPdf(buildParams());
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `piutang-usaha-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal export PDF');
    } finally {
      setExporting(null);
    }
  };

  const fetchInvoiceDetail = async (id: string) => {
    try {
      const res = await invoicesApi.getById(id);
      if (res.data.success) setViewInvoice(res.data.data);
    } catch {
      showToast('Gagal memuat detail invoice', 'error');
    }
  };

  const fetchInvoicePdf = useCallback(async (invoiceId: string) => {
    setLoadingPdf(true);
    setInvoicePdfUrl(null);
    try {
      const res = await invoicesApi.getPdf(invoiceId);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      setInvoicePdfUrl(url);
    } catch {
      showToast('Gagal memuat PDF invoice', 'error');
    } finally {
      setLoadingPdf(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (viewInvoice && detailTab === 'invoice') {
      fetchInvoicePdf(viewInvoice.id);
    }
  }, [viewInvoice?.id, detailTab, fetchInvoicePdf]);

  useEffect(() => {
    businessRulesApi.get({}).then((r) => {
      if (r.data?.data?.currency_rates) {
        const cr = r.data.data.currency_rates;
        setCurrencyRates(typeof cr === 'string' ? JSON.parse(cr) : cr);
      }
    }).catch(() => {});
  }, []);

  const handleVerifyPayment = async (invoiceId: string, paymentProofId: string, verified: boolean) => {
    setVerifyingId(paymentProofId);
    try {
      const res = await invoicesApi.verifyPayment(invoiceId, { payment_proof_id: paymentProofId, verified });
      showToast(verified ? 'Pembayaran dikonfirmasi' : 'Pembayaran ditolak', 'success');
      if (res.data?.success && res.data?.data) {
        setViewInvoice(res.data.data);
        fetchAging();
      }
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal', 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleUnblock = async (inv: any) => {
    try {
      const res = await invoicesApi.unblock(inv.id);
      showToast('Invoice diaktifkan kembali', 'success');
      closeModal();
      fetchAging();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unblock', 'error');
    }
  };

  const closeModal = useCallback(() => {
    if (invoicePdfUrl) {
      URL.revokeObjectURL(invoicePdfUrl);
      setInvoicePdfUrl(null);
    }
    setViewInvoice(null);
  }, [invoicePdfUrl]);

  const openPdf = async (invoiceId: string) => {
    try {
      const res = await invoicesApi.getPdf(invoiceId);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unduh PDF', 'error');
    }
  };

  const buckets = data?.buckets ?? { current: [], days_1_30: [], days_31_60: [], days_61_plus: [] };
  const totals = data?.totals ?? { current: 0, days_1_30: 0, days_31_60: 0, days_61_plus: 0 };
  const bucketCounts = data?.bucket_counts ?? {
    current: buckets.current.length,
    days_1_30: buckets.days_1_30.length,
    days_31_60: buckets.days_31_60.length,
    days_61_plus: buckets.days_61_plus.length
  };
  const apiItems = data?.items ?? [];
  const apiPagination = data?.pagination ?? { total: 0, page: 1, limit: 25, totalPages: 1 };
  // Gunakan items dari API; fallback ke buckets jika items kosong (backward compat / edge case)
  const items = apiItems.length > 0
    ? apiItems
    : (() => {
        const combined = selectedBucketTab === 'all'
          ? [...buckets.current, ...buckets.days_1_30, ...buckets.days_31_60, ...buckets.days_61_plus]
          : buckets[selectedBucketTab] || [];
        const start = (apiPagination.page - 1) * apiPagination.limit;
        return combined.slice(start, start + apiPagination.limit);
      })();
  const fallbackTotal = selectedBucketTab === 'all'
    ? buckets.current.length + buckets.days_1_30.length + buckets.days_31_60.length + buckets.days_61_plus.length
    : (buckets[selectedBucketTab] || []).length;
  const pagination = apiItems.length > 0
    ? apiPagination
    : { total: fallbackTotal, page: apiPagination.page, limit: apiPagination.limit, totalPages: Math.max(1, Math.ceil(fallbackTotal / apiPagination.limit)) };

  const bucketTabs: { key: BucketTab; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'current', label: 'Belum Jatuh Tempo' },
    { key: 'days_1_30', label: 'Terlambat 1–30' },
    { key: 'days_31_60', label: 'Terlambat 31–60' },
    { key: 'days_61_plus', label: 'Terlambat 61+' }
  ];

  useEffect(() => {
    setPage(1);
  }, [selectedBucketTab, limit]);

  useEffect(() => {
    setPage(1);
  }, [branchId, provinsiId, wilayahId, ownerId, status, dateFrom, dateTo, dueFrom, dueTo, search]);

  const getStatusBadgeVariant = (s: string) => {
    if (['paid', 'completed', 'confirmed'].includes(s)) return 'success';
    if (['overdue', 'canceled', 'cancelled'].includes(s)) return 'error';
    if (['partial_paid', 'tentative', 'processing'].includes(s)) return 'warning';
    return 'default';
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
      paid: 'success', partial_paid: 'warning', tentative: 'default', draft: 'info', confirmed: 'info',
      processing: 'info', completed: 'success', overdue: 'error', canceled: 'error', cancelled: 'error',
      refunded: 'default', order_updated: 'warning', overpaid: 'warning', overpaid_transferred: 'info',
      overpaid_received: 'info', refund_canceled: 'error', overpaid_refund_pending: 'warning'
    };
    return (map[status] || 'default') as 'success' | 'warning' | 'info' | 'error' | 'default';
  };

  const canUnblock = (inv: any) =>
    inv?.is_blocked && ['invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'super_admin', 'role_accounting'].includes(user?.role || '');

  const canVerify = ['admin_pusat', 'role_accounting', 'super_admin'].includes(user?.role || '');

  const rates = viewInvoice?.currency_rates || currencyRates;
  const sarToIdr = rates.SAR_TO_IDR || 4200;
  const usdToIdr = rates.USD_TO_IDR || 15500;

  const paymentProofs = viewInvoice?.PaymentProofs || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Piutang Usaha (AR)</h1>
          <p className="text-slate-600 mt-1">Aging piutang: belum jatuh tempo, 1–30 hari, 31–60 hari, 61+ hari</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filter {hasActiveFilters && <span className="ml-1 px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">aktif</span>}
          </Button>
          {hasActiveFilters && <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>}
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!!exporting}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!!exporting}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="primary" size="sm" onClick={fetchAging} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="bg-slate-50/80">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter Data
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Wilayah</label>
              <select
                value={wilayahId}
                onChange={(e) => {
                  setWilayahId(e.target.value);
                  setProvinsiId('');
                  setBranchId('');
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Semua wilayah</option>
                {wilayahList.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provinsi</label>
              <select
                value={provinsiId}
                onChange={(e) => {
                  setProvinsiId(e.target.value);
                  setBranchId('');
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Semua provinsi</option>
                {filteredProvinsi.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cabang</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Semua cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Owner / Partner</label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">Semua owner</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.name || 'Owner'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status Invoice</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">Semua status (Piutang)</option>
                {INVOICE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{INVOICE_STATUS_LABELS[s] || s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Buat (dari)</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Buat (sampai)</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Jatuh Tempo (dari)</label>
              <input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Jatuh Tempo (sampai)</label>
              <input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Cari (No. Order / Partner)</label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="No. order atau nama partner..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="flex items-end">
              <Button variant="primary" onClick={fetchAging} disabled={loading}>{loading ? 'Memuat...' : 'Terapkan'}</Button>
            </div>
          </div>
        </Card>
      )}

      {loading && !data && <div className="text-center py-12 text-slate-500">Memuat...</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <p className="text-sm text-slate-600">Total Piutang</p>
              <p className="text-xl font-bold text-amber-600">{formatIDR(data.total_outstanding)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-600">Belum Jatuh Tempo</p>
              <p className="text-lg font-bold text-slate-800">{formatIDR(totals.current)}</p>
              <p className="text-xs text-slate-500">{bucketCounts.current} invoice</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-600">Terlambat 1–30</p>
              <p className="text-lg font-bold text-amber-600">{formatIDR(totals.days_1_30)}</p>
              <p className="text-xs text-slate-500">{bucketCounts.days_1_30} invoice</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-600">Terlambat 31–60</p>
              <p className="text-lg font-bold text-orange-600">{formatIDR(totals.days_31_60)}</p>
              <p className="text-xs text-slate-500">{bucketCounts.days_31_60} invoice</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-600">Terlambat 61+</p>
              <p className="text-lg font-bold text-red-600">{formatIDR(totals.days_61_plus)}</p>
              <p className="text-xs text-slate-500">{bucketCounts.days_61_plus} invoice</p>
            </Card>
          </div>

          <Card>
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Piutang Usaha ({pagination.total})
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {bucketTabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedBucketTab(key)}
                  className={
                    'px-4 py-2 rounded-lg font-medium text-sm transition-colors ' +
                    (selectedBucketTab === key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
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
                    <th className="pb-2 pr-4">Jatuh Tempo</th>
                    <th className="pb-2 pr-4 text-center">Terlambat</th>
                    <th className="pb-2 pr-4">Bukti Bayar</th>
                    <th className="pb-2 pr-4">Tgl Invoice</th>
                    <th className="pb-2 w-12">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv: any) => (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pr-4 font-mono font-semibold">{formatInvoiceDisplay(inv.status, inv.invoice_number || '-', INVOICE_STATUS_LABELS)}</td>
                      <td className="py-3 pr-4">{inv.User?.name || inv.User?.company_name || '-'}</td>
                      <td className="py-3 pr-4">{inv.Branch?.name || inv.Branch?.code || '-'}</td>
                      <td className="py-3 pr-4 text-right font-medium">{formatIDR(parseFloat(inv.total_amount || 0))}</td>
                      <td className="py-3 pr-4 text-right text-emerald-600 font-medium">{formatIDR(parseFloat(inv.paid_amount || 0))}</td>
                      <td className="py-3 pr-4 text-right text-red-600 font-medium">{formatIDR(parseFloat(inv.remaining_amount || 0))}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={getStatusBadgeVariant(inv.status)}>{INVOICE_STATUS_LABELS[inv.status] || inv.status}</Badge>
                      </td>
                      <td className="py-3 pr-4">{formatDate(inv.due_date_dp)}</td>
                      <td className="py-3 pr-4 text-center">{inv.days_overdue > 0 ? `${inv.days_overdue} hr` : '-'}</td>
                      <td className="py-3 pr-4">
                        {(inv.PaymentProofs?.length ?? 0) === 0 ? (
                          <span className="text-slate-400 text-xs">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {inv.PaymentProofs?.map((p: any) => {
                              const ps = getProofStatus(p);
                              return (
                                <Badge key={p.id} variant={ps.variant} className="text-xs">
                                  {getProofTypeLabel(p.payment_type)} {ps.status === 'verified' ? '✓' : ps.status === 'rejected' ? '✗' : '...'}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">{formatDate(inv.issued_at || inv.created_at)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex justify-center">
                          <ActionsMenu
                            align="right"
                            items={[
                              { id: 'view', label: 'Lihat Invoice', icon: <Eye className="w-4 h-4" />, onClick: () => { setViewInvoice(inv); setDetailTab('invoice'); fetchInvoiceDetail(inv.id); } },
                              { id: 'pdf', label: 'Unduh PDF', icon: <FileText className="w-4 h-4" />, onClick: () => openPdf(inv.id) },
                              { id: 'order', label: 'Order & Invoice', icon: <ExternalLink className="w-4 h-4" />, onClick: () => { const q = inv.Order?.order_number ? '?order_number=' + encodeURIComponent(inv.Order.order_number) : ''; navigate('/dashboard/orders-invoices' + q); } },
                            ] as ActionsMenuItem[]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length === 0 && !loading && <p className="text-slate-500 py-6 text-center">Tidak ada data</p>}
            {pagination.total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50 mt-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">
                    Menampilkan {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}-{Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total}
                  </span>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="px-2 py-1 border border-slate-200 rounded text-slate-700 bg-white text-sm"
                  >
                    {[25, 50, 100, 200, 500].map((n) => (
                      <option key={n} value={n}>{n} per halaman</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1 || loading}
                    className="p-2 rounded border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="py-2 px-3 text-sm text-slate-600">Halaman {pagination.page} / {pagination.totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages || loading}
                    className="p-2 rounded border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modal Detail Invoice - Lengkap seperti Admin Pusat */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Receipt className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Detail Invoice</h2>
                  <p className="text-sm text-slate-600 font-mono">{formatInvoiceDisplay(viewInvoice.status, viewInvoice.invoice_number, INVOICE_STATUS_LABELS)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openPdf(viewInvoice.id)}>
                  <Download className="w-4 h-4 mr-2" /> Unduh PDF
                </Button>
                {canUnblock(viewInvoice) && (
                  <Button variant="secondary" size="sm" onClick={() => handleUnblock(viewInvoice)}>
                    <Unlock className="w-4 h-4 mr-2" /> Aktifkan Kembali
                  </Button>
                )}
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-50/50 px-6">
              <button
                onClick={() => setDetailTab('invoice')}
                className={'flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-colors -mb-px ' + (detailTab === 'invoice' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-600 hover:text-slate-900')}
              >
                <FileSpreadsheet className="w-4 h-4" /> Invoice & Order
              </button>
              <button
                onClick={() => setDetailTab('payments')}
                className={'flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-colors -mb-px ' + (detailTab === 'payments' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-600 hover:text-slate-900')}
              >
                <CreditCard className="w-4 h-4" /> Bukti Bayar
                {paymentProofs.length > 0 && <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">{paymentProofs.length}</span>}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {detailTab === 'invoice' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Data Order</h4>
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-600">Owner</dt><dd className="font-semibold">{viewInvoice.User?.name || viewInvoice.User?.company_name}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Cabang</dt><dd className="font-semibold">{viewInvoice.Branch?.name || viewInvoice.Branch?.code}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Mata Uang</dt><dd className="font-semibold">{viewInvoice.Order?.currency || 'IDR'}</dd></div>
                      </dl>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Data Invoice</h4>
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-600">Status</dt><dd><Badge variant={getStatusBadge(viewInvoice.status)}>{INVOICE_STATUS_LABELS[viewInvoice.status] || viewInvoice.status}</Badge>{viewInvoice.is_blocked && <Badge variant="error" className="ml-1">Block</Badge>}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Total</dt><dd className="font-semibold">{formatIDR(parseFloat(viewInvoice.total_amount || 0))}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">DP ({viewInvoice.dp_percentage || 0}%)</dt><dd className="font-semibold">{formatIDR(parseFloat(viewInvoice.dp_amount || 0))}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Dibayar</dt><dd className="font-semibold text-emerald-600">{formatIDR(parseFloat(viewInvoice.paid_amount || 0))}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Sisa</dt><dd className="font-semibold text-red-600">{formatIDR(parseFloat(viewInvoice.remaining_amount || 0))}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Tgl Invoice</dt><dd>{formatDate(viewInvoice.issued_at || viewInvoice.created_at)}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Jatuh Tempo DP</dt><dd>{formatDate(viewInvoice.due_date_dp)}</dd></div>
                      </dl>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Kurs (untuk pembayaran)</h4>
                      <dl className="space-y-1.5 text-sm text-slate-700">
                        <div>1 SAR = {formatIDR(sarToIdr)} IDR</div>
                        <div>1 USD = {formatIDR(usdToIdr)} IDR</div>
                        {(viewInvoice.Order?.currency === 'SAR' || viewInvoice.Order?.currency === 'USD') && (
                          <div className="pt-2 mt-2 border-t border-emerald-200 font-semibold">
                            Total: {viewInvoice.Order?.currency === 'SAR' && `${(parseFloat(viewInvoice.total_amount || 0) / sarToIdr).toFixed(2)} SAR`}
                            {viewInvoice.Order?.currency === 'USD' && `${(parseFloat(viewInvoice.total_amount || 0) / usdToIdr).toFixed(2)} USD`} = {formatIDR(parseFloat(viewInvoice.total_amount || 0))} IDR
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
                      <span className="font-semibold text-slate-700 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" /> Preview Invoice PDF
                      </span>
                      <Button size="sm" variant="outline" onClick={() => openPdf(viewInvoice.id)}>
                        <ExternalLink className="w-4 h-4 mr-1" /> Buka di tab baru
                      </Button>
                    </div>
                    <div className="h-[400px] min-h-[300px]">
                      {loadingPdf && <div className="flex items-center justify-center h-full text-slate-500"><div className="animate-pulse">Memuat PDF...</div></div>}
                      {!loadingPdf && invoicePdfUrl && <iframe src={invoicePdfUrl} title="Invoice PDF" className="w-full h-full border-0" />}
                      {!loadingPdf && !invoicePdfUrl && <div className="flex items-center justify-center h-full text-slate-500">PDF tidak tersedia</div>}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'payments' && (
                <div className="space-y-6">
                  {paymentProofs.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                      <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600 font-medium">Belum ada bukti pembayaran</p>
                      <p className="text-sm text-slate-500 mt-1">Owner akan mengupload bukti bayar untuk DP atau pelunasan</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paymentProofs.map((p: any) => {
                        const fileUrl = getFileUrl(p.proof_file_url);
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(p.proof_file_url || '');
                        const ps = getProofStatus(p);
                        const isPending = ps.status === 'pending';
                        return (
                          <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-slate-800 capitalize">{getProofTypeLabel(p.payment_type)}</span>
                                <span className="text-emerald-600 font-semibold">{formatIDR(parseFloat(p.amount || 0))}</span>
                                <Badge variant={ps.variant}>{ps.label}</Badge>
                                {p.bank_name && <span className="text-sm text-slate-600">{p.bank_name}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                {fileUrl && (
                                  <a href={fileUrl} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline">
                                    <Download className="w-4 h-4" /> Unduh
                                  </a>
                                )}
                                {isPending && canVerify && (
                                  <>
                                    <Button size="sm" onClick={() => handleVerifyPayment(viewInvoice.id, p.id, true)} disabled={verifyingId === p.id}>
                                      <Check className="w-4 h-4 mr-1" /> Konfirmasi
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleVerifyPayment(viewInvoice.id, p.id, false)} disabled={verifyingId === p.id}>
                                      Tolak
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="p-4 bg-slate-50 min-h-[280px]">
                              {!fileUrl || p.proof_file_url === 'issued-saudi' ? (
                                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Pembayaran via Saudi (issued by role invoice)</div>
                              ) : isImage ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                                  <img src={fileUrl} alt="Bukti bayar" className="max-w-full max-h-72 object-contain rounded-lg border border-slate-200" />
                                </a>
                              ) : (
                                <iframe src={fileUrl} title={'Bukti bayar ' + p.payment_type} className="w-full h-72 border border-slate-200 rounded-lg bg-white" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50">
              <Button variant="outline" onClick={closeModal}>Tutup</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingAgingPage;
