import React, { useEffect, useMemo, useState } from 'react';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  triggerAriaLabel?: string;
  menuWidthClass?: string;
}

const toneClassMap: Record<NonNullable<ActionMenuItem['tone']>, string> = {
  default: 'text-slate-700 hover:bg-slate-50',
  success: 'text-emerald-700 hover:bg-emerald-50',
  warning: 'text-amber-700 hover:bg-amber-50',
  danger: 'text-red-600 hover:bg-red-50',
  info: 'text-sky-700 hover:bg-sky-50'
};

const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  triggerAriaLabel = 'Buka menu aksi',
  menuWidthClass = 'w-[190px]'
}) => {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const visibleItems = useMemo(() => items.filter((item) => Boolean(item)), [items]);

  useEffect(() => {
    if (!menuPos) return;
    const closeMenu = () => setMenuPos(null);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menuPos]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setMenuPos((prev) =>
            prev
              ? null
              : {
                  top: rect.top - 6,
                  left: Math.max(8, rect.right - 190)
                }
          );
        }}
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
        aria-label={triggerAriaLabel}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {menuPos && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] cursor-default"
            onClick={() => setMenuPos(null)}
            aria-label="Tutup menu aksi"
          />
          <div
            className={`fixed z-[90] ${menuWidthClass} rounded-xl border border-slate-200 bg-white shadow-lg p-1`}
            style={{ top: menuPos.top, left: menuPos.left, transform: 'translateY(-100%)' }}
          >
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.onClick();
                  setMenuPos(null);
                }}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2 ${toneClassMap[item.tone || 'default']}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
};

export default ActionMenu;
