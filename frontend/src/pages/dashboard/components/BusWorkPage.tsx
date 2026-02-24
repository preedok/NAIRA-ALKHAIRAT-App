import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, ClipboardList, Bus } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
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

const BusWorkPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice');
  const { showToast } = useToast();

  const [dashboard, setDashboard] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
      const res = await busApi.listInvoices({});
      if (res.data.success) setInvoices(res.data.data || []);
    } catch {
      setInvoices([]);
    }
  }, []);

  const refetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchInvoices()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchInvoices]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bus – Tiket Bis & Perjalanan</h1>
          <p className="text-slate-600 text-sm mt-1">Data invoice yang punya item bus. Update status tiket bis, kedatangan, keberangkatan, kepulangan. Status terlihat juga di menu Invoice.</p>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <ClipboardList className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Invoice</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{loading ? '–' : totalInvoices}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <Bus className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Item Bus</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{loading ? '–' : totalItems}</div>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : !hasBusInvoices ? (
          <div className="py-12 text-center text-slate-500">Belum ada invoice dengan item bus di cabang Anda. Buat order & invoice dari menu Order/Invoice terlebih dahulu.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4">No. Invoice</th>
                  <th className="text-left py-3 px-4">Owner</th>
                  <th className="text-right py-3 px-4">Item Bus</th>
                  <th className="text-left py-3 px-4">Status Tiket</th>
                  <th className="text-left py-3 px-4">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const o = inv.Order;
                  const orderItems = o?.OrderItems || [];
                  const busCount = orderItems.filter((i: any) => i.type === 'bus').length;
                  const firstTicketStatus = orderItems.find((i: any) => i.type === 'bus')?.BusProgress?.bus_ticket_status || 'pending';
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">{formatInvoiceDisplay(inv.status, inv.invoice_number ?? '', INVOICE_STATUS_LABELS)}</td>
                      <td className="py-3 px-4">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                      <td className="py-3 px-4 text-right">{busCount}</td>
                      <td className="py-3 px-4">{TICKET_OPTIONS.find(s => s.value === firstTicketStatus)?.label ?? firstTicketStatus}</td>
                      <td className="py-3 px-4">
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900">{formatInvoiceDisplay(detailInvoice.status, detailInvoice.invoice_number ?? '', INVOICE_STATUS_LABELS)}</h2>
              <button className="p-2 hover:bg-slate-100 rounded-lg" onClick={() => setSearchParams({})}>×</button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Owner: {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name}</p>
            <div className="space-y-4">
              {busItems.map((item: any) => {
                const prog = item.BusProgress;
                const ticketStatus = prog?.bus_ticket_status || 'pending';
                const arrivalStatus = prog?.arrival_status || 'pending';
                const departureStatus = prog?.departure_status || 'pending';
                const returnStatus = prog?.return_status || 'pending';
                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl space-y-3">
                    <p className="font-semibold">Item Bus · Qty: {item.quantity}</p>
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
