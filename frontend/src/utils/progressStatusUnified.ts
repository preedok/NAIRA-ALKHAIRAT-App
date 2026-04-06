/**
 * Status progress seragam untuk semua produk (invoice, progress divisi).
 * Hanya empat label tampilan: Menunggu, Dokumen diterima, Dalam proses, Selesai.
 */

export const UNIFIED_PROGRESS = {
  MENUNGGU: 'Menunggu',
  DOKUMEN_DITERIMA: 'Dokumen diterima',
  DALAM_PROSES: 'Dalam proses',
  SELESAI: 'Selesai'
} as const;

const L = { M: 0, D: 1, P: 2, S: 3 };

function levelToLabel(level: number): string {
  if (level >= L.S) return UNIFIED_PROGRESS.SELESAI;
  if (level >= L.P) return UNIFIED_PROGRESS.DALAM_PROSES;
  if (level >= L.D) return UNIFIED_PROGRESS.DOKUMEN_DITERIMA;
  return UNIFIED_PROGRESS.MENUNGGU;
}

export function labelUnifiedFromLevels(levels: number[]): string {
  if (!levels.length) return UNIFIED_PROGRESS.MENUNGGU;
  return levelToLabel(Math.min(...levels));
}

export function visaStatusToLevel(raw: string | undefined): number {
  const s = (raw || 'pending').toLowerCase();
  if (s === 'issued') return L.S;
  if (['submitted', 'in_process', 'approved'].includes(s)) return L.P;
  if (s === 'document_received') return L.D;
  return L.M;
}

export function labelVisaProgress(raw: string | undefined): string {
  return levelToLabel(visaStatusToLevel(raw));
}

export function ticketStatusToLevel(raw: string | undefined): number {
  const s = (raw || 'pending').toLowerCase();
  if (s === 'ticket_issued') return L.S;
  if (['seat_reserved', 'booking', 'payment_airline'].includes(s)) return L.P;
  if (s === 'data_received') return L.D;
  return L.M;
}

export function labelTicketProgress(raw: string | undefined): string {
  return levelToLabel(ticketStatusToLevel(raw));
}

export function hotelStatusToLevel(raw: string | undefined): number {
  const s = (raw || 'waiting_confirmation').toLowerCase();
  if (s === 'completed') return L.S;
  if (s === 'room_assigned') return L.P;
  if (s === 'confirmed') return L.D;
  return L.M;
}

export function labelHotelProgress(raw: string | undefined): string {
  return levelToLabel(hotelStatusToLevel(raw));
}

/** Satu grup hotel (banyak kamar): ambil status paling awal (bottleneck). */
export function labelHotelGroupProgress(items: Array<{ HotelProgress?: { status?: string } }>): string {
  const levels = items.map((i) => hotelStatusToLevel(i?.HotelProgress?.status));
  return labelUnifiedFromLevels(levels);
}

export function mealStatusToLevel(raw: string | undefined): number {
  const s = (raw || 'pending').toLowerCase();
  if (s === 'completed') return L.S;
  if (s === 'confirmed') return L.P;
  return L.M;
}

export function labelMealProgress(raw: string | undefined): string {
  return levelToLabel(mealStatusToLevel(raw));
}

export function busTicketStatusToLevel(raw: string | undefined): number {
  const s = (raw || 'pending').toLowerCase();
  if (s === 'issued') return L.S;
  return L.M;
}

export function labelBusTicketProgress(raw: string | undefined): string {
  return levelToLabel(busTicketStatusToLevel(raw));
}

export function busTripStatusToLevel(raw: string | undefined): number {
  const s = (raw || 'pending').toLowerCase();
  if (s === 'completed') return L.S;
  if (s === 'scheduled') return L.P;
  return L.M;
}

/** Status rute bus (kedatangan / keberangkatan / kepulangan), bukan tiket fisik. */
export function labelBusTripProgress(raw: string | undefined): string {
  return levelToLabel(busTripStatusToLevel(raw));
}

