/**
 * Preset filter tanggal untuk menu Progress (Hotel, Tiket, Visa, Bus, Handling).
 * Sesuai tanggal item order masing-masing: hari ini, 3/5/7/30 hari ke depan.
 */

export type ProgressDatePresetKey = '' | 'today' | '3days' | '5days' | '1week' | '1month';

export const PROGRESS_DATE_PRESETS: { value: ProgressDatePresetKey; label: string }[] = [
  { value: '', label: 'Semua tanggal' },
  { value: 'today', label: 'Hari ini' },
  { value: '3days', label: '3 hari lagi' },
  { value: '5days', label: '5 hari lagi' },
  { value: '1week', label: 'Seminggu lagi' },
  { value: '1month', label: 'Sebulan lagi' }
];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Mengembalikan { date_from, date_to } untuk preset (satu hari per opsi), atau {} bila preset kosong.
 * Hari ini = tanggal hari ini; 3/5/7/30 hari lagi = tanggal pada hari tersebut.
 */
export function getProgressDateRange(preset: ProgressDatePresetKey): { date_from?: string; date_to?: string } {
  if (!preset) return {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(today);
  switch (preset) {
    case 'today':
      break;
    case '3days':
      target.setDate(target.getDate() + 3);
      break;
    case '5days':
      target.setDate(target.getDate() + 5);
      break;
    case '1week':
      target.setDate(target.getDate() + 7);
      break;
    case '1month':
      target.setDate(target.getDate() + 30);
      break;
    default:
      return {};
  }
  const day = toYMD(target);
  return { date_from: day, date_to: day };
}
