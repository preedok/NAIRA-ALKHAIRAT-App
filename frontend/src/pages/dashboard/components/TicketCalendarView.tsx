import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plane,
  Users,
  X
} from 'lucide-react';
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
  meta?: { trip_type?: string } | null;
  bandara_options?: { bandara: string; name: string }[];
}

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

  const selectedProduct = useMemo(
    () => ticketProducts.find((p) => p.id === selectedProductId),
    [ticketProducts, selectedProductId]
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
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
        <Plane className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <p>Belum ada produk tiket. Tambah tiket di tab Daftar Tiket.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Pilih Produk Tiket:</label>
        <select
          value={selectedProductId}
          onChange={(e) => {
            setSelectedProductId(e.target.value);
            setSelectedBandara('');
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[220px] focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">-- Pilih tiket --</option>
          {ticketProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
        {selectedProductId && (
          <>
            <label className="text-sm font-medium text-slate-700">Bandara:</label>
            <select
              value={selectedBandara}
              onChange={(e) => setSelectedBandara(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">-- Pilih bandara --</option>
              {BANDARA_TIKET.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </>
        )}
        {selectedProductId && selectedBandara && (
          <span className="text-sm text-slate-500">{productName} — {bandaraName}</span>
        )}
      </div>

      {selectedProductId && !selectedBandara && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 text-sm">
          Pilih bandara (BTH, CGK, SBY, UPG) untuk menampilkan kalender kuota per tanggal dan booking owner.
        </div>
      )}

      {selectedProductId && selectedBandara && (
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
                  const isPopover = popoverDate === dateStr;

                  return (
                    <div
                      key={i}
                      className={`relative min-h-[100px] border-b border-r border-slate-100 p-1.5 ${
                        !isInMonth ? 'bg-slate-50/50' : 'bg-white'
                      } ${isPopover ? 'ring-2 ring-primary-400 ring-inset' : ''}`}
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
                                    <Users className="w-3.5 h-3.5 text-primary-500" />
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
            <span>Keterangan: angka = dipesan/kuota per tanggal (bandara {bandaraName}). Booking dihitung dari item tiket dengan tanggal keberangkatan (departure_date).</span>
          </div>
        </>
      )}
    </div>
  );
};

export default TicketCalendarView;
