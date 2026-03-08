import React, { useState, useEffect, useMemo } from 'react';
import { Plane, Users, X, MapPin, ArrowLeftRight, Plus } from 'lucide-react';
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
  onAddQuotaClick?: () => void;
}

const TicketCalendarView: React.FC<TicketCalendarViewProps> = ({ ticketProducts, onAddQuotaClick }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isOwner = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';
  const canSeeBookingDetails = !isOwner;
  const canAddQuota = !isOwner && !!onAddQuotaClick;
  const [tripTypeFilter, setTripTypeFilter] = useState<TicketTripType | ''>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedBandara, setSelectedBandara] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState<ProductCalendarMonth>(() => {
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
    <div className="space-y-5">
      {/* Filter panel */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#0D1A63]" />
            Pilih filter untuk menampilkan kalender
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Perjalanan, produk tiket, dan bandara menentukan data yang ditampilkan.</p>
        </div>
        <div className="p-5 flex flex-wrap items-end gap-4">
          <Autocomplete
            label="Perjalanan"
            value={tripTypeFilter}
            onChange={(v) => { setTripTypeFilter(v as TicketTripType | ''); }}
            options={Object.entries(TRIP_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            emptyLabel="Semua"
            className="min-w-[160px]"
            fullWidth={false}
          />
          <Autocomplete
            label="Produk Tiket"
            value={selectedProductId}
            onChange={(v) => { setSelectedProductId(v); setSelectedBandara(''); }}
            options={filteredTicketProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
            placeholder="-- Pilih tiket --"
            className="min-w-[220px]"
            fullWidth={false}
          />
          {selectedProductId && (
            <Autocomplete
              label="Bandara"
              value={selectedBandara}
              onChange={setSelectedBandara}
              options={BANDARA_TIKET.map((b) => ({ value: b.code, label: `${b.name} (${b.code})` }))}
              placeholder="-- Pilih bandara --"
              className="min-w-[160px]"
              fullWidth={false}
            />
          )}
          {selectedProductId && selectedBandara && productName && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D1A63]/10 text-[#0D1A63] text-sm font-medium border border-[#0D1A63]/20">
              {productName} · {bandaraName}
            </div>
          )}
        </div>
      </div>

      {ticketProducts.length > 0 && filteredTicketProducts.length === 0 && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-6 text-center text-amber-800 text-sm shadow-sm">
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
        <ProductCalendar<CalendarDayData>
          month={calendarMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          data={calendarData}
          loading={loading}
          popoverDate={popoverDate}
          onPopoverToggle={setPopoverDate}
          footer={`Hijau = tersedia, Kuning = hampir penuh, Merah = penuh. Role selain owner bisa lihat siapa yang beli dan tambah kuota (kuning/merah).`}
          renderDayContent={({ dayIndex, isToday, data: day, openPopover, isPopoverOpen }) => {
            const quota = day?.quota ?? 0;
            const available = day?.available ?? 0;
            const hasQuota = day && ((day.quota ?? 0) > 0 || (day.booked ?? 0) > 0);
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
                {day && (
                  <div className={`mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] font-semibold tabular-nums ${statusStyles}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <span>
                      {day.booked ?? 0}/{day.quota ?? 0}
                      {(day.available ?? 0) >= 0 && <span className="font-normal opacity-90"> · {day.available} tersedia</span>}
                    </span>
                  </div>
                )}
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
            </>
          ) : undefined}
        />
      )}
    </div>
  );
};

export default TicketCalendarView;
