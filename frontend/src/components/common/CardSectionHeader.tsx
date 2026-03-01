import React from 'react';

export interface CardSectionHeaderProps {
  /** Judul section (contoh: "Produk visa (harga dari admin pusat)") */
  title: string;
  /** Deskripsi di bawah judul (contoh: "Lihat saja. Pekerjaan visa di menu Visa.") */
  subtitle?: string;
  /** Ikon opsional di kiri judul (biasanya dari lucide-react, ukuran w-6 h-6) */
  icon?: React.ReactNode;
  /** Konten kanan: tombol aksi, dll. */
  right?: React.ReactNode;
  className?: string;
}

/**
 * Header seragam untuk card/table di semua halaman menu.
 * Pola: [icon] judul + deskripsi | [tombol kanan]
 * Contoh: Produk visa (harga dari admin pusat) / Lihat saja. Pekerjaan visa di menu Visa.
 */
const CardSectionHeader: React.FC<CardSectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  right,
  className = ''
}) => (
  <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 ${className}`}>
    <div className="flex items-start gap-3 min-w-0">
      {icon != null && (
        <div className="p-2.5 rounded-xl bg-[#0D1A63]/10 text-[#0D1A63] shrink-0 flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {subtitle != null && subtitle !== '' && (
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
    {right != null && <div className="shrink-0">{right}</div>}
  </div>
);

export default CardSectionHeader;
