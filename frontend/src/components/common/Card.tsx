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
  const baseStyles = 'bg-white rounded-travel border border-stone-200/80 shadow-card transition-all duration-300';
  
  const paddingStyles: Record<CardPadding, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8'
  };

  const hoverStyles = hover ? 'hover:shadow-travel hover:-translate-y-0.5' : '';

  return (
    <div className={`${baseStyles} ${paddingStyles[padding]} ${hoverStyles} ${className}`}>
      {children}
    </div>
  );
};

export default Card;