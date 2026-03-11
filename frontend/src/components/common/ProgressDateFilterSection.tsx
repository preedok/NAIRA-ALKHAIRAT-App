/**
 * Pengaturan Filter tanggal untuk menu Progress divisi (Visa, Tiket, Hotel, Bus, Handling).
 * Opsi: Hari ini, 3/4/5 hari kedepan, 1/2/3 minggu kedepan, 1 bulan kedepan.
 */

import React from 'react';
import {
  PROGRESS_DATE_RANGE_OPTIONS,
  getProgressDateRange,
  type ProgressDateRangeKey
} from '../../utils/progressDateFilter';

export interface ProgressDateFilterSectionProps {
  /** Nilai terpilih */
  value: ProgressDateRangeKey;
  /** Callback saat pilihan berubah */
  onChange: (value: ProgressDateRangeKey) => void;
  /** Judul blok (default: "Filter data") */
  title?: string;
  /** ClassName untuk wrapper */
  className?: string;
}

const ProgressDateFilterSection: React.FC<ProgressDateFilterSectionProps> = ({
  value,
  onChange,
  title = 'Filter data',
  className = ''
}) => {
  return (
    <div className={`rounded-xl bg-slate-50/80 border border-slate-200 p-4 ${className}`}>
      <p className="text-sm font-semibold text-slate-700 mb-1">Pengaturan Filter</p>
      <p className="text-xs text-slate-500 mb-3">{title}</p>
      <div className="flex flex-wrap gap-2">
        {PROGRESS_DATE_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value || 'all'}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              value === opt.value
                ? 'bg-[#0D1A63] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProgressDateFilterSection;
export { getProgressDateRange, PROGRESS_DATE_RANGE_OPTIONS };
export type { ProgressDateRangeKey } from '../../utils/progressDateFilter';
