import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bus, RefreshCw, Eye, Lock, FileSpreadsheet, FileText } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { busApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { formatIDR } from '../../../utils';

const TICKET_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'issued', label: 'Terbit' }
];
const TRIP_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'completed', label: 'Selesai' }
];

function BusWorkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'orders';
  const orderIdParam = searchParams.get('order');
  const { showToast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await busApi.listOrders({});
      if (res.data.success) setOrders(res.data.data || []);
    } catch {
      setOrders([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await busApi.listProducts();
      if (res.data.success) setProducts(res.data.data || []);
    } catch {
      setProducts([]);
    }
  };

  useEffect(() => {
    setLoading(true);
    if (tab === 'products') {
      fetchProducts().finally(() => setLoading(false));
    } else {
      fetchOrders().finally(() => setLoading(false));
    }
  }, [tab]);

  useEffect(() => {
    if (orderIdParam) {
      busApi.getOrder(orderIdParam)
        .then((res: any) => res.data.success && setDetailOrder(res.data.data))
        .catch(() => setDetailOrder(null));
    } else {
      setDetailOrder(null);
    }
  }, [orderIdParam]);

  const handleUpdateProgress = async (orderItemId: string, payload: { bus_ticket_status?: string; bus_ticket_info?: string; arrival_status?: string; departure_status?: string; return_status?: string; notes?: string }) => {
    setUpdatingId(orderItemId);
    try {
      await busApi.updateItemProgress(orderItemId, payload);
      if (detailOrder?.id) {
        const res = await busApi.getOrder(detailOrder.id);
        if (res.data.success) setDetailOrder(res.data.data);
      }
      fetchOrders();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal update', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const res = await busApi.exportExcel();
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-bus-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await busApi.exportPdf();
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekap-bus-${Date.now()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExportingPdf(false);
    }
  };

  const busItems = detailOrder?.OrderItems?.filter((i: any) => i.type === 'bus') || [];

  const refetch = () => {
    fetchOrders();
    fetchProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Bus Saudi – Order & Harga</h1>
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefreshControl onRefresh={refetch} disabled={loading} size="sm" />
          <div className="flex flex-wrap gap-2">
          <Button
            variant={tab === 'orders' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({})}
          >
            Order Bus
          </Button>
          <Button
            variant={tab === 'products' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({ tab: 'products' })}
          >
            Harga (read-only)
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exportingExcel}>
            <FileSpreadsheet className={`w-4 h-4 mr-1 ${exportingExcel ? 'animate-spin' : ''}`} /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
            <FileText className={`w-4 h-4 mr-1 ${exportingPdf ? 'animate-spin' : ''}`} /> PDF
          </Button>
          </div>
        </div>
      </div>

      {tab === 'orders' && (
        <Card>
          {loading ? (
            <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Belum ada order dengan item bus di cabang Anda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4">Order</th>
                    <th className="text-left py-3 px-4">Owner</th>
                    <th className="text-right py-3 px-4">Item Bus</th>
                    <th className="text-left py-3 px-4">Tiket / Kedatangan</th>
                    <th className="text-left py-3 px-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const busCount = (o.OrderItems || []).filter((i: any) => i.type === 'bus').length;
                    const first = (o.OrderItems || []).find((i: any) => i.type === 'bus')?.BusProgress;
                    const ticketStatus = first?.bus_ticket_status || 'pending';
                    const arrivalStatus = first?.arrival_status || 'pending';
                    return (
                      <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium">{o.order_number}</td>
                        <td className="py-3 px-4">{o.User?.name}</td>
                        <td className="py-3 px-4 text-right">{busCount}</td>
                        <td className="py-3 px-4">{ticketStatus} / {arrivalStatus}</td>
                        <td className="py-3 px-4">
                          <Button size="sm" variant="outline" onClick={() => setSearchParams({ order: o.id })}>
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
      )}

      {tab === 'products' && (
        <Card>
          <p className="text-sm text-slate-600 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4" /> Harga general (pusat), perubahan admin cabang, dan harga khusus role invoice per owner. Hanya informasi, tidak dapat diubah oleh role bus.
          </p>
          {loading ? (
            <div className="py-12 text-center text-slate-500">Memuat...</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Belum ada produk bus.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4">Kode</th>
                    <th className="text-left py-3 px-4">Nama</th>
                    <th className="text-right py-3 px-4">Harga General (Pusat)</th>
                    <th className="text-right py-3 px-4">Harga Cabang</th>
                    <th className="text-left py-3 px-4">Harga Khusus (per Owner)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-3 px-4">{p.code}</td>
                      <td className="py-3 px-4">{p.name}</td>
                      <td className="py-3 px-4 text-right">{p.price_general != null ? formatIDR(p.price_general) : '-'}</td>
                      <td className="py-3 px-4 text-right">{p.price_branch != null ? formatIDR(p.price_branch) : '-'}</td>
                      <td className="py-3 px-4">
                        {p.special_prices?.length ? (
                          <ul className="text-xs space-y-0.5">
                            {p.special_prices.map((sp: any, i: number) => (
                              <li key={i}>{sp.owner_name}: {formatIDR(sp.amount)}</li>
                            ))}
                          </ul>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSearchParams({})}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900">Order {detailOrder.order_number}</h2>
              <button className="p-2 hover:bg-slate-100 rounded-lg" onClick={() => setSearchParams({})}>×</button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Owner: {detailOrder.User?.name}</p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Tiket Bis</label>
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
                        <label className="block text-xs text-slate-500 mb-1">Info Tiket Bis</label>
                        <input
                          type="text"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          placeholder="Nomor tiket, dll"
                          defaultValue={prog?.bus_ticket_info || ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (prog?.bus_ticket_info || '')) handleUpdateProgress(item.id, { bus_ticket_info: v });
                          }}
                          disabled={updatingId === item.id}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Kedatangan (jemput jamaah)</label>
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
                        <label className="block text-xs text-slate-500 mb-1">Keberangkatan</label>
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
                        <label className="block text-xs text-slate-500 mb-1">Kepulangan</label>
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
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Catatan</label>
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Catatan opsional"
                        defaultValue={prog?.notes || ''}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (prog?.notes || '')) handleUpdateProgress(item.id, { notes: v });
                        }}
                        disabled={updatingId === item.id}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BusWorkPage;
