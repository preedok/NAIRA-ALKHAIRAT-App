import React, { useEffect } from 'react';

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

  return (
    <div
      className={`fixed inset-0 w-full h-full min-h-screen overflow-y-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-md ${className}`}
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className="flex items-center justify-center min-h-full w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
