import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, ClipboardList, Bus, Ticket, MapPin, Plane, RotateCcw, Search, FileSpreadsheet, FileText, AlertCircle, ChevronRight } from 'lucide-react';
import Card from '../../../components/common/Card';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal, { ModalHeader, ModalBody, ModalBoxLg } from '../../../components/common/Modal';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import Table from '../../../components/common/Table';
import { Input, Autocomplete, Textarea, ContentLoading } from '../../../components/common';
import type { TableColumn } from '../../../types';
import { busApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { formatInvoiceNumberDisplay, formatIDR } from '../../../utils';

const TICKET_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'issued', label: 'Terbit' }
];

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
  const [localTicketInfo, setLocalTicketInfo] = useState<Record<string, string>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

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

  const formatDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–');
  const isNewInvoice = (inv: any) => {
    if (!inv) return false;
    const at = inv.issued_at || inv.created_at;
    if (!at) return false;
    return Date.now() - new Date(at).getTime() < 24 * 60 * 60 * 1000;
  };
  const getOrderChangeDate = (inv: any) => {
    const at = inv?.order_updated_at ?? inv?.Order?.order_updated_at ?? null;
    return at ? new Date(at) : null;
  };

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
      setLocalTicketInfo({});
      setLocalNotes({});
    }
  }, [invoiceIdParam]);

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

  const busItems = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'bus') || [];
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
        <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Order" value={loading ? '–' : totalInvoices} iconClassName="bg-[#0D1A63] text-white" />
        <StatCard icon={<Bus className="w-5 h-5" />} label="Item Bus" value={loading ? '–' : totalItems} iconClassName="bg-slate-100 text-slate-600" />
        <StatCard icon={<Ticket className="w-5 h-5" />} label="Tiket Pending" value={loading ? '–' : ticketPending} iconClassName="bg-amber-100 text-amber-600" />
        <StatCard icon={<Ticket className="w-5 h-5" />} label="Tiket Terbit" value={loading ? '–' : ticketIssued} iconClassName="bg-emerald-100 text-emerald-600" />
        <StatCard icon={<MapPin className="w-5 h-5" />} label="Kedatangan" value={loading ? '–' : (arrival.completed ?? 0)} subtitle={`P ${arrival.pending ?? 0} · T ${arrival.scheduled ?? 0}`} iconClassName="bg-sky-100 text-sky-600" />
        <StatCard icon={<Plane className="w-5 h-5" />} label="Keberangkatan" value={loading ? '–' : (departure.completed ?? 0)} subtitle={`P ${departure.pending ?? 0} · T ${departure.scheduled ?? 0}`} iconClassName="bg-violet-100 text-violet-600" />
        <StatCard icon={<RotateCcw className="w-5 h-5" />} label="Kepulangan" value={loading ? '–' : (returnStat.completed ?? 0)} subtitle={`P ${returnStat.pending ?? 0} · T ${returnStat.scheduled ?? 0}`} iconClassName="bg-teal-100 text-teal-600" />
      </div>

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
        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 flex-wrap sm:items-end">
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
              const statusLabel = INVOICE_STATUS_LABELS[inv.status] || inv.status;
              return (
                <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono font-semibold text-slate-800">{formatInvoiceNumberDisplay(inv, INVOICE_STATUS_LABELS)}</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isNewInvoice(inv) && <Badge variant="success" className="text-xs">Baru</Badge>}
                        {getOrderChangeDate(inv) && (
                          <span className="text-xs text-slate-600">Perubahan {formatDate(getOrderChangeDate(inv)!.toISOString())}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 align-top">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                  <td className="px-6 py-4 text-slate-700 align-top text-sm">
                    <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900 align-top">{formatIDR(totalIdr)}</td>
                  <td className="px-6 py-4 align-top">
                    <Badge variant={inv.status === 'paid' || inv.status === 'completed' ? 'success' : inv.status === 'canceled' || inv.status === 'cancelled' ? 'error' : 'warning'}>
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
              title={formatInvoiceNumberDisplay(detailInvoice, INVOICE_STATUS_LABELS)}
              subtitle={`Owner: ${detailInvoice.User?.name ?? detailInvoice.Order?.User?.name ?? '–'}`}
              icon={<Bus className="w-5 h-5" />}
              onClose={() => setSearchParams({})}
            />
            <ModalBody className="space-y-4">
              {busItems.map((item: any, idx: number) => {
                const prog = item.BusProgress;
                const ticketStatus = prog?.bus_ticket_status || 'pending';
                const arrivalStatus = prog?.arrival_status || 'pending';
                const departureStatus = prog?.departure_status || 'pending';
                const returnStatus = prog?.return_status || 'pending';
                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
                    <p className="font-semibold text-slate-800 flex items-center gap-2">
                      <Bus className="w-4 h-4 text-[#0D1A63]" />
                      Item Bus #{idx + 1} · Qty: {item.quantity}
                    </p>
                    <Autocomplete
                      label="Status Tiket Bis"
                      value={ticketStatus}
                      onChange={(v) => handleUpdateProgress(item.id, { bus_ticket_status: v })}
                      options={TICKET_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Input
                      label="Info Tiket (nomor, dll)"
                      type="text"
                      placeholder="Opsional"
                      value={localTicketInfo[item.id] ?? prog?.bus_ticket_info ?? ''}
                      onChange={(e) => setLocalTicketInfo((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => {
                        const v = (localTicketInfo[item.id] ?? prog?.bus_ticket_info ?? '').trim() || undefined;
                        if (v !== (prog?.bus_ticket_info ?? '')) handleUpdateProgress(item.id, { bus_ticket_info: v });
                        setLocalTicketInfo((prev) => {
                          const next = { ...prev };
                          delete next[item.id];
                          return next;
                        });
                      }}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Autocomplete
                      label="Status Kedatangan"
                      value={arrivalStatus}
                      onChange={(v) => handleUpdateProgress(item.id, { arrival_status: v })}
                      options={TRIP_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Autocomplete
                      label="Status Keberangkatan"
                      value={departureStatus}
                      onChange={(v) => handleUpdateProgress(item.id, { departure_status: v })}
                      options={TRIP_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Autocomplete
                      label="Status Kepulangan"
                      value={returnStatus}
                      onChange={(v) => handleUpdateProgress(item.id, { return_status: v })}
                      options={TRIP_OPTIONS}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    <Textarea
                      label="Catatan"
                      rows={2}
                      placeholder="Opsional"
                      value={localNotes[item.id] ?? prog?.notes ?? ''}
                      onChange={(e) => setLocalNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => {
                        const v = (localNotes[item.id] ?? prog?.notes ?? '').trim() || undefined;
                        if (v !== (prog?.notes ?? '')) handleUpdateProgress(item.id, { notes: v });
                        setLocalNotes((prev) => {
                          const next = { ...prev };
                          delete next[item.id];
                          return next;
                        });
                      }}
                      disabled={updatingId === item.id}
                      fullWidth
                    />
                    {updatingId === item.id && <span className="text-xs text-slate-500">Menyimpan...</span>}
                  </div>
                );
              })}
            </ModalBody>
          </ModalBoxLg>
        )}
      </Modal>
    </div>
  );
};

export default BusWorkPage;
