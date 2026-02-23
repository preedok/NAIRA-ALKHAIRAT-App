import React from 'react';
import { Filter } from 'lucide-react';
import Button from './Button';
import Card from './Card';

interface PageFilterProps {
  open: boolean;
  onToggle: () => void;
  onReset?: () => void;
  hasActiveFilters?: boolean;
  loading?: boolean;
  onApply?: () => void;
  applyLabel?: string;
  resetLabel?: string;
  children: React.ReactNode;
  /** Tambahan toolbar di samping tombol Filter (mis. Tambah Order) */
  toolbar?: React.ReactNode;
  className?: string;
}

/**
 * Komponen filter seragam untuk semua halaman: tombol Filter + panel collapse.
 * Layout rapi, responsive (grid menyesuaikan layar).
 */
const PageFilter: React.FC<PageFilterProps> = ({
  open,
  onToggle,
  onReset,
  hasActiveFilters = false,
  loading = false,
  onApply,
  applyLabel = 'Terapkan',
  resetLabel = 'Reset',
  children,
  toolbar,
  className = ''
}) => {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 min-h-[40px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button variant="outline" size="sm" onClick={onToggle} className="shrink-0">
            <Filter className="w-4 h-4 mr-2" />
            <span className="whitespace-nowrap">
              Filter {hasActiveFilters && (
                <span className="ml-1.5 px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 rounded-full align-middle">
                  aktif
                </span>
              )}
            </span>
          </Button>
          {hasActiveFilters && onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0">
              {resetLabel}
            </Button>
          )}
        </div>
        {toolbar && <div className="shrink-0">{toolbar}</div>}
      </div>

      {open && (
        <Card className="mt-4 p-4 sm:p-5 bg-slate-50/90 border border-slate-200 rounded-xl shadow-sm">
          <div className="space-y-4">
            {children}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-200">
            {onApply && (
              <Button variant="primary" size="sm" onClick={onApply} disabled={loading}>
                {loading ? 'Memuat...' : applyLabel}
              </Button>
            )}
            {onReset && (
              <Button variant="outline" size="sm" onClick={onReset}>
                {resetLabel}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PageFilter;
