import React from 'react';
import { inputBaseClass, inputBorderClass, inputErrorBorderClass, labelClass } from './formStyles';

interface InputProps {
  label?: string;
  type?: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  className?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  /** Optional link or text on the right of the label (e.g. "Lupa kata sandi?") */
  rightLabel?: React.ReactNode;
  /** Optional content after the input (e.g. password visibility toggle) */
  suffix?: React.ReactNode;
  title?: string;
  /** For type="file": accepted MIME types or extensions (e.g. "image/*,.pdf") */
  accept?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  icon,
  error,
  disabled = false,
  readOnly = false,
  required = false,
  fullWidth = true,
  className = '',
  min,
  max,
  step,
  minLength,
  maxLength,
  autoComplete,
  rightLabel,
  suffix,
  title,
  accept
}) => {
  const borderStyles = error ? inputErrorBorderClass : inputBorderClass;
  const iconPadding = icon ? 'pl-12' : '';
  const widthStyles = fullWidth ? 'w-full' : '';
  const readOnlyStyles = readOnly ? 'bg-slate-50 cursor-default' : '';
  const suffixPadding = suffix ? 'pr-12' : '';

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {(label || rightLabel) && (
        <div className="flex items-center justify-between gap-2 mb-2">
          {label && <label className="block text-sm font-semibold text-slate-700">{label}</label>}
          {rightLabel}
        </div>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          name={name}
          value={type === 'file' ? undefined : value}
          accept={accept}
          onChange={onChange}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          min={min}
          max={max}
          step={step}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          title={title}
          className={`${inputBaseClass} ${borderStyles} ${iconPadding} ${suffixPadding} ${widthStyles} ${readOnlyStyles} text-sm`}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center">
            {suffix}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Input;