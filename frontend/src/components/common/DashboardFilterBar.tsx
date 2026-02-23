import React from 'react';
import { Filter } from 'lucide-react';
import Button from './Button';

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';
const labelClass = 'block text-xs font-medium text-slate-500 mb-1';
const selectMinWidth = 'min-w-[140px]';

export interface DashboardFilterBarProps {
  variant?: 'page' | 'modal';
  loading?: boolean;
  showWilayah?: boolean;
  showProvinsi?: boolean;
  showBranch?: boolean;
  showStatus?: boolean;
  statusType?: 'order' | 'invoice';
  showDateRange?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  showSearch2?: boolean;
  search2Placeholder?: string;
  showReset?: boolean;
  showOrderStatus?: boolean;
  showOwner?: boolean;
  showDueStatus?: boolean;
  showSort?: boolean;
  wilayahId?: string;
  provinsiId?: string;
  branchId?: string;
  status?: string;
  orderStatus?: string;
  ownerId?: string;
  dueStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  search2?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  sortOptions?: { value: string; label: string }[];
  onSortByChange?: (v: string) => void;
  onSortOrderChange?: (v: 'asc' | 'desc') => void;
  onWilayahChange?: (v: string) => void;
  onProvinsiChange?: (v: string) => void;
  onBranchChange?: (v: string) => void;
  onStatusChange?: (v: string) => void;
  onOrderStatusChange?: (v: string) => void;
  onOwnerChange?: (v: string) => void;
  onDueStatusChange?: (v: string) => void;
  onDateFromChange?: (v: string) => void;
  onDateToChange?: (v: string) => void;
  onSearchChange?: (v: string) => void;
  onSearch2Change?: (v: string) => void;
  onApply: () => void;
  onReset?: () => void;
  /** Sembunyikan tombol Terapkan/Reset (untuk dipakai di dalam PageFilter) */
  hideActions?: boolean;
  wilayahList?: { id: string; name: string }[];
  provinces?: { id: string | number; name?: string; nama?: string }[];
  branches?: { id: string; code: string; name: string }[];
  orderStatusOptions?: Record<string, string>;
  invoiceStatusOptions?: { value: string; label: string }[];
  owners?: { id: string; name?: string; User?: { name?: string; company_name?: string } }[];
  dueStatusOptions?: { value: string; label: string }[];
}

