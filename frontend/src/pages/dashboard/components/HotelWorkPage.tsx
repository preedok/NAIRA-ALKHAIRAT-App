import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hotel, RefreshCw, Eye, CheckCircle, Lock } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { formatIDR } from '../../../utils';
import { hotelApi } from '../../../services/api';

const STATUS_OPTIONS = [
  { value: 'waiting_confirmation', label: 'Menunggu Konfirmasi' },
  { value: 'confirmed', label: 'Dikonfirmasi' },
  { value: 'room_assigned', label: 'Kamar Ditetapkan' },
  { value: 'completed', label: 'Selesai' }
];
const MEAL_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Dikonfirmasi' },
  { value: 'completed', label: 'Selesai' }
];

function HotelWorkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'orders';
  const orderIdParam = searchParams.get('order');

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await hotelApi.listOrders({});
      if (res.data.success) setOrders(res.data.data || []);
    } catch {
      setOrders([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await hotelApi.listProducts();
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
      hotelApi.getOrder(orderIdParam)
        .then((res: any) => res.data.success && setDetailOrder(res.data.data))
        .catch(() => setDetailOrder(null));
    } else {
      setDetailOrder(null);
    }
  }, [orderIdParam]);

  const handleUpdateProgress = async (orderItemId: string, payload: { status?: string; room_number?: string; meal_status?: string }) => {
    setUpdatingId(orderItemId);
    try {
      await hotelApi.updateItemProgress(orderItemId, payload);
      if (detailOrder?.id) {
        const res = await hotelApi.getOrder(detailOrder.id);
        if (res.data.success) setDetailOrder(res.data.data);
      }
      fetchOrders();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal update');
    } finally {
      setUpdatingId(null);
    }
  };

  const hotelItems = detailOrder?.OrderItems?.filter((i: any) => i.type === 'hotel') || [];

  const refetch = () => {
    fetchOrders();
    fetchProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <h1 className="text-2xl font-bold text-slate-900">Hotel – Order & Produk</h1>
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefreshControl onRefresh={refetch} disabled={loading} size="sm" />
          <div className="flex gap-2">
          <Button
            variant={tab === 'orders' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({})}
          >
            Order Hotel
          </Button>
          <Button
            variant={tab === 'products' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSearchParams({ tab: 'products' })}
          >
            Produk & Harga (read-only)
          </Button>
          </div>
        </div>
      </div>

      {tab === 'orders' && (
        <Card>
          {loading ? (
            <div className="py-12 text-center text-slate-500">Memuat...</div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Belum ada order dengan item hotel.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4">Order</th>
                    <th className="text-left py-3 px-4">Owner</th>
                    <th className="text-right py-3 px-4">Item Hotel</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const hotelCount = (o.OrderItems || []).filter((i: any) => i.type === 'hotel').length;
                    const firstStatus = (o.OrderItems || []).find((i: any) => i.type === 'hotel')?.HotelProgress?.status || 'waiting_confirmation';
                    return (
                      <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium">{o.order_number}</td>
                        <td className="py-3 px-4">{o.User?.name}</td>
                        <td className="py-3 px-4 text-right">{hotelCount}</td>
                        <td className="py-3 px-4">{firstStatus}</td>
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
            <Lock className="w-4 h-4" /> Harga hanya informasi. Perubahan harga diatur oleh pusat, cabang, dan role invoice.
          </p>
          {loading ? (
            <div className="py-12 text-center text-slate-500">Memuat...</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Belum ada produk hotel.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4">Kode</th>
                  <th className="text-left py-3 px-4">Nama</th>
                  <th className="text-right py-3 px-4">Harga General (Pusat)</th>
                  <th className="text-right py-3 px-4">Harga Cabang</th>
                  <th className="text-left py-3 px-4">Mata Uang</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">{p.code}</td>
                    <td className="py-3 px-4">{p.name}</td>
                    <td className="py-3 px-4 text-right">{p.price_general != null ? formatIDR(p.price_general) : '-'}</td>
                    <td className="py-3 px-4 text-right">{p.price_branch != null ? formatIDR(p.price_branch) : '-'}</td>
                    <td className="py-3 px-4">{p.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              {hotelItems.map((item: any) => {
                const prog = item.HotelProgress;
                const status = prog?.status || 'waiting_confirmation';
                const mealStatus = prog?.meal_status || 'pending';
                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl space-y-3">
                    <p className="font-semibold">Item Hotel · Qty: {item.quantity} · {formatIDR(parseFloat(item.unit_price))} / unit</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          placeholder="Contoh: 301"
                          defaultValue={prog?.room_number || ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== prog?.room_number) handleUpdateProgress(item.id, { room_number: v });
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

export default HotelWorkPage;
