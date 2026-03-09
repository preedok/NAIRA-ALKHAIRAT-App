import React, { useState, useEffect, useCallback } from 'react';
import { Filter, Download, ExternalLink, Eye, Receipt, FileText, X, FileSpreadsheet, CreditCard, ChevronLeft, ChevronRight, Check, LayoutGrid, Unlock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import PageHeader from '../../../components/common/PageHeader';
import PageFilter from '../../../components/common/PageFilter';
import Table from '../../../components/common/Table';
import TablePagination from '../../../components/common/TablePagination';
import type { TableColumn } from '../../../types';
import { FilterIconButton, Input, Autocomplete, StatCard, CardSectionHeader, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ModalBoxLg, ContentLoading, AutoRefreshControl, NominalDisplay } from '../../../components/common';
import { AUTOCOMPLETE_FILTER } from '../../../utils/constants';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { accountingApi, branchesApi, invoicesApi, businessRulesApi, type AccountingAgingData } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { InvoiceStatusRefundCell, getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant } from '../../../components/common/InvoiceStatusRefundCell';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { PaymentProofCell, getProofStatus, getProofTypeLabel } from '../../../components/common/PaymentProofCell';
import { INVOICE_STATUS_LABELS, INVOICE_TABLE_COLUMN_PROOF } from '../../../utils/constants';
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
  type AgingStatModal = 'total' | 'current' | 'days_1_30' | 'days_31_60' | 'days_61_plus' | null;
  const [agingStatModal, setAgingStatModal] = useState<AgingStatModal>(null);

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

  const hasActiveFilters = !!(wilayahId || provinsiId || branchId || ownerId || status || dateFrom || dateTo || dueFrom || dueTo || search.trim());

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
      const disposition = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)|filename="?([^";\n]+)"?/);
      const filename = (match && (decodeURIComponent((match[1] || match[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) || `invoice-${invoiceId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'invoice.pdf';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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

  const agingColumns: TableColumn[] = [
    { id: 'invoice', label: 'No. Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'company', label: 'Perusahaan', align: 'left' },
    { id: 'total', label: 'Total', align: 'right' },
    { id: 'paid', label: 'Status · Dibayar', align: 'right' },
    { id: 'remaining', label: 'Sisa', align: 'right' },
    { id: 'due', label: 'Jatuh Tempo', align: 'left' },
    { id: 'overdue', label: 'Terlambat', align: 'center' },
    INVOICE_TABLE_COLUMN_PROOF,
    { id: 'issued', label: 'Tgl Invoice', align: 'left' },
    { id: 'actions', label: 'Aksi', align: 'center' }
  ];

  useEffect(() => {
    setPage(1);
  }, [selectedBucketTab, limit]);

  useEffect(() => {
    setPage(1);
  }, [branchId, provinsiId, wilayahId, ownerId, status, dateFrom, dateTo, dueFrom, dueTo, search]);

  const getStatusBadgeVariant = (s: string) => {
    if (['paid', 'completed', 'confirmed'].includes(s)) return 'success';
    if (['overdue', 'canceled', 'cancelled', 'cancelled_refund'].includes(s)) return 'error';
    if (['partial_paid', 'tentative', 'processing'].includes(s)) return 'warning';
    return 'default';
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
      paid: 'success', partial_paid: 'warning', tentative: 'default', draft: 'info', confirmed: 'info',
      processing: 'info', completed: 'success',       overdue: 'error', canceled: 'error', cancelled: 'error', cancelled_refund: 'error',
      refunded: 'default', order_updated: 'warning', overpaid: 'warning', overpaid_transferred: 'info',
      overpaid_received: 'info', refund_canceled: 'error', overpaid_refund_pending: 'warning'
    };
    return (map[status] || 'default') as 'success' | 'warning' | 'info' | 'error' | 'default';
  };

  const canUnblock = (inv: any) =>
    inv?.is_blocked && ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin', 'role_accounting'].includes(user?.role || '');

  const canVerify = ['admin_pusat', 'role_accounting', 'super_admin'].includes(user?.role || '');

  const rates = viewInvoice?.currency_rates || currencyRates;
  const sarToIdr = rates.SAR_TO_IDR || 4200;
  const usdToIdr = rates.USD_TO_IDR || 15500;

  const paymentProofs = viewInvoice?.PaymentProofs || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Piutang Usaha (AR)"
        subtitle="Aging piutang: belum jatuh tempo, 1–30 hari, 31–60 hari, 61+ hari"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <AutoRefreshControl onRefresh={fetchAging} disabled={loading} size="sm" />
            <FilterIconButton open={showFilters} onToggle={() => setShowFilters((v: boolean) => !v)} hasActiveFilters={hasActiveFilters} />
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!!exporting}>
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!!exporting}>
              <Download className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        }
      />

      <PageFilter
        open={showFilters}
        onToggle={() => setShowFilters((v: boolean) => !v)}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
        hideToggleRow
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <Autocomplete label="Wilayah" value={wilayahId} onChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }} options={wilayahList.map((w) => ({ value: w.id, label: w.name }))} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_WILAYAH} />
            <Autocomplete label="Provinsi" value={provinsiId} onChange={(v) => { setProvinsiId(v); setBranchId(''); }} options={filteredProvinsi.map((p) => ({ value: p.id, label: p.name }))} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_PROVINSI} />
            <Autocomplete label="Cabang" value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_CABANG} />
            <Autocomplete label="Owner / Partner" value={ownerId} onChange={setOwnerId} options={owners.map((o) => ({ value: o.id, label: o.name || 'Owner' }))} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_OWNER} />
            <Autocomplete label="Status Invoice" value={status} onChange={setStatus} options={INVOICE_STATUS_OPTIONS.map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] || s }))} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_STATUS} />
            <Input label="Tanggal Buat (dari)" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} fullWidth />
            <Input label="Tanggal Buat (sampai)" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} fullWidth />
            <Input label="Jatuh Tempo (dari)" type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} fullWidth />
            <Input label="Jatuh Tempo (sampai)" type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} fullWidth />
            <div className="sm:col-span-2">
              <Input label="Cari (No. Invoice / Partner)" type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="No. invoice atau nama partner..." fullWidth />
            </div>
          </div>
      </PageFilter>

      <Card className="travel-card min-h-[200px]">
        <CardSectionHeader icon={<Receipt className="w-6 h-6" />} title="Piutang Usaha (AR)" subtitle="Ringkasan piutang dan daftar invoice per bucket." className="mb-4" />
        {loading && !data ? (
          <ContentLoading />
        ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Piutang" value={<NominalDisplay amount={data.total_outstanding} currency="IDR" />} onClick={() => setAgingStatModal('total')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setAgingStatModal('total')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
            <StatCard icon={<CreditCard className="w-5 h-5" />} label="Belum Jatuh Tempo" value={<NominalDisplay amount={totals.current} currency="IDR" />} subtitle={`${bucketCounts.current} invoice`} onClick={() => setAgingStatModal('current')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setAgingStatModal('current')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
            <StatCard icon={<Receipt className="w-5 h-5" />} label="Terlambat 1–30" value={<NominalDisplay amount={totals.days_1_30} currency="IDR" />} subtitle={`${bucketCounts.days_1_30} invoice`} onClick={() => setAgingStatModal('days_1_30')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setAgingStatModal('days_1_30')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
            <StatCard icon={<Receipt className="w-5 h-5" />} label="Terlambat 31–60" value={<NominalDisplay amount={totals.days_31_60} currency="IDR" />} subtitle={`${bucketCounts.days_31_60} invoice`} onClick={() => setAgingStatModal('days_31_60')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setAgingStatModal('days_31_60')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
            <StatCard icon={<Receipt className="w-5 h-5" />} label="Terlambat 61+" value={<NominalDisplay amount={totals.days_61_plus} currency="IDR" />} subtitle={`${bucketCounts.days_61_plus} invoice`} onClick={() => setAgingStatModal('days_61_plus')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setAgingStatModal('days_61_plus')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          </div>

          {agingStatModal && (
            <Modal open onClose={() => setAgingStatModal(null)}>
              <ModalBoxLg>
                <ModalHeader title={agingStatModal === 'total' ? 'Daftar Invoice – Total Piutang' : agingStatModal === 'current' ? 'Daftar Invoice – Belum Jatuh Tempo' : agingStatModal === 'days_1_30' ? 'Daftar Invoice – Terlambat 1–30' : agingStatModal === 'days_31_60' ? 'Daftar Invoice – Terlambat 31–60' : 'Daftar Invoice – Terlambat 61+'} onClose={() => setAgingStatModal(null)} />
                <ModalBody>
                  {(() => {
                    const modalItems = agingStatModal === 'total' ? (data?.items ?? [...(buckets.current || []), ...(buckets.days_1_30 || []), ...(buckets.days_31_60 || []), ...(buckets.days_61_plus || [])]) : (buckets[agingStatModal] || []);
                    const cols: TableColumn[] = [{ id: 'invoice_number', label: 'No. Invoice' }, { id: 'owner', label: 'Owner' }, { id: 'total', label: 'Total' }, { id: 'remaining', label: 'Sisa' }, { id: 'status', label: 'Status' }];
                    return (
                      <Table
                        columns={cols}
                        data={modalItems}
                        emptyMessage="Tidak ada invoice"
                        renderRow={(row: any) => (
                          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-2 px-4 text-sm">{row.invoice_number || '–'}</td>
                            <td className="py-2 px-4 text-sm">{row.User?.name ?? row.User?.company_name ?? '–'}</td>
                            <td className="py-2 px-4 text-sm"><NominalDisplay amount={parseFloat(row.total_amount || 0)} currency="IDR" /></td>
                            <td className="py-2 px-4 text-sm"><NominalDisplay amount={parseFloat(row.remaining_amount || 0)} currency="IDR" /></td>
                            <td className="py-2 px-4"><Badge variant={getEffectiveInvoiceStatusBadgeVariant(row)}>{getEffectiveInvoiceStatusLabel(row)}</Badge></td>
                          </tr>
                        )}
                      />
                    );
                  })()}
                </ModalBody>
              </ModalBoxLg>
            </Modal>
          )}

          <Card>
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Piutang Usaha ({pagination.total})
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {bucketTabs.map(({ key, label }) => (
                <Button
                  key={key}
                  type="button"
                  variant={selectedBucketTab === key ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedBucketTab(key)}
                  className={selectedBucketTab === key ? '' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Table
              columns={agingColumns}
              data={items}
              emptyMessage="Tidak ada data"
              stickyActionsColumn
              renderRow={(inv: any) => (
                <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 align-top">
                    <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan />
                  </td>
                  <td className="py-3 px-4 align-top">{inv.User?.name || inv.User?.company_name || '-'}</td>
                  <td className="py-3 px-4 align-top text-sm">
                    <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium align-top"><NominalDisplay amount={parseFloat(inv.total_amount || 0)} currency="IDR" /></td>
                  <td className="py-3 px-4 text-right align-top">
                    <InvoiceStatusRefundCell inv={inv} align="right" />
                  </td>
                  <td className="py-3 px-4 text-right text-red-600 font-medium align-top"><NominalDisplay amount={parseFloat(inv.remaining_amount || 0)} currency="IDR" /></td>
                  <td className="py-3 px-4 align-top">{formatDate(inv.due_date_dp)}</td>
                  <td className="py-3 px-4 text-center align-top">{inv.days_overdue > 0 ? `${inv.days_overdue} hr` : '-'}</td>
                  <td className="py-3 px-4 align-top">
                    <PaymentProofCell paymentProofs={inv.PaymentProofs} compact />
                  </td>
                  <td className="py-3 px-4 align-top">{formatDate(inv.issued_at || inv.created_at)}</td>
                  <td className="py-3 px-4 align-top">
                    <div className="flex justify-center">
                      <ActionsMenu
                        align="right"
                        items={[
                          { id: 'view', label: 'Lihat Invoice', icon: <Eye className="w-4 h-4" />, onClick: () => { setViewInvoice(inv); setDetailTab('invoice'); fetchInvoiceDetail(inv.id); } },
                          { id: 'pdf', label: 'Unduh PDF', icon: <FileText className="w-4 h-4" />, onClick: () => openPdf(inv.id) },
                          { id: 'order', label: 'Lihat Invoice', icon: <ExternalLink className="w-4 h-4" />, onClick: () => { const q = inv.invoice_number ? '?invoice_number=' + encodeURIComponent(inv.invoice_number) : ''; navigate('/dashboard/orders-invoices' + q); } },
                        ] as ActionsMenuItem[]}
                      />
                    </div>
                  </td>
                </tr>
              )}
            />
            {items.length === 0 && !loading && <p className="text-slate-500 py-6 text-center">Tidak ada data</p>}
            {pagination.total > 0 && (
              <TablePagination
                total={pagination.total}
                page={pagination.page}
                limit={pagination.limit}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                loading={loading}
                limitOptions={[25, 50, 100, 200, 500]}
              />
            )}
          </Card>
        </>
        ) : null}
      </Card>

      {/* Modal Detail Invoice - Lengkap seperti Admin Pusat */}
      {viewInvoice && (
        <Modal open onClose={closeModal}>
          <ModalBoxLg>
            <ModalHeader
              title="Detail Invoice"
              subtitle={<InvoiceNumberCell inv={viewInvoice} statusLabels={INVOICE_STATUS_LABELS} compact />}
              icon={<Receipt className="w-5 h-5" />}
              onClose={closeModal}
            />
            <div className="px-6 pt-2 pb-2 flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => openPdf(viewInvoice.id)}>
                <Download className="w-4 h-4 mr-2" /> Unduh PDF
              </Button>
              {canUnblock(viewInvoice) && (
                <Button variant="secondary" size="sm" onClick={() => handleUnblock(viewInvoice)}>
                  <Unlock className="w-4 h-4 mr-2" /> Aktifkan Kembali
                </Button>
              )}
            </div>

            <ModalBody className="flex-1 overflow-hidden flex flex-col p-0">
            <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 shrink-0 gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDetailTab('invoice')}
                className={'rounded-b-none border-b-2 -mb-px ' + (detailTab === 'invoice' ? 'border-emerald-600 text-emerald-600 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900')}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Invoice & Order
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDetailTab('payments')}
                className={'rounded-b-none border-b-2 -mb-px ' + (detailTab === 'payments' ? 'border-emerald-600 text-emerald-600 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900')}
              >
                <CreditCard className="w-4 h-4 mr-2" /> Bukti Bayar
                {paymentProofs.length > 0 && <span className="ml-1 px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">{paymentProofs.length}</span>}
              </Button>
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
                        <div className="flex justify-between"><dt className="text-slate-600">Status</dt><dd><Badge variant={getEffectiveInvoiceStatusBadgeVariant(viewInvoice)}>{getEffectiveInvoiceStatusLabel(viewInvoice)}</Badge>{viewInvoice.is_blocked && <Badge variant="error" className="ml-1">Block</Badge>}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Total</dt><dd className="font-semibold"><NominalDisplay amount={parseFloat(viewInvoice.total_amount || 0)} currency="IDR" /></dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">DP ({viewInvoice.dp_percentage || 0}%)</dt><dd className="font-semibold"><NominalDisplay amount={parseFloat(viewInvoice.dp_amount || 0)} currency="IDR" /></dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Dibayar</dt><dd className="font-semibold text-emerald-600"><NominalDisplay amount={parseFloat(viewInvoice.paid_amount || 0)} currency="IDR" /></dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Sisa</dt><dd className="font-semibold text-red-600"><NominalDisplay amount={parseFloat(viewInvoice.remaining_amount || 0)} currency="IDR" /></dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Tgl Invoice</dt><dd>{formatDate(viewInvoice.issued_at || viewInvoice.created_at)}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Jatuh Tempo DP</dt><dd>{formatDate(viewInvoice.due_date_dp)}</dd></div>
                      </dl>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Kurs (untuk pembayaran)</h4>
                      <dl className="space-y-1.5 text-sm text-slate-700">
                        <div>1 SAR = <NominalDisplay amount={sarToIdr} currency="IDR" /> IDR</div>
                        <div>1 USD = <NominalDisplay amount={usdToIdr} currency="IDR" /> IDR</div>
                        {(viewInvoice.Order?.currency === 'SAR' || viewInvoice.Order?.currency === 'USD') && (
                          <div className="pt-2 mt-2 border-t border-emerald-200 font-semibold">
                            Total: {viewInvoice.Order?.currency === 'SAR' && `${(parseFloat(viewInvoice.total_amount || 0) / sarToIdr).toFixed(2)} SAR`}
                            {viewInvoice.Order?.currency === 'USD' && `${(parseFloat(viewInvoice.total_amount || 0) / usdToIdr).toFixed(2)} USD`} = <NominalDisplay amount={parseFloat(viewInvoice.total_amount || 0)} currency="IDR" /> IDR
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
                      {loadingPdf && <div className="flex items-center justify-center h-full"><ContentLoading minHeight={300} /></div>}
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
                                <span className="text-emerald-600 font-semibold"><NominalDisplay amount={parseFloat(p.amount || 0)} currency="IDR" /></span>
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
            </ModalBody>

            <ModalFooter>
              <Button variant="outline" onClick={closeModal}>Tutup</Button>
            </ModalFooter>
          </ModalBoxLg>
        </Modal>
      )}
    </div>
  );
};

export default AccountingAgingPage;