/** Tiket bus + rute (kedatangan, berangkat, pulang). */
export function busItemProgressLevels(item: { BusProgress?: Record<string, unknown> }): number[] {
  const bp = item?.BusProgress || {};
  const ticket = busTicketStatusToLevel(String(bp.bus_ticket_status ?? ''));
  const arr = busTripStatusToLevel(String(bp.arrival_status ?? ''));
  const dep = busTripStatusToLevel(String(bp.departure_status ?? ''));
  const ret = busTripStatusToLevel(String(bp.return_status ?? ''));
  return [ticket, arr, dep, ret];
}

export function labelBusItemProgress(item: { BusProgress?: Record<string, unknown> }): string {
  return labelUnifiedFromLevels(busItemProgressLevels(item));
}

/** Status manifest bus-include di order (pending / di_proses / terbit). */
export function busIncludeStatusToLevel(raw: string | undefined): number {
  const s = (raw || 'pending').toLowerCase();
  if (s === 'terbit') return L.S;
  if (s === 'di_proses') return L.P;
  return L.M;
}

export function labelBusIncludeLeg(raw: string | undefined): string {
  return levelToLabel(busIncludeStatusToLevel(raw));
}

export function labelBusIncludeCombined(arrival: string | undefined, returnLeg: string | undefined): string {
  return labelUnifiedFromLevels([busIncludeStatusToLevel(arrival), busIncludeStatusToLevel(returnLeg)]);
}

export function handlingStatusToLevel(raw: string | undefined): number {
  const s = (raw || 'pending').toLowerCase();
  if (s === 'completed') return L.S;
  if (s === 'in_progress') return L.P;
  return L.M;
}

export function labelHandlingSiskopatuhProgress(raw: string | undefined): string {
  return levelToLabel(handlingStatusToLevel(raw));
}

export function isUnifiedSelesai(label: string): boolean {
  return label === UNIFIED_PROGRESS.SELESAI;
}

/** Peta nilai API → label untuk dropdown filter (nilai tetap, label seragam). */
export const PROGRESS_LABELS_VISA: Record<string, string> = {
  pending: labelVisaProgress('pending'),
  document_received: labelVisaProgress('document_received'),
  submitted: labelVisaProgress('submitted'),
  in_process: labelVisaProgress('in_process'),
  approved: labelVisaProgress('approved'),
  issued: labelVisaProgress('issued')
};

export const PROGRESS_LABELS_TICKET: Record<string, string> = {
  pending: labelTicketProgress('pending'),
  data_received: labelTicketProgress('data_received'),
  seat_reserved: labelTicketProgress('seat_reserved'),
  booking: labelTicketProgress('booking'),
  payment_airline: labelTicketProgress('payment_airline'),
  ticket_issued: labelTicketProgress('ticket_issued')
};

export const PROGRESS_LABELS_HOTEL: Record<string, string> = {
  waiting_confirmation: labelHotelProgress('waiting_confirmation'),
  confirmed: labelHotelProgress('confirmed'),
  room_assigned: labelHotelProgress('room_assigned'),
  completed: labelHotelProgress('completed')
};

export const PROGRESS_LABELS_MEAL: Record<string, string> = {
  pending: labelMealProgress('pending'),
  confirmed: labelMealProgress('confirmed'),
  completed: labelMealProgress('completed')
};

export const PROGRESS_LABELS_BUS: Record<string, string> = {
  pending: labelBusTicketProgress('pending'),
  issued: labelBusTicketProgress('issued')
};

export const PROGRESS_LABELS_HANDLING_SISKOPATUH: Record<string, string> = {
  pending: labelHandlingSiskopatuhProgress('pending'),
  in_progress: labelHandlingSiskopatuhProgress('in_progress'),
  completed: labelHandlingSiskopatuhProgress('completed')
};
