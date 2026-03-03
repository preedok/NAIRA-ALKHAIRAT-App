import React from 'react';
import { Loader2 } from 'lucide-react';

/** Pesan loading standar untuk seluruh aplikasi */
export const CONTENT_LOADING_MESSAGE = 'Memuat data...';

export interface ContentLoadingProps {
  /** ClassName tambahan untuk wrapper */
  className?: string;
  /** Tinggi minimum area (default: 200px untuk konsistensi di card/table) */
  minHeight?: number | string;
  /** Inline/compact untuk di dalam table cell atau area kecil */
  inline?: boolean;
}

/**
 * Komponen loading konten tunggal untuk semua halaman dan role.
 * Tampilan modern, pesan seragam: "Memuat data..."
 */
const ContentLoading: React.FC<ContentLoadingProps> = ({
  className = '',
  minHeight = 200,
  inline = false
}) => {
  const minHeightStyle = inline ? undefined : (typeof minHeight === 'number' ? `${minHeight}px` : minHeight);

  if (inline) {
    return (
      <span
        className={`inline-flex items-center gap-2 text-slate-500 ${className}`}
        role="status"
        aria-live="polite"
        aria-label={CONTENT_LOADING_MESSAGE}
      >
        <Loader2 className="w-5 h-5 animate-spin text-[#0D1A63] shrink-0" aria-hidden />
        <span className="text-sm font-medium text-slate-600">{CONTENT_LOADING_MESSAGE}</span>
      </span>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-12 text-slate-500 ${className}`}
      style={{ minHeight: minHeightStyle }}
      role="status"
      aria-live="polite"
      aria-label={CONTENT_LOADING_MESSAGE}
    >
      <Loader2
        className="w-10 h-10 animate-spin text-[#0D1A63]"
        aria-hidden
      />
      <p className="text-sm font-medium text-slate-600">
        {CONTENT_LOADING_MESSAGE}
      </p>
    </div>
  );
};

export default ContentLoading;
