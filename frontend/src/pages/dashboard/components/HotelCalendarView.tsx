import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Hotel,
  Users,
  Bed,
  Plus,
  X
} from 'lucide-react';
import { productsApi, adminPusatApi } from '../../../services/api';
import Button from '../../../components/common/Button';
import { useToast } from '../../../contexts/ToastContext';
import type { HotelProduct } from './HotelsPage';

const ROOM_TYPES = ['single', 'double', 'triple', 'quad', 'quint'] as const;
const ROOM_LABELS: Record<string, string> = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };

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
  const { showToast } = useToast();
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDayData> | null>(null);
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
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

  const daysInMonth = monthEnd.getDate();
  const firstDayOfWeek = monthStart.getDay();
  const leadingEmpty = firstDayOfWeek;
  const totalCells = Math.ceil((leadingEmpty + daysInMonth) / 7) * 7;

  const isDateFull = (dateStr: string) => {
    const day = calendarData?.[dateStr];
    if (!day || day._noSeason || !day.roomTypes) return false;
    return Object.values(day.roomTypes).some((r) => r.available <= 0 && r.total > 0);
  };

  const handlePrevMonth = () => {
    setCalendarMonth((p) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 }));
  };

  const handleNextMonth = () => {
    setCalendarMonth((p) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 }));
  };

  const monthLabel = `${new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;

  if (hotels.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
        <Hotel className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <p>Belum ada hotel. Tambah hotel di tab Daftar Hotel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Pilih Hotel:</label>
        <select
          value={selectedHotelId}
          onChange={(e) => setSelectedHotelId(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[220px] focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">-- Pilih hotel --</option>
          {hotels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} {h.meta?.location ? `(${h.meta.location})` : ''}
            </option>
          ))}
        </select>
        {selectedHotelId && (
          <span className="text-sm text-slate-500">
            {productName}
          </span>
        )}
      </div>

      {!selectedHotelId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 text-sm">
          Pilih hotel di atas untuk menampilkan kalender ketersediaan per tipe kamar dan booking owner.
        </div>
      )}

      {selectedHotelId && (
        <>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-800 capitalize">{monthLabel}</h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              Memuat kalender...
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-visible shadow-sm">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-medium text-slate-600">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 overflow-visible">
                {Array.from({ length: totalCells }, (_, i) => {
                  const dayIndex = i - leadingEmpty + 1;
                  const isInMonth = dayIndex >= 1 && dayIndex <= daysInMonth;
                  const date = isInMonth
                    ? new Date(calendarMonth.year, calendarMonth.month, dayIndex)
                    : null;
                  const dateStr = date ? date.toISOString().slice(0, 10) : '';
                  const day = dateStr ? calendarData?.[dateStr] : null;
                  const isHover = hoverDate === dateStr || popoverDate === dateStr;
                  const full = dateStr && isDateFull(dateStr);

                  return (
                    <div
                      key={i}
                      className={`relative min-h-[100px] border-b border-r border-slate-100 p-1.5 ${
                        !isInMonth ? 'bg-slate-50/50' : 'bg-white'
                      } ${isHover ? 'ring-2 ring-primary-400 ring-inset' : ''}`}
                      onMouseEnter={() => isInMonth && setHoverDate(dateStr)}
                      onMouseLeave={() => setHoverDate(null)}
                    >
                      {isInMonth && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${!day ? 'text-slate-400' : 'text-slate-800'}`}>
                              {dayIndex}
                            </span>
                            {full && canAddRoom && selectedHotel && day?.seasonId && day?.roomTypes && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPopoverDate(null);
                                  openAddQuantityPopup(day, dateStr);
                                }}
                                className="p-0.5 rounded text-emerald-600 hover:bg-emerald-100"
                                title="Tambah jumlah kamar untuk tanggal ini"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {day && !day._noSeason && day.roomTypes && (
                            <div className="mt-1 space-y-0.5">
                              {Object.entries(day.roomTypes).map(([rt, r]) => (
                                <div key={rt} className="text-[10px] text-slate-600 flex justify-between gap-0.5">
                                  <span className="capitalize truncate">{rt}</span>
                                  <span className={r.available <= 0 ? 'text-red-600 font-medium' : ''}>
                                    {r.booked}/{r.total}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {day?._noSeason && (
                            <p className="text-[10px] text-slate-400 mt-1">—</p>
                          )}
                          {((isHover && day?.bookings?.length) || popoverDate === dateStr) && day?.bookings?.length ? (
                            <div
                              className="absolute z-50 mt-1 left-0 rounded-lg border border-slate-200 bg-white shadow-xl p-2 max-h-48 overflow-y-auto w-[240px]"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-semibold text-slate-700">
                                  {dateStr} — Booking
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setPopoverDate(null)}
                                  className="p-0.5 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {day?.bookings?.map((b) => (
                                <div
                                  key={b.order_id}
                                  className="text-xs py-1.5 border-b border-slate-100 last:border-0"
                                >
                                  <div className="font-medium text-slate-800 flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-primary-500" />
                                    {b.owner_name}
                                  </div>
                                  <div className="text-slate-600 mt-0.5">
                                    Total jamaah: <strong>{b.total_jamaah}</strong>
                                  </div>
                                  {Object.keys(b.by_room_type).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {Object.entries(b.by_room_type).map(([rt, qty]) => (
                                        <span
                                          key={rt}
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 capitalize"
                                        >
                                          <Bed className="w-3 h-3" />
                                          {rt}: {qty}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {day?.seasonName && (
                                <p className="text-[10px] text-slate-400 mt-1">Musim: {day.seasonName}</p>
                              )}
                            </div>
                          ) : null}
                          {day?.bookings?.length ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setPopoverDate(popoverDate === dateStr ? null : dateStr); }}
                              className="mt-1 text-[10px] text-primary-600 hover:underline flex items-center gap-0.5"
                            >
                              <Users className="w-3 h-3" />
                              {day.bookings.length} owner
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            <span>Keterangan: angka = booked/total per tipe kamar.</span>
            {canAddRoom && (
              <span className="text-emerald-600">
                Tanggal penuh: klik ikon <Plus className="w-3.5 h-3.5 inline" /> untuk tambah jumlah kamar.
              </span>
            )}
          </div>

          {/* Popup Tambah Jumlah Kamar (khusus tab Kalender) */}
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
                                <input
                                  type="number"
                                  min={0}
                                  value={addQuantityInputs[rt] ?? ''}
                                  onChange={(e) => setAddQuantityInputs((prev) => ({ ...prev, [rt]: e.target.value }))}
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
