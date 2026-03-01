import React from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
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

const STICKY_ACTIONS_CLASS = 'sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]';
const STICKY_ACTIONS_TH_CLASS = 'sticky right-0 z-10 bg-slate-50/95 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]';

interface TableProps<T> {
  columns: TableColumn[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  /** Deskripsi tambahan di bawah emptyMessage (opsional) */
  emptyDescription?: string;
  /** Ikon kustom untuk empty state (default: Inbox) */
  emptyIcon?: React.ReactNode;
  className?: string;
  pagination?: TablePagination;
  sort?: TableSort;
  onSortChange?: (columnId: string, order: 'asc' | 'desc') => void;
  /** Kolom Aksi (kolom terakhir) tetap terlihat saat tabel di-scroll horizontal */
  stickyActionsColumn?: boolean;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500];

function Table<T>({
  columns,
  data,
  renderRow,
  emptyMessage = 'Tidak ada data',
  emptyDescription,
  emptyIcon,
  className = '',
  pagination,
  sort,
  onSortChange,
  stickyActionsColumn = false
}: TableProps<T>) {
  const pag = pagination;
  const startItem = pag ? (pag.page - 1) * pag.limit + 1 : 1;
  const endItem = pag ? Math.min(pag.page * pag.limit, pag.total) : data.length;

  return (
    <div className={className}>
      <div className="overflow-x-auto overflow-y-visible">
        <table className="text-sm min-w-max w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/95">
              {columns.map((column, colIndex) => {
                const isLastCol = stickyActionsColumn && colIndex === columns.length - 1;
                return (
                  <th
                    key={column.id}
                    className={`py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'} ${isLastCol ? STICKY_ACTIONS_TH_CLASS : ''}`}
                  >
                    {column.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0 align-top">
                  <div className="flex flex-col items-center justify-center min-h-[280px] px-6 py-14 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100">
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mb-4 shadow-inner">
                      {emptyIcon ?? <Inbox className="w-8 h-8" strokeWidth={1.5} />}
                    </div>
                    <p className="text-base font-semibold text-slate-700 mb-1">{emptyMessage}</p>
                    {emptyDescription != null && emptyDescription !== '' && (
                      <p className="text-sm text-slate-500 max-w-sm text-center">{emptyDescription}</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const row = renderRow(item, index);
                if (!stickyActionsColumn || !React.isValidElement(row) || row.type !== 'tr') return row;
                const children = React.Children.toArray(row.props.children);
                if (children.length === 0) return row;
                const lastIndex = children.length - 1;
                const lastChild = children[lastIndex];
                if (!React.isValidElement(lastChild)) return row;
                const existingClassName = typeof lastChild.props.className === 'string' ? lastChild.props.className : '';
                const newLast = React.cloneElement(lastChild as React.ReactElement<{ className?: string }>, {
                  className: `${existingClassName} ${STICKY_ACTIONS_CLASS}`.trim()
                });
                const newChildren = [...children.slice(0, lastIndex), newLast];
                return React.cloneElement(row, {}, newChildren);
              })
            )}
          </tbody>
        </table>
      </div>
      {pag && pag.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200">
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