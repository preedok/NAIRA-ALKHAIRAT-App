import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Hotel, Users, Plus } from 'lucide-react';
import Autocomplete from '../../../components/common/Autocomplete';
import ProductCalendar, { type ProductCalendarMonth } from '../../../components/common/ProductCalendar';
import { productsApi, adminPusatApi } from '../../../services/api';
import HotelAddRoomQuantityModal from '../../../components/common/HotelAddRoomQuantityModal';
import HotelCalendarBookingsInvoiceModal from '../../../components/common/HotelCalendarBookingsInvoiceModal';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { HotelProduct } from './HotelsPage';

const ALMOST_FULL_THRESHOLD = 0.2;
type AvailabilityStatus = 'available' | 'almost_full' | 'full';
function getRoomStatus(total: number, available: number): AvailabilityStatus {
  if (total <= 0) return 'available';
  if (available <= 0) return 'full';
  if (available <= Math.max(1, Math.ceil(total * ALMOST_FULL_THRESHOLD))) return 'almost_full';
  return 'available';
}

const ROOM_TYPES = ['double', 'triple', 'quad', 'quint'] as const;
const ROOM_LABELS: Record<string, string> = { double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint', single: 'Double' };
type CalendarBooking = {
  order_id: string;
  owner_id: string;
  owner_name: string;
  total_jamaah: number;
  by_room_type: Record<string, number>;
  stay_check_in?: string;
  stay_check_out?: string;
  check_in_time?: string;
  check_out_time?: string;
};

type CalendarDayData = {
  _noSeason?: boolean;
  seasonId?: string;
  seasonName?: string;
  roomTypes?: Record<string, { total: number; booked: number; available: number }>;
  bookings?: CalendarBooking[];
};

type AddQuantityPopup = {
  dateStr: string;
  seasonId: string;
  seasonName: string;
  mode: 'global' | 'per_season';
  roomTypes: Record<string, { total: number; booked: number; available: number }>;
};

type BookingsInvoiceModalState = {
  dateStr: string;
  seasonName?: string;
  hotelProductId: string;
  hotelLabel: string;
  orderIds: string[];
};

interface HotelCalendarViewProps {
  hotels: HotelProduct[];
  canAddRoom?: boolean;
  onOpenSeasonsModal?: (hotel: HotelProduct, date?: string, seasonId?: string) => void;
}

const HotelCalendarView: React.FC<HotelCalendarViewProps> = ({
  hotels,
  canAddRoom = false
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isOwner = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';
  /** Owner: lihat agregat ketersediaan semua booking; kartu & popup hanya order miliknya. */
  const canAddRoomForRole = canAddRoom && !isOwner;
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [calendarLocation, setCalendarLocation] = useState<'makkah' | 'madinah'>('makkah');
  const [calendarMonth, setCalendarMonth] = useState<ProductCalendarMonth>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDayData> | null>(null);
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [bookingsInvoiceModal, setBookingsInvoiceModal] = useState<BookingsInvoiceModalState | null>(null);
  const [addQuantityPopup, setAddQuantityPopup] = useState<AddQuantityPopup | null>(null);
  const [addQuantityInputs, setAddQuantityInputs] = useState<Record<string, string>>({});
  const [addQuantitySaving, setAddQuantitySaving] = useState(false);
  const [calendarAvailabilityMode, setCalendarAvailabilityMode] = useState<'global' | 'per_season'>('per_season');

  const hotelsByLocation = useMemo(
    () => hotels.filter((h) => String(h.meta?.location || '').toLowerCase() === calendarLocation),
    [hotels, calendarLocation]
  );
  const selectedHotel = useMemo(() => hotels.find((h) => h.id === selectedHotelId), [hotels, selectedHotelId]);

  useEffect(() => {
    if (!selectedHotelId) return;
    const existsInTab = hotelsByLocation.some((h) => h.id === selectedHotelId);
    if (!existsInTab) setSelectedHotelId('');
  }, [selectedHotelId, hotelsByLocation]);

  /** Rentang bulan dalam YYYY-MM-DD (tanggal lokal), hindari bug toISOString() di zona WIB. */
  const fromStr = useMemo(() => {
    const y = calendarMonth.year;
    const m = calendarMonth.month + 1;
    return `${y}-${String(m).padStart(2, '0')}-01`;
  }, [calendarMonth]);
  const toStr = useMemo(() => {
    const y = calendarMonth.year;
    const m = calendarMonth.month + 1;
    const last = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }, [calendarMonth]);

  useEffect(() => {
    if (!selectedHotelId) {
      setCalendarData(null);
      setCalendarAvailabilityMode('per_season');
      return;
    }
    setLoading(true);
    productsApi
      .getHotelCalendar(selectedHotelId, { from: fromStr, to: toStr })
      .then((res) => {
        if (res.data?.data) {
          const payload = res.data.data as {
            byDate: Record<string, CalendarDayData>;
            availability_mode?: string;
            productName?: string;
          };
          setCalendarData(payload.byDate || null);
          setCalendarAvailabilityMode(payload.availability_mode === 'global' ? 'global' : 'per_season');
          setProductName(payload.productName || selectedHotel?.name || '');
        } else {
          setCalendarData(null);
        }
      })
      .catch(() => {
        setCalendarData(null);
        showToast('Gagal memuat kalender', 'error');
      })
      .finally(() => setLoading(false));
  }, [selectedHotelId, fromStr, toStr, selectedHotel?.name, showToast, calendarRefreshKey]);

  const openAddQuantityPopup = useCallback((day: CalendarDayData, dateStr: string) => {
    if (!day.roomTypes) return;
    if (calendarAvailabilityMode !== 'global' && !day.seasonId) return;
    setAddQuantityPopup({
      dateStr,
      seasonId: day.seasonId || '',
      seasonName: day.seasonName || (calendarAvailabilityMode === 'global' ? 'Semua bulan' : ''),
      mode: calendarAvailabilityMode,
      roomTypes: day.roomTypes
    });
    const initial: Record<string, string> = {};
    Object.keys(day.roomTypes).forEach((rt) => { initial[rt] = ''; });
    setAddQuantityInputs(initial);
  }, [calendarAvailabilityMode]);

  const handleSaveAddQuantity = useCallback(async () => {
    if (!selectedHotelId || !addQuantityPopup) return;
    setAddQuantitySaving(true);
    try {
      const inventory = ROOM_TYPES.map((rt) => {
        const current = addQuantityPopup.roomTypes[rt]?.total ?? 0;
        const add = Math.max(0, parseInt(addQuantityInputs[rt] ?? '', 10) || 0);
        return { room_type: rt, total_rooms: current + add };
      });
      if (addQuantityPopup.mode === 'global') {
        const global_room_inventory: Record<string, number> = {};
        inventory.forEach((row) => {
          global_room_inventory[row.room_type] = row.total_rooms;
        });
        await adminPusatApi.setHotelAvailabilityConfig(selectedHotelId, {
          availability_mode: 'global',
          global_room_inventory
        });
        showToast('Kuota kamar (semua bulan) berhasil diperbarui', 'success');
      } else {
        await adminPusatApi.setSeasonInventory(selectedHotelId, addQuantityPopup.seasonId, { inventory });
        showToast('Inventori musim berhasil diperbarui', 'success');
      }
      setAddQuantityPopup(null);
      setCalendarRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan inventori', 'error');
    } finally {
      setAddQuantitySaving(false);
    }
  }, [selectedHotelId, addQuantityPopup, addQuantityInputs, showToast]);

  const handlePrevMonth = () => {
    setCalendarMonth((p) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 }));
  };

  const handleNextMonth = () => {
    setCalendarMonth((p) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 }));
  };

  const handleToday = () => {
    const d = new Date();
    setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  const isDateFull = useCallback((dateStr: string) => {
    const day = calendarData?.[dateStr];
    if (!day || day._noSeason || !day.roomTypes) return false;
    return Object.values(day.roomTypes).some((r) => r.available <= 0 && r.total > 0);
  }, [calendarData]);

  if (hotels.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 text-center shadow-sm">
        <div className="inline-flex p-4 rounded-2xl bg-slate-100 text-slate-500 mb-4">
          <Hotel className="h-12 w-12" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Belum ada hotel</h3>
        <p className="text-slate-600 mt-1">Tambah hotel di tab Daftar Hotel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 border border-slate-200 p-1">
          <button
            type="button"
            onClick={() => setCalendarLocation('makkah')}
            className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              calendarLocation === 'makkah'
                ? 'bg-white text-[#0D1A63] border border-btn shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Mekkah
          </button>
          <button
            type="button"
            onClick={() => setCalendarLocation('madinah')}
            className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              calendarLocation === 'madinah'
                ? 'bg-white text-[#0D1A63] border border-btn shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Madinah
          </button>
        </div>
        <Autocomplete
          label="Pilih Hotel"
          value={selectedHotelId}
          onChange={setSelectedHotelId}
          options={hotelsByLocation.map((h) => ({ value: h.id, label: h.name }))}
          placeholder="-- Pilih hotel --"
          className="w-full"
          fullWidth
        />
        {selectedHotelId && productName ? <p className="text-sm text-slate-600">{productName}</p> : null}
      </div>

      {!selectedHotelId && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-8 text-center text-amber-800 text-sm shadow-sm">
          <p className="font-medium">Pilih hotel di atas untuk menampilkan kalender ketersediaan per tipe kamar dan booking owner.</p>
        </div>
      )}

      {selectedHotelId && (
        <>
          <ProductCalendar<CalendarDayData>
            month={calendarMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            data={calendarData}
            loading={loading}
            popoverDate={null}
            onPopoverToggle={() => {}}
            minCellHeight={168}
            footer={
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Tersedia
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Hampir penuh
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Penuh
                </span>
                <span>Tipe: Single, Double, Triple, Quad, Quint · Angka = dipesan/total</span>
                {calendarAvailabilityMode === 'per_season' && (
                  <span className="text-slate-500">
                    * Tanggal di luar rentang musim: kuota mengikuti musim terdekat (nama musim bertanda *).
                  </span>
                )}
                {isOwner && (
                  <span className="text-slate-600">
                    Sebagai owner: kuota kamar adalah agregat semua pemesanan; tombol &quot;Lihat invoice&quot; hanya untuk order Anda.
                  </span>
                )}
                {canAddRoomForRole && (
                  <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                    <Plus className="w-3.5 h-3.5" /> Klik + pada tanggal kuning/merah untuk tambah kamar.
                  </span>
                )}
              </div>
            }
            renderDayContent={({ dateStr, dayIndex, isToday, data: day }) => {
              const rawBookings = day?.bookings ?? [];
              /** Backend sudah filter booking per owner untuk role owner; filter client tetap jaga-jaga. */
              const dayBookings =
                isOwner && user?.id
                  ? rawBookings.filter((b) => String(b.owner_id || '') === String(user.id))
                  : rawBookings;
              const staffOrderCount = new Set(rawBookings.map((b) => b.order_id)).size;
              const full = dateStr && isDateFull(dateStr);
              const roomEntries = day && !day._noSeason && day.roomTypes ? Object.entries(day.roomTypes) : [];
              const totalAvailable = roomEntries.reduce((s, [, r]) => s + (r?.available ?? 0), 0);
              const allFull = roomEntries.length > 0 && roomEntries.every(([, r]) => (r?.total ?? 0) > 0 && (r?.available ?? 0) <= 0);
              const anyAlmostFull = roomEntries.some(([, r]) => {
                const t = r?.total ?? 0;
                const a = r?.available ?? 0;
                return t > 0 && a > 0 && a <= Math.max(1, Math.ceil(t * ALMOST_FULL_THRESHOLD));
              });
              const showAddRoom =
                canAddRoomForRole &&
                (full || anyAlmostFull) &&
                selectedHotel &&
                day?.roomTypes &&
                (calendarAvailabilityMode === 'global' || !!day.seasonId);

              return (
                <>
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={`tabular-nums font-bold ${
                        isToday
                          ? 'flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg bg-blue-600 text-white text-lg'
                          : `text-xl text-slate-800 ${!day ? 'text-slate-300' : ''}`
                      }`}
                    >
                      {dayIndex}
                    </span>
                    {showAddRoom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddQuantityPopup(day, dateStr);
                        }}
                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors shrink-0"
                        title="Tambah kamar"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {roomEntries.length > 0 ? (
                    <>
                      <div className="mt-2 space-y-1">
                        {roomEntries.map(([rt, r]) => {
                          const total = r?.total ?? 0;
                          const booked = r?.booked ?? 0;
                          const available = r?.available ?? 0;
                          const roomStatus = getRoomStatus(total, available);
                          const rowStyle = roomStatus === 'full' ? 'text-rose-700 font-semibold' : roomStatus === 'almost_full' ? 'text-amber-700 font-medium' : 'text-slate-600';
                          const dotColor = roomStatus === 'full' ? 'bg-rose-400' : roomStatus === 'almost_full' ? 'bg-amber-400' : 'bg-emerald-400';
                          return (
                            <div key={rt} className={`flex items-center justify-between gap-1 text-[10px] tabular-nums ${rowStyle}`}>
                              <span className="flex items-center gap-1 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                                <span className="capitalize truncate">{ROOM_LABELS[rt] || rt}</span>
                              </span>
                              <span>{booked}/{total}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className={`mt-1.5 text-[10px] font-medium tabular-nums ${
                        allFull ? 'text-rose-600' : anyAlmostFull ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        {allFull ? 'Penuh' : anyAlmostFull ? 'Hampir penuh' : `${totalAvailable} tersedia`}
                      </p>
                    </>
                  ) : null}
                  {day?._noSeason && (
                    <p className="mt-2 text-[11px] text-slate-400">—</p>
                  )}
                  {dayBookings.length > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!selectedHotelId) return;
                        const ids = Array.from(new Set(dayBookings.map((b) => b.order_id)));
                        setBookingsInvoiceModal({
                          dateStr,
                          seasonName: day?.seasonName,
                          hotelProductId: selectedHotelId,
                          hotelLabel: productName || selectedHotel?.name || '',
                          orderIds: ids
                        });
                      }}
                      className="mt-1.5 text-[10px] font-semibold flex items-center gap-1.5 rounded-lg py-1 px-1.5 w-full justify-center transition-colors text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Users className="w-3.5 h-3.5" />
                      {isOwner
                        ? dayBookings.length === 1
                          ? 'Lihat invoice saya'
                          : `Lihat ${dayBookings.length} invoice saya`
                        : staffOrderCount === 1
                          ? 'Lihat 1 invoice'
                          : `Lihat ${staffOrderCount} invoice`}
                    </button>
                  ) : null}
                </>
              );
            }}
          />

          {bookingsInvoiceModal && (
            <HotelCalendarBookingsInvoiceModal
              open
              zIndex={55}
              onClose={() => setBookingsInvoiceModal(null)}
              dateStr={bookingsInvoiceModal.dateStr}
              seasonName={bookingsInvoiceModal.seasonName}
              hotelProductId={bookingsInvoiceModal.hotelProductId}
              hotelLabel={bookingsInvoiceModal.hotelLabel}
              orderIds={bookingsInvoiceModal.orderIds}
              restrictToOwnerId={isOwner ? user?.id : undefined}
            />
          )}

          {addQuantityPopup && selectedHotelId && (
            <HotelAddRoomQuantityModal
              open
              zIndex={50}
              saving={addQuantitySaving}
              onClose={() => !addQuantitySaving && setAddQuantityPopup(null)}
              dateStr={addQuantityPopup.dateStr}
              seasonName={addQuantityPopup.seasonName || undefined}
              helpText="Isi jumlah tambahan per tipe. Tabel hanya menampilkan tipe kamar yang ada di musim ini; tipe yang penuh tetap tampil agar bisa ditambah."
              rows={Object.keys(addQuantityPopup.roomTypes)
                .sort(
                  (a, b) =>
                    ROOM_TYPES.indexOf(a as (typeof ROOM_TYPES)[number]) - ROOM_TYPES.indexOf(b as (typeof ROOM_TYPES)[number])
                )
                .map((rt) => {
                  const r = addQuantityPopup.roomTypes[rt];
                  return {
                    roomType: rt,
                    total: r?.total ?? 0,
                    booked: r?.booked ?? 0,
                    available: r?.available ?? 0
                  };
                })}
              addInputs={addQuantityInputs}
              onAddInputChange={(rt, v) => setAddQuantityInputs((prev) => ({ ...prev, [rt]: v }))}
              onSave={handleSaveAddQuantity}
            />
          )}
        </>
      )}
    </div>
  );
};

export default HotelCalendarView;
