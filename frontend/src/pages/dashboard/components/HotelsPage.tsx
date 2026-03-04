import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Hotel as HotelIcon,
  Plus,
  Search,
  MapPin,
  Bed,
  Edit,
  Trash2,
  XCircle,
  ShoppingCart,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import { StatCard, Autocomplete, Input, PriceInput, PriceCurrencyField, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ModalBoxLg, ContentLoading, CONTENT_LOADING_MESSAGE } from '../../../components/common';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { TableColumn } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import HotelWorkPage from './HotelWorkPage';
import { productsApi, adminPusatApi, businessRulesApi } from '../../../services/api';
import type { HotelSeason } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import { getPriceTripleForTable } from '../../../utils';
import { CURRENCY_OPTIONS } from '../../../utils/constants';

const ROOM_TYPES = ['single', 'double', 'triple', 'quad', 'quint'] as const;
const ROOM_TYPE_LABELS: Record<string, string> = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };
const DEFAULT_ROOM = { quantity: 0, price: 0 };

/** Room breakdown: quantity & price per type */
export type RoomBreakdown = Record<string, { quantity: number; price: number }>;

/** Product hotel dari API (products type=hotel dengan harga) */
export interface HotelProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  meta?: {
    room_types?: string[];
    location?: string;
    /** Tipe: allotment / non allotment */
    allotment_type?: 'allotment' | 'non_allotment';
    /** Meal: fullboard / room only */
    meal_plan?: 'fullboard' | 'room_only';
    currency?: string;
    meal_price?: number;
    meal_price_type?: 'per_day' | 'per_trip';
    room_price_type?: 'per_day' | 'per_lasten';
    pricing_mode?: 'single' | 'per_type';
  } | null;
  is_active: boolean;
  price_general?: number | null;
  price_branch?: number | null;
  price_special?: number | null;
  currency?: string;
  special_prices_count?: number;
  /** Jumlah & harga per tipe kamar (dari backend) */
  room_breakdown?: RoomBreakdown;
  prices_by_room?: RoomBreakdown;
}

type HotelsPageProps = {
  embedInProducts?: boolean;
  /** When set, open the seasons modal for this hotel (e.g. from calendar "add room"). Cleared after opening. */
  openSeasonsForHotelId?: string | null;
  refreshTrigger?: number;
  /** Saat embed: kontrol buka/tutup panel filter dari parent (header) */
  embedFilterOpen?: boolean;
  embedFilterOnToggle?: () => void;
  onFilterActiveChange?: (active: boolean) => void;
};

