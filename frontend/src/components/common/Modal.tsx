import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Layout } from 'lucide-react';

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when backdrop is clicked or escape key */
  onClose: () => void;
  /** Modal content (clicking content does not close) */
  children: React.ReactNode;
  /** Optional: disable closing on backdrop click */
  closeOnBackdrop?: boolean;
  /** Optional: z-index (default 50) */
  zIndex?: number;
  /** Optional: extra class for the overlay (e.g. padding) */
  className?: string;
}

/**
 * Reusable modal dengan overlay full viewport, blur, dan dark backdrop.
 * Tidak ada celah/space – overlay menutup seluruh layar.
 * Gunakan ModalHeader (warna seperti tombol primary), ModalBody, ModalFooter untuk tampilan konsisten.
 */
const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  closeOnBackdrop = true,
  zIndex = 50,
  className = ''
}) => {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const overlay = (
    <div
      className={`fixed overflow-y-auto flex items-center justify-center bg-black/50 backdrop-blur-md ${className}`}
      style={{
        zIndex,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        minWidth: '100%',
        height: '100%',
        minHeight: '100dvh',
      }}
      role="dialog"
      aria-modal="true"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className="flex items-center justify-center min-h-full w-full pt-0 pb-6 px-4 box-border"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : null;
};

/** Header modal konsisten: warna biru seperti menu (bg-btn), selalu dengan ikon di samping title dan tombol tutup */
export interface ModalHeaderProps {
  title: React.ReactNode;
  /** Subtitle atau deskripsi di bawah title (opsional) */
  subtitle?: React.ReactNode;
  /** Icon di samping title — selalu ditampilkan; jika tidak dikirim pakai Layout sebagai default */
  icon?: React.ReactNode;
  onClose: () => void;
  /** Class tambahan untuk wrapper header */
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ title, subtitle, icon, onClose, className = '' }) => (
  <div className={`flex items-center justify-between gap-4 px-6 py-4 bg-btn text-white rounded-t-2xl shrink-0 ${className}`}>
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 text-white">
        {icon ?? <Layout className="w-5 h-5" />}
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-white truncate">{title}</h2>
        {subtitle != null && subtitle !== '' && <div className="text-sm text-white/90 mt-0.5">{subtitle}</div>}
      </div>
    </div>
    <button
      type="button"
      onClick={onClose}
      className="flex-shrink-0 p-2 rounded-xl hover:bg-white/20 text-white transition-colors"
      aria-label="Tutup"
    >
      <X className="w-5 h-5" />
    </button>
  </div>
);

/** Body modal: area konten dengan padding */
export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className = '' }) => (
  <div className={`flex-1 overflow-y-auto p-6 ${className}`}>{children}</div>
);

/** Footer modal: area aksi (tombol) dengan border atas */
export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => (
  <div className={`flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl ${className}`}>{children}</div>
);

/** Wrapper kotak modal: bg white, rounded, shadow. Ukuran seragam di semua halaman. */
export interface ModalBoxProps {
  children: React.ReactNode;
  /** Hanya untuk utility (mis. flex), hindari override max-w/max-h agar konsisten */
  className?: string;
}

/** Ukuran standar: min-h 80vh, max-h 95vh. rounded-2xl + overflow-hidden agar header (anak pertama) menutup penuh tanpa strip putih. */
const MODAL_BOX_BASE = 'bg-white rounded-2xl shadow-xl border border-slate-200/80 border-t-0 flex flex-col w-full min-h-[80vh] max-h-[95vh] overflow-hidden';

/** ModalBox default: dipakai seragam di semua halaman (form, konfirmasi, dll) */
export const ModalBox: React.FC<ModalBoxProps> = ({ children, className = '' }) => (
  <div className={`${MODAL_BOX_BASE} max-w-6xl ${className}`}>
    {children}
  </div>
);

/** ModalBoxMd: sama dengan default, alias untuk form */
export const ModalBoxMd: React.FC<ModalBoxProps> = ({ children, className = '' }) => (
  <div className={`${MODAL_BOX_BASE} max-w-6xl ${className}`}>
    {children}
  </div>
);

/** ModalBoxLg: untuk detail/list yang butuh lebar lebih (invoice, tabel, dll) */
export const ModalBoxLg: React.FC<ModalBoxProps> = ({ children, className = '' }) => (
  <div className={`${MODAL_BOX_BASE} max-w-6xl ${className}`}>
    {children}
  </div>
);

/** ModalBoxXl: untuk daftar/dashboard full (order list, invoice list) */
export const ModalBoxXl: React.FC<ModalBoxProps> = ({ children, className = '' }) => (
  <div className={`${MODAL_BOX_BASE} max-w-6xl ${className}`}>
    {children}
  </div>
);

export default Modal;
