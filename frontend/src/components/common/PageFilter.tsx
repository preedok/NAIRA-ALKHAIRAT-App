import React from 'react';
import { Filter, FilterX } from 'lucide-react';
import Button from './Button';
import Card from './Card';

/** Tombol ikon filter untuk diletakkan di header (sebelah kanan refresh). Ukuran konsisten dengan tombol refresh (h-9 w-9). */
export const FilterIconButton: React.FC<{
  open: boolean;
  onToggle: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}> = ({ open, onToggle, hasActiveFilters = false, className = '' }) => (
  <Button
    variant="outline"
    size="sm"
    icon={open ? <FilterX className="w-4 h-4 shrink-0" /> : <Filter className="w-4 h-4 shrink-0" />}
    className={`relative h-9 w-9 p-0 min-w-[2.25rem] shrink-0 inline-flex items-center justify-center [&_.mr-2]:m-0 ${className}`}
    onClick={onToggle}
    aria-expanded={open}
    aria-label={open ? 'Sembunyikan filter' : 'Tampilkan filter'}
    title={open ? 'Sembunyikan filter' : 'Tampilkan filter'}
  >
    {hasActiveFilters && (
      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#0D1A63] rounded-full ring-2 ring-white" aria-hidden />
    )}
  </Button>
);

interface PageFilterProps {
  open: boolean;
  onToggle: () => void;
  onReset?: () => void;
  hasActiveFilters?: boolean;
  loading?: boolean;
  onApply?: () => void;
  applyLabel?: string;
  resetLabel?: string;
  /** Judul di dalam card (default: Pengaturan Filter) */
  cardTitle?: string;
  /** Deskripsi singkat di bawah judul card (default: Atur kriteria lalu klik Terapkan. Reset untuk kosongkan.) */
  cardDescription?: string;
  children: React.ReactNode;
  /** Tambahan toolbar di samping tombol Filter (mis. Tambah Order) */
  toolbar?: React.ReactNode;
  /** Jika true, baris tombol filter tidak ditampilkan — gunakan FilterIconButton di header. */
  hideToggleRow?: boolean;
  className?: string;
}

/**
 * Filter seragam: tombol "Filter" untuk buka/tutup panel. Panel tertata rapi, UI modern.
 * Filter tidak tampil langsung — user klik tombol untuk membuka.
 */
const DEFAULT_CARD_TITLE = 'Pengaturan Filter';
const DEFAULT_CARD_DESCRIPTION = 'Atur kriteria lalu klik Terapkan. Reset untuk kosongkan.';

const PageFilter: React.FC<PageFilterProps> = ({
  open,
  onToggle,
  onReset,
  hasActiveFilters = false,
  loading = false,
  onApply,
  applyLabel = 'Terapkan',
  resetLabel = 'Reset',
  cardTitle = DEFAULT_CARD_TITLE,
  cardDescription = DEFAULT_CARD_DESCRIPTION,
  children,
  toolbar,
  hideToggleRow = false,
  className = ''
}) => {
  const card = open && (
        <Card className="mt-4 w-full min-w-0 p-5 sm:p-6 bg-slate-50/80 border border-slate-200/80 rounded-xl shadow-sm">
          <div className="mb-4 pb-3 border-b border-slate-200/80 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0D1A63]/10 text-[#0D1A63]">
              <Filter className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800">{cardTitle}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{cardDescription}</p>
            </div>
          </div>
          <div className="w-full space-y-5">
            {children}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-slate-200/80">
            {onApply && (
              <Button variant="primary" size="sm" onClick={onApply} disabled={loading} className="bg-[#0D1A63] hover:bg-[#0a1449] focus:ring-[#0D1A63]">
                {loading ? 'Memuat...' : applyLabel}
              </Button>
            )}
            {onReset && (
              <Button variant="outline" size="sm" onClick={onReset} className="border-slate-200 text-slate-700 hover:bg-slate-100">
                {resetLabel}
              </Button>
            )}
          </div>
        </Card>
  );

  if (hideToggleRow) {
    return <div className={`w-full ${className}`}>{card}</div>;
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 min-h-[40px]">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <FilterIconButton open={open} onToggle={onToggle} hasActiveFilters={hasActiveFilters} />
          {hasActiveFilters && onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0 text-slate-600">
              {resetLabel}
            </Button>
          )}
        </div>
        {toolbar && <div className="shrink-0">{toolbar}</div>}
      </div>
      {card}
    </div>
  );
};

export default PageFilter;
