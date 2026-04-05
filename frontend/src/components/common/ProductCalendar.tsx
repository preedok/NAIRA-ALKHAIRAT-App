import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ContentLoading from './ContentLoading';

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** YYYY-MM-DD di zona waktu lokal browser — jangan pakai toISOString() (UTC) agar tidak geser tanggal (mis. WIB: tgl 1 kosong, check-in tampil di hari salah). */
function formatDateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface ProductCalendarMonth {
  year: number;
  month: number;
}

export interface ProductCalendarDayInfo<T = unknown> {
  dateStr: string;
  dayIndex: number;
  isInMonth: boolean;
  isToday: boolean;
  data: T | undefined;
  openPopover: () => void;
  closePopover: () => void;
  isPopoverOpen: boolean;
}

export interface ProductCalendarProps<T = unknown> {
  month: ProductCalendarMonth;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday?: () => void;
  data: Record<string, T> | null;
  loading?: boolean;
  renderDayContent: (info: ProductCalendarDayInfo<T>) => React.ReactNode;
  popoverDate: string | null;
  onPopoverToggle: (dateStr: string | null) => void;
  renderPopover?: (params: { dateStr: string; data: T; onClose: () => void }) => React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  minCellHeight?: number;
}

function ProductCalendarInner<T>({
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
  data,
  loading = false,
  renderDayContent,
  popoverDate,
  onPopoverToggle,
  renderPopover,
  footer,
  className = '',
  minCellHeight = 120
}: ProductCalendarProps<T>) {
  const monthStart = new Date(month.year, month.month, 1);
  const monthEnd = new Date(month.year, month.month + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const firstDayOfWeek = monthStart.getDay();
  const leadingEmpty = firstDayOfWeek;
  const totalCells = Math.ceil((leadingEmpty + daysInMonth) / 7) * 7;

  const monthLabel = new Date(month.year, month.month).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric'
  });

  const todayStr = formatDateKeyLocal(new Date());

  return (
    <div className={`rounded-3xl bg-white shadow-xl shadow-slate-200/50 overflow-hidden ${className}`}>
      {/* Header — minimal */}
      <div className="flex items-center justify-between px-6 py-5">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex items-center justify-center w-11 h-11 rounded-2xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 capitalize tracking-tight">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-2">
          {onToday && (
            <button
              type="button"
              onClick={onToday}
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Hari ini
            </button>
          )}
          <button
            type="button"
            onClick={onNextMonth}
            className="flex items-center justify-center w-11 h-11 rounded-2xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12">
          <ContentLoading minHeight={360} />
        </div>
      ) : (
        <>
          {/* Weekday row */}
          <div className="grid grid-cols-7 border-t border-b border-slate-100 bg-slate-50/50">
            {WEEKDAY_LABELS.map((d) => (
              <div
                key={d}
                className="py-3 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid — no gaps, clean borders */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }, (_, i) => {
              const dayIndex = i - leadingEmpty + 1;
              const isInMonth = dayIndex >= 1 && dayIndex <= daysInMonth;
              const date = isInMonth
                ? new Date(month.year, month.month, dayIndex)
                : null;
              const dateStr = date ? formatDateKeyLocal(date) : '';
              const dayData = dateStr && data ? (data[dateStr] as T | undefined) : undefined;
              const isToday = dateStr === todayStr;
              const isPopoverOpen = popoverDate === dateStr;

              return (
                <div
                  key={i}
                  className={`relative border-r border-b border-slate-100 last:border-r-0 transition-colors ${
                    !isInMonth ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50/70'
                  } ${isPopoverOpen ? 'z-10 bg-blue-50/50 ring-2 ring-inset ring-blue-400/30' : ''}`}
                  style={{ minHeight: minCellHeight }}
                >
                  {isInMonth && (
                    <div className={`h-full p-4 flex flex-col ${isToday ? 'bg-blue-50/30' : ''}`}>
                      {renderDayContent({
                        dateStr,
                        dayIndex,
                        isInMonth,
                        isToday,
                        data: dayData,
                        openPopover: () => onPopoverToggle(dateStr),
                        closePopover: () => onPopoverToggle(null),
                        isPopoverOpen
                      })}
                      {renderPopover && dayData && isPopoverOpen && (
                        <div className="absolute z-50 left-2 right-2 top-full mt-2 rounded-2xl bg-white shadow-2xl border border-slate-100 p-4 max-h-64 overflow-y-auto">
                          {renderPopover({
                            dateStr,
                            data: dayData,
                            onClose: () => onPopoverToggle(null)
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {footer && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 text-xs text-slate-500">
              {footer}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ProductCalendar = ProductCalendarInner as <T = unknown>(props: ProductCalendarProps<T>) => React.ReactElement;

export default ProductCalendar;
