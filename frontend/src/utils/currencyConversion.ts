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

export type PriceCurrency = 'IDR' | 'SAR' | 'USD';

/**
 * Deteksi mata uang sumber dari triple (IDR, SAR, USD).
 * Mengembalikan mata uang yang bila dikonversi menghasilkan triple yang sama (dengan toleransi pembulatan).
 * Dipakai di form edit untuk menampilkan mata uang yang sesuai saat tambah data.
 */
export function detectPriceCurrency(
  idr: number,
  sar: number,
  usd: number,
  rates?: { SAR_TO_IDR?: number; USD_TO_IDR?: number }
): PriceCurrency {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const match = (t: CurrencyTriple) =>
    Math.round(t.idr) === Math.round(idr) && round2(t.sar) === round2(sar) && round2(t.usd) === round2(usd);
  if (sar > 0) {
    const t = fillFromSource('SAR', sar, rates);
    if (match(t)) return 'SAR';
  }
  if (usd > 0) {
    const t = fillFromSource('USD', usd, rates);
    if (match(t)) return 'USD';
  }
  return 'IDR';
}

/**
 * Untuk form edit: dari data produk dengan price_general_idr/sar/usd dan optional currency dari API,
 * kembalikan mata uang tampilan dan nilai yang harus ditampilkan di input.
 */
export function getEditPriceDisplay(
  product: {
    price_general_idr?: number | null;
    price_general_sar?: number | null;
    price_general_usd?: number | null;
    currency?: string;
  },
  rates?: { SAR_TO_IDR?: number; USD_TO_IDR?: number }
): { currency: PriceCurrency; value: number } {
  const idr = (product.price_general_idr != null && product.price_general_idr > 0) ? product.price_general_idr : 0;
  const sar = (product.price_general_sar != null && product.price_general_sar > 0) ? product.price_general_sar : 0;
  const usd = (product.price_general_usd != null && product.price_general_usd > 0) ? product.price_general_usd : 0;
  const currency =
    (product.currency === 'SAR' || product.currency === 'USD' ? product.currency : null) ??
    detectPriceCurrency(idr, sar, usd, rates);
  const value = currency === 'SAR' ? sar : currency === 'USD' ? usd : idr;
  return { currency, value };
}
