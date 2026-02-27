import React, { useState, useEffect, useCallback } from 'react';
import { Bus, Settings, Users, AlertCircle, ShoppingCart, Pencil, X, ArrowRight, ArrowLeft, ArrowLeftRight } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { businessRulesApi, productsApi } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import BusWorkPage from './BusWorkPage';

type BusTripType = 'one_way' | 'return_only' | 'round_trip';
type BusRouteType = 'full_route' | 'bandara_makkah' | 'bandara_madinah' | 'bandara_madinah_only';

const BUS_TRIP_LABELS: Record<BusTripType, string> = {
  one_way: 'Pergi saja',
  return_only: 'Pulang saja',
  round_trip: 'Pulang pergi'
};

const BUS_ROUTE_LABELS: Record<BusRouteType, string> = {
  full_route: 'Full rute (Mekkah–Madinah)',
  bandara_makkah: 'Bandara–Mekkah',
  bandara_madinah: 'Bandara–Madinah',
  bandara_madinah_only: 'Bandara–Madinah saja'
};

const BUS_ROUTE_KEYS: BusRouteType[] = ['full_route', 'bandara_makkah', 'bandara_madinah', 'bandara_madinah_only'];

interface BusProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  meta?: { trip_type?: BusTripType; route_prices?: Partial<Record<BusRouteType, number>> };
  price_general_idr?: number | null;
  price_general_sar?: number | null;
  price_general_usd?: number | null;
  price_general?: number | null;
  price_branch?: number | null;
  currency?: string;
}

const formatRp = (n: number) => (n > 0 ? `Rp ${Number(n).toLocaleString('id-ID')}` : '—');

type BusTabId = 'besar' | 'menengah' | 'kecil';

const BUS_TABS: { id: BusTabId; label: string; description: string }[] = [
  { id: 'besar', label: 'Bus Besar', description: 'Minimal paket & penalti jika kurang' },
  { id: 'menengah', label: 'Bus Menengah (Hiace)', description: 'Harga saja, tanpa penalti' },
  { id: 'kecil', label: 'Mobil Kecil', description: 'Harga saja, tanpa penalti' },
];

type BusPageProps = { embedInProducts?: boolean };

