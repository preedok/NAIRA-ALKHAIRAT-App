/**
 * Konversi harga antar IDR, SAR, USD berdasarkan kurs.
 * Digunakan di form admin (hotel, visa, tiket, paket, dll) dan ringkasan order.
 */

export type CurrencyTriple = { idr: number; sar: number; usd: number };

const DEFAULT_SAR_TO_IDR = 4200;
const DEFAULT_USD_TO_IDR = 15500;

export function getRatesFromRates(rates: { SAR_TO_IDR?: number; USD_TO_IDR?: number } | undefined) {
  const SAR_TO_IDR = rates?.SAR_TO_IDR ?? DEFAULT_SAR_TO_IDR;
  const USD_TO_IDR = rates?.USD_TO_IDR ?? DEFAULT_USD_TO_IDR;
  return { SAR_TO_IDR, USD_TO_IDR };
}

/**
 * Dari IDR hitung SAR dan USD
 */
export function fromIDR(
  idr: number,
  rates?: { SAR_TO_IDR?: number; USD_TO_IDR?: number }
): CurrencyTriple {
  const { SAR_TO_IDR, USD_TO_IDR } = getRatesFromRates(rates);
  return {
    idr,
    sar: idr / SAR_TO_IDR,
    usd: idr / USD_TO_IDR
  };
}

/**
 * Dari SAR hitung IDR dan USD
 */
export function fromSAR(
  sar: number,
  rates?: { SAR_TO_IDR?: number; USD_TO_IDR?: number }
): CurrencyTriple {
  const { SAR_TO_IDR, USD_TO_IDR } = getRatesFromRates(rates);
  const idr = sar * SAR_TO_IDR;
  return {
    idr,
    sar,
    usd: idr / USD_TO_IDR
  };
}

/**
 * Dari USD hitung IDR dan SAR
 */
export function fromUSD(
  usd: number,
  rates?: { SAR_TO_IDR?: number; USD_TO_IDR?: number }
): CurrencyTriple {
  const { SAR_TO_IDR, USD_TO_IDR } = getRatesFromRates(rates);
  const idr = usd * USD_TO_IDR;
  return {
    idr,
    sar: idr / SAR_TO_IDR,
    usd
  };
}

/**
 * Dari satu nilai dan mata uang sumber, isi ketiga nilai
 */
export function fillFromSource(
  sourceCurrency: 'IDR' | 'SAR' | 'USD',
  value: number,
  rates?: { SAR_TO_IDR?: number; USD_TO_IDR?: number }
): CurrencyTriple {
  if (sourceCurrency === 'IDR') return fromIDR(value, rates);
  if (sourceCurrency === 'SAR') return fromSAR(value, rates);
  return fromUSD(value, rates);
}
