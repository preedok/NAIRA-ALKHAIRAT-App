import React from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { TableColumn } from '../../types';

export interface TablePagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export interface TableSort {
  columnId: string;
  order: 'asc' | 'desc';
}

interface TableProps<T> {
  columns: TableColumn[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  pagination?: TablePagination;
  sort?: TableSort;
  onSortChange?: (columnId: string, order: 'asc' | 'desc') => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500];

function Table<T>({
  columns,
  data,
  renderRow,
  emptyMessage = 'No data available',
  className = '',
  pagination,
  sort,
  onSortChange
}: TableProps<T>) {
  const pag = pagination;
  const startItem = pag ? (pag.page - 1) * pag.limit + 1 : 1;
  const endItem = pag ? Math.min(pag.page * pag.limit, pag.total) : data.length;

  const handleSort = (col: TableColumn) => {
    if (!col.sortable || !onSortChange) return;
    const sortKey = col.sortKey ?? col.id;
    if (sort?.columnId === sortKey) {
      onSortChange(sortKey, sort.order === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(sortKey, 'asc');
    }
  };

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-slate-200">
              {columns.map((column) => {
                const sortKey = column.sortKey ?? column.id;
                const isSorted = sort?.columnId === sortKey;
                return (
                  <th
                    key={column.id}
                    className={`px-6 py-4 text-sm font-bold text-slate-900 uppercase tracking-wider ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'} ${column.sortable ? 'cursor-pointer select-none hover:bg-slate-50' : ''}`}
                    onClick={() => column.sortable && handleSort(column)}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortable && (
                        <span className="inline-flex text-slate-400">
                          {isSorted ? (sort!.order === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronsUpDown className="w-4 h-4" />}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => renderRow(item, index))
            )}
          </tbody>
        </table>
      </div>
      {pag && pag.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              Menampilkan {startItem}-{endItem} dari {pag.total}
            </span>
            {pag.onLimitChange && (
              <select
                value={pag.limit}
                onChange={(e) => pag.onLimitChange?.(Number(e.target.value))}
                className="px-2 py-1 border border-slate-200 rounded text-slate-700 bg-white"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} per halaman</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pag.onPageChange(pag.page - 1)}
              disabled={pag.page <= 1}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>
            <span className="px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg">
              Halaman {pag.page} dari {pag.totalPages}
            </span>
            <button
              type="button"
              onClick={() => pag.onPageChange(pag.page + 1)}
              disabled={pag.page >= pag.totalPages}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Table;