const BusPage: React.FC<BusPageProps> = ({ embedInProducts }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { addItem: addDraftItem } = useOrderDraft();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<BusTabId>('besar');
  const [form, setForm] = useState({
    bus_min_pack: 35,
    bus_penalty_idr: 500000,
    bus_menengah_price_idr: 0,
    bus_kecil_price_idr: 0,
  });
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [penaltyCurrency, setPenaltyCurrency] = useState<'IDR' | 'SAR' | 'USD'>('IDR');
  const [menengahCurrency, setMenengahCurrency] = useState<'IDR' | 'SAR' | 'USD'>('IDR');
  const [kecilCurrency, setKecilCurrency] = useState<'IDR' | 'SAR' | 'USD'>('IDR');
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'role_invoice_saudi';
  const [busProducts, setBusProducts] = useState<BusProduct[]>([]);
  const [loadingBusProducts, setLoadingBusProducts] = useState(false);

  const canConfig = user?.role === 'super_admin' || user?.role === 'admin_pusat';
  const isPusat = user?.role === 'super_admin' || user?.role === 'admin_pusat';

  const [editProductModal, setEditProductModal] = useState<{
    product: BusProduct;
    name: string;
    description: string;
    trip_type: BusTripType;
    route_prices: Record<BusRouteType, number>;
  } | null>(null);
  const [editProductSaving, setEditProductSaving] = useState(false);

  useEffect(() => {
    businessRulesApi.get().then((res) => {
      const data = (res.data as { data?: { currency_rates?: unknown } })?.data;
      let cr = data?.currency_rates;
      if (typeof cr === 'string') {
        try { cr = JSON.parse(cr) as { SAR_TO_IDR?: number; USD_TO_IDR?: number }; } catch { cr = null; }
      }
      const rates = cr as { SAR_TO_IDR?: number; USD_TO_IDR?: number } | null;
      if (rates && typeof rates === 'object') setCurrencyRates({ SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 });
    }).catch(() => {});
  }, []);

  const fetchBusConfig = () => {
    if (!canConfig && !embedInProducts) return;
    setLoading(true);
    businessRulesApi.get()
      .then((res) => {
        const d = res.data?.data as Record<string, unknown> | undefined;
        if (d) setForm({
          bus_min_pack: Number(d.bus_min_pack) || 35,
          bus_penalty_idr: Number(d.bus_penalty_idr) || 500000,
          bus_menengah_price_idr: Number(d.bus_menengah_price_idr) || 0,
          bus_kecil_price_idr: Number(d.bus_kecil_price_idr) || 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBusConfig();
  }, [canConfig, embedInProducts]);

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

  const handleSaveBesar = async () => {
    if (!canConfig) return;
    setSaving(true);
    try {
      await businessRulesApi.set({ rules: { bus_min_pack: form.bus_min_pack, bus_penalty_idr: form.bus_penalty_idr } });
      showToast('Konfigurasi bus besar disimpan', 'success');
      fetchBusConfig();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMenengah = async () => {
    if (!canConfig) return;
    setSaving(true);
    try {
      await businessRulesApi.set({ rules: { bus_menengah_price_idr: form.bus_menengah_price_idr } });
      showToast('Harga bus menengah (Hiace) disimpan', 'success');
      fetchBusConfig();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKecil = async () => {
    if (!canConfig) return;
    setSaving(true);
    try {
      await businessRulesApi.set({ rules: { bus_kecil_price_idr: form.bus_kecil_price_idr } });
      showToast('Harga mobil kecil disimpan', 'success');
      fetchBusConfig();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const refetchAll = useCallback(() => {
    fetchBusConfig();
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
          trip_type: editProductModal.trip_type,
          route_prices: editProductModal.route_prices
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

  const getRoutePrice = (p: BusProduct, route: BusRouteType): number => {
    return p.meta?.route_prices?.[route] ?? p.price_general_idr ?? p.price_general ?? 0;
  };

  const handleAddToOrder = (p: BusProduct, route: BusRouteType) => {
    const priceIdr = getRoutePrice(p, route);
    if (priceIdr <= 0) return;
    addDraftItem({
      type: 'bus',
      product_id: p.id,
      product_name: `${p.name} (${BUS_ROUTE_LABELS[route]})`,
      unit_price_idr: priceIdr,
      quantity: 1,
      meta: { bus_type: 'besar', route_type: route, trip_type: (p.meta?.trip_type as BusTripType) || 'round_trip' }
    });
    showToast('Bus ditambahkan ke order.', 'success');
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
            Atur minimal paket dan penalti bus. Rute Mekkah–Madinah, Bandara–Mekkah/Madinah. Order & tiket dikelola tim Bus cabang.
          </p>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={loading || loadingBusProducts} />
      </div>

      {(canConfig || embedInProducts) && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-slate-500" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">Pengaturan Bus Saudi {embedInProducts && !canConfig ? '(harga dari admin pusat)' : ''}</h3>
              <p className="text-sm text-slate-500">{canConfig ? 'Bus besar (min paket & penalti), bus menengah & mobil kecil (harga saja)' : 'Lihat saja. Pekerjaan bus di menu Bus.'}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-4">
            {BUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-slate-500 text-sm py-4">Memuat...</p>
          ) : (
            <>
              {/* Tab: Bus Besar ΓÇö minimal paket & penalti */}
              {activeTab === 'besar' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-600 shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Minimal paket</p>
                        <p className="text-lg font-bold text-slate-900 tabular-nums">{form.bus_min_pack || 0} <span className="text-sm font-normal text-slate-600">orang</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                      <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Penalti jika &lt; min paket</p>
                        <p className="text-lg font-bold text-slate-900 tabular-nums">Rp {Number(form.bus_penalty_idr || 0).toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">Bus besar: minimal 35 paket. Jika kurang dari minimal, dikenakan penalti. Jika ΓëÑ minimal, penalti tidak berlaku.</p>
                  <div className="flex flex-wrap items-end gap-4 pt-2">
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Minimal paket (orang)</label>
                      <input
                        type="number"
                        min={1}
                        value={form.bus_min_pack || ''}
                        onChange={canConfig ? (e) => setForm((f) => ({ ...f, bus_min_pack: Number(e.target.value) || 0 })) : undefined}
                        readOnly={!canConfig}
                        className={`w-full max-w-[160px] border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${canConfig ? 'bg-white' : 'bg-slate-100 cursor-default'}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Penalti bus</label>
                      <p className="text-xs text-slate-500 mb-1">Pilih mata uang, lalu isi nilai. Mata uang lain mengikuti kurs dari Menu Settings.</p>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <select
                          value={penaltyCurrency}
                          onChange={canConfig ? (e) => setPenaltyCurrency(e.target.value as 'IDR' | 'SAR' | 'USD') : undefined}
                          disabled={!canConfig}
                          className={`border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 ${canConfig ? 'bg-white' : 'bg-slate-100 cursor-default'}`}
                        >
                          <option value="IDR">IDR</option>
                          <option value="SAR">SAR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(['IDR', 'SAR', 'USD'] as const).map((curKey) => {
                          const triple = fillFromSource('IDR', form.bus_penalty_idr || 0, currencyRates);
                          const val = curKey === 'IDR' ? triple.idr : curKey === 'SAR' ? triple.sar : triple.usd;
                          const isEditable = canConfig && penaltyCurrency === curKey;
                          return (
                            <div key={curKey}>
                              <span className="text-xs text-slate-500 block mb-0.5">{curKey}{!isEditable && ' (konversi)'}</span>
                              <input
                                type="number"
                                min={0}
                                step={curKey === 'IDR' ? 1 : 0.01}
                                value={val || ''}
                                readOnly={!isEditable}
                                onChange={isEditable ? (e) => {
                                  const v = parseFloat(e.target.value) || 0;
                                  const next = fillFromSource(curKey, v, currencyRates);
                                  setForm((f) => ({ ...f, bus_penalty_idr: Math.round(next.idr) }));
                                } : undefined}
                                className={`w-full max-w-[120px] border rounded-xl px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 ${isEditable ? 'bg-white' : 'bg-slate-100 text-slate-600 cursor-not-allowed'}`}
                                placeholder="0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {canConfig && (
                      <Button variant="primary" onClick={handleSaveBesar} disabled={saving} className="shrink-0">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Bus Menengah (Hiace) ΓÇö harga saja, tanpa penalti */}
              {activeTab === 'menengah' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Bus menengah (contoh: Hiace). Hanya atur harga; tidak ada penalti.</p>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Harga</label>
                      <p className="text-xs text-slate-500 mb-1">Pilih mata uang. Lainnya mengikuti kurs dari Menu Settings.</p>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <select
                          value={menengahCurrency}
                          onChange={canConfig ? (e) => setMenengahCurrency(e.target.value as 'IDR' | 'SAR' | 'USD') : undefined}
                          disabled={!canConfig}
                          className={`border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 ${canConfig ? 'bg-white' : 'bg-slate-100 cursor-default'}`}
                        >
                          <option value="IDR">IDR</option>
                          <option value="SAR">SAR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(['IDR', 'SAR', 'USD'] as const).map((curKey) => {
                          const triple = fillFromSource('IDR', form.bus_menengah_price_idr || 0, currencyRates);
                          const val = curKey === 'IDR' ? triple.idr : curKey === 'SAR' ? triple.sar : triple.usd;
                          const isEditable = canConfig && menengahCurrency === curKey;
                          return (
                            <div key={curKey}>
                              <span className="text-xs text-slate-500 block mb-0.5">{curKey}{!isEditable && ' (konversi)'}</span>
                              <input
                                type="number"
                                min={0}
                                step={curKey === 'IDR' ? 1 : 0.01}
                                value={val || ''}
                                readOnly={!isEditable}
                                onChange={isEditable ? (e) => {
                                  const v = parseFloat(e.target.value) || 0;
                                  const next = fillFromSource(curKey, v, currencyRates);
                                  setForm((f) => ({ ...f, bus_menengah_price_idr: Math.round(next.idr) }));
                                } : undefined}
                                className={`w-full max-w-[120px] border rounded-xl px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 ${isEditable ? 'bg-white' : 'bg-slate-100 text-slate-600 cursor-not-allowed'}`}
                                placeholder="0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {canConfig && (
                      <Button variant="primary" onClick={handleSaveMenengah} disabled={saving} className="shrink-0">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Mobil Kecil ΓÇö harga saja, tanpa penalti */}
              {activeTab === 'kecil' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Mobil kecil. Hanya atur harga; tidak ada penalti.</p>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Harga</label>
                      <p className="text-xs text-slate-500 mb-1">Pilih mata uang. Lainnya mengikuti kurs dari Menu Settings.</p>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <select
                          value={kecilCurrency}
                          onChange={canConfig ? (e) => setKecilCurrency(e.target.value as 'IDR' | 'SAR' | 'USD') : undefined}
                          disabled={!canConfig}
                          className={`border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 ${canConfig ? 'bg-white' : 'bg-slate-100 cursor-default'}`}
                        >
                          <option value="IDR">IDR</option>
                          <option value="SAR">SAR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(['IDR', 'SAR', 'USD'] as const).map((curKey) => {
                          const triple = fillFromSource('IDR', form.bus_kecil_price_idr || 0, currencyRates);
                          const val = curKey === 'IDR' ? triple.idr : curKey === 'SAR' ? triple.sar : triple.usd;
                          const isEditable = canConfig && kecilCurrency === curKey;
                          return (
                            <div key={curKey}>
                              <span className="text-xs text-slate-500 block mb-0.5">{curKey}{!isEditable && ' (konversi)'}</span>
                              <input
                                type="number"
                                min={0}
                                step={curKey === 'IDR' ? 1 : 0.01}
                                value={val || ''}
                                readOnly={!isEditable}
                                onChange={isEditable ? (e) => {
                                  const v = parseFloat(e.target.value) || 0;
                                  const next = fillFromSource(curKey, v, currencyRates);
                                  setForm((f) => ({ ...f, bus_kecil_price_idr: Math.round(next.idr) }));
                                } : undefined}
                                className={`w-full max-w-[120px] border rounded-xl px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 ${isEditable ? 'bg-white' : 'bg-slate-100 text-slate-600 cursor-not-allowed'}`}
                                placeholder="0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {canConfig && (
                      <Button variant="primary" onClick={handleSaveKecil} disabled={saving} className="shrink-0">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Tabel produk bus: rute, workflow, aksi Edit & Tambah ke order */}
      {(canAddToOrder || embedInProducts) && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Produk bus {canAddToOrder ? 'untuk order' : '(harga dari admin pusat)'}</h3>
          <p className="text-sm text-slate-500 mb-3">Rute: Full Mekkah–Madinah, Bandara–Mekkah, Bandara–Madinah. Workflow pergi/pulang. Pekerjaan bus di menu Bus.</p>
          {loadingBusProducts ? (
            <p className="text-slate-500 text-sm py-4">Memuat produk...</p>
          ) : busProducts.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">Belum ada produk bus. Tambah produk bus di master produk.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Kode</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Nama</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Workflow</th>
                    {BUS_ROUTE_KEYS.map((route) => (
                      <th key={route} className="text-left py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">{BUS_ROUTE_LABELS[route]}</th>
                    ))}
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {busProducts.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2 px-4 font-mono text-slate-600">{p.code || '-'}</td>
                      <td className="py-2 px-4 font-medium text-slate-900">{p.name}</td>
                      <td className="py-2 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700">
                          {BUS_TRIP_LABELS[(p.meta?.trip_type as BusTripType) || 'round_trip']}
                        </span>
                      </td>
                      {BUS_ROUTE_KEYS.map((route) => {
                        const priceIdr = getRoutePrice(p, route);
                        return (
                          <td key={route} className="py-2 px-4 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-600">{formatRp(priceIdr)}</span>
                              {canAddToOrder && priceIdr > 0 && (
                                <Button variant="outline" size="sm" className="p-1 min-w-0 h-7 w-fit" onClick={() => handleAddToOrder(p, route)} title={`Tambah ke order: ${BUS_ROUTE_LABELS[route]}`}>
                                  <ShoppingCart className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-2 px-4 text-right">
                        {isPusat && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const rp = p.meta?.route_prices || {};
                              setEditProductModal({
                                product: p,
                                name: p.name,
                                description: p.description ?? '',
                                trip_type: (p.meta?.trip_type as BusTripType) || 'round_trip',
                                route_prices: {
                                  full_route: rp.full_route ?? p.price_general_idr ?? p.price_general ?? 0,
                                  bandara_makkah: rp.bandara_makkah ?? 0,
                                  bandara_madinah: rp.bandara_madinah ?? 0,
                                  bandara_madinah_only: rp.bandara_madinah_only ?? 0
                                }
                              });
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-1" /> Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal Edit produk bus */}
      {editProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !editProductSaving && setEditProductModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Workflow perjalanan</label>
                <div className="flex flex-wrap gap-2">
                  {(['one_way', 'return_only', 'round_trip'] as const).map((tripType) => (
                    <button
                      key={tripType}
                      type="button"
                      onClick={() => setEditProductModal((m) => m ? { ...m, trip_type: tripType } : null)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${editProductModal.trip_type === tripType ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {tripType === 'one_way' && <ArrowRight className="w-4 h-4" />}
                      {tripType === 'return_only' && <ArrowLeft className="w-4 h-4" />}
                      {tripType === 'round_trip' && <ArrowLeftRight className="w-4 h-4" />}
                      {BUS_TRIP_LABELS[tripType]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Harga per rute (IDR)</label>
                <div className="space-y-3">
                  {BUS_ROUTE_KEYS.map((route) => (
                    <div key={route} className="flex items-center gap-3">
                      <span className="w-48 text-sm text-slate-600 shrink-0">{BUS_ROUTE_LABELS[route]}</span>
                      <input
                        type="number"
                        min={0}
                        value={editProductModal.route_prices[route] || ''}
                        onChange={(e) => setEditProductModal((m) => m ? { ...m, route_prices: { ...m.route_prices, [route]: Math.max(0, parseFloat(e.target.value) || 0) } } : null)}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <Button variant="outline" onClick={() => setEditProductModal(null)} disabled={editProductSaving}>Batal</Button>
              <Button variant="primary" onClick={saveEditProduct} disabled={editProductSaving}>{editProductSaving ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
        <Bus className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-slate-900 text-sm">Order & tiket bus</h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Order bus, tiket, dan status kedatangan/keberangkatan dikelola dengan akun <strong>role Bus Saudi cabang</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BusPage;
