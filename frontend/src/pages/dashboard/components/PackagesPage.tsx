import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Package, Plus, Edit, Trash2, XCircle, ShoppingCart } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import { StatCard, Autocomplete, Input, PriceCurrencyField, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ContentLoading, CONTENT_LOADING_MESSAGE } from '../../../components/common';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { TableColumn } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, businessRulesApi } from '../../../services/api';
import { fillFromSource, getRatesFromRates, fromIDR } from '../../../utils/currencyConversion';
import { PRICE_COLUMN_LABEL, getPriceTripleForTable } from '../../../utils';
import { CURRENCY_OPTIONS } from '../../../utils/constants';

const INCLUDE_OPTIONS = [
  { id: 'hotel', label: 'Hotel' },
  { id: 'makan', label: 'Makan' },
  { id: 'visa', label: 'Visa' },
  { id: 'tiket', label: 'Tiket' },
  { id: 'bis', label: 'Bis' },
  { id: 'handling', label: 'Handling' }
] as const;

/** Bandara keberangkatan tiket (penerbangan dari mana) */
const BANDARA_TIKET = [
  { code: 'BTH', name: 'Batam' },
  { code: 'CGK', name: 'Jakarta' },
  { code: 'SBY', name: 'Surabaya' },
  { code: 'UPG', name: 'Makassar' }
] as const;

/** Maskapai untuk tiket paket */
const MASKAPAI_OPTIONS = [
  { code: 'lion', name: 'Lion Air' },
  { code: 'garuda', name: 'Garuda Indonesia' },
  { code: 'super_air_jet', name: 'Super Air Jet' },
  { code: 'batik', name: 'Batik Air' },
  { code: 'citilink', name: 'Citilink' },
  { code: 'other', name: 'Lainnya' }
] as const;

/** Perjalanan tiket: pergi saja / pulang saja / pulang pergi */
const TICKET_TRIP_OPTIONS = [
  { value: 'one_way', label: 'Pergi saja' },
  { value: 'return_only', label: 'Pulang saja' },
  { value: 'round_trip', label: 'Pulang pergi' }
] as const;

/** Produk paket dari API (products is_package=true) */
interface PackageProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  meta?: {
    includes?: string[];
    discount_percent?: number;
    days?: number;
    currency?: string;
    hotel_makkah_id?: string;
    hotel_madinah_id?: string;
    visa_ids?: string[];
    ticket_ids?: string[];
    ticket_bandara?: string;
    ticket_maskapai?: string;
    ticket_trip_type?: string;
    bus_ids?: string[];
    handling_ids?: string[];
    makan_hotel_ids?: string[];
    price_total_idr?: number;
  } | null;
  is_active: boolean;
  is_package?: boolean;
  price_general?: number | null;
  price_branch?: number | null;
  price_general_idr?: number | null;
  price_general_sar?: number | null;
  price_general_usd?: number | null;
  currency?: string;
}

/** Hotel option untuk dropdown paket (dari API dengan price & meal_price_idr) */
interface HotelOption {
  id: string;
  name: string;
  meta?: { location?: string } | null;
  price_general_idr?: number | null;
  room_breakdown?: Record<string, { price: number }>;
  meal_price_idr?: number | null;
}

/** Produk untuk pilihan paket (visa, tiket, bus, handling) */
interface ProductOption {
  id: string;
  code: string;
  name: string;
  type: string;
  price_general_idr?: number | null;
  price_general_sar?: number | null;
  price_general_usd?: number | null;
  currency?: string;
}

type FormState = {
  name: string;
  price_total_idr: number;
  price_currency: 'IDR' | 'SAR' | 'USD';
  days: number;
  discountPercent: number;
  includes: string[];
  hotel_makkah_id: string;
  hotel_madinah_id: string;
  visa_ids: string[];
  ticket_ids: string[];
  ticket_bandara: string;
  ticket_maskapai: string;
  ticket_trip_type: string;
  bus_ids: string[];
  handling_ids: string[];
  makan_hotel_ids: string[];
};

const emptyForm: FormState = {
  name: '',
  price_total_idr: 0,
  price_currency: 'IDR',
  days: 1,
  discountPercent: 0,
  includes: [],
  hotel_makkah_id: '',
  hotel_madinah_id: '',
  visa_ids: [],
  ticket_ids: [],
  ticket_bandara: '',
  ticket_maskapai: '',
  ticket_trip_type: '',
  bus_ids: [],
  handling_ids: [],
  makan_hotel_ids: []
};

const PackagesPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { addItem: addDraftItem } = useOrderDraft();
  const [packages, setPackages] = useState<PackageProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  /** Tampilan input Lama (hari) agar user bisa mengosongkan dan mengubah dari 1 */
  const [daysInput, setDaysInput] = useState('1');
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [visaProducts, setVisaProducts] = useState<ProductOption[]>([]);
  const [ticketProducts, setTicketProducts] = useState<ProductOption[]>([]);
  const [busProducts, setBusProducts] = useState<ProductOption[]>([]);
  const [handlingProducts, setHandlingProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const canCreatePackage = user?.role === 'super_admin' || user?.role === 'admin_pusat' || user?.role === 'role_accounting';
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const canShowProductActions = ['owner', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'role_accounting', 'super_admin'].includes(user?.role || '');

  useEffect(() => {
    if (canCreatePackage) {
      setHotelsLoading(true);
      productsApi
        .list({ type: 'hotel', with_prices: 'true', include_inactive: 'false', limit: 500 })
        .then((res) => {
          const data = (res.data?.data as HotelOption[]) ?? [];
          setHotels(data);
        })
        .catch(() => setHotels([]))
        .finally(() => setHotelsLoading(false));
    }
  }, [canCreatePackage]);

  useEffect(() => {
    if (!canCreatePackage) return;
    setProductsLoading(true);
    Promise.all([
      productsApi.list({ type: 'visa', with_prices: 'true', include_inactive: 'false', limit: 500 }).then((r) => (r.data?.data as ProductOption[]) ?? []),
      productsApi.list({ type: 'ticket', with_prices: 'true', include_inactive: 'false', limit: 500 }).then((r) => (r.data?.data as ProductOption[]) ?? []),
      productsApi.list({ type: 'bus', with_prices: 'true', include_inactive: 'false', limit: 500 }).then((r) => (r.data?.data as ProductOption[]) ?? []),
      productsApi.list({ type: 'handling', with_prices: 'true', include_inactive: 'false', limit: 500 }).then((r) => (r.data?.data as ProductOption[]) ?? [])
    ])
      .then(([visa, ticket, bus, handling]) => {
        setVisaProducts(visa);
        setTicketProducts(ticket);
        setBusProducts(bus);
        setHandlingProducts(handling);
      })
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, [canCreatePackage]);

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

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [filterIncludeInactive, setFilterIncludeInactive] = useState<'false' | 'true'>('false');
  const [searchName, setSearchName] = useState('');
  const [debouncedSearchName, setDebouncedSearchName] = useState('');
  const lastFilterKeyRef = useRef<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchName(searchName), 350);
    return () => clearTimeout(t);
  }, [searchName]);

  const fetchPackages = useCallback(() => {
    const filterKey = `${debouncedSearchName}|${filterIncludeInactive}`;
    let pageToUse = page;
    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      setPage(1);
      pageToUse = 1;
    }
    setLoading(true);
    setError(null);
    const params = { is_package: 'true', with_prices: 'true', include_inactive: filterIncludeInactive, limit, page: pageToUse, sort_by: sortBy, sort_order: sortOrder, ...(debouncedSearchName.trim() ? { name: debouncedSearchName.trim() } : {}), ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
    productsApi
      .list(params)
      .then((res) => {
        if (res.data?.data) setPackages(res.data.data as PackageProduct[]);
        const p = (res.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(p || (res.data?.data ? { total: (res.data.data as unknown[]).length, page: 1, limit: (res.data.data as unknown[]).length, totalPages: 1 } : null));
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Gagal memuat data paket');
        setPagination(null);
      })
      .finally(() => setLoading(false));
  }, [page, limit, sortBy, sortOrder, user?.role, filterIncludeInactive, debouncedSearchName]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const hotelsMakkah = useMemo(() => hotels.filter((h) => (h.meta?.location ?? '').toLowerCase() === 'makkah'), [hotels]);
  const hotelsMadinah = useMemo(() => hotels.filter((h) => (h.meta?.location ?? '').toLowerCase() === 'madinah'), [hotels]);

  const stats = [
    { label: 'Total Paket', value: pagination?.total ?? packages.length, color: 'from-blue-500 to-cyan-500' },
    { label: 'Aktif', value: packages.filter((p) => p.is_active).length, color: 'from-emerald-500 to-teal-500' },
    { label: 'Dengan Harga', value: packages.filter((p) => (p.price_general ?? p.price_branch) != null).length, color: 'from-purple-500 to-pink-500' }
  ];

  const tableColumns: TableColumn[] = [
    { id: 'code', label: 'Kode', align: 'left', sortable: true, sortKey: 'code' },
    { id: 'name', label: 'Nama Paket', align: 'left', sortable: true },
    { id: 'days', label: 'Hari', align: 'center' },
    { id: 'hotel_makkah', label: 'Hotel Mekkah', align: 'left' },
    { id: 'hotel_madinah', label: 'Hotel Madinah', align: 'left' },
    { id: 'currency', label: 'Mata Uang', align: 'center' },
    { id: 'price', label: PRICE_COLUMN_LABEL, align: 'right' },
    { id: 'discount', label: 'Diskon %', align: 'center' },
    { id: 'price_after', label: 'Setelah Diskon (IDR · SAR · USD)', align: 'right' },
    { id: 'includes', label: 'Include', align: 'left' },
    { id: 'status', label: 'Status', align: 'center' },
    ...(canShowProductActions ? [{ id: 'actions', label: 'Aksi', align: 'center' as const }] : [])
  ];

  const formatPrice = (amount: number | null | undefined, currencyId?: string) => {
    if (amount == null || amount <= 0) return '-';
    const cur = CURRENCY_OPTIONS.find((c) => c.id === (currencyId || 'IDR')) || CURRENCY_OPTIONS[0];
    return `${cur.symbol} ${Number(amount).toLocaleString(cur.locale)}`;
  };

  const getPriceAfterDiscount = (basePrice: number, discountPercent: number) => {
    if (basePrice <= 0) return 0;
    return Math.round(basePrice * (1 - discountPercent / 100));
  };

  const toggleInclude = (id: string) => {
    setForm((f) => {
      const willRemove = f.includes.includes(id);
      const nextIncludes = willRemove ? f.includes.filter((x) => x !== id) : [...f.includes, id];
      const next: FormState = { ...f, includes: nextIncludes };
      if (id === 'hotel' && willRemove) {
        next.hotel_makkah_id = '';
        next.hotel_madinah_id = '';
        next.makan_hotel_ids = next.makan_hotel_ids.filter((hid) => hid !== f.hotel_makkah_id && hid !== f.hotel_madinah_id);
      }
      if (id === 'makan' && willRemove) next.makan_hotel_ids = [];
      return next;
    });
  };

  const toggleProductId = (key: 'visa_ids' | 'ticket_ids' | 'bus_ids' | 'handling_ids', id: string) => {
    setForm((f) => {
      const arr = f[key];
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
      return { ...f, [key]: next };
    });
  };

  const toggleMakanHotelId = (hotelId: string) => {
    setForm((f) => {
      const next = f.makan_hotel_ids.includes(hotelId) ? f.makan_hotel_ids.filter((x) => x !== hotelId) : [...f.makan_hotel_ids, hotelId];
      return { ...f, makan_hotel_ids: next };
    });
  };

  const openAdd = () => {
    setForm(emptyForm);
    setDaysInput('1');
    setEditingPackage(null);
    setShowModal(true);
  };

  const openEdit = (pkg: PackageProduct) => {
    setEditingPackage(pkg);
    const meta = pkg.meta as PackageProduct['meta'];
    const days = Number(meta?.days ?? 1);
    let totalIdr = pkg.price_general_idr ?? 0;
    const priceSar = pkg.price_general_sar ?? 0;
    const priceUsd = pkg.price_general_usd ?? 0;
    if (totalIdr === 0 && priceSar === 0 && priceUsd === 0) {
      const base = Number(pkg.price_branch ?? pkg.price_general ?? 0);
      const cur = (meta?.currency || pkg.currency || 'IDR') as 'IDR' | 'SAR' | 'USD';
      const triple = fillFromSource(cur, base, currencyRates);
      totalIdr = triple.idr;
    } else if (totalIdr === 0 && (priceSar > 0 || priceUsd > 0)) {
      const triple = getRatesFromRates(currencyRates);
      if (priceSar > 0) totalIdr = priceSar * (triple.SAR_TO_IDR ?? 4200);
      else if (priceUsd > 0) totalIdr = priceUsd * (triple.USD_TO_IDR ?? 15500);
    }
    // Paket lama mungkin tersimpan sebagai total = (input × days); tampilkan nilai yang diinput = totalIdr / days
    const priceTotal = meta?.price_total_idr ?? (days >= 1 ? totalIdr / days : totalIdr);
    setForm({
      name: pkg.name,
      price_total_idr: priceTotal,
      price_currency: (meta?.currency as 'IDR' | 'SAR' | 'USD') || 'IDR',
      days,
      discountPercent: Number(meta?.discount_percent ?? 0),
      includes: meta?.includes ?? [],
      hotel_makkah_id: meta?.hotel_makkah_id ?? '',
      hotel_madinah_id: meta?.hotel_madinah_id ?? '',
      visa_ids: meta?.visa_ids ?? [],
      ticket_ids: meta?.ticket_ids ?? [],
      ticket_bandara: meta?.ticket_bandara ?? '',
      ticket_maskapai: meta?.ticket_maskapai ?? '',
      ticket_trip_type: meta?.ticket_trip_type ?? '',
      bus_ids: meta?.bus_ids ?? [],
      handling_ids: meta?.handling_ids ?? [],
      makan_hotel_ids: meta?.makan_hotel_ids ?? []
    });
    setDaysInput(days >= 1 ? String(days) : '1');
    setShowModal(true);
  };

  const closeModal = () => {
    if (!saving) {
      setShowModal(false);
      setEditingPackage(null);
      setForm(emptyForm);
      setDaysInput('1');
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      showToast('Nama paket wajib', 'error');
      return;
    }
    if (form.includes.includes('hotel') && !form.hotel_makkah_id && !form.hotel_madinah_id) {
      showToast('Jika memilih Hotel di Include, pilih minimal Hotel Mekkah atau Hotel Madinah', 'error');
      return;
    }
    const parsedDays = parseInt(daysInput.trim(), 10);
    const days = (Number.isNaN(parsedDays) || parsedDays < 1) ? 1 : parsedDays;
    const totalIdr = form.price_total_idr || 0;
    const triplePrice = fillFromSource('IDR', totalIdr, currencyRates);
    const hasPrice = triplePrice.idr > 0 || triplePrice.sar > 0 || triplePrice.usd > 0;
    setSaving(true);
    try {
      const meta = {
        includes: form.includes,
        days,
        price_total_idr: form.price_total_idr || 0,
        currency: form.price_currency,
        ...(editingPackage ? { discount_percent: form.discountPercent } : {}),
        ...(form.hotel_makkah_id ? { hotel_makkah_id: form.hotel_makkah_id } : {}),
        ...(form.hotel_madinah_id ? { hotel_madinah_id: form.hotel_madinah_id } : {}),
        ...(form.visa_ids?.length ? { visa_ids: form.visa_ids } : {}),
        ...(form.ticket_ids?.length ? { ticket_ids: form.ticket_ids } : {}),
        ...(form.ticket_bandara ? { ticket_bandara: form.ticket_bandara } : {}),
        ...(form.ticket_maskapai ? { ticket_maskapai: form.ticket_maskapai } : {}),
        ...(form.ticket_trip_type ? { ticket_trip_type: form.ticket_trip_type } : {}),
        ...(form.bus_ids?.length ? { bus_ids: form.bus_ids } : {}),
        ...(form.handling_ids?.length ? { handling_ids: form.handling_ids } : {}),
        ...(form.makan_hotel_ids?.length ? { makan_hotel_ids: form.makan_hotel_ids } : {})
      };
      if (editingPackage) {
        await productsApi.update(editingPackage.id, {
          name: form.name.trim(),
          meta
        });
        const pricesRes = await productsApi.listPrices({ product_id: editingPackage.id });
        const prices = (pricesRes.data as { data?: Array<{ id: string; branch_id: string | null; owner_id: string | null }> })?.data ?? [];
        const generalPrices = prices.filter((p: { branch_id: string | null; owner_id: string | null }) => !p.branch_id && !p.owner_id);
        for (const p of generalPrices) {
          await productsApi.deletePrice(p.id);
        }
        if (hasPrice) {
          await productsApi.createPrice({
            product_id: editingPackage.id,
            branch_id: null,
            owner_id: null,
            amount_idr: triplePrice.idr || undefined,
            amount_sar: triplePrice.sar || undefined,
            amount_usd: triplePrice.usd || undefined,
            reference_currency: 'IDR'
          });
        }
        showToast('Paket berhasil diubah', 'success');
      } else {
        const code = `PKG-${Date.now()}`;
        const createRes = await productsApi.create({
          type: 'package',
          code,
          name: form.name.trim(),
          description: form.includes.length ? `Include: ${form.includes.join(', ')}. ${days} hari.` : `${days} hari.`,
          is_package: true,
          meta
        });
        const productId = (createRes.data as { data?: { id: string } })?.data?.id;
        if (!productId) throw new Error('Product id tidak ditemukan');
        if (hasPrice) {
          await productsApi.createPrice({
            product_id: productId,
            branch_id: null,
            owner_id: null,
            amount_idr: triplePrice.idr || undefined,
            amount_sar: triplePrice.sar || undefined,
            amount_usd: triplePrice.usd || undefined,
            reference_currency: 'IDR'
          });
        }
        showToast('Paket berhasil dibuat', 'success');
      }
      closeModal();
      fetchPackages();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || (editingPackage ? 'Gagal mengubah paket' : 'Gagal membuat paket'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg: PackageProduct) => {
    if (!canCreatePackage) return;
    if (!window.confirm(`Hapus paket "${pkg.name}"? Data akan dihapus permanen dari database.`)) return;
    try {
      await productsApi.delete(pkg.id);
      showToast('Paket berhasil dihapus', 'success');
      setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
      fetchPackages();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menghapus paket', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paket"
        subtitle="Daftar paket umroh & travel. Harga adalah total untuk seluruh hari (bukan per hari)."
        right={<AutoRefreshControl onRefresh={fetchPackages} disabled={loading} />}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <StatCard
            key={i}
            icon={<Package className="w-5 h-5" />}
            label={stat.label}
            value={stat.value}
            iconClassName={`bg-gradient-to-br ${stat.color} text-white`}
          />
        ))}
      </div>

      {/* Daftar paket - table */}
      <Card>
        <CardSectionHeader
          icon={<Package className="w-6 h-6" />}
          title="Daftar paket"
          subtitle={`${pagination?.total ?? packages.length} paket · Setiap kolom dipisahkan agar mudah dibaca`}
          right={canCreatePackage ? (
            <Button variant="primary" size="sm" className="gap-1.5 shrink-0" onClick={openAdd}>
              <Plus className="w-4 h-4" /> Buat paket baru
            </Button>
          ) : undefined}
        />
        <div className="pb-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)] gap-4 items-end">
          <Input label="Cari nama" type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Nama paket..." fullWidth />
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
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          {error ? (
            <div className="rounded-lg bg-red-50 p-4 text-red-700 text-sm m-4">
              {error}
            </div>
          ) : loading ? (
            <ContentLoading />
          ) : (
          <Table
          columns={tableColumns}
          data={packages}
          sort={{ columnId: sortBy, order: sortOrder }}
          onSortChange={(col, order) => { setSortBy(col); setSortOrder(order); setPage(1); }}
          stickyActionsColumn
          pagination={pagination ? {
            total: pagination.total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: pagination.totalPages,
            onPageChange: setPage,
            onLimitChange: (l) => { setLimit(l); setPage(1); }
          } : undefined}
          renderRow={(pkg: PackageProduct) => {
            const meta = pkg.meta as PackageProduct['meta'];
            const discountPercent = Number(meta?.discount_percent ?? 0);
            const days = Number(meta?.days ?? 1);
            // Tampilkan harga yang diinput: pakai meta.price_total_idr jika ada; untuk paket lama (tanpa meta) nilai DB = input×days → tampilkan input = price_general_idr/days
            const rawIdr = pkg.price_general_idr ?? (pkg.currency === 'IDR' || !pkg.currency ? pkg.price_general ?? pkg.price_branch : null) ?? 0;
            const priceIdr = meta?.price_total_idr ?? (days >= 1 ? (Number(rawIdr) || 0) / days : rawIdr);
            let priceSar = pkg.price_general_sar ?? (pkg.currency === 'SAR' ? pkg.price_general ?? pkg.price_branch : null) ?? 0;
            let priceUsd = pkg.price_general_usd ?? (pkg.currency === 'USD' ? pkg.price_general ?? pkg.price_branch : null) ?? 0;
            // Jika hanya IDR ada, tampilkan SAR & USD dari konversi kurs
            if (Number(priceIdr) > 0 && (priceSar == null || Number(priceSar) <= 0) && (priceUsd == null || Number(priceUsd) <= 0)) {
              const triple = fromIDR(Number(priceIdr), currencyRates);
              priceSar = triple.sar;
              priceUsd = triple.usd;
            }
            const basePriceIdr = Number(priceIdr) || 0;
            const priceAfterIdr = discountPercent > 0 ? getPriceAfterDiscount(basePriceIdr, discountPercent) : null;
            const includesList = (pkg.meta?.includes as string[] | undefined) ?? [];
            const pkgMeta = pkg.meta as PackageProduct['meta'];
            const hotelMakkahName = pkgMeta?.hotel_makkah_id ? (hotels.find((h) => h.id === pkgMeta.hotel_makkah_id)?.name ?? '-') : '-';
            const hotelMadinahName = pkgMeta?.hotel_madinah_id ? (hotels.find((h) => h.id === pkgMeta.hotel_madinah_id)?.name ?? '-') : '-';
            return (
              <tr key={pkg.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-3 text-sm font-mono text-slate-600 whitespace-nowrap">{pkg.code || '-'}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-900">{pkg.name}</span>
                </td>
                <td className="px-4 py-3 text-center text-slate-700 whitespace-nowrap">{days} hari</td>
                <td className="px-4 py-3 text-sm text-slate-700">{hotelMakkahName}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{hotelMadinahName}</td>
                <td className="px-4 py-3 text-center text-sm text-slate-700">IDR</td>
                <td className="px-4 py-3 text-right text-slate-800 align-top">
                  {(() => {
                    const t = getPriceTripleForTable(priceIdr, priceSar, priceUsd);
                    if (!t.hasPrice) return '-';
                    return (
                      <>
                        <div className="tabular-nums">{t.idrText}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="text-slate-400">SAR:</span> {t.sarText}
                          <span className="text-slate-400 ml-1">USD:</span> {t.usdText}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">per jamaah</div>
                      </>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {discountPercent > 0 ? <span className="text-amber-700 font-semibold">{discountPercent}%</span> : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3 text-right text-slate-800 align-top">
                  {(() => {
                    if (priceAfterIdr == null || priceAfterIdr <= 0) return <span className="text-slate-400">-</span>;
                    const afterTriple = fromIDR(priceAfterIdr, currencyRates);
                    const t = getPriceTripleForTable(priceAfterIdr, afterTriple.sar, afterTriple.usd);
                    return (
                      <>
                        <div className="tabular-nums text-[#0D1A63] font-medium">{t.idrText}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="text-slate-400">SAR:</span> {t.sarText}
                          <span className="text-slate-400 ml-1">USD:</span> {t.usdText}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">per jamaah</div>
                      </>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 min-w-[120px]">
                    {includesList.length > 0 ? includesList.map((inc) => {
                      const opt = INCLUDE_OPTIONS.find((o) => o.id === inc);
                      const label = opt ? opt.label : inc;
                      return <span key={inc} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">{label}</span>;
                    }) : <span className="text-slate-400 text-sm col-span-full">-</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {pkg.is_active ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Aktif</span> : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Nonaktif</span>}
                </td>
                {canShowProductActions && (
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    {canAddToOrder && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-2"
                        onClick={() => {
                          // Pakai harga setelah diskon jika ada diskon, otherwise harga normal
                          const idr = discountPercent > 0 && priceAfterIdr != null && priceAfterIdr > 0
                            ? priceAfterIdr
                            : basePriceIdr;
                          addDraftItem({
                            type: 'package',
                            product_id: pkg.id,
                            product_name: pkg.name,
                            unit_price_idr: idr,
                            quantity: 1
                          });
                          showToast('Paket ditambahkan ke order. Klik "Buat order" untuk lanjut.', 'success');
                        }}
                        title="Tambah ke order"
                        aria-label="Tambah ke order"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                    )}
                    {canCreatePackage && (
                      <ActionsMenu
                        align="right"
                        items={[
                          { id: 'edit', label: 'Edit', icon: <Edit className="w-4 h-4" />, onClick: () => openEdit(pkg) },
                          { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(pkg), danger: true },
                        ] as ActionsMenuItem[]}
                      />
                    )}
                  </div>
                </td>
                )}
              </tr>
            );
          }}
        />
          )}
        </div>
      </Card>

      <Modal open={showModal} onClose={closeModal}>
        <ModalBox>
          <ModalHeader
            title={editingPackage ? 'Update paket' : 'Buat paket baru'}
            subtitle="Admin Pusat / Super Admin"
            icon={<Package className="w-5 h-5" />}
            onClose={closeModal}
          />
          <ModalBody className="space-y-6 overflow-y-auto flex-1">
              {/* Section: Info dasar */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Info dasar</h3>
                <Input
                  label="Nama paket"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: Paket Ramadhan 9 day"
                  required
                  fullWidth
                />
                <div className="w-full">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Include – pilih yang termasuk</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full">
                    {INCLUDE_OPTIONS.map((opt) => {
                      const selected = form.includes.includes(opt.id);
                      return (
                        <Button
                          key={opt.id}
                          type="button"
                          variant={selected ? 'primary' : 'outline'}
                          size="sm"
                          className="w-full"
                          onClick={() => toggleInclude(opt.id)}
                        >
                          {opt.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Jika pilih Hotel, isi hotel Mekkah & Madinah di bawah.</p>
                </div>
              </section>

              {/* Section: Hotel & Makan */}
              {(form.includes.includes('hotel') || (form.includes.includes('makan') && (form.hotel_makkah_id || form.hotel_madinah_id))) && canCreatePackage && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Hotel & Makan</h3>
                  {form.includes.includes('hotel') && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                      <p className="text-sm font-medium text-slate-800">Hotel yang termasuk dalam paket</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Autocomplete
                          label="Hotel Mekkah"
                          value={form.hotel_makkah_id}
                          onChange={(v) => setForm((f) => ({ ...f, hotel_makkah_id: v }))}
                          options={hotelsMakkah.map((h) => ({ value: h.id, label: h.name }))}
                          placeholder={hotelsLoading && hotelsMakkah.length === 0 ? CONTENT_LOADING_MESSAGE : '-- Pilih hotel Mekkah --'}
                          fullWidth
                        />
                        <Autocomplete
                          label="Hotel Madinah"
                          value={form.hotel_madinah_id}
                          onChange={(v) => setForm((f) => ({ ...f, hotel_madinah_id: v }))}
                          options={hotelsMadinah.map((h) => ({ value: h.id, label: h.name }))}
                          placeholder={hotelsLoading && hotelsMadinah.length === 0 ? CONTENT_LOADING_MESSAGE : '-- Pilih hotel Madinah --'}
                          fullWidth
                        />
                      </div>
                    </div>
                  )}
                  {form.includes.includes('makan') && (form.hotel_makkah_id || form.hotel_madinah_id) && (
                    <div className="rounded-xl border border-btn/30 bg-btn-light/50 p-4 w-full">
                      <label className="block text-sm font-medium text-slate-800 mb-2">Makan – pilih sesuai hotel</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                        {form.hotel_makkah_id && (() => {
                          const h = hotels.find((x) => x.id === form.hotel_makkah_id);
                          return h ? (
                            <Button
                              key={h.id}
                              type="button"
                              size="sm"
                              variant={form.makan_hotel_ids.includes(h.id) ? 'primary' : 'outline'}
                              className="w-full"
                              onClick={() => toggleMakanHotelId(h.id)}
                            >
                              Makan – {h.name}
                            </Button>
                          ) : null;
                        })()}
                        {form.hotel_madinah_id && (() => {
                          const h = hotels.find((x) => x.id === form.hotel_madinah_id);
                          return h ? (
                            <Button
                              key={h.id}
                              type="button"
                              size="sm"
                              variant={form.makan_hotel_ids.includes(h.id) ? 'primary' : 'outline'}
                              className="w-full"
                              onClick={() => toggleMakanHotelId(h.id)}
                            >
                              Makan – {h.name}
                            </Button>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Section: Produk dalam paket (Visa, Tiket, Bis, Handling) */}
              {(form.includes.includes('visa') || form.includes.includes('tiket') || form.includes.includes('bis') || form.includes.includes('handling')) && canCreatePackage && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Produk dalam paket</h3>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    {form.includes.includes('visa') && (
                      <Autocomplete
                        label="Visa – pilih yang masuk paket"
                        value={form.visa_ids[0] ?? ''}
                        onChange={(v) => setForm((f) => ({ ...f, visa_ids: v ? [v] : [] }))}
                        options={visaProducts.map((p) => ({ value: p.id, label: p.name }))}
                        placeholder={productsLoading && visaProducts.length === 0 ? CONTENT_LOADING_MESSAGE : '-- Pilih visa --'}
                        fullWidth
                      />
                    )}
                    {form.includes.includes('tiket') && (
                      <div className="space-y-3">
                        <Autocomplete
                          label="Tiket – pilih yang masuk paket"
                          value={form.ticket_ids[0] ?? ''}
                          onChange={(v) => setForm((f) => ({ ...f, ticket_ids: v ? [v] : [] }))}
                          options={ticketProducts.map((p) => ({ value: p.id, label: p.name }))}
                          placeholder={productsLoading && ticketProducts.length === 0 ? CONTENT_LOADING_MESSAGE : '-- Pilih produk tiket --'}
                          fullWidth
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Autocomplete
                            label="Maskapai"
                            value={form.ticket_maskapai}
                            onChange={(v) => setForm((f) => ({ ...f, ticket_maskapai: v }))}
                            options={MASKAPAI_OPTIONS.map((m) => ({ value: m.code, label: m.name }))}
                            placeholder="-- Pilih maskapai --"
                            fullWidth
                          />
                          <Autocomplete
                            label="Penerbangan dari (bandara)"
                            value={form.ticket_bandara}
                            onChange={(v) => setForm((f) => ({ ...f, ticket_bandara: v }))}
                            options={BANDARA_TIKET.map((b) => ({ value: b.code, label: `${b.name} (${b.code})` }))}
                            placeholder="-- Pilih bandara --"
                            fullWidth
                          />
                          <Autocomplete
                            label="Perjalanan"
                            value={form.ticket_trip_type}
                            onChange={(v) => setForm((f) => ({ ...f, ticket_trip_type: v }))}
                            options={TICKET_TRIP_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
                            placeholder="-- Pilih perjalanan --"
                            fullWidth
                          />
                        </div>
                      </div>
                    )}
                    {form.includes.includes('bis') && (
                      <Autocomplete
                        label="Bis – pilih yang masuk paket"
                        value={form.bus_ids[0] ?? ''}
                        onChange={(v) => setForm((f) => ({ ...f, bus_ids: v ? [v] : [] }))}
                        options={busProducts.map((p) => ({ value: p.id, label: p.name }))}
                        placeholder={productsLoading && busProducts.length === 0 ? CONTENT_LOADING_MESSAGE : '-- Pilih bis --'}
                        fullWidth
                      />
                    )}
                    {form.includes.includes('handling') && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-800">Handling – pilih yang masuk paket</label>
                        <p className="text-xs text-slate-500">Bisa pilih lebih dari satu produk handling.</p>
                        {productsLoading && handlingProducts.length === 0 ? (
                          <p className="text-slate-500 text-sm">{CONTENT_LOADING_MESSAGE}</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full">
                            {handlingProducts.map((p) => (
                              <Button
                                key={p.id}
                                type="button"
                                size="sm"
                                variant={form.handling_ids.includes(p.id) ? 'primary' : 'outline'}
                                className="w-full"
                                onClick={() => toggleProductId('handling_ids', p.id)}
                              >
                                {p.name}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Section: Lama & Harga (termasuk diskon) */}
              {canCreatePackage && (
                <section className="space-y-4 pt-2 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Lama & Harga</h3>
                  <p className="text-xs text-slate-500">Contoh: 9 hari = paket 9 hari full. Harga total untuk seluruh hari per jamaah. Isi dalam Rupiah; sistem pakai kurs untuk SAR & USD.</p>
                  <div className={`grid gap-4 ${editingPackage ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    <Input
                      label="Lama (hari)"
                      type="number"
                      min={1}
                      value={daysInput}
                      onChange={(e) => setDaysInput(e.target.value)}
                      onBlur={() => {
                        const v = parseInt(daysInput.trim(), 10);
                        const norm = (Number.isNaN(v) || v < 1) ? 1 : v;
                        setForm((f) => ({ ...f, days: norm }));
                        setDaysInput(String(norm));
                      }}
                      placeholder="9"
                      required
                      fullWidth
                    />
                    <PriceCurrencyField
                      label="Harga total full per jamaah"
                      value={(() => {
                        const idr = form.price_total_idr ?? 0;
                        const t = fillFromSource('IDR', idr, currencyRates);
                        return form.price_currency === 'IDR' ? t.idr : form.price_currency === 'SAR' ? t.sar : t.usd;
                      })()}
                      currency={form.price_currency}
                      onChange={(val, cur) => setForm((f) => ({
                        ...f,
                        price_currency: cur,
                        price_total_idr: Math.round(fillFromSource(cur, val, currencyRates).idr) || 0
                      }))}
                      rates={currencyRates}
                      showConversions
                    />
                    {editingPackage && (
                      <Input
                        label="Diskon (%)"
                        type="number"
                        min={0}
                        max={100}
                        value={form.discountPercent != null ? String(form.discountPercent) : ''}
                        onChange={(e) => setForm((f) => ({ ...f, discountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                        placeholder="0"
                        fullWidth
                      />
                    )}
                  </div>
                  {editingPackage && form.discountPercent > 0 && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
                      <div>
                        <span className="text-slate-600">Harga setelah diskon (IDR): </span>
                        <span className="font-semibold text-[#0D1A63]">
                          {formatPrice(getPriceAfterDiscount(form.price_total_idr || 0, form.discountPercent), 'IDR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-amber-700 font-medium">Total diskon: </span>
                        <span className="font-semibold text-amber-800">
                          {(() => {
                            const amount = Math.round((form.price_total_idr || 0) * (form.discountPercent / 100));
                            const cur = CURRENCY_OPTIONS.find((c) => c.id === 'IDR') || CURRENCY_OPTIONS[0];
                            return `${cur.symbol} ${amount.toLocaleString(cur.locale)}`;
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                  {(form.price_total_idr > 0) && (() => {
                    const triple = fillFromSource('IDR', form.price_total_idr, currencyRates);
                    return (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                        <p className="text-slate-600 font-medium mb-1">Konversi (kurs):</p>
                        <p className="text-slate-700">IDR: {formatPrice(form.price_total_idr, 'IDR')} · SAR: {formatPrice(triple.sar, 'SAR')} · USD: {formatPrice(triple.usd, 'USD')}</p>
                      </div>
                    );
                  })()}
                  {(() => {
                const sar = currencyRates.SAR_TO_IDR ?? 4200;
                const usd = currencyRates.USD_TO_IDR ?? 15500;
                const toIdr = (p: ProductOption | HotelOption & { price_general_idr?: number | null; price_general_sar?: number | null; price_general_usd?: number | null }): number => {
                  if ('price_general_idr' in p && p.price_general_idr != null && p.price_general_idr > 0) return p.price_general_idr;
                  if ('price_general_sar' in p && p.price_general_sar != null && p.price_general_sar > 0) return p.price_general_sar * sar;
                  if ('price_general_usd' in p && p.price_general_usd != null && p.price_general_usd > 0) return p.price_general_usd * usd;
                  if ('room_breakdown' in p && p.room_breakdown) {
                    const first = Object.values(p.room_breakdown)[0];
                    return first?.price ? first.price * ((() => { const v = parseInt(daysInput.trim(), 10); return (Number.isNaN(v) || v < 1) ? 1 : v; })()) : 0;
                  }
                  return 0;
                };
                const daysVal = (() => { const v = parseInt(daysInput.trim(), 10); return (Number.isNaN(v) || v < 1) ? 1 : v; })();
                const baseTotalIdr = form.price_total_idr || 0;
                const packageTotalIdr = form.discountPercent > 0
                  ? getPriceAfterDiscount(baseTotalIdr, form.discountPercent)
                  : baseTotalIdr;
                const rows: { label: string; listIdr: number }[] = [];
                if (form.hotel_makkah_id) {
                  const h = hotels.find((x) => x.id === form.hotel_makkah_id);
                  if (h) {
                    const listIdr = (h.price_general_idr ?? (h.room_breakdown && Object.values(h.room_breakdown)[0]?.price) ?? 0) * daysVal;
                    rows.push({ label: `Hotel Mekkah: ${h.name}`, listIdr });
                  }
                }
                if (form.hotel_madinah_id) {
                  const h = hotels.find((x) => x.id === form.hotel_madinah_id);
                  if (h) {
                    const listIdr = (h.price_general_idr ?? (h.room_breakdown && Object.values(h.room_breakdown)[0]?.price) ?? 0) * daysVal;
                    rows.push({ label: `Hotel Madinah: ${h.name}`, listIdr });
                  }
                }
                form.makan_hotel_ids.forEach((hid) => {
                  const h = hotels.find((x) => x.id === hid);
                  if (h && (h.meal_price_idr ?? 0) > 0) rows.push({ label: `Makan: ${h.name}`, listIdr: (h.meal_price_idr ?? 0) * daysVal });
                });
                form.visa_ids.forEach((id) => {
                  const p = visaProducts.find((x) => x.id === id);
                  if (p) rows.push({ label: `Visa: ${p.name}`, listIdr: toIdr(p) });
                });
                form.ticket_ids.forEach((id) => {
                  const p = ticketProducts.find((x) => x.id === id);
                  if (p) {
                    const maskapaiName = form.ticket_maskapai ? MASKAPAI_OPTIONS.find((m) => m.code === form.ticket_maskapai)?.name : '';
                    const bandaraName = form.ticket_bandara ? BANDARA_TIKET.find((b) => b.code === form.ticket_bandara)?.name : '';
                    const tripLabel = form.ticket_trip_type ? TICKET_TRIP_OPTIONS.find((t) => t.value === form.ticket_trip_type)?.label : '';
                    const extra = [maskapaiName, bandaraName, tripLabel].filter(Boolean).join(' · ');
                    rows.push({ label: `Tiket: ${p.name}${extra ? ` (${extra})` : ''}`, listIdr: toIdr(p) });
                  }
                });
                form.bus_ids.forEach((id) => {
                  const p = busProducts.find((x) => x.id === id);
                  if (p) rows.push({ label: `Bis: ${p.name}`, listIdr: toIdr(p) });
                });
                form.handling_ids.forEach((id) => {
                  const p = handlingProducts.find((x) => x.id === id);
                  if (p) rows.push({ label: `Handling: ${p.name}`, listIdr: toIdr(p) });
                });
                const totalListIdr = rows.reduce((s, r) => s + r.listIdr, 0);
                const totalDiscountAmount = baseTotalIdr - packageTotalIdr;
                if (rows.length > 0 && baseTotalIdr > 0 && totalListIdr > 0) {
                  const weightTotal = totalListIdr;
                  return (
                    <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 space-y-2">
                      <p className="text-sm font-semibold text-slate-800">Kalkulasi diskon (otomatis dari harga total paket & kurs)</p>
                      <p className="text-xs text-slate-600">List = bagian proporsional dari harga paket penuh; Alokasi = bagian dari harga jual; Diskon = List − Alokasi.</p>
                      <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                        {rows.map((r, i) => {
                          const weightRatio = weightTotal > 0 ? r.listIdr / weightTotal : 0;
                          const listShare = Math.round(weightRatio * baseTotalIdr);
                          const allocated = Math.round(weightRatio * packageTotalIdr);
                          const discount = listShare - allocated;
                          const pct = listShare > 0 ? Math.round((discount / listShare) * 100) : 0;
                          return (
                            <div key={i} className="py-1.5 border-b border-slate-200/80">
                              <div className="text-slate-700 font-medium truncate">{r.label}</div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                List: {formatPrice(listShare, 'IDR')} → Alokasi: {formatPrice(allocated, 'IDR')} · Diskon: {formatPrice(discount, 'IDR')} ({pct}%)
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-medium">
                        <span>Total list (harga penuh): {formatPrice(baseTotalIdr, 'IDR')}</span>
                        <span>Total paket (setelah diskon): {formatPrice(packageTotalIdr, 'IDR')}</span>
                      </div>
                    </div>
                  );
                }
                return null;
                  })()}
                </section>
              )}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Batal</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Menyimpan...' : editingPackage ? 'Simpan perubahan' : 'Simpan paket'}
            </Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default PackagesPage;
