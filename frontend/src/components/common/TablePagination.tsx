import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Autocomplete from './Autocomplete';
import Button from './Button';

export interface TablePaginationProps {
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
  loading?: boolean;
  showLimitSelector?: boolean;
  label?: string;
}

const TablePagination: React.FC<TablePaginationProps> = ({
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 25, 50, 100, 200],
  loading = false,
  showLimitSelector = true,
  label
}) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 mt-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">
          {label || `Menampilkan ${start}-${end} dari ${total}`}
        </span>
        {showLimitSelector && onLimitChange && (
          <Autocomplete
            value={String(limit)}
            onChange={(v) => onLimitChange(Number(v))}
            options={limitOptions.map((n) => ({ value: String(n), label: `${n} per halaman` }))}
            fullWidth={false}
            className="w-28 min-w-0"
            size="sm"
          />
        )}
      </div>
      <div className="flex gap-2 items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || loading}
          className="border-slate-200 text-slate-700 p-2 min-w-[36px]"
          title="Sebelumnya"
          aria-label="Sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="py-2 px-3 text-sm text-slate-600">
          Halaman {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || loading}
          className="border-slate-200 text-slate-700 p-2 min-w-[36px]"
          title="Selanjutnya"
          aria-label="Selanjutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default TablePagination;
