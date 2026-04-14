import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { SelectOption } from '../../types';
import { inputBaseClass, inputBorderClass, labelClass } from './formStyles';
import { AUTOCOMPLETE_PILIH } from '../../utils/constants';

export interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  /** Optional empty option label (e.g. "Semua") when value is '' */
  emptyLabel?: string;
  /** Ukuran tampilan: md (default) atau sm (compact, untuk pagination dll) */
  size?: 'sm' | 'md';
}

const Autocomplete: React.FC<AutocompleteProps> = ({
  value,
  onChange,
  options,
  label,
  placeholder = AUTOCOMPLETE_PILIH.PILIH,
  disabled = false,
  fullWidth = true,
  className = '',
  emptyLabel,
  size = 'md'
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; minWidth: number }>({ top: 0, left: 0, minWidth: 200 });
  const [dropdownReady, setDropdownReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = value === '' && emptyLabel != null ? emptyLabel : (selectedOption?.label ?? value ?? '');

  const filteredRaw =
    query.trim() === ''
      ? options
      : options.filter(
          (o) =>
            o.label.toLowerCase().includes(query.toLowerCase()) ||
            (o.value !== '' && o.value.toLowerCase().includes(query.toLowerCase()))
        );
  /** Hindari duplikat opsi "Semua": jika emptyLabel dipakai, jangan tampilkan lagi opsi dengan value '' dari options */
  const filtered = emptyLabel != null ? filteredRaw.filter((o) => o.value !== '') : filteredRaw;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsidePortal = (e.target as Element).closest?.('[data-autocomplete-dropdown]');
      if (!isInsideContainer && !isInsidePortal) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setDropdownReady(false);
      return;
    }
    if (buttonRef.current && typeof document !== 'undefined') {
      const updatePosition = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          setDropdownStyle({
            top: rect.bottom + 4,
            left: rect.left,
            minWidth: Math.max(rect.width, 200)
          });
          setDropdownReady(true);
        }
      };
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open]);

  const handleSelect = (opt: SelectOption) => {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  const inputBorder = inputBorderClass;
  const widthStyles = fullWidth ? 'w-full' : '';
  const triggerSizeClass = size === 'sm'
    ? 'py-1.5 px-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#C9A04B] focus:border-[#C9A04B] disabled:bg-slate-100 disabled:cursor-not-allowed transition-all'
    : '';

  const dropdownContent = open && dropdownReady && (
    <div
      data-autocomplete-dropdown
      className="fixed z-[9999] max-h-60 overflow-auto rounded-xl border-2 border-slate-200 bg-white shadow-lg"
      style={{ top: dropdownStyle.top, left: dropdownStyle.left, minWidth: dropdownStyle.minWidth }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={AUTOCOMPLETE_PILIH.CARI}
          className={`${inputBaseClass} ${inputBorder} w-full py-2 text-sm`}
          autoFocus
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      <ul className="py-1">
        {emptyLabel != null && (
          <li>
            <button
              type="button"
              onClick={() => handleSelect({ value: '', label: emptyLabel })}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${value === '' ? 'bg-slate-100 font-medium text-[#B78734]' : 'text-slate-700'}`}
            >
              {emptyLabel}
            </button>
          </li>
        )}
        {filtered.map((opt) => (
          <li key={opt.value || 'empty'}>
            <button
              type="button"
              onClick={() => handleSelect(opt)}
              disabled={opt.disabled}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50 ${value === opt.value ? 'bg-slate-100 font-medium text-[#B78734]' : 'text-slate-700'}`}
            >
              {opt.label}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-500">{AUTOCOMPLETE_PILIH.TIDAK_ADA_HASIL}</li>
        )}
      </ul>
    </div>
  );

  return (
    <div ref={containerRef} className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && <label className={labelClass}>{label}</label>}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          className={`${size === 'md' ? inputBaseClass : triggerSizeClass} ${size === 'md' ? inputBorder : ''} ${widthStyles} w-full text-left flex items-center justify-between gap-2 bg-white`}
        >
          <span className={selectedOption || value ? 'text-slate-800' : 'text-slate-500'}>{displayLabel || placeholder}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {typeof document !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
      </div>
    </div>
  );
};

export default Autocomplete;
