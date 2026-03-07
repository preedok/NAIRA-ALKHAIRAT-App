import React from 'react';
import Card from './Card';

export interface StatCardProps {
  /** Ikon (biasanya dari lucide-react, ukuran w-5 h-5) */
  icon: React.ReactNode;
  /** Label singkat (mis. "Total User", "Menunggu") */
  label: string;
  /** Nilai yang ditampilkan (angka atau string) */
  value: React.ReactNode;
  /** Diabaikan: semua ikon statistik memakai satu warna (primary). Disimpan untuk kompatibilitas. */
  iconClassName?: string;
  /** Teks opsional di bawah value (mis. nominal dalam format IDR) */
  subtitle?: React.ReactNode;
  /** Opsi: tombol/link di bawah konten (mis. "View All") */
  action?: React.ReactNode;
  /** Opsi: klik card untuk buka detail (popup dll) */
  onClick?: () => void;
  className?: string;
}

const DEFAULT_ICON_CLASS = 'bg-[#0D1A63] text-white';

/**
 * Card statistik seragam di semua halaman: ukuran dan layout sama.
 * Yang bisa beda: icon, label, value, subtitle, action.
 */
const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  subtitle,
  action,
  onClick,
  className = ''
}) => {
  const content = (
    <>
      <div className="flex items-center gap-3 p-4 flex-1 min-w-0">
        <div className={`rounded-xl flex items-center justify-center shrink-0 w-11 h-11 ${DEFAULT_ICON_CLASS}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums mt-1 truncate leading-tight">{value}</p>
          {subtitle != null && subtitle !== '' && (
            <p className="text-xs text-slate-400 mt-0.5 truncate leading-tight">{subtitle}</p>
          )}
        </div>
      </div>
      {action != null && (
        <div className="px-4 pb-3 pt-0 border-t border-slate-100 flex-shrink-0">
          {action}
        </div>
      )}
    </>
  );
  const card = (
    <Card hover padding="none" className={`travel-card flex flex-col overflow-hidden ${className}`}>
      {content}
    </Card>
  );
  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-travel"
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      >
        {card}
      </div>
    );
  }
  return card;
};

export default StatCard;
