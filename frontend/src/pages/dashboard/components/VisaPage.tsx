import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, FileText, Pencil, X, Package, Coins, Settings2, Layers, Hotel, Trash2, Eye } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import { StatCard, CardSectionHeader, Input, PriceCurrencyField, Textarea, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ContentLoading } from '../../../components/common';
import Badge from '../../../components/common/Badge';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { businessRulesApi, productsApi } from '../../../services/api';
import { fillFromSource, getEditPriceDisplay } from '../../../utils/currencyConversion';
import Table from '../../../components/common/Table';
import { getPriceTripleForTable, PRICE_COLUMN_LABEL } from '../../../utils';
import { getProductListOwnerId } from '../../../utils/productHelpers';
import VisaWorkPage from './VisaWorkPage';

const PAGE_SIZE = 25;

export const VISA_KIND_LABELS: Record<string, string> = {
  only: 'Visa Only',
  tasreh: 'Visa + Tasreh',
  premium: 'Visa Premium'
};

/** Deskripsi singkat per jenis visa untuk panduan admin */
export const VISA_KIND_DESCRIPTIONS: Record<string, string> = {
  only: 'Visa umroh standar tanpa layanan tambahan.',
  tasreh: 'Visa umroh dengan layanan tasreh (pembukaan visa di Saudi).',
  premium: 'Visa umroh premium dengan fasilitas prioritas dan layanan lengkap.'
};

export type VisaKind = 'only' | 'tasreh' | 'premium';

interface VisaProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  meta?: { visa_kind?: VisaKind; require_hotel?: boolean; currency?: string } | null;
  price_general_idr?: number | null;
  price_general_sar?: number | null;
  price_general_usd?: number | null;
  price_general?: number | null;
  price_branch?: number | null;
  currency?: string;
}

/** Hotel product ringkas untuk modal pilih hotel (visa wajib hotel) */
interface HotelOptionForVisa {
  id: string;
  name: string;
  code?: string;
  currency?: string;
  meta?: { location?: string; meal_price?: number; currency?: string; meal_plan?: string } | null;
  price_branch?: number | null;
  price_general?: number | null;
  room_breakdown?: Record<string, { quantity?: number; price?: number }>;
  prices_by_room?: Record<string, { quantity?: number; price?: number }>;
}

const LOCATION_LABELS: Record<string, string> = { makkah: 'Mekkah', madinah: 'Madinah' };

type VisaPageProps = {
  embedInProducts?: boolean;
  refreshTrigger?: number;
  embedFilterOpen?: boolean;
  embedFilterOnToggle?: () => void;
  onFilterActiveChange?: (active: boolean) => void;
};

