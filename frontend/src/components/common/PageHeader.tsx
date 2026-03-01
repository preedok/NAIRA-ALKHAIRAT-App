import React from 'react';

export interface PageHeaderProps {
  /** Judul halaman (kiri atas) */
  title: string;
  /** Deskripsi singkat di bawah judul (opsional) */
  subtitle?: string;
  /** Konten kiri tambahan (mis. tombol back) di sebelah judul */
  leftAddon?: React.ReactNode;
  /** Konten kanan: AutoRefreshControl, tombol aksi, dll. — sejajar dengan judul */
  right?: React.ReactNode;
  className?: string;
}

/**
 * Header halaman seragam: judul di kiri, kontrol (refresh/tombol) di kanan, satu baris.
 * UI modern dengan background halus dan tata letak rapi untuk semua halaman dashboard.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, leftAddon, right, className = '' }) => {
  return (
    <header
      className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 px-5 pt-2 pb-4 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-sm ${className}`}
    >
      <div className="min-w-0 flex items-start sm:items-center gap-3 flex-1">
        {leftAddon}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-slate-600 text-sm mt-1 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {right != null && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {right}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
