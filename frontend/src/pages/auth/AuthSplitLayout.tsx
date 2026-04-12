import React from 'react';
import { Link } from 'react-router-dom';
import { Star, LayoutDashboard, Users, Plane } from 'lucide-react';

const BRAND_NAVY = '#0D1A63';
const BRAND_NAVY_SOFT = '#152a7a';

type AuthSplitLayoutProps = {
  /** Konten kolom kiri (form) */
  children: React.ReactNode;
  /** Judul panel kanan (diabaikan jika singleColumn) */
  panelTitle?: string;
  /** Deskripsi panel kanan */
  panelSubtitle?: string;
  /** Teks link kaki panel kanan (opsional) */
  panelFooterLink?: { to: string; label: string };
  /** Hanya kartu form putih, tanpa panel biru (mis. halaman daftar) */
  singleColumn?: boolean;
  /** Kelas lebar kartu saat singleColumn, contoh: max-w-3xl w-full */
  singleColumnClassName?: string;
};

/**
 * Layout dua kolom: form putih + panel biru — atau satu kolom jika `singleColumn`.
 */
export function AuthSplitLayout({
  children,
  panelTitle = '',
  panelSubtitle = '',
  panelFooterLink,
  singleColumn = false,
  singleColumnClassName = 'max-w-xl w-full',
}: AuthSplitLayoutProps) {
  if (singleColumn) {
    return (
      <div
        className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8"
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        <div
          className={`${singleColumnClassName} bg-white rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden flex flex-col`}
        >
          <div className="flex-1 flex flex-col min-w-0 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 bg-white">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-[960px] bg-white rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden flex flex-col md:flex-row md:min-h-[560px]">
        {/* Kolom kiri — form */}
        <div className="flex-1 flex flex-col min-w-0 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 bg-white">{children}</div>

        {/* Kolom kanan — panel merek (sembunyi di layar sempit) */}
        <div
          className="hidden md:flex md:w-[min(44%,420px)] flex-shrink-0 flex-col justify-between p-10 lg:p-12 text-white relative overflow-hidden"
          style={{ background: `linear-gradient(165deg, ${BRAND_NAVY} 0%, ${BRAND_NAVY_SOFT} 48%, #0a1447 100%)` }}
        >
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
            <div
              className="absolute -right-20 -top-20 w-72 h-72 rounded-full border-2 border-white"
              style={{ borderColor: 'rgba(255,255,255,0.25)' }}
            />
            <div
              className="absolute -left-16 bottom-1/4 w-48 h-48 rounded-full border border-white"
              style={{ borderColor: 'rgba(255,255,255,0.2)' }}
            />
          </div>

          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-3 opacity-90">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
                <LayoutDashboard className="w-6 h-6 text-white" strokeWidth={1.75} />
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center -ml-2">
                <Users className="w-5 h-5 text-white/90" />
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center -ml-2">
                <Plane className="w-5 h-5 text-white/90" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl lg:text-[1.65rem] font-bold leading-snug tracking-tight">{panelTitle}</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/85 max-w-[280px]">{panelSubtitle}</p>
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex gap-2 justify-center md:justify-start">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === 0 ? 'w-6 bg-white' : 'w-1.5 bg-white/35'}`}
                  aria-hidden
                />
              ))}
            </div>
            {panelFooterLink && (
              <Link
                to={panelFooterLink.to}
                className="text-sm text-white/80 hover:text-white underline-offset-2 hover:underline w-fit"
              >
                {panelFooterLink.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Baris logo teks Bintang Global (kolom form). */
export function AuthBrandLogoRow() {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md shrink-0"
        style={{
          background: 'linear-gradient(135deg, #0D1A63 0%, #152a7a 55%, #1e3a8a 100%)',
        }}
      >
        <Star className="w-6 h-6 text-white" fill="white" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-lg font-extrabold tracking-tight" style={{ color: BRAND_NAVY }}>
          Bintang Global
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Umroh & Travel</p>
      </div>
    </div>
  );
}
