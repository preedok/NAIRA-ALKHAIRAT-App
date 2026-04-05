import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  ClipboardList,
  FileText,
  Clock,
  CheckCircle,
  Search,
  Play,
  Download,
  User,
  MapPin,
  Loader
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBoxLg } from '../../../components/common/Modal';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { Input, Autocomplete, CardSectionHeader, ContentLoading } from '../../../components/common';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import { siskopatuhApi, ordersApi, invoicesApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { INVOICE_STATUS_LABELS, AUTOCOMPLETE_FILTER, PROGRESS_INVOICE_TABLE_COLUMNS } from '../../../utils/constants';
import { formatInvoiceNumberDisplay } from '../../../utils';
import { getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant } from '../../../components/common/InvoiceStatusRefundCell';
import { DivisionStatCardsWithModal, type DivisionStatItem, ProgressInvoiceTableRow } from '../../../components/common';
import { getProgressDateRange, PROGRESS_DATE_RANGE_OPTIONS, type ProgressDateRangeKey } from '../../../utils/progressDateFilter';

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
const formatDateWithTime = (d: string | null | undefined, time: string | null | undefined) => {
  const dateStr = formatDate(d);
  if (dateStr === '–') return '–';
  const t = (time || '').trim();
  return t ? `${dateStr}, ${t}` : dateStr;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'in_progress', label: 'Dalam Proses' },
  { value: 'completed', label: 'Selesai' }
];

const RECAP_STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu',
  in_progress: 'Dalam Proses',
  completed: 'Selesai'
};

const RECAP_STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-5 h-5" />,
  in_progress: <Loader className="w-5 h-5" />,
  completed: <CheckCircle className="w-5 h-5" />
};

const RECAP_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-600',
  in_progress: 'bg-sky-100 text-sky-600',
  completed: 'bg-emerald-100 text-emerald-600'
};

function getSiskopatuhItemStatus(item: any): string {
  const st = item?.meta && typeof item.meta === 'object' ? item.meta.siskopatuh_status : null;
  if (st === 'completed' || st === 'in_progress' || st === 'pending') return st;
  return 'pending';
}

function getSiskopatuhFileUrlFromItem(item: any): string {
  const m = item?.meta && typeof item.meta === 'object' ? item.meta : {};
  return String((m as Record<string, unknown>).siskopatuh_file_url ?? '').trim();
}

const SiskopatuhWorkPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice');
  const legacyInvoiceId = searchParams.get('invoice_id');
  const qParam = searchParams.get('q');
  const { showToast } = useToast();

  const [currencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({ SAR_TO_IDR: 4200, USD_TO_IDR: 15500 });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [downloadingJamaahItemId, setDownloadingJamaahItemId] = useState<string | null>(null);
  const [downloadingManifestItemId, setDownloadingManifestItemId] = useState<string | null>(null);
  const [uploadingSiskopatuhDocId, setUploadingSiskopatuhDocId] = useState<string | null>(null);
  const [downloadingSiskopatuhDocId, setDownloadingSiskopatuhDocId] = useState<string | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<ProgressDateRangeKey>('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<string>('');
  const [filterProgressStatus, setFilterProgressStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>(() => qParam || '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [detailDraft, setDetailDraft] = useState<Record<string, { siskopatuh_status?: string }>>({});

  useEffect(() => {
    if (legacyInvoiceId && !invoiceIdParam) {
      setSearchParams({ invoice: legacyInvoiceId }, { replace: true });
    }
  }, [legacyInvoiceId, invoiceIdParam, setSearchParams]);

  const fetchInvoices = useCallback(async () => {
    try {
      const params: { status?: string; page?: number; limit?: number } = { page, limit };
      if (filterInvoiceStatus) params.status = filterInvoiceStatus;
      const res = await siskopatuhApi.listInvoices(params);
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
    fetchInvoices().finally(() => setLoading(false));
  }, [fetchInvoices]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  useEffect(() => {
    setPage(1);
  }, [filterInvoiceStatus]);

  useEffect(() => {
    if (invoiceIdParam) {
      siskopatuhApi
        .getInvoice(invoiceIdParam)
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

  useEffect(() => {
    if (qParam && qParam.trim()) setFilterSearch(qParam.trim());
  }, [qParam]);

  const siskItems = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'siskopatuh') || [];
  useEffect(() => {
    if (siskItems.length) {
      const next: Record<string, { siskopatuh_status?: string }> = {};
      siskItems.forEach((item: any) => {
        next[item.id] = { siskopatuh_status: getSiskopatuhItemStatus(item) };
      });
      setDetailDraft((prev) => ({ ...prev, ...next }));
    }
  }, [detailInvoice?.id, siskItems.map((i: any) => i.id).join(',')]);

  const handleProsesItem = (itemId: string) => {
    const d = detailDraft[itemId];
    const st = d?.siskopatuh_status;
    if (!st) return;
    handleUpdateProgress(itemId, st as 'pending' | 'in_progress' | 'completed');
  };

  const handleProsesSemua = async () => {
    for (const item of siskItems) {
      const d = detailDraft[item.id];
      const st = d?.siskopatuh_status;
      if (!st) continue;
      await handleUpdateProgress(item.id, st as 'pending' | 'in_progress' | 'completed');
    }
  };

  const handleUpdateProgress = async (orderItemId: string, siskopatuh_status: 'pending' | 'in_progress' | 'completed') => {
    setUpdatingId(orderItemId);
    try {
      await siskopatuhApi.updateOrderItemProgress(orderItemId, { siskopatuh_status });
      if (detailInvoice?.id) {
        const res = await siskopatuhApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
      showToast('Status siskopatuh disimpan.', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const downloadJamaahFile = async (orderId: string, itemId: string, urlPath?: string) => {
    setDownloadingJamaahItemId(itemId);
    try {
      const res = await ordersApi.getJamaahFile(orderId, itemId);
      const blob = res.data as Blob;
      const name =
        (urlPath && typeof urlPath === 'string' ? urlPath.replace(/^.*\//, '') : null) || `data-jamaah-${itemId.slice(-6)}.xlsx`;
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

  const downloadManifestFile = async (invoiceId: string, orderItemId: string) => {
    setDownloadingManifestItemId(orderItemId);
    try {
      const res = await invoicesApi.getManifestFile(invoiceId, orderItemId);
      const blob = res.data as Blob;
      const disp = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const m = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)|filename=["']?([^"'\s;]+)/i);
      const name =
        (m && (decodeURIComponent((m[1] || m[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) ||
        `manifest-${orderItemId.slice(-6)}`;
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

  const downloadSiskopatuhDocument = async (invoiceId: string, orderItemId: string) => {
    setDownloadingSiskopatuhDocId(orderItemId);
    try {
      const res = await invoicesApi.getSiskopatuhFile(invoiceId, orderItemId);
      const blob = res.data as Blob;
      const disp = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const m = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)|filename=["']?([^"'\s;]+)/i);
      const name =
        (m && (decodeURIComponent((m[1] || m[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) ||
        `siskopatuh-${orderItemId.slice(-6)}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('Dokumen siskopatuh berhasil diunduh', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unduh dokumen', 'error');
    } finally {
      setDownloadingSiskopatuhDocId(null);
    }
  };

  const handleUploadSiskopatuhDocument = async (orderItemId: string, file: File) => {
    if (!file) return;
    setUploadingSiskopatuhDocId(orderItemId);
    try {
      const fd = new FormData();
      fd.append('siskopatuh_file', file);
      await siskopatuhApi.uploadSiskopatuhDocument(orderItemId, fd);
      showToast('Dokumen siskopatuh berhasil diupload. Owner dapat mengunduh dari menu Invoice.', 'success');
      if (detailInvoice?.id) {
        const res = await siskopatuhApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal upload dokumen', 'error');
    } finally {
      setUploadingSiskopatuhDocId(null);
    }
  };

  const dateRange = getProgressDateRange(filterDateRange);
  const dateFilteredInvoices = useMemo(() => {
    if (!dateRange) return invoices;
    const from = dateRange.date_from;
    const to = dateRange.date_to;
    return invoices.filter((inv: any) => {
      const items = (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'siskopatuh');
      const dates = items
        .map((it: any) => {
          const meta = it?.meta && typeof it.meta === 'object' ? it.meta : {};
          const raw = (meta.travel_date || meta.service_date || meta.departure_date || '').toString();
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
        .filter((i: any) => i.type === 'siskopatuh')
        .forEach((i: any) => {
          const s = getSiskopatuhItemStatus(i);
          out[s] = (out[s] || 0) + 1;
        });
    });
    return out;
  }, [dateFilteredInvoices]);

  const totalInvoices = dateFilteredInvoices.length;
  const totalItems = dateFilteredInvoices.reduce(
    (sum, inv: any) => sum + (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'siskopatuh').length,
    0
  );

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
        return orderItems.some((i: any) => i.type === 'siskopatuh' && getSiskopatuhItemStatus(i) === filterProgressStatus);
      });
    }
    return list;
  }, [dateFilteredInvoices, filterSearch, filterProgressStatus]);

  const divisionStats = useMemo((): DivisionStatItem[] => {
    const firstRow: DivisionStatItem[] = [
      {
        id: 'total',
        label: 'Total Invoice',
        value: totalInvoices,
        icon: <ClipboardList className="w-5 h-5" />,
        iconClassName: 'bg-slate-100 text-slate-600',
        modalTitle: 'Daftar Invoice – Total Invoice'
      },
      {
        id: 'item_siskopatuh',
        label: 'Item Siskopatuh',
        value: totalItems,
        icon: <FileText className="w-5 h-5" />,
        iconClassName: 'bg-violet-100 text-violet-600',
        modalTitle: 'Daftar Invoice – Item Siskopatuh'
      }
    ];
    const rest = STATUS_OPTIONS.map((opt) => ({
      id: opt.value,
      label: RECAP_STATUS_LABELS[opt.value] || opt.label,
      value: byStatus[opt.value] ?? 0,
      icon: RECAP_STATUS_ICONS[opt.value] || <FileText className="w-5 h-5" />,
      iconClassName: RECAP_STATUS_COLORS[opt.value] || 'bg-slate-100 text-slate-600',
      modalTitle: `Daftar Invoice – ${RECAP_STATUS_LABELS[opt.value] || opt.value}`
    }));
    return [...firstRow, ...rest];
  }, [totalInvoices, totalItems, byStatus]);

  const getFilteredInvoicesForStat = useCallback(
    (statId: string) => {
      if (statId === 'total' || statId === 'item_siskopatuh') return dateFilteredInvoices;
      return dateFilteredInvoices.filter((inv: any) =>
        (inv.Order?.OrderItems || [])
          .filter((i: any) => i.type === 'siskopatuh')
          .some((i: any) => getSiskopatuhItemStatus(i) === statId)
      );
    },
    [dateFilteredInvoices]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Siskopatuh"
        subtitle="Invoice dengan item siskopatuh: filter seperti menu progress lain, ubah status per item, dan akses data jamaah dari modal Detail."
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

      <Card className="travel-card overflow-visible">
        <CardSectionHeader
          icon={<FileText className="w-6 h-6" />}
          title="Daftar Invoice Siskopatuh"
          subtitle={pagination ? `${pagination.total} invoice` : `${filteredInvoices.length} invoice. Filter status invoice & progress siskopatuh.`}
          className="mb-4"
        />
        <div className="mb-6 rounded-xl bg-slate-50/80 border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Pengaturan Filter</p>
          <p className="text-xs text-slate-500 mb-3">
            Filter menurut tanggal layanan (meta travel/service/berangkat) atau tanggal invoice bila kosong
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {PROGRESS_DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => setFilterDateRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterDateRange === opt.value ? 'bg-[#0D1A63] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end flex-wrap">
            <div className="flex-1 min-w-0 sm:min-w-[220px]">
              <Input
                label="Cari (Invoice / Order / Owner / Cabang)"
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="No. invoice, owner, cabang..."
                icon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-full sm:w-52 min-w-0">
              <Autocomplete
                label="Status Invoice"
                value={filterInvoiceStatus}
                onChange={setFilterInvoiceStatus}
                options={[{ value: '', label: AUTOCOMPLETE_FILTER.SEMUA_STATUS }, ...Object.entries(INVOICE_STATUS_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))]}
                emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_STATUS}
              />
            </div>
            <div className="w-full sm:w-52 min-w-0">
              <Autocomplete
                label="Status Progress"
                value={filterProgressStatus}
                onChange={setFilterProgressStatus}
                options={[{ value: '', label: AUTOCOMPLETE_FILTER.SEMUA_PROGRESS }, ...STATUS_OPTIONS]}
                emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_PROGRESS}
              />
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
                  progressAllowedSections={['siskopatuh']}
                />
              )}
              emptyMessage={invoices.length === 0 ? 'Belum ada invoice dengan item siskopatuh' : 'Tidak ada hasil untuk filter ini'}
              emptyDescription={
                invoices.length === 0 ? 'Buat order & invoice dari menu Invoice terlebih dahulu.' : 'Coba ubah kata kunci atau status progress.'
              }
              stickyActionsColumn
              pagination={
                pagination
                  ? {
                      total: pagination.total,
                      page: pagination.page,
                      limit: pagination.limit,
                      totalPages: pagination.totalPages,
                      onPageChange: (p) => setPage(p),
                      onLimitChange: (l) => {
                        setLimit(l);
                        setPage(1);
                      }
                    }
                  : undefined
              }
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
            <ModalBody className="space-y-5">
              {siskItems.map((item: any) => {
                const d = detailDraft[item.id] ?? { siskopatuh_status: getSiskopatuhItemStatus(item) };
                const status = d.siskopatuh_status ?? getSiskopatuhItemStatus(item);
                const serverStatus = getSiskopatuhItemStatus(item);
                const serverCompleted = serverStatus === 'completed';
                const draftSaysCompleted = status === 'completed';
                const productName = item.Product?.name || item.product_name || 'Siskopatuh';
                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50/80 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-violet-100 text-violet-600 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {productName} · Qty {item.quantity}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium mt-1 ${
                              RECAP_STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {RECAP_STATUS_ICONS[status]}
                            {STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" variant="primary" onClick={() => handleProsesItem(item.id)} disabled={updatingId === item.id}>
                        {updatingId === item.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1.5" /> Proses
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> Data jamaah (dari owner)
                        </p>
                        <p className="text-[11px] text-slate-400 mb-2 leading-snug">
                          Ini bukan dokumen hasil Siskopatuh. Owner mengunggah ZIP/link lewat menu <strong>Invoice</strong> (form item). Terpisah dari file hasil kerja Anda di bawah.
                        </p>
                        {item.jamaah_data_type && item.jamaah_data_value ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {item.jamaah_data_type === 'link' ? (
                              <a
                                href={item.jamaah_data_value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5 font-medium"
                              >
                                <Download className="w-4 h-4" /> Buka link
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
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={downloadingManifestItemId === item.id}
                            onClick={() => downloadManifestFile(detailInvoice.id, item.id)}
                            className="inline-flex items-center gap-1.5"
                          >
                            {downloadingManifestItemId === item.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {downloadingManifestItemId === item.id ? 'Mengunduh...' : 'Unduh manifest'}
                          </Button>
                        ) : (
                          <p className="text-sm text-amber-600 flex items-center gap-2">
                            <FileText className="w-4 h-4 shrink-0" />
                            Owner belum mengunggah data jamaah (ZIP atau link) di form Invoice — ini wajar sampai owner mengisi.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Status Pekerjaan</label>
                        <select
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
                          value={status}
                          onChange={(e) =>
                            setDetailDraft((prev) => ({
                              ...prev,
                              [item.id]: { ...(prev[item.id] ?? {}), siskopatuh_status: e.target.value }
                            }))
                          }
                          disabled={updatingId === item.id}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {draftSaysCompleted && !serverCompleted && (
                          <p className="text-xs text-amber-700 mt-2 flex items-start gap-1.5">
                            <span className="shrink-0 font-semibold">!</span>
                            <span>
                              Status &quot;Selesai&quot; di dropdown <strong>belum tersimpan di server</strong>. Klik <strong>Proses</strong> (atau Proses semua) dulu — baru kolom upload dokumen hasil di bawah aktif.
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-3">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5" /> Dokumen hasil Siskopatuh (untuk owner unduh)
                        </p>
                        {!serverCompleted ? (
                          <p className="text-sm text-slate-600">
                            Upload hanya diizinkan setelah status di server = <strong>Selesai</strong>. Set dropdown ke Selesai lalu klik <strong>Proses</strong>.
                          </p>
                        ) : (
                          <>
                            <p className="text-xs text-slate-500">
                              Unggah PDF/ZIP hasil proses. Owner mengunduh dari menu Invoice → tab Progress → <strong>Dokumen Siskopatuh</strong>.
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                              <input
                                type="file"
                                accept=".pdf,.zip,.xlsx,.xls,.doc,.docx,image/*"
                                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-800 hover:file:bg-violet-100 max-w-full"
                                disabled={uploadingSiskopatuhDocId === item.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadSiskopatuhDocument(item.id, f);
                                  e.target.value = '';
                                }}
                              />
                              {getSiskopatuhFileUrlFromItem(item) && detailInvoice?.id && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={downloadingSiskopatuhDocId === item.id}
                                  onClick={() => downloadSiskopatuhDocument(detailInvoice.id, item.id)}
                                  className="inline-flex items-center gap-1.5 shrink-0"
                                >
                                  {downloadingSiskopatuhDocId === item.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Download className="w-4 h-4" />
                                  )}
                                  {downloadingSiskopatuhDocId === item.id ? 'Mengunduh...' : 'Unduh dokumen'}
                                </Button>
                              )}
                            </div>
                            {getSiskopatuhFileUrlFromItem(item) ? (
                              <p className="text-xs text-emerald-700 font-medium">File hasil sudah tersimpan — owner bisa unduh dari Invoice.</p>
                            ) : (
                              <p className="text-xs text-slate-500">Belum ada file hasil di server — pilih file lalu unggah.</p>
                            )}
                            {uploadingSiskopatuhDocId === item.id && <p className="text-xs text-slate-500">Mengunggah…</p>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </ModalBody>
            <ModalFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/dashboard/orders-invoices?tab=invoices&invoice_id=${detailInvoice.id}`)}
                >
                  Buka di menu Invoice
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <p className="text-sm text-slate-600 max-w-md">
                  Perubahan hanya tersimpan setelah klik <strong>Proses</strong> per item atau <strong>Proses semua</strong>.
                </p>
                <Button variant="primary" onClick={handleProsesSemua} disabled={!!updatingId || siskItems.length === 0}>
                  {updatingId ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" /> Proses semua
                    </>
                  )}
                </Button>
              </div>
            </ModalFooter>
          </ModalBoxLg>
        )}
      </Modal>
    </div>
  );
};

export default SiskopatuhWorkPage;
