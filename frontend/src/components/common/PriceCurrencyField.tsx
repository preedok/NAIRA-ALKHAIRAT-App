/**
 * Satu komponen terpadu: mata uang + input harga.
 * Sesuai mata uang yang dipilih saat input product/harga; konversi ke mata uang lain hanya untuk tampilan.
 * Dipakai di seluruh workflow: Product (hotel, visa, tiket, bus, handling, paket), Order item, dll.
 */

import React from 'react';
import { fillFromSource } from '../../utils/currencyConversion';
import { CURRENCY_OPTIONS, type CurrencyId } from '../../utils/constants';
import NominalDisplay from './NominalDisplay';
import PriceInput from './PriceInput';
import Autocomplete from './Autocomplete';

export type PriceCurrencyFieldValue = { value: number; currency: CurrencyId };

export interface PriceCurrencyFieldProps {
  /** Nilai dalam mata uang yang dipilih */
  value: number;
  /** Mata uang yang dipilih (sumber) */
  currency: CurrencyId;
  /** Callback: (value, currency) - simpan sesuai mata uang yang dipilih */
  onChange: (value: number, currency: CurrencyId) => void;
  /** Kurs untuk konversi tampilan (dari business rules) */
  rates?: { SAR_TO_IDR?: number; USD_TO_IDR?: number };
  /** Label di atas field (mis. "Harga per kamar") */
  label?: string;
  /** Tampilkan konversi IDR · SAR · USD di bawah (read-only) */
  showConversions?: boolean;
  disabled?: boolean;
  /** Label untuk dropdown mata uang (default: "Mata uang") */
  currencyLabel?: string;
  placeholder?: string;
  error?: string;
  className?: string;
}

/**
 * Satu komponen: pilih mata uang + input nominal. Nilai disimpan dalam mata uang yang dipilih.
 * Konversi hanya untuk tampilan (showConversions) atau untuk API triple (idr, sar, usd) di parent.
 */
const PriceCurrencyField: React.FC<PriceCurrencyFieldProps> = ({
  value,
  currency,
  onChange,
  rates = {},
  label,
  showConversions = true,
  disabled = false,
  currencyLabel = 'Mata uang',
  placeholder = '0',
  error,
  className = ''
}) => {
  const handleCurrencyChange = (newCur: string) => {
    const newCurrency = newCur as CurrencyId;
    if (newCurrency === currency) return;
    const triple = fillFromSource(currency, value, rates);
    const newValue = newCurrency === 'IDR' ? triple.idr : newCurrency === 'SAR' ? triple.sar : triple.usd;
    onChange(newValue, newCurrency);
  };

  const handleAmountChange = (newValue: number) => {
    onChange(newValue, currency);
  };

  const triple = fillFromSource(currency, value, rates);

  return (
    <div className={className}>
      {label && <div className="mb-1.5 text-sm font-semibold text-slate-700">{label}</div>}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Autocomplete
            label={currencyLabel}
            value={currency}
            onChange={handleCurrencyChange}
            options={CURRENCY_OPTIONS.map((c) => ({ value: c.id, label: c.label }))}
            disabled={disabled}
          />
          <PriceInput
            label="Nominal"
            value={value}
            currency={currency}
            onChange={handleAmountChange}
            disabled={disabled}
            placeholder={placeholder}
            error={error}
          />
        </div>
        {showConversions && (value > 0 || triple.idr > 0 || triple.sar > 0 || triple.usd > 0) && (
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1">
            <span className="font-medium text-slate-600">Konversi: </span>
            <NominalDisplay amount={triple.idr} currency="IDR" />
            <span> · </span>
            <NominalDisplay amount={triple.sar} currency="SAR" />
            <span> · </span>
            <NominalDisplay amount={triple.usd} currency="USD" />
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceCurrencyField;
