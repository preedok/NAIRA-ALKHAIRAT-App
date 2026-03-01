import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plane,
  Users,
  X,
  MapPin,
  ArrowLeftRight
} from 'lucide-react';
import Autocomplete from '../../../components/common/Autocomplete';
import { productsApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';

const BANDARA_TIKET = [
  { code: 'BTH', name: 'Batam' },
  { code: 'CGK', name: 'Jakarta' },
  { code: 'SBY', name: 'Surabaya' },
  { code: 'UPG', name: 'Makassar' }
];

export interface TicketProduct {
  id: string;
  code: string;
  name: string;
  meta?: { trip_type?: TicketTripType } | null;
  bandara_options?: { bandara: string; name: string }[];
}

export type TicketTripType = 'one_way' | 'return_only' | 'round_trip';

const TRIP_TYPE_LABELS: Record<TicketTripType, string> = {
  one_way: 'Pergi saja',
  return_only: 'Pulang saja',
  round_trip: 'Pulang pergi'
};

type CalendarDayData = {
  quota?: number;
  booked?: number;
  available?: number;
  bookings?: { order_id: string; owner_id: string; owner_name: string; quantity: number }[];
};

interface TicketCalendarViewProps {
  ticketProducts: TicketProduct[];
}

const TicketCalendarView: React.FC<TicketCalendarViewProps> = ({ ticketProducts }) => {
  const { showToast } = useToast();
  const [tripTypeFilter, setTripTypeFilter] = useState<TicketTripType | ''>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedBandara, setSelectedBandara] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDayData> | null>(null);
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [popoverDate, setPopoverDate] = useState<string | null>(null);

  const filteredTicketProducts = useMemo(() => {
    if (!tripTypeFilter) return ticketProducts;
    return ticketProducts.filter((p) => p.meta?.trip_type === tripTypeFilter);
  }, [ticketProducts, tripTypeFilter]);

  // If filter changes and current selected product no longer matches, reset selection
  useEffect(() => {
    if (!selectedProductId) return;
    const stillValid = filteredTicketProducts.some((p) => p.id === selectedProductId);
    if (!stillValid) {
      setSelectedProductId('');
      setSelectedBandara('');
      setCalendarData(null);
      setProductName('');
      setPopoverDate(null);
    }
  }, [filteredTicketProducts, selectedProductId]);

  const selectedProduct = useMemo(
    () => filteredTicketProducts.find((p) => p.id === selectedProductId),
    [filteredTicketProducts, selectedProductId]
  );

  const monthStart = useMemo(() => new Date(calendarMonth.year, calendarMonth.month, 1), [calendarMonth]);
  const monthEnd = useMemo(() => new Date(calendarMonth.year, calendarMonth.month + 1, 0), [calendarMonth]);
  const fromStr = monthStart.toISOString().slice(0, 10);
  const toStr = monthEnd.toISOString().slice(0, 10);

  useEffect(() => {
    if (!selectedProductId || !selectedBandara) {
      setCalendarData(null);
      return;
    }
    setLoading(true);
    productsApi
      .getTicketCalendar(selectedProductId, { bandara: selectedBandara, from: fromStr, to: toStr })
      .then((res) => {
        if (res.data?.data) {
          const d = res.data.data as {
            byDate?: Record<string, CalendarDayData>;
            productName?: string;
          };
          setCalendarData(d.byDate || null);
          setProductName(d.productName || selectedProduct?.name || '');
        } else {
          setCalendarData(null);
        }
      })
      .catch(() => {
        setCalendarData(null);
        showToast('Gagal memuat kalender tiket', 'error');
      })
      .finally(() => setLoading(false));
  }, [selectedProductId, selectedBandara, fromStr, toStr, selectedProduct?.name, showToast]);

  const daysInMonth = monthEnd.getDate();
  const firstDayOfWeek = monthStart.getDay();
  const leadingEmpty = firstDayOfWeek;
  const totalCells = Math.ceil((leadingEmpty + daysInMonth) / 7) * 7;

  const handlePrevMonth = () => {
    setCalendarMonth((p) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 }));
  };

  const handleNextMonth = () => {
    setCalendarMonth((p) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 }));
  };

  const monthLabel = `${new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
  const bandaraName = BANDARA_TIKET.find((b) => b.code === selectedBandara)?.name || selectedBandara;

  if (ticketProducts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 text-center shadow-sm">
        <div className="inline-flex p-4 rounded-2xl bg-slate-100 text-slate-500 mb-4">
          <Plane className="h-12 w-12" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Belum ada produk tiket</h3>
        <p className="text-slate-600 mt-1">Tambah tiket di tab Daftar Tiket untuk melihat kalender kuota.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter panel */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#0D1A63]" />
            Pilih filter untuk menampilkan kalender
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Perjalanan, produk tiket, dan bandara menentukan data yang ditampilkan.</p>
        </div>
        <div className="p-5 flex flex-wrap items-end gap-4">
          <Autocomplete label="Perjalanan" value={tripTypeFilter} onChange={(v) => { setTripTypeFilter(v as TicketTripType | ''); }} options={Object.entries(TRIP_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} emptyLabel="Semua" className="min-w-[160px]" fullWidth={false} />
          <Autocomplete label="Produk Tiket" value={selectedProductId} onChange={(v) => { setSelectedProductId(v); setSelectedBandara(''); }} options={filteredTicketProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))} placeholder="-- Pilih tiket --" className="min-w-[220px]" fullWidth={false} />
          {selectedProductId && (
            <Autocomplete label="Bandara" value={selectedBandara} onChange={setSelectedBandara} options={BANDARA_TIKET.map((b) => ({ value: b.code, label: `${b.name} (${b.code})` }))} placeholder="-- Pilih bandara --" className="min-w-[160px]" fullWidth={false} />
          )}
          {selectedProductId && selectedBandara && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D1A63]/10 text-[#0D1A63] text-sm font-medium border border-[#0D1A63]/30">
              {productName} · {bandaraName}
            </div>
          )}
        </div>
      </div>

      {ticketProducts.length > 0 && filteredTicketProducts.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-center text-amber-800 text-sm shadow-sm">
          Tidak ada produk tiket sesuai filter perjalanan yang dipilih.
        </div>
      )}

      {selectedProductId && !selectedBandara && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-8 text-center shadow-sm">
          <MapPin className="mx-auto w-10 h-10 text-slate-400 mb-3" />
          <p className="text-slate-600 font-medium">Pilih bandara (BTH, CGK, SBY, UPG)</p>
          <p className="text-slate-500 text-sm mt-1">untuk menampilkan kalender kuota per tanggal dan booking owner.</p>
        </div>
      )}

      {selectedProductId && selectedBandara && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
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
            <div className="p-12 text-center text-slate-500">
              Memuat kalender...
            </div>
          ) : (
            <div className="overflow-visible">
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
                  const isPopover = popoverDate === dateStr;

                  return (
                    <div
                      key={i}
                      className={`relative min-h-[100px] border-b border-r border-slate-100 p-1.5 ${
                        !isInMonth ? 'bg-slate-50/50' : 'bg-white'
                      } ${isPopover ? 'ring-2 ring-[#0D1A63]/50 ring-inset' : ''}`}
                    >
                      {isInMonth && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${!day ? 'text-slate-400' : 'text-slate-800'}`}>
                              {dayIndex}
                            </span>
                          </div>
                          {day && (
                            <div className="mt-1 space-y-0.5">
                              <div className="text-[10px] text-slate-600 flex justify-between gap-0.5">
                                <span>Kuota</span>
                                <span className={day.available !== undefined && day.available <= 0 && (day.quota ?? 0) > 0 ? 'text-red-600 font-medium' : ''}>
                                  {day.booked ?? 0}/{day.quota ?? 0}
                                </span>
                              </div>
                              {(day.available ?? 0) >= 0 && (
                                <div className="text-[10px] text-emerald-600">
                                  Tersedia: {day.available}
                                </div>
                              )}
                            </div>
                          )}
                          {popoverDate === dateStr && day?.bookings?.length ? (
                            <div className="absolute z-50 mt-1 left-0 rounded-lg border border-slate-200 bg-white shadow-xl p-2 max-h-48 overflow-y-auto w-[240px]">
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
                                    <Users className="w-3.5 h-3.5 text-[#0D1A63]" />
                                    {b.owner_name}
                                  </div>
                                  <div className="text-slate-600 mt-0.5">
                                    Jumlah: <strong>{b.quantity}</strong>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {day?.bookings?.length ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPopoverDate(popoverDate === dateStr ? null : dateStr);
                              }}
                              className="mt-1 text-[10px] text-[#0D1A63] hover:underline flex items-center gap-0.5"
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

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
            Keterangan: angka = dipesan/kuota per tanggal (bandara {bandaraName}). Booking dihitung dari item tiket dengan tanggal keberangkatan (departure_date).
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketCalendarView;
