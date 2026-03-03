import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Hotel, Users, Bed, Plus, X } from 'lucide-react';
import Autocomplete from '../../../components/common/Autocomplete';
import ProductCalendar, { type ProductCalendarMonth } from '../../../components/common/ProductCalendar';
import Input from '../../../components/common/Input';
import { productsApi, adminPusatApi } from '../../../services/api';
import Button from '../../../components/common/Button';
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

const ROOM_TYPES = ['single', 'double', 'triple', 'quad', 'quint'] as const;
const ROOM_LABELS: Record<string, string> = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };
const ROOM_SHORT: Record<string, string> = { single: 'S', double: 'D', triple: 'T', quad: 'Q', quint: '5' };

type CalendarDayData = {
  _noSeason?: boolean;
  seasonId?: string;
  seasonName?: string;
  roomTypes?: Record<string, { total: number; booked: number; available: number }>;
  bookings?: { order_id: string; owner_id: string; owner_name: string; total_jamaah: number; by_room_type: Record<string, number> }[];
};

type AddQuantityPopup = {
  dateStr: string;
  seasonId: string;
  seasonName: string;
  roomTypes: Record<string, { total: number; booked: number; available: number }>;
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
  const isOwner = user?.role === 'owner';
  const canSeeBookingDetails = !isOwner;
  const canAddRoomForRole = canAddRoom && !isOwner;
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState<ProductCalendarMonth>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDayData> | null>(null);
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [popoverDate, setPopoverDate] = useState<string | null>(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [addQuantityPopup, setAddQuantityPopup] = useState<AddQuantityPopup | null>(null);
  const [addQuantityInputs, setAddQuantityInputs] = useState<Record<string, string>>({});
  const [addQuantitySaving, setAddQuantitySaving] = useState(false);

  const selectedHotel = useMemo(() => hotels.find((h) => h.id === selectedHotelId), [hotels, selectedHotelId]);

  const monthStart = useMemo(() => new Date(calendarMonth.year, calendarMonth.month, 1), [calendarMonth]);
  const monthEnd = useMemo(() => new Date(calendarMonth.year, calendarMonth.month + 1, 0), [calendarMonth]);
  const fromStr = monthStart.toISOString().slice(0, 10);
  const toStr = monthEnd.toISOString().slice(0, 10);

  useEffect(() => {
    if (!selectedHotelId) {
      setCalendarData(null);
      return;
    }
    setLoading(true);
    productsApi
      .getHotelCalendar(selectedHotelId, { from: fromStr, to: toStr })
      .then((res) => {
        if (res.data?.data) {
          setCalendarData((res.data.data as { byDate: Record<string, CalendarDayData> }).byDate || null);
          setProductName((res.data.data as { productName?: string }).productName || selectedHotel?.name || '');
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
    if (!day.seasonId || !day.roomTypes) return;
    setAddQuantityPopup({
      dateStr,
      seasonId: day.seasonId,
      seasonName: day.seasonName || '',
      roomTypes: day.roomTypes
    });
    const initial: Record<string, string> = {};
    ROOM_TYPES.forEach((rt) => { initial[rt] = ''; });
    setAddQuantityInputs(initial);
  }, []);

  const handleSaveAddQuantity = useCallback(async () => {
    if (!selectedHotelId || !addQuantityPopup) return;
    setAddQuantitySaving(true);
    try {
      const inventory = ROOM_TYPES.map((rt) => {
        const current = addQuantityPopup.roomTypes[rt]?.total ?? 0;
        const add = Math.max(0, parseInt(addQuantityInputs[rt] ?? '', 10) || 0);
        return { room_type: rt, total_rooms: current + add };
      });
      await adminPusatApi.setSeasonInventory(selectedHotelId, addQuantityPopup.seasonId, { inventory });
      showToast('Inventori musim berhasil diperbarui', 'success');
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
      <div className="flex flex-wrap items-end gap-4">
        <Autocomplete
          label="Pilih Hotel"
          value={selectedHotelId}
          onChange={setSelectedHotelId}
          options={hotels.map((h) => ({ value: h.id, label: `${h.name} ${h.meta?.location ? `(${h.meta.location})` : ''}` }))}
          placeholder="-- Pilih hotel --"
          className="min-w-[220px]"
          fullWidth={false}
        />
        {selectedHotelId && productName && (
          <span className="text-sm text-slate-600 font-medium pb-1">{productName}</span>
        )}
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
            popoverDate={popoverDate}
            onPopoverToggle={setPopoverDate}
            minCellHeight={145}
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
                {canAddRoomForRole && (
                  <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                    <Plus className="w-3.5 h-3.5" /> Klik + pada tanggal kuning/merah untuk tambah kamar. Owner hanya lihat ketersediaan.
                  </span>
                )}
              </div>
            }
            renderDayContent={({ dateStr, dayIndex, isToday, data: day, openPopover, isPopoverOpen }) => {
              const full = dateStr && isDateFull(dateStr);
              const roomEntries = day && !day._noSeason && day.roomTypes ? Object.entries(day.roomTypes) : [];
              const totalAvailable = roomEntries.reduce((s, [, r]) => s + (r?.available ?? 0), 0);
              const allFull = roomEntries.length > 0 && roomEntries.every(([, r]) => (r?.total ?? 0) > 0 && (r?.available ?? 0) <= 0);
              const anyAlmostFull = roomEntries.some(([, r]) => {
                const t = r?.total ?? 0;
                const a = r?.available ?? 0;
                return t > 0 && a > 0 && a <= Math.max(1, Math.ceil(t * ALMOST_FULL_THRESHOLD));
              });
              const showAddRoom = canAddRoomForRole && (full || anyAlmostFull) && selectedHotel && day?.seasonId && day?.roomTypes;

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
                          setPopoverDate(null);
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
                  {canSeeBookingDetails && day?.bookings?.length ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openPopover(); }}
                      className={`mt-3 text-[11px] font-semibold flex items-center gap-1.5 rounded-lg py-1.5 px-2 w-full justify-center transition-colors ${
                        isPopoverOpen ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {day.bookings.length} owner
                    </button>
                  ) : null}
                </>
              );
            }}
            renderPopover={canSeeBookingDetails ? ({ dateStr, data: day, onClose }) => (
              <>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-800">{dateStr}</span>
                  <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {day?.bookings?.map((b) => (
                    <div key={b.order_id} className="rounded-xl bg-slate-50 p-3">
                      <div className="font-semibold text-slate-800 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        {b.owner_name}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">Total jamaah: <strong>{b.total_jamaah}</strong></p>
                      {Object.keys(b.by_room_type).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(b.by_room_type).map(([rt, qty]) => (
                            <span key={rt} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 capitalize">
                              <Bed className="w-3 h-3 text-slate-400" />
                              {rt}: {qty}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {day?.seasonName && (
                  <p className="text-[11px] text-slate-400 mt-3">Musim: {day.seasonName}</p>
                )}
              </>
            ) : undefined}
          />

          {/* Modal Tambah Jumlah Kamar */}
          {addQuantityPopup && selectedHotelId && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => !addQuantitySaving && setAddQuantityPopup(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Tambah jumlah kamar</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => !addQuantitySaving && setAddQuantityPopup(null)}
                    className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-sm text-slate-600">
                    Tanggal <strong>{new Date(addQuantityPopup.dateStr + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    {addQuantityPopup.seasonName && <> · Musim: <strong>{addQuantityPopup.seasonName}</strong></>}
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
                          const r = addQuantityPopup.roomTypes[rt];
                          const total = r?.total ?? 0;
                          const booked = r?.booked ?? 0;
                          const available = r?.available ?? 0;
                          const add = Math.max(0, parseInt(addQuantityInputs[rt] ?? '', 10) || 0);
                          const newTotal = total + add;
                          return (
                            <tr key={rt} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 px-3 font-medium text-slate-800 capitalize">{ROOM_LABELS[rt] || rt}</td>
                              <td className="py-2 px-2 text-center tabular-nums text-slate-700">{total}</td>
                              <td className="py-2 px-2 text-center tabular-nums text-slate-600">{booked}</td>
                              <td className={`py-2 px-2 text-center tabular-nums font-medium ${available <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{available}</td>
                              <td className="py-2 px-2">
                                <Input
                                  type="number"
                                  min={0}
                                  value={addQuantityInputs[rt] ?? ''}
                                  onChange={(e) => setAddQuantityInputs((prev) => ({ ...prev, [rt]: e.target.value }))}
                                  placeholder="0"
                                  fullWidth={false}
                                  className="w-20 min-w-[5rem]"
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
                  <Button variant="outline" size="sm" onClick={() => !addQuantitySaving && setAddQuantityPopup(null)} disabled={addQuantitySaving}>
                    Batal
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSaveAddQuantity} disabled={addQuantitySaving}>
                    {addQuantitySaving ? 'Menyimpan…' : 'Simpan'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HotelCalendarView;
