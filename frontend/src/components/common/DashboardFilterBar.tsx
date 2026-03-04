import React from 'react';
import { Filter } from 'lucide-react';
import Input from './Input';
import Autocomplete from './Autocomplete';
import { AUTOCOMPLETE_FILTER, AUTOCOMPLETE_PILIH } from '../../utils/constants';

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
  { value: '', label: AUTOCOMPLETE_FILTER.SEMUA },
  { value: 'tentative', label: 'Tagihan DP' },
  { value: 'partial_paid', label: 'Pembayaran DP' },
  { value: 'paid', label: 'Lunas' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'canceled', label: 'Dibatalkan' },
  { value: 'cancelled_refund', label: 'Dibatalkan Refund' },
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
  searchPlaceholder = AUTOCOMPLETE_PILIH.CARI,
  showSearch2 = false,
  search2Placeholder = AUTOCOMPLETE_PILIH.CARI,
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
    ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'
    : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';
  /** Saat dipakai di dalam PageFilter, header "Filter" tidak ditampilkan (sudah ada di panel) */
  const showHeader = variant === 'page' && !hideActions;

  return (
    <div className={gridClass}>
      {showHeader && (
        <div className="col-span-full flex items-center gap-2 pb-1">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-sm font-medium text-slate-600">Filter</span>
        </div>
      )}
      {showWilayah && (
        <Autocomplete
          label="Wilayah"
          value={wilayahId}
          onChange={(v) => onWilayahChange?.(v)}
          options={wilayahList.map((w) => ({ value: w.id, label: w.name }))}
          emptyLabel={isModal ? AUTOCOMPLETE_FILTER.SEMUA : AUTOCOMPLETE_FILTER.SEMUA_WILAYAH}
        />
      )}
      {showProvinsi && (
        <Autocomplete
          label="Provinsi"
          value={provinsiId}
          onChange={(v) => onProvinsiChange?.(v)}
          options={provinces.map((p) => ({ value: String(p.id), label: p.name ?? (p as { nama?: string }).nama ?? '' }))}
          emptyLabel={isModal ? AUTOCOMPLETE_FILTER.SEMUA : AUTOCOMPLETE_FILTER.SEMUA_PROVINSI}
        />
      )}
      {showBranch && (
        <Autocomplete
          label="Cabang"
          value={branchId}
          onChange={(v) => onBranchChange?.(v)}
          options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))}
          emptyLabel={isModal ? AUTOCOMPLETE_FILTER.SEMUA : AUTOCOMPLETE_FILTER.SEMUA_CABANG}
        />
      )}
      {showStatus && (
        <Autocomplete
          label={statusType === 'order' ? 'Status Order' : 'Status Invoice'}
          value={status}
          onChange={(v) => onStatusChange?.(v)}
          options={
            statusType === 'order'
              ? Object.entries(orderStatusOptions).map(([k, v]) => ({ value: k, label: v }))
              : invoiceStatusOptions
          }
          emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_STATUS}
        />
      )}
      {showOwner && (
        <Autocomplete
          label="Owner"
          value={ownerId}
          onChange={(v) => onOwnerChange?.(v)}
          options={owners.map((o) => ({ value: o.id, label: o.name ?? o.User?.name ?? o.User?.company_name ?? o.id }))}
          emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_OWNER}
        />
      )}
      {showDueStatus && (
        <Autocomplete
          label="Jatuh Tempo"
          value={dueStatus}
          onChange={(v) => onDueStatusChange?.(v)}
          options={dueStatusOptions}
        />
      )}
      {showDateRange && (
        <>
          <Input label="Dari" type="date" value={dateFrom} onChange={(e) => onDateFromChange?.(e.target.value)} fullWidth />
          <Input label="Sampai" type="date" value={dateTo} onChange={(e) => onDateToChange?.(e.target.value)} fullWidth />
        </>
      )}
      {showSearch && (
        <Input label="No. Invoice" value={search} onChange={(e) => onSearchChange?.(e.target.value)} placeholder={searchPlaceholder} fullWidth />
      )}
      {showSearch2 && (
        <Input label="No. Invoice" value={search2} onChange={(e) => onSearch2Change?.(e.target.value)} placeholder={search2Placeholder} fullWidth />
      )}
      {showSort && (
        <>
          <Autocomplete
            label="Urutkan"
            value={sortBy}
            onChange={(v) => onSortByChange?.(v)}
            options={sortOptions}
          />
          <Autocomplete
            label="Arah"
            value={sortOrder}
            onChange={(v) => onSortOrderChange?.(v as 'asc' | 'desc')}
            options={[
              { value: 'desc', label: 'Terbaru dulu' },
              { value: 'asc', label: 'Terlama dulu' }
            ]}
          />
        </>
      )}
    </div>
  );
};

export default DashboardFilterBar;
