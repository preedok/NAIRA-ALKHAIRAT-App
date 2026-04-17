import React from 'react';
import { inputBaseClass, inputBorderClass } from './formStyles';
import { formatRupiah, parseRupiah } from '../../utils/currency';

interface CurrencyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Rp 0',
  className = ''
}) => {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>}
      <input
        type="text"
        inputMode="numeric"
        value={value > 0 ? formatRupiah(value) : ''}
        onChange={(e) => onChange(parseRupiah(e.target.value))}
        placeholder={placeholder}
        className={`${inputBaseClass} ${inputBorderClass} w-full text-sm`}
      />
    </div>
  );
};

export default CurrencyInput;
