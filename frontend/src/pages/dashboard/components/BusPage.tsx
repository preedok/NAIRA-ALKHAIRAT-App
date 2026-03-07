import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bus, Pencil, X, Plus, ArrowRight, ArrowLeft, ArrowLeftRight, ShoppingCart, Calendar, Trash2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl } from '../../../components/common';
import { StatCard, CardSectionHeader, Input, PriceCurrencyField, Autocomplete, Textarea, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ContentLoading } from '../../../components/common';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, businessRulesApi, adminPusatApi, type BusSeason } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import Table from '../../../components/common/Table';
import { getPriceTripleForTable, PRICE_COLUMN_LABEL, formatIDR } from '../../../utils';
import BusWorkPage from './BusWorkPage';

const PAGE_SIZE = 25;

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
    trip_type?: BusTripType;
    route_prices_by_trip?: Partial<RoutePricesByTrip>;
    price_per_vehicle_idr?: number;
    default_quota?: number;
    price_currency?: 'IDR' | 'SAR' | 'USD';
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
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const canShowProductActions = ['owner', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'role_accounting', 'super_admin'].includes(user?.role || '');
  const [busProducts, setBusProducts] = useState<BusProduct[]>([]);
  const [loadingBusProducts, setLoadingBusProducts] = useState(false);

  const canConfig = user?.role === 'super_admin' || user?.role === 'admin_pusat' || user?.role === 'role_accounting';
  const isPusat = user?.role === 'super_admin' || user?.role === 'admin_pusat' || user?.role === 'role_accounting';

  type PriceCurrency = 'IDR' | 'SAR' | 'USD';

  const [editProductModal, setEditProductModal] = useState<{
    product: BusProduct;
    name: string;
    description: string;
    bus_kind: BusKind;
    product_trip_type: BusTripType;
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
    product_trip_type: 'round_trip' as BusTripType,
    route_prices_by_trip: emptyPricesByTrip(),
    price_per_vehicle_idr: 0,
    price_currency: 'IDR' as PriceCurrency,
    default_quota: '' as number | ''
  });
  const [addBusSaving, setAddBusSaving] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({ SAR_TO_IDR: 4200, USD_TO_IDR: 15500 });
  const [busPenaltyRule, setBusPenaltyRule] = useState<{ bus_min_pack: number; bus_penalty_idr: number }>({ bus_min_pack: 35, bus_penalty_idr: 500000 });
  const [busPage, setBusPage] = useState(1);
  const [busLimit, setBusLimit] = useState(PAGE_SIZE);
  const [busTotal, setBusTotal] = useState(0);
  const [busTotalPages, setBusTotalPages] = useState(1);
  const [busQuotaProduct, setBusQuotaProduct] = useState<BusProduct | null>(null);
  const [busSeasons, setBusSeasons] = useState<BusSeason[]>([]);
  const [busSeasonsLoading, setBusSeasonsLoading] = useState(false);
  const [newSeasonForm, setNewSeasonForm] = useState({ name: '', start_date: '', end_date: '', quota: 0 });
  const [addSeasonSaving, setAddSeasonSaving] = useState(false);
  const [quotaEdit, setQuotaEdit] = useState<{ seasonId: string; value: string } | null>(null);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [filterIncludeInactive, setFilterIncludeInactive] = useState<'false' | 'true'>('false');
  const [searchName, setSearchName] = useState('');
  const [debouncedSearchName, setDebouncedSearchName] = useState('');
  const lastFilterKeyRef = useRef<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchName(searchName), 350);
    return () => clearTimeout(t);
  }, [searchName]);

  useEffect(() => {
    businessRulesApi.get().then((res) => {
      const data = (res.data as { data?: Record<string, unknown> })?.data;
      let cr = data?.currency_rates;
      if (typeof cr === 'string') try { cr = JSON.parse(cr) as { SAR_TO_IDR?: number; USD_TO_IDR?: number }; } catch { cr = null; }
      const rates = cr as { SAR_TO_IDR?: number; USD_TO_IDR?: number } | null;
      if (rates && typeof rates === 'object') setCurrencyRates({ SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 });
      const minPack = typeof data?.bus_min_pack === 'number' ? data.bus_min_pack : parseInt(String(data?.bus_min_pack), 10) || 35;
      const penaltyIdr = typeof data?.bus_penalty_idr === 'number' ? data.bus_penalty_idr : parseFloat(String(data?.bus_penalty_idr)) || 500000;
      setBusPenaltyRule({ bus_min_pack: minPack, bus_penalty_idr: penaltyIdr });
    }).catch(() => {});
  }, []);

  const fetchBusProducts = useCallback(() => {
    if (!canAddToOrder && !embedInProducts) return;
    const filterKey = `${debouncedSearchName}|${filterIncludeInactive}`;
    let pageToUse = busPage;
    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      setBusPage(1);
      pageToUse = 1;
    }
    setLoadingBusProducts(true);
    const params = { type: 'bus', with_prices: 'true', include_inactive: filterIncludeInactive, limit: busLimit, page: pageToUse, ...(debouncedSearchName.trim() ? { name: debouncedSearchName.trim() } : {}), ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
    productsApi.list(params)
      .then((res) => {
        const body = res.data as { data?: BusProduct[]; pagination?: { total: number; page: number; limit: number; totalPages: number } };
        setBusProducts(Array.isArray(body.data) ? body.data : []);
        const p = body.pagination;
        if (p) {
          setBusTotal(p.total);
          setBusPage(p.page);
          setBusLimit(p.limit);
          setBusTotalPages(p.totalPages || 1);
        }
      })
      .catch(() => setBusProducts([]))
      .finally(() => setLoadingBusProducts(false));
  }, [canAddToOrder, embedInProducts, user?.role, filterIncludeInactive, busLimit, busPage, debouncedSearchName]);

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
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      const msg = err.response?.data?.message || 'Gagal menghapus produk bus';
      showToast(msg, 'error');
      if (err.response?.status === 400 && msg.includes('masih digunakan') && window.confirm(`${msg}\n\nNonaktifkan produk bus "${p.name}" saja? (Tidak akan ditampilkan di daftar.)`)) {
        try {
          await productsApi.update(p.id, { is_active: false });
          showToast('Produk bus dinonaktifkan', 'success');
          fetchBusProducts();
        } catch (e2: unknown) {
          const e2err = e2 as { response?: { data?: { message?: string } } };
          showToast(e2err.response?.data?.message || 'Gagal menonaktifkan produk bus', 'error');
        }
      }
    }
  };

  const saveEditProduct = async () => {
    if (!editProductModal) return;
    if (!editProductModal.name.trim()) { showToast('Nama produk wajib', 'error'); return; }
    setEditProductSaving(true);
    try {
      const busMeta = editProductModal.bus_kind === 'bus'
        ? {
            trip_type: editProductModal.product_trip_type,
            route_prices_by_trip: {
              one_way: 0,
              return_only: 0,
              round_trip: 0,
              [editProductModal.product_trip_type]: editProductModal.route_prices_by_trip[editProductModal.product_trip_type] ?? 0
            } as RoutePricesByTrip
          }
        : { trip_type: editProductModal.product_trip_type };
      await productsApi.update(editProductModal.product.id, {
        name: editProductModal.name.trim(),
        description: editProductModal.description.trim() || null,
        meta: {
          bus_kind: editProductModal.bus_kind,
          ...busMeta,
          price_per_vehicle_idr: editProductModal.bus_kind === 'hiace' ? editProductModal.price_per_vehicle_idr : undefined,
          default_quota: editProductModal.default_quota !== '' && editProductModal.default_quota !== undefined ? Number(editProductModal.default_quota) : null,
          price_currency: editProductModal.price_currency
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
      const payload: { name: string; description?: string; bus_kind: BusKind; trip_type?: BusTripType; price_currency?: PriceCurrency; route_prices_by_trip?: RoutePricesByTrip; price_per_vehicle_idr?: number; default_quota?: number | null } = {
        name: addBusForm.name.trim(),
        description: addBusForm.description.trim() || undefined,
        bus_kind: addBusForm.bus_kind,
        price_currency: addBusForm.price_currency
      };
      if (addBusForm.bus_kind === 'bus') {
        payload.trip_type = addBusForm.product_trip_type;
        const singlePrice = addBusForm.route_prices_by_trip[addBusForm.product_trip_type] ?? 0;
        payload.route_prices_by_trip = { one_way: 0, return_only: 0, round_trip: 0, [addBusForm.product_trip_type]: singlePrice };
      } else {
        payload.trip_type = addBusForm.product_trip_type;
        payload.price_per_vehicle_idr = Math.max(0, addBusForm.price_per_vehicle_idr || 0);
      }
      const q = addBusForm.default_quota === '' ? undefined : Math.max(0, parseInt(String(addBusForm.default_quota), 10) || 0);
      if (q !== undefined) payload.default_quota = q;
      await productsApi.createBus(payload);
      showToast('Produk bus ditambahkan', 'success');
      setAddBusModalOpen(false);
      setAddBusForm({ name: '', description: '', bus_kind: 'bus', product_trip_type: 'round_trip', route_prices_by_trip: emptyPricesByTrip(), price_per_vehicle_idr: 0, price_currency: 'IDR', default_quota: '' });
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
            <AutoRefreshControl onRefresh={refetchAll} disabled={loadingBusProducts} />
          }
        />
      )}

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
          <div className="pb-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)] gap-4 items-end">
            <Input label="Cari nama" type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Nama produk bus..." fullWidth />
            <Autocomplete label="Tampilkan" value={filterIncludeInactive} onChange={(v) => setFilterIncludeInactive(v as 'false' | 'true')} options={[{ value: 'false', label: 'Aktif saja' }, { value: 'true', label: 'Semua (termasuk nonaktif)' }]} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[120px]">
            {loadingBusProducts ? (
              <ContentLoading />
            ) : (
            <Table<BusProduct>
              columns={[
                { id: 'code', label: 'Kode', align: 'left' },
                { id: 'name', label: 'Nama', align: 'left' },
                { id: 'kind', label: 'Jenis', align: 'left' },
                { id: 'currency', label: 'Mata Uang', align: 'center' },
                { id: 'price', label: PRICE_COLUMN_LABEL, align: 'left' },
                { id: 'price_vehicle', label: 'Harga / mobil (IDR · SAR · USD)', align: 'left' },
                { id: 'quota', label: 'Kuota', align: 'left' },
                ...(canShowProductActions ? [{ id: 'actions', label: 'Aksi', align: 'right' as const }] : [])
              ]}
              data={busProducts}
              renderRow={(p) => {
                    const isHiace = p.meta?.bus_kind === 'hiace';
                    return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2 px-4 font-mono text-slate-600">{p.code || '-'}</td>
                      <td className="py-2 px-4 font-medium text-slate-900">
                        {p.name}
                        {p.meta?.trip_type && (
                          <span className="ml-1.5 text-xs font-normal text-slate-500">({BUS_TRIP_LABELS[p.meta.trip_type as BusTripType]})</span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${isHiace ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isHiace ? 'Hiace' : 'Bus'}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-center text-sm text-slate-700">{(p.meta?.price_currency as string) || p.currency || 'IDR'}</td>
                      <td className="py-2 px-4 align-top">
                        {isHiace ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          (() => {
                            const productTripType = (p.meta?.trip_type as BusTripType) || 'round_trip';
                            const priceIdr = getPriceForTrip(p, productTripType);
                            const triple = fillFromSource('IDR', priceIdr, currencyRates);
                            const t = getPriceTripleForTable(priceIdr, triple.sar, triple.usd);
                            if (!t.hasPrice) return <span className="text-slate-400">—</span>;
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-slate-700 font-medium tabular-nums">{t.idrText}</span>
                                <span className="text-xs text-slate-500"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</span>
                                <span className="text-xs text-slate-400">per orang</span>
                                <span className="text-xs text-amber-700 mt-0.5">Penalti: {formatIDR(busPenaltyRule.bus_penalty_idr)}/pack yang kurang (min {busPenaltyRule.bus_min_pack} pack)</span>
                              </div>
                            );
                          })()
                        )}
                      </td>
                      <td className="py-2 px-4 align-top">
                        {isHiace ? (
                          (() => {
                            const idr = p.meta?.price_per_vehicle_idr ?? 0;
                            const triple = fillFromSource('IDR', idr, currencyRates);
                            const t = getPriceTripleForTable(idr, triple.sar, triple.usd);
                            if (!t.hasPrice) return <span className="text-slate-400">—</span>;
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-slate-700 font-medium tabular-nums">{t.idrText}</span>
                                <span className="text-xs text-slate-500"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</span>
                                <span className="text-xs text-slate-400">per mobil</span>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-slate-700 tabular-nums">{typeof p.meta?.default_quota === 'number' && p.meta.default_quota >= 0 ? p.meta.default_quota : '—'}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">per hari (kalender)</p>
                      </td>
                      {canShowProductActions && (
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
                                  : getPriceForTrip(p, (p.meta?.trip_type as BusTripType) || 'round_trip');
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
                                  const rpt = { one_way: raw ? toNum(raw.one_way) : 0, return_only: raw ? toNum(raw.return_only) : 0, round_trip: raw ? toNum(raw.round_trip) : 0 };
                                  const inferredTripType: BusTripType = (p.meta?.trip_type as BusTripType) || (rpt.round_trip > 0 ? 'round_trip' : rpt.one_way > 0 ? 'one_way' : rpt.return_only > 0 ? 'return_only' : 'round_trip');
                                  const savedCurrency = (p.meta?.price_currency as PriceCurrency);
                                  const editPriceCurrency: PriceCurrency = (savedCurrency === 'SAR' || savedCurrency === 'USD' || savedCurrency === 'IDR') ? savedCurrency : 'IDR';
                                  setEditProductModal({
                                    product: p,
                                    name: p.name,
                                    description: p.description ?? '',
                                    bus_kind: (p.meta?.bus_kind as BusKind) || 'bus',
                                    product_trip_type: inferredTripType,
                                    route_prices_by_trip: rpt,
                                    price_per_vehicle_idr: p.meta?.price_per_vehicle_idr ?? 0,
                                    price_currency: editPriceCurrency,
                                    default_quota: (typeof p.meta?.default_quota === 'number' && p.meta.default_quota >= 0) ? p.meta.default_quota : ''
                                  });
                                } },
                                { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteBus(p), danger: true },
                              ]}
                            />
                          )}
                        </div>
                      </td>
                      )}
                    </tr>
                  );
              }}
              emptyMessage="Belum ada produk bus."
              emptyDescription={!isPusat ? 'Admin pusat dapat menambah produk bus.' : undefined}
              pagination={{
                total: busTotal,
                page: busPage,
                limit: busLimit,
                totalPages: busTotalPages,
                onPageChange: setBusPage,
                onLimitChange: (l) => { setBusLimit(l); setBusPage(1); }
              }}
              stickyActionsColumn
            />
            )}
            </div>
        </Card>
      )}

      {/* Modal Tambah produk bus — hanya form produk */}
      {addBusModalOpen && (
        <Modal open onClose={() => !addBusSaving && setAddBusModalOpen(false)}>
          <ModalBox>
            <ModalHeader title="Tambah produk bus" subtitle="Nama produk, deskripsi, dan harga (opsional)" icon={<Plus className="w-5 h-5" />} onClose={() => !addBusSaving && setAddBusModalOpen(false)} />
            <ModalBody className="flex-1 overflow-y-auto space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Info produk</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <Input label="Nama produk *" type="text" value={addBusForm.name} onChange={(e) => setAddBusForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Bus Mekkah–Madinah atau Hiace Madinah" fullWidth />
                  <Textarea label="Deskripsi (opsional)" value={addBusForm.description} onChange={(e) => setAddBusForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Deskripsi singkat" fullWidth />
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Jenis</h3>
                <p className="text-xs text-slate-500">Pilih jenis kendaraan: Bus (besar, min 35 orang) atau Hiace (harga per mobil).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['bus', 'hiace'] as const).map((k) => (
                    <Button
                      key={k}
                      type="button"
                      variant={addBusForm.bus_kind === k ? 'primary' : 'outline'}
                      size="sm"
                      className="w-full justify-center py-4 flex flex-col gap-1"
                      onClick={() => setAddBusForm((f) => ({ ...f, bus_kind: k }))}
                    >
                      <span className="font-medium">{k === 'bus' ? 'Bus' : 'Hiace'}</span>
                      <span className="text-xs opacity-90 font-normal">{BUS_KIND_LABELS[k]}</span>
                    </Button>
                  ))}
                </div>
              </section>
              <section className="space-y-2">
                <Input label="Kuota (opsional)" type="number" min={0} value={addBusForm.default_quota === '' ? '' : String(addBusForm.default_quota)} onChange={(e) => setAddBusForm((f) => ({ ...f, default_quota: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) }))} placeholder="Total Kuota Bus Operasi" fullWidth />
                <p className="text-xs text-slate-500">Jumlah kursi/unit per hari untuk monitoring di Kalender. Kosongkan jika tidak pakai kuota.</p>
              </section>
              {addBusForm.bus_kind === 'hiace' && (
                <section className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">Tipe perjalanan produk</h3>
                  <p className="text-xs text-slate-500">Satu produk = satu tipe. Pilih produk ini untuk perjalanan apa (jemput saja / pulang saja / pulang pergi). Nanti di order, pilih produk yang sesuai tipe perjalanan.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['one_way', 'return_only', 'round_trip'] as const).map((tripType) => (
                      <Button
                        key={tripType}
                        type="button"
                        variant={addBusForm.product_trip_type === tripType ? 'primary' : 'outline'}
                        size="sm"
                        className="w-full justify-center py-3"
                        onClick={() => setAddBusForm((f) => ({ ...f, product_trip_type: tripType }))}
                      >
                        {BUS_TRIP_LABELS[tripType]}
                      </Button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <PriceCurrencyField
                      label={`Harga per mobil – ${BUS_TRIP_LABELS[addBusForm.product_trip_type]}`}
                      value={(() => {
                        const idr = addBusForm.price_per_vehicle_idr ?? 0;
                        const t = fillFromSource('IDR', idr, currencyRates);
                        return addBusForm.price_currency === 'IDR' ? t.idr : addBusForm.price_currency === 'SAR' ? t.sar : t.usd;
                      })()}
                      currency={addBusForm.price_currency}
                      onChange={(val, cur) => setAddBusForm((f) => ({
                        ...f,
                        price_currency: cur,
                        price_per_vehicle_idr: Math.round(fillFromSource(cur, val, currencyRates).idr) || 0
                      }))}
                      rates={currencyRates}
                      showConversions
                    />
                  </div>
                </section>
              )}
              {addBusForm.bus_kind === 'bus' && (
                <section className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">Tipe perjalanan produk</h3>
                  <p className="text-xs text-slate-500">Satu produk = satu tipe. Pilih produk ini untuk perjalanan apa (jemput saja / pulang saja / pulang pergi). Nanti di order, pilih produk yang sesuai tipe perjalanan.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['one_way', 'return_only', 'round_trip'] as const).map((tripType) => (
                      <Button
                        key={tripType}
                        type="button"
                        variant={addBusForm.product_trip_type === tripType ? 'primary' : 'outline'}
                        size="sm"
                        className="w-full justify-center py-3"
                        onClick={() => setAddBusForm((f) => ({ ...f, product_trip_type: tripType }))}
                      >
                        {BUS_TRIP_LABELS[tripType]}
                      </Button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <PriceCurrencyField
                      label={`Harga – ${BUS_TRIP_LABELS[addBusForm.product_trip_type]}`}
                      value={(() => {
                        const idr = addBusForm.route_prices_by_trip[addBusForm.product_trip_type] ?? 0;
                        const t = fillFromSource('IDR', idr, currencyRates);
                        return addBusForm.price_currency === 'IDR' ? t.idr : addBusForm.price_currency === 'SAR' ? t.sar : t.usd;
                      })()}
                      currency={addBusForm.price_currency}
                      onChange={(val, cur) => setAddBusForm((f) => ({
                        ...f,
                        price_currency: cur,
                        route_prices_by_trip: { ...f.route_prices_by_trip, [f.product_trip_type]: Math.round(fillFromSource(cur, val, currencyRates).idr) || 0 }
                      }))}
                      rates={currencyRates}
                      showConversions
                    />
                  </div>
                </section>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setAddBusModalOpen(false)} disabled={addBusSaving}>Batal</Button>
              <Button variant="primary" onClick={handleCreateBus} disabled={addBusSaving || !addBusForm.name.trim()}>
                {addBusSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {/* Modal Edit produk bus — struktur sama dengan modal Tambah */}
      {editProductModal && (
        <Modal open onClose={() => !editProductSaving && setEditProductModal(null)}>
          <ModalBox>
            <ModalHeader title="Edit produk bus" subtitle="Ubah nama, deskripsi, dan harga produk" icon={<Pencil className="w-5 h-5" />} onClose={() => !editProductSaving && setEditProductModal(null)} />
            <ModalBody className="flex-1 overflow-y-auto space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Info produk</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <Input label="Nama produk *" type="text" value={editProductModal.name} onChange={(e) => setEditProductModal((m) => m ? { ...m, name: e.target.value } : null)} fullWidth />
                  <Textarea label="Deskripsi (opsional)" value={editProductModal.description} onChange={(e) => setEditProductModal((m) => m ? { ...m, description: e.target.value } : null)} rows={2} placeholder="Deskripsi singkat" fullWidth />
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Jenis</h3>
                <p className="text-xs text-slate-500">Pilih jenis kendaraan: Bus (besar, min 35 orang) atau Hiace (harga per mobil).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['bus', 'hiace'] as const).map((k) => (
                    <Button
                      key={k}
                      type="button"
                      variant={editProductModal.bus_kind === k ? 'primary' : 'outline'}
                      size="sm"
                      className="w-full justify-center py-4 flex flex-col gap-1"
                      onClick={() => setEditProductModal((m) => m ? { ...m, bus_kind: k } : null)}
                    >
                      <span className="font-medium">{k === 'bus' ? 'Bus' : 'Hiace'}</span>
                      <span className="text-xs opacity-90 font-normal">{BUS_KIND_LABELS[k]}</span>
                    </Button>
                  ))}
                </div>
              </section>
              <section className="space-y-2">
                <Input label="Kuota (opsional)" type="number" min={0} value={editProductModal.default_quota === '' ? '' : String(editProductModal.default_quota)} onChange={(e) => setEditProductModal((m) => m ? { ...m, default_quota: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) } : null)} placeholder="Total Kuota Bus Operasi" fullWidth />
                <p className="text-xs text-slate-500">Jumlah kursi/unit per hari untuk monitoring di Kalender. Kosongkan jika tidak pakai kuota.</p>
              </section>
              {editProductModal.bus_kind === 'hiace' && (
                <section className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">Tipe perjalanan produk</h3>
                  <p className="text-xs text-slate-500">Satu produk = satu tipe. Pilih produk ini untuk perjalanan apa (jemput saja / pulang saja / pulang pergi). Nanti di order, pilih produk yang sesuai tipe perjalanan.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['one_way', 'return_only', 'round_trip'] as const).map((tripType) => (
                      <Button
                        key={tripType}
                        type="button"
                        variant={editProductModal.product_trip_type === tripType ? 'primary' : 'outline'}
                        size="sm"
                        className="w-full justify-center py-3"
                        onClick={() => setEditProductModal((m) => m ? { ...m, product_trip_type: tripType } : null)}
                      >
                        {BUS_TRIP_LABELS[tripType]}
                      </Button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <PriceCurrencyField
                      label={`Harga per mobil – ${BUS_TRIP_LABELS[editProductModal.product_trip_type]}`}
                      value={(() => {
                        const idr = editProductModal.price_per_vehicle_idr ?? 0;
                        const t = fillFromSource('IDR', idr, currencyRates);
                        return editProductModal.price_currency === 'IDR' ? t.idr : editProductModal.price_currency === 'SAR' ? t.sar : t.usd;
                      })()}
                      currency={editProductModal.price_currency}
                      onChange={(val, cur) => setEditProductModal((m) => m ? {
                        ...m,
                        price_currency: cur,
                        price_per_vehicle_idr: Math.round(fillFromSource(cur, val, currencyRates).idr) || 0
                      } : null)}
                      rates={currencyRates}
                      showConversions
                    />
                  </div>
                </section>
              )}
              {editProductModal.bus_kind === 'bus' && (
                <section className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">Tipe perjalanan produk</h3>
                  <p className="text-xs text-slate-500">Satu produk = satu tipe. Pilih produk ini untuk perjalanan apa (jemput saja / pulang saja / pulang pergi). Nanti di order, pilih produk yang sesuai tipe perjalanan.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['one_way', 'return_only', 'round_trip'] as const).map((tripType) => (
                      <Button
                        key={tripType}
                        type="button"
                        variant={editProductModal.product_trip_type === tripType ? 'primary' : 'outline'}
                        size="sm"
                        className="w-full justify-center py-3"
                        onClick={() => setEditProductModal((m) => m ? { ...m, product_trip_type: tripType } : null)}
                      >
                        {BUS_TRIP_LABELS[tripType]}
                      </Button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <PriceCurrencyField
                      label={`Harga – ${BUS_TRIP_LABELS[editProductModal.product_trip_type]}`}
                      value={(() => {
                        const idr = editProductModal.route_prices_by_trip[editProductModal.product_trip_type] ?? 0;
                        const t = fillFromSource('IDR', idr, currencyRates);
                        return editProductModal.price_currency === 'IDR' ? t.idr : editProductModal.price_currency === 'SAR' ? t.sar : t.usd;
                      })()}
                      currency={editProductModal.price_currency}
                      onChange={(val, cur) => setEditProductModal((m) => m ? {
                        ...m,
                        price_currency: cur,
                        route_prices_by_trip: { ...m.route_prices_by_trip, [m.product_trip_type]: Math.round(fillFromSource(cur, val, currencyRates).idr) || 0 }
                      } : null)}
                      rates={currencyRates}
                      showConversions
                    />
                  </div>
                </section>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditProductModal(null)} disabled={editProductSaving}>Batal</Button>
              <Button variant="primary" onClick={saveEditProduct} disabled={editProductSaving}>{editProductSaving ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {/* Modal: Kuota per periode (Admin Pusat) */}
      {busQuotaProduct && (
        <Modal open onClose={() => !addSeasonSaving && !quotaSaving && setBusQuotaProduct(null)}>
          <ModalBox>
            <ModalHeader title="Kuota per periode" subtitle={busQuotaProduct.name} icon={<Calendar className="w-5 h-5" />} onClose={() => !addSeasonSaving && !quotaSaving && setBusQuotaProduct(null)} />
            <ModalBody className="flex-1 overflow-y-auto space-y-4">
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
                  <ContentLoading inline />
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
            </ModalBody>
          </ModalBox>
        </Modal>
      )}

      <p className="text-xs text-slate-500">Tiket bus dan status kedatangan/keberangkatan dikelola di Invoice oleh role Bus.</p>
    </div>
  );
};

export default BusPage;
