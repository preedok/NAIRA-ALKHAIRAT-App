/**
 * Filter tanggal untuk menu Progress (Hotel, Visa, Tiket, Bus).
 * Opsi: Hari ini, 3 hari lagi, 5 hari lagi, seminggu lagi, sebulan lagi.
 * date_from/date_to dalam format YYYY-MM-DD untuk request API.
 */

export type ProgressDateRangeKey = '' | 'today' | '3days' | '5days' | '1week' | '1month';

export const PROGRESS_DATE_RANGE_OPTIONS: { value: ProgressDateRangeKey; label: string }[] = [
  { value: '', label: 'Semua tanggal' },
  { value: 'today', label: 'Hari ini' },
  { value: '3days', label: '3 hari lagi' },
  { value: '5days', label: '5 hari lagi' },
  { value: '1week', label: 'Seminggu lagi' },
  { value: '1month', label: 'Sebulan lagi' }
];

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Mengembalikan { date_from, date_to } untuk range yang dipilih.
 * "Hari ini" = tanggal hari ini.
 * "3/5 hari lagi", "Seminggu lagi", "Sebulan lagi" = dari besok sampai +N hari.
 * Jika value '' mengembalikan undefined (tidak filter).
 */
export function getProgressDateRange(value: ProgressDateRangeKey): { date_from: string; date_to: string } | undefined {
  if (!value) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (value === 'today') {
    const d = toDateOnly(today);
    return { date_from: d, date_to: d };
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateFrom = toDateOnly(tomorrow);

  let dateTo: Date;
  switch (value) {
    case '3days': {
      dateTo = new Date(tomorrow);
      dateTo.setDate(dateTo.getDate() + 2); // besok + 2 = 3 hari ke depan
      break;
    }
    case '5days': {
      dateTo = new Date(tomorrow);
      dateTo.setDate(dateTo.getDate() + 4); // 5 hari ke depan
      break;
    }
    case '1week': {
      dateTo = new Date(tomorrow);
      dateTo.setDate(dateTo.getDate() + 6); // 7 hari ke depan
      break;
    }
    case '1month': {
      dateTo = new Date(tomorrow);
      dateTo.setMonth(dateTo.getMonth() + 1);
      dateTo.setDate(dateTo.getDate() - 1); // 1 bulan ke depan
      break;
    }
    default:
      return undefined;
  }
  return { date_from: dateFrom, date_to: toDateOnly(dateTo) };
}