const DEFAULT_INVOICE_STATUS_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'tentative', label: 'Tentative' },
  { value: 'partial_paid', label: 'Partial Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
  variant = 'page',
  loading = false,
  showWilayah = false,
  showProvinsi = false,
  showBranch = false,
  showStatus = false,
  statusType = 'order',
  showDateRange = false,
  showSearch = false,
  searchPlaceholder = 'Cari...',
  showSearch2 = false,
  search2Placeholder = 'Cari...',
  showReset = true,
  showOrderStatus = false,
  showOwner = false,
  showDueStatus = false,
  showSort = false,
  wilayahId = '',
  provinsiId = '',
  branchId = '',
  status = '',
  orderStatus = '',
  ownerId = '',
  dueStatus = '',
  dateFrom = '',
  dateTo = '',
  search = '',
  search2 = '',
  sortBy = 'created_at',
  sortOrder = 'desc',
  sortOptions = [
    { value: 'created_at', label: 'Tanggal dibuat' },
    { value: 'invoice_number', label: 'Nomor invoice' },
    { value: 'total_amount', label: 'Total' },
    { value: 'status', label: 'Status' }
  ],
  onSortByChange,
  onSortOrderChange,
  onWilayahChange,
  onProvinsiChange,
  onBranchChange,
  onStatusChange,
  onOrderStatusChange,
  onOwnerChange,
  onDueStatusChange,
  onDateFromChange,
  onDateToChange,
  onSearchChange,
  onSearch2Change,
  onApply,
  onReset,
  hideActions = false,
  wilayahList = [],
  provinces = [],
  branches = [],
  orderStatusOptions = {},
  invoiceStatusOptions = DEFAULT_INVOICE_STATUS_OPTIONS,
  owners = [],
  dueStatusOptions = [
    { value: '', label: 'Semua' },
    { value: 'current', label: 'Current' },
    { value: 'due', label: 'Jatuh tempo hari ini' },
    { value: 'overdue', label: 'Terlambat' },
  ],
}) => {
  const isModal = variant === 'modal';
  const gridClass = isModal
    ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3'
    : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';
  const selectClass = isModal ? inputClass : `${inputClass} ${selectMinWidth}`;

  return (
    <div className={gridClass}>
      {variant === 'page' && (
        <div className="flex items-end gap-2 pb-2">
          <Filter className="w-5 h-5 text-primary-600 shrink-0" />
          <span className="text-slate-600 font-medium">Filter</span>
        </div>
      )}
      {showWilayah && (
        <div>
          <label className={labelClass}>Wilayah</label>
          <select value={wilayahId} onChange={(e) => onWilayahChange?.(e.target.value)} className={selectClass}>
            <option value="">{isModal ? 'Semua' : 'Semua wilayah'}</option>
            {wilayahList.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}
      {showProvinsi && (
        <div>
          <label className={labelClass}>Provinsi</label>
          <select value={provinsiId} onChange={(e) => onProvinsiChange?.(e.target.value)} className={selectClass}>
            <option value="">{isModal ? 'Semua' : 'Semua provinsi'}</option>
            {provinces.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{p.name ?? (p as { nama?: string }).nama ?? ''}</option>
            ))}
          </select>
        </div>
      )}
      {showBranch && (
        <div>
          <label className={labelClass}>Cabang</label>
          <select value={branchId} onChange={(e) => onBranchChange?.(e.target.value)} className={selectClass}>
            <option value="">{isModal ? 'Semua' : 'Semua cabang'}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
            ))}
          </select>
        </div>
      )}
      {showStatus && (
        <div>
          <label className={labelClass}>{statusType === 'order' ? 'Status Order' : 'Status Invoice'}</label>
          <select value={status} onChange={(e) => onStatusChange?.(e.target.value)} className={selectClass}>
            {statusType === 'order' ? (
              <>
                <option value="">Semua status</option>
                {Object.entries(orderStatusOptions).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </>
            ) : (
              invoiceStatusOptions.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))
            )}
          </select>
        </div>
      )}
      {showOwner && (
        <div>
          <label className={labelClass}>Owner</label>
          <select value={ownerId} onChange={(e) => onOwnerChange?.(e.target.value)} className={selectClass}>
            <option value="">Semua owner</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name ?? o.User?.name ?? o.User?.company_name ?? o.id}</option>
            ))}
          </select>
        </div>
      )}
      {showDueStatus && (
        <div>
          <label className={labelClass}>Jatuh Tempo</label>
          <select value={dueStatus} onChange={(e) => onDueStatusChange?.(e.target.value)} className={selectClass}>
            {dueStatusOptions.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}
      {showDateRange && (
        <>
          <div>
            <label className={labelClass}>Dari</label>
            <input type="date" value={dateFrom} onChange={(e) => onDateFromChange?.(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Sampai</label>
            <input type="date" value={dateTo} onChange={(e) => onDateToChange?.(e.target.value)} className={inputClass} />
          </div>
        </>
      )}
      {showSearch && (
        <div>
          <label className={labelClass}>No. Order</label>
          <input type="text" value={search} onChange={(e) => onSearchChange?.(e.target.value)} placeholder={searchPlaceholder} className={inputClass} />
        </div>
      )}
      {showSearch2 && (
        <div>
          <label className={labelClass}>No. Invoice</label>
          <input type="text" value={search2} onChange={(e) => onSearch2Change?.(e.target.value)} placeholder={search2Placeholder} className={inputClass} />
        </div>
      )}
      {showSort && (
        <>
          <div>
            <label className={labelClass}>Urutkan</label>
            <select value={sortBy} onChange={(e) => onSortByChange?.(e.target.value)} className={selectClass}>
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Arah</label>
            <select value={sortOrder} onChange={(e) => onSortOrderChange?.(e.target.value as 'asc' | 'desc')} className={selectClass}>
              <option value="desc">Terbaru dulu</option>
              <option value="asc">Terlama dulu</option>
            </select>
          </div>
        </>
      )}
      {!hideActions && (
        <div className={`flex items-end gap-2 ${isModal ? 'col-span-2' : ''}`}>
          <Button variant="primary" size={isModal ? 'sm' : 'md'} onClick={onApply} disabled={loading}>
            {loading ? 'Memuat...' : 'Terapkan'}
          </Button>
          {showReset && onReset && (
            <Button variant="outline" size={isModal ? 'sm' : 'md'} onClick={onReset}>
              Reset
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardFilterBar;
