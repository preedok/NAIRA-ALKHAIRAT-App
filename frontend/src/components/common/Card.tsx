import React from 'react';
import { CardPadding } from '../../types';

interface CardProps {
  children: React.ReactNode;
  padding?: CardPadding;
  hover?: boolean;
  className?: string;
}

const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  hover = false,
  className = ''
}) => {
  const baseStyles = 'bg-white rounded-travel border border-stone-200/90 shadow-card transition-all duration-300 relative overflow-hidden';
  
  const paddingStyles: Record<CardPadding, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8'
  };

  const hoverStyles = hover ? 'hover:shadow-travel hover:-translate-y-0.5' : '';

  return (
    <div className={`${baseStyles} ${paddingStyles[padding]} ${hoverStyles} ${className}`}>
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#8f6828]/70 via-[#b78734]/70 to-[#d3b274]/70" />
      {children}
    </div>
  );
};

export default Card;