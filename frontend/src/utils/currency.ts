export const formatRupiah = (value: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);

export const parseRupiah = (value: string): number => {
  const numeric = value.replace(/[^\d]/g, '');
  if (!numeric) return 0;
  return Number(numeric);
};
