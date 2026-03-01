import React from 'react';
import { inputBaseClass, inputBorderClass, inputErrorBorderClass, labelClass } from './formStyles';

interface TextareaProps {
  label?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  className?: string;
  rows?: number;
  minLength?: number;
  maxLength?: number;
}

const Textarea: React.FC<TextareaProps> = ({
  label,
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled = false,
  readOnly = false,
  required = false,
  fullWidth = true,
  className = '',
  rows = 3,
  minLength,
  maxLength
}) => {
  const borderStyles = error ? inputErrorBorderClass : inputBorderClass;
  const widthStyles = fullWidth ? 'w-full' : '';
  const readOnlyStyles = readOnly ? 'bg-slate-50 cursor-default' : '';
  const isControlled = value !== undefined;

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && <label className={labelClass}>{label}</label>}
      <textarea
        name={name}
        {...(isControlled ? { value } : { defaultValue })}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        rows={rows}
        minLength={minLength}
        maxLength={maxLength}
        className={`${inputBaseClass} ${borderStyles} ${widthStyles} ${readOnlyStyles} text-sm resize-y min-h-[80px]`}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Textarea;
