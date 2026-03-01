import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SelectOption } from '../../types';
import { inputBaseClass, inputBorderClass, labelClass } from './formStyles';

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
}

const Autocomplete: React.FC<AutocompleteProps> = ({
  value,
  onChange,
  options,
  label,
  placeholder = 'Pilih...',
  disabled = false,
  fullWidth = true,
  className = '',
  emptyLabel
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = value === '' && emptyLabel != null ? emptyLabel : (selectedOption?.label ?? value ?? '');

  const filtered =
    query.trim() === ''
      ? options
      : options.filter(
          (o) =>
            o.label.toLowerCase().includes(query.toLowerCase()) ||
            (o.value !== '' && o.value.toLowerCase().includes(query.toLowerCase()))
        );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (opt: SelectOption) => {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  const inputBorder = inputBorderClass;
  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <div ref={containerRef} className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && <label className={labelClass}>{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          className={`${inputBaseClass} ${inputBorder} ${widthStyles} w-full text-left flex items-center justify-between gap-2 bg-white`}
        >
          <span className={selectedOption || value ? 'text-slate-800' : 'text-slate-500'}>{displayLabel || placeholder}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full min-w-[200px] max-h-60 overflow-auto rounded-xl border-2 border-slate-200 bg-white shadow-lg focus:ring-2 focus:ring-[#0D1A63]">
            <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari..."
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
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${value === '' ? 'bg-slate-100 font-medium text-[#0D1A63]' : 'text-slate-700'}`}
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
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50 ${value === opt.value ? 'bg-slate-100 font-medium text-[#0D1A63]' : 'text-slate-700'}`}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">Tidak ada hasil</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Autocomplete;
