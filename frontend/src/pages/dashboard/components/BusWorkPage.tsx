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
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { formatInvoiceNumberDisplay } from '../../../utils';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant } from '../../../components/common/InvoiceStatusRefundCell';
import { PROGRESS_STATUS_OPTIONS_BUS } from '../../../components/common/InvoiceProgressStatusCell';

/** Satu sumber kebenaran dengan tabel Invoice (InvoiceProgressStatusCell) */
const TICKET_OPTIONS = PROGRESS_STATUS_OPTIONS_BUS;

const TRIP_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'completed', label: 'Selesai' }
];

const INVOICE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Semua status' },
  ...Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label }))
];

const BusWorkPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice');
  const { showToast } = useToast();

  const [dashboard, setDashboard] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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
  type BusItemDraft = { bus_ticket_status?: string; bus_ticket_info?: string; arrival_status?: string; departure_status?: string; return_status?: string; notes?: string };
  const [detailDraft, setDetailDraft] = useState<Record<string, BusItemDraft>>({});
  type BusStatModal = 'total_order' | 'item_bus' | 'tiket_pending' | 'tiket_issued' | 'kedatangan' | 'keberangkatan' | 'kepulangan' | null;
  const [statModal, setStatModal] = useState<BusStatModal>(null);
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

  const filteredInvoices = useMemo(() => {
    let list = invoices;
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
  }, [invoices, searchQuery, filterTicketStatus, filterArrival, filterDeparture, filterReturn]);

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
  useEffect(() => {
    if (busItems.length) {
      const next: Record<string, BusItemDraft> = {};
      busItems.forEach((item: any) => {
        const prog = item.BusProgress;
        next[item.id] = {
          bus_ticket_status: prog?.bus_ticket_status || 'pending',
          bus_ticket_info: prog?.bus_ticket_info ?? '',
          arrival_status: prog?.arrival_status || 'pending',
          departure_status: prog?.departure_status || 'pending',
          return_status: prog?.return_status || 'pending',
          notes: prog?.notes ?? ''
        };
      });
      setDetailDraft(prev => ({ ...prev, ...next }));
    }
  }, [detailInvoice?.id, busItems.map((i: any) => i.id).join(',')]);

  const handleProsesItem = (itemId: string) => {
    const d = detailDraft[itemId];
    if (!d) return;
    handleUpdateProgress(itemId, {
      bus_ticket_status: d.bus_ticket_status,
      bus_ticket_info: d.bus_ticket_info?.trim() || undefined,
      arrival_status: d.arrival_status,
      departure_status: d.departure_status,
      return_status: d.return_status,
      notes: d.notes?.trim() || undefined
    });
  };

  const handleProsesSemua = async () => {
    for (const item of busItems) {
      const d = detailDraft[item.id];
      if (!d) continue;
      await handleUpdateProgress(item.id, {
        bus_ticket_status: d.bus_ticket_status,
        bus_ticket_info: d.bus_ticket_info?.trim() || undefined,
        arrival_status: d.arrival_status,
        departure_status: d.departure_status,
        return_status: d.return_status,
        notes: d.notes?.trim() || undefined
      });
    }
  };

  const handleUpdateProgress = async (orderItemId: string, payload: { bus_ticket_status?: string; bus_ticket_info?: string; arrival_status?: string; departure_status?: string; return_status?: string; notes?: string }) => {
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

  const totalInvoices = dashboard?.total_orders ?? invoices.length;
  const totalItems = dashboard?.total_bus_items ?? 0;
  const hasBusInvoices = invoices.length > 0;

  const ticketPending = dashboard?.bus_ticket?.pending ?? 0;
  const ticketIssued = dashboard?.bus_ticket?.issued ?? 0;
  const arrival = dashboard?.arrival ?? { pending: 0, scheduled: 0, completed: 0 };
  const departure = dashboard?.departure ?? { pending: 0, scheduled: 0, completed: 0 };
  const returnStat = dashboard?.return ?? { pending: 0, scheduled: 0, completed: 0 };
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Order" value={loading ? '–' : totalInvoices} iconClassName="bg-[#0D1A63] text-white" onClick={() => setStatModal('total_order')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('total_order')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        <StatCard icon={<Bus className="w-5 h-5" />} label="Item Bus" value={loading ? '–' : totalItems} iconClassName="bg-slate-100 text-slate-600" onClick={() => setStatModal('item_bus')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('item_bus')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        <StatCard icon={<Ticket className="w-5 h-5" />} label="Tiket Pending" value={loading ? '–' : ticketPending} iconClassName="bg-amber-100 text-amber-600" onClick={() => setStatModal('tiket_pending')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('tiket_pending')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        <StatCard icon={<Ticket className="w-5 h-5" />} label="Tiket Terbit" value={loading ? '–' : ticketIssued} iconClassName="bg-emerald-100 text-emerald-600" onClick={() => setStatModal('tiket_issued')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('tiket_issued')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        <StatCard icon={<MapPin className="w-5 h-5" />} label="Kedatangan" value={loading ? '–' : (arrival.completed ?? 0)} subtitle={`P ${arrival.pending ?? 0} · T ${arrival.scheduled ?? 0}`} iconClassName="bg-sky-100 text-sky-600" onClick={() => setStatModal('kedatangan')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('kedatangan')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        <StatCard icon={<Plane className="w-5 h-5" />} label="Keberangkatan" value={loading ? '–' : (departure.completed ?? 0)} subtitle={`P ${departure.pending ?? 0} · T ${departure.scheduled ?? 0}`} iconClassName="bg-violet-100 text-violet-600" onClick={() => setStatModal('keberangkatan')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('keberangkatan')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        <StatCard icon={<RotateCcw className="w-5 h-5" />} label="Kepulangan" value={loading ? '–' : (returnStat.completed ?? 0)} subtitle={`P ${returnStat.pending ?? 0} · T ${returnStat.scheduled ?? 0}`} iconClassName="bg-teal-100 text-teal-600" onClick={() => setStatModal('kepulangan')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('kepulangan')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
      </div>

      {/* Modal daftar invoice per stat */}
      {statModal && (
        <Modal open onClose={() => setStatModal(null)}>
          <ModalBoxLg>
            <ModalHeader title={statModal === 'total_order' ? 'Daftar Invoice – Total Order' : statModal === 'item_bus' ? 'Daftar Invoice – Item Bus' : statModal === 'tiket_pending' ? 'Daftar Invoice – Tiket Pending' : statModal === 'tiket_issued' ? 'Daftar Invoice – Tiket Terbit' : statModal === 'kedatangan' ? 'Daftar Invoice – Kedatangan' : statModal === 'keberangkatan' ? 'Daftar Invoice – Keberangkatan' : 'Daftar Invoice – Kepulangan'} onClose={() => setStatModal(null)} />
            <ModalBody>
              {(() => {
                const list = statModal === 'tiket_pending' ? invoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.bus_ticket_status || 'pending') === 'pending')) : statModal === 'tiket_issued' ? invoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.bus_ticket_status || '') === 'issued')) : statModal === 'kedatangan' ? invoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.arrival_status || 'pending') === 'completed')) : statModal === 'keberangkatan' ? invoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.departure_status || 'pending') === 'completed')) : statModal === 'kepulangan' ? invoices.filter((inv: any) => (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'bus').some((i: any) => (i.BusProgress?.return_status || 'pending') === 'completed')) : invoices;
                const cols: TableColumn[] = [{ id: 'invoice_number', label: 'No. Invoice' }, { id: 'owner', label: 'Owner' }, { id: 'total', label: 'Total' }, { id: 'status', label: 'Status' }];
                return (
                  <Table
                    columns={cols}
                    data={list}
                    emptyMessage="Tidak ada invoice"
                    renderRow={(row: any) => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-2 px-4 text-sm">{row.invoice_number || '–'}</td>
                        <td className="py-2 px-4 text-sm">{row.Order?.User?.name ?? row.User?.name ?? '–'}</td>
                        <td className="py-2 px-4 text-sm"><NominalDisplay amount={row.total_amount ?? 0} currency="IDR" /></td>
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
          <p className="text-sm font-medium text-slate-600 mb-3">Pengaturan Filter</p>
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
            columns={[
              { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
              { id: 'owner', label: 'Owner', align: 'left' },
              { id: 'company', label: 'Perusahaan', align: 'left' },
              { id: 'total', label: 'Total', align: 'right' },
              { id: 'status_invoice', label: 'Status Invoice', align: 'left' },
              { id: 'item_bus', label: 'Item Bus', align: 'right' },
              { id: 'status_tiket', label: 'Status Tiket', align: 'left' },
              { id: 'actions', label: 'Aksi', align: 'left' }
            ] as TableColumn[]}
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
            renderRow={(inv: any) => {
              const o = inv.Order;
              const orderItems = o?.OrderItems || [];
              const busCount = orderItems.filter((i: any) => i.type === 'bus').length;
              const firstTicketStatus = orderItems.find((i: any) => i.type === 'bus')?.BusProgress?.bus_ticket_status || 'pending';
              const totalIdr = inv?.total_amount_idr != null ? parseFloat(inv.total_amount_idr) : parseFloat(inv?.total_amount || 0);
              const statusLabel = getEffectiveInvoiceStatusLabel(inv);
              const statusBadgeVariant = getEffectiveInvoiceStatusBadgeVariant(inv);
              return (
                <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 align-top">
                    <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan showDpPayment order={inv.Order} />
                  </td>
                  <td className="px-6 py-4 text-slate-700 align-top">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                  <td className="px-6 py-4 text-slate-700 align-top text-sm">
                    <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900 align-top"><NominalDisplay amount={totalIdr} currency="IDR" /></td>
                  <td className="px-6 py-4 align-top">
                    <Badge variant={statusBadgeVariant}>
                      {statusLabel}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right font-medium tabular-nums align-top">{busCount}</td>
                  <td className="px-6 py-4 align-top">
                    <Badge variant={firstTicketStatus === 'issued' ? 'success' : 'warning'}>
                      {TICKET_OPTIONS.find(s => s.value === firstTicketStatus)?.label ?? firstTicketStatus}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <Button size="sm" variant="outline" onClick={() => setSearchParams({ invoice: inv.id })}>
                      <Eye className="w-4 h-4 mr-1" /> Detail
                    </Button>
                  </td>
                </tr>
              );
            }}
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
              const hasSlipEligible = busItems.some((item: any) => (detailDraft[item.id]?.bus_ticket_status ?? item.BusProgress?.bus_ticket_status ?? '') === 'issued');
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
                  {busItems
                    .filter((item: any) => (detailDraft[item.id]?.bus_ticket_status ?? item.BusProgress?.bus_ticket_status ?? '') === 'issued')
                    .map((item: any) => {
                      const prog = item.BusProgress;
                      const order = detailInvoice?.Order;
                      const invoiceNumber = detailInvoice?.invoice_number ?? '–';
                      const productName = item.Product?.name || (item as any).product_name || 'Item Bus';
                      const ownerName = order?.User?.name || order?.User?.company_name || '–';
                      const ticketStatusLabel = TICKET_OPTIONS.find((o: { value: string }) => o.value === (prog?.bus_ticket_status || ''))?.label ?? prog?.bus_ticket_status ?? '–';
                      const ticketInfo = (prog?.bus_ticket_info ?? detailDraft[item.id]?.bus_ticket_info ?? '').trim() || '–';
                      const route = (item.meta?.route || '').toString() || '–';
                      const arrivalLabel = TRIP_OPTIONS.find((o: { value: string }) => o.value === (prog?.arrival_status || ''))?.label ?? prog?.arrival_status ?? '–';
                      const departureLabel = TRIP_OPTIONS.find((o: { value: string }) => o.value === (prog?.departure_status || ''))?.label ?? prog?.departure_status ?? '–';
                      const returnLabel = TRIP_OPTIONS.find((o: { value: string }) => o.value === (prog?.return_status || ''))?.label ?? prog?.return_status ?? '–';
                      const notes = (prog?.notes ?? detailDraft[item.id]?.notes ?? '').trim() || '–';
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Slip Informasi Bus</p>
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><dt className="text-slate-500">No. Invoice</dt><dd className="font-medium text-slate-900">{invoiceNumber}</dd></div>
                            <div><dt className="text-slate-500">Produk / Paket Bus</dt><dd className="font-medium text-slate-900">{productName}</dd></div>
                            <div><dt className="text-slate-500">Pemesan (Owner)</dt><dd className="font-medium text-slate-900">{ownerName}</dd></div>
                            <div><dt className="text-slate-500">Jumlah</dt><dd className="font-medium text-slate-900">{item.quantity ?? '–'}</dd></div>
                            <div><dt className="text-slate-500">Rute</dt><dd className="font-medium text-slate-900">{route}</dd></div>
                            <div><dt className="text-slate-500">Status Tiket Bus</dt><dd className="font-medium text-slate-900">{ticketStatusLabel}</dd></div>
                            <div><dt className="text-slate-500">Info Tiket Bus</dt><dd className="font-medium text-slate-900">{ticketInfo}</dd></div>
                            <div><dt className="text-slate-500">Status Kedatangan</dt><dd className="font-medium text-slate-900">{arrivalLabel}</dd></div>
                            <div><dt className="text-slate-500">Status Keberangkatan</dt><dd className="font-medium text-slate-900">{departureLabel}</dd></div>
                            <div><dt className="text-slate-500">Status Kepulangan</dt><dd className="font-medium text-slate-900">{returnLabel}</dd></div>
                            <div className="sm:col-span-2"><dt className="text-slate-500">Catatan</dt><dd className="font-medium text-slate-900">{notes}</dd></div>
                          </dl>
                          <p className="text-xs text-slate-400 mt-3">Slip ini digenerate otomatis. Digabungkan ke arsip invoice (Unduh ZIP).</p>
                        </div>
                      );
                    })}
                </div>
              ) : busItems.map((item: any, idx: number) => {
                const prog = item.BusProgress;
                const d = detailDraft[item.id] ?? {
                  bus_ticket_status: prog?.bus_ticket_status || 'pending',
                  bus_ticket_info: prog?.bus_ticket_info ?? '',
                  arrival_status: prog?.arrival_status || 'pending',
                  departure_status: prog?.departure_status || 'pending',
                  return_status: prog?.return_status || 'pending',
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
                      label="Status Tiket Bis"
                      value={d.bus_ticket_status ?? 'pending'}
                      onChange={(v) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), bus_ticket_status: v ?? 'pending' } }))}
                      options={TICKET_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Input
                      label="Info Tiket (nomor, dll)"
                      type="text"
                      placeholder="Opsional"
                      value={d.bus_ticket_info ?? ''}
                      onChange={(e) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), bus_ticket_info: e.target.value } }))}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Autocomplete
                      label="Status Kedatangan"
                      value={d.arrival_status ?? 'pending'}
                      onChange={(v) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), arrival_status: v ?? 'pending' } }))}
                      options={TRIP_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Autocomplete
                      label="Status Keberangkatan"
                      value={d.departure_status ?? 'pending'}
                      onChange={(v) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), departure_status: v ?? 'pending' } }))}
                      options={TRIP_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Autocomplete
                      label="Status Kepulangan"
                      value={d.return_status ?? 'pending'}
                      onChange={(v) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), return_status: v ?? 'pending' } }))}
                      options={TRIP_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Textarea
                      label="Catatan"
                      rows={2}
                      placeholder="Opsional"
                      value={d.notes ?? ''}
                      onChange={(e) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), notes: e.target.value } }))}
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
              <Button variant="primary" onClick={handleProsesSemua} disabled={!!updatingId || busItems.length === 0}>
                {updatingId ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : <><Play className="w-4 h-4 mr-2" /> Proses semua</>}
              </Button>
            </ModalFooter>
            )}
          </ModalBoxLg>
        )}
      </Modal>
    </div>
  );
};

export default BusWorkPage;
