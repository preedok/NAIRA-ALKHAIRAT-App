import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bus, Users, X, Plus } from 'lucide-react';
import Autocomplete from '../../../components/common/Autocomplete';
import ProductCalendar, { type ProductCalendarMonth } from '../../../components/common/ProductCalendar';
import { productsApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

const ALMOST_FULL_THRESHOLD = 0.2;
type AvailabilityStatus = 'available' | 'almost_full' | 'full';
function getAvailabilityStatus(quota: number, available: number): AvailabilityStatus {
  if (quota <= 0) return 'available';
  if (available <= 0) return 'full';
  if (available <= Math.max(1, Math.ceil(quota * ALMOST_FULL_THRESHOLD))) return 'almost_full';
  return 'available';
}

export interface BusProduct {
  id: string;
  code: string;
  name: string;
  meta?: { trip_type?: string; route_prices?: Record<string, number> } | null;
}

type CalendarDayData = {
  _noSeason?: boolean;
  seasonId?: string;
  seasonName?: string;
  quota?: number;
  booked?: number;
  available?: number;
  bookings?: { order_id: string; owner_id: string; owner_name: string; quantity: number }[];
};

interface BusCalendarViewProps {
  busProducts: BusProduct[];
  onAddQuotaClick?: () => void;
}

const BusCalendarView: React.FC<BusCalendarViewProps> = ({ busProducts, onAddQuotaClick }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isOwner = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';
  const canSeeBookingDetails = !isOwner;
  const canAddQuota = !isOwner && !!onAddQuotaClick;
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState<ProductCalendarMonth>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDayData> | null>(null);
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [popoverDate, setPopoverDate] = useState<string | null>(null);

  const selectedProduct = useMemo(() => busProducts.find((p) => p.id === selectedProductId), [busProducts, selectedProductId]);

  const monthStart = useMemo(() => new Date(calendarMonth.year, calendarMonth.month, 1), [calendarMonth]);
  const monthEnd = useMemo(() => new Date(calendarMonth.year, calendarMonth.month + 1, 0), [calendarMonth]);
  const fromStr = monthStart.toISOString().slice(0, 10);
  const toStr = monthEnd.toISOString().slice(0, 10);

  const fetchCalendar = useCallback((silent = false) => {
    if (!selectedProductId) return;
    if (!silent) setLoading(true);
    productsApi
      .getBusCalendar(selectedProductId, { from: fromStr, to: toStr })
      .then((res) => {
        if (res.data?.data) {
          const d = res.data.data as { byDate?: Record<string, CalendarDayData>; productName?: string };
          setCalendarData(d.byDate || null);
          setProductName(d.productName || selectedProduct?.name || '');
        } else {
          setCalendarData(null);
        }
      })
      .catch(() => {
        setCalendarData(null);
        if (!silent) showToast('Gagal memuat kalender bus', 'error');
      })
      .finally(() => { if (!silent) setLoading(false); });
  }, [selectedProductId, fromStr, toStr, selectedProduct?.name, showToast]);

  useEffect(() => {
    if (!selectedProductId) {
      setCalendarData(null);
      return;
    }
    fetchCalendar(false);
    const interval = setInterval(() => fetchCalendar(true), 30000);
    return () => clearInterval(interval);
  }, [selectedProductId, fromStr, toStr, fetchCalendar]);

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

  if (busProducts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 text-center shadow-sm">
        <div className="inline-flex p-4 rounded-2xl bg-slate-100 text-slate-500 mb-4">
          <Bus className="h-12 w-12" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Belum ada produk bus</h3>
        <p className="text-slate-600 mt-1">Tambah bus di tab Daftar Bus untuk melihat kalender kuota.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <Autocomplete
          label="Pilih Produk Bus"
          value={selectedProductId}
          onChange={setSelectedProductId}
          options={busProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
          placeholder="-- Pilih bus --"
          className="min-w-[220px]"
          fullWidth={false}
        />
        {selectedProductId && productName && (
          <span className="text-sm text-slate-600 font-medium pb-1">{productName}</span>
        )}
      </div>

      {!selectedProductId && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-8 text-center text-amber-800 text-sm shadow-sm">
          <p className="font-medium">Pilih produk bus di atas untuk menampilkan kalender kuota per tanggal dan booking owner.</p>
        </div>
      )}

      {selectedProductId && (
        <ProductCalendar<CalendarDayData>
          month={calendarMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          data={calendarData}
          loading={loading}
          popoverDate={popoverDate}
          onPopoverToggle={setPopoverDate}
          footer="Hijau = tersedia, Kuning = hampir penuh, Merah = penuh. Role selain owner bisa lihat siapa yang beli dan tambah kuota (kuning/merah)."
          renderDayContent={({ dayIndex, isToday, data: day, openPopover, isPopoverOpen }) => {
            const quota = day?.quota ?? 0;
            const available = day?.available ?? 0;
            const hasQuota = day && (day.quota !== undefined || day.booked !== undefined);
            const status: AvailabilityStatus = hasQuota && quota > 0 ? getAvailabilityStatus(quota, available) : 'available';
            const statusStyles = status === 'full' ? 'bg-rose-50 text-rose-700 border-rose-200' : status === 'almost_full' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200';
            const dotColor = status === 'full' ? 'bg-rose-400' : status === 'almost_full' ? 'bg-amber-400' : 'bg-emerald-400';
            const showAddQuota = canAddQuota && (status === 'full' || status === 'almost_full');
            return (
              <>
                <div className="flex items-start justify-between gap-1">
                  <span className={`tabular-nums font-bold ${isToday ? 'flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg bg-blue-600 text-white text-lg' : `text-xl text-slate-800 ${!day ? 'text-slate-300' : ''}`}`}>
                    {dayIndex}
                  </span>
                  {showAddQuota && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onAddQuotaClick?.(); }} className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors shrink-0" title="Tambah kuota">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {hasQuota && (
                  <div className={`mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] font-semibold tabular-nums ${statusStyles}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <span>
                      {day?.booked ?? 0}/{day?.quota ?? '—'}
                      {day?.available !== undefined && <span className="font-normal opacity-90"> · {day.available} tersedia</span>}
                    </span>
                  </div>
                )}
                {day?._noSeason && day.quota === undefined && day.booked === undefined && <p className="mt-2 text-[11px] text-slate-400">—</p>}
                {canSeeBookingDetails && day?.bookings?.length ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); openPopover(); }} className={`mt-3 text-[11px] font-semibold flex items-center gap-1.5 rounded-lg py-1.5 px-2 w-full justify-center transition-colors ${isPopoverOpen ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
                    <Users className="w-3.5 h-3.5" /> {day.bookings.length} owner
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
                    <p className="text-xs text-slate-600 mt-0.5">Jumlah: <strong>{b.quantity}</strong></p>
                  </div>
                ))}
              </div>
              {day?.seasonName && (
                <p className="text-[11px] text-slate-400 mt-3">Periode: {day.seasonName}</p>
              )}
            </>
          ) : undefined}
        />
      )}
    </div>
  );
};

export default BusCalendarView;
