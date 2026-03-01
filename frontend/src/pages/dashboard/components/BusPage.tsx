import React, { useState, useEffect, useCallback } from 'react';
import { Bus, Pencil, X, Plus, ArrowRight, ArrowLeft, ArrowLeftRight, ShoppingCart, Calendar, Trash2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import PageHeader from '../../../components/common/PageHeader';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import PageFilter from '../../../components/common/PageFilter';
import { FilterIconButton, StatCard, CardSectionHeader, Input, Autocomplete, Textarea } from '../../../components/common';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, businessRulesApi, adminPusatApi, type BusSeason } from '../../../services/api';
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

type BusPageProps = {
  embedInProducts?: boolean;
  refreshTrigger?: number;
  embedFilterOpen?: boolean;
  embedFilterOnToggle?: () => void;
  onFilterActiveChange?: (active: boolean) => void;
};

const BusPage: React.FC<BusPageProps> = ({
  embedInProducts,
  refreshTrigger,
  embedFilterOpen,
  embedFilterOnToggle,
  onFilterActiveChange
}) => {
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
  const [busQuotaProduct, setBusQuotaProduct] = useState<BusProduct | null>(null);
  const [busSeasons, setBusSeasons] = useState<BusSeason[]>([]);
  const [busSeasonsLoading, setBusSeasonsLoading] = useState(false);
  const [newSeasonForm, setNewSeasonForm] = useState({ name: '', start_date: '', end_date: '', quota: 0 });
  const [addSeasonSaving, setAddSeasonSaving] = useState(false);
  const [quotaEdit, setQuotaEdit] = useState<{ seasonId: string; value: string } | null>(null);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterIncludeInactive, setFilterIncludeInactive] = useState<'false' | 'true'>('false');

  const hasActiveFilters = filterIncludeInactive === 'true';
  const resetFilters = () => setFilterIncludeInactive('false');
  const filterOpen = embedInProducts && embedFilterOpen !== undefined ? embedFilterOpen : showFilters;
  const filterOnToggle = embedInProducts && embedFilterOnToggle ? embedFilterOnToggle : () => setShowFilters((v) => !v);
  useEffect(() => {
    if (embedInProducts && onFilterActiveChange) onFilterActiveChange(hasActiveFilters);
  }, [embedInProducts, hasActiveFilters, onFilterActiveChange]);

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
    const params = { type: 'bus', with_prices: 'true', include_inactive: filterIncludeInactive, limit: 50, ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
    productsApi.list(params)
      .then((res) => {
        const data = (res.data as { data?: BusProduct[] })?.data;
        setBusProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => setBusProducts([]))
      .finally(() => setLoadingBusProducts(false));
  }, [canAddToOrder, embedInProducts, user?.role, filterIncludeInactive]);

  useEffect(() => {
    fetchBusProducts();
  }, [fetchBusProducts]);

  useEffect(() => {
    if (embedInProducts && refreshTrigger != null && refreshTrigger > 0) fetchBusProducts();
  }, [embedInProducts, refreshTrigger, fetchBusProducts]);

  useEffect(() => {
    if (!busQuotaProduct?.id) return;
    setBusSeasonsLoading(true);
    adminPusatApi.listBusSeasons(busQuotaProduct.id)
      .then((res) => setBusSeasons((res.data as { data?: BusSeason[] })?.data ?? []))
      .catch(() => setBusSeasons([]))
      .finally(() => setBusSeasonsLoading(false));
  }, [busQuotaProduct?.id]);

  const refetchAll = useCallback(() => {
    fetchBusProducts();
  }, [fetchBusProducts]);

  const handleDeleteBus = async (p: BusProduct) => {
    if (!window.confirm(`Hapus produk bus "${p.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await productsApi.delete(p.id);
      showToast('Produk bus dihapus', 'success');
      fetchBusProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menghapus produk bus', 'error');
    }
  };

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

  const statsBus = [
    { label: 'Total Produk', value: busProducts.length, color: 'from-blue-500 to-cyan-500' },
    { label: 'Bus (besar)', value: busProducts.filter((p) => p.meta?.bus_kind !== 'hiace').length, color: 'from-amber-500 to-orange-500' },
    { label: 'Hiace', value: busProducts.filter((p) => p.meta?.bus_kind === 'hiace').length, color: 'from-emerald-500 to-teal-500' }
  ];

  return (
    <div className="space-y-5">
      {!embedInProducts && (
        <PageHeader
          title="Bus Saudi"
          subtitle="Pilih tipe perjalanan (jemput saja / pulang saja / pulang pergi), lalu isi harga per rute dalam IDR, SAR, atau USD. Data tampil di tabel dan dipakai untuk order."
          right={
            <div className="flex items-center gap-2">
              <AutoRefreshControl onRefresh={refetchAll} disabled={loadingBusProducts} />
              <FilterIconButton open={filterOpen} onToggle={filterOnToggle} hasActiveFilters={hasActiveFilters} />
            </div>
          }
        />
      )}

      <PageFilter
        open={filterOpen}
        onToggle={filterOnToggle}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        onApply={() => { refetchAll(); if (embedFilterOnToggle) embedFilterOnToggle(); else setShowFilters(false); }}
        loading={loadingBusProducts}
        applyLabel="Terapkan"
        resetLabel="Reset"
        cardTitle="Pengaturan Filter"
        cardDescription="Tampilkan produk bus aktif saja atau termasuk nonaktif."
        hideToggleRow
        className="w-full"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Autocomplete label="Tampilkan" value={filterIncludeInactive} onChange={(v) => setFilterIncludeInactive(v as 'false' | 'true')} options={[{ value: 'false', label: 'Aktif saja' }, { value: 'true', label: 'Semua (termasuk nonaktif)' }]} />
        </div>
      </PageFilter>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsBus.map((stat, i) => (
          <StatCard key={i} icon={<Bus className="w-5 h-5" />} label={stat.label} value={stat.value} />
        ))}
      </div>

      {/* Daftar produk bus */}
      {(canAddToOrder || embedInProducts) && (
        <Card>
          <CardSectionHeader
            icon={<Bus className="w-6 h-6" />}
            title="Daftar produk bus"
            subtitle="Tambah produk bus atau Hiace; isi harga dan kuota default (per hari). Kuota tampil di tabel dan di Kalender—berkurang otomatis per tanggal jika ada order."
            right={isPusat ? (
              <Button variant="primary" size="sm" onClick={() => setAddBusModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Tambah produk bus
              </Button>
            ) : undefined}
          />
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
                    <th className="text-right py-3 px-4 font-semibold text-slate-700 sticky right-0 z-10 bg-slate-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">Aksi</th>
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
                      <td className="py-2 px-4 text-right sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {canAddToOrder && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="p-2"
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
                              aria-label="Tambah ke order"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          )}
                          {isPusat && (
                            <ActionsMenu
                              align="right"
                              items={[
                                { id: 'periode', label: 'Kuota per periode', icon: <Calendar className="w-4 h-4" />, onClick: () => { setBusQuotaProduct(p); setNewSeasonForm({ name: '', start_date: '', end_date: '', quota: 0 }); setQuotaEdit(null); } },
                                { id: 'edit', label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => {
                                  const raw = p.meta?.route_prices_by_trip as Record<string, unknown> | undefined;
                                  const toNum = (v: unknown): number => {
                                    if (typeof v === 'number' && !Number.isNaN(v)) return v;
                                    if (v && typeof v === 'object' && typeof (v as Record<string, unknown>).full_route === 'number') return Number((v as Record<string, number>).full_route) || 0;
                                    return 0;
                                  };
                                  setEditProductModal({
                                    product: p,
                                    name: p.name,
                                    description: p.description ?? '',
                                    bus_kind: (p.meta?.bus_kind as BusKind) || 'bus',
                                    route_prices_by_trip: { one_way: raw ? toNum(raw.one_way) : 0, return_only: raw ? toNum(raw.return_only) : 0, round_trip: raw ? toNum(raw.round_trip) : 0 },
                                    price_per_vehicle_idr: p.meta?.price_per_vehicle_idr ?? 0,
                                    price_currency: 'IDR',
                                    default_quota: (typeof p.meta?.default_quota === 'number' && p.meta.default_quota >= 0) ? p.meta.default_quota : ''
                                  });
                                } },
                                { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteBus(p), danger: true },
                              ]}
                            />
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
              <Input label="Nama produk *" type="text" value={addBusForm.name} onChange={(e) => setAddBusForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Bus Mekkah–Madinah atau Hiace Madinah" />
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
                <Input label="Kuota" type="number" min={0} value={addBusForm.default_quota === '' ? '' : String(addBusForm.default_quota)} onChange={(e) => setAddBusForm((f) => ({ ...f, default_quota: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) }))} placeholder="Total Kuota Bus Operasi" className="max-w-[140px]" fullWidth={false} />
                <p className="text-xs text-slate-500 mt-1">Jumlah kursi/unit per hari untuk monitoring di Kalender. Kosongkan jika tidak pakai kuota.</p>
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
                          <Input label="IDR" type="number" min={0} value={idr > 0 ? String(idr) : ''} onChange={(e) => setAddBusForm((f) => ({ ...f, price_per_vehicle_idr: Math.max(0, parseFloat(e.target.value) || 0) }))} disabled={cur !== 'IDR'} placeholder="0" />
                          <Input label="SAR" type="number" min={0} step={0.01} value={triple.sar > 0 ? String(triple.sar) : ''} onChange={(e) => setAddBusForm((f) => ({ ...f, price_per_vehicle_idr: fillFromSource('SAR', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr }))} disabled={cur !== 'SAR'} placeholder="0" />
                          <Input label="USD" type="number" min={0} step={0.01} value={triple.usd > 0 ? String(triple.usd) : ''} onChange={(e) => setAddBusForm((f) => ({ ...f, price_per_vehicle_idr: fillFromSource('USD', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr }))} disabled={cur !== 'USD'} placeholder="0" />
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
                          <Input label="IDR" type="number" min={0} value={idr > 0 ? String(idr) : ''} onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))} disabled={cur !== 'IDR'} placeholder="0" />
                          <Input label="SAR" type="number" min={0} step={0.01} value={triple.sar > 0 ? String(triple.sar) : ''} onChange={(e) => setPrice(fillFromSource('SAR', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr)} disabled={cur !== 'SAR'} placeholder="0" />
                          <Input label="USD" type="number" min={0} step={0.01} value={triple.usd > 0 ? String(triple.usd) : ''} onChange={(e) => setPrice(fillFromSource('USD', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr)} disabled={cur !== 'USD'} placeholder="0" />
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
              <Input label="Nama produk *" type="text" value={editProductModal.name} onChange={(e) => setEditProductModal((m) => m ? { ...m, name: e.target.value } : null)} />
              <Textarea label="Deskripsi" value={editProductModal.description} onChange={(e) => setEditProductModal((m) => m ? { ...m, description: e.target.value } : null)} rows={2} />
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
                <Input label="Kuota default (kalender)" type="number" min={0} value={editProductModal.default_quota === '' ? '' : String(editProductModal.default_quota)} onChange={(e) => setEditProductModal((m) => m ? { ...m, default_quota: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) } : null)} placeholder="Opsional" className="max-w-[140px]" fullWidth={false} />
                <p className="text-xs text-slate-500 mt-1">Jumlah kursi/unit per hari untuk monitoring di Kalender. Kosongkan jika tidak pakai kuota.</p>
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
                          <Input label="IDR" type="number" min={0} value={idr > 0 ? String(idr) : ''} onChange={(e) => setEditProductModal((m) => m ? { ...m, price_per_vehicle_idr: Math.max(0, parseFloat(e.target.value) || 0) } : null)} disabled={cur !== 'IDR'} placeholder="0" />
                          <Input label="SAR" type="number" min={0} step={0.01} value={triple.sar > 0 ? String(triple.sar) : ''} onChange={(e) => setEditProductModal((m) => m ? { ...m, price_per_vehicle_idr: fillFromSource('SAR', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr } : null)} disabled={cur !== 'SAR'} placeholder="0" />
                          <Input label="USD" type="number" min={0} step={0.01} value={triple.usd > 0 ? String(triple.usd) : ''} onChange={(e) => setEditProductModal((m) => m ? { ...m, price_per_vehicle_idr: fillFromSource('USD', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr } : null)} disabled={cur !== 'USD'} placeholder="0" />
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
                          <Input label="IDR" type="number" min={0} value={idr > 0 ? String(idr) : ''} onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))} disabled={cur !== 'IDR'} placeholder="0" />
                          <Input label="SAR" type="number" min={0} step={0.01} value={triple.sar > 0 ? String(triple.sar) : ''} onChange={(e) => setPrice(fillFromSource('SAR', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr)} disabled={cur !== 'SAR'} placeholder="0" />
                          <Input label="USD" type="number" min={0} step={0.01} value={triple.usd > 0 ? String(triple.usd) : ''} onChange={(e) => setPrice(fillFromSource('USD', Math.max(0, parseFloat(e.target.value) || 0), currencyRates).idr)} disabled={cur !== 'USD'} placeholder="0" />
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

      {/* Modal: Kuota per periode (Admin Pusat) */}
      {busQuotaProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !addSeasonSaving && !quotaSaving && setBusQuotaProduct(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#0D1A63]" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Kuota per periode</h3>
                  <p className="text-sm text-slate-500">{busQuotaProduct.name}</p>
                </div>
              </div>
              <button type="button" onClick={() => !addSeasonSaving && !quotaSaving && setBusQuotaProduct(null)} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Tambah periode</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Nama periode" type="text" placeholder="Nama periode" value={newSeasonForm.name} onChange={(e) => setNewSeasonForm((f) => ({ ...f, name: e.target.value }))} />
                  <Input label="Mulai" type="date" value={newSeasonForm.start_date} onChange={(e) => setNewSeasonForm((f) => ({ ...f, start_date: e.target.value }))} />
                  <Input label="Selesai" type="date" value={newSeasonForm.end_date} onChange={(e) => setNewSeasonForm((f) => ({ ...f, end_date: e.target.value }))} />
                  <Input label="Kuota" type="number" min={0} placeholder="Kuota" value={newSeasonForm.quota ? String(newSeasonForm.quota) : ''} onChange={(e) => setNewSeasonForm((f) => ({ ...f, quota: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
                </div>
                <Button size="sm" className="mt-3" disabled={addSeasonSaving || !newSeasonForm.name.trim() || !newSeasonForm.start_date || !newSeasonForm.end_date} onClick={async () => {
                  if (!busQuotaProduct?.id) return;
                  setAddSeasonSaving(true);
                  try {
                    await adminPusatApi.createBusSeason(busQuotaProduct.id, { name: newSeasonForm.name.trim(), start_date: newSeasonForm.start_date, end_date: newSeasonForm.end_date, quota: newSeasonForm.quota });
                    showToast('Periode ditambahkan', 'success');
                    setNewSeasonForm({ name: '', start_date: '', end_date: '', quota: 0 });
                    const res = await adminPusatApi.listBusSeasons(busQuotaProduct.id);
                    setBusSeasons((res.data as { data?: BusSeason[] })?.data ?? []);
                  } catch (e: unknown) {
                    const err = e as { response?: { data?: { message?: string } } };
                    showToast(err.response?.data?.message || 'Gagal menambah periode', 'error');
                  } finally { setAddSeasonSaving(false); }
                }}>
                  {addSeasonSaving ? 'Menyimpan...' : 'Tambah periode'}
                </Button>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Daftar periode</h4>
                {busSeasonsLoading ? (
                  <p className="text-sm text-slate-500">Memuat...</p>
                ) : busSeasons.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada periode. Tambah periode di atas untuk mengatur kuota bus per periode.</p>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold text-slate-600">Nama</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-600">Mulai</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-600">Selesai</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600">Kuota</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600 sticky right-0 z-10 bg-slate-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {busSeasons.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 px-3 font-medium text-slate-800">{s.name}</td>
                            <td className="py-2 px-3 text-slate-600">{s.start_date}</td>
                            <td className="py-2 px-3 text-slate-600">{s.end_date}</td>
                            <td className="py-2 px-3 text-right">
                              {quotaEdit?.seasonId === s.id ? (
                                <span className="flex items-center justify-end gap-1">
                                  <Input type="number" min={0} value={quotaEdit.value} onChange={(e) => setQuotaEdit((q) => q ? { ...q, value: e.target.value } : null)} className="w-20" fullWidth={false} />
                                  <Button size="sm" variant="primary" disabled={quotaSaving} onClick={async () => {
                                    if (!busQuotaProduct?.id || !quotaEdit) return;
                                    setQuotaSaving(true);
                                    try {
                                      await adminPusatApi.setBusSeasonQuota(busQuotaProduct.id, s.id, { quota: Math.max(0, parseInt(quotaEdit.value, 10) || 0) });
                                      showToast('Kuota disimpan', 'success');
                                      setQuotaEdit(null);
                                      const res = await adminPusatApi.listBusSeasons(busQuotaProduct.id);
                                      setBusSeasons((res.data as { data?: BusSeason[] })?.data ?? []);
                                    } catch (e: unknown) {
                                      const err = e as { response?: { data?: { message?: string } } };
                                      showToast(err.response?.data?.message || 'Gagal', 'error');
                                    } finally { setQuotaSaving(false); }
                                  }}>Simpan</Button>
                                </span>
                              ) : (
                                <span className="tabular-nums">{s.Quota?.quota ?? 0}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                              {quotaEdit?.seasonId === s.id ? (
                                <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setQuotaEdit(null)}>Batal</button>
                              ) : (
                                <>
                                  <button type="button" className="text-primary-600 hover:underline text-xs mr-2" onClick={() => setQuotaEdit({ seasonId: s.id, value: String(s.Quota?.quota ?? 0) })}>Set kuota</button>
                                  <button type="button" className="text-red-600 hover:underline text-xs" onClick={async () => {
                                    if (!busQuotaProduct?.id || !window.confirm('Hapus periode ini?')) return;
                                    try {
                                      await adminPusatApi.deleteBusSeason(busQuotaProduct.id, s.id);
                                      showToast('Periode dihapus', 'success');
                                      setBusSeasons((prev) => prev.filter((x) => x.id !== s.id));
                                    } catch (e: unknown) {
                                      const err = e as { response?: { data?: { message?: string } } };
                                      showToast(err.response?.data?.message || 'Gagal menghapus', 'error');
                                    }
                                  }}>Hapus</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">Tiket bus dan status kedatangan/keberangkatan dikelola di Invoice oleh role Bus.</p>
    </div>
  );
};

export default BusPage;
