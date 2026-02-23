import React, { useState, useEffect, useCallback } from 'react';
import { Bus, Settings, Users, AlertCircle, ShoppingCart } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { businessRulesApi, productsApi } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import BusWorkPage from './BusWorkPage';

interface BusProduct {
  id: string;
  code: string;
  name: string;
  price_general_idr?: number | null;
  price_general_sar?: number | null;
  price_general_usd?: number | null;
  price_general?: number | null;
  price_branch?: number | null;
  currency?: string;
}

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

  if (user?.role === 'role_bus' && !embedInProducts) {
    return <BusWorkPage />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Bus Saudi</h2>
          <p className="text-slate-600 text-sm mt-0.5">
            Atur minimal paket dan penalti bus. Order & tiket dikelola tim Bus cabang.
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
              {/* Tab: Bus Besar — minimal paket & penalti */}
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
                  <p className="text-sm text-slate-600">Bus besar: minimal 35 paket. Jika kurang dari minimal, dikenakan penalti. Jika ≥ minimal, penalti tidak berlaku.</p>
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

              {/* Tab: Bus Menengah (Hiace) — harga saja, tanpa penalti */}
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

              {/* Tab: Mobil Kecil — harga saja, tanpa penalti */}
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

      {/* Daftar produk bus: harga (view) atau tambah ke order (invoice) */}
      {(canAddToOrder || embedInProducts) && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-2">Produk bus {canAddToOrder ? 'untuk order' : '(harga dari admin pusat)'}</h3>
          <p className="text-sm text-slate-500 mb-3">{canAddToOrder ? 'Pilih produk bus lalu tambah ke keranjang order.' : 'Lihat saja. Pekerjaan bus di menu Bus.'}</p>
          {loadingBusProducts ? (
            <p className="text-slate-500 text-sm py-4">Memuat produk...</p>
          ) : busProducts.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">Belum ada produk bus. Tambah produk bus di master produk.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Kode</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Nama</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Harga (IDR)</th>
                    {canAddToOrder && <th className="text-center py-2.5 px-3 font-medium text-slate-600">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {busProducts.map((p) => {
                    const priceIdr = p.price_general_idr ?? (p.currency === 'IDR' || !p.currency ? p.price_general ?? p.price_branch : null) ?? 0;
                    return (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono text-slate-600">{p.code || '-'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-3 text-right text-slate-800">Rp {Number(priceIdr).toLocaleString('id-ID')}</td>
                        {canAddToOrder && (
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="p-2 mx-auto"
                              onClick={() => {
                                addDraftItem({
                                  type: 'bus',
                                  product_id: p.id,
                                  product_name: p.name,
                                  unit_price_idr: Number(priceIdr) || 0,
                                  quantity: 1
                                });
                                showToast('Bus ditambahkan ke order.', 'success');
                              }}
                              title="Tambah ke order"
                              aria-label="Tambah ke order"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
