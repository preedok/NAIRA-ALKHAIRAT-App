import React from 'react';
import { Loader2 } from 'lucide-react';
import { ButtonVariant, ButtonSize } from '../../types';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'title' | 'children'> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  title?: string;
  'aria-label'?: string;
}

const Button: React.FC<ButtonProps> = ({
  children = null,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  disabled = false,
  icon,
  onClick,
  type = 'button',
  className = '',
  title,
  'aria-label': ariaLabel,
  ...rest
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-btn text-white shadow-sm hover:bg-btn-hover focus:ring-btn',
    secondary: 'bg-btn text-white hover:bg-btn-hover shadow-sm focus:ring-btn',
    outline: 'bg-white text-[#0D1A63] border-2 border-stone-200 hover:border-btn hover:bg-btn-light focus:ring-btn',
    ghost: 'bg-transparent text-stone-600 hover:bg-btn-light focus:ring-stone-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm focus:ring-red-500'
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'px-8 py-4 text-base'
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`}
      title={title}
      aria-label={ariaLabel}
      {...rest}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon && <span className={children ? 'mr-2' : ''}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;