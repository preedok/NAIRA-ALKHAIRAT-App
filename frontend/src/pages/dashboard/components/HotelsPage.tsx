import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Hotel as HotelIcon,
  Plus,
  Search,
  MapPin,
  Bed,
  Edit,
  Trash2,
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
import { StatCard, Autocomplete, Input, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ModalBoxLg, ContentLoading, CONTENT_LOADING_MESSAGE, HotelAddRoomQuantityModal } from '../../../components/common';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { TableColumn } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import HotelWorkPage from './HotelWorkPage';
import { productsApi, adminPusatApi, businessRulesApi } from '../../../services/api';
import type { HotelSeason } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import { getPriceTripleForTable, formatUSD } from '../../../utils';
import { CURRENCY_OPTIONS } from '../../../utils/constants';
import { getProductListOwnerId } from '../../../utils/productHelpers';

const ROOM_TYPES = ['double', 'triple', 'quad', 'quint'] as const;
const ROOM_TYPE_LABELS: Record<string, string> = { double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint', single: 'Double' };
const OWNER_PRICE_TYPES = ['mou', 'non_mou'] as const;
type OwnerPriceType = (typeof OWNER_PRICE_TYPES)[number];
type OwnerPriceView = OwnerPriceType | 'all';
type OwnerMealMode = 'with_meal' | 'fullboard';
const OWNER_PRICE_LABELS: Record<OwnerPriceType, string> = {
  mou: 'Owner MOU',
  non_mou: 'Owner Non-MOU'
};
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

/** Sel harga read-only (SAR + IDR + USD) untuk tabel kalender di daftar hotel. */
function MonthlyReadonlyPriceCell({ sar, gridRates }: { sar: number | null; gridRates: GridRatesPair }): JSX.Element {
  if (sar == null || !(sar > 0)) {
    return <div className="text-center py-1 text-slate-400 tabular-nums">—</div>;
  }
  const conv = fillFromSource('SAR', sar, gridRates);
  const t = getPriceTripleForTable(conv.idr, conv.sar, conv.usd);
  return (
    <div className="text-center py-1 px-0.5 space-y-0.5">
      <div className="font-semibold tabular-nums text-[10px] text-slate-800 leading-tight" title="SAR per malam">
        <span className="text-slate-500 font-normal">SAR</span> {t.sarText}
      </div>
      <div className="text-[8px] text-slate-500 tabular-nums leading-tight line-clamp-2" title="Perkiraan IDR">
        {t.idrText}
      </div>
      <div className="text-[8px] text-slate-500 tabular-nums leading-tight" title="Perkiraan USD">
        {formatUSD(conv.usd, true)}
      </div>
    </div>
  );
}

/**
 * Satu header bulan (Jan–Des) + baris makan (room only) + baris Single–Quint — sama pola dengan modal "Tarif per malam (SAR) per bulan kalender".
 */
function renderHotelListMonthlyMatrixTable(props: {
  monthKeys: string[];
  isFullboard: boolean;
  mealMonthsList: Array<{ year_month: string; sar_meal_per_person_per_night: number | null }> | null | undefined;
  byRoomTypeDisplay: HotelMonthlyByRoomTypeMap;
  gridRates: GridRatesPair;
  roomYearDisplay: string | undefined;
  roomPricingMode?: 'per_room' | 'per_person';
}): React.ReactNode {
  const { monthKeys, isFullboard, mealMonthsList, byRoomTypeDisplay, gridRates, roomYearDisplay, roomPricingMode } = props;
  const mealByYm = new Map((mealMonthsList || []).map((m) => [m.year_month, m.sar_meal_per_person_per_night]));
  const showMealRow = !isFullboard && Array.isArray(mealMonthsList) && mealMonthsList.length > 0;
  const isPerPack = roomPricingMode === 'per_person';
  const perPackSourceRoomType = ROOM_TYPES.find((rt) =>
    (byRoomTypeDisplay?.[rt]?.months || []).some((m) => Number(m?.sar_room_per_night || 0) > 0)
  ) || ROOM_TYPES[0];

  return (
    <div className="min-w-0 overflow-x-auto max-w-[min(52rem,92vw)] rounded-lg border border-slate-100 bg-slate-50/60 touch-pan-x overscroll-x-contain">
      <table className="w-full text-[10px] min-w-[560px] border-collapse">
        <thead>
          <tr className="bg-slate-100/90 border-b border-slate-200">
            <th className="sticky left-0 z-[1] bg-slate-100/90 text-left px-2 py-1.5 font-semibold text-slate-700 border-r border-slate-200/80 w-[4.75rem]">
              {isPerPack ? 'Harga' : 'Tipe'}
            </th>
            {monthKeys.map((ym) => (
              <th key={ym} className="px-1 py-1.5 font-medium text-slate-600 text-center whitespace-nowrap min-w-[3.25rem]">
                {formatMonthShortId(ym)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {showMealRow ? (
            <tr className="border-b border-slate-100">
              <td className="sticky left-0 z-0 bg-white px-2 py-1 font-medium text-slate-700 border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                Makan / org
              </td>
              {monthKeys.map((ym) => (
                <td key={`meal-${ym}`} className="align-top border-b border-slate-50">
                  <MonthlyReadonlyPriceCell sar={mealByYm.get(ym) ?? null} gridRates={gridRates} />
                </td>
              ))}
            </tr>
          ) : null}
          {(isPerPack ? [perPackSourceRoomType] : ROOM_TYPES).map((rt) => {
            const block = byRoomTypeDisplay[rt];
            const roomByYm = new Map((block?.months || []).map((m) => [m.year_month, m.sar_room_per_night]));
            return (
              <tr key={rt} className="border-b border-slate-100 last:border-0">
                <td className="sticky left-0 z-0 bg-white px-2 py-1 font-medium text-slate-800 border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                  {isPerPack ? 'Per pack' : (ROOM_TYPE_LABELS[rt] || rt)}
                </td>
                {monthKeys.map((ym) => (
                  <td key={`${rt}-${ym}`} className="align-top">
                    <MonthlyReadonlyPriceCell sar={roomByYm.get(ym) ?? null} gridRates={gridRates} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {isFullboard ? (
        <p className="text-[10px] text-slate-500 px-2 py-1 border-t border-slate-100 bg-white/80">
          {isPerPack ? 'Harga per pack' : 'Makan termasuk (fullboard)'} · {roomYearDisplay ?? ''}
        </p>
      ) : (
        <p className="text-[10px] text-slate-400 px-2 py-1 border-t border-slate-100 bg-white/80">
          {isPerPack ? 'Harga per pack per malam menginap (bukan total sebulan)' : 'Per malam menginap (bukan total sebulan)'} · {roomYearDisplay ?? ''}
        </p>
      )}
    </div>
  );
}

function parseSarInputString(s: string): number {
  const t = String(s ?? '').replace(/\./g, '').replace(',', '.').trim();
  if (t === '' || t === '-') return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Samakan logika backend `hotelMonthlyRowToSar`: satu nilai SAR per baris grid. */
function monthlyRowAmountToSar(
  amount: number,
  currency: string,
  rates: { SAR_TO_IDR: number; USD_TO_IDR: number }
): number | null {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return null;
  const c = String(currency || 'IDR').toUpperCase();
  const s2i = rates.SAR_TO_IDR || 4200;
  const u2i = rates.USD_TO_IDR || 15500;
  if (c === 'SAR') return Math.round(n * 100) / 100;
  if (c === 'IDR') return Math.round((n / s2i) * 100) / 100;
  if (c === 'USD') return Math.round(((n * u2i) / s2i) * 100) / 100;
  return null;
}

function monthlyCurrencyRank(currency: string): number {
  const u = String(currency || '').toUpperCase();
  if (u === 'SAR') return 0;
  if (u === 'USD') return 1;
  if (u === 'IDR') return 2;
  return 3;
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
    room_pricing_mode?: 'per_room' | 'per_person';
    pricing_mode?: 'single' | 'per_type';
    mou_fullboard_auto_calc?: boolean;
    mou_manual_has_meal?: boolean;
    owner_meal_mode?: Partial<Record<OwnerPriceType, OwnerMealMode>>;
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
  /** Harga kamar per bulan per tipe (double … quint). */
  hotel_monthly_series_by_room_type?: {
    year: string;
    by_room_type: Record<string, { months: Array<{ year_month: string; sar_room_per_night: number | null }> }>;
  } | null;
  hotel_monthly_series_by_owner_type?: {
    year: string;
    by_owner_type: {
      mou?: {
        by_room_type?: Record<string, { months: Array<{ year_month: string; sar_room_per_night: number | null }> }>;
        meal_months?: Array<{ year_month: string; sar_meal_per_person_per_night: number | null }>;
      };
      non_mou?: {
        by_room_type?: Record<string, { months: Array<{ year_month: string; sar_room_per_night: number | null }> }>;
        meal_months?: Array<{ year_month: string; sar_meal_per_person_per_night: number | null }>;
      };
    };
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
  /** Form Tambah/Edit Hotel: hanya nama, lokasi, type allotment. Meal diatur di Pengaturan Jumlah Kamar. */
  const [addForm, setAddForm] = useState({
    name: '',
    location: 'makkah' as 'makkah' | 'madinah',
    allotment_type: 'allotment' as 'allotment' | 'non_allotment',
    room_pricing_mode: 'per_room' as 'per_room' | 'per_person'
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
  const [globalRoomInventory, setGlobalRoomInventory] = useState<Record<string, number>>({ double: 0, triple: 0, quad: 0, quint: 0 });
  const [hotelAvailabilityConfigLoading, setHotelAvailabilityConfigLoading] = useState(false);
  const [hotelAvailabilityConfigSaving, setHotelAvailabilityConfigSaving] = useState(false);
  const [monthlyPriceYear, setMonthlyPriceYear] = useState<string>(String(new Date().getFullYear()));
  const [monthlyPriceLoading, setMonthlyPriceLoading] = useState(false);
  const [monthlyPriceRowsByOwnerType, setMonthlyPriceRowsByOwnerType] = useState<Record<OwnerPriceType, Record<string, Record<string, string>>>>({ mou: {}, non_mou: {} });
  /** Harga makan SAR per orang per malam per bulan (room only) */
  const [monthlyMealByMonthByOwnerType, setMonthlyMealByMonthByOwnerType] = useState<Record<OwnerPriceType, Record<string, string>>>({ mou: {}, non_mou: {} });
  const [ownerMealModeByOwnerType, setOwnerMealModeByOwnerType] = useState<Record<OwnerPriceType, OwnerMealMode>>({ mou: 'with_meal', non_mou: 'with_meal' });
  /** Tabel harga di daftar hotel: tampilkan semua / MOU / Non-MOU sesuai tombol pilihan. */
  const [ownerPriceViewByHotel, setOwnerPriceViewByHotel] = useState<Record<string, OwnerPriceView>>({});
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
  type AvailabilityAddQuantity = {
    dateStr: string;
    seasonId: string;
    seasonName: string;
    mode: 'global' | 'per_season';
    roomTypes: Record<string, { total: number; booked: number; available: number }>;
  };
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
  const getMouDerivedSar = useCallback((roomType: string, ym: string): number | null => {
    void roomType;
    void ym;
    return null;
  }, []);
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

  const initMonthlyRowsByOwnerType = (year = monthlyPriceYear): Record<OwnerPriceType, Record<string, Record<string, string>>> => ({
    mou: initMonthlyRows(year),
    non_mou: initMonthlyRows(year)
  });

  const initMonthlyMealByOwnerType = (year: string): Record<OwnerPriceType, Record<string, string>> => ({
    mou: initMonthlyMeal(year),
    non_mou: initMonthlyMeal(year)
  });

  /** Harga bulanan (SAR): muat saat modal Pengaturan Jumlah Kamar terbuka */
  useEffect(() => {
    if (!seasonsModalHotel || !/^\d{4}$/.test(monthlyPriceYear)) return;
    let cancelled = false;
    (async () => {
      setMonthlyPriceLoading(true);
      try {
        const res = await productsApi.getHotelMonthlyPrices(seasonsModalHotel.id, { year: monthlyPriceYear });
        const data = (res.data as { data?: Array<{ year_month: string; room_type: string; currency: string; amount: number; with_meal: boolean; component?: string; owner_type_scope?: OwnerPriceType | 'all' }> })?.data || [];
        const next = initMonthlyRowsByOwnerType(monthlyPriceYear);
        const mealNext = initMonthlyMealByOwnerType(monthlyPriceYear);
        const gridRates = { SAR_TO_IDR: currencyRates.SAR_TO_IDR ?? 4200, USD_TO_IDR: currencyRates.USD_TO_IDR ?? 15500 };
        const mealBest: Record<OwnerPriceType, Map<string, { sar: number; rank: number }>> = {
          mou: new Map(),
          non_mou: new Map()
        };
        const roomBest: Record<OwnerPriceType, Map<string, { sar: number; rank: number }>> = {
          mou: new Map(),
          non_mou: new Map()
        };
        data.forEach((r) => {
          const comp = r.component || 'room';
          const rank = monthlyCurrencyRank(r.currency);
          const sar = monthlyRowAmountToSar(Number(r.amount), r.currency, gridRates);
          if (sar == null || sar <= 0) return;
          const scope = String(r.owner_type_scope || 'all').toLowerCase();
          const targetOwnerTypes: OwnerPriceType[] =
            scope === 'mou' ? ['mou']
              : scope === 'non_mou' ? ['non_mou']
                : ['mou', 'non_mou'];
          if (comp === 'meal' || r.room_type === '__meal__') {
            targetOwnerTypes.forEach((ot) => {
              const prev = mealBest[ot].get(r.year_month);
              if (!prev || rank < prev.rank) mealBest[ot].set(r.year_month, { sar, rank });
            });
            return;
          }
          if (comp !== 'room') return;
          const slotKey = `${r.room_type}:${r.year_month}`;
          targetOwnerTypes.forEach((ot) => {
            const prev = roomBest[ot].get(slotKey);
            if (!prev || rank < prev.rank) roomBest[ot].set(slotKey, { sar, rank });
          });
        });
        OWNER_PRICE_TYPES.forEach((ot) => {
          mealBest[ot].forEach(({ sar }, ym) => {
            mealNext[ot][ym] = sar > 0 ? formatSarId(sar) : '';
          });
          roomBest[ot].forEach(({ sar }, slotKey) => {
            const colon = slotKey.indexOf(':');
            if (colon < 0) return;
            const rt = slotKey.slice(0, colon);
            const ym = slotKey.slice(colon + 1);
            if (next[ot][rt] && next[ot][rt][ym] !== undefined) next[ot][rt][ym] = sar > 0 ? formatSarId(sar) : '';
          });
        });
        if (!cancelled) {
          setMonthlyPriceRowsByOwnerType(next);
          setMonthlyMealByMonthByOwnerType(mealNext);
        }
      } catch {
        if (!cancelled) {
          setMonthlyPriceRowsByOwnerType(initMonthlyRowsByOwnerType(monthlyPriceYear));
          setMonthlyMealByMonthByOwnerType(initMonthlyMealByOwnerType(monthlyPriceYear));
        }
      } finally {
        if (!cancelled) setMonthlyPriceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- init helpers stabil untuk year yang sama
  }, [seasonsModalHotel?.id, monthlyPriceYear, currencyRates.SAR_TO_IDR, currencyRates.USD_TO_IDR]);

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
          setGlobalRoomInventory(configData.global_room_inventory || { double: 0, triple: 0, quad: 0, quint: 0 });
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
        const ownerMealModeRaw = (meta.owner_meal_mode as Record<string, unknown> | undefined) || {};
        setOwnerMealModeByOwnerType({
          mou: ownerMealModeRaw.mou === 'fullboard' ? 'fullboard' : 'with_meal',
          non_mou: ownerMealModeRaw.non_mou === 'fullboard' ? 'fullboard' : 'with_meal'
        });
      })
      .catch(() => {})
      .finally(() => setHotelAvailabilityConfigLoading(false));
  };

  /** Buka satu modal: Jumlah Kamar & Musim (gabungan Pengaturan Jumlah + Data per Musim) */
  const handleOpenUnifiedQuantityAndSeasonsModal = (hotel: HotelProduct) => {
    if (!canAddHotel) return;
    setSeasonsModalHotel(hotel);
    const meta = (hotel.meta as Record<string, unknown> | undefined) || {};
    const ownerMealModeRaw = (meta.owner_meal_mode as Record<string, unknown> | undefined) || {};
    setOwnerMealModeByOwnerType({
      mou: ownerMealModeRaw.mou === 'fullboard' ? 'fullboard' : 'with_meal',
      non_mou: ownerMealModeRaw.non_mou === 'fullboard' ? 'fullboard' : 'with_meal'
    });
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
        const meta = (hotel.meta as Record<string, unknown> | undefined) || {};
        const ownerMealModeRaw = (meta.owner_meal_mode as Record<string, unknown> | undefined) || {};
        setOwnerMealModeByOwnerType({
          mou: ownerMealModeRaw.mou === 'fullboard' ? 'fullboard' : 'with_meal',
          non_mou: ownerMealModeRaw.non_mou === 'fullboard' ? 'fullboard' : 'with_meal'
        });
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
      { id: 'type', label: 'Type', align: 'left' },
      { id: 'currency', label: 'Mata Uang', align: 'center' },
      {
        id: 'monthly_tariff',
        label: `Tarif per malam (${hotelListMonthlyYear}) · per bulan kalender · IDR / SAR / USD`,
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

  /** Fetch availability realtime (30 hari): pakai tanggal lokal agar tidak bergeser seperti toISOString() (WIB). */
  const availabilityFrom = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();
  const availabilityTo = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 30);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();
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

  const handleSaveAvailabilityAddQuantity = useCallback(async () => {
    if (!availabilityPopupHotelId || !availabilityAddQuantity) return;
    setAvailabilityAddQuantitySaving(true);
    try {
      const inventory = ROOM_TYPES.map((rt) => {
        const current = availabilityAddQuantity.roomTypes[rt]?.total ?? 0;
        const addVal = Math.max(0, parseInt(availabilityAddQuantityInputs[rt] ?? '', 10) || 0);
        return { room_type: rt, total_rooms: current + addVal };
      });
      if (availabilityAddQuantity.mode === 'global') {
        const global_room_inventory: Record<string, number> = {};
        inventory.forEach((row) => {
          global_room_inventory[row.room_type] = row.total_rooms;
        });
        await adminPusatApi.setHotelAvailabilityConfig(availabilityPopupHotelId, {
          availability_mode: 'global',
          global_room_inventory
        });
        showToast('Kuota kamar (semua bulan) berhasil diperbarui', 'success');
      } else {
        await adminPusatApi.setSeasonInventory(availabilityPopupHotelId, availabilityAddQuantity.seasonId, { inventory });
        showToast('Inventori musim berhasil diperbarui', 'success');
      }
      setAvailabilityAddQuantity(null);
      refetchAvailabilityForHotel(availabilityPopupHotelId);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan inventori', 'error');
    } finally {
      setAvailabilityAddQuantitySaving(false);
    }
  }, [
    availabilityPopupHotelId,
    availabilityAddQuantity,
    availabilityAddQuantityInputs,
    showToast,
    refetchAvailabilityForHotel
  ]);

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

  const handleOpenAdd = () => {
    setEditingHotel(null);
    setAddForm({
      name: '',
      location: 'makkah',
      allotment_type: 'allotment',
      room_pricing_mode: 'per_room'
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
        room_pricing_mode: (meta.room_pricing_mode as 'per_room' | 'per_person') || 'per_room'
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
          pricing_mode: 'per_type',
          room_types: ROOM_TYPES,
          owner_meal_mode: ownerMealModeByOwnerType
        }
      });

      await adminPusatApi.setProductAvailability(hotel.id, { quantity: totalQty, meta: { room_types: roomMeta } });
      await adminPusatApi.setHotelAvailabilityConfig(hotel.id, { availability_mode: 'global' });

      if (/^\d{4}$/.test(monthlyPriceYear)) {
        const ymKeys = getMonthKeys(monthlyPriceYear);
        const hasRoomPriceInMonth = (ownerTypeScope: OwnerPriceType, m: string) =>
          ROOM_TYPES.some((rt) => parseSarInputString(monthlyPriceRowsByOwnerType?.[ownerTypeScope]?.[rt]?.[m] ?? '') > 0);
        for (const ownerTypeScope of OWNER_PRICE_TYPES) {
          if (ownerMealModeByOwnerType[ownerTypeScope] === 'fullboard') continue;
          for (const m of ymKeys) {
            if (!hasRoomPriceInMonth(ownerTypeScope, m)) continue;
            const nm = parseSarInputString(monthlyMealByMonthByOwnerType?.[ownerTypeScope]?.[m] ?? '');
            if (!(nm > 0)) {
              showToast(`Harga makan wajib diisi untuk ${OWNER_PRICE_LABELS[ownerTypeScope]} bulan ${formatMonthLabelId(m)}.`, 'error');
              return;
            }
          }
        }
        const monthlyRowsPayload: Array<{
          year_month: string;
          room_type: 'double' | 'triple' | 'quad' | 'quint' | string;
          with_meal: boolean;
          amount: number;
          currency: 'SAR';
          component: 'room' | 'meal';
          owner_type_scope: OwnerPriceType;
        }> = [];
        OWNER_PRICE_TYPES.forEach((ownerTypeScope) => {
          ROOM_TYPES.forEach((rt) => {
            ymKeys.forEach((m) => {
              const n = parseSarInputString(monthlyPriceRowsByOwnerType?.[ownerTypeScope]?.[rt]?.[m] ?? '');
              const derived = ownerTypeScope === 'mou' ? getMouDerivedSar(rt, m) : null;
              monthlyRowsPayload.push({
                year_month: m,
                room_type: rt,
                with_meal: false,
                amount: derived != null ? derived : n,
                currency: 'SAR',
                component: 'room',
                owner_type_scope: ownerTypeScope
              });
            });
          });
        });
        OWNER_PRICE_TYPES.forEach((ownerTypeScope) => {
          ymKeys.forEach((m) => {
            const nm = parseSarInputString(monthlyMealByMonthByOwnerType?.[ownerTypeScope]?.[m] ?? '');
            monthlyRowsPayload.push({
              year_month: m,
              room_type: '__meal__',
              with_meal: false,
              amount: ownerMealModeByOwnerType[ownerTypeScope] === 'fullboard' ? 0 : nm,
              currency: 'SAR',
              component: 'meal',
              owner_type_scope: ownerTypeScope
            });
          });
        });
        await productsApi.saveHotelMonthlyPricesBulk(hotel.id, { rows: monthlyRowsPayload });
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
        room_pricing_mode: addForm.room_pricing_mode,
        pricing_mode: 'per_type'
      };
      await productsApi.createHotel({
        name: addForm.name.trim(),
        meta: { ...meta, currency: 'SAR' }
      });
      showToast('Hotel berhasil ditambahkan. Buka "Pengaturan" untuk kapasitas dan grid tarif per malam (SAR) per bulan kalender.', 'success');
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
        room_pricing_mode: addForm.room_pricing_mode
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
            const tripleMeal = fillFromSource(cur, mealPrice, currencyRates);
            const md = hotel.hotel_monthly_display;
            const isFullboardPlan = false;
            const isFullboardView = false;
            /** SAR per malam dari grid bulanan (sumber utama tabel) */
            const monthlyRoomSar =
              md?.sar_room_only;
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
            const isPerPackHotel = hotel.meta?.room_pricing_mode === 'per_person';
            const gridRates = { SAR_TO_IDR: currencyRates.SAR_TO_IDR ?? 4200, USD_TO_IDR: currencyRates.USD_TO_IDR ?? 15500 };
            const series = hotel.hotel_monthly_series;
            const mealMonthsList = hotel.hotel_monthly_meal_months?.months ?? series?.months;
            const mealYearLabel = hotel.hotel_monthly_meal_months?.year ?? series?.year;
            const byRoomType = hotel.hotel_monthly_series_by_room_type?.by_room_type;
            const roomTypesYear = hotel.hotel_monthly_series_by_room_type?.year;
            const ownerSeries = hotel.hotel_monthly_series_by_owner_type?.by_owner_type;
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
                  <div className="text-xs text-slate-600 font-medium">
                    {hotel.meta?.allotment_type === 'non_allotment' ? 'Non allotment' : hotel.meta?.allotment_type === 'allotment' ? 'Allotment' : '-'}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-center text-sm text-slate-700 align-middle">{cur}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700 align-top">
                  {ownerSeries?.mou?.by_room_type || ownerSeries?.non_mou?.by_room_type ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {([
                          { id: 'all', label: 'Semua' },
                          { id: 'mou', label: 'Owner MOU' },
                          { id: 'non_mou', label: 'Owner Non-MOU' }
                        ] as Array<{ id: OwnerPriceView; label: string }>).map((opt) => {
                          const active = (ownerPriceViewByHotel[hotel.id] || 'all') === opt.id;
                          return (
                            <button
                              key={`${hotel.id}-owner-view-${opt.id}`}
                              type="button"
                              onClick={() => setOwnerPriceViewByHotel((prev) => ({ ...prev, [hotel.id]: opt.id }))}
                              className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                                active
                                  ? 'bg-[#0D1A63] text-white border-[#0D1A63]'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#0D1A63]/40'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      {(['mou', 'non_mou'] as const).map((ownerType) => {
                        const selected = ownerPriceViewByHotel[hotel.id] || 'all';
                        if (selected !== 'all' && selected !== ownerType) return null;
                        const ownerByRoom = ownerSeries?.[ownerType]?.by_room_type as HotelMonthlyByRoomTypeMap | undefined;
                        if (!ownerByRoom) return null;
                        const ownerMealMonths = ownerSeries?.[ownerType]?.meal_months || [];
                        const ownerMonthKeys = (() => {
                          for (const rt of ROOM_TYPES) {
                            const mo = ownerByRoom[rt]?.months;
                            if (mo?.length) return mo.map((m) => m.year_month);
                          }
                          return Array.from({ length: 12 }, (_, i) => `${hotelListMonthlyYear}-${String(i + 1).padStart(2, '0')}`);
                        })();
                        return (
                          <div key={`${hotel.id}-${ownerType}`} className="rounded-md border border-slate-200 bg-slate-50/70 px-2 py-2">
                            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                              List harga {ownerType === 'mou' ? 'Owner MOU' : 'Owner Non-MOU'}
                            </p>
                            {renderHotelListMonthlyMatrixTable({
                              monthKeys: ownerMonthKeys,
                              isFullboard: isFullboardView,
                              mealMonthsList: isFullboardView ? [] : ownerMealMonths,
                              byRoomTypeDisplay: ownerByRoom,
                              gridRates,
                              roomYearDisplay: hotel.hotel_monthly_series_by_owner_type?.year,
                              roomPricingMode: hotel.meta?.room_pricing_mode
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : byRoomTypeDisplay ? (
                    <div className="min-w-0 space-y-2">
                      {(() => {
                        const monthKeysForMatrix = (() => {
                          for (const rt of ROOM_TYPES) {
                            const mo = byRoomTypeDisplay[rt]?.months;
                            if (mo?.length) return mo.map((m) => m.year_month);
                          }
                          return Array.from({ length: 12 }, (_, i) => `${hotelListMonthlyYear}-${String(i + 1).padStart(2, '0')}`);
                        })();
                        return renderHotelListMonthlyMatrixTable({
                          monthKeys: monthKeysForMatrix,
                          isFullboard: isFullboardView,
                          mealMonthsList: isFullboardView ? [] : mealMonthsList,
                          byRoomTypeDisplay,
                          gridRates,
                          roomYearDisplay,
                          roomPricingMode: hotel.meta?.room_pricing_mode
                        });
                      })()}
                      {!isFullboardView && !(mealMonthsList?.length) ? (
                        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs space-y-1">
                          <p className="text-[10px] font-semibold text-slate-500">Makan (ringkas / fallback)</p>
                          {md?.sar_meal_per_person_per_night != null && md.sar_meal_per_person_per_night > 0 ? (
                            (() => {
                              const tm = fillFromSource('SAR', md.sar_meal_per_person_per_night as number, currencyRates);
                              const t = getPriceTripleForTable(tm.idr, tm.sar, tm.usd);
                              return (
                                <>
                                  <div className="tabular-nums font-medium">{t.idrText}</div>
                                  <div className="text-[10px] text-slate-500"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                                  <span className="text-slate-500 text-[10px] block">per orang · grid SAR · {gridMonthLabel || md.year_month}</span>
                                </>
                              );
                            })()
                          ) : tripleMealFromMonthlyDelta ? (
                            (() => {
                              const t = getPriceTripleForTable(tripleMealFromMonthlyDelta.idr, tripleMealFromMonthlyDelta.sar, tripleMealFromMonthlyDelta.usd);
                              return (
                                <>
                                  <div className="tabular-nums font-medium">{t.idrText}</div>
                                  <div className="text-[10px] text-slate-500"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                                  <span className="text-slate-500 text-[10px] block">per kamar · selisih grid SAR · {gridMonthLabel}</span>
                                </>
                              );
                            })()
                          ) : (() => {
                            const t = getPriceTripleForTable(tripleMeal.idr, tripleMeal.sar, tripleMeal.usd);
                            if (!t.hasPrice) return <span className="text-slate-400 text-[10px]">– · {mealType}</span>;
                            return (
                              <>
                                <div className="tabular-nums font-medium">{t.idrText}</div>
                                <div className="text-[10px] text-slate-500"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                                <span className="text-slate-500 text-[10px] block">
                                  per orang · {mealType}
                                  {hasMonthlyRoom ? <span> · selain kamar (grid {gridMonthLabel})</span> : null}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-md">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Makan</p>
                        {false ? (
                          <><span className="text-slate-600 font-medium">–</span><span className="text-slate-500 text-xs block mt-0.5">Termasuk (fullboard)</span></>
                        ) : mealMonthsList?.length ? (
                          <div className="rounded-md border border-slate-100 bg-slate-50/60 px-1 py-1 text-xs overflow-x-auto">
                            <table className="w-full text-[10px] min-w-[280px] border-collapse">
                              <thead>
                                <tr>
                                  {mealMonthsList.map((m) => (
                                    <th key={m.year_month} className="px-0.5 py-0.5 font-medium text-slate-600 text-center">
                                      {formatMonthShortId(m.year_month)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  {mealMonthsList.map((m) => (
                                    <td key={m.year_month} className="align-top px-0.5">
                                      <MonthlyReadonlyPriceCell
                                        sar={m.sar_meal_per_person_per_night}
                                        gridRates={gridRates}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
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
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Kamar</p>
                        {tripleRoomFromMonthly ? (
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
                        ) : (
                          (() => {
                            const repPrice =
                              Number(
                                breakdown.double?.price ??
                                  breakdown.triple?.price ??
                                  breakdown.quad?.price ??
                                  breakdown.quint?.price ??
                                  hotel.price_branch ??
                                  hotel.price_general ??
                                  0
                              ) || 0;
                            const tr = fillFromSource(cur, repPrice, currencyRates);
                            const t = getPriceTripleForTable(tr.idr, tr.sar, tr.usd);
                            if (!t.hasPrice) return <><span className="text-slate-400">–</span><span className="text-slate-500 text-xs block">{roomPriceType}</span></>;
                            return (
                              <>
                                <div className="tabular-nums font-semibold">{t.idrText}</div>
                                <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400 ml-1">USD:</span> {t.usdText}</div>
                                <span className="text-slate-500 text-xs block mt-0.5">per kamar · default · {roomPriceType}</span>
                              </>
                            );
                          })()
                        )}
                      </div>
                    </div>
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
                        {isPerPackHotel ? (
                          (() => {
                            const perPackAvailable = Object.values(avail.byRoomType).reduce((mx, n) => Math.max(mx, Number(n) || 0), 0);
                            return (
                              <div
                                className={`shrink-0 rounded-lg border px-2 py-1.5 min-w-[84px] ${perPackAvailable === 0 ? 'border-red-200 bg-red-50/80' : 'border-emerald-200 bg-emerald-50/80'}`}
                              >
                                <p className="text-[10px] font-medium text-slate-500 uppercase">Per pack</p>
                                {perPackAvailable === 0 ? (
                                  <p className="text-xs font-bold text-red-600">Penuh</p>
                                ) : (
                                  <p className="text-xs font-bold text-emerald-600 tabular-nums">{perPackAvailable}</p>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          Object.entries(avail.byRoomType).map(([rt, n]) => {
                            const isFullboard = false;
                            const showPriceHere = isFullboard;
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
                          })
                        )}
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
                          const roomTypes: Array<'double'|'triple'|'quad'|'quint'> = ['double', 'triple', 'quad', 'quint'];
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
                          ...(canAddHotel ? [{ id: 'seasons', label: 'Pengaturan', icon: <Bed className="w-4 h-4" />, onClick: () => handleOpenUnifiedQuantityAndSeasonsModal(hotel) }] : []),
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
        const availabilityMode: 'global' | 'per_season' =
          availData && typeof availData === 'object' && availData.availability_mode === 'global' ? 'global' : 'per_season';
        const dateKeys = Object.keys(byDate).sort();
        const formatDateLabel = (s: string) => {
          const d = new Date(s + 'T12:00:00');
          return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        };
        const roomTypeLabels: Record<string, string> = { double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint', single: 'Double' };
        const popupCurrency = (hotel?.currency || hotel?.meta?.currency || 'IDR') as 'IDR' | 'SAR' | 'USD';
        const popupCurrInfo = CURRENCY_OPTIONS.find((c) => c.id === popupCurrency) || CURRENCY_OPTIONS[0];
        const formatPrice = (n: number) => (n > 0 ? `${popupCurrInfo.symbol} ${Number(n).toLocaleString(popupCurrInfo.locale)}` : '—');
        const roomPriceTypeLabel = 'per malam';
        const breakdown = hotel?.room_breakdown || hotel?.prices_by_room || {};
        return (
          <Modal
            open
            onClose={() => {
              setAvailabilityAddQuantity(null);
              setAvailabilityPopupHotelId(null);
            }}
          >
            <ModalBoxLg>
              <ModalHeader
                title="Ketersediaan per tanggal"
                subtitle={<>{(hotel?.name ?? 'Hotel')} — data realtime per tipe kamar</>}
                icon={<Calendar className="w-5 h-5" />}
                onClose={() => {
                  setAvailabilityAddQuantity(null);
                  setAvailabilityPopupHotelId(null);
                }}
              />
              <ModalBody className="p-6 overflow-y-auto flex-1 min-h-0">
                {/* Harga kamar per malam per tipe (referensi; operasional dari grid bulanan SAR) */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
                  <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
                    <h4 className="text-sm font-semibold text-slate-800">Harga kamar {roomPriceTypeLabel}</h4>
                  </div>
                  <div className="px-4 py-3">
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
                                if (!rec || !availabilityPopupHotelId) return;
                                if (availabilityMode === 'per_season' && !seasonId) return;
                                const roomTypes: Record<string, { total: number; booked: number; available: number }> = {};
                                ROOM_TYPES.forEach((rt) => {
                                  const r = rec[rt];
                                  roomTypes[rt] = r ? { total: r.total ?? 0, booked: r.booked ?? 0, available: r.available ?? 0 } : { total: 0, booked: 0, available: 0 };
                                });
                                setAvailabilityAddQuantity({
                                  dateStr,
                                  seasonId: seasonId || '',
                                  seasonName: seasonName || (availabilityMode === 'global' ? 'Semua bulan' : ''),
                                  mode: availabilityMode,
                                  roomTypes
                                });
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
                                    const showAddBtn = canAddHotel && (isFull || isAlmostFull) && (availabilityMode === 'global' || !!seasonId);
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

              </ModalBody>
            </ModalBoxLg>
          </Modal>
        );
      })()}

      {availabilityAddQuantity && availabilityPopupHotelId && (
        <HotelAddRoomQuantityModal
          open
          zIndex={60}
          saving={availabilityAddQuantitySaving}
          onClose={() => !availabilityAddQuantitySaving && setAvailabilityAddQuantity(null)}
          dateStr={availabilityAddQuantity.dateStr}
          seasonName={availabilityAddQuantity.seasonName}
          helpText="Isi jumlah tambahan per tipe. Total baru = total saat ini + tambahan."
          rows={ROOM_TYPES.map((rt) => {
            const r = availabilityAddQuantity.roomTypes[rt];
            return {
              roomType: rt,
              total: r?.total ?? 0,
              booked: r?.booked ?? 0,
              available: r?.available ?? 0
            };
          })}
          addInputs={availabilityAddQuantityInputs}
          onAddInputChange={(rt, v) => setAvailabilityAddQuantityInputs((prev) => ({ ...prev, [rt]: v }))}
          onSave={handleSaveAvailabilityAddQuantity}
        />
      )}

      {showAddModal && (
        <Modal open onClose={() => !saving && !editFormLoading && (setShowAddModal(false), setEditingHotel(null))}>
          <ModalBox>
            <ModalHeader
              title={editingHotel ? 'Edit Hotel' : 'Tambah Hotel Baru'}
              subtitle="Isi data hotel. Kapasitas dan tarif kamar diatur di Pengaturan: SAR per malam menginap, diisi per bulan kalender (bukan total sewa satu bulan penuh)."
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

              {/* Type */}
              <div className="grid grid-cols-1 gap-4">
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
                  <label className="block text-sm font-medium text-slate-700 mb-3">Mode harga kamar</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, room_pricing_mode: 'per_room' }))}
                      className={`w-full py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                        addForm.room_pricing_mode === 'per_room'
                          ? 'bg-btn text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:border-btn hover:bg-btn-light'
                      }`}
                    >
                      Per room
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, room_pricing_mode: 'per_person' }))}
                      className={`w-full py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                        addForm.room_pricing_mode === 'per_person'
                          ? 'bg-btn text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:border-btn hover:bg-btn-light'
                      }`}
                    >
                      Per orang
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
              title="Pengaturan"
              subtitle={seasonsModalHotel.name}
              icon={<Bed className="w-5 h-5" />}
              onClose={() => !seasonSaving && !inventorySaving && !hotelAvailabilityConfigSaving && !quantityFormSaving && !monthlyPriceLoading && setSeasonsModalHotel(null)}
            />

            <ModalBody className="p-6 overflow-y-auto flex-1">
              {hotelAvailabilityConfigLoading ? (
                <p className="text-sm text-slate-500">{CONTENT_LOADING_MESSAGE}</p>
              ) : (
                (() => {
                  const isPerPackMode = seasonsModalHotel?.meta?.room_pricing_mode === 'per_person';
                  const totalRooms = ROOM_TYPES.reduce((s, rt) => s + Math.max(0, parseInt(quantityForm[rt] ?? '', 10) || 0), 0);
                  const perPackQty = Math.max(0, parseInt(quantityForm.double ?? '', 10) || 0);
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
                          <li>{isPerPackMode ? 'Isi kapasitas per pack.' : 'Isi kapasitas per tipe kamar.'}</li>
                          <li>
                            Isi <strong className="font-medium text-slate-800">tarif kamar SAR per malam</strong> untuk tiap kolom bulan kalender (mis. Januari = harga satu malam menginap jika tanggal inap jatuh di Januari).{' '}
                            <span className="text-slate-500">Bukan total sewa hotel untuk sebulan penuh.</span> Kolom kosong memakai fallback harga lama di sistem jika ada.
                          </li>
                          <li>
                            Makan: isi <strong className="font-medium text-slate-800">harga makan SAR per orang per malam</strong> dengan pola yang sama per bulan kalender.
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
                                {isPerPackMode ? 'Kapasitas pack' : 'Kapasitas kamar'}
                              </h3>
                              <p className="text-xs text-slate-500 mt-1">
                                {isPerPackMode ? 'Jumlah pack siap dijual.' : 'Jumlah kamar siap dijual untuk setiap tipe.'}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-btn-light px-3 py-2 sm:justify-center sm:min-w-[9rem]">
                            <span className="text-xs font-medium text-slate-600 sm:hidden">Total</span>
                            <span className="text-sm font-semibold tabular-nums text-[#0D1A63]">
                              <span className="hidden sm:inline">Total: </span>
                              {isPerPackMode ? `${perPackQty} pack` : `${totalRooms} kamar`}
                            </span>
                          </div>
                        </div>
                        {isPerPackMode ? (
                          <div className="mt-3 w-full">
                            <div className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-3.5 focus-within:ring-2 focus-within:ring-[#0D1A63]/25 focus-within:border-[#0D1A63]/40 transition-shadow">
                              <label className="block text-xs font-medium text-slate-600 mb-2">Per pack</label>
                              <Input
                                type="number"
                                min={0}
                                value={quantityForm.double ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (!(v === '' || /^\d*$/.test(v))) return;
                                  setQuantityForm((prev) => ({
                                    ...prev,
                                    ...Object.fromEntries(ROOM_TYPES.map((rt) => [rt, v]))
                                  }));
                                }}
                                placeholder="0"
                                className="tabular-nums"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                        )}
                      </section>

                      <section
                        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
                        aria-labelledby="hotel-qty-monthly-heading"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex gap-3 min-w-0 flex-1">
                            {stepBadge(2)}
                            <div className="min-w-0">
                              <h3 id="hotel-qty-monthly-heading" className="text-sm font-semibold text-slate-900">
                                Tarif per malam (SAR) per bulan kalender
                              </h3>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Tagihan menginap dihitung <strong className="font-medium text-slate-700">per malam</strong>. Setiap sel = <strong className="font-medium text-slate-700">SAR untuk satu malam menginap</strong> {seasonsModalHotel?.meta?.room_pricing_mode === 'per_person' ? 'per pack' : 'per kamar untuk tipe baris tersebut'}, berlaku untuk malam yang jatuh pada bulan kolom (bukan total sewa satu bulan penuh). Di bawah sel: perkiraan IDR/USD mengikuti kurs pengaturan. Kosongkan bulan yang memakai fallback (data harga lama di sistem, jika ada).
                              </p>
                              <p className="text-xs text-slate-500 mt-2">
                                Mata uang grid: <strong className="font-medium text-slate-700">SAR</strong>.
                              </p>
                              <p className="mt-2 text-xs text-slate-500 flex items-start gap-1.5">
                                <span className="text-slate-400 select-none" aria-hidden>↔</span>
                                <span>Tabel lebar: gunakan scroll horizontal di layar kecil.</span>
                              </p>
                              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 leading-relaxed">
                                Pengaturan disederhanakan: hanya harga <strong>Owner MOU</strong>, <strong>Owner Non-MOU</strong>, dan <strong>harga makan</strong> per bulan.
                              </div>
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
                        <div className="mt-4 grid grid-cols-1 gap-4">
                          {OWNER_PRICE_TYPES.map((ownerTypeScope) => (
                            <div key={ownerTypeScope} className="rounded-xl border border-slate-200 p-3 bg-slate-50/40">
                              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h4 className="text-xs font-semibold text-[#0D1A63] uppercase tracking-wide">
                                List harga {OWNER_PRICE_LABELS[ownerTypeScope]}
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setOwnerMealModeByOwnerType((prev) => ({ ...prev, [ownerTypeScope]: 'with_meal' }))}
                                    className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                                      ownerMealModeByOwnerType[ownerTypeScope] === 'with_meal'
                                        ? 'bg-[#0D1A63] text-white border-[#0D1A63]'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#0D1A63]/40'
                                    }`}
                                  >
                                    Pakai makan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOwnerMealModeByOwnerType((prev) => ({ ...prev, [ownerTypeScope]: 'fullboard' }))}
                                    className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                                      ownerMealModeByOwnerType[ownerTypeScope] === 'fullboard'
                                        ? 'bg-[#0D1A63] text-white border-[#0D1A63]'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#0D1A63]/40'
                                    }`}
                                  >
                                    Fullboard
                                  </button>
                                </div>
                              </div>
                              <p className="mb-2 text-[11px] text-slate-600">
                                {ownerMealModeByOwnerType[ownerTypeScope] === 'with_meal'
                                  ? 'Mode aktif: Pakai makan. Tabel makan ditampilkan.'
                                  : 'Mode aktif: Fullboard (sudah termasuk makan). Tabel makan disembunyikan.'}
                              </p>
                              <div className="w-full min-w-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 max-h-[min(420px,55vh)] overscroll-x-contain touch-pan-x bg-white">
                                <table className="w-full text-sm min-w-[1100px]">
                                  <thead className="sticky top-0 z-[3]">
                                    <tr className="bg-slate-100 border-b border-slate-200 shadow-sm">
                                      <th className="text-left px-3 py-2.5 font-semibold text-slate-700 sticky left-0 bg-slate-100 z-[4] border-r border-slate-200/80">
                                        {seasonsModalHotel?.meta?.room_pricing_mode === 'per_person' ? 'Harga' : 'Tipe'}
                                      </th>
                                      {monthKeys.map((m) => (
                                        <th key={m} className="text-center px-2 py-2.5 min-w-[7rem] font-medium text-slate-700">
                                          {formatMonthLabelId(m)}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white">
                                    {(() => {
                                      const isPerPackMode = seasonsModalHotel?.meta?.room_pricing_mode === 'per_person';
                                      const perPackSourceRoomType =
                                        ROOM_TYPES.find((candidateRt) =>
                                          monthKeys.some((m) => parseSarInputString(monthlyPriceRowsByOwnerType?.[ownerTypeScope]?.[candidateRt]?.[m] ?? '') > 0)
                                        ) || ROOM_TYPES[0];
                                      const tableRoomTypes = isPerPackMode ? [perPackSourceRoomType] : ROOM_TYPES;
                                      return tableRoomTypes.map((rt) => (
                                      <tr key={`${ownerTypeScope}-${rt}`} className="border-b border-slate-100 last:border-0">
                                        <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white relative z-[2] border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                                          {isPerPackMode ? 'Per pack' : (ROOM_TYPE_LABELS[rt] || rt)}
                                        </td>
                                        {monthKeys.map((m) => {
                                          const derived = ownerTypeScope === 'mou' ? getMouDerivedSar(rt, m) : null;
                                          const sar = derived != null
                                            ? derived
                                            : parseSarInputString(monthlyPriceRowsByOwnerType?.[ownerTypeScope]?.[rt]?.[m] ?? '');
                                          const rates = { SAR_TO_IDR: currencyRates.SAR_TO_IDR ?? 4200, USD_TO_IDR: currencyRates.USD_TO_IDR ?? 15500 };
                                          const conv = sar > 0 ? fillFromSource('SAR', sar, rates) : null;
                                          const isDerivedCell = false;
                                          const cellDisabled = quantityFormSaving || monthlyPriceLoading || isDerivedCell;
                                          return (
                                            <td key={`${ownerTypeScope}-${rt}-${m}`} className="px-2 py-2 align-top">
                                              <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={isDerivedCell ? (sar > 0 ? formatSarId(sar) : '') : (monthlyPriceRowsByOwnerType?.[ownerTypeScope]?.[rt]?.[m] ?? '')}
                                                onChange={(e) => {
                                                  if (isDerivedCell) return;
                                                  const raw = e.target.value.replace(/[^\d.,]/g, '');
                                                  if (isPerPackMode) {
                                                    setMonthlyPriceRowsByOwnerType((prev) => ({
                                                      ...prev,
                                                      [ownerTypeScope]: {
                                                        ...(prev?.[ownerTypeScope] || {}),
                                                        ...Object.fromEntries(
                                                          ROOM_TYPES.map((roomType) => [
                                                            roomType,
                                                            { ...(prev?.[ownerTypeScope]?.[roomType] || {}), [m]: raw }
                                                          ])
                                                        )
                                                      }
                                                    }));
                                                    return;
                                                  }
                                                  setMonthlyPriceRowsByOwnerType((prev) => ({
                                                    ...prev,
                                                    [ownerTypeScope]: {
                                                      ...(prev?.[ownerTypeScope] || {}),
                                                      [rt]: { ...(prev?.[ownerTypeScope]?.[rt] || {}), [m]: raw }
                                                    }
                                                  }));
                                                }}
                                                onBlur={() => {
                                                  if (isDerivedCell) return;
                                                  const n = parseSarInputString(monthlyPriceRowsByOwnerType?.[ownerTypeScope]?.[rt]?.[m] ?? '');
                                                  if (isPerPackMode) {
                                                    setMonthlyPriceRowsByOwnerType((prev) => ({
                                                      ...prev,
                                                      [ownerTypeScope]: {
                                                        ...(prev?.[ownerTypeScope] || {}),
                                                        ...Object.fromEntries(
                                                          ROOM_TYPES.map((roomType) => [
                                                            roomType,
                                                            { ...(prev?.[ownerTypeScope]?.[roomType] || {}), [m]: n > 0 ? formatSarId(n) : '' }
                                                          ])
                                                        )
                                                      }
                                                    }));
                                                    return;
                                                  }
                                                  setMonthlyPriceRowsByOwnerType((prev) => ({
                                                    ...prev,
                                                    [ownerTypeScope]: {
                                                      ...(prev?.[ownerTypeScope] || {}),
                                                      [rt]: { ...(prev?.[ownerTypeScope]?.[rt] || {}), [m]: n > 0 ? formatSarId(n) : '' }
                                                    }
                                                  }));
                                                }}
                                                placeholder="0"
                                                disabled={cellDisabled}
                                                ariaLabel={`Harga SAR ${OWNER_PRICE_LABELS[ownerTypeScope]} ${ROOM_TYPE_LABELS[rt] || rt} ${formatMonthLabelId(m)}`}
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
                                      ));
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                              {ownerMealModeByOwnerType[ownerTypeScope] === 'with_meal' && (
                                <div className="mt-3 w-full min-w-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 max-h-[min(220px,40vh)] touch-pan-x bg-white">
                                  <table className="w-full text-sm min-w-[900px]">
                                    <thead className="sticky top-0 z-[3] bg-slate-100">
                                      <tr className="border-b border-slate-200">
                                        <th className="text-left px-3 py-2.5 font-semibold text-slate-700 sticky left-0 bg-slate-100 z-[4] border-r border-slate-200/80 w-[10rem]">
                                          Item
                                        </th>
                                        {monthKeys.map((m) => (
                                          <th key={`${ownerTypeScope}-meal-head-${m}`} className="text-center px-2 py-2.5 min-w-[7rem] font-medium text-slate-700">
                                            {formatMonthLabelId(m)}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                      <tr className="border-b border-slate-100">
                                        <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white relative z-[2] border-r border-slate-100">
                                          Makan / orang / malam
                                        </td>
                                        {monthKeys.map((m) => {
                                          const sar = parseSarInputString(monthlyMealByMonthByOwnerType?.[ownerTypeScope]?.[m] ?? '');
                                          const rates = { SAR_TO_IDR: currencyRates.SAR_TO_IDR ?? 4200, USD_TO_IDR: currencyRates.USD_TO_IDR ?? 15500 };
                                          const conv = sar > 0 ? fillFromSource('SAR', sar, rates) : null;
                                          const cellDisabled = quantityFormSaving || monthlyPriceLoading;
                                          return (
                                            <td key={`${ownerTypeScope}-meal-${m}`} className="px-2 py-2 align-top">
                                              <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={monthlyMealByMonthByOwnerType?.[ownerTypeScope]?.[m] ?? ''}
                                                onChange={(e) => {
                                                  const raw = e.target.value.replace(/[^\d.,]/g, '');
                                                  setMonthlyMealByMonthByOwnerType((prev) => ({
                                                    ...prev,
                                                    [ownerTypeScope]: { ...(prev?.[ownerTypeScope] || {}), [m]: raw }
                                                  }));
                                                }}
                                                onBlur={() => {
                                                  const n = parseSarInputString(monthlyMealByMonthByOwnerType?.[ownerTypeScope]?.[m] ?? '');
                                                  setMonthlyMealByMonthByOwnerType((prev) => ({
                                                    ...prev,
                                                    [ownerTypeScope]: { ...(prev?.[ownerTypeScope] || {}), [m]: n > 0 ? formatSarId(n) : '' }
                                                  }));
                                                }}
                                                placeholder="0"
                                                disabled={cellDisabled}
                                                ariaLabel={`Harga makan SAR ${OWNER_PRICE_LABELS[ownerTypeScope]} ${formatMonthLabelId(m)}`}
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
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
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
