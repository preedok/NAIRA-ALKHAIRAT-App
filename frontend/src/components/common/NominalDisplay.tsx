/**
 * Tampilan nominal (angka mata uang) yang konsisten di seluruh aplikasi.
 * Selalu gunakan komponen ini agar format IDR/SAR/USD seragam.
 */
import React from 'react';
import { formatCurrency } from '../../utils/formatters';

export type NominalCurrency = 'IDR' | 'SAR' | 'USD';

export interface NominalDisplayProps {
  /** Nilai yang ditampilkan (dalam mata uang yang dipilih) */
  amount: number;
  /** Mata uang: IDR (Rp), SAR, USD ($) */
  currency: NominalCurrency;
  /** Teks tambahan setelah nominal, misalnya " /malam" */
  suffix?: string;
  /** Kelas CSS untuk wrapper (span) */
  className?: string;
  /** Tampilkan prefix/suffix mata uang (default true). false = hanya angka terformat */
  showCurrency?: boolean;
}

/**
 * Komponen tunggal untuk menampilkan nominal dalam IDR, SAR, atau USD.
 * Format: IDR = Rp + pemisah ribuan id-ID; SAR/USD = 2 desimal + label.
 */
const NominalDisplay: React.FC<NominalDisplayProps> = ({
  amount,
  currency,
  suffix = '',
  className = '',
  showCurrency = true
}) => {
  const value = Number.isFinite(amount) ? amount : 0;
  const text = showCurrency
    ? formatCurrency(value, currency)
    : new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
        minimumFractionDigits: currency === 'IDR' ? 0 : 2,
        maximumFractionDigits: currency === 'IDR' ? 0 : 2
      }).format(value);
  return (
    <span className={className}>
      {text}{suffix}
    </span>
  );
};

export default NominalDisplay;
