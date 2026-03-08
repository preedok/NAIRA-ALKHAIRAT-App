/**
 * Tampilan harga produk yang konsisten di semua halaman owner.
 * Menggunakan setting diskon MOU dari Admin Pusat; badge MOU/Non-MOU opsional.
 */
import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import NominalDisplay from './NominalDisplay';

export type PriceCurrency = 'IDR' | 'SAR' | 'USD';

export interface ProductPriceDisplayProps {
  amount: number;
  currency?: PriceCurrency;
  /** Tampilkan badge Owner MOU / Non-MOU */
  ownerIsMou?: boolean;
  /** Persen diskon MOU (dari Settings); ditampilkan jika ownerIsMou true */
  mouDiscountPercent?: number;
  className?: string;
  /** Hanya tampil harga, tanpa badge */
  hideBadge?: boolean;
}

export function formatPriceByCurrency(amount: number, currency: PriceCurrency = 'IDR'): string {
  return formatCurrency(amount, currency);
}

/** Badge MOU/Non-MOU untuk konsistensi di semua halaman produk */
export const ProductMouBadge: React.FC<{ ownerIsMou?: boolean; mouDiscountPercent?: number }> = ({
  ownerIsMou,
  mouDiscountPercent
}) => {
  if (ownerIsMou === undefined) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        ownerIsMou ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {ownerIsMou ? `MOU${mouDiscountPercent != null && mouDiscountPercent > 0 ? ` −${mouDiscountPercent}%` : ''}` : 'Non-MOU'}
    </span>
  );
};

const ProductPriceDisplay: React.FC<ProductPriceDisplayProps> = ({
  amount,
  currency = 'IDR',
  ownerIsMou,
  mouDiscountPercent,
  className = '',
  hideBadge = false
}) => {
  const showBadge = !hideBadge && ownerIsMou !== undefined;

  return (
    <span className={`inline-flex items-center gap-2 flex-wrap ${className}`}>
      <NominalDisplay amount={Number(amount) || 0} currency={currency} className="tabular-nums font-medium text-slate-800" />
      {showBadge && <ProductMouBadge ownerIsMou={ownerIsMou} mouDiscountPercent={mouDiscountPercent} />}
    </span>
  );
};

/** Sel tabel harga IDR · SAR · USD + badge MOU/Non-MOU (konsisten di menu produk & form order) */
export interface ProductPriceTripleCellProps {
  idr?: number | null;
  sar?: number | null;
  usd?: number | null;
  ownerIsMou?: boolean;
  mouDiscountPercent?: number;
  className?: string;
}

export const ProductPriceTripleCell: React.FC<ProductPriceTripleCellProps> = ({
  idr,
  sar,
  usd,
  ownerIsMou,
  mouDiscountPercent,
  className = ''
}) => {
  const hasIdr = idr != null && Number(idr) > 0;
  const hasSar = sar != null && Number(sar) > 0;
  const hasUsd = usd != null && Number(usd) > 0;
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <div className="tabular-nums text-slate-800">
        {hasIdr ? <NominalDisplay amount={Number(idr)} currency="IDR" /> : '–'}
      </div>
      {(hasSar || hasUsd) && (
        <div className="text-xs text-slate-500 flex flex-wrap gap-x-1">
          {hasSar && <span><span className="text-slate-400">SAR:</span> <NominalDisplay amount={Number(sar)} currency="SAR" showCurrency={false} /></span>}
          {hasSar && hasUsd && ' · '}
          {hasUsd && <span><span className="text-slate-400">USD:</span> <NominalDisplay amount={Number(usd)} currency="USD" showCurrency={false} /></span>}
        </div>
      )}
      {(ownerIsMou !== undefined) && (
        <div className="mt-1">
          <ProductMouBadge ownerIsMou={ownerIsMou} mouDiscountPercent={mouDiscountPercent} />
        </div>
      )}
    </div>
  );
};

export default ProductPriceDisplay;