const VisaPage: React.FC<VisaPageProps> = ({
  embedInProducts,
  refreshTrigger,
  embedFilterOpen,
  embedFilterOnToggle,
  onFilterActiveChange
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});

  const isPusat = user?.role === 'super_admin' || user?.role === 'admin_pusat' || user?.role === 'role_accounting';
  const canAddToOrder = user?.role === 'owner_mou' || user?.role === 'owner_non_mou' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  /** Kolom Aksi hanya untuk owner, invoice, admin pusat, accounting */
  const canShowProductActions = ['owner_mou', 'owner_non_mou', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'role_accounting', 'super_admin'].includes(user?.role || '');
  const [visaProducts, setVisaProducts] = useState<VisaProduct[]>([]);
  const [loadingVisaProducts, setLoadingVisaProducts] = useState(false);
  const [visaPage, setVisaPage] = useState(1);
  const [visaLimit, setVisaLimit] = useState(PAGE_SIZE);
  const [visaTotal, setVisaTotal] = useState(0);
  const [visaTotalPages, setVisaTotalPages] = useState(1);
  const [showAddVisaModal, setShowAddVisaModal] = useState(false);
  const [addVisaForm, setAddVisaForm] = useState({
    name: '',
    description: '',
    visa_kind: 'only' as VisaKind,
    require_hotel: false,
    price_value: 0,
    price_currency: 'IDR' as 'IDR' | 'SAR' | 'USD'
  });
  const [addVisaSaving, setAddVisaSaving] = useState(false);
  const [editingVisa, setEditingVisa] = useState<VisaProduct | null>(null);
  const [editVisaForm, setEditVisaForm] = useState({
    name: '',
    description: '',
    visa_kind: 'only' as VisaKind,
    require_hotel: false,
    price_value: 0,
    price_currency: 'IDR' as 'IDR' | 'SAR' | 'USD'
  });
  const [editVisaSaving, setEditVisaSaving] = useState(false);
  const [filterIncludeInactive, setFilterIncludeInactive] = useState<'false' | 'true'>('false');
  const [searchName, setSearchName] = useState('');
  const [debouncedSearchName, setDebouncedSearchName] = useState('');
  const lastFilterKeyRef = useRef<string>('');
  const tableSectionRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { addItem: addDraftItem } = useOrderDraft();
  /** Modal: visa wajib hotel — user harus pilih hotel dulu baru lanjut ke form */
  const [visaRequireHotelVisa, setVisaRequireHotelVisa] = useState<VisaProduct | null>(null);
  const [hotelListForVisa, setHotelListForVisa] = useState<HotelOptionForVisa[]>([]);
  const [loadingHotelsForVisa, setLoadingHotelsForVisa] = useState(false);
  const [selectedHotelIdForVisa, setSelectedHotelIdForVisa] = useState<string | null>(null);
  const [visaHotelTab, setVisaHotelTab] = useState<'makkah' | 'madinah'>('makkah');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchName(searchName), 350);
    return () => clearTimeout(t);
  }, [searchName]);

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

  const fetchVisaProducts = useCallback(() => {
    if (!canAddToOrder && !embedInProducts) return;
    const filterKey = `${debouncedSearchName}|${filterIncludeInactive}`;
    let pageToUse = visaPage;
    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      setVisaPage(1);
      pageToUse = 1;
    }
    setLoadingVisaProducts(true);
    const ownerId = getProductListOwnerId(user);
    const params = { type: 'visa', with_prices: 'true', include_inactive: filterIncludeInactive, limit: visaLimit, page: pageToUse, ...(debouncedSearchName.trim() ? { name: debouncedSearchName.trim() } : {}), ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}), ...(ownerId ? { owner_id: ownerId } : {}) };
    productsApi.list(params)
      .then((res) => {
        const body = res.data as { data?: VisaProduct[]; pagination?: { total: number; page: number; limit: number; totalPages: number } };
        setVisaProducts(Array.isArray(body.data) ? body.data : []);
        const p = body.pagination;
        if (p) {
          setVisaTotal(p.total);
          setVisaPage(p.page);
          setVisaLimit(p.limit);
          setVisaTotalPages(p.totalPages || 1);
        }
      })
      .catch(() => setVisaProducts([]))
      .finally(() => setLoadingVisaProducts(false));
  }, [canAddToOrder, embedInProducts, user?.role, filterIncludeInactive, visaLimit, visaPage, debouncedSearchName]);

  useEffect(() => {
    fetchVisaProducts();
  }, [fetchVisaProducts]);

  useEffect(() => {
    if (embedInProducts && refreshTrigger != null && refreshTrigger > 0) fetchVisaProducts();
  }, [embedInProducts, refreshTrigger, fetchVisaProducts]);

  useEffect(() => {
    if (!visaRequireHotelVisa) {
      setHotelListForVisa([]);
      setSelectedHotelIdForVisa(null);
      return;
    }
    setLoadingHotelsForVisa(true);
    const ownerId = getProductListOwnerId(user);
    productsApi.list({ type: 'hotel', with_prices: 'true', include_inactive: 'false', limit: 300, ...(ownerId ? { owner_id: ownerId } : {}) })
      .then((res) => {
        const data = (res.data as { data?: HotelOptionForVisa[] })?.data ?? [];
        setHotelListForVisa(Array.isArray(data) ? data : []);
        setSelectedHotelIdForVisa(null);
      })
      .catch(() => setHotelListForVisa([]))
      .finally(() => setLoadingHotelsForVisa(false));
  }, [visaRequireHotelVisa, user]);

  const hotelsByLocationForVisa = React.useMemo(() => {
    const list = hotelListForVisa;
    const byLoc: { makkah: HotelOptionForVisa[]; madinah: HotelOptionForVisa[] } = { makkah: [], madinah: [] };
    list.forEach((h) => {
      const loc = (h.meta?.location ?? '').toString().toLowerCase();
      if (loc === 'madinah') byLoc.madinah.push(h);
      else byLoc.makkah.push(h);
    });
    return byLoc;
  }, [hotelListForVisa]);

  useEffect(() => {
    if (!visaRequireHotelVisa) return;
    const hasMakkah = hotelsByLocationForVisa.makkah.length > 0;
    const hasMadinah = hotelsByLocationForVisa.madinah.length > 0;
    setVisaHotelTab(hasMakkah ? 'makkah' : hasMadinah ? 'madinah' : 'makkah');
  }, [visaRequireHotelVisa, hotelsByLocationForVisa.makkah.length, hotelsByLocationForVisa.madinah.length]);

  const refetchAll = useCallback(() => {
    fetchVisaProducts();
  }, [fetchVisaProducts]);

  const handleConfirmVisaWithHotel = useCallback(() => {
    const visa = visaRequireHotelVisa;
    const hotelId = selectedHotelIdForVisa;
    if (!visa || !hotelId) {
      showToast('Pilih hotel terlebih dahulu.', 'error');
      return;
    }
    const hotel = hotelListForVisa.find((h) => h.id === hotelId);
    if (!hotel) {
      showToast('Hotel tidak ditemukan.', 'error');
      return;
    }
    const cur = (hotel.currency || (hotel.meta as { currency?: string })?.currency || 'IDR').toString().toUpperCase();
    const priceCurrency = (cur === 'SAR' || cur === 'USD' || cur === 'IDR') ? cur : 'IDR';
    const breakdown = hotel.room_breakdown || hotel.prices_by_room || {};
    const roomTypes: Array<'double'|'triple'|'quad'|'quint'> = ['double', 'triple', 'quad', 'quint'];
    const firstRoomWithPrice = roomTypes.find((rt) => {
      const entry = breakdown[rt];
      const p = typeof entry === 'object' && entry != null && 'price' in entry ? Number((entry as { price?: number }).price) : typeof entry === 'number' ? entry : 0;
      return p > 0;
    });
    const repPrice = firstRoomWithPrice
      ? (Number((breakdown[firstRoomWithPrice] as { price?: number })?.price) || Number(hotel.price_branch ?? hotel.price_general ?? 0))
      : Number(hotel.price_branch ?? hotel.price_general ?? 0);
    const mealPriceRaw = Number((hotel.meta as { meal_price?: number })?.meal_price ?? 0) || 0;
    const roomTriple = fillFromSource(priceCurrency as 'IDR'|'SAR'|'USD', repPrice, currencyRates);
    const mealTriple = fillFromSource(priceCurrency as 'IDR'|'SAR'|'USD', mealPriceRaw, currencyRates);
    const unitPriceInCur = priceCurrency === 'SAR' ? roomTriple.sar : priceCurrency === 'USD' ? roomTriple.usd : roomTriple.idr;
    const mealPriceInCur = priceCurrency === 'SAR' ? mealTriple.sar : priceCurrency === 'USD' ? mealTriple.usd : mealTriple.idr;
    const s2i = currencyRates.SAR_TO_IDR ?? 4200;
    const u2i = currencyRates.USD_TO_IDR ?? 15500;
    const unit_price_idr_hotel = priceCurrency === 'SAR' ? unitPriceInCur * s2i : priceCurrency === 'USD' ? unitPriceInCur * u2i : unitPriceInCur;
    const defaultRoomType = firstRoomWithPrice ?? 'quad';
    const hotel_location = hotel.meta?.location ? String(hotel.meta.location).toLowerCase() : undefined;
    addDraftItem({
      type: 'hotel',
      product_id: hotel.id,
      product_name: hotel.name,
      unit_price_idr: unit_price_idr_hotel,
      unit_price: unitPriceInCur,
      price_currency: priceCurrency as 'SAR'|'USD'|'IDR',
      quantity: 1,
      meta: hotel_location ? { hotel_location } : undefined,
      room_breakdown: [{ room_type: defaultRoomType, quantity: 1, unit_price: unitPriceInCur, with_meal: false, meal_unit_price: mealPriceInCur }]
    });
    const priceIdrNum = Number(visa.price_general_idr ?? (visa.currency === 'IDR' || !visa.currency ? visa.price_general ?? visa.price_branch : null) ?? 0) || 0;
    const tripleVisa = fillFromSource('IDR', priceIdrNum, currencyRates);
    const curVisa = (visa.meta?.currency || visa.currency || 'IDR').toString().toUpperCase();
    const priceCurVisa = (curVisa === 'SAR' || curVisa === 'USD' || curVisa === 'IDR') ? curVisa : 'IDR';
    const baseInCurVisa = priceCurVisa === 'SAR'
      ? (Number((visa as { price_general_sar?: number }).price_general_sar) || tripleVisa.sar)
      : priceCurVisa === 'USD'
        ? (Number((visa as { price_general_usd?: number }).price_general_usd) || tripleVisa.usd)
        : priceIdrNum;
    const unit_price_idr_visa = priceCurVisa === 'IDR' ? baseInCurVisa : fillFromSource(priceCurVisa as 'IDR'|'SAR'|'USD', baseInCurVisa, currencyRates).idr;
    addDraftItem({
      type: 'visa',
      product_id: visa.id,
      product_name: visa.name,
      unit_price_idr: Math.round(unit_price_idr_visa) || 0,
      unit_price: baseInCurVisa,
      price_currency: priceCurVisa as 'SAR'|'USD'|'IDR',
      quantity: 1
    });
    setVisaRequireHotelVisa(null);
    setSelectedHotelIdForVisa(null);
    showToast('Visa dan hotel ditambahkan. Mengalihkan ke form order.', 'success');
    navigate('/dashboard/orders/new');
  }, [visaRequireHotelVisa, selectedHotelIdForVisa, hotelListForVisa, currencyRates, addDraftItem, showToast, navigate]);

  const handleDeleteVisa = async (p: VisaProduct) => {
    if (!window.confirm(`Hapus produk visa "${p.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await productsApi.delete(p.id);
      showToast('Produk visa dihapus', 'success');
      fetchVisaProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menghapus produk visa', 'error');
    }
  };

  const handleOpenEdit = (p: VisaProduct) => {
    const { currency, value } = getEditPriceDisplay(p, currencyRates);
    setEditingVisa(p);
    setEditVisaForm({
      name: p.name || '',
      description: p.description || '',
      visa_kind: (p.meta?.visa_kind || 'only') as VisaKind,
      require_hotel: p.meta?.require_hotel === true,
      price_value: value > 0 ? value : 0,
      price_currency: currency
    });
  };

  const handleSaveEdit = async () => {
    if (!editingVisa?.id || !editVisaForm.name.trim()) {
      showToast('Nama produk visa wajib', 'error');
      return;
    }
    setEditVisaSaving(true);
    try {
      await productsApi.update(editingVisa.id, {
        name: editVisaForm.name.trim(),
        description: editVisaForm.description.trim() || null,
        meta: { visa_kind: editVisaForm.visa_kind, require_hotel: editVisaForm.require_hotel, default_quota: null }
      });
      const pricesRes = await productsApi.listPrices({ product_id: editingVisa.id });
      const prices = (pricesRes.data as { data?: Array<{ id: string; branch_id: string | null; owner_id: string | null }> })?.data ?? [];
      const generalPrices = prices.filter((p) => !p.branch_id && !p.owner_id);
      for (const gp of generalPrices) {
        await productsApi.deletePrice(gp.id);
      }
      if (editVisaForm.price_value > 0) {
        const triple = fillFromSource(editVisaForm.price_currency, editVisaForm.price_value, currencyRates);
        await productsApi.createPrice({
          product_id: editingVisa.id,
          branch_id: null,
          owner_id: null,
          amount_idr: Math.round(triple.idr || 0),
          amount_sar: triple.sar,
          amount_usd: triple.usd,
          reference_currency: editVisaForm.price_currency
        });
      }
      showToast('Produk visa berhasil diperbarui', 'success');
      setEditingVisa(null);
      fetchVisaProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setEditVisaSaving(false);
    }
  };

  const handleCreateVisa = async () => {
    if (!addVisaForm.name.trim()) {
      showToast('Nama produk visa wajib', 'error');
      return;
    }
    setAddVisaSaving(true);
    try {
      const createRes = await productsApi.createVisa({
        name: addVisaForm.name.trim(),
        description: addVisaForm.description.trim() || undefined,
        visa_kind: addVisaForm.visa_kind,
        require_hotel: addVisaForm.require_hotel,
        currency: addVisaForm.price_currency
      });
      const product = (createRes.data as { data?: { id: string } })?.data;
      const productId = product?.id;

      if (productId && addVisaForm.price_value > 0) {
        const triple = fillFromSource(addVisaForm.price_currency, addVisaForm.price_value, currencyRates);
        await productsApi.createPrice({
          product_id: productId,
          branch_id: null,
          owner_id: null,
          amount_idr: Math.round(triple.idr || 0),
          amount_sar: triple.sar,
          amount_usd: triple.usd,
          reference_currency: addVisaForm.price_currency
        });
      }

      const hasPrice = productId && addVisaForm.price_value > 0;
      const msg = hasPrice ? 'Produk visa dan harga default berhasil ditambahkan' : 'Produk visa berhasil ditambahkan';
      showToast(msg, 'success');
      setShowAddVisaModal(false);
      setAddVisaForm({ name: '', description: '', visa_kind: 'only', require_hotel: false, price_value: 0, price_currency: 'IDR' });
    fetchVisaProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menambah produk visa', 'error');
    } finally {
      setAddVisaSaving(false);
    }
  };

  /** Statistik dari visaProducts */
  const visaStats = React.useMemo(() => {
    const list = visaProducts;
    const byKind = { only: 0, tasreh: 0, premium: 0 };
    let requireHotelCount = 0;

    list.forEach((p) => {
      const kind = (p.meta?.visa_kind || 'only') as VisaKind;
      if (kind in byKind) byKind[kind]++;
      if (p.meta?.require_hotel === true) requireHotelCount++;
    });

    return {
      total: list.length,
      byKind,
      requireHotelCount
    };
  }, [visaProducts]);

  if (user?.role === 'visa_koordinator' && !embedInProducts) {
    return <VisaWorkPage />;
  }

  return (
    <div className="space-y-6">
      {!embedInProducts && (
        <PageHeader
          title="Visa"
          subtitle="Produk visa umroh: kelola harga dan aturan. Kalender (tab terpisah) untuk monitoring order per tanggal. Admin pusat dapat edit dan hapus."
          right={
            <AutoRefreshControl onRefresh={refetchAll} disabled={loadingVisaProducts} />
          }
        />
      )}

      {/* Stats — selalu tampil (data bisa stale saat loading) */}
      {(canAddToOrder || embedInProducts) && (
        <div className="grid gap-4 grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={<Package className="w-5 h-5" />} label="Total produk" value={visaStats.total} subtitle="produk visa aktif" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Layers className="w-5 h-5" />} label="Visa Only" value={visaStats.byKind.only} subtitle="produk" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Layers className="w-5 h-5" />} label="Visa + Tasreh" value={visaStats.byKind.tasreh} subtitle="produk" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Layers className="w-5 h-5" />} label="Visa Premium" value={visaStats.byKind.premium} subtitle="produk" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Hotel className="w-5 h-5" />} label="Wajib hotel" value={visaStats.requireHotelCount} subtitle={`dari ${visaStats.total} produk`} onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        </div>
      )}

      {/* 2. Produk visa (harga dari admin pusat) — tabel */}
      {(canAddToOrder || embedInProducts) && (
        <div ref={tableSectionRef}>
        <Card className="overflow-hidden border-0 shadow-lg shadow-slate-200/50 bg-gradient-to-br from-white to-slate-50/50">
          <CardSectionHeader
            icon={<FileText className="w-6 h-6" />}
            title={`Produk visa ${canAddToOrder ? 'untuk order' : '(harga dari admin pusat)'}`}
            subtitle={canAddToOrder ? 'Pilih produk visa lalu tambah ke keranjang order.' : 'Lihat saja. Pekerjaan visa di menu Visa.'}
            right={isPusat ? (
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setShowAddVisaModal(true)}>
                <Plus className="w-4 h-4" /> Tambah produk visa
              </Button>
            ) : undefined}
          />
          <div className="pb-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)] gap-4 items-end">
            <Input label="Cari nama" type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Nama produk visa..." fullWidth />
            <Autocomplete
              label="Tampilkan"
              value={filterIncludeInactive}
              onChange={(v) => setFilterIncludeInactive(v as 'false' | 'true')}
              options={[
                { value: 'false', label: 'Aktif saja' },
                { value: 'true', label: 'Semua (termasuk nonaktif)' }
              ]}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 relative min-h-[120px]">
            {loadingVisaProducts ? (
              <ContentLoading />
            ) : (
            <Table<VisaProduct>
              columns={[
                { id: 'code', label: 'Kode', align: 'left' },
                { id: 'kind', label: 'Jenis', align: 'left' },
                { id: 'name', label: 'Nama', align: 'left' },
                { id: 'description', label: 'Deskripsi', align: 'left' },
                { id: 'require_hotel', label: 'Wajib hotel', align: 'center' },
                { id: 'currency', label: 'Mata Uang', align: 'center' },
                { id: 'price', label: PRICE_COLUMN_LABEL, align: 'right' },
                ...(canShowProductActions ? [{ id: 'actions', label: 'Aksi', align: 'center' as const }] : [])
              ]}
              data={visaProducts}
              renderRow={(p) => {
                const priceIdr = p.price_general_idr ?? (p.currency === 'IDR' || !p.currency ? p.price_general ?? p.price_branch : null) ?? 0;
                const triple = fillFromSource('IDR', Number(priceIdr), currencyRates);
                const visaKind = (p.meta?.visa_kind || 'only') as VisaKind;
                const kindLabel = VISA_KIND_LABELS[visaKind] || visaKind;
                const requireHotel = p.meta?.require_hotel === true;
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-[#0D1A63]/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">{p.code || '-'}</td>
                    <td className="py-3 px-4"><Badge variant="info" className="font-medium">{kindLabel}</Badge></td>
                    <td className="py-3 px-4 font-medium text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={p.description || undefined}>{p.description || '—'}</td>
                    <td className="py-3 px-4 text-center">{requireHotel ? <Badge variant="info">Ya</Badge> : <span className="text-slate-500">Tidak</span>}</td>
                    <td className="py-3 px-4 text-center text-sm text-slate-700">{p.meta?.currency || p.currency || 'IDR'}</td>
                    <td className="py-3 px-4 text-right text-slate-800 align-top">
                      {(() => {
                        const idr = Number(priceIdr) || 0;
                        const sar = triple.sar;
                        const usd = triple.usd;
                        const t = getPriceTripleForTable(idr, sar, usd);
                        if (!t.hasPrice) return '–';
                        return (
                          <>
                            <div className="tabular-nums font-medium">{t.idrText}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              <span className="text-slate-400">SAR:</span> {t.sarText}
                              <span className="text-slate-400 ml-1">USD:</span> {t.usdText}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">per orang</div>
                          </>
                        );
                      })()}
                    </td>
                    {canShowProductActions ? (
                      <td className="py-3 px-4 sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {canAddToOrder && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="p-2"
                              onClick={() => {
                                if (requireHotel) {
                                  setVisaRequireHotelVisa(p);
                                  return;
                                }
                                const curRaw = (p.meta?.currency || p.currency || 'IDR').toString().toUpperCase();
                                const priceCurrency = (curRaw === 'SAR' || curRaw === 'USD' || curRaw === 'IDR') ? curRaw : 'IDR';
                                const priceIdrNum = Number(priceIdr) || 0;
                                const baseInCur = priceCurrency === 'SAR'
                                  ? (Number((p as { price_general_sar?: number }).price_general_sar) || triple.sar)
                                  : priceCurrency === 'USD'
                                    ? (Number((p as { price_general_usd?: number }).price_general_usd) || triple.usd)
                                    : priceIdrNum;
                                const unit_price_idr = priceCurrency === 'IDR' ? baseInCur : fillFromSource(priceCurrency as 'IDR'|'SAR'|'USD', baseInCur, currencyRates).idr;
                                addDraftItem({
                                  type: 'visa',
                                  product_id: p.id,
                                  product_name: p.name,
                                  unit_price_idr: Math.round(unit_price_idr) || 0,
                                  unit_price: baseInCur,
                                  price_currency: priceCurrency as any,
                                  quantity: 1
                                });
                                showToast('Visa ditambahkan ke order.', 'success');
                              }}
                              title="Tambah ke order"
                              aria-label="Tambah ke order"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          )}
                          {isPusat && (
                            <ActionsMenu
                              align="right"
                              items={[
                                { id: 'edit', label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => handleOpenEdit(p) },
                                { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteVisa(p), danger: true },
                              ]}
                            />
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              }}
              emptyMessage="Belum ada produk visa."
              emptyDescription={isPusat ? 'Klik "Tambah produk visa" untuk menambah.' : 'Tambah produk visa di master produk (admin pusat).'}
              pagination={{
                total: visaTotal,
                page: visaPage,
                limit: visaLimit,
                totalPages: visaTotalPages,
                onPageChange: setVisaPage,
                onLimitChange: (l) => { setVisaLimit(l); setVisaPage(1); }
              }}
              stickyActionsColumn
            />
            )}
          </div>
        </Card>
        </div>
      )}

      {/* Modal: Visa wajib hotel — pilih hotel (Mekkah / Madinah) lalu lanjut ke form order */}
      <Modal open={!!visaRequireHotelVisa} onClose={() => setVisaRequireHotelVisa(null)}>
        <ModalBox className="max-w-2xl">
          <ModalHeader
            title="Visa wajib hotel"
            subtitle={visaRequireHotelVisa ? `"${visaRequireHotelVisa.name}" memerlukan hotel. Pilih satu hotel di bawah (Mekkah atau Madinah), lalu lanjut ke form order.` : ''}
            icon={<Hotel className="w-5 h-5 text-amber-600" />}
            onClose={() => setVisaRequireHotelVisa(null)}
          />
          <ModalBody className="max-h-[65vh] overflow-y-auto">
            {loadingHotelsForVisa ? (
              <ContentLoading />
            ) : hotelListForVisa.length === 0 ? (
              <p className="text-slate-600 text-sm py-4">Tidak ada hotel tersedia. Hubungi admin untuk mengaktifkan produk hotel.</p>
            ) : (
              <div className="space-y-4">
                {/* Tabs lokasi */}
                <div className="flex items-center gap-2">
                  {(['makkah', 'madinah'] as const).map((k) => {
                    const label = LOCATION_LABELS[k] ?? k;
                    const count = hotelsByLocationForVisa[k].length;
                    const active = visaHotelTab === k;
                    const disabled = count === 0;
                    return (
                      <button
                        key={k}
                        type="button"
                        disabled={disabled}
                        onClick={() => setVisaHotelTab(k)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                          active ? 'border-[#0D1A63] bg-[#0D1A63]/5 text-[#0D1A63]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        } ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-white' : ''}`}
                      >
                        <span>Hotel {label}</span>
                        <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs ${
                          active ? 'bg-[#0D1A63]/10 text-[#0D1A63]' : 'bg-slate-100 text-slate-600'
                        }`}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Konten tab aktif */}
                {(() => {
                  const locKey = visaHotelTab;
                  const hotels = hotelsByLocationForVisa[locKey];
                  const label = LOCATION_LABELS[locKey] ?? locKey;
                  if (!hotels.length) {
                    return <p className="text-slate-600 text-sm py-2">Tidak ada hotel untuk {label}.</p>;
                  }
                  return (
                    <ul className="space-y-3">
                      {hotels.map((h) => {
                        const cur = (h.currency || h.meta?.currency || 'IDR').toString().toUpperCase();
                        const priceCur = (cur === 'SAR' || cur === 'USD' || cur === 'IDR') ? cur : 'IDR';
                        const breakdown = h.room_breakdown || h.prices_by_room || {};
                        const roomTypes: Array<'double'|'triple'|'quad'|'quint'> = ['double', 'triple', 'quad', 'quint'];
                        const firstRoom = roomTypes.find((rt) => {
                          const entry = breakdown[rt];
                          const p = typeof entry === 'object' && entry != null && 'price' in entry ? Number((entry as { price?: number }).price) : 0;
                          return p > 0;
                        });
                        const repPrice = firstRoom
                          ? (Number((breakdown[firstRoom] as { price?: number })?.price) || Number(h.price_branch ?? h.price_general ?? 0))
                          : Number(h.price_branch ?? h.price_general ?? 0);
                        const mealPriceRaw = Number(h.meta?.meal_price ?? 0) || 0;
                        const isFullboard = (h.meta?.meal_plan as string) === 'fullboard';
                        const roomTriple = fillFromSource(priceCur as 'IDR'|'SAR'|'USD', repPrice, currencyRates);
                        const mealTriple = fillFromSource(priceCur as 'IDR'|'SAR'|'USD', mealPriceRaw, currencyRates);
                        const roomT = getPriceTripleForTable(roomTriple.idr, roomTriple.sar, roomTriple.usd);
                        const mealT = getPriceTripleForTable(mealTriple.idr, mealTriple.sar, mealTriple.usd);
                        const selected = selectedHotelIdForVisa === h.id;
                        return (
                          <li key={h.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedHotelIdForVisa(selected ? null : h.id)}
                              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                                selected ? 'border-[#0D1A63] bg-[#0D1A63]/5 ring-1 ring-[#0D1A63]/20' : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <span className="font-semibold text-slate-900 block">{h.name}</span>
                                  <span className="text-xs text-slate-500 mt-0.5 block">
                                    {h.code ? `${h.code} · ` : ''}Lokasi: {label}
                                  </span>
                                  <span className="text-xs text-slate-500 mt-0.5 block">
                                    Tipe: {isFullboard ? 'Fullboard' : 'Room only'}
                                  </span>
                                </div>
                                <div className="text-right min-w-[140px]">
                                  <div className="text-xs text-slate-500 mb-1">Kamar (per kamar/hari)</div>
                                  <div className="text-sm font-medium text-slate-800 tabular-nums">{roomT.idrText}</div>
                                  <div className="text-[11px] text-slate-500"><span className="text-slate-400">SAR:</span> {roomT.sarText} <span className="text-slate-400 ml-1">USD:</span> {roomT.usdText}</div>
                                  <div className="text-xs text-slate-500 mt-1.5">Makan (per orang/hari)</div>
                                  {isFullboard ? (
                                    <div className="text-xs font-semibold text-emerald-700">Gratis</div>
                                  ) : mealT.hasPrice ? (
                                    <>
                                      <div className="text-sm font-medium text-slate-800 tabular-nums">{mealT.idrText}</div>
                                      <div className="text-[11px] text-slate-500"><span className="text-slate-400">SAR:</span> {mealT.sarText} <span className="text-slate-400 ml-1">USD:</span> {mealT.usdText}</div>
                                    </>
                                  ) : (
                                    <div className="text-xs text-slate-400">–</div>
                                  )}
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setVisaRequireHotelVisa(null)}>Batal</Button>
            <Button
              variant="primary"
              onClick={handleConfirmVisaWithHotel}
              disabled={!selectedHotelIdForVisa || loadingHotelsForVisa}
            >
              Pilih hotel & lanjut ke form order
            </Button>
          </ModalFooter>
        </ModalBox>
      </Modal>

      {/* Modal: Tambah produk visa */}
      <Modal open={showAddVisaModal} onClose={() => !addVisaSaving && setShowAddVisaModal(false)}>
        {showAddVisaModal && (
          <ModalBox>
            <ModalHeader
              title="Tambah produk visa"
              subtitle="Lengkapi jenis visa, nama, dan harga (opsional)"
              icon={<Plus className="w-5 h-5" />}
              onClose={() => !addVisaSaving && setShowAddVisaModal(false)}
            />
            <ModalBody className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Kolom kiri: Info produk */}
                <div className="space-y-5">
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Info produk</span>
                    </div>
                    <div className="space-y-4 rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Jenis visa</label>
                        <div className="grid grid-cols-1 gap-2">
                          {(['only', 'tasreh', 'premium'] as const).map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => setAddVisaForm((f) => ({ ...f, visa_kind: kind }))}
                              className={`text-left rounded-xl border-2 p-3 transition-all duration-200 ${
                                addVisaForm.visa_kind === kind
                                  ? 'border-[#0D1A63] bg-[#0D1A63]/5 text-[#0D1A63] shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 text-slate-700'
                              }`}
                            >
                              <span className="font-medium block">{VISA_KIND_LABELS[kind]}</span>
                              <span className="text-xs text-slate-500 mt-0.5 block">{VISA_KIND_DESCRIPTIONS[kind]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <Input
                        label="Nama produk"
                        type="text"
                        value={addVisaForm.name}
                        onChange={(e) => setAddVisaForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Contoh: Visa Umroh Reguler"
                        required
                        fullWidth
                      />
                      <Textarea
                        label="Deskripsi (opsional)"
                        value={addVisaForm.description}
                        onChange={(e) => setAddVisaForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Deskripsi singkat produk"
                        rows={2}
                        fullWidth
                      />
                    </div>
                  </section>
                </div>

                {/* Kolom kanan: aturan, harga */}
                <div className="space-y-5">
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Settings2 className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Aturan</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4 space-y-4">
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={addVisaForm.require_hotel}
                            onChange={(e) => setAddVisaForm((f) => ({ ...f, require_hotel: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-[#0D1A63] focus:ring-[#0D1A63]"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Visa wajib dibarengi hotel</span>
                        </label>
                        <p className="text-xs text-slate-500 mt-1 ml-7">Order yang memesan produk ini harus punya item hotel.</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Coins className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Harga default</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                      <PriceCurrencyField
                        label="Harga (opsional)"
                        value={addVisaForm.price_value}
                        currency={addVisaForm.price_currency}
                        onChange={(value, currency) => setAddVisaForm((f) => ({ ...f, price_value: value, price_currency: currency }))}
                        rates={currencyRates}
                        showConversions
                      />
                    </div>
                  </section>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowAddVisaModal(false)} disabled={addVisaSaving}>Batal</Button>
              <Button variant="primary" onClick={handleCreateVisa} disabled={addVisaSaving}>
                {addVisaSaving ? 'Menyimpan...' : 'Tambah produk'}
              </Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal: Edit produk visa */}
      <Modal open={!!editingVisa} onClose={() => !editVisaSaving && setEditingVisa(null)}>
        {editingVisa && (
          <ModalBox>
            <ModalHeader
              title="Edit produk visa"
              subtitle="Ubah data produk dan harga"
              icon={<Pencil className="w-5 h-5" />}
              onClose={() => !editVisaSaving && setEditingVisa(null)}
            />
            <ModalBody className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Kolom kiri: Info produk */}
                <div className="space-y-5">
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Info produk</span>
                    </div>
                    <div className="space-y-4 rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Jenis visa</label>
                        <div className="grid grid-cols-1 gap-2">
                          {(['only', 'tasreh', 'premium'] as const).map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => setEditVisaForm((f) => ({ ...f, visa_kind: kind }))}
                              className={`text-left rounded-xl border-2 p-3 transition-all duration-200 ${
                                editVisaForm.visa_kind === kind
                                  ? 'border-[#0D1A63] bg-[#0D1A63]/5 text-[#0D1A63] shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 text-slate-700'
                              }`}
                            >
                              <span className="font-medium block">{VISA_KIND_LABELS[kind]}</span>
                              <span className="text-xs text-slate-500 mt-0.5 block">{VISA_KIND_DESCRIPTIONS[kind]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama produk <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={editVisaForm.name}
                          onChange={(e) => setEditVisaForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Contoh: Visa Umroh Reguler"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D1A63] focus:border-[#0D1A63] bg-white placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Deskripsi <span className="text-slate-400 font-normal">(opsional)</span></label>
                        <textarea
                          value={editVisaForm.description}
                          onChange={(e) => setEditVisaForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Deskripsi singkat produk"
                          rows={2}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D1A63] focus:border-[#0D1A63] bg-white placeholder:text-slate-400 resize-none"
                        />
                      </div>
                    </div>
                  </section>
                </div>

                {/* Kolom kanan: aturan, harga */}
                <div className="space-y-5">
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Settings2 className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Aturan</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4 space-y-4">
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                            checked={editVisaForm.require_hotel}
                            onChange={(e) => setEditVisaForm((f) => ({ ...f, require_hotel: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-[#0D1A63] focus:ring-[#0D1A63]"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Visa wajib dibarengi hotel</span>
              </label>
                        <p className="text-xs text-slate-500 mt-1 ml-7">Order yang memesan produk ini harus punya item hotel.</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Coins className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Harga</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                      <PriceCurrencyField
                        label="Harga default"
                        value={editVisaForm.price_value}
                        currency={editVisaForm.price_currency}
                        onChange={(value, currency) => setEditVisaForm((f) => ({ ...f, price_value: value, price_currency: currency }))}
                        rates={currencyRates}
                        showConversions
                      />
                    </div>
                  </section>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditingVisa(null)} disabled={editVisaSaving}>Batal</Button>
              <Button variant="primary" onClick={handleSaveEdit} disabled={editVisaSaving}>
                {editVisaSaving ? 'Menyimpan...' : 'Simpan perubahan'}
              </Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

    </div>
  );
};

export default VisaPage;
