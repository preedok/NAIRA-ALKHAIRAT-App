import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, RefreshCw, Eye, Download, ClipboardList, Inbox, Send, Loader2, Check, CheckCircle, Search, User, MapPin, Play, FileSpreadsheet } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBoxLg } from '../../../components/common/Modal';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { Input, Autocomplete, ContentLoading, NominalDisplay } from '../../../components/common';
import { visaApi, invoicesApi, ordersApi } from '../../../services/api';
import type { VisaDashboardData } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { API_BASE_URL, INVOICE_STATUS_LABELS, AUTOCOMPLETE_FILTER, PROGRESS_INVOICE_TABLE_COLUMNS } from '../../../utils/constants';
import { formatIDR } from '../../../utils';
import { formatInvoiceNumberDisplay } from '../../../utils/formatters';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant } from '../../../components/common/InvoiceStatusRefundCell';
import Badge from '../../../components/common/Badge';
import { PROGRESS_STATUS_OPTIONS_VISA, PROGRESS_LABELS_VISA } from '../../../components/common/InvoiceProgressStatusCell';
import { DivisionStatCardsWithModal, type DivisionStatItem, ProgressInvoiceTableRow } from '../../../components/common';
import { getProgressDateRange, PROGRESS_DATE_RANGE_OPTIONS, type ProgressDateRangeKey } from '../../../utils/progressDateFilter';

const UPLOAD_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const formatDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const formatDateWithTime = (d: string | null | undefined, time: string | null | undefined) => {
  const dateStr = formatDate(d);
  if (dateStr === '–') return '–';
  const t = (time || '').trim();
  return t ? `${dateStr}, ${t}` : dateStr;
};

/** Satu sumber kebenaran dengan tabel Invoice (InvoiceProgressStatusCell) */
const STATUS_OPTIONS = PROGRESS_STATUS_OPTIONS_VISA;

const RECAP_STATUS_LABELS: Record<string, string> = { ...PROGRESS_LABELS_VISA };

const STATUS_ICONS: Record<string, React.ReactNode> = {
  document_received: <Inbox className="h-5 w-5" />,
  submitted: <Send className="h-5 w-5" />,
  in_process: <Loader2 className="h-5 w-5" />,
  approved: <Check className="h-5 w-5" />,
  issued: <CheckCircle className="h-5 w-5" />
};

const STATUS_CARD_COLORS: Record<string, string> = {
  document_received: 'bg-sky-100 text-sky-600',
  submitted: 'bg-violet-100 text-violet-600',
  in_process: 'bg-amber-100 text-amber-600',
  approved: 'bg-teal-100 text-teal-600',
  issued: 'bg-emerald-100 text-emerald-600'
};

const VisaWorkPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice');
  const qParam = searchParams.get('q');
  const { showToast } = useToast();

  const [currencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({ SAR_TO_IDR: 4200, USD_TO_IDR: 15500 });
  const [dashboard, setDashboard] = useState<VisaDashboardData | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [downloadingVisaItemId, setDownloadingVisaItemId] = useState<string | null>(null);
  const [downloadingJamaahItemId, setDownloadingJamaahItemId] = useState<string | null>(null);
  const [downloadingManifestItemId, setDownloadingManifestItemId] = useState<string | null>(null);
  const [uploadSetIssued, setUploadSetIssued] = useState<Record<string, boolean>>({});
  const [filterDateRange, setFilterDateRange] = useState<ProgressDateRangeKey>('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<string>('');
  const [filterProgressStatus, setFilterProgressStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>(() => qParam || '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [detailDraft, setDetailDraft] = useState<Record<string, { status?: string }>>({});
  const [detailTab, setDetailTab] = useState<'detail' | 'slip'>('detail');

  useEffect(() => {
    setDetailTab('detail');
  }, [detailInvoice?.id]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await visaApi.getDashboard();
      if (res.data.success && res.data.data) setDashboard(res.data.data);
    } catch {
      setDashboard(null);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const params: { status?: string; page?: number; limit?: number } = { page, limit };
      if (filterInvoiceStatus) params.status = filterInvoiceStatus;
      const res = await visaApi.listInvoices(params);
      if (res.data.success) {
        setInvoices(res.data.data || []);
        const pag = (res.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(pag || null);
      }
    } catch {
      setInvoices([]);
      setPagination(null);
    }
  }, [filterInvoiceStatus, page, limit]);

  const refetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchInvoices()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchInvoices]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    setPage(1);
  }, [filterInvoiceStatus]);

  useEffect(() => {
    if (qParam && qParam.trim()) setFilterSearch(qParam.trim());
  }, [qParam]);

  useEffect(() => {
    if (invoiceIdParam) {
      visaApi.getInvoice(invoiceIdParam)
        .then((res: any) => {
          if (res.data.success && res.data.data) {
            setDetailInvoice(res.data.data);
            const invNum = res.data.data.invoice_number;
            if (invNum) setFilterSearch(invNum);
          }
        })
        .catch(() => setDetailInvoice(null));
    } else {
      setDetailInvoice(null);
      setDetailDraft({});
    }
  }, [invoiceIdParam]);

  const visaItems = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'visa') || [];
  useEffect(() => {
    if (visaItems.length) {
      const next: Record<string, { status?: string }> = {};
      visaItems.forEach((item: any) => {
        const prog = item.VisaProgress;
        next[item.id] = { status: prog?.status || 'document_received' };
      });
      setDetailDraft(prev => ({ ...prev, ...next }));
    }
  }, [detailInvoice?.id, visaItems.map((i: any) => i.id).join(',')]);

  const handleProsesVisaItem = (itemId: string) => {
    const d = detailDraft[itemId];
    if (!d) return;
    handleUpdateProgress(itemId, { status: d.status });
  };

  const handleProsesSemua = async () => {
    for (const item of visaItems) {
      const d = detailDraft[item.id];
      if (!d) continue;
      await handleUpdateProgress(item.id, { status: d.status });
    }
  };

  const handleUpdateProgress = async (orderItemId: string, payload: { status?: string; notes?: string }) => {
    setUpdatingId(orderItemId);
    try {
      await visaApi.updateItemProgress(orderItemId, payload);
      if (detailInvoice?.id) {
        const res = await visaApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUploadVisa = async (orderItemId: string, file: File) => {
    if (!file) {
      showToast('Pilih file visa', 'error');
      return;
    }
    setUploadingId(orderItemId);
    try {
      const formData = new FormData();
      formData.append('visa_file', file);
      await visaApi.uploadVisa(orderItemId, formData, uploadSetIssued[orderItemId]);
      showToast('Dokumen visa berhasil diupload.', 'success');
      if (detailInvoice?.id) {
        const res = await visaApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal upload visa', 'error');
    } finally {
      setUploadingId(null);
    }
  };

  const fileUrl = (path: string | undefined) => path ? (path.startsWith('http') ? path : `${UPLOAD_BASE}${path}`) : null;

  /** Unduh file data jamaah via API (stream dari server) — mengatasi "File wasn't available on site" */
  const downloadJamaahFile = async (orderId: string, itemId: string, urlPath?: string) => {
    setDownloadingJamaahItemId(itemId);
    try {
      const res = await ordersApi.getJamaahFile(orderId, itemId);
      const blob = res.data as Blob;
      const name = (urlPath && typeof urlPath === 'string' ? urlPath.replace(/^.*\//, '') : null) || `data-jamaah-${itemId.slice(-6)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('File data jamaah berhasil diunduh', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unduh file', 'error');
    } finally {
      setDownloadingJamaahItemId(null);
    }
  };

  /** Unduh file manifest via API (stream dari server) — mengatasi 404 direct URL */
  const downloadManifestFile = async (invoiceId: string, orderItemId: string) => {
    setDownloadingManifestItemId(orderItemId);
    try {
      const res = await invoicesApi.getManifestFile(invoiceId, orderItemId);
      const blob = res.data as Blob;
      const disp = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const m = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)|filename=["']?([^"'\s;]+)/i);
      const name = (m && (decodeURIComponent((m[1] || m[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) || `manifest-${orderItemId.slice(-6)}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('File manifest berhasil diunduh', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unduh manifest', 'error');
    } finally {
      setDownloadingManifestItemId(null);
    }
  };

  /** Unduh dokumen visa terbit via API (stream dari server) — mengatasi "File wasn't available on site" */
  const downloadVisaDocument = async (invoiceId: string, orderItemId: string) => {
    setDownloadingVisaItemId(orderItemId);
    try {
      const res = await invoicesApi.getVisaFile(invoiceId, orderItemId);
      const blob = res.data as Blob;
      const disp = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const m = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)|filename=["']?([^"'\s;]+)/i);
      const name = (m && (decodeURIComponent((m[1] || m[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) || `dokumen-visa-${orderItemId.slice(-6)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('Dokumen visa berhasil diunduh', 'success');
    } catch (e: any) {
      const msg = e.response?.data?.message || (e.response?.status === 404 ? 'File tidak tersedia di server' : 'Gagal unduh dokumen visa');
      showToast(msg, 'error');
    } finally {
      setDownloadingVisaItemId(null);
    }
  };

  const dateRange = getProgressDateRange(filterDateRange);
  const dateFilteredInvoices = useMemo(() => {
    if (!dateRange) return invoices;
    const from = dateRange.date_from;
    const to = dateRange.date_to;
    return invoices.filter((inv: any) => {
      // Prioritas: tanggal layanan visa = travel_date di meta item visa
      const items = (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'visa');
      const dates = items
        .map((it: any) => {
          const meta = it?.meta && typeof it.meta === 'object' ? it.meta : {};
          const raw = (meta.travel_date || meta.departure_date || '').toString();
          const d = raw.slice(0, 10);
          return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
        })
        .filter(Boolean) as string[];
      const serviceDate = dates.length ? dates.sort()[0] : (inv.issued_at || inv.created_at || '').toString().slice(0, 10);
      return serviceDate >= from && serviceDate <= to;
    });
  }, [invoices, dateRange]);

  const byStatus = useMemo(() => {
    const out: Record<string, number> = {};
    dateFilteredInvoices.forEach((inv: any) => {
      (inv.Order?.OrderItems || [])
        .filter((i: any) => i.type === 'visa')
        .forEach((i: any) => {
          const s = i.VisaProgress?.status || 'document_received';
          out[s] = (out[s] || 0) + 1;
        });
    });
    return out;
  }, [dateFilteredInvoices]);

  const totalInvoices = dateFilteredInvoices.length;
  const totalItems = dateFilteredInvoices.reduce((sum, inv: any) => sum + (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'visa').length, 0);

  const filteredInvoices = useMemo(() => {
    let list = dateFilteredInvoices;
    const q = (filterSearch || '').trim().toLowerCase();
    if (q) {
      list = list.filter((inv: any) => {
        const invNum = (inv.invoice_number || '').toLowerCase();
        const owner = (inv.User?.name || inv.User?.company_name || inv.Order?.User?.name || '').toLowerCase();
        const branch = (inv.Branch?.name || inv.Branch?.code || '').toLowerCase();
        return invNum.includes(q) || owner.includes(q) || branch.includes(q);
      });
    }
    if (filterProgressStatus) {
      list = list.filter((inv: any) => {
        const orderItems = inv.Order?.OrderItems || [];
        return orderItems.some((i: any) => (i.VisaProgress?.status || 'document_received') === filterProgressStatus);
      });
    }
    return list;
  }, [dateFilteredInvoices, filterSearch, filterProgressStatus]);

  const divisionStats = useMemo((): DivisionStatItem[] => {
    const firstRow: DivisionStatItem[] = [
      { id: 'total', label: 'Total Invoice', value: totalInvoices, icon: <ClipboardList className="w-5 h-5" />, iconClassName: 'bg-slate-100 text-slate-600', modalTitle: 'Daftar Invoice – Total Invoice' },
      { id: 'item_visa', label: 'Total Item Visa', value: totalItems, icon: <FileText className="w-5 h-5" />, iconClassName: 'bg-sky-100 text-sky-600', modalTitle: 'Daftar Invoice – Item Visa' }
    ];
    const rest = STATUS_OPTIONS.map((opt) => ({
      id: opt.value,
      label: RECAP_STATUS_LABELS[opt.value] || opt.label,
      value: byStatus[opt.value] ?? 0,
      icon: STATUS_ICONS[opt.value] || <FileText className="w-5 h-5" />,
      iconClassName: STATUS_CARD_COLORS[opt.value] || 'bg-slate-100 text-slate-600',
      modalTitle: `Daftar Invoice – ${RECAP_STATUS_LABELS[opt.value] || opt.value}`
    }));
    return [...firstRow, ...rest];
  }, [totalInvoices, totalItems, byStatus]);

  const getFilteredInvoicesForStat = useCallback((statId: string) => {
    if (statId === 'total' || statId === 'item_visa') return dateFilteredInvoices;
    return dateFilteredInvoices.filter((inv: any) =>
      (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'visa').some((i: any) => (i.VisaProgress?.status || 'document_received') === statId)
    );
  }, [dateFilteredInvoices]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Visa"
        subtitle="Kelola invoice berisi item visa: update status penerbitan (Nusuk) dan upload dokumen visa terbit. Owner dapat mengunduh dokumen di menu Invoice."
        right={<AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />}
      />

      <DivisionStatCardsWithModal
        stats={divisionStats}
        invoices={dateFilteredInvoices}
        getFilteredInvoices={getFilteredInvoicesForStat}
        loading={loading}
        perStatusLabel="Per Status Progress"
        getStatusLabel={getEffectiveInvoiceStatusLabel}
        getStatusBadgeVariant={getEffectiveInvoiceStatusBadgeVariant}
      />

      {/* Filter + Table card — layout konsisten dengan halaman lain */}
      <Card className="travel-card overflow-visible">
        <CardSectionHeader
          icon={<FileText className="w-6 h-6" />}
          title="Daftar Invoice Visa"
          subtitle={pagination ? `${pagination.total} invoice` : `${filteredInvoices.length} invoice. Filter menurut status invoice & progress.`}
          className="mb-4"
        />
        <div className="mb-6 rounded-xl bg-slate-50/80 border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Pengaturan Filter</p>
          <p className="text-xs text-slate-500 mb-3">Filter data menurut tanggal keberangkatan visa (hari ini, 2/3/4/5 hari, 1/2/3 minggu, 1 bulan kedepan)</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {PROGRESS_DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => setFilterDateRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterDateRange === opt.value ? 'bg-[#0D1A63] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end flex-wrap">
            <div className="flex-1 min-w-0 sm:min-w-[220px]">
              <Input label="Cari (invoice / order / owner / cabang)" type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Ketik untuk filter..." icon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <div className="w-full sm:w-52 min-w-0">
              <Autocomplete label="Status Invoice" value={filterInvoiceStatus} onChange={setFilterInvoiceStatus} options={[{ value: '', label: AUTOCOMPLETE_FILTER.SEMUA_STATUS }, ...Object.entries(INVOICE_STATUS_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))]} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_STATUS} />
            </div>
            <div className="w-full sm:w-52 min-w-0">
              <Autocomplete label="Status Progress" value={filterProgressStatus} onChange={setFilterProgressStatus} options={[{ value: '', label: AUTOCOMPLETE_FILTER.SEMUA_PROGRESS }, ...STATUS_OPTIONS]} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_PROGRESS} />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          {loading ? (
            <ContentLoading />
          ) : (
            <Table
              columns={PROGRESS_INVOICE_TABLE_COLUMNS as TableColumn[]}
              data={filteredInvoices}
              renderRow={(inv: any) => (
                <ProgressInvoiceTableRow
                  key={inv.id}
                  inv={inv}
                  currencyRates={currencyRates}
                  formatDate={formatDate}
                  formatDateWithTime={formatDateWithTime}
                  onViewDetail={(i) => setSearchParams({ invoice: i.id })}
                  getStatusLabel={getEffectiveInvoiceStatusLabel}
                  getStatusBadgeVariant={getEffectiveInvoiceStatusBadgeVariant}
                />
              )}
              emptyMessage="Belum ada invoice dengan item visa"
              emptyDescription="Buat order & invoice dari menu Invoice terlebih dahulu."
              stickyActionsColumn
              pagination={pagination ? {
                total: pagination.total,
                page: pagination.page,
                limit: pagination.limit,
                totalPages: pagination.totalPages,
                onPageChange: (p) => setPage(p),
                onLimitChange: (l) => { setLimit(l); setPage(1); }
              } : undefined}
            />
          )}
        </div>
      </Card>

      <Modal open={!!detailInvoice} onClose={() => setSearchParams({})}>
        {detailInvoice && (
          <ModalBoxLg>
            <ModalHeader
              title={formatInvoiceNumberDisplay(detailInvoice, INVOICE_STATUS_LABELS, getEffectiveInvoiceStatusLabel(detailInvoice))}
              subtitle={
                <>
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 opacity-90" />
                    {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name ?? '–'}
                  </span>
                  {(detailInvoice.Branch?.name || detailInvoice.Branch?.code) && (
                    <span className="flex items-center gap-1.5 ml-3">
                      <MapPin className="w-3.5 h-3.5 opacity-90" />
                      {detailInvoice.Branch?.name ?? detailInvoice.Branch?.code}
                    </span>
                  )}
                </>
              }
              icon={<FileText className="w-5 h-5" />}
              onClose={() => setSearchParams({})}
            />
            {(() => {
              const hasSlipEligible = visaItems.some((item: any) => {
                const prog = item.VisaProgress;
                const status = detailDraft[item.id]?.status ?? prog?.status ?? '';
                return status === 'issued';
              });
              return (
                <div className="border-b border-slate-200 bg-slate-50/60 px-6 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailTab('detail')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${detailTab === 'detail' ? 'border-sky-500 text-sky-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    Detail
                  </button>
                  {hasSlipEligible && (
                    <button
                      type="button"
                      onClick={() => setDetailTab('slip')}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${detailTab === 'slip' ? 'border-sky-500 text-sky-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Slip
                    </button>
                  )}
                </div>
              );
            })()}
            <ModalBody className="space-y-6 bg-slate-50/30">
              {detailTab === 'slip' ? (
                <div className="space-y-4">
                  {visaItems
                    .filter((item: any) => (detailDraft[item.id]?.status ?? item.VisaProgress?.status ?? '') === 'issued')
                    .map((item: any) => {
                      const prog = item.VisaProgress;
                      const order = detailInvoice?.Order;
                      const invoiceNumber = detailInvoice?.invoice_number ?? '–';
                      const productName = (item as any).product_name || item.Product?.name || item.Product?.code || 'Visa';
                      const ownerName = order?.User?.name || order?.User?.company_name || '–';
                      const statusLabel = STATUS_OPTIONS.find((s: { value: string }) => s.value === (prog?.status || ''))?.label ?? prog?.status ?? '–';
                      const issuedAt = prog?.issued_at ? new Date(prog.issued_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
                      const hasDoc = !!(prog?.visa_file_url && prog.visa_file_url.trim() && prog.visa_file_url !== 'issued-saudi');
                      const notes = (prog?.notes ?? '').trim() || '–';
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Slip Informasi Visa</p>
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><dt className="text-slate-500">No. Invoice</dt><dd className="font-medium text-slate-900">{invoiceNumber}</dd></div>
                            <div><dt className="text-slate-500">Produk / Paket Visa</dt><dd className="font-medium text-slate-900">{productName}</dd></div>
                            <div><dt className="text-slate-500">Pemesan (Owner)</dt><dd className="font-medium text-slate-900">{ownerName}</dd></div>
                            <div><dt className="text-slate-500">Jumlah</dt><dd className="font-medium text-slate-900">{item.quantity ?? '–'}</dd></div>
                            <div><dt className="text-slate-500">Status Progress</dt><dd className="font-medium text-slate-900">{statusLabel}</dd></div>
                            <div><dt className="text-slate-500">Tanggal Terbit</dt><dd className="font-medium text-slate-900">{issuedAt}</dd></div>
                            <div><dt className="text-slate-500">Dokumen Terbit</dt><dd className="font-medium text-slate-900">{hasDoc ? 'Ada (lihat file 05_Visa_*)' : '–'}</dd></div>
                            <div className="sm:col-span-2"><dt className="text-slate-500">Catatan</dt><dd className="font-medium text-slate-900">{notes}</dd></div>
                          </dl>
                          <p className="text-xs text-slate-400 mt-3">Slip ini digenerate otomatis. Digabungkan ke arsip invoice (Unduh ZIP).</p>
                        </div>
                      );
                    })}
                </div>
              ) : visaItems.map((item: any) => {
                const prog = item.VisaProgress;
                const d = detailDraft[item.id] ?? { status: prog?.status || 'document_received' };
                const status = d.status ?? prog?.status ?? 'document_received';
                const productName = (item as any).product_name || item.Product?.name || item.Product?.code || 'Visa';
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Item card header */}
                    <div className="px-5 py-4 bg-sky-50/50 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-100 text-sky-600 shrink-0">
                          <FileText className="w-6 h-6" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Visa</p>
                          <p className="font-bold text-slate-900">{productName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity}</p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1.5 rounded-lg ${STATUS_CARD_COLORS[status] || 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_OPTIONS.find(s => s.value === status)?.label ?? status}
                        </span>
                        <Button size="sm" variant="primary" onClick={() => handleProsesVisaItem(item.id)} disabled={updatingId === item.id}>
                          {updatingId === item.id ? (
                            <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</>
                          ) : (
                            <><Play className="w-4 h-4 mr-1.5" /> Proses</>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Data jamaah */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Inbox className="w-3.5 h-3.5 text-sky-500" /> Data Jamaah
                        </label>
                        {item.jamaah_data_type && item.jamaah_data_value ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {item.jamaah_data_type === 'link' ? (
                              <a href={item.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline rounded-lg px-3 py-2 bg-sky-50 border border-sky-100">
                                <Download className="w-4 h-4" /> Link Google Drive
                              </a>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={downloadingJamaahItemId === item.id}
                                onClick={() => detailInvoice?.Order?.id && downloadJamaahFile(detailInvoice.Order.id, item.id, item.jamaah_data_value)}
                                className="inline-flex items-center gap-1.5"
                              >
                                {downloadingJamaahItemId === item.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                {downloadingJamaahItemId === item.id ? 'Mengunduh...' : 'Unduh file'}
                              </Button>
                            )}
                          </div>
                        ) : item.manifest_file_url && detailInvoice?.id ? (
                          <Button type="button" size="sm" variant="secondary" disabled={downloadingManifestItemId === item.id} onClick={() => downloadManifestFile(detailInvoice.id, item.id)} className="inline-flex items-center gap-1.5">
                            {downloadingManifestItemId === item.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {downloadingManifestItemId === item.id ? 'Mengunduh...' : 'Unduh manifest'}
                          </Button>
                        ) : (
                          <p className="text-sm text-amber-600">Data jamaah belum diupload oleh owner (ZIP atau link di form invoice).</p>
                        )}
                      </div>

                      {/* Status Pekerjaan */}
                      <div className="rounded-xl border border-slate-100 bg-white p-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-sky-500" /> Status Pekerjaan
                        </label>
                        <select
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={status}
                          onChange={(e) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), status: e.target.value } }))}
                          disabled={updatingId === item.id}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Upload dokumen visa — hanya tampil ketika status Terbit */}
                      {status === 'issued' && (
                        <div className="rounded-xl border border-slate-100 bg-white p-4">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-sky-500" /> {prog?.visa_file_url ? 'Upload ulang dokumen visa' : 'Dokumen visa (upload)'}
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500 bg-white">
                              <input
                                type="file"
                                accept=".pdf,.xlsx,.xls,.doc,.docx,image/*"
                                className="sr-only"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadVisa(item.id, f);
                                  e.target.value = '';
                                }}
                                disabled={uploadingId === item.id}
                              />
                              {uploadingId === item.id ? <RefreshCw className="w-4 h-4 animate-spin text-slate-500" /> : <Download className="w-4 h-4 text-sky-500" />}
                              {uploadingId === item.id ? 'Mengunggah...' : 'Pilih file'}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={uploadSetIssued[item.id] ?? false}
                                onChange={(e) => setUploadSetIssued(prev => ({ ...prev, [item.id]: e.target.checked }))}
                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              Set status Terbit & kirim notifikasi
                            </label>
                          </div>
                          {prog?.visa_file_url && detailInvoice?.id && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-xs font-medium text-slate-500 mb-1">Dokumen terunggah</p>
                              <button
                                type="button"
                                onClick={() => downloadVisaDocument(detailInvoice.id, item.id)}
                                disabled={downloadingVisaItemId === item.id}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:underline bg-transparent border-0 cursor-pointer p-0 disabled:opacity-60"
                              >
                                {downloadingVisaItemId === item.id ? (
                                  <><RefreshCw className="w-4 h-4 animate-spin" /> Mengunduh…</>
                                ) : (
                                  <><Download className="w-4 h-4" /> Unduh dokumen visa</>
                                )}
                              </button>
                            </div>
                          )}
                          {prog?.issued_at && (
                            <p className="text-xs text-slate-500 mt-2">Terbit: {new Date(prog.issued_at).toLocaleString('id-ID')}</p>
                          )}
                        </div>
                      )}

                      {updatingId === item.id && (
                        <p className="flex items-center gap-2 text-sm text-slate-500">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </ModalBody>
            {detailTab === 'detail' && (
            <ModalFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80">
              <p className="text-sm text-slate-600">Perubahan input hanya tersimpan setelah Anda klik <strong>Proses</strong> (per item) atau <strong>Proses semua</strong> di bawah.</p>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={handleProsesSemua} disabled={!!updatingId || visaItems.length === 0}>
                  {updatingId ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : <><Play className="w-4 h-4 mr-2" /> Proses semua</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSearchParams({})} className="rounded-xl">
                  Tutup
                </Button>
              </div>
            </ModalFooter>
            )}
          </ModalBoxLg>
        )}
      </Modal>
    </div>
  );
};

export default VisaWorkPage;
