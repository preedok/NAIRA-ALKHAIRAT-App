import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Plus, Edit, Trash2, XCircle, ShoppingCart } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { TableColumn } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, businessRulesApi } from '../../../services/api';
import { fillFromSource, getRatesFromRates } from '../../../utils/currencyConversion';

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

const CURRENCIES = [
  { id: 'IDR', label: 'Rupiah (IDR)', symbol: 'Rp', locale: 'id-ID' },
  { id: 'SAR', label: 'Riyal Saudi (SAR)', symbol: 'SAR', locale: 'en-US' },
  { id: 'USD', label: 'US Dollar (USD)', symbol: '$', locale: 'en-US' }
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

  const canCreatePackage = user?.role === 'super_admin' || user?.role === 'admin_pusat';
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'role_invoice_saudi';

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

  const fetchPackages = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { is_package: 'true', with_prices: 'true', include_inactive: 'false', limit, page, sort_by: sortBy, sort_order: sortOrder, ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
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
  }, [page, limit, sortBy, sortOrder, user?.role]);

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
    { id: 'ticket_info', label: 'Tiket', align: 'left' },
    { id: 'ticket_workflow', label: 'Perjalanan', align: 'left' },
    { id: 'price_idr', label: 'Harga (IDR)', align: 'right' },
    { id: 'price_sar', label: 'Harga (SAR)', align: 'right' },
    { id: 'price_usd', label: 'Harga (USD)', align: 'right' },
    { id: 'discount', label: 'Diskon %', align: 'center' },
    { id: 'price_after', label: 'Setelah Diskon (IDR)', align: 'right' },
    { id: 'includes', label: 'Include', align: 'left' },
    { id: 'status', label: 'Status', align: 'center' },
    { id: 'actions', label: 'Aksi', align: 'center' }
  ];

  const formatPrice = (amount: number | null | undefined, currencyId?: string) => {
    if (amount == null || amount <= 0) return '-';
    const cur = CURRENCIES.find((c) => c.id === (currencyId || 'IDR')) || CURRENCIES[0];
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
            amount_usd: triplePrice.usd || undefined
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
            amount_usd: triplePrice.usd || undefined
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Memuat data paket...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Paket</h1>
          <p className="text-slate-600 text-sm mt-1 max-w-xl">
            Daftar paket umroh & travel. Harga adalah total untuk seluruh hari (bukan per hari).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AutoRefreshControl onRefresh={fetchPackages} disabled={loading} />
          {canCreatePackage && (
            <Button variant="primary" className="flex items-center gap-2 shrink-0" onClick={openAdd}>
              <Plus className="w-5 h-5" />
              Buat paket baru
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} padding="md" className="border border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white shrink-0 shadow-sm`}>
                <Package className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Daftar paket - table */}
      <Card className="overflow-hidden border border-slate-200/80">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-900">Daftar paket</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {pagination?.total ?? packages.length} paket · Setiap kolom dipisahkan agar mudah dibaca
          </p>
        </div>
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
            const priceSar = pkg.price_general_sar ?? (pkg.currency === 'SAR' ? pkg.price_general ?? pkg.price_branch : null) ?? 0;
            const priceUsd = pkg.price_general_usd ?? (pkg.currency === 'USD' ? pkg.price_general ?? pkg.price_branch : null) ?? 0;
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
                <td className="px-4 py-3 text-sm text-slate-700">
                  {pkgMeta?.ticket_ids?.length ? (() => {
                    const tid = pkgMeta.ticket_ids[0];
                    const ticketProduct = ticketProducts.find((p) => p.id === tid);
                    const productName = ticketProduct?.name ?? 'Tiket';
                    const maskapaiName = pkgMeta.ticket_maskapai ? MASKAPAI_OPTIONS.find((m) => m.code === pkgMeta.ticket_maskapai)?.name : '';
                    const bandaraName = pkgMeta.ticket_bandara ? BANDARA_TIKET.find((b) => b.code === pkgMeta.ticket_bandara)?.name : '';
                    const parts = [productName, maskapaiName, bandaraName].filter(Boolean);
                    return parts.length > 1 ? <span>{parts[0]} <span className="text-slate-500">·</span> {parts.slice(1).join(' · ')}</span> : (parts[0] || '-');
                  })() : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {pkgMeta?.ticket_ids?.length && pkgMeta?.ticket_trip_type ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-sky-100 text-sky-800">
                      {TICKET_TRIP_OPTIONS.find((t) => t.value === pkgMeta.ticket_trip_type)?.label ?? pkgMeta.ticket_trip_type}
                    </span>
                  ) : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                  {priceIdr != null && Number(priceIdr) > 0 ? formatPrice(Number(priceIdr), 'IDR') : '-'}
                </td>
                <td className="px-4 py-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                  {priceSar != null && Number(priceSar) > 0 ? formatPrice(Number(priceSar), 'SAR') : '-'}
                </td>
                <td className="px-4 py-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                  {priceUsd != null && Number(priceUsd) > 0 ? formatPrice(Number(priceUsd), 'USD') : '-'}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {discountPercent > 0 ? <span className="text-amber-700 font-semibold">{discountPercent}%</span> : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  {priceAfterIdr != null && priceAfterIdr > 0 ? <span className="text-emerald-700 font-medium">{formatPrice(priceAfterIdr, 'IDR')}</span> : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {includesList.length > 0 ? includesList.map((inc) => {
                      const opt = INCLUDE_OPTIONS.find((o) => o.id === inc);
                      const label = opt ? opt.label : inc;
                      return <span key={inc} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">{label}</span>;
                    }) : <span className="text-slate-400 text-sm">-</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {pkg.is_active ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Aktif</span> : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Nonaktif</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    {canAddToOrder && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-2"
                        onClick={() => {
                          const idr = Number(priceIdr) || Number(pkg.price_general) || 0;
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
              </tr>
            );
          }}
        />
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingPackage ? 'Update paket' : 'Buat paket baru'}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Admin Pusat / Super Admin</p>
              </div>
              <button type="button" onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg" disabled={saving}>
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Section: Info dasar */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Info dasar</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama paket *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Contoh: Paket Ramadhan 9 day"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Include – pilih yang termasuk</label>
                  <div className="flex flex-wrap gap-2">
                    {INCLUDE_OPTIONS.map((opt) => {
                      const selected = form.includes.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleInclude(opt.id)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            selected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
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
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Hotel Mekkah</label>
                          <select
                            value={form.hotel_makkah_id}
                            onChange={(e) => setForm((f) => ({ ...f, hotel_makkah_id: e.target.value }))}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          >
                            <option value="">-- Pilih hotel Mekkah --</option>
                            {hotelsMakkah.map((h) => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                            {hotelsLoading && hotelsMakkah.length === 0 && <option value="">Memuat...</option>}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Hotel Madinah</label>
                          <select
                            value={form.hotel_madinah_id}
                            onChange={(e) => setForm((f) => ({ ...f, hotel_madinah_id: e.target.value }))}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          >
                            <option value="">-- Pilih hotel Madinah --</option>
                            {hotelsMadinah.map((h) => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                            {hotelsLoading && hotelsMadinah.length === 0 && <option value="">Memuat...</option>}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                  {form.includes.includes('makan') && (form.hotel_makkah_id || form.hotel_madinah_id) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
                      <label className="block text-sm font-medium text-amber-800 mb-2">Makan – pilih sesuai hotel</label>
                      <div className="flex flex-wrap gap-2">
                        {form.hotel_makkah_id && (() => {
                          const h = hotels.find((x) => x.id === form.hotel_makkah_id);
                          return h ? (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => toggleMakanHotelId(h.id)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium ${form.makan_hotel_ids.includes(h.id) ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-slate-700 hover:bg-amber-100'}`}
                            >
                              Makan – {h.name}
                            </button>
                          ) : null;
                        })()}
                        {form.hotel_madinah_id && (() => {
                          const h = hotels.find((x) => x.id === form.hotel_madinah_id);
                          return h ? (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => toggleMakanHotelId(h.id)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium ${form.makan_hotel_ids.includes(h.id) ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-slate-700 hover:bg-amber-100'}`}
                            >
                              Makan – {h.name}
                            </button>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Section: Produk dalam paket (Visa, Tiket, Bis) – select list seperti Hotel */}
              {(form.includes.includes('visa') || form.includes.includes('tiket') || form.includes.includes('bis')) && canCreatePackage && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Produk dalam paket</h3>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    {form.includes.includes('visa') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Visa – pilih yang masuk paket</label>
                        <select
                          value={form.visa_ids[0] ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, visa_ids: e.target.value ? [e.target.value] : [] }))}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="">-- Pilih visa --</option>
                          {visaProducts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                          {productsLoading && visaProducts.length === 0 && <option value="">Memuat visa...</option>}
                        </select>
                      </div>
                    )}
                    {form.includes.includes('tiket') && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Tiket – pilih yang masuk paket</label>
                          <select
                            value={form.ticket_ids[0] ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, ticket_ids: e.target.value ? [e.target.value] : [] }))}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          >
                            <option value="">-- Pilih produk tiket --</option>
                            {ticketProducts.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                            {productsLoading && ticketProducts.length === 0 && <option value="">Memuat tiket...</option>}
                          </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Maskapai</label>
                            <select
                              value={form.ticket_maskapai}
                              onChange={(e) => setForm((f) => ({ ...f, ticket_maskapai: e.target.value }))}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                              <option value="">-- Pilih maskapai --</option>
                              {MASKAPAI_OPTIONS.map((m) => (
                                <option key={m.code} value={m.code}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Penerbangan dari (bandara)</label>
                            <select
                              value={form.ticket_bandara}
                              onChange={(e) => setForm((f) => ({ ...f, ticket_bandara: e.target.value }))}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                              <option value="">-- Pilih bandara --</option>
                              {BANDARA_TIKET.map((b) => (
                                <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Perjalanan</label>
                            <select
                              value={form.ticket_trip_type}
                              onChange={(e) => setForm((f) => ({ ...f, ticket_trip_type: e.target.value }))}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                              <option value="">-- Pilih perjalanan --</option>
                              {TICKET_TRIP_OPTIONS.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                    {form.includes.includes('bis') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Bis – pilih yang masuk paket</label>
                        <select
                          value={form.bus_ids[0] ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, bus_ids: e.target.value ? [e.target.value] : [] }))}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="">-- Pilih bis --</option>
                          {busProducts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                          {productsLoading && busProducts.length === 0 && <option value="">Memuat bis...</option>}
                        </select>
                      </div>
                    )}
                  </div>
                </section>
              )}
              {canCreatePackage && form.includes.includes('handling') && (
                <div className="rounded-lg border border-slate-200 bg-rose-50/30 p-4">
                  <label className="block text-sm font-medium text-rose-800 mb-2">Handling – pilih yang masuk paket</label>
                  <div className="flex flex-wrap gap-2">
                    {handlingProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProductId('handling_ids', p.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${form.handling_ids.includes(p.id) ? 'bg-rose-600 text-white' : 'bg-white border border-rose-300 text-slate-700 hover:bg-rose-100'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                    {productsLoading && handlingProducts.length === 0 && <span className="text-slate-500 text-sm">Memuat handling...</span>}
                  </div>
                </div>
              )}

              {/* Section: Lama & Harga */}
              {canCreatePackage && (
                <section className="space-y-4 pt-2 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Lama & Harga</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lama (hari) *</label>
                    <p className="text-xs text-slate-500 mb-1">Contoh: 9 hari = paket 9 hari full. Harga di bawah adalah total untuk seluruh hari per jamaah.</p>
                    <input
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
                      className="w-full max-w-[120px] border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="9"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Harga (IDR) – total full per jamaah</label>
                    <p className="text-xs text-slate-500 mb-2">Total harga paket untuk seluruh hari. Isi dalam Rupiah. Sistem pakai kurs untuk SAR & USD.</p>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.price_total_idr || ''}
                      onChange={(e) => setForm((f) => ({ ...f, price_total_idr: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Contoh: 45000000"
                    />
                    {(form.price_total_idr > 0) && (() => {
                      const triple = fillFromSource('IDR', form.price_total_idr, currencyRates);
                      return (
                        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                          <p className="text-slate-600 font-medium mb-1">Konversi (kurs):</p>
                          <p className="text-slate-700">IDR: {formatPrice(form.price_total_idr, 'IDR')} · SAR: {formatPrice(triple.sar, 'SAR')} · USD: {formatPrice(triple.usd, 'USD')}</p>
                        </div>
                      );
                    })()}
                  </div>
                </section>
              )}
              {canCreatePackage && (() => {
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
                const packageTotalIdr = form.price_total_idr || 0;
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
                const totalDiscount = totalListIdr - packageTotalIdr;
                if (rows.length > 0 && packageTotalIdr > 0 && totalListIdr > 0) {
                  const ratio = packageTotalIdr / totalListIdr;
                  return (
                    <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 space-y-2">
                      <p className="text-sm font-semibold text-slate-800">Kalkulasi diskon (otomatis dari harga total paket & kurs)</p>
                      <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                        {rows.map((r, i) => {
                          const allocated = Math.round(r.listIdr * ratio);
                          const discount = r.listIdr - allocated;
                          const pct = r.listIdr > 0 ? Math.round((discount / r.listIdr) * 100) : 0;
                          return (
                            <div key={i} className="py-1.5 border-b border-slate-200/80">
                              <div className="text-slate-700 font-medium truncate">{r.label}</div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                List: {formatPrice(r.listIdr, 'IDR')} → Alokasi: {formatPrice(allocated, 'IDR')} · Diskon: {formatPrice(discount, 'IDR')} ({pct}%)
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm font-medium">
                        <span>Total list: {formatPrice(totalListIdr, 'IDR')}</span>
                        <span>Total paket: {formatPrice(packageTotalIdr, 'IDR')}</span>
                        <span className="text-amber-700">Total diskon: {formatPrice(totalDiscount, 'IDR')}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              {editingPackage && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Diskon (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.discountPercent || ''}
                      onChange={(e) => setForm((f) => ({ ...f, discountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="0"
                    />
                  </div>
                  {form.discountPercent > 0 && (
                    <div className="rounded-lg bg-slate-50 p-3 text-sm">
                      <span className="text-slate-600">Harga setelah diskon (IDR): </span>
                      <span className="font-semibold text-emerald-600">
                        {formatPrice(getPriceAfterDiscount(form.price_total_idr || 0, form.discountPercent), 'IDR')}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={closeModal} disabled={saving}>Batal</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Menyimpan...' : editingPackage ? 'Simpan perubahan' : 'Simpan paket'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackagesPage;
