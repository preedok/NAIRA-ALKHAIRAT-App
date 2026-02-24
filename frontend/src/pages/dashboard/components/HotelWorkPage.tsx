import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, ClipboardList, Building2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { hotelApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { formatInvoiceDisplay } from '../../../utils';

const STATUS_OPTIONS = [
  { value: 'waiting_confirmation', label: 'Menunggu konfirmasi' },
  { value: 'confirmed', label: 'Dikonfirmasi' },
  { value: 'room_assigned', label: 'Kamar ditetapkan' },
  { value: 'completed', label: 'Selesai' }
];

const MEAL_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Dikonfirmasi' },
  { value: 'completed', label: 'Selesai' }
];

const HotelWorkPage: React.FC = () => {
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
      const res = await hotelApi.getDashboard();
      if (res.data.success && res.data.data) setDashboard(res.data.data);
      else setDashboard(null);
    } catch (e: any) {
      setDashboard(null);
      const msg = e.response?.data?.message;
      if (e.response?.status === 403 && msg) showToast(msg, 'error');
    }
  }, [showToast]);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await hotelApi.listInvoices({});
      if (res.data.success) setInvoices(res.data.data || []);
      else setInvoices([]);
    } catch (e: any) {
      setInvoices([]);
      const msg = e.response?.data?.message;
      if (e.response?.status === 403 && msg) showToast(msg, 'error');
    }
  }, [showToast]);

  const refetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchInvoices()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchInvoices]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  useEffect(() => {
    if (invoiceIdParam) {
      hotelApi.getInvoice(invoiceIdParam)
        .then((res: any) => res.data.success && setDetailInvoice(res.data.data))
        .catch(() => setDetailInvoice(null));
    } else {
      setDetailInvoice(null);
    }
  }, [invoiceIdParam]);

  const handleUpdateProgress = async (orderItemId: string, payload: { status?: string; room_number?: string; meal_status?: string; check_in_date?: string; check_out_date?: string; notes?: string }) => {
    setUpdatingId(orderItemId);
    try {
      await hotelApi.updateItemProgress(orderItemId, payload);
      if (detailInvoice?.id) {
        const res = await hotelApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
      showToast('Status hotel berhasil diupdate.', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const hotelItems = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'hotel') || [];
  const totalInvoices = dashboard?.total_orders ?? invoices.length;
  const totalItems = dashboard?.total_hotel_items ?? 0;
  const hasHotelInvoices = invoices.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hotel – Alokasi Kamar & Konfirmasi</h1>
          <p className="text-slate-600 text-sm mt-1">Data invoice yang punya item hotel. Update status konfirmasi, nomor kamar, dan meal. Status terlihat juga di menu Invoice.</p>
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
            <Building2 className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Item Hotel</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{loading ? '–' : totalItems}</div>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : !hasHotelInvoices ? (
          <div className="py-12 text-center text-slate-500">Belum ada invoice dengan item hotel di cabang Anda. Buat order & invoice dari menu Order/Invoice terlebih dahulu.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4">No. Invoice</th>
                  <th className="text-left py-3 px-4">Owner</th>
                  <th className="text-right py-3 px-4">Item Hotel</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const o = inv.Order;
                  const orderItems = o?.OrderItems || [];
                  const hotelCount = orderItems.filter((i: any) => i.type === 'hotel').length;
                  const firstStatus = orderItems.find((i: any) => i.type === 'hotel')?.HotelProgress?.status || 'waiting_confirmation';
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">{formatInvoiceDisplay(inv.status, inv.invoice_number ?? '', INVOICE_STATUS_LABELS)}</td>
                      <td className="py-3 px-4">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                      <td className="py-3 px-4 text-right">{hotelCount}</td>
                      <td className="py-3 px-4">{STATUS_OPTIONS.find(s => s.value === firstStatus)?.label ?? firstStatus}</td>
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
              {hotelItems.map((item: any) => {
                const prog = item.HotelProgress;
                const status = prog?.status || 'waiting_confirmation';
                const mealStatus = prog?.meal_status || 'pending';
                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl space-y-3">
                    <p className="font-semibold">Item Hotel · Qty: {item.quantity}</p>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Status Pekerjaan</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        value={status}
                        onChange={(e) => handleUpdateProgress(item.id, { status: e.target.value })}
                        disabled={updatingId === item.id}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Nomor Kamar</label>
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Contoh: 101"
                        defaultValue={prog?.room_number ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value?.trim();
                          if (v !== (prog?.room_number ?? '')) handleUpdateProgress(item.id, { room_number: v || undefined });
                        }}
                        disabled={updatingId === item.id}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Status Makan</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        value={mealStatus}
                        onChange={(e) => handleUpdateProgress(item.id, { meal_status: e.target.value })}
                        disabled={updatingId === item.id}
                      >
                        {MEAL_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Check-in</label>
                        <input
                          type="date"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          defaultValue={prog?.check_in_date ?? ''}
                          onBlur={(e) => {
                            const v = e.target.value?.trim() || undefined;
                            if (v !== (prog?.check_in_date ?? '')) handleUpdateProgress(item.id, { check_in_date: v });
                          }}
                          disabled={updatingId === item.id}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Check-out</label>
                        <input
                          type="date"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          defaultValue={prog?.check_out_date ?? ''}
                          onBlur={(e) => {
                            const v = e.target.value?.trim() || undefined;
                            if (v !== (prog?.check_out_date ?? '')) handleUpdateProgress(item.id, { check_out_date: v });
                          }}
                          disabled={updatingId === item.id}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Catatan</label>
                      <textarea
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        rows={2}
                        placeholder="Catatan (opsional)"
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

export default HotelWorkPage;
