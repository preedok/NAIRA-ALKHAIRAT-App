import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Eye
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import { StatCard, Autocomplete, Input, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ModalBoxLg, ContentLoading, CONTENT_LOADING_MESSAGE } from '../../../components/common';
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
import { getProductListOwnerId } from '../../../utils/productHelpers';

const ROOM_TYPES = ['single', 'double', 'triple', 'quad', 'quint'] as const;
const ROOM_TYPE_LABELS: Record<string, string> = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };
/** Kuota tersisa ≤ ini dianggap "hampir penuh"; admin pusat bisa tambah kuota di kalender untuk full dan hampir penuh */
const ALMOST_FULL_THRESHOLD = 3;
const DEFAULT_ROOM = { quantity: 0, price: 0 };

/** Label bulan untuk kolom matriks harga (id-ID, teks saja). */
function formatMonthLabelId(ymKey: string): string {
  const [y, mo] = ymKey.split('-');
  if (!y || !mo) return ymKey;
  const d = new Date(Number(y), Number(mo) - 1, 1);
  const s = d.toLocaleString('id-ID', { month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Label singkat untuk snapshot grid bulanan (YYYY-MM) di tabel harga */
function formatYmShortId(ym: string): string {
  const [y, mo] = ym.split('-');
  if (!y || !mo) return ym;
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
}

/** Label bulan singkat untuk baris ringkas di tabel (mis. "Jan"). */
function formatMonthShortId(ymKey: string): string {
  const [y, mo] = ymKey.split('-');
  if (!y || !mo) return ymKey;
  const d = new Date(Number(y), Number(mo) - 1, 1);
  const s = d.toLocaleString('id-ID', { month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type GridRatesPair = { SAR_TO_IDR: number; USD_TO_IDR: number };

type HotelMonthlyByRoomTypeMap = Record<
  string,
  { months: Array<{ year_month: string; sar_room_per_night: number | null }> }
>;

/** Satu baris horizontal: Jan … Des (scroll jika sempit). */
function renderMealMonthRow(
  months: Array<{ year_month: string; sar_meal_per_person_per_night: number | null }>,
  gridRates: GridRatesPair
): React.ReactNode {
  return (
    <div className="flex flex-nowrap gap-1 overflow-x-auto max-w-full touch-pan-x overscroll-x-contain py-0.5">
      {months.map((m) => {
        const sar = m.sar_meal_per_person_per_night;
        if (sar == null || !(sar > 0)) {
          return (
            <div
              key={m.year_month}
              className="shrink-0 w-[2.85rem] rounded border border-slate-200/70 bg-white px-0.5 py-1 text-center"
            >
              <div className="text-[9px] text-slate-500 font-medium leading-none mb-0.5">{formatMonthShortId(m.year_month)}</div>
              <div className="text-[10px] text-slate-400 tabular-nums">—</div>
            </div>
          );
        }
        const conv = fillFromSource('SAR', sar, gridRates);
        const t = getPriceTripleForTable(conv.idr, conv.sar, conv.usd);
        return (
          <div
            key={m.year_month}
            className="shrink-0 w-[2.85rem] rounded border border-slate-200/70 bg-white px-0.5 py-1 text-center"
          >
            <div className="text-[9px] text-slate-500 font-medium leading-none mb-0.5">{formatMonthShortId(m.year_month)}</div>
            <div className="font-medium tabular-nums text-[10px] text-slate-800 leading-tight">{t.sarText}</div>
            <div className="text-[8px] text-slate-500 tabular-nums leading-tight mt-0.5 line-clamp-2">{t.idrText}</div>
          </div>
        );
      })}
    </div>
  );
}

function renderRoomMonthRow(
  months: Array<{ year_month: string; sar_room_per_night: number | null }>,
  gridRates: GridRatesPair
): React.ReactNode {
  return (
    <div className="flex flex-nowrap gap-1 overflow-x-auto max-w-full touch-pan-x overscroll-x-contain py-0.5">
      {months.map((m) => {
        const sar = m.sar_room_per_night;
        if (sar == null || !(sar > 0)) {
          return (
            <div
              key={m.year_month}
              className="shrink-0 w-[2.85rem] rounded border border-slate-200/70 bg-white px-0.5 py-1 text-center"
            >
              <div className="text-[9px] text-slate-500 font-medium leading-none mb-0.5">{formatMonthShortId(m.year_month)}</div>
              <div className="text-[10px] text-slate-400 tabular-nums">—</div>
            </div>
          );
        }
        const conv = fillFromSource('SAR', sar, gridRates);
        const t = getPriceTripleForTable(conv.idr, conv.sar, conv.usd);
        return (
          <div
            key={m.year_month}
            className="shrink-0 w-[2.85rem] rounded border border-slate-200/70 bg-white px-0.5 py-1 text-center"
          >
            <div className="text-[9px] text-slate-500 font-medium leading-none mb-0.5">{formatMonthShortId(m.year_month)}</div>
            <div className="font-semibold tabular-nums text-[10px] text-slate-800 leading-tight">{t.sarText}</div>
            <div className="text-[8px] text-slate-500 tabular-nums leading-tight mt-0.5 line-clamp-2">{t.idrText}</div>
          </div>
        );
      })}
    </div>
  );
}

function parseSarInputString(s: string): number {
  const t = String(s ?? '').replace(/\./g, '').replace(',', '.').trim();
  if (t === '' || t === '-') return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatSarId(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n));
}

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
  /** Snapshot harga per malam dari grid bulanan SAR (bulan berjalan server UTC) */
  hotel_monthly_display?: {
    year_month: string;
    room_type: string;
    sar_room_only: number | null;
    sar_with_meal: number | null;
    sar_meal_per_person_per_night?: number | null;
  } | null;
  /** Grid SAR per bulan (satu tahun) untuk tabel daftar — dari API products?hotel_monthly_year= */
  hotel_monthly_series?: {
    year: string;
    room_type: string;
    months: Array<{
      year_month: string;
      sar_room_per_night: number | null;
      sar_meal_per_person_per_night: number | null;
    }>;
  } | null;
  /** Harga makan per bulan (satu array, tidak per tipe kamar). */
  hotel_monthly_meal_months?: {
    year: string;
    months: Array<{ year_month: string; sar_meal_per_person_per_night: number | null }>;
  } | null;
  /** Harga kamar per bulan per tipe (single … quint). */
  hotel_monthly_series_by_room_type?: {
    year: string;
    by_room_type: Record<string, { months: Array<{ year_month: string; sar_room_per_night: number | null }> }>;
  } | null;
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
  const [monthlyPriceYear, setMonthlyPriceYear] = useState<string>(String(new Date().getFullYear()));
  const [monthlyPriceLoading, setMonthlyPriceLoading] = useState(false);
  const [monthlyPriceRows, setMonthlyPriceRows] = useState<Record<string, Record<string, string>>>({});
  /** Harga makan SAR per orang per malam per bulan (room only) */
  const [monthlyMealByMonth, setMonthlyMealByMonth] = useState<Record<string, string>>({});
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
  const canAddToOrder = user?.role === 'owner_mou' || user?.role === 'owner_non_mou' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const canShowProductActions = ['owner_mou', 'owner_non_mou', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'role_accounting', 'super_admin'].includes(user?.role ?? '');

  const getMonthKeys = (year: string) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const monthKeys = getMonthKeys(monthlyPriceYear);
  const initMonthlyRows = (year = monthlyPriceYear) => {
    const keys = getMonthKeys(year);
    const out: Record<string, Record<string, string>> = {};
    ROOM_TYPES.forEach((rt) => {
      out[rt] = {};
      keys.forEach((m) => { out[rt][m] = ''; });
    });
    return out;
  };

  const initMonthlyMeal = (year: string) => {
    const o: Record<string, string> = {};
    getMonthKeys(year).forEach((m) => { o[m] = ''; });
    return o;
  };

  /** Harga bulanan (SAR): muat saat modal Pengaturan Jumlah Kamar terbuka */
  useEffect(() => {
    if (!seasonsModalHotel || !/^\d{4}$/.test(monthlyPriceYear)) return;
    let cancelled = false;
    (async () => {
      setMonthlyPriceLoading(true);
      try {
        const res = await productsApi.getHotelMonthlyPrices(seasonsModalHotel.id, { year: monthlyPriceYear });
        const data = (res.data as { data?: Array<{ year_month: string; room_type: string; currency: string; amount: number; with_meal: boolean; component?: string }> })?.data || [];
        const isFullboard = (seasonsModalHotel.meta as Record<string, unknown> | undefined)?.meal_plan === 'fullboard';
        const next = initMonthlyRows(monthlyPriceYear);
        const mealNext = initMonthlyMeal(monthlyPriceYear);
        data.forEach((r) => {
          if (String(r.currency).toUpperCase() !== 'SAR') return;
          const comp = r.component || 'room';
          if (comp === 'meal' || r.room_type === '__meal__') {
            const n = Number(r.amount) || 0;
            mealNext[r.year_month] = n > 0 ? formatSarId(n) : '';
            return;
          }
          if (comp !== 'room') return;
          if (isFullboard ? !r.with_meal : r.with_meal) return;
          if (next[r.room_type] && next[r.room_type][r.year_month] !== undefined) {
            const n = Number(r.amount) || 0;
            next[r.room_type][r.year_month] = n > 0 ? formatSarId(n) : '';
          }
        });
        if (!cancelled) {
          setMonthlyPriceRows(next);
          setMonthlyMealByMonth(mealNext);
        }
      } catch {
        if (!cancelled) {
          setMonthlyPriceRows(initMonthlyRows(monthlyPriceYear));
          setMonthlyMealByMonth(initMonthlyMeal(monthlyPriceYear));
        }
      } finally {
        if (!cancelled) setMonthlyPriceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initMonthlyRows stabil untuk year yang sama
  }, [seasonsModalHotel?.id, seasonsModalHotel?.meta, monthlyPriceYear]);

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
          setHotelAvailabilityMode('global');
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
        const pricingMode = (meta.pricing_mode as 'single' | 'per_type') || 'single';
        const rooms = { single: { ...DEFAULT_ROOM }, double: { ...DEFAULT_ROOM }, triple: { ...DEFAULT_ROOM }, quad: { ...DEFAULT_ROOM }, quint: { ...DEFAULT_ROOM } };
        ROOM_TYPES.forEach((rt) => {
          const qty = Number(roomMeta[rt]) || 0;
          rooms[rt] = { quantity: qty, price: 0 };
        });
        setQuantityModalPriceForm({
          currency: 'SAR',
          meal_price: 0,
          meal_price_type: 'per_day',
          room_price_type: 'per_day',
          pricing_mode: pricingMode,
          single_price: 0,
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
    setMonthlyPriceYear(String(new Date().getFullYear()));
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
        setMonthlyPriceYear(String(new Date().getFullYear()));
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
  /** Tahun grid SAR untuk kolom harga di tabel daftar (query `hotel_monthly_year`). */
  const [hotelListMonthlyYear] = useState(() => String(new Date().getFullYear()));
  const lastFilterKeyRef = useRef<string>('');
  const tableSectionRef = useRef<HTMLDivElement>(null);

  const tableColumns: TableColumn[] = useMemo(
    () => [
      { id: 'code', label: 'Kode', align: 'left', sortable: true },
      { id: 'name', label: 'Nama Hotel', align: 'left', sortable: true },
      { id: 'location', label: 'Lokasi', align: 'left' },
      { id: 'type_meal', label: 'Type / Meal', align: 'left' },
      { id: 'currency', label: 'Mata Uang', align: 'center' },
      {
        id: 'meal',
        label: `Harga makan / bulan (${hotelListMonthlyYear}) · per malam · IDR / SAR / USD`,
        align: 'left'
      },
      {
        id: 'room_price_type',
        label: `Harga kamar / bulan (${hotelListMonthlyYear}) · per malam · IDR / SAR / USD`,
        align: 'left'
      },
      { id: 'availability', label: 'Ketersediaan (realtime)', align: 'left' },
      { id: 'status', label: 'Status', align: 'center', sortable: true, sortKey: 'is_active' },
      ...(canShowProductActions ? [{ id: 'actions', label: 'Aksi', align: 'center' as const }] : [])
    ],
    [hotelListMonthlyYear, canShowProductActions]
  );

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
    const ownerId = getProductListOwnerId(user);
    const params = {
      type: 'hotel' as const,
      with_prices: 'true' as const,
      hotel_monthly_year: hotelListMonthlyYear,
      include_inactive: filterIncludeInactive,
      limit,
      page: pageToUse,
      sort_by: sortBy,
      sort_order: sortOrder,
      ...(debouncedSearchTerm.trim() ? { name: debouncedSearchTerm.trim() } : {}),
      ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' as const } : {}),
      ...(ownerId ? { owner_id: ownerId } : {})
    };
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
  }, [page, limit, sortBy, sortOrder, user?.role, filterIncludeInactive, debouncedSearchTerm, hotelListMonthlyYear]);

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
    const isFullboard = (hotel.meta as Record<string, unknown>)?.meal_plan === 'fullboard';
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
          currency: 'SAR',
          meal_price: 0,
          meal_price_type: 'per_day',
          room_price_type: 'per_day',
          pricing_mode: pf.pricing_mode,
          room_types: ROOM_TYPES
        }
      });

      await adminPusatApi.setProductAvailability(hotel.id, { quantity: totalQty, meta: { room_types: roomMeta } });
      await adminPusatApi.setHotelAvailabilityConfig(hotel.id, { availability_mode: 'global' });

      if (/^\d{4}$/.test(monthlyPriceYear)) {
        const ymKeys = getMonthKeys(monthlyPriceYear);
        const monthlyRowsPayload: Array<{
          year_month: string;
          room_type: 'single' | 'double' | 'triple' | 'quad' | 'quint' | string;
          with_meal: boolean;
          amount: number;
          currency: 'SAR';
          component: 'room' | 'meal';
        }> = [];
        ROOM_TYPES.forEach((rt) => {
          ymKeys.forEach((m) => {
            const n = parseSarInputString(monthlyPriceRows?.[rt]?.[m] ?? '');
            if (n > 0) {
              monthlyRowsPayload.push({
                year_month: m,
                room_type: rt,
                with_meal: !!isFullboard,
                amount: n,
                currency: 'SAR',
                component: 'room'
              });
            }
          });
        });
        if (!isFullboard) {
          ymKeys.forEach((m) => {
            const nm = parseSarInputString(monthlyMealByMonth?.[m] ?? '');
            if (nm > 0) {
              monthlyRowsPayload.push({
                year_month: m,
                room_type: '__meal__',
                with_meal: false,
                amount: nm,
                currency: 'SAR',
                component: 'meal'
              });
            }
          });
        }
        if (monthlyRowsPayload.length) {
          await productsApi.saveHotelMonthlyPricesBulk(hotel.id, { rows: monthlyRowsPayload });
        }
      }

      showToast('Jumlah kamar & tarif per malam SAR (grid per bulan kalender) disimpan. Order menghitung per malam menginap sesuai tanggal.', 'success');
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
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      const msg = err.response?.data?.message || 'Gagal menghapus hotel';
      showToast(msg, 'error');
      if (err.response?.status === 400 && msg.includes('masih digunakan') && window.confirm(`${msg}\n\nNonaktifkan hotel "${hotel.name}" saja? (Tidak akan ditampilkan di daftar.)`)) {
        try {
          await productsApi.update(hotel.id, { is_active: false });
          showToast('Hotel dinonaktifkan', 'success');
          fetchProducts();
        } catch (e2: unknown) {
          const e2err = e2 as { response?: { data?: { message?: string } } };
          showToast(e2err.response?.data?.message || 'Gagal menonaktifkan hotel', 'error');
        }
      }
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
        meta: { ...meta, currency: 'SAR' }
      });
      showToast('Hotel berhasil ditambahkan. Buka "Pengaturan Jumlah Kamar" untuk kapasitas dan grid tarif per malam (SAR) per bulan kalender.', 'success');
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
            onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
            action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>}
          />
        ))}
      </div>

      {/* Stat cards ketersediaan (realtime, 30 hari) — pakai StatCard agar seragam */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Statistik Ketersediaan Kamar (30 hari ke depan)</h3>
        <p className="text-xs text-slate-500 mb-2">Data per hotel mengikuti pilihan di Jumlah Kamar &amp; Musim (Semua jumlah kamar / Per musim).</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <StatCard icon={<Bed className="w-5 h-5" />} label="Total Tersedia" value={availabilityStats.total} subtitle="kamar" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          {ROOM_TYPES.map((rt) => (
            <StatCard key={rt} icon={<Bed className="w-5 h-5" />} label={rt} value={availabilityStats.byRoom[rt] ?? 0} subtitle="tersedia" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          ))}
        </div>
      </div>

      {/* Cari & filter + tabel dalam satu card */}
      <div ref={tableSectionRef}>
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
            const breakdown = hotel.room_breakdown || hotel.prices_by_room || {};
            const isSinglePrice = hotel.meta?.pricing_mode === 'single';
            // Harga Kamar column: show room-only (breakdown is room-only from API)
            const singlePriceVal = isSinglePrice ? (Number(breakdown.single?.price ?? hotel.price_branch ?? hotel.price_general ?? 0) || 0) : 0;
            const tripleMeal = fillFromSource(cur, mealPrice, currencyRates);
            const tripleRoom = fillFromSource(cur, singlePriceVal, currencyRates);
            const md = hotel.hotel_monthly_display;
            const isFullboardPlan = hotel.meta?.meal_plan === 'fullboard';
            /** SAR per malam dari grid bulanan (sumber utama tabel) */
            const monthlyRoomSar =
              md && (isFullboardPlan
                ? (md.sar_with_meal ?? md.sar_room_only)
                : md.sar_room_only);
            const hasMonthlyRoom = monthlyRoomSar != null && monthlyRoomSar > 0;
            /** Suplemen makan dari grid: baris with_meal − room_only (jika keduanya ada) */
            const monthlyMealDeltaSar =
              md && md.sar_with_meal != null && md.sar_room_only != null && md.sar_with_meal > md.sar_room_only
                ? md.sar_with_meal - md.sar_room_only
                : null;
            const tripleRoomFromMonthly = hasMonthlyRoom ? fillFromSource('SAR', monthlyRoomSar as number, currencyRates) : null;
            const tripleMealFromMonthlyDelta =
              monthlyMealDeltaSar != null && monthlyMealDeltaSar > 0
                ? fillFromSource('SAR', monthlyMealDeltaSar, currencyRates)
                : null;
            const gridMonthLabel = md?.year_month ? formatYmShortId(md.year_month) : '';
            const gridRtLabel = md?.room_type ? (ROOM_TYPE_LABELS[md.room_type] || md.room_type) : '';
            const avail = availabilityByHotelId[hotel.id];
            const gridRates = { SAR_TO_IDR: currencyRates.SAR_TO_IDR ?? 4200, USD_TO_IDR: currencyRates.USD_TO_IDR ?? 15500 };
            const series = hotel.hotel_monthly_series;
            const mealMonthsList = hotel.hotel_monthly_meal_months?.months ?? series?.months;
            const mealYearLabel = hotel.hotel_monthly_meal_months?.year ?? series?.year;
            const byRoomType = hotel.hotel_monthly_series_by_room_type?.by_room_type;
            const roomTypesYear = hotel.hotel_monthly_series_by_room_type?.year;
            /** API mengirim grid per tipe (12 bulan tiap tipe) — tampilkan semua tipe, termasuk yang belum terisi grid. */
            const hasMonthlyByRoomTypePayload =
              !!byRoomType &&
              ROOM_TYPES.some((rt) => {
                const block = byRoomType[rt];
                return Array.isArray(block?.months) && block.months.length > 0;
              });
            /** Fallback: response hanya punya `series` satu tipe acuan → bentuk 5 baris (harga terisi di tipe acuan saja). */
            const byRoomTypeDisplay: HotelMonthlyByRoomTypeMap | null =
              hasMonthlyByRoomTypePayload && byRoomType
                ? (byRoomType as HotelMonthlyByRoomTypeMap)
                : series?.months?.length
                  ? (Object.fromEntries(
                      ROOM_TYPES.map((rt) => [
                        rt,
                        {
                          months: series.months.map((m) => ({
                            year_month: m.year_month,
                            sar_room_per_night: rt === series.room_type ? m.sar_room_per_night : null
                          }))
                        }
                      ])
                    ) as HotelMonthlyByRoomTypeMap)
                  : null;
            const roomYearDisplay = roomTypesYear ?? series?.year;
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
                  {hotel.meta?.meal_plan === 'fullboard' ? (
                    <><span className="text-slate-600 font-medium">–</span><span className="text-slate-500 text-xs block mt-0.5">Termasuk (fullboard)</span></>
                  ) : mealMonthsList?.length ? (
                    <div className="min-w-0 max-w-[min(40rem,92vw)]">
                      <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-1 py-1 text-xs">
                        {renderMealMonthRow(
                          mealMonthsList as Array<{ year_month: string; sar_meal_per_person_per_night: number | null }>,
                          gridRates
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">per orang · per malam · {mealYearLabel}</p>
                    </div>
                  ) : md?.sar_meal_per_person_per_night != null && md.sar_meal_per_person_per_night > 0 ? (
                    (() => {
                      const tm = fillFromSource('SAR', md.sar_meal_per_person_per_night as number, currencyRates);
                      const t = getPriceTripleForTable(tm.idr, tm.sar, tm.usd);
                      return (
                        <>
                          <div className="tabular-nums font-medium">{t.idrText}</div>
                          <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                          <span className="text-slate-600 text-xs block mt-0.5">per orang · grid SAR · {gridMonthLabel || md.year_month}</span>
                        </>
                      );
                    })()
                  ) : tripleMealFromMonthlyDelta ? (
                    (() => {
                      const t = getPriceTripleForTable(tripleMealFromMonthlyDelta.idr, tripleMealFromMonthlyDelta.sar, tripleMealFromMonthlyDelta.usd);
                      return (
                        <>
                          <div className="tabular-nums font-medium">{t.idrText}</div>
                          <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                          <span className="text-slate-500 text-xs block mt-0.5">per kamar · selisih grid SAR · {gridMonthLabel}</span>
                        </>
                      );
                    })()
                  ) : (() => {
                    const t = getPriceTripleForTable(tripleMeal.idr, tripleMeal.sar, tripleMeal.usd);
                    if (!t.hasPrice) return <><span className="text-slate-400">–</span><span className="text-slate-400 text-xs block">{mealType}</span></>;
                    return (
                      <>
                        <div className="tabular-nums font-medium">{t.idrText}</div>
                        <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                        <span className="text-slate-400 text-xs block mt-0.5">
                          per orang · {mealType}
                          {hasMonthlyRoom ? <span className="text-slate-500"> · selain harga kamar (grid {gridMonthLabel})</span> : null}
                        </span>
                      </>
                    );
                  })()}
                </td>
                <td className="px-4 py-3.5 text-sm text-slate-700 align-top">
                  {byRoomTypeDisplay ? (
                    <div className="min-w-0 max-w-[min(44rem,92vw)]">
                      <div className="space-y-1.5 text-xs">
                        {ROOM_TYPES.map((rt) => {
                          const block = byRoomTypeDisplay[rt];
                          if (!block?.months?.length) return null;
                          return (
                            <div key={rt} className="flex items-start gap-1.5 min-w-0">
                              <span className="shrink-0 w-11 text-[10px] font-semibold text-slate-600 pt-1 leading-tight">
                                {ROOM_TYPE_LABELS[rt] || rt}
                              </span>
                              <div className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-slate-50/60 px-1 py-0.5">
                                {renderRoomMonthRow(block.months, gridRates)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        per malam · {roomYearDisplay} · Single – Quint
                        {isFullboardPlan ? ' · termasuk makan' : ''}
                      </p>
                    </div>
                  ) : tripleRoomFromMonthly ? (
                    (() => {
                      const t = getPriceTripleForTable(tripleRoomFromMonthly.idr, tripleRoomFromMonthly.sar, tripleRoomFromMonthly.usd);
                      return (
                        <>
                          <div className="tabular-nums font-semibold">{t.idrText}</div>
                          <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                          <span className="text-slate-600 text-xs block mt-0.5">
                            per malam · grid SAR · {gridMonthLabel}
                            {gridRtLabel ? ` · ${gridRtLabel}` : ''}
                            {isFullboardPlan ? ' · termasuk makan' : ''}
                          </span>
                        </>
                      );
                    })()
                  ) : isSinglePrice ? (
                    (() => {
                      const t = getPriceTripleForTable(tripleRoom.idr, tripleRoom.sar, tripleRoom.usd);
                      if (!t.hasPrice) return <><span className="text-slate-400">–</span><span className="text-slate-500 text-xs block">{roomPriceType}</span></>;
                      return (
                        <>
                          <div className="tabular-nums font-semibold">{t.idrText}</div>
                          <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                          <span className="text-slate-500 text-xs block mt-0.5">per kamar · default · {roomPriceType}</span>
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
                          <span className="text-slate-500 text-xs block mt-0.5">per kamar · default · Per tipe · {roomPriceType}</span>
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
                        {Object.entries(avail.byRoomType).map(([rt, n]) => {
                          const isFullboard = hotel.meta?.meal_plan === 'fullboard';
                          const isPerTypePrice = hotel.meta?.pricing_mode === 'per_type';
                          const showPriceHere = isFullboard && isPerTypePrice;
                          const rtEntry = breakdown[rt as keyof typeof breakdown];
                          const priceVal = typeof rtEntry === 'object' && rtEntry != null && 'price' in rtEntry ? Number((rtEntry as { price?: number }).price) : 0;
                          const tripleRt = fillFromSource(cur, priceVal, currencyRates);
                          const tRt = getPriceTripleForTable(tripleRt.idr, tripleRt.sar, tripleRt.usd);
                          const priceLabel = showPriceHere && tRt.hasPrice ? (cur === 'SAR' ? tRt.sarText : cur === 'USD' ? tRt.usdText : tRt.idrText) : null;
                          return (
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
                              {priceLabel != null && (
                                <p className="text-[10px] text-slate-600 mt-0.5 tabular-nums">{priceLabel}</p>
                              )}
                            </div>
                          );
                        })}
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
                          const cur = (hotel.currency || (hotel.meta as any)?.currency || 'IDR').toString().toUpperCase();
                          const priceCurrency = (cur === 'SAR' || cur === 'USD' || cur === 'IDR') ? cur : 'IDR';
                          const hotelLocRaw = (hotel.meta as any)?.location;
                          const hotel_location = hotelLocRaw ? String(hotelLocRaw).toLowerCase() : undefined;
                          const s2i = currencyRates.SAR_TO_IDR ?? 4200;
                          const u2i = currencyRates.USD_TO_IDR ?? 15500;
                          const breakdown = hotel.room_breakdown || hotel.prices_by_room || {};
                          const roomTypes: Array<'single'|'double'|'triple'|'quad'|'quint'> = ['single', 'double', 'triple', 'quad', 'quint'];
                          const firstRoomWithPrice = roomTypes.find((rt) => {
                            const entry = breakdown[rt];
                            const p = typeof entry === 'object' && entry != null && 'price' in entry ? Number((entry as { price?: number }).price) : typeof entry === 'number' ? entry : 0;
                            return p > 0;
                          });
                          const repPrice = firstRoomWithPrice
                            ? (Number((breakdown[firstRoomWithPrice] as { price?: number })?.price) || Number(hotel.price_branch ?? hotel.price_general ?? 0))
                            : Number(hotel.price_branch ?? hotel.price_general ?? 0);
                          const mealPriceRaw = Number((hotel.meta as any)?.meal_price ?? 0) || 0;
                          const roomTriple = fillFromSource(priceCurrency as 'IDR'|'SAR'|'USD', repPrice, currencyRates);
                          const mealTriple = fillFromSource(priceCurrency as 'IDR'|'SAR'|'USD', mealPriceRaw, currencyRates);
                          const unitPriceInCur = priceCurrency === 'SAR' ? roomTriple.sar : priceCurrency === 'USD' ? roomTriple.usd : roomTriple.idr;
                          const mealPriceInCur = priceCurrency === 'SAR' ? mealTriple.sar : priceCurrency === 'USD' ? mealTriple.usd : mealTriple.idr;
                          const unit_price_idr = priceCurrency === 'SAR' ? unitPriceInCur * s2i : priceCurrency === 'USD' ? unitPriceInCur * u2i : unitPriceInCur;
                          const defaultRoomType = firstRoomWithPrice ?? 'quad';
                          addDraftItem({
                            type: 'hotel',
                            product_id: hotel.id,
                            product_name: hotel.name,
                            unit_price_idr,
                            unit_price: unitPriceInCur,
                            price_currency: priceCurrency as any,
                            quantity: 1,
                            meta: hotel_location ? { hotel_location } : undefined,
                            room_breakdown: [{ room_type: defaultRoomType, quantity: 1, unit_price: unitPriceInCur, with_meal: false, meal_unit_price: mealPriceInCur }]
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
                          ...(canAddHotel ? [{ id: 'seasons', label: 'Pengaturan Jumlah Kamar', icon: <Bed className="w-4 h-4" />, onClick: () => handleOpenUnifiedQuantityAndSeasonsModal(hotel) }] : []),
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
      </div>

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
        const roomPriceTypeLabel = 'per malam';
        const breakdown = hotel?.room_breakdown || hotel?.prices_by_room || {};
        const isSinglePrice = hotel?.meta?.pricing_mode === 'single';
        const singlePriceValue = isSinglePrice ? (Number(hotel?.price_branch ?? hotel?.price_general ?? 0) || (breakdown.single?.price ?? 0)) : 0;
        return (
          <Modal open onClose={() => setAvailabilityPopupHotelId(null)}>
            <ModalBoxLg className="relative">
              <ModalHeader
                title="Ketersediaan per tanggal"
                subtitle={<>{(hotel?.name ?? 'Hotel')} — data realtime per tipe kamar</>}
                icon={<Calendar className="w-5 h-5" />}
                onClose={() => setAvailabilityPopupHotelId(null)}
              />
              <ModalBody className="p-6 overflow-y-auto flex-1 min-h-0">
                {/* Harga kamar per malam — satu harga atau per tipe (referensi; operasional dari grid bulanan) */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
                  <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
                    <h4 className="text-sm font-semibold text-slate-800">Harga kamar {roomPriceTypeLabel}</h4>
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
                    <p className="text-slate-400 text-sm mt-1">Ketersediaan dihitung otomatis dari booking order pada periode yang dipilih.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Legenda & kode tipe — satu bar rapi */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Legenda:</span>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 h-5 rounded bg-emerald-200 border border-emerald-300" />
                        <span className="text-sm text-slate-700">Tersedia</span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 h-5 rounded bg-amber-200 border border-amber-300" />
                        <span className="text-sm text-slate-700">Hampir penuh (≤{ALMOST_FULL_THRESHOLD} kamar)</span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 h-5 rounded bg-red-200 border border-red-300" />
                        <span className="text-sm text-slate-700">Full</span>
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
                          <span className="text-xs text-emerald-600">Admin: klik <Plus className="w-3 h-3 inline" /> di sel full/hampir penuh untuk tambah kuota langsung</span>
                        </>
                      )}
                    </div>

                    {/* Satu tampilan: Kalender + detail per tanggal (tabel gabungan) */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <h4 className="text-sm font-semibold text-slate-800">Ketersediaan 30 hari</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Tanggal + jumlah tersedia per tipe. Hijau = tersedia, kuning = hampir penuh, merah = full. Admin pusat bisa tambah kuota di sel full/hampir penuh.</p>
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
                              const hasAlmostFull = !noSeason && rec && ROOM_TYPES.some((rt) => { const av = getAvail(rt); return av > 0 && av <= ALMOST_FULL_THRESHOLD; });
                              const allFull = !noSeason && rec && ROOM_TYPES.every((rt) => getAvail(rt) <= 0);
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
                                          : allFull
                                            ? 'bg-red-50 border-red-200'
                                            : hasAlmostFull
                                              ? 'bg-amber-50 border-amber-200'
                                              : 'bg-emerald-50 border-emerald-200'
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
                                    const isAlmostFull = a > 0 && a <= ALMOST_FULL_THRESHOLD;
                                    const showAddBtn = canAddHotel && (isFull || isAlmostFull) && seasonId;
                                    const cellBg = isFull ? 'bg-red-100 text-red-800' : isAlmostFull ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
                                    return (
                                      <td key={rt} className="py-2 px-2 text-center align-middle">
                                        <div className="inline-flex items-center justify-center gap-1">
                                          <span
                                            className={`inline-flex items-center justify-center min-w-[44px] py-1.5 px-2 rounded-lg font-semibold tabular-nums text-sm ${cellBg}`}
                                          >
                                            {a > 0 ? a : 'Full'}
                                          </span>
                                          {showAddBtn && (
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); openAddQty(); }}
                                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors shrink-0"
                                              title="Tambah kuota (full/hampir penuh)"
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
              subtitle="Isi data hotel. Kapasitas dan tarif kamar diatur di Pengaturan Jumlah Kamar: SAR per malam menginap, diisi per bulan kalender (bukan total sewa satu bulan penuh)."
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

      {/* Modal: Pengaturan Jumlah Kamar (tanpa opsi per musim / per trip / per lasten) */}
      {seasonsModalHotel && (
        <Modal open onClose={() => !seasonSaving && !inventorySaving && !hotelAvailabilityConfigSaving && !quantityFormSaving && !monthlyPriceLoading && setSeasonsModalHotel(null)}>
          <ModalBoxLg>
            <ModalHeader
              title="Pengaturan Jumlah Kamar"
              subtitle={seasonsModalHotel.name}
              icon={<Bed className="w-5 h-5" />}
              onClose={() => !seasonSaving && !inventorySaving && !hotelAvailabilityConfigSaving && !quantityFormSaving && !monthlyPriceLoading && setSeasonsModalHotel(null)}
            />

            <ModalBody className="p-6 overflow-y-auto flex-1">
              {hotelAvailabilityConfigLoading ? (
                <p className="text-sm text-slate-500">{CONTENT_LOADING_MESSAGE}</p>
              ) : (
                (() => {
                  const pf = quantityModalPriceForm;
                  const totalRooms = ROOM_TYPES.reduce((s, rt) => s + Math.max(0, parseInt(quantityForm[rt] ?? '', 10) || 0), 0);
                  const stepBadge = (n: number) => (
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D1A63]/10 text-sm font-bold text-[#0D1A63]"
                      aria-hidden
                    >
                      {n}
                    </span>
                  );
                  return (
                    <div className="space-y-6 max-w-full">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
                        <p className="text-sm font-medium text-slate-800">Alur pengisian</p>
                        <ol className="mt-2 space-y-1.5 text-xs sm:text-sm text-slate-600 list-decimal list-inside marker:font-medium">
                          <li>Isi kapasitas per tipe kamar.</li>
                          <li>
                            Isi <strong className="font-medium text-slate-800">tarif kamar SAR per malam</strong> untuk tiap kolom bulan kalender (mis. Januari = harga satu malam menginap jika tanggal inap jatuh di Januari).{' '}
                            <span className="text-slate-500">Bukan total sewa hotel untuk sebulan penuh.</span> Kolom kosong memakai fallback harga lama di sistem jika ada.
                          </li>
                          <li>
                            Room only: isi <strong className="font-medium text-slate-800">harga makan SAR per orang per malam</strong> dengan pola yang sama per bulan kalender.
                          </li>
                          <li>Simpan. Form order menjumlahkan malam menginap × tarif per malam sesuai bulan masing-masing.</li>
                        </ol>
                      </div>

                      <section
                        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
                        aria-labelledby="hotel-qty-capacity-heading"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="flex gap-3 min-w-0">
                            {stepBadge(1)}
                            <div className="min-w-0">
                              <h3 id="hotel-qty-capacity-heading" className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                <Bed className="w-4 h-4 text-[#0D1A63] shrink-0" />
                                Kapasitas kamar
                              </h3>
                              <p className="text-xs text-slate-500 mt-1">Jumlah kamar siap dijual untuk setiap tipe.</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-btn-light px-3 py-2 sm:justify-center sm:min-w-[9rem]">
                            <span className="text-xs font-medium text-slate-600 sm:hidden">Total</span>
                            <span className="text-sm font-semibold tabular-nums text-[#0D1A63]">
                              <span className="hidden sm:inline">Total: </span>
                              {totalRooms} kamar
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {ROOM_TYPES.map((rt) => (
                            <div
                              key={rt}
                              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-3.5 focus-within:ring-2 focus-within:ring-[#0D1A63]/25 focus-within:border-[#0D1A63]/40 transition-shadow"
                            >
                              <label className="block text-xs font-medium text-slate-600 mb-2">
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
                                className="tabular-nums"
                              />
                            </div>
                          ))}
                        </div>
                      </section>

                      <section aria-labelledby="hotel-qty-pricing-mode-heading">
                        <div className="flex gap-3 mb-3">
                          {stepBadge(2)}
                          <div className="min-w-0 flex-1">
                            <h3 id="hotel-qty-pricing-mode-heading" className="text-sm font-semibold text-slate-900">
                              Mode penentuan tipe acuan
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              Tagihan menginap dihitung <strong className="font-medium text-slate-700">per malam</strong>. Grid SAR berikut menyimpan{' '}
                              <strong className="font-medium text-slate-700">tarif satu malam per bulan kalender</strong> (bukan harga lump sum sewa satu bulan penuh). Mode di sini hanya memilih tipe kamar acuan untuk tampilan ringkas di daftar produk.
                            </p>
                            <div
                              className="flex flex-col sm:flex-row gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200 mt-3"
                              role="group"
                              aria-label="Mode harga kamar"
                            >
                              <button
                                type="button"
                                onClick={() => setQuantityModalPriceForm((f) => ({ ...f, pricing_mode: 'single' }))}
                                className={`flex-1 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${pf.pricing_mode === 'single' ? 'bg-white text-[#0D1A63] shadow-sm border border-btn' : 'text-slate-600 hover:bg-slate-50'}`}
                              >
                                Acuan: single (satu harga semua tipe di grid)
                              </button>
                              <button
                                type="button"
                                onClick={() => setQuantityModalPriceForm((f) => ({ ...f, pricing_mode: 'per_type' }))}
                                className={`flex-1 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${pf.pricing_mode === 'per_type' ? 'bg-white text-[#0D1A63] shadow-sm border border-btn' : 'text-slate-600 hover:bg-slate-50'}`}
                              >
                                Acuan: per tipe (beda baris di grid)
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              Mata uang default hotel: <strong className="font-medium text-slate-700">SAR</strong>. IDR/USD di bawah sel grid mengikuti kurs pengaturan.
                            </p>
                          </div>
                        </div>
                      </section>

                      <section
                        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
                        aria-labelledby="hotel-qty-monthly-heading"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex gap-3 min-w-0 flex-1">
                            {stepBadge(3)}
                            <div className="min-w-0">
                              <h3 id="hotel-qty-monthly-heading" className="text-sm font-semibold text-slate-900">
                                Tarif per malam (SAR) per bulan kalender
                              </h3>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Setiap sel = <strong className="font-medium text-slate-700">SAR untuk satu malam menginap</strong> per kamar, berlaku untuk malam-malam yang jatuh pada bulan kolom tersebut. Bukan total untuk seluruh bulan. Di bawah sel: perkiraan IDR/USD. Kosongkan bulan yang memakai fallback (data harga lama di sistem, jika ada).
                              </p>
                              <p className="mt-2 text-xs text-slate-500 flex items-start gap-1.5">
                                <span className="text-slate-400 select-none" aria-hidden>↔</span>
                                <span>Tabel lebar: gunakan scroll horizontal di layar kecil.</span>
                              </p>
                            </div>
                          </div>
                          <div className="w-full lg:w-44 shrink-0">
                            <Input
                              label="Tahun"
                              value={monthlyPriceYear}
                              onChange={(e) => setMonthlyPriceYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                              disabled={quantityFormSaving || monthlyPriceLoading}
                            />
                          </div>
                        </div>
                        {monthlyPriceLoading ? (
                          <p className="mt-3 text-xs text-slate-500">{CONTENT_LOADING_MESSAGE}</p>
                        ) : null}
                        <div className="mt-4 w-full min-w-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 max-h-[min(480px,60vh)] overscroll-x-contain touch-pan-x">
                          <table className="w-full text-sm min-w-[1100px]">
                            <thead className="sticky top-0 z-[1]">
                              <tr className="bg-slate-100 border-b border-slate-200 shadow-sm">
                                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 sticky left-0 bg-slate-100 z-[1] border-r border-slate-200/80">
                                  Tipe
                                </th>
                                {monthKeys.map((m) => (
                                  <th key={m} className="text-center px-2 py-2.5 min-w-[7rem] font-medium text-slate-700">
                                    {formatMonthLabelId(m)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {ROOM_TYPES.map((rt) => (
                                <tr key={rt} className="border-b border-slate-100 last:border-0">
                                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white z-0 border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                                    {ROOM_TYPE_LABELS[rt] || rt}
                                  </td>
                                  {monthKeys.map((m) => {
                                    const sar = parseSarInputString(monthlyPriceRows?.[rt]?.[m] ?? '');
                                    const rates = { SAR_TO_IDR: currencyRates.SAR_TO_IDR ?? 4200, USD_TO_IDR: currencyRates.USD_TO_IDR ?? 15500 };
                                    const conv = sar > 0 ? fillFromSource('SAR', sar, rates) : null;
                                    const cellDisabled = quantityFormSaving || monthlyPriceLoading;
                                    return (
                                      <td key={`${rt}-${m}`} className="px-2 py-2 align-top">
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={monthlyPriceRows?.[rt]?.[m] ?? ''}
                                          onChange={(e) => {
                                            const raw = e.target.value.replace(/[^\d.,]/g, '');
                                            setMonthlyPriceRows((prev) => ({
                                              ...prev,
                                              [rt]: { ...(prev?.[rt] || {}), [m]: raw }
                                            }));
                                          }}
                                          onBlur={() => {
                                            const n = parseSarInputString(monthlyPriceRows?.[rt]?.[m] ?? '');
                                            setMonthlyPriceRows((prev) => ({
                                              ...prev,
                                              [rt]: { ...(prev?.[rt] || {}), [m]: n > 0 ? formatSarId(n) : '' }
                                            }));
                                          }}
                                          placeholder="0"
                                          disabled={cellDisabled}
                                          ariaLabel={`Harga SAR ${ROOM_TYPE_LABELS[rt] || rt} ${formatMonthLabelId(m)}`}
                                          className="min-w-[5.5rem]"
                                          inputClassName="!px-2 !py-1.5 !rounded-lg text-right tabular-nums"
                                        />
                                        {conv && sar > 0 ? (
                                          <div className="mt-1 text-[10px] leading-snug text-slate-500">
                                            <div>≈ Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(conv.idr))}</div>
                                            <div>≈ USD {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(conv.usd)}</div>
                                          </div>
                                        ) : null}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      {(seasonsModalHotel?.meta as Record<string, unknown>)?.meal_plan !== 'fullboard' && (
                        <section
                          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
                          aria-labelledby="hotel-qty-monthly-meal-heading"
                        >
                          <div className="flex gap-3 min-w-0 flex-1 mb-3">
                            {stepBadge(4)}
                            <div className="min-w-0">
                              <h3 id="hotel-qty-monthly-meal-heading" className="text-sm font-semibold text-slate-900">
                                Makan: SAR per orang per malam, per bulan kalender
                              </h3>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Hanya untuk <strong className="font-medium text-slate-700">room only</strong>. Tiap sel = tambahan makan untuk <strong className="font-medium text-slate-700">satu malam</strong> per orang, berlaku untuk malam di bulan kolom (bukan total makan sebulan). Di bawah sel: perkiraan IDR/USD. Kosongkan bulan yang memakai fallback (meta lama).
                              </p>
                            </div>
                          </div>
                          <div className="w-full min-w-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 max-h-[min(220px,40vh)] touch-pan-x">
                            <table className="w-full text-sm min-w-[900px]">
                              <thead className="sticky top-0 z-[1] bg-slate-100">
                                <tr className="border-b border-slate-200">
                                  <th className="text-left px-3 py-2.5 font-semibold text-slate-700 sticky left-0 bg-slate-100 z-[1] border-r border-slate-200/80 w-[10rem]">
                                    Item
                                  </th>
                                  {monthKeys.map((m) => (
                                    <th key={m} className="text-center px-2 py-2.5 min-w-[7rem] font-medium text-slate-700">
                                      {formatMonthLabelId(m)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white">
                                <tr className="border-b border-slate-100">
                                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white border-r border-slate-100">
                                    Makan / orang / malam
                                  </td>
                                  {monthKeys.map((m) => {
                                    const sar = parseSarInputString(monthlyMealByMonth?.[m] ?? '');
                                    const rates = { SAR_TO_IDR: currencyRates.SAR_TO_IDR ?? 4200, USD_TO_IDR: currencyRates.USD_TO_IDR ?? 15500 };
                                    const conv = sar > 0 ? fillFromSource('SAR', sar, rates) : null;
                                    const cellDisabled = quantityFormSaving || monthlyPriceLoading;
                                    return (
                                      <td key={`meal-${m}`} className="px-2 py-2 align-top">
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={monthlyMealByMonth?.[m] ?? ''}
                                          onChange={(e) => {
                                            const raw = e.target.value.replace(/[^\d.,]/g, '');
                                            setMonthlyMealByMonth((prev) => ({ ...prev, [m]: raw }));
                                          }}
                                          onBlur={() => {
                                            const n = parseSarInputString(monthlyMealByMonth?.[m] ?? '');
                                            setMonthlyMealByMonth((prev) => ({ ...prev, [m]: n > 0 ? formatSarId(n) : '' }));
                                          }}
                                          placeholder="0"
                                          disabled={cellDisabled}
                                          ariaLabel={`Harga makan SAR ${formatMonthLabelId(m)}`}
                                          className="min-w-[5.5rem]"
                                          inputClassName="!px-2 !py-1.5 !rounded-lg text-right tabular-nums"
                                        />
                                        {conv && sar > 0 ? (
                                          <div className="mt-1 text-[10px] leading-snug text-slate-500">
                                            <div>≈ Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(conv.idr))}</div>
                                            <div>≈ USD {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(conv.usd)}</div>
                                          </div>
                                        ) : null}
                                      </td>
                                    );
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
                    </div>
                  );
                })()
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                size="sm"
                disabled={quantityFormSaving || monthlyPriceLoading || !/^\d{4}$/.test(monthlyPriceYear)}
                onClick={handleSaveQuantityFromUnifiedModal}
              >
                {quantityFormSaving ? 'Menyimpan…' : 'Simpan jumlah & harga'}
              </Button>
            </ModalFooter>
          </ModalBoxLg>
        </Modal>
      )}
    </div>
  );
};

export default HotelsPage;
