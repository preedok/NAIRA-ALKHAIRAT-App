import React, { useState, useEffect, useCallback } from 'react';
import { Bus, Pencil, X, Plus, ArrowRight, ArrowLeft, ArrowLeftRight, ShoppingCart } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, businessRulesApi } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import { formatIDR, formatSAR, formatUSD } from '../../../utils';
import BusWorkPage from './BusWorkPage';

type BusTripType = 'one_way' | 'return_only' | 'round_trip';
type BusKind = 'bus' | 'hiace';

const BUS_TRIP_LABELS: Record<BusTripType, string> = {
  one_way: 'Jemput saja',
  return_only: 'Pulang saja',
  round_trip: 'Pulang pergi'
};

/** Satu harga per tipe perjalanan (semua rute sama). */
type RoutePricesByTrip = Record<BusTripType, number>;

interface BusProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  meta?: {
    bus_kind?: BusKind;
    route_prices_by_trip?: Partial<RoutePricesByTrip>;
    price_per_vehicle_idr?: number;
    default_quota?: number;
  };
  price_general_idr?: number | null;
  price_general_sar?: number | null;
  price_general_usd?: number | null;
  price_general?: number | null;
  price_branch?: number | null;
  currency?: string;
}

const emptyPricesByTrip = (): RoutePricesByTrip => ({
  one_way: 0,
  return_only: 0,
  round_trip: 0
});

const BUS_KIND_LABELS: Record<BusKind, string> = {
  bus: 'Bus (min 35 orang, penalti jika kurang)',
  hiace: 'Hiace (harga per mobil, tanpa penalti)'
};

const formatRp = (n: number) => (n > 0 ? `Rp ${Number(n).toLocaleString('id-ID')}` : '—');

type BusPageProps = { embedInProducts?: boolean };

