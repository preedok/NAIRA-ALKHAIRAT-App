import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { SelectOption, TableColumn } from '../../types';
import Autocomplete from './Autocomplete';

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

const STICKY_ACTIONS_CLASS = 'sticky right-0 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]';
const STICKY_ACTIONS_TH_CLASS = 'sticky right-0 z-20 bg-slate-50/95 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]';

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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500];
const PAGE_SIZE_SELECT_OPTIONS: SelectOption[] = PAGE_SIZE_OPTIONS.map((n) => ({
  value: String(n),
  label: `${n} per halaman`
}));

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
  const [internalPage, setInternalPage] = useState(1);
  const [internalLimit, setInternalLimit] = useState(10);

  const isControlledPagination = Boolean(pagination);
  const total = pagination?.total ?? data.length;
  const limit = pagination?.limit ?? internalLimit;
  const totalPagesRaw = isControlledPagination
    ? (pagination?.totalPages ?? 1)
    : Math.ceil(Math.max(1, total) / Math.max(1, limit));
  const totalPages = Math.max(1, totalPagesRaw);
  const pageRaw = pagination?.page ?? internalPage;
  const page = Math.min(Math.max(1, pageRaw), totalPages);

  useEffect(() => {
    if (isControlledPagination) return;
    if (internalPage > totalPages) setInternalPage(totalPages);
  }, [isControlledPagination, internalPage, totalPages]);

  const pagedData = useMemo(() => {
    if (isControlledPagination) return data;
    const start = (page - 1) * limit;
    return data.slice(start, start + limit);
  }, [isControlledPagination, data, page, limit]);

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);

  const onPageChange = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    if (isControlledPagination) {
      pagination?.onPageChange(safePage);
      return;
    }
    setInternalPage(safePage);
  };

  const onLimitChange = (nextLimit: number) => {
    if (isControlledPagination) {
      pagination?.onLimitChange?.(nextLimit);
      return;
    }
    setInternalLimit(nextLimit);
    setInternalPage(1);
  };

  const pageButtons = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, -1, totalPages];
    if (page >= totalPages - 3) return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, -1, page - 1, page, page + 1, -1, totalPages];
  }, [page, totalPages]);

  return (
    <div className={className}>
      <div className="table-scroll-wrap overflow-x-auto overflow-y-visible">
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
            {pagedData.length === 0 ? (
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
              pagedData.map((item, index) => {
                const absoluteIndex = (page - 1) * limit + index;
                const row = renderRow(item, absoluteIndex);
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
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              Menampilkan {startItem}-{endItem} dari {total}
            </span>
            <div className="w-[170px]">
              <Autocomplete
                value={String(limit)}
                onChange={(value) => onLimitChange(Number(value) || PAGE_SIZE_OPTIONS[0])}
                options={PAGE_SIZE_SELECT_OPTIONS}
                size="sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>
            {pageButtons.map((pageNo, idx) =>
              pageNo === -1 ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
              ) : (
                <button
                  key={pageNo}
                  type="button"
                  onClick={() => onPageChange(pageNo)}
                  className={`min-w-9 px-2.5 py-2 rounded-lg border text-sm font-medium ${
                    pageNo === page
                      ? 'border-btn bg-btn text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNo}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
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