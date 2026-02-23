import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50 mt-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">
          {label || `Menampilkan ${start}-${end} dari ${total}`}
        </span>
        {showLimitSelector && onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="px-2 py-1 border border-slate-200 rounded text-slate-700 bg-white text-sm"
          >
            {limitOptions.map((n) => (
              <option key={n} value={n}>{n} per halaman</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-1 items-center">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || loading}
          className="p-2 rounded border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-50"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="py-2 px-3 text-sm text-slate-600">
          Halaman {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || loading}
          className="p-2 rounded border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-50"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TablePagination;
