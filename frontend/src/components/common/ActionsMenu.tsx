import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface ActionsMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionsMenuProps {
  items: ActionsMenuItem[];
  className?: string;
  /** Align dropdown: 'left' | 'right' (default right) */
  align?: 'left' | 'right';
}

/**
 * Menu aksi seragam (ikon titik tiga) untuk semua role dan halaman.
 * Responsif: dropdown diposisikan agar tidak keluar viewport.
 */
const ActionsMenu: React.FC<ActionsMenuProps> = ({ items, className = '', align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 160;
    const padding = 8;
    let left = align === 'right' ? rect.right - menuWidth : rect.left;
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) left = window.innerWidth - menuWidth - padding;
    setPosition({ top: rect.bottom + 4, left });
  }, [open, align]);

  const visibleItems = items.filter((i) => !i.disabled);

  if (visibleItems.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors ${className}`}
        aria-label="Aksi"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      {open && position && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed z-[9999] py-1 bg-white border border-slate-200 rounded-xl shadow-xl min-w-[160px] max-w-[90vw]"
            style={{ top: position.top, left: position.left }}
            role="menu"
          >
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                aria-label={item.label}
                title={item.label}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 justify-start px-4 py-2.5 text-left text-sm transition-colors ${
                  item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.icon ? <span className="flex-shrink-0">{item.icon}</span> : null}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default ActionsMenu;
