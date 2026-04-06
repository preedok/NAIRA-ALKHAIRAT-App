import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, ClipboardList, Bus, Ticket, MapPin, Plane, RotateCcw, Search, FileSpreadsheet, FileText, AlertCircle, ChevronRight, Play } from 'lucide-react';
import Card from '../../../components/common/Card';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBoxLg } from '../../../components/common/Modal';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import Table from '../../../components/common/Table';
import { Input, Autocomplete, Textarea, ContentLoading, NominalDisplay } from '../../../components/common';
import type { TableColumn } from '../../../types';
import { busApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { INVOICE_STATUS_LABELS, PROGRESS_INVOICE_TABLE_COLUMNS, API_BASE_URL } from '../../../utils/constants';
import { formatInvoiceNumberDisplay } from '../../../utils';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant } from '../../../components/common/InvoiceStatusRefundCell';
import { PROGRESS_STATUS_OPTIONS_BUS } from '../../../components/common/InvoiceProgressStatusCell';
import { DivisionStatCardsWithModal, type DivisionStatItem, ProgressInvoiceTableRow } from '../../../components/common';
import { getProgressDateRange, PROGRESS_DATE_RANGE_OPTIONS, type ProgressDateRangeKey } from '../../../utils/progressDateFilter';

/** Satu sumber kebenaran dengan tabel Invoice (InvoiceProgressStatusCell) */
const TICKET_OPTIONS = PROGRESS_STATUS_OPTIONS_BUS;

const TRIP_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'completed', label: 'Selesai' }
];

/** Status Kedatangan / Kepulangan bus include: pending, di proses, terbit */
const BUS_INCLUDE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'di_proses', label: 'Di proses' },
  { value: 'terbit', label: 'Terbit' }
];

const INVOICE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Semua status' },
  ...Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label }))
];

const formatDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const formatDateWithTime = (d: string | null | undefined, time: string | null | undefined) => {
  const dateStr = formatDate(d);
  if (dateStr === '–') return '–';
  const t = (time || '').trim();
  return t ? `${dateStr}, ${t}` : dateStr;
};

const BusWorkPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice');
  const { showToast } = useToast();
  const [currencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({ SAR_TO_IDR: 4200, USD_TO_IDR: 15500 });

  const [dashboard, setDashboard] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<ProgressDateRangeKey>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTicketStatus, setFilterTicketStatus] = useState<string>('');
  const [filterArrival, setFilterArrival] = useState<string>('');
  const [filterDeparture, setFilterDeparture] = useState<string>('');
  const [filterReturn, setFilterReturn] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const filterChangedOnce = useRef(false);
  type BusItemDraft = { bus_ticket_status?: string; bus_ticket_info?: string; arrival_status?: string; notes?: string };
  type BusIncludeDraft = {
    arrival_status?: string; arrival_bus_number?: string; arrival_date?: string; arrival_time?: string;
    return_status?: string; return_bus_number?: string; return_date?: string; return_time?: string;
    notes?: string;
  };
  const [detailDraft, setDetailDraft] = useState<Record<string, BusItemDraft | BusIncludeDraft>>({});
  const [uploadingTicketFile, setUploadingTicketFile] = useState<'arrival' | 'return' | null>(null);
  const [detailTab, setDetailTab] = useState<'detail' | 'slip'>('detail');

  useEffect(() => {
    setDetailTab('detail');
  }, [detailInvoice?.id]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await busApi.getDashboard();
      if (res.data.success && res.data.data) setDashboard(res.data.data);
    } catch {
      setDashboard(null);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const params: { status?: string; page?: number; limit?: number } = { page, limit };
      if (filterStatus) params.status = filterStatus;
      const res = await busApi.listInvoices(params);
      if (res.data.success) {
        setInvoices(res.data.data || []);
        const pag = (res.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(pag || null);
      }
    } catch {
      setInvoices([]);
      setPagination(null);
    }
  }, [filterStatus, page, limit]);

  const refetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchInvoices()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchInvoices]);

  const dateRange = getProgressDateRange(filterDateRange);
  const dateFilteredInvoices = useMemo(() => {
    if (!dateRange) return invoices;
    const from = dateRange.date_from;
    const to = dateRange.date_to;
    return invoices.filter((inv: any) => {
      // Prioritas: tanggal layanan bus = travel_date di meta item bus
      const items = (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus');
      const dates = items
        .map((it: any) => {
          const meta = it?.meta && typeof it.meta === 'object' ? it.meta : {};
          const raw = (meta.travel_date || '').toString();
          const d = raw.slice(0, 10);
          return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
        })
        .filter(Boolean) as string[];
      const serviceDate = dates.length ? dates.sort()[0] : (inv.issued_at || inv.created_at || '').toString().slice(0, 10);
      return serviceDate >= from && serviceDate <= to;
    });
  }, [invoices, dateRange]);

  const busStatsFromDateFiltered = useMemo(() => {
    let totalItems = 0;
    let ticketPending = 0;
    let ticketIssued = 0;
    let arrivalCompleted = 0;
    let departureCompleted = 0;
    let returnCompleted = 0;
    dateFilteredInvoices.forEach((inv: any) => {
      (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').forEach((i: any) => {
        totalItems += 1;
        const bp = i.BusProgress || {};
        if ((bp.bus_ticket_status || 'pending') === 'pending') ticketPending += 1;
        if (bp.bus_ticket_status === 'issued') ticketIssued += 1;
        if (bp.arrival_status === 'completed') arrivalCompleted += 1;
        if (bp.departure_status === 'completed') departureCompleted += 1;
        if (bp.return_status === 'completed') returnCompleted += 1;
      });
    });
    return { totalItems, ticketPending, ticketIssued, arrivalCompleted, departureCompleted, returnCompleted };
  }, [dateFilteredInvoices]);

  const totalInvoices = dateFilteredInvoices.length;
  const totalItems = busStatsFromDateFiltered.totalItems;
  const ticketPending = busStatsFromDateFiltered.ticketPending;
  const ticketIssued = busStatsFromDateFiltered.ticketIssued;
  const arrivalCompleted = busStatsFromDateFiltered.arrivalCompleted;
  const departureCompleted = busStatsFromDateFiltered.departureCompleted;
  const returnCompleted = busStatsFromDateFiltered.returnCompleted;

  const filteredInvoices = useMemo(() => {
    let list = dateFilteredInvoices;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((inv: any) => {
        const invNum = (inv.invoice_number ?? '').toLowerCase();
        const ownerName = (inv.User?.name ?? inv.Order?.User?.name ?? '').toLowerCase();
        return invNum.includes(q) || ownerName.includes(q);
      });
    }
    if (filterTicketStatus) {
      list = list.filter((inv: any) => {
        const orderItems = inv.Order?.OrderItems || [];
        const busItems = orderItems.filter((i: any) => i.type === 'bus');
        return busItems.some((i: any) => (i.BusProgress?.bus_ticket_status || 'pending') === filterTicketStatus);
      });
    }
    if (filterArrival) {
      list = list.filter((inv: any) => {
        const orderItems = inv.Order?.OrderItems || [];
        const busItems = orderItems.filter((i: any) => i.type === 'bus');
        return busItems.some((i: any) => (i.BusProgress?.arrival_status || 'pending') === filterArrival);
      });
    }
    if (filterDeparture) {
      list = list.filter((inv: any) => {
        const orderItems = inv.Order?.OrderItems || [];
        const busItems = orderItems.filter((i: any) => i.type === 'bus');
        return busItems.some((i: any) => (i.BusProgress?.departure_status || 'pending') === filterDeparture);
      });
    }
    if (filterReturn) {
      list = list.filter((inv: any) => {
        const orderItems = inv.Order?.OrderItems || [];
        const busItems = orderItems.filter((i: any) => i.type === 'bus');
        return busItems.some((i: any) => (i.BusProgress?.return_status || 'pending') === filterReturn);
      });
    }
    return list;
  }, [dateFilteredInvoices, searchQuery, filterTicketStatus, filterArrival, filterDeparture, filterReturn]);

  const divisionStats = useMemo((): DivisionStatItem[] => [
    { id: 'total_order', label: 'Total Order', value: totalInvoices, icon: <ClipboardList className="w-5 h-5" />, iconClassName: 'bg-[#0D1A63] text-white', modalTitle: 'Daftar Invoice – Total Order' },
    { id: 'item_bus', label: 'Item Bus', value: totalItems, icon: <Bus className="w-5 h-5" />, iconClassName: 'bg-slate-100 text-slate-600', modalTitle: 'Daftar Invoice – Item Bus' },
    { id: 'tiket_pending', label: 'Tiket Pending', value: ticketPending, icon: <Ticket className="w-5 h-5" />, iconClassName: 'bg-amber-100 text-amber-600', modalTitle: 'Daftar Invoice – Tiket Pending' },
    { id: 'tiket_issued', label: 'Tiket Terbit', value: ticketIssued, icon: <Ticket className="w-5 h-5" />, iconClassName: 'bg-emerald-100 text-emerald-600', modalTitle: 'Daftar Invoice – Tiket Terbit' },
    { id: 'kedatangan', label: 'Kedatangan', value: arrivalCompleted, icon: <MapPin className="w-5 h-5" />, iconClassName: 'bg-sky-100 text-sky-600', modalTitle: 'Daftar Invoice – Kedatangan' },
    { id: 'keberangkatan', label: 'Keberangkatan', value: departureCompleted, icon: <Plane className="w-5 h-5" />, iconClassName: 'bg-violet-100 text-violet-600', modalTitle: 'Daftar Invoice – Keberangkatan' },
    { id: 'kepulangan', label: 'Kepulangan', value: returnCompleted, icon: <RotateCcw className="w-5 h-5" />, iconClassName: 'bg-teal-100 text-teal-600', modalTitle: 'Daftar Invoice – Kepulangan' }
  ], [totalInvoices, totalItems, ticketPending, ticketIssued, arrivalCompleted, departureCompleted, returnCompleted]);

  const getFilteredInvoicesForStat = useCallback((statId: string) => {
    if (statId === 'total_order' || statId === 'item_bus') return dateFilteredInvoices;
    if (statId === 'tiket_pending') return dateFilteredInvoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.bus_ticket_status || 'pending') === 'pending'));
    if (statId === 'tiket_issued') return dateFilteredInvoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.bus_ticket_status || '') === 'issued'));
    if (statId === 'kedatangan') return dateFilteredInvoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.arrival_status || 'pending') === 'completed'));
    if (statId === 'keberangkatan') return dateFilteredInvoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.departure_status || 'pending') === 'completed'));
    if (statId === 'kepulangan') return dateFilteredInvoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.return_status || 'pending') === 'completed'));
    return dateFilteredInvoices;
  }, [dateFilteredInvoices]);

  const handleExport = useCallback(async (type: 'excel' | 'pdf') => {
    setExporting(type);
    try {
      const res = type === 'excel' ? await busApi.exportExcel() : await busApi.exportPdf();
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-bus-${Date.now()}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Export ${type === 'excel' ? 'Excel' : 'PDF'} berhasil diunduh.`, 'success');
    } catch {
      showToast('Gagal export. Coba lagi.', 'error');
    } finally {
      setExporting(null);
    }
  }, [showToast]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus]);

  useEffect(() => {
    if (!filterChangedOnce.current) {
      filterChangedOnce.current = true;
      return;
    }
    setLoading(true);
    fetchInvoices().finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => {
    if (invoiceIdParam) {
      busApi.getInvoice(invoiceIdParam)
        .then((res: any) => res.data.success && setDetailInvoice(res.data.data))
        .catch(() => setDetailInvoice(null));
    } else {
      setDetailInvoice(null);
      setDetailDraft({});
    }
  }, [invoiceIdParam]);

  const busItems = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'bus') || [];
  const orderItems = detailInvoice?.Order?.OrderItems || [];
  const hasVisa = orderItems.some((i: any) => i.type === 'visa');
  const waiveBusPenalty = !!detailInvoice?.Order?.waive_bus_penalty;
  const visaOnlyOrder = String((detailInvoice?.Order as { bus_service_option?: string })?.bus_service_option || '') === 'visa_only';
  const isBusIncludeOnly = !visaOnlyOrder && busItems.length === 0 && (hasVisa || waiveBusPenalty);
  const ORDER_BUS_INCLUDE_KEY = 'order_bus_include';

  useEffect(() => {
    if (busItems.length) {
      const next: Record<string, BusItemDraft> = {};
      busItems.forEach((item: any) => {
        const prog = item.BusProgress;
        next[item.id] = {
          bus_ticket_status: prog?.bus_ticket_status || 'pending',
          bus_ticket_info: prog?.bus_ticket_info ?? '',
          arrival_status: prog?.arrival_status || 'pending',
          notes: prog?.notes ?? ''
        };
      });
      setDetailDraft(prev => ({ ...prev, ...next }));
    } else if (detailInvoice?.Order && isBusIncludeOnly) {
      const o = detailInvoice.Order as any;
      setDetailDraft(prev => ({
        ...prev,
        [ORDER_BUS_INCLUDE_KEY]: {
          arrival_status: o.bus_include_arrival_status || 'pending',
          arrival_bus_number: o.bus_include_arrival_bus_number ?? '',
          arrival_date: o.bus_include_arrival_date ? String(o.bus_include_arrival_date).slice(0, 10) : '',
          arrival_time: o.bus_include_arrival_time ?? '',
          return_status: o.bus_include_return_status || 'pending',
          return_bus_number: o.bus_include_return_bus_number ?? '',
          return_date: o.bus_include_return_date ? String(o.bus_include_return_date).slice(0, 10) : '',
          return_time: o.bus_include_return_time ?? '',
          notes: o.bus_include_notes ?? ''
        }
      }));
    }
  }, [detailInvoice?.id, detailInvoice?.Order?.bus_include_arrival_status, detailInvoice?.Order?.bus_include_return_status, isBusIncludeOnly, busItems.map((i: any) => i.id).join(',')]);

  const handleProsesItem = (itemId: string) => {
    const d = detailDraft[itemId] as BusItemDraft | undefined;
    if (!d) return;
    handleUpdateProgress(itemId, {
      bus_ticket_status: d.bus_ticket_status,
      bus_ticket_info: d.bus_ticket_info?.trim() || undefined,
      arrival_status: d.arrival_status,
      notes: d.notes?.trim() || undefined
    });
  };

  const handleProsesSemua = async () => {
    for (const item of busItems) {
      const d = detailDraft[item.id] as BusItemDraft | undefined;
      if (!d) continue;
      await handleUpdateProgress(item.id, {
        bus_ticket_status: d.bus_ticket_status,
        bus_ticket_info: d.bus_ticket_info?.trim() || undefined,
        arrival_status: d.arrival_status,
        notes: d.notes?.trim() || undefined
      });
    }
  };

  const handleUpdateProgress = async (orderItemId: string, payload: { bus_ticket_status?: string; bus_ticket_info?: string; arrival_status?: string; notes?: string }) => {
    setUpdatingId(orderItemId);
    try {
      await busApi.updateItemProgress(orderItemId, payload);
      if (detailInvoice?.id) {
        const res = await busApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
      showToast('Status bus berhasil diupdate.', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleProsesOrderBusInclude = async () => {
    const d = detailDraft[ORDER_BUS_INCLUDE_KEY] as BusIncludeDraft | undefined;
    if (!d || !detailInvoice?.id) return;
    setUpdatingId(ORDER_BUS_INCLUDE_KEY);
    try {
      await busApi.updateOrderBusIncludeProgress(detailInvoice.id, {
        arrival_status: d.arrival_status,
        arrival_bus_number: d.arrival_bus_number?.trim() || undefined,
        arrival_date: d.arrival_date?.trim() || undefined,
        arrival_time: d.arrival_time?.trim() || undefined,
        return_status: d.return_status,
        return_bus_number: d.return_bus_number?.trim() || undefined,
        return_date: d.return_date?.trim() || undefined,
        return_time: d.return_time?.trim() || undefined,
        notes: d.notes?.trim() || undefined
      });
      const res = await busApi.getInvoice(detailInvoice.id);
      if (res.data.success) setDetailInvoice(res.data.data);
      refetchAll();
      showToast('Status bus include berhasil disimpan.', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUploadBusIncludeTicketFile = async (file: File, type: 'arrival' | 'return') => {
    if (!detailInvoice?.id) return;
    setUploadingTicketFile(type);
    try {
      await busApi.uploadOrderBusIncludeTicketFile(detailInvoice.id, file, type);
      const res = await busApi.getInvoice(detailInvoice.id);
      if (res.data.success) setDetailInvoice(res.data.data);
      showToast('File tiket berhasil diupload.', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal upload file', 'error');
    } finally {
      setUploadingTicketFile(null);
    }
  };

  const hasBusInvoices = invoices.length > 0;
  const pendingList = dashboard?.pending_list ?? [];
  const completionTotal = totalItems > 0 ? Math.round(((totalItems - pendingList.length) / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bus – Tiket Bis & Perjalanan"
        subtitle="Kelola invoice berisi item bus: status tiket, kedatangan, keberangkatan, kepulangan. Sinkron dengan menu Invoice."
        right={
          <>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={!!exporting || loading} title="Unduh rekap Excel">
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              {exporting === 'excel' ? '...' : 'Excel'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={!!exporting || loading} title="Unduh rekap PDF">
              <FileText className="w-4 h-4 mr-1.5" />
              {exporting === 'pdf' ? '...' : 'PDF'}
            </Button>
            <AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />
          </>
        }
      />

      <DivisionStatCardsWithModal
        stats={divisionStats}
        invoices={dateFilteredInvoices}
        getFilteredInvoices={getFilteredInvoicesForStat}
        loading={loading}
        getStatusLabel={getEffectiveInvoiceStatusLabel}
        getStatusBadgeVariant={getEffectiveInvoiceStatusBadgeVariant}
      />

      {/* Progress ring / summary */}
      {totalItems > 0 && (
        <Card className="border-primary-100 bg-primary-50/30">
          <div className="flex flex-wrap items-center gap-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 min-w-[120px] max-w-[200px] rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-[#0D1A63] rounded-full transition-all" style={{ width: `${Math.min(100, completionTotal)}%` }} />
              </div>
              <span className="text-sm font-medium text-stone-700 tabular-nums">{Math.min(100, completionTotal)}% lengkap</span>
            </div>
            <span className="text-xs text-stone-500">Tiket + Kedatangan + Keberangkatan + Kepulangan semua selesai</span>
          </div>
        </Card>
      )}

      {/* Perlu Tindakan – item belum selesai */}
      {pendingList.length > 0 && (
        <Card className="border-amber-200/60 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-semibold text-stone-900">Perlu Tindakan</h2>
            <span className="text-xs text-stone-500">({pendingList.length} item belum lengkap)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingList.slice(0, 20).map((p: any) => (
              <Button
                key={`${p.order_id}-${p.order_item_id}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const inv = invoices.find((i: any) => i.Order?.id === p.order_id);
                  if (inv) setSearchParams({ invoice: inv.id });
                  else showToast('Invoice tidak ada dalam daftar. Coba reset filter.', 'warning');
                }}
                className="inline-flex items-center gap-1.5 text-left border-amber-200 hover:bg-amber-50"
              >
                <span className="font-mono text-stone-700">{p.invoice_number ?? '–'}</span>
                <span className="text-stone-500">·</span>
                <span className="text-stone-600">{p.owner_name || '–'}</span>
                {p.pic_name ? (
                  <>
                    <span className="text-stone-500">·</span>
                    <span className="text-stone-600">PIC {p.pic_name}</span>
                  </>
                ) : null}
                <span className="text-amber-600">Qty {p.quantity}</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </Button>
            ))}
            {pendingList.length > 20 && (
              <span className="text-xs text-stone-500 self-center">+{pendingList.length - 20} lainnya</span>
            )}
          </div>
        </Card>
      )}

      {/* Filter + Table card — layout konsisten dengan halaman lain */}
      <Card className="travel-card overflow-visible">
        <CardSectionHeader icon={<Bus className="w-6 h-6" />} title="Daftar Invoice Bus" subtitle="Invoice dengan item bus. Filter menurut status invoice, tiket, kedatangan, keberangkatan, kepulangan." className="mb-4" />
        <div className="mb-6 rounded-xl bg-slate-50/80 border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Pengaturan Filter</p>
          <p className="text-xs text-slate-500 mb-3">Filter data menurut tanggal keberangkatan bus (hari ini, 2/3/4/5 hari, 1/2/3 minggu, 1 bulan kedepan)</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {PROGRESS_DATE_RANGE_OPTIONS.map((opt) => (
              <button key={opt.value || 'all'} type="button" onClick={() => setFilterDateRange(opt.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterDateRange === opt.value ? 'bg-[#0D1A63] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-wrap sm:items-end">
          <div className="flex-1 min-w-0 sm:min-w-[180px]">
            <Input
              label="Cari"
              type="text"
              placeholder="No. invoice, order, owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              fullWidth
            />
          </div>
          <div className="w-full sm:w-40 min-w-0">
            <Autocomplete
              label="Status Invoice"
              value={filterStatus}
              onChange={setFilterStatus}
              options={INVOICE_STATUS_FILTER_OPTIONS}
              placeholder="Semua status"
              emptyLabel="Semua status"
              fullWidth
            />
          </div>
          <div className="w-full sm:w-36 min-w-0">
            <Autocomplete
              label="Status Tiket Bis"
              value={filterTicketStatus}
              onChange={setFilterTicketStatus}
              options={TICKET_OPTIONS}
              placeholder="Semua"
              emptyLabel="Semua"
              fullWidth
            />
          </div>
          <div className="w-full sm:w-36 min-w-0">
            <Autocomplete
              label="Status Kedatangan"
              value={filterArrival}
              onChange={setFilterArrival}
              options={TRIP_OPTIONS}
              placeholder="Semua"
              emptyLabel="Semua"
              fullWidth
            />
          </div>
          <div className="w-full sm:w-40 min-w-0">
            <Autocomplete
              label="Status Keberangkatan"
              value={filterDeparture}
              onChange={setFilterDeparture}
              options={TRIP_OPTIONS}
              placeholder="Semua"
              emptyLabel="Semua"
              fullWidth
            />
          </div>
          <div className="w-full sm:w-36 min-w-0">
            <Autocomplete
              label="Status Kepulangan"
              value={filterReturn}
              onChange={setFilterReturn}
              options={TRIP_OPTIONS}
              placeholder="Semua"
              emptyLabel="Semua"
              fullWidth
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
            emptyMessage={invoices.length === 0 ? 'Belum ada invoice dengan item bus' : 'Tidak ada hasil untuk filter ini'}
            emptyDescription={invoices.length === 0 ? 'Buat order & invoice dari menu Order/Invoice terlebih dahulu.' : 'Ubah filter atau kata kunci pencarian.'}
            emptyIcon={<Bus className="w-8 h-8" />}
            stickyActionsColumn
            pagination={pagination ? {
              total: pagination.total,
              page: pagination.page,
              limit: pagination.limit,
              totalPages: pagination.totalPages,
              onPageChange: (p) => setPage(p),
              onLimitChange: (l) => { setLimit(l); setPage(1); }
            } : undefined}
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
                progressAllowedSections={['visa', 'bus']}
              />
            )}
          />
          )}
        </div>
      </Card>

      <Modal open={!!detailInvoice} onClose={() => setSearchParams({})}>
        {detailInvoice && (
          <ModalBoxLg>
            <ModalHeader
              title={formatInvoiceNumberDisplay(detailInvoice, INVOICE_STATUS_LABELS, getEffectiveInvoiceStatusLabel(detailInvoice))}
              subtitle={`Owner: ${detailInvoice.User?.name ?? detailInvoice.Order?.User?.name ?? '–'}`}
              icon={<Bus className="w-5 h-5" />}
              onClose={() => setSearchParams({})}
            />
            {(() => {
              const hasSlipEligible = busItems.length > 0
                ? busItems.some((item: any) => ((detailDraft[item.id] as BusItemDraft)?.bus_ticket_status ?? item.BusProgress?.bus_ticket_status ?? '') === 'issued')
                : isBusIncludeOnly && ((detailInvoice?.Order as any)?.bus_include_arrival_status === 'terbit' || (detailInvoice?.Order as any)?.bus_include_return_status === 'terbit');
              return (
                <div className="border-b border-slate-200 bg-slate-50/60 px-6 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailTab('detail')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${detailTab === 'detail' ? 'border-[#0D1A63] text-[#0D1A63] bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    Detail
                  </button>
                  {hasSlipEligible && (
                    <button
                      type="button"
                      onClick={() => setDetailTab('slip')}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${detailTab === 'slip' ? 'border-[#0D1A63] text-[#0D1A63] bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Slip
                    </button>
                  )}
                </div>
              );
            })()}
            <ModalBody className="space-y-4">
              {detailTab === 'slip' ? (
                <div className="space-y-4">
                  {busItems.length === 0 && isBusIncludeOnly && (() => {
                    const o = detailInvoice?.Order as any;
                    const d = (detailDraft[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft;
                    const arrivalStatus = o?.bus_include_arrival_status ?? d.arrival_status ?? 'pending';
                    const returnStatus = o?.bus_include_return_status ?? d.return_status ?? 'pending';
                    const arrivalLabel = BUS_INCLUDE_STATUS_OPTIONS.find((x: { value: string }) => x.value === arrivalStatus)?.label ?? arrivalStatus;
                    const returnLabel = BUS_INCLUDE_STATUS_OPTIONS.find((x: { value: string }) => x.value === returnStatus)?.label ?? returnStatus;
                    const notes = (o?.bus_include_notes ?? d.notes ?? '').trim() || '–';
                    const hasAnyTerbit = arrivalStatus === 'terbit' || returnStatus === 'terbit';
                    if (!hasAnyTerbit) {
                      return (
                        <p className="text-sm text-slate-600 rounded-lg bg-amber-50 border border-amber-100 p-4">
                          Bus include (dengan visa). Isi status kedatangan/kepulangan di tab Detail dan set ke <strong>Terbit</strong> untuk cetak slip.
                        </p>
                      );
                    }
                    return (
                      <div key="bus-include" className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm space-y-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Slip Bus Include (dengan visa)</p>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div><dt className="text-slate-500">No. Invoice</dt><dd className="font-medium text-slate-900">{detailInvoice?.invoice_number ?? '–'}</dd></div>
                          <div><dt className="text-slate-500">Pemesan (Owner)</dt><dd className="font-medium text-slate-900">{(detailInvoice?.Order as any)?.User?.name ?? '–'}</dd></div>
                        </dl>
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-1">Kedatangan</p>
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><dt className="text-slate-500">Status</dt><dd className="font-medium text-slate-900">{arrivalLabel}</dd></div>
                            {arrivalStatus === 'terbit' && (
                              <>
                                <div><dt className="text-slate-500">Nomor Bus</dt><dd className="font-medium text-slate-900">{(o?.bus_include_arrival_bus_number ?? d.arrival_bus_number ?? '').trim() || '–'}</dd></div>
                                <div><dt className="text-slate-500">Tanggal</dt><dd className="font-medium text-slate-900">{o?.bus_include_arrival_date ? new Date(o.bus_include_arrival_date).toLocaleDateString('id-ID') : (d.arrival_date || '–')}</dd></div>
                                <div><dt className="text-slate-500">Jam</dt><dd className="font-medium text-slate-900">{o?.bus_include_arrival_time ?? d.arrival_time ?? '–'}</dd></div>
                              </>
                            )}
                          </dl>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-1">Kepulangan</p>
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><dt className="text-slate-500">Status</dt><dd className="font-medium text-slate-900">{returnLabel}</dd></div>
                            {returnStatus === 'terbit' && (
                              <>
                                <div><dt className="text-slate-500">Nomor Bus</dt><dd className="font-medium text-slate-900">{(o?.bus_include_return_bus_number ?? d.return_bus_number ?? '').trim() || '–'}</dd></div>
                                <div><dt className="text-slate-500">Tanggal</dt><dd className="font-medium text-slate-900">{o?.bus_include_return_date ? new Date(o.bus_include_return_date).toLocaleDateString('id-ID') : (d.return_date || '–')}</dd></div>
                                <div><dt className="text-slate-500">Jam</dt><dd className="font-medium text-slate-900">{o?.bus_include_return_time ?? d.return_time ?? '–'}</dd></div>
                              </>
                            )}
                          </dl>
                        </div>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm"><div className="sm:col-span-2"><dt className="text-slate-500">Catatan</dt><dd className="font-medium text-slate-900">{notes}</dd></div></dl>
                        <p className="text-xs text-slate-400 mt-3">Slip ini digenerate otomatis. Digabungkan ke arsip invoice (Unduh ZIP).</p>
                      </div>
                    );
                  })()}
                  {busItems.length === 0 && !isBusIncludeOnly ? (
                    <p className="text-sm text-slate-600 rounded-lg bg-amber-50 border border-amber-100 p-4">
                      Invoice ini tidak memiliki item bus untuk slip.
                    </p>
                  ) : null}
                  {busItems.length > 0 ? busItems
                    .filter((item: any) => ((detailDraft[item.id] as BusItemDraft)?.bus_ticket_status ?? item.BusProgress?.bus_ticket_status ?? '') === 'issued')
                    .map((item: any) => {
                      const prog = item.BusProgress;
                      const order = detailInvoice?.Order;
                      const itemDraft = detailDraft[item.id] as BusItemDraft | undefined;
                      const invoiceNumber = detailInvoice?.invoice_number ?? '–';
                      const productName = item.Product?.name || (item as any).product_name || 'Item Bus';
                      const ownerName = order?.User?.name || order?.User?.company_name || '–';
                      const ticketStatusLabel = TICKET_OPTIONS.find((o: { value: string }) => o.value === (prog?.bus_ticket_status || ''))?.label ?? prog?.bus_ticket_status ?? '–';
                      const ticketInfo = (prog?.bus_ticket_info ?? itemDraft?.bus_ticket_info ?? '').trim() || '–';
                      const route = (item.meta?.route || '').toString() || '–';
                      const arrivalLabel = TRIP_OPTIONS.find((o: { value: string }) => o.value === (prog?.arrival_status || ''))?.label ?? prog?.arrival_status ?? '–';
                      const notes = (prog?.notes ?? itemDraft?.notes ?? '').trim() || '–';
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Slip Informasi Bus</p>
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><dt className="text-slate-500">No. Invoice</dt><dd className="font-medium text-slate-900">{invoiceNumber}</dd></div>
                            <div><dt className="text-slate-500">Produk / Paket Bus</dt><dd className="font-medium text-slate-900">{productName}</dd></div>
                            <div><dt className="text-slate-500">Pemesan (Owner)</dt><dd className="font-medium text-slate-900">{ownerName}</dd></div>
                            <div><dt className="text-slate-500">Jumlah</dt><dd className="font-medium text-slate-900">{item.quantity ?? '–'}</dd></div>
                            <div><dt className="text-slate-500">Rute</dt><dd className="font-medium text-slate-900">{route}</dd></div>
                            <div><dt className="text-slate-500">Status Tiket Bis (Pergi & Pulang)</dt><dd className="font-medium text-slate-900">{ticketStatusLabel}</dd></div>
                            <div><dt className="text-slate-500">Nomor Bis</dt><dd className="font-medium text-slate-900">{ticketInfo}</dd></div>
                            <div><dt className="text-slate-500">Status Kedatangan</dt><dd className="font-medium text-slate-900">{arrivalLabel}</dd></div>
                            <div className="sm:col-span-2"><dt className="text-slate-500">Catatan</dt><dd className="font-medium text-slate-900">{notes}</dd></div>
                          </dl>
                          <p className="text-xs text-slate-400 mt-3">Slip ini digenerate otomatis. Digabungkan ke arsip invoice (Unduh ZIP).</p>
                        </div>
                      );
                    }) : null}
                </div>
              ) : isBusIncludeOnly ? (
                (() => {
                  const d = (detailDraft[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft;
                  const arrivalStatus = d.arrival_status ?? 'pending';
                  const returnStatus = d.return_status ?? 'pending';
                  const arrivalTerbit = arrivalStatus === 'terbit';
                  const returnTerbit = returnStatus === 'terbit';
                  const o = detailInvoice?.Order as any;
                  const uploadsBase = (API_BASE_URL.startsWith('http') ? API_BASE_URL : (typeof window !== 'undefined' ? window.location.origin : '') + API_BASE_URL).replace(/\/?$/, '') + '/uploads/';
                  const arrivalFileUrl = o?.bus_include_arrival_ticket_file_url;
                  const returnFileUrl = o?.bus_include_return_ticket_file_url;
                  return (
                    <div className="p-4 border border-amber-200 rounded-xl space-y-4 bg-amber-50/50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-800 flex items-center gap-2">
                          <Bus className="w-4 h-4 text-[#0D1A63]" />
                          Bus include (dengan visa)
                        </p>
                        <Button size="sm" variant="primary" onClick={handleProsesOrderBusInclude} disabled={updatingId === ORDER_BUS_INCLUDE_KEY}>
                          {updatingId === ORDER_BUS_INCLUDE_KEY ? (
                            <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</>
                          ) : (
                            <><Play className="w-4 h-4 mr-1.5" /> Proses</>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-600">Isi status kedatangan dan status kepulangan. Jika terbit, isi nomor bus, tanggal, jam, dan upload file tiket.</p>

                      <div className="space-y-3 rounded-lg border border-amber-100 bg-white/60 p-3">
                        <p className="text-sm font-medium text-slate-700">Status Kedatangan</p>
                        <Autocomplete
                          label=""
                          value={arrivalStatus}
                          onChange={(v) => setDetailDraft(prev => ({ ...prev, [ORDER_BUS_INCLUDE_KEY]: { ...((prev[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft), arrival_status: v ?? 'pending' } }))}
                          options={BUS_INCLUDE_STATUS_OPTIONS}
                          disabled={updatingId === ORDER_BUS_INCLUDE_KEY}
                          fullWidth
                        />
                        {arrivalTerbit && (
                          <>
                            <Input label="Nomor Bus" type="text" placeholder="Contoh: B-01" value={d.arrival_bus_number ?? ''} onChange={(e) => setDetailDraft(prev => ({ ...prev, [ORDER_BUS_INCLUDE_KEY]: { ...((prev[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft), arrival_bus_number: e.target.value } }))} disabled={updatingId === ORDER_BUS_INCLUDE_KEY} fullWidth />
                            <Input label="Tanggal" type="date" value={d.arrival_date ?? ''} onChange={(e) => setDetailDraft(prev => ({ ...prev, [ORDER_BUS_INCLUDE_KEY]: { ...((prev[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft), arrival_date: e.target.value } }))} disabled={updatingId === ORDER_BUS_INCLUDE_KEY} fullWidth />
                            <Input label="Jam" type="time" value={d.arrival_time ?? ''} onChange={(e) => setDetailDraft(prev => ({ ...prev, [ORDER_BUS_INCLUDE_KEY]: { ...((prev[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft), arrival_time: e.target.value } }))} disabled={updatingId === ORDER_BUS_INCLUDE_KEY} fullWidth />
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Upload file tiket kedatangan</label>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-[#0D1A63] file:text-white file:text-sm" disabled={updatingId === ORDER_BUS_INCLUDE_KEY || uploadingTicketFile !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadBusIncludeTicketFile(f, 'arrival'); e.target.value = ''; }} />
                              {uploadingTicketFile === 'arrival' && <p className="text-xs text-amber-600 mt-1">Mengupload...</p>}
                              {arrivalFileUrl && <p className="text-xs text-slate-600 mt-2">File: <a href={arrivalFileUrl.startsWith('http') ? arrivalFileUrl : `${uploadsBase}${arrivalFileUrl.replace(/^\/uploads/, '')}`} target="_blank" rel="noopener noreferrer" className="text-[#0D1A63] underline">Unduh file tiket kedatangan</a></p>}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="space-y-3 rounded-lg border border-amber-100 bg-white/60 p-3">
                        <p className="text-sm font-medium text-slate-700">Status Kepulangan</p>
                        <Autocomplete
                          label=""
                          value={returnStatus}
                          onChange={(v) => setDetailDraft(prev => ({ ...prev, [ORDER_BUS_INCLUDE_KEY]: { ...((prev[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft), return_status: v ?? 'pending' } }))}
                          options={BUS_INCLUDE_STATUS_OPTIONS}
                          disabled={updatingId === ORDER_BUS_INCLUDE_KEY}
                          fullWidth
                        />
                        {returnTerbit && (
                          <>
                            <Input label="Nomor Bus" type="text" placeholder="Contoh: B-01" value={d.return_bus_number ?? ''} onChange={(e) => setDetailDraft(prev => ({ ...prev, [ORDER_BUS_INCLUDE_KEY]: { ...((prev[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft), return_bus_number: e.target.value } }))} disabled={updatingId === ORDER_BUS_INCLUDE_KEY} fullWidth />
                            <Input label="Tanggal" type="date" value={d.return_date ?? ''} onChange={(e) => setDetailDraft(prev => ({ ...prev, [ORDER_BUS_INCLUDE_KEY]: { ...((prev[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft), return_date: e.target.value } }))} disabled={updatingId === ORDER_BUS_INCLUDE_KEY} fullWidth />
                            <Input label="Jam" type="time" value={d.return_time ?? ''} onChange={(e) => setDetailDraft(prev => ({ ...prev, [ORDER_BUS_INCLUDE_KEY]: { ...((prev[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft), return_time: e.target.value } }))} disabled={updatingId === ORDER_BUS_INCLUDE_KEY} fullWidth />
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Upload file tiket kepulangan</label>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-[#0D1A63] file:text-white file:text-sm" disabled={updatingId === ORDER_BUS_INCLUDE_KEY || uploadingTicketFile !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadBusIncludeTicketFile(f, 'return'); e.target.value = ''; }} />
                              {uploadingTicketFile === 'return' && <p className="text-xs text-amber-600 mt-1">Mengupload...</p>}
                              {returnFileUrl && <p className="text-xs text-slate-600 mt-2">File: <a href={returnFileUrl.startsWith('http') ? returnFileUrl : `${uploadsBase}${returnFileUrl.replace(/^\/uploads/, '')}`} target="_blank" rel="noopener noreferrer" className="text-[#0D1A63] underline">Unduh file tiket kepulangan</a></p>}
                            </div>
                          </>
                        )}
                      </div>

                      <Textarea
                        label="Catatan"
                        rows={2}
                        placeholder="Opsional"
                        value={d.notes ?? ''}
                        onChange={(e) => setDetailDraft(prev => ({ ...prev, [ORDER_BUS_INCLUDE_KEY]: { ...((prev[ORDER_BUS_INCLUDE_KEY] ?? {}) as BusIncludeDraft), notes: e.target.value } }))}
                        disabled={updatingId === ORDER_BUS_INCLUDE_KEY}
                        fullWidth
                      />
                    </div>
                  );
                })()
              ) : busItems.length === 0 ? (
                <p className="text-sm text-slate-600 rounded-lg bg-amber-50 border border-amber-100 p-4">
                  Invoice ini tidak memiliki item bus atau bus include.
                </p>
              ) : busItems.map((item: any, idx: number) => {
                const prog = item.BusProgress;
                const d: BusItemDraft = (detailDraft[item.id] as BusItemDraft) ?? {
                  bus_ticket_status: prog?.bus_ticket_status || 'pending',
                  bus_ticket_info: prog?.bus_ticket_info ?? '',
                  arrival_status: prog?.arrival_status || 'pending',
                  notes: prog?.notes ?? ''
                };
                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800 flex items-center gap-2">
                        <Bus className="w-4 h-4 text-[#0D1A63]" />
                        Item Bus #{idx + 1} · Qty: {item.quantity}
                      </p>
                      <Button size="sm" variant="primary" onClick={() => handleProsesItem(item.id)} disabled={updatingId === item.id}>
                        {updatingId === item.id ? (
                          <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</>
                        ) : (
                          <><Play className="w-4 h-4 mr-1.5" /> Proses</>
                        )}
                      </Button>
                    </div>
                    <Autocomplete
                      label="Status Tiket Bis (Pergi & Pulang)"
                      value={d.bus_ticket_status ?? 'pending'}
                      onChange={(v) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...((prev[item.id] ?? {}) as BusItemDraft), bus_ticket_status: v ?? 'pending' } }))}
                      options={TICKET_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    {(d.bus_ticket_status ?? '') === 'issued' && (
                      <Input
                        label="Nomor Bis"
                        type="text"
                        placeholder="Contoh: B-01"
                        value={d.bus_ticket_info ?? ''}
                        onChange={(e) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...((prev[item.id] ?? {}) as BusItemDraft), bus_ticket_info: e.target.value } }))}
                        disabled={updatingId === item.id}
                        fullWidth
                      />
                    )}
                    <Autocomplete
                      label="Status Kedatangan"
                      value={d.arrival_status ?? 'pending'}
                      onChange={(v) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...((prev[item.id] ?? {}) as BusItemDraft), arrival_status: v ?? 'pending' } }))}
                      options={TRIP_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Textarea
                      label="Catatan"
                      rows={2}
                      placeholder="Opsional"
                      value={d.notes ?? ''}
                      onChange={(e) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...((prev[item.id] ?? {}) as BusItemDraft), notes: e.target.value } }))}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                  </div>
                );
              })}
            </ModalBody>
            {detailTab === 'detail' && (
            <ModalFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80">
              <p className="text-sm text-slate-600">Perubahan input hanya tersimpan setelah Anda klik <strong>Proses</strong> (per item) atau <strong>Proses semua</strong> di bawah.</p>
              {isBusIncludeOnly ? (
                <Button variant="primary" onClick={handleProsesOrderBusInclude} disabled={!!updatingId}>
                  {updatingId === ORDER_BUS_INCLUDE_KEY ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : <><Play className="w-4 h-4 mr-2" /> Proses semua</>}
                </Button>
              ) : (
                <Button variant="primary" onClick={handleProsesSemua} disabled={!!updatingId || busItems.length === 0}>
                  {updatingId ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : <><Play className="w-4 h-4 mr-2" /> Proses semua</>}
                </Button>
              )}
            </ModalFooter>
            )}
          </ModalBoxLg>
        )}
      </Modal>
    </div>
  );
};

export default BusWorkPage;
