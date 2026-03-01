import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, ClipboardList, Bus, Ticket, MapPin, Plane, RotateCcw, Search, Download, FileSpreadsheet, FileText, AlertCircle, ChevronRight } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import { busApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { formatInvoiceDisplay } from '../../../utils';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const filterChangedOnce = useRef(false);

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
      const res = await busApi.listInvoices({ status: filterStatus || undefined });
      if (res.data.success) setInvoices(res.data.data || []);
    } catch {
      setInvoices([]);
    }
  }, [filterStatus]);

  const refetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchInvoices()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv: any) => {
      const invNum = (inv.invoice_number ?? '').toLowerCase();
      const ownerName = (inv.User?.name ?? inv.Order?.User?.name ?? '').toLowerCase();
      const orderNum = (inv.Order?.order_number ?? '').toLowerCase();
      return invNum.includes(q) || ownerName.includes(q) || orderNum.includes(q);
    });
  }, [invoices, searchQuery]);

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
              <button
                key={`${p.order_id}-${p.order_item_id}`}
                type="button"
                onClick={() => {
                  const inv = invoices.find((i: any) => i.Order?.id === p.order_id);
                  if (inv) setSearchParams({ invoice: inv.id });
                  else showToast('Invoice tidak ada dalam daftar. Coba reset filter.', 'warning');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 text-left text-sm"
              >
                <span className="font-mono text-stone-700">{p.order_number}</span>
                <span className="text-stone-500">·</span>
                <span className="text-stone-600">{p.owner_name || '–'}</span>
                <span className="text-amber-600">Qty {p.quantity}</span>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
            ))}
            {pendingList.length > 20 && (
              <span className="text-xs text-stone-500 self-center">+{pendingList.length - 20} lainnya</span>
            )}
          </div>
        </Card>
      )}

      {/* Filter & Tabel */}
      <Card>
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Cari invoice, order, owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0D1A63] focus:border-[#0D1A63]"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0D1A63] focus:border-[#0D1A63] bg-white min-w-[160px]"
            >
              {INVOICE_STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {(searchQuery || filterStatus) && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setFilterStatus(''); }}
                className="text-sm text-stone-500 hover:text-stone-700"
              >
                Reset filter
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-16 text-center">
            <Bus className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">
              {invoices.length === 0 ? 'Belum ada invoice dengan item bus' : 'Tidak ada hasil untuk filter ini'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {invoices.length === 0 ? 'Buat order & invoice dari menu Order/Invoice terlebih dahulu.' : 'Ubah filter atau kata kunci pencarian.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">No. Invoice</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Owner</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Item Bus</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status Tiket</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 w-28 sticky right-0 z-10 bg-slate-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv: any) => {
                  const o = inv.Order;
                  const orderItems = o?.OrderItems || [];
                  const busCount = orderItems.filter((i: any) => i.type === 'bus').length;
                  const firstTicketStatus = orderItems.find((i: any) => i.type === 'bus')?.BusProgress?.bus_ticket_status || 'pending';
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-slate-800">{formatInvoiceDisplay(inv.status, inv.invoice_number ?? '', INVOICE_STATUS_LABELS)}</span>
                        {inv.Order?.order_number && (
                          <span className="block text-xs text-slate-500 mt-0.5">{inv.Order.order_number}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                      <td className="py-3 px-4 text-right font-medium tabular-nums">{busCount}</td>
                      <td className="py-3 px-4">
                        <Badge variant={firstTicketStatus === 'issued' ? 'success' : 'warning'}>
                          {TICKET_OPTIONS.find(s => s.value === firstTicketStatus)?.label ?? firstTicketStatus}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                        <Button size="sm" variant="outline" onClick={() => setSearchParams({ invoice: inv.id })}>
                          <Eye className="w-4 h-4 mr-1" /> Detail
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!detailInvoice} onClose={() => setSearchParams({})}>
        {detailInvoice && (
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{formatInvoiceDisplay(detailInvoice.status, detailInvoice.invoice_number ?? '', INVOICE_STATUS_LABELS)}</h2>
                <p className="text-sm text-slate-500 mt-1">Owner: {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name}</p>
              </div>
              <button type="button" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700" onClick={() => setSearchParams({})} aria-label="Tutup">×</button>
            </div>
            <div className="space-y-4">
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
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Status Tiket Bis</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        value={ticketStatus}
                        onChange={(e) => handleUpdateProgress(item.id, { bus_ticket_status: e.target.value })}
                        disabled={updatingId === item.id}
                      >
                        {TICKET_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Info Tiket (nomor, dll)</label>
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Opsional"
                        defaultValue={prog?.bus_ticket_info ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value?.trim() || undefined;
                          if (v !== (prog?.bus_ticket_info ?? '')) handleUpdateProgress(item.id, { bus_ticket_info: v });
                        }}
                        disabled={updatingId === item.id}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Status Kedatangan</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        value={arrivalStatus}
                        onChange={(e) => handleUpdateProgress(item.id, { arrival_status: e.target.value })}
                        disabled={updatingId === item.id}
                      >
                        {TRIP_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Status Keberangkatan</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        value={departureStatus}
                        onChange={(e) => handleUpdateProgress(item.id, { departure_status: e.target.value })}
                        disabled={updatingId === item.id}
                      >
                        {TRIP_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Status Kepulangan</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        value={returnStatus}
                        onChange={(e) => handleUpdateProgress(item.id, { return_status: e.target.value })}
                        disabled={updatingId === item.id}
                      >
                        {TRIP_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Catatan</label>
                      <textarea
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        rows={2}
                        placeholder="Opsional"
                        defaultValue={prog?.notes ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value?.trim() || undefined;
                          if (v !== (prog?.notes ?? '')) handleUpdateProgress(item.id, { notes: v });
                        }}
                        disabled={updatingId === item.id}
                      />
                    </div>
                    {updatingId === item.id && <span className="text-xs text-slate-500">Menyimpan...</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BusWorkPage;
