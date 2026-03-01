import React, { useRef } from 'react';
import { inputBaseClass, inputBorderClass, inputErrorBorderClass } from './formStyles';
import { formatPriceForInput, parsePriceInput, type PriceCurrency } from '../../utils';

export type PriceCurrencyOption = PriceCurrency;

export interface PriceInputProps {
  label?: string;
  value: number;
  currency: PriceCurrencyOption;
  onChange: (value: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
  className?: string;
  error?: string;
}

/**
 * Input harga: saat fokus tampilkan input mentah agar user bisa hapus/edit bagian belakang (mis. 550.00 → 550.0 → 550).
 * Saat blur format otomatis sesuai mata uang (IDR: pemisah ribuan, SAR/USD: 2 desimal).
 */
const PriceInput: React.FC<PriceInputProps> = ({
  label,
  value,
  currency,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder = '0',
  fullWidth = true,
  className = '',
  error
}) => {
  /** Input mentah saat user sedang mengedit (agar bisa hapus desimal/angka belakang) */
  const lastRawInputRef = useRef<string | null>(null);

  const formatted = value === 0 || Number.isNaN(value) ? '' : formatPriceForInput(value, currency);
  const isRawStale =
    lastRawInputRef.current != null &&
    parsePriceInput(lastRawInputRef.current, currency) !== value;
  if (isRawStale) lastRawInputRef.current = null;
  const displayValue =
    disabled || readOnly ? formatted : (lastRawInputRef.current ?? formatted);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const inputValue = e.target.value;
    lastRawInputRef.current = inputValue;
    const num = parsePriceInput(inputValue, currency);
    onChange(num);
  };

  const handleBlur = () => {
    lastRawInputRef.current = null;
  };

  const borderStyles = error ? inputErrorBorderClass : inputBorderClass;
  const widthStyles = fullWidth ? 'w-full' : '';
  const readOnlyStyles = readOnly ? 'bg-slate-50 cursor-default' : '';

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <div className="mb-2">
          <label className="block text-sm font-semibold text-slate-700">{label}</label>
        </div>
      )}
      <input
        type="text"
        inputMode={currency === 'IDR' ? 'numeric' : 'decimal'}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`${inputBaseClass} ${borderStyles} ${widthStyles} ${readOnlyStyles} text-sm`}
        aria-label={label}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default PriceInput;
