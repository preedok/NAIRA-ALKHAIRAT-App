/**
 * Filter tanggal untuk menu Progress (Hotel, Visa, Tiket, Bus, Handling).
 * Opsi lengkap: Hari ini, 3/4/5 hari kedepan, 1/2/3 minggu kedepan, 1 bulan kedepan.
 * date_from/date_to format YYYY-MM-DD untuk request API.
 */

export type ProgressDateRangeKey =
  | ''
  | 'today'
  | '2days'
  | '3days'
  | '4days'
  | '5days'
  | '1week'
  | '2weeks'
  | '3weeks'
  | '1month';

export const PROGRESS_DATE_RANGE_OPTIONS: { value: ProgressDateRangeKey; label: string }[] = [
  { value: '', label: 'Semua tanggal' },
  { value: 'today', label: 'Hari ini' },
  { value: '2days', label: '2 hari kedepan' },
  { value: '3days', label: '3 hari kedepan' },
  { value: '4days', label: '4 hari kedepan' },
  { value: '5days', label: '5 hari kedepan' },
  { value: '1week', label: '1 minggu kedepan' },
  { value: '2weeks', label: '2 minggu kedepan' },
  { value: '3weeks', label: '3 minggu kedepan' },
  { value: '1month', label: '1 bulan kedepan' }
];

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Mengembalikan { date_from, date_to } untuk range yang dipilih.
 * "Hari ini" = tanggal hari ini saja.
 * "N hari/minggu/bulan kedepan" = dari hari ini sampai N hari/minggu/bulan ke depan (inclusive).
 * Jika value '' mengembalikan undefined (tidak filter).
 */
export function getProgressDateRange(value: ProgressDateRangeKey): { date_from: string; date_to: string } | undefined {
  if (!value) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateFrom = toDateOnly(today);

  if (value === 'today') {
    return { date_from: dateFrom, date_to: dateFrom };
  }

  const end = new Date(today);
  switch (value) {
    case '2days':
      end.setDate(end.getDate() + 2);
      break;
    case '3days':
      end.setDate(end.getDate() + 3);
      break;
    case '4days':
      end.setDate(end.getDate() + 4);
      break;
    case '5days':
      end.setDate(end.getDate() + 5);
      break;
    case '1week':
      end.setDate(end.getDate() + 7);
      break;
    case '2weeks':
      end.setDate(end.getDate() + 14);
      break;
    case '3weeks':
      end.setDate(end.getDate() + 21);
      break;
    case '1month':
      end.setMonth(end.getMonth() + 1);
      break;
    default:
      return undefined;
  }
  return { date_from: dateFrom, date_to: toDateOnly(end) };
}

/**
 * Filter array invoice by date range (invoice issued_at atau created_at).
 * Jika range undefined, return list as-is.
 */
export function filterInvoicesByDateRange<T extends { issued_at?: string | null; created_at?: string | null }>(
  list: T[],
  range: { date_from: string; date_to: string } | undefined
): T[] {
  if (!range || !list.length) return list;
  const from = range.date_from;
  const to = range.date_to;
  return list.filter((inv) => {
    const d = (inv.issued_at || inv.created_at || '').toString().slice(0, 10);
    return d >= from && d <= to;
  });
}
