import React from 'react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  accentClassName?: string;
  helper?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, accentClassName = 'text-stone-900', helper }) => {
  return (
    <div className="relative overflow-hidden rounded-travel border border-stone-200/90 bg-white p-5 shadow-card">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8f6828] via-[#b78734] to-[#d3b274]" />
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold tracking-tight ${accentClassName}`}>{value}</p>
      {helper && <p className="mt-2 text-xs text-stone-500">{helper}</p>}
    </div>
  );
};

export default StatCard;
