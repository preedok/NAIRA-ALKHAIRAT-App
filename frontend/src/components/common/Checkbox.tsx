import React from 'react';
import { checkboxClass, labelClass } from './formStyles';

interface CheckboxProps {
  id?: string;
  label?: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  className = ''
}) => {
  const inputId = id || `checkbox-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        type="checkbox"
        id={inputId}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={checkboxClass}
      />
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700 cursor-pointer">
          {label}
        </label>
      )}
    </div>
  );
};

export default Checkbox;