const HotelsPage: React.FC<HotelsPageProps> = ({
  embedInProducts,
  openSeasonsForHotelId,
  refreshTrigger,
  embedFilterOpen,
  embedFilterOnToggle,
  onFilterActiveChange
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { addItem: addDraftItem } = useOrderDraft();
  const [hotels, setHotels] = useState<HotelProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<'all' | 'makkah' | 'madinah'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHotel, setEditingHotel] = useState<HotelProduct | null>(null);
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Form Tambah/Edit Hotel: hanya nama, lokasi, type allotment, meal plan */
  const [addForm, setAddForm] = useState({
    name: '',
    location: 'makkah' as 'makkah' | 'madinah',
    allotment_type: 'allotment' as 'allotment' | 'non_allotment',
    meal_plan: 'fullboard' as 'fullboard' | 'room_only'
  });
  /** Form Pengaturan Jumlah Kamar: jumlah + harga kamar, harga makan, mata uang */
  const [quantityModalPriceForm, setQuantityModalPriceForm] = useState({
    currency: 'IDR' as 'IDR' | 'SAR' | 'USD',
    meal_price: 0,
    meal_price_type: 'per_day' as 'per_day' | 'per_trip',
    room_price_type: 'per_day' as 'per_day' | 'per_lasten',
    pricing_mode: 'single' as 'single' | 'per_type',
    single_price: 0,
    rooms: { single: { ...DEFAULT_ROOM }, double: { ...DEFAULT_ROOM }, triple: { ...DEFAULT_ROOM }, quad: { ...DEFAULT_ROOM }, quint: { ...DEFAULT_ROOM } }
  });
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [seasonsModalHotel, setSeasonsModalHotel] = useState<HotelProduct | null>(null);
  const [seasonsList, setSeasonsList] = useState<HotelSeason[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [seasonForm, setSeasonForm] = useState<{ name: string; start_date: string; end_date: string }>({ name: '', start_date: '', end_date: '' });
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [inventoryForSeason, setInventoryForSeason] = useState<{ seasonId: string; seasonName: string } | null>(null);
  const [inventoryRows, setInventoryRows] = useState<{ room_type: string; total_rooms: number }[]>([]);
  /** Nilai tampilan input inventori (string agar "0" bisa dikosongkan) */
  const [inventoryInputs, setInventoryInputs] = useState<Record<string, string>>({});
  const [inventorySaving, setInventorySaving] = useState(false);
  /** Pengaturan jumlah kamar: global (satu set untuk semua bulan) vs per musim */
  const [hotelAvailabilityMode, setHotelAvailabilityMode] = useState<'global' | 'per_season'>('per_season');
  const [globalRoomInventory, setGlobalRoomInventory] = useState<Record<string, number>>({ single: 0, double: 0, triple: 0, quad: 0, quint: 0 });
  const [hotelAvailabilityConfigLoading, setHotelAvailabilityConfigLoading] = useState(false);
  const [hotelAvailabilityConfigSaving, setHotelAvailabilityConfigSaving] = useState(false);
  /** Modal Pengaturan Jumlah: ubah jumlah kamar (bisa ditambah saat full maupun available) */
  /** Jumlah kamar per tipe (string agar input bisa dikosongkan lalu diisi ulang) */
  const [quantityForm, setQuantityForm] = useState<Record<string, string>>({});
  const [quantityFormLoading, setQuantityFormLoading] = useState(false);
  const [quantityFormSaving, setQuantityFormSaving] = useState(false);
  /** Availability realtime per hotel (rentang 30 hari): mengikuti pilihan Semua jumlah kamar atau Per musim */
  type AvailabilityData = {
    availability_mode?: 'global' | 'per_season';
    byRoomType: Record<string, number>;
    byDate?: Record<string, Record<string, { total: number; booked: number; available: number }>>;
  };
  const [availabilityByHotelId, setAvailabilityByHotelId] = useState<Record<string, AvailabilityData | 'loading' | null>>({});
  const [availabilityPopupHotelId, setAvailabilityPopupHotelId] = useState<string | null>(null);
  /** Popup "Tambah jumlah kamar" di dalam popup Ketersediaan per tanggal (tanggal full) */
  type AvailabilityAddQuantity = { dateStr: string; seasonId: string; seasonName: string; roomTypes: Record<string, { total: number; booked: number; available: number }> };
  const [availabilityAddQuantity, setAvailabilityAddQuantity] = useState<AvailabilityAddQuantity | null>(null);
  const [availabilityAddQuantityInputs, setAvailabilityAddQuantityInputs] = useState<Record<string, string>>({});
  const [availabilityAddQuantitySaving, setAvailabilityAddQuantitySaving] = useState(false);

  const canAddHotel = user?.role === 'super_admin' || user?.role === 'admin_pusat' || user?.role === 'role_accounting';
  /** Owner tidak boleh edit/hapus product; hanya role yang diizinkan backend */
  const canEditProduct = ['super_admin', 'admin_pusat', 'role_accounting'].includes(user?.role ?? '');
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const canShowProductActions = ['owner', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'role_accounting', 'super_admin'].includes(user?.role ?? '');

  useEffect(() => {
    if (openSeasonsForHotelId && hotels.length > 0) {
      const hotel = hotels.find((h) => h.id === openSeasonsForHotelId);
      if (hotel) {
        setSeasonsModalHotel(hotel);
        setSeasonForm({ name: '', start_date: '', end_date: '' });
        setEditingSeasonId(null);
        setInventoryForSeason(null);
        loadUnifiedModalData(hotel);
      }
    }
  }, [openSeasonsForHotelId, hotels]);

  /** Load data untuk modal terpadu (config + musim + product untuk jumlah & harga) */
  const loadUnifiedModalData = (hotel: HotelProduct) => {
    setHotelAvailabilityConfigLoading(true);
    Promise.all([
      adminPusatApi.getHotelAvailabilityConfig(hotel.id),
      adminPusatApi.listSeasons(hotel.id),
      productsApi.getById(hotel.id)
    ])
      .then(([configRes, seasonsRes, productRes]) => {
        const configData = (configRes.data as { data?: { mode: 'global' | 'per_season'; global_room_inventory?: Record<string, number> } })?.data;
        if (configData) {
          setHotelAvailabilityMode(configData.mode || 'per_season');
          setGlobalRoomInventory(configData.global_room_inventory || { single: 0, double: 0, triple: 0, quad: 0, quint: 0 });
        }
        setSeasonsList((seasonsRes.data as { data?: HotelSeason[] })?.data ?? []);
        const data = (productRes.data as { data?: ProductDetail })?.data;
        const meta = (data?.meta as Record<string, unknown>) || {};
        const avMeta = (data?.ProductAvailability?.meta as Record<string, number>) || {};
        const roomMeta = (meta.room_types as Record<string, number>) || {};
        const fromBreakdown = hotel.room_breakdown || hotel.prices_by_room || {};
        const initial: Record<string, string> = {};
        ROOM_TYPES.forEach((rt) => {
          const num = Number(avMeta[rt] ?? roomMeta?.[rt] ?? fromBreakdown[rt]?.quantity ?? 0) || 0;
          initial[rt] = String(num);
        });
        setQuantityForm(initial);
        const prices = (data?.ProductPrices as ProductPriceItem[]) || [];
        const generalPrices = prices.filter((p) => !p.branch_id && !p.owner_id);
        const refCur = (meta.currency as 'IDR' | 'SAR' | 'USD') || generalPrices.find((p) => (p.meta?.reference_currency === 'IDR' || p.meta?.reference_currency === 'SAR' || p.meta?.reference_currency === 'USD'))?.meta?.reference_currency as 'IDR' | 'SAR' | 'USD' | undefined || (generalPrices[0]?.currency as 'IDR' | 'SAR' | 'USD' | undefined) || 'IDR';
        const pricesInRefCur = generalPrices.filter((p) => p.currency === refCur);
        const byRoomMeal: Record<string, number> = {};
        pricesInRefCur.forEach((p) => {
          const rt = (p.meta?.room_type as string) || 'single';
          const withMeal = p.meta?.with_meal === true;
          byRoomMeal[`${rt}_${withMeal}`] = Number(p.amount) || 0;
        });
        const mealPrice = Number(meta.meal_price) || 0;
        const rooms = { single: { ...DEFAULT_ROOM }, double: { ...DEFAULT_ROOM }, triple: { ...DEFAULT_ROOM }, quad: { ...DEFAULT_ROOM }, quint: { ...DEFAULT_ROOM } };
        ROOM_TYPES.forEach((rt) => {
          const qty = Number(roomMeta[rt]) || 0;
          const basePrice = byRoomMeal[`${rt}_false`] ?? (byRoomMeal[`${rt}_true`] != null ? byRoomMeal[`${rt}_true`] - mealPrice : 0);
          rooms[rt] = { quantity: qty, price: basePrice || 0 };
        });
        const firstPrice = pricesInRefCur[0] || generalPrices[0];
        const pricingMode = (meta.pricing_mode as 'single' | 'per_type') || 'single';
        const singlePrice = pricingMode === 'single' && firstPrice ? Number(firstPrice.amount) || 0 : 0;
        setQuantityModalPriceForm({
          currency: refCur,
          meal_price: mealPrice,
          meal_price_type: (meta.meal_price_type as 'per_day' | 'per_trip') || 'per_day',
          room_price_type: (meta.room_price_type as 'per_day' | 'per_lasten') || 'per_day',
          pricing_mode: pricingMode,
          single_price: singlePrice || (rooms.single?.price ?? 0),
          rooms
        });
      })
      .catch(() => {})
      .finally(() => setHotelAvailabilityConfigLoading(false));
  };

  /** Buka satu modal: Jumlah Kamar & Musim (gabungan Pengaturan Jumlah + Data per Musim) */
  const handleOpenUnifiedQuantityAndSeasonsModal = (hotel: HotelProduct) => {
    if (!canAddHotel) return;
    setSeasonsModalHotel(hotel);
    setSeasonForm({ name: '', start_date: '', end_date: '' });
    setEditingSeasonId(null);
    setInventoryForSeason(null);
    loadUnifiedModalData(hotel);
  };

  useEffect(() => {
    if (openSeasonsForHotelId && hotels.length > 0) {
      const hotel = hotels.find((h) => h.id === openSeasonsForHotelId);
      if (hotel) {
        setSeasonsModalHotel(hotel);
        setSeasonForm({ name: '', start_date: '', end_date: '' });
        setEditingSeasonId(null);
        setInventoryForSeason(null);
        loadUnifiedModalData(hotel);
      }
    }
  }, [openSeasonsForHotelId, hotels]);

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
  const [limit, setLimit] = useState(100);
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [filterIncludeInactive, setFilterIncludeInactive] = useState<'false' | 'true'>('false');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const lastFilterKeyRef = useRef<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchProducts = useCallback(() => {
    const filterKey = `${debouncedSearchTerm}|${filterIncludeInactive}`;
    let pageToUse = page;
    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      setPage(1);
      pageToUse = 1;
    }
    setLoading(true);
    setError(null);
    const params = { type: 'hotel' as const, with_prices: 'true' as const, include_inactive: filterIncludeInactive, limit, page: pageToUse, sort_by: sortBy, sort_order: sortOrder, ...(debouncedSearchTerm.trim() ? { name: debouncedSearchTerm.trim() } : {}), ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' as const } : {}) };
    productsApi
      .list(params)
      .then((res) => {
        if (res.data?.data) setHotels(res.data.data as HotelProduct[]);
        const p = (res.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(p || (res.data?.data ? { total: (res.data.data as unknown[]).length, page: 1, limit: (res.data.data as unknown[]).length, totalPages: 1 } : null));
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Gagal memuat data hotel');
        setPagination(null);
      })
      .finally(() => setLoading(false));
  }, [page, limit, sortBy, sortOrder, user?.role, filterIncludeInactive, debouncedSearchTerm]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (embedInProducts && refreshTrigger != null && refreshTrigger > 0) fetchProducts();
  }, [embedInProducts, refreshTrigger]);

  const filteredHotels = hotels.filter((hotel: HotelProduct) => {
    const loc = hotel.meta?.location?.toLowerCase();
    const matchesLocation =
      locationFilter === 'all' ||
      (loc && (loc === 'makkah' || loc === 'madinah') && loc === locationFilter);
    return locationFilter === 'all' || matchesLocation;
  });

  /** Fetch availability realtime untuk setiap hotel di halaman (rentang 30 hari), + refresh tiap 60s */
  const availabilityFrom = (() => { const d = new Date(); return d.toISOString().slice(0, 10); })();
  const availabilityTo = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
  const hotelIdsKey = hotels.map((h) => h.id).join(',');
  useEffect(() => {
    const list = filteredHotels.length ? filteredHotels : hotels;
    if (list.length === 0) return;
    const ids = list.map((h) => h.id);
    setAvailabilityByHotelId((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = 'loading'; });
      return next;
    });
    list.forEach((h) => {
      productsApi.getAvailability(h.id, { from: availabilityFrom, to: availabilityTo })
        .then((res) => {
          const data = (res.data as { data?: { availability_mode?: 'global' | 'per_season'; byRoomType?: Record<string, number>; byDate?: Record<string, Record<string, { total: number; booked: number; available: number }>> } })?.data;
          if (!data?.byRoomType) {
            setAvailabilityByHotelId((prev) => ({ ...prev, [h.id]: null }));
            return;
          }
          setAvailabilityByHotelId((prev) => ({
            ...prev,
            [h.id]: { availability_mode: data.availability_mode, byRoomType: data.byRoomType!, byDate: data.byDate ?? {} }
          }));
        })
        .catch(() => setAvailabilityByHotelId((prev) => ({ ...prev, [h.id]: null })));
    });
  }, [hotelIdsKey, availabilityFrom, availabilityTo]);

  const refetchAvailabilityForHotel = useCallback((productId: string) => {
    productsApi.getAvailability(productId, { from: availabilityFrom, to: availabilityTo })
      .then((res) => {
        const data = (res.data as { data?: { availability_mode?: 'global' | 'per_season'; byRoomType?: Record<string, number>; byDate?: Record<string, Record<string, { total: number; booked: number; available: number }>> } })?.data;
        if (!data?.byRoomType) return;
        setAvailabilityByHotelId((prev) => ({ ...prev, [productId]: { availability_mode: data.availability_mode, byRoomType: data.byRoomType!, byDate: data.byDate ?? {} } }));
      })
      .catch(() => {});
  }, [availabilityFrom, availabilityTo]);

  useEffect(() => {
    const t = setInterval(() => {
      const list = filteredHotels.length ? filteredHotels : hotels;
      list.forEach((h) => {
        productsApi.getAvailability(h.id, { from: availabilityFrom, to: availabilityTo })
          .then((res) => {
            const data = (res.data as { data?: { availability_mode?: 'global' | 'per_season'; byRoomType?: Record<string, number>; byDate?: Record<string, Record<string, { total: number; booked: number; available: number }>> } })?.data;
            if (!data?.byRoomType) return;
            setAvailabilityByHotelId((prev) => ({
              ...prev,
              [h.id]: { availability_mode: data.availability_mode, byRoomType: data.byRoomType!, byDate: data.byDate ?? {} }
            }));
          })
          .catch(() => {});
      });
    }, 60000);
    return () => clearInterval(t);
  }, [hotelIdsKey, availabilityFrom, availabilityTo]);

  if (user?.role === 'role_hotel' && !embedInProducts) {
    return <HotelWorkPage />;
  }

  const stats = [
    {
      label: 'Total Hotels',
      value: hotels.length,
      icon: <HotelIcon className="w-5 h-5" />,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      label: 'Makkah',
      value: hotels.filter((h: HotelProduct) => h.meta?.location === 'makkah').length,
      icon: <MapPin className="w-5 h-5" />,
      color: 'from-emerald-500 to-teal-500'
    },
    {
      label: 'Madinah',
      value: hotels.filter((h: HotelProduct) => h.meta?.location === 'madinah').length,
      icon: <MapPin className="w-5 h-5" />,
      color: 'from-purple-500 to-pink-500'
    },
    {
      label: 'Aktif',
      value: hotels.filter((h: HotelProduct) => h.is_active).length,
      icon: <Bed className="w-5 h-5" />,
      color: 'from-orange-500 to-red-500'
    }
  ];

  /** Agregat ketersediaan (30 hari) dari semua hotel yang sudah di-load */
  const availabilityStats = (() => {
    const list = filteredHotels.length ? filteredHotels : hotels;
    const byRoom: Record<string, number> = { single: 0, double: 0, triple: 0, quad: 0, quint: 0 };
    let total = 0;
    list.forEach((h) => {
      const av = availabilityByHotelId[h.id];
      if (av && typeof av === 'object' && av.byRoomType) {
        (Object.keys(av.byRoomType) as (keyof typeof byRoom)[]).forEach((rt) => {
          if (byRoom[rt] !== undefined) {
            byRoom[rt] += av.byRoomType[rt] ?? 0;
            total += av.byRoomType[rt] ?? 0;
          }
        });
      }
    });
    return { byRoom, total };
  })();

  const tableColumns: TableColumn[] = [
    { id: 'code', label: 'Kode', align: 'left', sortable: true },
    { id: 'name', label: 'Nama Hotel', align: 'left', sortable: true },
    { id: 'location', label: 'Lokasi', align: 'left' },
    { id: 'type_meal', label: 'Type / Meal', align: 'left' },
    { id: 'currency', label: 'Mata Uang', align: 'center' },
    { id: 'meal', label: 'Harga Makan (IDR · SAR · USD)', align: 'left' },
    { id: 'room_price_type', label: 'Harga Kamar (IDR · SAR · USD)', align: 'left' },
    { id: 'availability', label: 'Ketersediaan (realtime)', align: 'left' },
    { id: 'status', label: 'Status', align: 'center', sortable: true, sortKey: 'is_active' },
    ...(canShowProductActions ? [{ id: 'actions', label: 'Aksi', align: 'center' as const }] : [])
  ];

  const handleOpenAdd = () => {
    setEditingHotel(null);
    setAddForm({
      name: '',
      location: 'makkah',
      allotment_type: 'allotment',
      meal_plan: 'fullboard'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = async (hotel: HotelProduct) => {
    if (!canEditProduct) return;
    setEditingHotel(hotel);
    setEditFormLoading(true);
    setShowAddModal(true);
    try {
      const res = await productsApi.getById(hotel.id);
      const data = (res.data as { data?: ProductDetail })?.data;
      if (!data) throw new Error('Data hotel tidak ditemukan');
      const meta = (data.meta as Record<string, unknown>) || {};
      setAddForm({
        name: data.name || '',
        location: (meta.location as 'makkah' | 'madinah') || 'makkah',
        allotment_type: (meta.allotment_type as 'allotment' | 'non_allotment') || 'allotment',
        meal_plan: (meta.meal_plan as 'fullboard' | 'room_only') || 'fullboard'
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal memuat data hotel', 'error');
      setShowAddModal(false);
    } finally {
      setEditFormLoading(false);
    }
  };

  type ProductDetail = {
    name?: string;
    meta?: Record<string, unknown>;
    ProductPrices?: ProductPriceItem[];
    ProductAvailability?: { meta?: Record<string, number> };
  };
  type ProductPriceItem = { id: string; amount: number; currency?: string; branch_id?: string; owner_id?: string; meta?: { room_type?: string; with_meal?: boolean; reference_currency?: string } };

  /** Simpan jumlah kamar + harga dari modal terpadu (mode Semua jumlah kamar); pakai seasonsModalHotel */
  const handleSaveQuantityFromUnifiedModal = async () => {
    const hotel = seasonsModalHotel;
    if (!hotel) return;
    const parseQty = (v: string | undefined) => Math.max(0, parseInt(String(v || ''), 10) || 0);
    const totalQty = ROOM_TYPES.reduce((s, rt) => s + parseQty(quantityForm[rt]), 0);
    const roomMeta: Record<string, number> = {};
    ROOM_TYPES.forEach((rt) => { roomMeta[rt] = parseQty(quantityForm[rt]); });
    const pf = quantityModalPriceForm;
    setQuantityFormSaving(true);
    try {
      const existingMeta = (hotel.meta as Record<string, unknown>) || {};
      await productsApi.update(hotel.id, {
        meta: {
          ...existingMeta,
          currency: pf.currency,
          meal_price: pf.meal_price,
          meal_price_type: pf.meal_price_type,
          room_price_type: pf.room_price_type,
          pricing_mode: pf.pricing_mode,
          room_types: ROOM_TYPES
        }
      });

      const pricesRes = await productsApi.listPrices({ product_id: hotel.id });
      const prices = (pricesRes.data as { data?: ProductPriceItem[] })?.data ?? [];
      const generalPrices = prices.filter((p) => !p.branch_id && !p.owner_id);
      for (const p of generalPrices) {
        await productsApi.deletePrice(p.id);
      }
      const pricesToCreate: Array<{ roomType: string; price: number }> = [];
      if (pf.pricing_mode === 'single') {
        if (pf.single_price > 0) {
          ROOM_TYPES.forEach((rt) => pricesToCreate.push({ roomType: rt, price: pf.single_price }));
        }
      } else {
        ROOM_TYPES.forEach((rt) => {
          const p = pf.rooms[rt].price;
          if (p > 0) pricesToCreate.push({ roomType: rt, price: p });
        });
      }
      for (const { roomType, price } of pricesToCreate) {
        const tripleRoom = fillFromSource(pf.currency, price, currencyRates);
        await productsApi.createPrice({
          product_id: hotel.id,
          branch_id: null,
          owner_id: null,
          amount_idr: tripleRoom.idr,
          amount_sar: tripleRoom.sar,
          amount_usd: tripleRoom.usd,
          reference_currency: pf.currency,
          meta: { room_type: roomType, with_meal: false }
        });
        const tripleWithMeal = fillFromSource(pf.currency, price + pf.meal_price, currencyRates);
        await productsApi.createPrice({
          product_id: hotel.id,
          branch_id: null,
          owner_id: null,
          amount_idr: tripleWithMeal.idr,
          amount_sar: tripleWithMeal.sar,
          amount_usd: tripleWithMeal.usd,
          reference_currency: pf.currency,
          meta: { room_type: roomType, with_meal: true }
        });
      }

      await adminPusatApi.setProductAvailability(hotel.id, { quantity: totalQty, meta: { room_types: roomMeta } });
      await adminPusatApi.setHotelAvailabilityConfig(hotel.id, { availability_mode: 'global' });
      showToast('Jumlah kamar, harga, dan pengaturan (semua bulan) disimpan', 'success');
      fetchProducts();
      setSeasonsModalHotel(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setQuantityFormSaving(false);
    }
  };

  const handleDeleteHotel = async (hotel: HotelProduct) => {
    if (!canAddHotel) return;
    if (!window.confirm(`Hapus hotel "${hotel.name}"? Data akan dihapus permanen dari database.`)) return;
    try {
      await productsApi.delete(hotel.id);
      showToast('Hotel berhasil dihapus', 'success');
      setHotels((prev) => prev.filter((h) => h.id !== hotel.id));
      fetchProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menghapus hotel', 'error');
    }
  };

  const handleAddHotel = async () => {
    if (!addForm.name.trim()) {
      showToast('Nama hotel wajib', 'error');
      return;
    }
    setSaving(true);
    try {
      const meta: Record<string, unknown> = {
        location: addForm.location,
        room_types: ROOM_TYPES,
        allotment_type: addForm.allotment_type,
        meal_plan: addForm.meal_plan
      };
      await productsApi.createHotel({
        name: addForm.name.trim(),
        meta
      });
      showToast('Hotel berhasil ditambahkan. Gunakan "Pengaturan Jumlah" untuk mengisi jumlah kamar, harga, dan mata uang.', 'success');
      setShowAddModal(false);
      fetchProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menambah hotel', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditHotel = async () => {
    if (!editingHotel) return;
    if (!addForm.name.trim()) {
      showToast('Nama hotel wajib', 'error');
      return;
    }
    setSaving(true);
    try {
      const existingMeta = (editingHotel.meta as Record<string, unknown>) || {};
      const meta: Record<string, unknown> = {
        ...existingMeta,
        location: addForm.location,
        room_types: existingMeta.room_types ?? ROOM_TYPES,
        allotment_type: addForm.allotment_type,
        meal_plan: addForm.meal_plan
      };
      await productsApi.update(editingHotel.id, { name: addForm.name.trim(), meta });
      showToast('Hotel berhasil diubah', 'success');
      setShowAddModal(false);
      setEditingHotel(null);
      fetchProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal mengubah hotel', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (p: HotelProduct) => {
    const amount = p.price_branch ?? p.price_general ?? p.price_special ?? 0;
    const cur = p.currency || 'IDR';
    if (amount) return `${Number(amount).toLocaleString('id-ID')} ${cur}`;
    return '-';
  };

  return (
    <div className="space-y-5">
      {!embedInProducts && (
        <PageHeader
          title="Hotel"
          subtitle="Harga & ketersediaan dikelola Admin Pusat"
          right={
            <AutoRefreshControl onRefresh={fetchProducts} disabled={loading} />
          }
        />
      )}

      {/* Stat cards - ringkas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, index) => (
          <StatCard
            key={index}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            iconClassName={`bg-gradient-to-br ${stat.color} text-white`}
          />
        ))}
      </div>

      {/* Stat cards ketersediaan (realtime, 30 hari) — pakai StatCard agar seragam */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Statistik Ketersediaan Kamar (30 hari ke depan)</h3>
        <p className="text-xs text-slate-500 mb-2">Data per hotel mengikuti pilihan di Jumlah Kamar &amp; Musim (Semua jumlah kamar / Per musim).</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <StatCard icon={<Bed className="w-5 h-5" />} label="Total Tersedia" value={availabilityStats.total} subtitle="kamar" />
          {ROOM_TYPES.map((rt) => (
            <StatCard key={rt} icon={<Bed className="w-5 h-5" />} label={rt} value={availabilityStats.byRoom[rt] ?? 0} subtitle="tersedia" />
          ))}
        </div>
      </div>

      {/* Cari & filter + tabel dalam satu card */}
      <Card>
        <CardSectionHeader
          icon={<HotelIcon className="w-6 h-6" />}
          title="Daftar Hotel"
          subtitle={`${filteredHotels.length} dari ${pagination?.total ?? hotels.length} hotel. Ketersediaan (realtime) mengikuti pilihan di Jumlah Kamar & Musim. Saat order dibooking, kamar berkurang. Klik kolom Ketersediaan untuk detail per tanggal.`}
          right={canAddHotel ? (
            <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={handleOpenAdd}>
              <Plus className="w-4 h-4" />
              Tambah Hotel
            </Button>
          ) : undefined}
        />
        <div className="pb-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)] gap-4 items-end">
            <Input
              label="Cari nama hotel"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama hotel..."
              icon={<Search className="w-4 h-4" />}
              fullWidth
            />
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLocationFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${locationFilter === 'all' ? 'bg-btn text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setLocationFilter('makkah')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${locationFilter === 'makkah' ? 'bg-btn text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Makkah
            </button>
            <button
              type="button"
              onClick={() => setLocationFilter('madinah')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${locationFilter === 'madinah' ? 'bg-btn text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Madinah
            </button>
          </div>
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
          data={filteredHotels}
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
          renderRow={(hotel: HotelProduct) => {
            const cur = (hotel.meta?.currency || hotel.currency || 'IDR') as 'IDR' | 'SAR' | 'USD';
            const mealPrice = hotel.meta?.meal_price ?? 0;
            const mealType = hotel.meta?.meal_price_type === 'per_trip' ? 'Per trip' : hotel.meta?.meal_price_type === 'per_day' ? 'Per hari' : '-';
            const roomPriceType = hotel.meta?.room_price_type === 'per_lasten' ? 'Per lasten' : hotel.meta?.room_price_type === 'per_day' ? 'Per hari' : '-';
            const pricingMode = hotel.meta?.pricing_mode === 'per_type' ? 'Per tipe' : hotel.meta?.pricing_mode === 'single' ? 'Satu harga' : '-';
            const breakdown = hotel.room_breakdown || hotel.prices_by_room || {};
            const isSinglePrice = hotel.meta?.pricing_mode === 'single';
            // Harga Kamar column: show room-only (breakdown is room-only from API)
            const singlePriceVal = isSinglePrice ? (Number(breakdown.single?.price ?? hotel.price_branch ?? hotel.price_general ?? 0) || 0) : 0;
            const tripleMeal = fillFromSource(cur, mealPrice, currencyRates);
            const tripleRoom = fillFromSource(cur, singlePriceVal, currencyRates);
            const avail = availabilityByHotelId[hotel.id];
            return (
              <tr key={hotel.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-200 last:border-b-0">
                <td className="px-4 py-3.5 text-sm text-slate-600 font-mono align-middle">{hotel.code || '-'}</td>
                <td className="px-4 py-3.5 align-middle">
                  <p className="font-semibold text-slate-900">{hotel.name}</p>
                  {hotel.description && (
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{hotel.description}</p>
                  )}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <span className="inline-flex items-center gap-1 capitalize text-slate-700 text-sm">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {hotel.meta?.location || '-'}
                  </span>
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <div className="text-xs text-slate-600">
                    <span className="font-medium">{hotel.meta?.allotment_type === 'non_allotment' ? 'Non allotment' : hotel.meta?.allotment_type === 'allotment' ? 'Allotment' : '-'}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span>{hotel.meta?.meal_plan === 'room_only' ? 'Room only' : hotel.meta?.meal_plan === 'fullboard' ? 'Fullboard' : '-'}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-center text-sm text-slate-700 align-middle">{cur}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700 align-top">
                  {(() => {
                    const t = getPriceTripleForTable(tripleMeal.idr, tripleMeal.sar, tripleMeal.usd);
                    if (!t.hasPrice) return <><span className="text-slate-400">–</span><span className="text-slate-400 text-xs block">{mealType}</span></>;
                    return (
                      <>
                        <div className="tabular-nums font-medium">{t.idrText}</div>
                        <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                        <span className="text-slate-400 text-xs block mt-0.5">per orang · {mealType}</span>
                      </>
                    );
                  })()}
                </td>
                <td className="px-4 py-3.5 text-sm text-slate-700 align-top">
                  {isSinglePrice ? (
                    (() => {
                      const t = getPriceTripleForTable(tripleRoom.idr, tripleRoom.sar, tripleRoom.usd);
                      if (!t.hasPrice) return <><span className="text-slate-400">–</span><span className="text-slate-500 text-xs block">{roomPriceType}</span></>;
                      return (
                        <>
                          <div className="tabular-nums font-semibold">{t.idrText}</div>
                          <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                          <span className="text-slate-500 text-xs block mt-0.5">per kamar · {roomPriceType}</span>
                        </>
                      );
                    })()
                  ) : (
                    (() => {
                      const repPrice = Number(breakdown.single?.price ?? breakdown.double?.price ?? breakdown.triple?.price ?? breakdown.quad?.price ?? breakdown.quint?.price ?? 0) || 0;
                      const tr = fillFromSource(cur, repPrice, currencyRates);
                      const t = getPriceTripleForTable(tr.idr, tr.sar, tr.usd);
                      if (!t.hasPrice) return <><span className="text-slate-400">–</span><span className="text-slate-500 text-xs block">{roomPriceType}</span></>;
                      return (
                        <>
                          <div className="tabular-nums font-medium">{t.idrText}</div>
                          <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                          <span className="text-slate-500 text-xs block mt-0.5">per kamar · Per tipe · {roomPriceType}</span>
                        </>
                      );
                    })()
                  )}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  {avail === 'loading' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-700 text-xs">{CONTENT_LOADING_MESSAGE}</div>
                  )}
                  {avail === null && <span className="text-slate-400 text-sm">—</span>}
                  {avail && typeof avail === 'object' && avail.byRoomType && (
                    <button
                      type="button"
                      onClick={() => setAvailabilityPopupHotelId(hotel.id)}
                      className="w-full text-left rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-emerald-50/80 hover:border-emerald-200 transition-colors p-2 group"
                      title="Klik untuk lihat tanggal dengan kamar tersedia"
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(avail.byRoomType).map(([rt, n]) => (
                          <div
                            key={rt}
                            className={`shrink-0 rounded-lg border px-2 py-1.5 min-w-[56px] ${n === 0 ? 'border-red-200 bg-red-50/80' : 'border-emerald-200 bg-emerald-50/80'}`}
                          >
                            <p className="text-[10px] font-medium text-slate-500 uppercase capitalize">{rt}</p>
                            {n === 0 ? (
                              <p className="text-xs font-bold text-red-600">Penuh</p>
                            ) : (
                              <p className="text-xs font-bold text-emerald-600 tabular-nums">{n}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5 group-hover:text-emerald-600">Klik untuk lihat per tanggal →</p>
                    </button>
                  )}
                </td>
                <td className="px-4 py-3.5 text-center align-middle">
                  <Badge variant={hotel.is_active ? 'success' : 'error'}>
                    {hotel.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </td>
                {canShowProductActions && (
                <td className="px-4 py-3.5 align-middle">
                  <div className="flex justify-center gap-1 flex-wrap">
                    {canAddToOrder && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-2"
                        onClick={() => {
                          const base = Number(hotel.price_branch ?? hotel.price_general ?? 0);
                          const cur = hotel.currency || 'IDR';
                          const s2i = currencyRates.SAR_TO_IDR ?? 4200;
                          const u2i = currencyRates.USD_TO_IDR ?? 15500;
                          const unit_price_idr = cur === 'SAR' ? base * s2i : cur === 'USD' ? base * u2i : base;
                          addDraftItem({
                            type: 'hotel',
                            product_id: hotel.id,
                            product_name: hotel.name,
                            unit_price_idr,
                            quantity: 1,
                            room_breakdown: [{ room_type: 'quad', quantity: 1, unit_price: unit_price_idr, with_meal: false }]
                          });
                          showToast('Hotel ditambahkan ke order. Isi tanggal check-in/out di form order.', 'success');
                        }}
                        title="Tambah ke order"
                        aria-label="Tambah ke order"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                    )}
                    {(canEditProduct || canAddHotel) ? (
                      <ActionsMenu
                        align="right"
                        items={[
                          ...(canEditProduct ? [{ id: 'edit', label: 'Edit', icon: <Edit className="w-4 h-4" />, onClick: () => handleOpenEdit(hotel) }] : []),
                          ...(canAddHotel ? [{ id: 'seasons', label: 'Jumlah Kamar & Musim', icon: <Bed className="w-4 h-4" />, onClick: () => handleOpenUnifiedQuantityAndSeasonsModal(hotel) }] : []),
                          ...(canAddHotel ? [{ id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteHotel(hotel), danger: true }] : []),
                        ].filter(Boolean) as ActionsMenuItem[]}
                      />
                    ) : null}
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

      {/* Popup Ketersediaan per tanggal: lebar, layout rapi, per tipe kamar */}
      {availabilityPopupHotelId && (() => {
        const hotel = hotels.find((h) => h.id === availabilityPopupHotelId) || filteredHotels.find((h) => h.id === availabilityPopupHotelId);
        const availData = availabilityPopupHotelId ? availabilityByHotelId[availabilityPopupHotelId] : null;
        const byDate = availData && typeof availData === 'object' && availData.byDate ? availData.byDate : {};
        const dateKeys = Object.keys(byDate).sort();
        const formatDateLabel = (s: string) => {
          const d = new Date(s + 'T12:00:00');
          return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        };
        const roomTypeLabels: Record<string, string> = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };
        const popupCurrency = (hotel?.currency || hotel?.meta?.currency || 'IDR') as 'IDR' | 'SAR' | 'USD';
        const popupCurrInfo = CURRENCY_OPTIONS.find((c) => c.id === popupCurrency) || CURRENCY_OPTIONS[0];
        const formatPrice = (n: number) => (n > 0 ? `${popupCurrInfo.symbol} ${Number(n).toLocaleString(popupCurrInfo.locale)}` : '—');
        const roomPriceTypeLabel = hotel?.meta?.room_price_type === 'per_lasten' ? 'Per lasten' : 'Per hari';
        const breakdown = hotel?.room_breakdown || hotel?.prices_by_room || {};
        const isSinglePrice = hotel?.meta?.pricing_mode === 'single';
        const singlePriceValue = isSinglePrice ? (Number(hotel?.price_branch ?? hotel?.price_general ?? 0) || (breakdown.single?.price ?? 0)) : 0;
        return (
          <Modal open onClose={() => setAvailabilityPopupHotelId(null)}>
            <ModalBoxLg className="relative">
              <ModalHeader
                title="Ketersediaan per tanggal"
                subtitle={<>{(hotel?.name ?? 'Hotel')} — data realtime per tipe kamar{availData && typeof availData === 'object' && availData.availability_mode && <span className="block mt-1">Mengikuti: <span className="font-medium">{availData.availability_mode === 'global' ? 'Semua jumlah kamar' : 'Per musim'}</span></span>}</>}
                icon={<Calendar className="w-5 h-5" />}
                onClose={() => setAvailabilityPopupHotelId(null)}
              />
              <ModalBody className="p-6 overflow-y-auto flex-1 min-h-0">
                {/* Harga Kamar Per hari — satu harga atau per tipe */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
                  <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
                    <h4 className="text-sm font-semibold text-slate-800">Harga Kamar {roomPriceTypeLabel}</h4>
                  </div>
                  <div className="px-4 py-3">
                    {isSinglePrice ? (
                      <p className="text-slate-700">
                        <span className="font-semibold tabular-nums">{formatPrice(singlePriceValue)}</span>
                        <span className="text-slate-500 text-sm ml-2">/ kamar · semua tipe</span>
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {ROOM_TYPES.map((rt) => {
                          const pr = breakdown[rt]?.price;
                          if (pr == null) return null;
                          return (
                            <span key={rt} className="inline-flex items-center gap-2">
                              <span className="text-slate-500 text-sm">{roomTypeLabels[rt]}:</span>
                              <span className="font-semibold tabular-nums text-slate-800">{formatPrice(pr)}</span>
                            </span>
                          );
                        })}
                        {ROOM_TYPES.every((rt) => breakdown[rt]?.price == null) && (
                          <span className="text-slate-400 text-sm">Belum diatur di Pengaturan Jumlah</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {dateKeys.length === 0 ? (
                  <div className="py-16 text-center rounded-2xl bg-slate-50 border border-slate-200">
                    <Calendar className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Belum ada data per tanggal</p>
                    <p className="text-slate-400 text-sm mt-1">Atur di <strong>Jumlah Kamar & Musim</strong>: pilih Semua jumlah kamar atau Per musim, lalu isi jumlah kamar.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Legenda & kode tipe — satu bar rapi */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Legenda:</span>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 h-5 rounded bg-emerald-200 border border-emerald-300" />
                        <span className="text-sm text-slate-700">Tipe ada kamar kosong</span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 h-5 rounded bg-red-200 border border-red-300" />
                        <span className="text-sm text-slate-700">Tipe full</span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 h-5 rounded bg-slate-100 border border-slate-200" />
                        <span className="text-sm text-slate-500">Tanpa musim</span>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-xs text-slate-500">Kode: S=Single · D=Double · T=Triple · Q=Quad · Qu=Quint</span>
                      {canAddHotel && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="text-xs text-emerald-600">Tanggal full: klik <Plus className="w-3 h-3 inline" /> di sel untuk tambah jumlah kamar</span>
                        </>
                      )}
                    </div>

                    {/* Satu tampilan: Kalender + detail per tanggal (tabel gabungan) */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <h4 className="text-sm font-semibold text-slate-800">Ketersediaan 30 hari</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Tanggal + jumlah tersedia per tipe kamar. Hijau = ada kosong, merah = full.</p>
                      </div>
                      <div className="overflow-auto max-h-[min(60vh,420px)]">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-slate-100 border-b-2 border-slate-200 z-10 shadow-sm">
                            <tr>
                              <th className="text-left py-3 px-3 font-semibold text-slate-700 w-[100px]">Tanggal</th>
                              {ROOM_TYPES.map((rt) => (
                                <th key={rt} className="text-center py-3 px-2 font-semibold text-slate-700 min-w-[72px]">{roomTypeLabels[rt] || rt}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dateKeys.map((dateStr, idx) => {
                              const day = byDate[dateStr] as (Record<string, { total?: number; booked?: number; available?: number }> & { _noSeason?: boolean; seasonId?: string; seasonName?: string }) | undefined;
                              const noSeason = day && (day as { _noSeason?: boolean })._noSeason;
                              const rec = noSeason ? null : (day as Record<string, { total?: number; booked?: number; available?: number }> | undefined);
                              const getAvail = (rt: string) => (rec && rec[rt] != null ? (rec[rt]?.available ?? 0) : 0);
                              const hasAvailable = !noSeason && rec && ROOM_TYPES.some((rt) => getAvail(rt) > 0);
                              const seasonId = !noSeason && day ? (day as { seasonId?: string }).seasonId : undefined;
                              const seasonName = !noSeason && day ? (day as { seasonName?: string }).seasonName : undefined;
                              const d = new Date(dateStr + 'T12:00:00');
                              const openAddQty = () => {
                                if (!rec || !seasonId || !availabilityPopupHotelId) return;
                                const roomTypes: Record<string, { total: number; booked: number; available: number }> = {};
                                ROOM_TYPES.forEach((rt) => {
                                  const r = rec[rt];
                                  roomTypes[rt] = r ? { total: r.total ?? 0, booked: r.booked ?? 0, available: r.available ?? 0 } : { total: 0, booked: 0, available: 0 };
                                });
                                setAvailabilityAddQuantity({ dateStr, seasonId, seasonName: seasonName || '', roomTypes });
                                const initial: Record<string, string> = {};
                                ROOM_TYPES.forEach((rt) => { initial[rt] = ''; });
                                setAvailabilityAddQuantityInputs(initial);
                              };
                              return (
                                <tr
                                  key={dateStr}
                                  className={`border-b border-slate-100 last:border-0 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-emerald-50/40`}
                                >
                                  <td className="py-2 px-3 align-middle">
                                    <div
                                      className={`inline-flex flex-col items-center justify-center rounded-xl border-2 min-w-[76px] py-2 px-2 ${
                                        noSeason
                                          ? 'bg-slate-50 border-slate-200 text-slate-400'
                                          : hasAvailable
                                            ? 'bg-emerald-50 border-emerald-200'
                                            : 'bg-red-50 border-red-200'
                                      }`}
                                    >
                                      <span className="text-[10px] uppercase tracking-wide text-slate-500">{d.toLocaleDateString('id-ID', { month: 'short' })}</span>
                                      <span className="text-xl font-bold tabular-nums text-slate-800 leading-none mt-0.5">{d.getDate()}</span>
                                      <span className="text-[10px] text-slate-500 mt-0.5">{d.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                                    </div>
                                  </td>
                                  {ROOM_TYPES.map((rt) => {
                                    const a = rec && rec[rt] != null ? (rec[rt]?.available ?? 0) : null;
                                    if (noSeason || a === null) {
                                      return <td key={rt} className="py-2 px-2 text-center align-middle text-slate-400">—</td>;
                                    }
                                    const isFull = a <= 0;
                                    const showAddBtn = canAddHotel && isFull && seasonId;
                                    return (
                                      <td key={rt} className="py-2 px-2 text-center align-middle">
                                        <div className="inline-flex items-center justify-center gap-1">
                                          <span
                                            className={`inline-flex items-center justify-center min-w-[44px] py-1.5 px-2 rounded-lg font-semibold tabular-nums text-sm ${
                                              a > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                            }`}
                                          >
                                            {a > 0 ? a : 'Full'}
                                          </span>
                                          {showAddBtn && (
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); openAddQty(); }}
                                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors shrink-0"
                                              title="Tambah jumlah kamar"
                                            >
                                              <Plus className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              {/* Sub-popup: Tambah jumlah kamar (di dalam popup Ketersediaan) */}
              {availabilityAddQuantity && availabilityPopupHotelId && (
                <div
                  className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 rounded-2xl"
                  onClick={() => !availabilityAddQuantitySaving && setAvailabilityAddQuantity(null)}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-lg font-semibold text-slate-900">Tambah jumlah kamar</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => !availabilityAddQuantitySaving && setAvailabilityAddQuantity(null)}
                        className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        <XCircle className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <p className="text-sm text-slate-600">
                        Tanggal <strong>{new Date(availabilityAddQuantity.dateStr + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                        {availabilityAddQuantity.seasonName && <> · Musim: <strong>{availabilityAddQuantity.seasonName}</strong></>}
                      </p>
                      <p className="text-xs text-slate-500">Isi jumlah tambahan per tipe. Total baru = total saat ini + tambahan.</p>
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Tipe</th>
                              <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Total</th>
                              <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Dipesan</th>
                              <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Tersedia</th>
                              <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Tambah</th>
                              <th className="text-center py-2.5 px-2 font-semibold text-slate-700">Total baru</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ROOM_TYPES.map((rt) => {
                              const r = availabilityAddQuantity.roomTypes[rt];
                              const total = r?.total ?? 0;
                              const booked = r?.booked ?? 0;
                              const available = r?.available ?? 0;
                              const add = Math.max(0, parseInt(availabilityAddQuantityInputs[rt] ?? '', 10) || 0);
                              const newTotal = total + add;
                              return (
                                <tr key={rt} className="border-b border-slate-100 last:border-0">
                                  <td className="py-2 px-3 font-medium text-slate-800 capitalize">{roomTypeLabels[rt] || rt}</td>
                                  <td className="py-2 px-2 text-center tabular-nums text-slate-700">{total}</td>
                                  <td className="py-2 px-2 text-center tabular-nums text-slate-600">{booked}</td>
                                  <td className={`py-2 px-2 text-center tabular-nums font-medium ${available <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{available}</td>
                                  <td className="py-2 px-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={availabilityAddQuantityInputs[rt] ?? ''}
                                      onChange={(e) => setAvailabilityAddQuantityInputs((prev) => ({ ...prev, [rt]: e.target.value }))}
                                      className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="py-2 px-2 text-center font-semibold tabular-nums text-slate-800">{newTotal}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
                      <Button variant="outline" size="sm" onClick={() => !availabilityAddQuantitySaving && setAvailabilityAddQuantity(null)} disabled={availabilityAddQuantitySaving}>
                        Batal
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={availabilityAddQuantitySaving}
                        onClick={async () => {
                          if (!availabilityPopupHotelId || !availabilityAddQuantity) return;
                          setAvailabilityAddQuantitySaving(true);
                          try {
                            const inventory = ROOM_TYPES.map((rt) => {
                              const current = availabilityAddQuantity.roomTypes[rt]?.total ?? 0;
                              const addVal = Math.max(0, parseInt(availabilityAddQuantityInputs[rt] ?? '', 10) || 0);
                              return { room_type: rt, total_rooms: current + addVal };
                            });
                            await adminPusatApi.setSeasonInventory(availabilityPopupHotelId, availabilityAddQuantity.seasonId, { inventory });
                            showToast('Inventori musim berhasil diperbarui', 'success');
                            setAvailabilityAddQuantity(null);
                            refetchAvailabilityForHotel(availabilityPopupHotelId);
                          } catch (e: unknown) {
                            const err = e as { response?: { data?: { message?: string } } };
                            showToast(err.response?.data?.message || 'Gagal menyimpan inventori', 'error');
                          } finally {
                            setAvailabilityAddQuantitySaving(false);
                          }
                        }}
                      >
                        {availabilityAddQuantitySaving ? 'Menyimpan…' : 'Simpan'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              </ModalBody>
            </ModalBoxLg>
          </Modal>
        );
      })()}

      {showAddModal && (
        <Modal open onClose={() => !saving && !editFormLoading && (setShowAddModal(false), setEditingHotel(null))}>
          <ModalBox>
            <ModalHeader
              title={editingHotel ? 'Edit Hotel' : 'Tambah Hotel Baru'}
              subtitle="Isi data hotel. Harga & jumlah kamar atur di Pengaturan Jumlah."
              icon={<HotelIcon className="w-5 h-5" />}
              onClose={() => !saving && !editFormLoading && (setShowAddModal(false), setEditingHotel(null))}
            />

            {editFormLoading ? (
              <ModalBody><div className="p-12 text-center text-slate-500"><ContentLoading /></div></ModalBody>
            ) : (
            <ModalBody className="p-6 space-y-6">
              {editingHotel && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="text-slate-500 text-sm">Kode:</span>
                  <span className="font-mono font-semibold text-slate-800">{editingHotel.code}</span>
                </div>
              )}

              {/* Nama Hotel */}
              <Input
                label="Nama Hotel"
                required
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Hotel Al Haram"
              />

              {/* Lokasi — Tab */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Lokasi</label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, location: 'makkah' }))}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      addForm.location === 'makkah'
                        ? 'bg-white text-[#0D1A63] shadow-sm border border-btn'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="w-4 h-4 shrink-0" />
                    Makkah
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, location: 'madinah' }))}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      addForm.location === 'madinah'
                        ? 'bg-white text-[#0D1A63] shadow-sm border border-btn'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className="w-4 h-4 shrink-0" />
                    Madinah
                  </button>
                </div>
              </div>

              {/* Type & Meal — dua kartu berdampingan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Type</label>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, allotment_type: 'allotment' }))}
                      className={`w-full py-2.5 px-3 rounded-lg text-sm font-medium text-left transition-all ${
                        addForm.allotment_type === 'allotment'
                          ? 'bg-btn text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:border-btn hover:bg-btn-light'
                      }`}
                    >
                      Allotment
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, allotment_type: 'non_allotment' }))}
                      className={`w-full py-2.5 px-3 rounded-lg text-sm font-medium text-left transition-all ${
                        addForm.allotment_type === 'non_allotment'
                          ? 'bg-btn text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:border-btn hover:bg-btn-light'
                      }`}
                    >
                      Non allotment
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Meal</label>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, meal_plan: 'fullboard' }))}
                      className={`w-full py-2.5 px-3 rounded-lg text-sm font-medium text-left transition-all ${
                        addForm.meal_plan === 'fullboard'
                          ? 'bg-btn text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:border-btn hover:bg-btn-light'
                      }`}
                    >
                      Fullboard
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, meal_plan: 'room_only' }))}
                      className={`w-full py-2.5 px-3 rounded-lg text-sm font-medium text-left transition-all ${
                        addForm.meal_plan === 'room_only'
                          ? 'bg-btn text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:border-btn hover:bg-btn-light'
                      }`}
                    >
                      Room only
                    </button>
                  </div>
                </div>
              </div>
            </ModalBody>
            )}

            <ModalFooter>
              <Button variant="outline" size="sm" onClick={() => (setShowAddModal(false), setEditingHotel(null))} disabled={saving || editFormLoading}>Batal</Button>
              <Button variant="primary" size="sm" onClick={editingHotel ? handleEditHotel : handleAddHotel} disabled={saving || editFormLoading} className="min-w-[120px]">{saving ? 'Menyimpan...' : editingHotel ? 'Simpan Perubahan' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {/* Modal terpadu: Jumlah Kamar & Musim (Pengaturan Jumlah + Data per Musim) */}
      {seasonsModalHotel && (
        <Modal open onClose={() => !seasonSaving && !inventorySaving && !hotelAvailabilityConfigSaving && !quantityFormSaving && setSeasonsModalHotel(null)}>
          <ModalBoxLg>
            <ModalHeader
              title="Pengaturan Jumlah Kamar & Musim"
              subtitle={seasonsModalHotel.name}
              icon={<Calendar className="w-5 h-5" />}
              onClose={() => !seasonSaving && !inventorySaving && !hotelAvailabilityConfigSaving && !quantityFormSaving && setSeasonsModalHotel(null)}
            />

            <ModalBody className="p-6 overflow-y-auto flex-1">
              {/* Pilihan: Semua jumlah kamar (satu set tiap bulan) vs Per musim */}
              {hotelAvailabilityConfigLoading ? (
                <p className="text-sm text-slate-500 mb-5">{CONTENT_LOADING_MESSAGE}</p>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 mb-6">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Cara atur kuota kamar</h3>
                  <p className="text-xs text-slate-500 mb-4">Pilih salah satu: <strong>Semua jumlah kamar</strong> (satu set untuk setiap bulan, open di semua tanggal) atau <strong>Per musim</strong> (kuota per periode saja).</p>
                  <div className="flex flex-wrap gap-6 mb-4">
                    <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 bg-white p-3 flex-1 min-w-[200px] hover:border-btn hover:bg-btn-light transition-colors">
                      <input
                        type="radio"
                        name="hotel-availability-mode"
                        checked={hotelAvailabilityMode === 'global'}
                        onChange={() => setHotelAvailabilityMode('global')}
                        className="mt-1 text-[#0D1A63] focus:ring-btn"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-800 block">Semua jumlah kamar</span>
                        <span className="text-xs text-slate-500">Satu set jumlah kamar dipakai untuk setiap bulan. Open di semua tanggal; tidak perlu mengisi musim.</span>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 bg-white p-3 flex-1 min-w-[200px] hover:border-btn hover:bg-btn-light transition-colors">
                      <input
                        type="radio"
                        name="hotel-availability-mode"
                        checked={hotelAvailabilityMode === 'per_season'}
                        onChange={async () => {
                          setHotelAvailabilityMode('per_season');
                          if (!seasonsModalHotel) return;
                          setHotelAvailabilityConfigSaving(true);
                          try {
                            await adminPusatApi.setHotelAvailabilityConfig(seasonsModalHotel.id, { availability_mode: 'per_season' });
                            showToast('Pengaturan per musim disimpan', 'success');
                          } catch {
                            setHotelAvailabilityMode('global');
                          } finally {
                            setHotelAvailabilityConfigSaving(false);
                          }
                        }}
                        className="mt-1 text-[#0D1A63] focus:ring-btn"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-800 block">Per musim</span>
                        <span className="text-xs text-slate-500">Kuota kamar diatur per periode (musim). Isi daftar musim dan inventori per musim di bawah.</span>
                      </div>
                    </label>
                  </div>
                  {hotelAvailabilityMode === 'global' && (() => {
                    const qCurr = CURRENCY_OPTIONS.find((c) => c.id === quantityModalPriceForm.currency) || CURRENCY_OPTIONS[0];
                    const qFormatAmount = (n: number) => (n > 0 ? `${qCurr.symbol} ${Number(n).toLocaleString(qCurr.locale)}` : '-');
                    const pf = quantityModalPriceForm;
                    const totalRooms = ROOM_TYPES.reduce((s, rt) => s + Math.max(0, parseInt(quantityForm[rt] ?? '', 10) || 0), 0);
                    return (
                      <div className="space-y-6 pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-600">Jumlah kamar dan harga di bawah dipakai untuk <strong>setiap tanggal</strong> (open di semua bulan). Tidak perlu mengisi musim.</p>
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                              <Bed className="w-4 h-4 text-[#0D1A63]" />
                              Jumlah kamar per tipe
                            </h3>
                            <span className="px-3 py-1 rounded-full bg-btn-light text-[#0D1A63] text-sm font-semibold">Total: {totalRooms} kamar</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {ROOM_TYPES.map((rt) => (
                              <div key={rt} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                                  {ROOM_TYPE_LABELS[rt] ?? rt}
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={quantityForm[rt] ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '' || /^\d*$/.test(v)) setQuantityForm((prev) => ({ ...prev, [rt]: v }));
                                  }}
                                  placeholder="0"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                            <h3 className="text-sm font-semibold text-slate-800">Mata uang & Harga Makan</h3>
                            <div className="flex gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200 mb-2">
                              <button type="button" onClick={() => setQuantityModalPriceForm((f) => ({ ...f, meal_price_type: 'per_day' }))}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${pf.meal_price_type === 'per_day' ? 'bg-white text-[#0D1A63] shadow-sm border border-btn' : 'text-slate-600 hover:bg-slate-50'}`}>Per hari</button>
                              <button type="button" onClick={() => setQuantityModalPriceForm((f) => ({ ...f, meal_price_type: 'per_trip' }))}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${pf.meal_price_type === 'per_trip' ? 'bg-white text-[#0D1A63] shadow-sm border border-btn' : 'text-slate-600 hover:bg-slate-50'}`}>Per trip</button>
                            </div>
                            <PriceCurrencyField
                              label="Harga Makan per Kamar"
                              value={pf.meal_price || 0}
                              currency={pf.currency}
                              onChange={(value, newCur) => {
                                setQuantityModalPriceForm((f) => {
                                  if (newCur === f.currency) return { ...f, meal_price: value };
                                  const conv = (x: number) => {
                                    const t = fillFromSource(f.currency, x, currencyRates);
                                    return newCur === 'IDR' ? t.idr : newCur === 'SAR' ? t.sar : t.usd;
                                  };
                                  return {
                                    ...f,
                                    currency: newCur,
                                    meal_price: value,
                                    single_price: conv(f.single_price || 0),
                                    rooms: {
                                      single: { ...f.rooms.single, price: conv(f.rooms.single?.price ?? 0) },
                                      double: { ...f.rooms.double, price: conv(f.rooms.double?.price ?? 0) },
                                      triple: { ...f.rooms.triple, price: conv(f.rooms.triple?.price ?? 0) },
                                      quad: { ...f.rooms.quad, price: conv(f.rooms.quad?.price ?? 0) },
                                      quint: { ...f.rooms.quint, price: conv(f.rooms.quint?.price ?? 0) }
                                    }
                                  };
                                });
                              }}
                              rates={currencyRates}
                              showConversions
                            />
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                            <h3 className="text-sm font-semibold text-slate-800">Harga Kamar</h3>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-2">Satuan</label>
                              <div className="flex gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200 mb-3">
                                <button type="button" onClick={() => setQuantityModalPriceForm((f) => ({ ...f, room_price_type: 'per_day' }))}
                                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${pf.room_price_type === 'per_day' ? 'bg-white text-[#0D1A63] shadow-sm border border-btn' : 'text-slate-600 hover:bg-slate-50'}`}>Per hari</button>
                                <button type="button" onClick={() => setQuantityModalPriceForm((f) => ({ ...f, room_price_type: 'per_lasten' }))}
                                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${pf.room_price_type === 'per_lasten' ? 'bg-white text-[#0D1A63] shadow-sm border border-btn' : 'text-slate-600 hover:bg-slate-50'}`}>Per lasten</button>
                              </div>
                              <label className="block text-xs font-medium text-slate-500 mb-2">Mode harga</label>
                              <div className="flex gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
                                <button type="button" onClick={() => setQuantityModalPriceForm((f) => ({ ...f, pricing_mode: 'single' }))}
                                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${pf.pricing_mode === 'single' ? 'bg-white text-[#0D1A63] shadow-sm border border-btn' : 'text-slate-600 hover:bg-slate-50'}`}>Satu harga</button>
                                <button type="button" onClick={() => setQuantityModalPriceForm((f) => ({ ...f, pricing_mode: 'per_type' }))}
                                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${pf.pricing_mode === 'per_type' ? 'bg-white text-[#0D1A63] shadow-sm border border-btn' : 'text-slate-600 hover:bg-slate-50'}`}>Per tipe</button>
                              </div>
                            </div>
                            {pf.pricing_mode === 'single' && (
                              <div>
                                <PriceInput
                                  label="Satu harga untuk semua tipe"
                                  value={pf.single_price || 0}
                                  currency={pf.currency}
                                  onChange={(n) => setQuantityModalPriceForm((f) => ({ ...f, single_price: n }))}
                                  placeholder="0"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-800">Ringkasan per tipe kamar</h3>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-100/80 border-b border-slate-200">
                                <th className="text-left py-3 px-4 font-medium text-slate-600">Tipe</th>
                                <th className="text-center py-3 px-4 font-medium text-slate-600">Jumlah</th>
                                <th className="text-right py-3 px-4 font-medium text-slate-600">Harga (room only)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ROOM_TYPES.map((rt) => (
                                <tr key={rt} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 capitalize font-medium text-slate-800">{rt}</td>
                                  <td className="py-3 px-4 text-center text-slate-700">{Math.max(0, parseInt(quantityForm[rt] ?? '', 10) || 0)}</td>
                                  <td className="py-3 px-4 text-right">
                                    {pf.pricing_mode === 'per_type' ? (
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-slate-500 text-xs">{qCurr.symbol}</span>
                                        <input type="number" min={0} value={pf.rooms[rt].price || ''}
                                          onChange={(e) => setQuantityModalPriceForm((f) => ({ ...f, rooms: { ...f.rooms, [rt]: { ...f.rooms[rt], price: Number(e.target.value) || 0 } } }))}
                                          className="w-24 text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-btn focus:border-btn"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-slate-700 font-medium">{qFormatAmount(pf.single_price || 0)}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end">
                          <Button size="sm" disabled={quantityFormSaving} onClick={handleSaveQuantityFromUnifiedModal}>
                            {quantityFormSaving ? 'Menyimpan…' : 'Simpan Jumlah & Harga'}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {hotelAvailabilityMode === 'per_season' && (inventoryForSeason ? (
                /* View: Atur inventori untuk satu musim */
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={() => setInventoryForSeason(null)}
                    className="flex items-center gap-2 text-sm font-medium text-[#0D1A63] hover:text-[#0D1A63]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Kembali ke daftar musim
                  </button>
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-800">Inventori kamar</h3>
                      <span className="px-3 py-1 rounded-full bg-btn-light text-[#0D1A63] text-sm font-medium">
                        {inventoryForSeason.seasonName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">Jumlah kamar per tipe untuk periode musim ini. Ketersediaan per tanggal dihitung realtime dari order.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {ROOM_TYPES.map((rt) => (
                        <div key={rt} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{ROOM_TYPE_LABELS[rt] ?? rt}</label>
                          <input
                            type="number"
                            min={0}
                            value={inventoryInputs[rt] !== undefined && inventoryInputs[rt] !== null ? inventoryInputs[rt] : String(inventoryRows.find((r) => r.room_type === rt)?.total_rooms ?? 0)}
                            onChange={(e) => setInventoryInputs((prev) => ({ ...prev, [rt]: e.target.value }))}
                            onBlur={() => {
                              const raw = inventoryInputs[rt];
                              const n = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                              setInventoryRows((prev) => prev.map((r) => r.room_type === rt ? { ...r, total_rooms: n } : r));
                              setInventoryInputs((prev) => ({ ...prev, [rt]: String(n) }));
                            }}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-btn focus:border-btn"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                    <Button className="mt-4" size="sm" disabled={inventorySaving} onClick={async () => {
                      if (!seasonsModalHotel || !inventoryForSeason) return;
                      setInventorySaving(true);
                      try {
                        const list = ROOM_TYPES.map((rt) => {
                          const raw = inventoryInputs[rt];
                          const total_rooms = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                          return { room_type: rt, total_rooms };
                        });
                        await adminPusatApi.setSeasonInventory(seasonsModalHotel.id, inventoryForSeason.seasonId, { inventory: list });
                        showToast('Inventori disimpan', 'success');
                        const res = await adminPusatApi.listSeasons(seasonsModalHotel.id);
                        setSeasonsList((res.data as { data?: HotelSeason[] })?.data ?? []);
                        setInventoryForSeason(null);
                        setSeasonsModalHotel(null);
                      } catch (err: unknown) {
                        const e = err as { response?: { data?: { message?: string } } };
                        showToast(e.response?.data?.message || 'Gagal menyimpan', 'error');
                      } finally {
                        setInventorySaving(false);
                      }
                    }}>
                      {inventorySaving ? 'Menyimpan…' : 'Simpan Inventori'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* View: Daftar musim + form tambah musim */
                <>
                  <p className="text-sm text-slate-600 mb-5">Buat periode musim (tanggal mulai–selesai) lalu atur jumlah kamar per tipe. Ketersediaan per tanggal dihitung otomatis dari order.</p>

                  {/* Form tambah musim */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 mb-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4">Tambah musim baru</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-4">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Nama musim</label>
                        <input
                          placeholder="Contoh: Ramadhan 2026"
                          value={seasonForm.name}
                          onChange={(e) => setSeasonForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-btn focus:border-btn"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Tanggal mulai</label>
                        <input
                          type="date"
                          value={seasonForm.start_date}
                          onChange={(e) => setSeasonForm((f) => ({ ...f, start_date: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-btn focus:border-btn"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Tanggal selesai</label>
                        <input
                          type="date"
                          value={seasonForm.end_date}
                          onChange={(e) => setSeasonForm((f) => ({ ...f, end_date: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-btn focus:border-btn"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={seasonSaving || !seasonForm.name.trim() || !seasonForm.start_date || !seasonForm.end_date}
                          onClick={async () => {
                            if (!seasonsModalHotel) return;
                            setSeasonSaving(true);
                            try {
                              await adminPusatApi.createSeason(seasonsModalHotel.id, { name: seasonForm.name.trim(), start_date: seasonForm.start_date, end_date: seasonForm.end_date });
                              showToast('Musim ditambah', 'success');
                              setSeasonForm({ name: '', start_date: '', end_date: '' });
                              const res = await adminPusatApi.listSeasons(seasonsModalHotel.id);
                              setSeasonsList((res.data as { data?: HotelSeason[] })?.data ?? []);
                            } catch (err: unknown) {
                              const e = err as { response?: { data?: { message?: string } } };
                              showToast(e.response?.data?.message || 'Gagal menambah musim', 'error');
                            } finally {
                              setSeasonSaving(false);
                            }
                          }}
                        >
                          {seasonSaving ? 'Menambah…' : 'Tambah'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Daftar musim — hanya dipakai ketika pilihan "Per musim" */}
                  <p className="text-xs text-slate-500 mb-2">Dengan pilihan per musim, hanya tanggal yang masuk dalam periode musim di bawah yang memiliki kuota. Tanggal di luar periode tidak tersedia.</p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <h3 className="text-sm font-semibold text-slate-800">Daftar musim</h3>
                    </div>
                    {seasonsList.length === 0 ? (
                      <div className="py-12 px-4 text-center">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">Belum ada musim.</p>
                        <p className="text-slate-400 text-xs mt-1">Isi form di atas lalu klik Tambah untuk membuat musim pertama.</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-100/80 border-b border-slate-200">
                            <th className="text-left py-3 px-4 font-medium text-slate-600">Nama</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-600">Periode</th>
                            <th className="text-right py-3 px-4 font-medium text-slate-600 sticky right-0 z-10 bg-slate-100/80 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seasonsList.map((s) => (
                            <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 font-medium text-slate-800">{s.name}</td>
                              <td className="py-3 px-4 text-slate-600">{s.start_date} — {s.end_date}</td>
                              <td className="py-3 px-4 text-right sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="!py-1.5 !px-3 text-xs"
                                    onClick={() => {
                                      setInventoryForSeason({ seasonId: s.id, seasonName: s.name });
                                      const existing = (s as { RoomInventory?: { room_type: string; total_rooms: number }[] }).RoomInventory ?? [];
                                      const rows = ROOM_TYPES.map((rt) => ({ room_type: rt, total_rooms: existing.find((r) => r.room_type === rt)?.total_rooms ?? 0 }));
                                      setInventoryRows(rows);
                                      setInventoryInputs(ROOM_TYPES.reduce<Record<string, string>>((acc, rt) => { acc[rt] = String(rows.find((r) => r.room_type === rt)?.total_rooms ?? 0); return acc; }, {}));
                                    }}
                                  >
                                    Atur inventori
                                  </Button>
                                  {canAddHotel && (
                                    <button
                                      type="button"
                                      className="text-red-600 hover:text-red-700 text-xs font-medium py-1.5 px-2 rounded-lg hover:bg-red-50"
                                      onClick={async () => {
                                        if (!window.confirm('Hapus musim ini? Data inventori akan ikut terhapus.')) return;
                                        try {
                                          await adminPusatApi.deleteSeason(seasonsModalHotel!.id, s.id);
                                          setSeasonsList((prev) => prev.filter((x) => x.id !== s.id));
                                          showToast('Musim dihapus', 'success');
                                        } catch (err: unknown) {
                                          const e = err as { response?: { data?: { message?: string } } };
                                          showToast(e.response?.data?.message || 'Gagal hapus musim', 'error');
                                        }
                                      }}
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              ))}
            </ModalBody>
          </ModalBoxLg>
        </Modal>
      )}
    </div>
  );
};

export default HotelsPage;