const BusPage: React.FC<BusPageProps> = ({ embedInProducts }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { addItem: addDraftItem } = useOrderDraft();
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'role_invoice_saudi';
  const [busProducts, setBusProducts] = useState<BusProduct[]>([]);
  const [loadingBusProducts, setLoadingBusProducts] = useState(false);

  const canConfig = user?.role === 'super_admin' || user?.role === 'admin_pusat';
  const isPusat = user?.role === 'super_admin' || user?.role === 'admin_pusat';

  type PriceCurrency = 'IDR' | 'SAR' | 'USD';

  const [editProductModal, setEditProductModal] = useState<{
    product: BusProduct;
    name: string;
    description: string;
    bus_kind: BusKind;
    route_prices_by_trip: RoutePricesByTrip;
    price_per_vehicle_idr: number;
    price_currency: PriceCurrency;
    default_quota: number | '';
  } | null>(null);
  const [editProductSaving, setEditProductSaving] = useState(false);

  const [addBusModalOpen, setAddBusModalOpen] = useState(false);
  const [addBusForm, setAddBusForm] = useState({
    name: '',
    description: '',
    bus_kind: 'bus' as BusKind,
    route_prices_by_trip: emptyPricesByTrip(),
    price_per_vehicle_idr: 0,
    price_currency: 'IDR' as PriceCurrency,
    default_quota: '' as number | ''
  });
  const [addBusSaving, setAddBusSaving] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({ SAR_TO_IDR: 4200, USD_TO_IDR: 15500 });

  useEffect(() => {
    businessRulesApi.get().then((res) => {
      const data = (res.data as { data?: { currency_rates?: unknown } })?.data;
      let cr = data?.currency_rates;
      if (typeof cr === 'string') try { cr = JSON.parse(cr) as { SAR_TO_IDR?: number; USD_TO_IDR?: number }; } catch { cr = null; }
      const rates = cr as { SAR_TO_IDR?: number; USD_TO_IDR?: number } | null;
      if (rates && typeof rates === 'object') setCurrencyRates({ SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 });
    }).catch(() => {});
  }, []);

  const fetchBusProducts = useCallback(() => {
    if (!canAddToOrder && !embedInProducts) return;
    setLoadingBusProducts(true);
    const params = { type: 'bus', with_prices: 'true', include_inactive: 'false', limit: 50, ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
    productsApi.list(params)
      .then((res) => {
        const data = (res.data as { data?: BusProduct[] })?.data;
        setBusProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => setBusProducts([]))
      .finally(() => setLoadingBusProducts(false));
  }, [canAddToOrder, embedInProducts, user?.role]);

  useEffect(() => {
    fetchBusProducts();
  }, [fetchBusProducts]);

  const refetchAll = useCallback(() => {
    fetchBusProducts();
  }, [fetchBusProducts]);

  const saveEditProduct = async () => {
    if (!editProductModal) return;
    if (!editProductModal.name.trim()) { showToast('Nama produk wajib', 'error'); return; }
    setEditProductSaving(true);
    try {
      await productsApi.update(editProductModal.product.id, {
        name: editProductModal.name.trim(),
        description: editProductModal.description.trim() || null,
        meta: {
          bus_kind: editProductModal.bus_kind,
          route_prices_by_trip: editProductModal.bus_kind === 'bus' ? editProductModal.route_prices_by_trip : undefined,
          price_per_vehicle_idr: editProductModal.bus_kind === 'hiace' ? editProductModal.price_per_vehicle_idr : undefined,
          default_quota: editProductModal.default_quota !== '' && editProductModal.default_quota !== undefined ? Number(editProductModal.default_quota) : null
        }
      });
      showToast('Produk bus diperbarui', 'success');
      setEditProductModal(null);
      fetchBusProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal memperbarui', 'error');
    } finally {
      setEditProductSaving(false);
    }
  };

  const handleCreateBus = async () => {
    if (!addBusForm.name.trim()) {
      showToast('Nama produk wajib', 'error');
      return;
    }
    setAddBusSaving(true);
    try {
      const payload: { name: string; description?: string; bus_kind: BusKind; route_prices_by_trip?: RoutePricesByTrip; price_per_vehicle_idr?: number; default_quota?: number | null } = {
        name: addBusForm.name.trim(),
        description: addBusForm.description.trim() || undefined,
        bus_kind: addBusForm.bus_kind
      };
      if (addBusForm.bus_kind === 'bus') {
        payload.route_prices_by_trip = addBusForm.route_prices_by_trip;
      } else {
        payload.price_per_vehicle_idr = Math.max(0, addBusForm.price_per_vehicle_idr || 0);
      }
      const q = addBusForm.default_quota === '' ? undefined : Math.max(0, parseInt(String(addBusForm.default_quota), 10) || 0);
      if (q !== undefined) payload.default_quota = q;
      await productsApi.createBus(payload);
      showToast('Produk bus ditambahkan', 'success');
      setAddBusModalOpen(false);
      setAddBusForm({ name: '', description: '', bus_kind: 'bus', route_prices_by_trip: emptyPricesByTrip(), price_per_vehicle_idr: 0, price_currency: 'IDR', default_quota: '' });
      fetchBusProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menambah produk bus', 'error');
    } finally {
      setAddBusSaving(false);
    }
  };

  const getPriceForTrip = (p: BusProduct, tripType: BusTripType): number => {
    if (p.meta?.bus_kind === 'hiace') return p.meta?.price_per_vehicle_idr ?? p.price_general_idr ?? p.price_general ?? 0;
    const v = p.meta?.route_prices_by_trip?.[tripType];
    return typeof v === 'number' && v >= 0 ? v : p.price_general_idr ?? p.price_general ?? 0;
  };

  const hasPricesForTrip = (p: BusProduct, tripType: BusTripType): boolean => {
    const v = p.meta?.route_prices_by_trip?.[tripType];
    return typeof v === 'number' && v > 0;
  };

  if (user?.role === 'role_bus' && !embedInProducts) {
    return <BusWorkPage />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Bus Saudi</h2>
          <p className="text-slate-600 text-sm mt-0.5">
            Pilih tipe perjalanan (jemput saja / pulang saja / pulang pergi), lalu isi harga per rute (jemput di mana → antar ke mana) dalam IDR, SAR, atau USD—nilai terkonversi otomatis. Data tampil di tabel dan dipakai untuk order.
          </p>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={loadingBusProducts} />
      </div>

      {/* Daftar produk bus */}
      {(canAddToOrder || embedInProducts) && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Daftar produk bus</h3>
              <p className="text-sm text-slate-500 mt-0.5">Tambah produk bus atau Hiace; isi harga dan kuota default (per hari). Kuota tampil di tabel dan di Kalender—berkurang otomatis per tanggal jika ada order.</p>
            </div>
            {isPusat && (
              <Button variant="primary" size="sm" onClick={() => setAddBusModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Tambah produk bus
              </Button>
            )}
          </div>
          {loadingBusProducts ? (
            <p className="text-slate-500 text-sm py-4">Memuat produk...</p>
          ) : busProducts.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-slate-500 text-sm">Belum ada produk bus.</p>
              {!isPusat && <p className="text-xs text-slate-400 mt-1">Admin pusat dapat menambah produk bus.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
<thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Kode</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Nama</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Jenis</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Harga</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Harga / mobil</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Kuota</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {busProducts.map((p) => {
                    const isHiace = p.meta?.bus_kind === 'hiace';
                    return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2 px-4 font-mono text-slate-600">{p.code || '-'}</td>
                      <td className="py-2 px-4 font-medium text-slate-900">{p.name}</td>
                      <td className="py-2 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${isHiace ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isHiace ? 'Hiace' : 'Bus'}
                        </span>
                      </td>
                      <td className="py-2 px-4 align-top">
                        {isHiace ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {(() => {
                              const priceIdr = getPriceForTrip(p, 'round_trip');
                              const triple = fillFromSource('IDR', priceIdr, currencyRates);
                              return (
                                <>
                                  <span className="text-slate-700 font-medium">{formatRp(priceIdr)}</span>
                                  {priceIdr > 0 && <span className="text-xs text-slate-500">{formatSAR(triple.sar)} · {formatUSD(triple.usd)}</span>}
                                  {priceIdr <= 0 && <span className="text-slate-400 text-xs">—</span>}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        {isHiace ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-700 font-medium">{formatRp(p.meta?.price_per_vehicle_idr ?? 0)}</span>
                            {(p.meta?.price_per_vehicle_idr ?? 0) > 0 && <span className="text-xs text-slate-500">{formatSAR(fillFromSource('IDR', p.meta?.price_per_vehicle_idr ?? 0, currencyRates).sar)} · {formatUSD(fillFromSource('IDR', p.meta?.price_per_vehicle_idr ?? 0, currencyRates).usd)}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-slate-700 tabular-nums">{typeof p.meta?.default_quota === 'number' && p.meta.default_quota >= 0 ? p.meta.default_quota : '—'}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">per hari (kalender)</p>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {canAddToOrder && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="shrink-0"
                              onClick={() => {
                                const priceIdr = isHiace
                                  ? (p.meta?.price_per_vehicle_idr ?? p.price_general_idr ?? 0)
                                  : getPriceForTrip(p, 'round_trip');
                                addDraftItem({
                                  type: 'bus',
                                  product_id: p.id,
                                  product_name: p.name,
                                  unit_price_idr: priceIdr,
                                  quantity: 1
                                });
                                showToast('Bus ditambahkan ke order. Buka menu Order untuk lengkapi tipe perjalanan & tanggal.', 'success');
                              }}
                              title="Pesan / Tambah ke order"
                            >
                              <ShoppingCart className="w-4 h-4 mr-1" /> Pesan
                            </Button>
                          )}
                          {isPusat && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const raw = p.meta?.route_prices_by_trip as Record<string, unknown> | undefined;
                                const toNum = (v: unknown): number => {
                                  if (typeof v === 'number' && !Number.isNaN(v)) return v;
                                  if (v && typeof v === 'object' && typeof (v as Record<string, unknown>).full_route === 'number') return Number((v as Record<string, number>).full_route) || 0;
                                  return 0;
                                };
                                const one = raw ? toNum(raw.one_way) : 0;
                                const ret = raw ? toNum(raw.return_only) : 0;
                                const round = raw ? toNum(raw.round_trip) : 0;
                                setEditProductModal({
                                  product: p,
                                  name: p.name,
                                  description: p.description ?? '',
                                  bus_kind: (p.meta?.bus_kind as BusKind) || 'bus',
                                  route_prices_by_trip: { one_way: one, return_only: ret, round_trip: round },
                                  price_per_vehicle_idr: p.meta?.price_per_vehicle_idr ?? 0,
                                  price_currency: 'IDR',
                                  default_quota: (typeof p.meta?.default_quota === 'number' && p.meta.default_quota >= 0) ? p.meta.default_quota : ''
                                });
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-1" /> Edit
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal Tambah produk bus — hanya form produk */}
      {addBusModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !addBusSaving && setAddBusModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/80">
              <h3 className="text-lg font-bold text-slate-900">Tambah produk bus</h3>
              <button type="button" onClick={() => !addBusSaving && setAddBusModalOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama produk <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={addBusForm.name}
                  onChange={(e) => setAddBusForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="Contoh: Bus Mekkah–Madinah atau Hiace Madinah"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Jenis</label>
                <div className="flex gap-3">
                  {(['bus', 'hiace'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="bus_kind"
                        checked={addBusForm.bus_kind === k}
                        onChange={() => setAddBusForm((f) => ({ ...f, bus_kind: k }))}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-slate-700">{BUS_KIND_LABELS[k]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kuota</label>
                <p className="text-xs text-slate-500 mb-1">Jumlah kursi/unit per hari untuk monitoring di Kalender. Kosongkan jika tidak pakai kuota.</p>
                <input
                  type="number"
                  min={0}
                  value={addBusForm.default_quota === '' ? '' : addBusForm.default_quota}
                  onChange={(e) => setAddBusForm((f) => ({ ...f, default_quota: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  className="w-full max-w-[140px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="Total Kuota Bus Operasi"
                />
              </div>
              {addBusForm.bus_kind === 'hiace' && (
                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50 space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Harga per mobil</label>
                  <p className="text-xs text-slate-500 mb-2">Pilih mata uang input; hanya input tersebut yang bisa diisi. Mata uang lain otomatis terkonversi sesuai kurs aplikasi.</p>
                  <div className="flex flex-wrap gap-3 mb-2">
                    {(['IDR', 'SAR', 'USD'] as const).map((cur) => (
                      <label key={cur} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="add_price_currency" checked={addBusForm.price_currency === cur} onChange={() => setAddBusForm((f) => ({ ...f, price_currency: cur }))} className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                        <span className="text-sm font-medium text-slate-700">{cur}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(() => {
                      const idr = addBusForm.price_per_vehicle_idr ?? 0;
                      const triple = fillFromSource('IDR', idr, currencyRates);
                      const cur = addBusForm.price_currency;
                      return (
                        <>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">IDR</span>
                            <input type="number" min={0} value={idr > 0 ? idr : ''} onChange={(e) => setAddBusForm((f) => ({ ...f, price_per_vehicle_idr: Math.max(0, parseFloat(e.target.value) || 0) }))} disabled={cur !== 'IDR'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'IDR' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">SAR</span>
                            <input type="number" min={0} step={0.01} value={triple.sar > 0 ? triple.sar : ''} onChange={(e) => setAddBusForm((f) => ({ ...f, price_per_vehicle_idr: fillFromSource('SAR', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr }))} disabled={cur !== 'SAR'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'SAR' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">USD</span>
                            <input type="number" min={0} step={0.01} value={triple.usd > 0 ? triple.usd : ''} onChange={(e) => setAddBusForm((f) => ({ ...f, price_per_vehicle_idr: fillFromSource('USD', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr }))} disabled={cur !== 'USD'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'USD' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
              {addBusForm.bus_kind === 'bus' && (
                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50 space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Harga</label>
                  <p className="text-xs text-slate-500">Pilih mata uang input; hanya input tersebut yang bisa diisi. Mata uang lain otomatis terkonversi sesuai kurs aplikasi.</p>
                  <div className="flex flex-wrap gap-3 mb-2">
                    {(['IDR', 'SAR', 'USD'] as const).map((cur) => (
                      <label key={cur} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="add_bus_currency" checked={addBusForm.price_currency === cur} onChange={() => setAddBusForm((f) => ({ ...f, price_currency: cur }))} className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                        <span className="text-sm font-medium text-slate-700">{cur}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(() => {
                      const idr = addBusForm.route_prices_by_trip.round_trip ?? 0;
                      const triple = fillFromSource('IDR', idr, currencyRates);
                      const cur = addBusForm.price_currency;
                      const setPrice = (valueIdr: number) => setAddBusForm((f) => ({
                        ...f,
                        route_prices_by_trip: { one_way: valueIdr, return_only: valueIdr, round_trip: valueIdr }
                      }));
                      return (
                        <>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">IDR</span>
                            <input type="number" min={0} value={idr > 0 ? idr : ''} onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))} disabled={cur !== 'IDR'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'IDR' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">SAR</span>
                            <input type="number" min={0} step={0.01} value={triple.sar > 0 ? triple.sar : ''} onChange={(e) => setPrice(fillFromSource('SAR', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr)} disabled={cur !== 'SAR'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'SAR' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">USD</span>
                            <input type="number" min={0} step={0.01} value={triple.usd > 0 ? triple.usd : ''} onChange={(e) => setPrice(fillFromSource('USD', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr)} disabled={cur !== 'USD'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'USD' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <Button variant="outline" onClick={() => setAddBusModalOpen(false)} disabled={addBusSaving}>Batal</Button>
              <Button variant="primary" onClick={handleCreateBus} disabled={addBusSaving || !addBusForm.name.trim()}>
                {addBusSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit produk bus */}
      {editProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !editProductSaving && setEditProductModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/80">
              <h3 className="text-lg font-bold text-slate-900">Edit produk bus</h3>
              <button type="button" onClick={() => !editProductSaving && setEditProductModal(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama produk <span className="text-red-500">*</span></label>
                <input type="text" value={editProductModal.name} onChange={(e) => setEditProductModal((m) => m ? { ...m, name: e.target.value } : null)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
                <textarea value={editProductModal.description} onChange={(e) => setEditProductModal((m) => m ? { ...m, description: e.target.value } : null)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Jenis</label>
                <div className="flex gap-3">
                  {(['bus', 'hiace'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="edit_bus_kind"
                        checked={editProductModal.bus_kind === k}
                        onChange={() => setEditProductModal((m) => m ? { ...m, bus_kind: k } : null)}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-slate-700">{BUS_KIND_LABELS[k]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kuota default (kalender)</label>
                <p className="text-xs text-slate-500 mb-1">Jumlah kursi/unit per hari untuk monitoring di Kalender. Kosongkan jika tidak pakai kuota.</p>
                <input
                  type="number"
                  min={0}
                  value={editProductModal.default_quota === '' ? '' : editProductModal.default_quota}
                  onChange={(e) => setEditProductModal((m) => m ? { ...m, default_quota: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) } : null)}
                  className="w-full max-w-[140px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="Opsional"
                />
              </div>
              {editProductModal.bus_kind === 'hiace' && (
                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50 space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Harga per mobil</label>
                  <p className="text-xs text-slate-500 mb-2">Pilih mata uang input; hanya input tersebut yang bisa diisi. Mata uang lain otomatis terkonversi sesuai kurs aplikasi.</p>
                  <div className="flex flex-wrap gap-3 mb-2">
                    {(['IDR', 'SAR', 'USD'] as const).map((cur) => (
                      <label key={cur} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="edit_price_currency" checked={editProductModal.price_currency === cur} onChange={() => setEditProductModal((m) => m ? { ...m, price_currency: cur } : null)} className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                        <span className="text-sm font-medium text-slate-700">{cur}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(() => {
                      const idr = editProductModal.price_per_vehicle_idr ?? 0;
                      const triple = fillFromSource('IDR', idr, currencyRates);
                      const cur = editProductModal.price_currency;
                      return (
                        <>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">IDR</span>
                            <input type="number" min={0} value={idr > 0 ? idr : ''} onChange={(e) => setEditProductModal((m) => m ? { ...m, price_per_vehicle_idr: Math.max(0, parseFloat(e.target.value) || 0) } : null)} disabled={cur !== 'IDR'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'IDR' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">SAR</span>
                            <input type="number" min={0} step={0.01} value={triple.sar > 0 ? triple.sar : ''} onChange={(e) => setEditProductModal((m) => m ? { ...m, price_per_vehicle_idr: fillFromSource('SAR', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr } : null)} disabled={cur !== 'SAR'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'SAR' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">USD</span>
                            <input type="number" min={0} step={0.01} value={triple.usd > 0 ? triple.usd : ''} onChange={(e) => setEditProductModal((m) => m ? { ...m, price_per_vehicle_idr: fillFromSource('USD', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr } : null)} disabled={cur !== 'USD'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'USD' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
              {editProductModal.bus_kind === 'bus' && (
                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50 space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Harga</label>
                  <p className="text-xs text-slate-500">Pilih mata uang input; hanya input tersebut yang bisa diisi. Mata uang lain otomatis terkonversi sesuai kurs aplikasi.</p>
                  <div className="flex flex-wrap gap-3 mb-2">
                    {(['IDR', 'SAR', 'USD'] as const).map((cur) => (
                      <label key={cur} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="edit_bus_currency" checked={editProductModal.price_currency === cur} onChange={() => setEditProductModal((m) => m ? { ...m, price_currency: cur } : null)} className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                        <span className="text-sm font-medium text-slate-700">{cur}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(() => {
                      const idr = editProductModal.route_prices_by_trip.round_trip ?? 0;
                      const triple = fillFromSource('IDR', idr, currencyRates);
                      const cur = editProductModal.price_currency;
                      const setPrice = (valueIdr: number) => setEditProductModal((m) => m ? {
                        ...m,
                        route_prices_by_trip: { one_way: valueIdr, return_only: valueIdr, round_trip: valueIdr }
                      } : null);
                      return (
                        <>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">IDR</span>
                            <input type="number" min={0} value={idr > 0 ? idr : ''} onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))} disabled={cur !== 'IDR'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'IDR' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">SAR</span>
                            <input type="number" min={0} step={0.01} value={triple.sar > 0 ? triple.sar : ''} onChange={(e) => setPrice(fillFromSource('SAR', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr)} disabled={cur !== 'SAR'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'SAR' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                          <div>
                            <span className="block text-xs text-slate-500 mb-0.5">USD</span>
                            <input type="number" min={0} step={0.01} value={triple.usd > 0 ? triple.usd : ''} onChange={(e) => setPrice(fillFromSource('USD', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr)} disabled={cur !== 'USD'} className={`w-full border rounded-lg px-3 py-2 text-sm ${cur === 'USD' ? 'border-slate-200 focus:ring-2 focus:ring-amber-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`} placeholder="0" />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <Button variant="outline" onClick={() => setEditProductModal(null)} disabled={editProductSaving}>Batal</Button>
              <Button variant="primary" onClick={saveEditProduct} disabled={editProductSaving}>{editProductSaving ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">Tiket bus dan status kedatangan/keberangkatan dikelola di Invoice oleh role Bus.</p>
    </div>
  );
};

export default BusPage;
