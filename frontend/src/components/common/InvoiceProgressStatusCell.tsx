/**
 * Status progress per divisi (Visa, Tiket, Hotel, Bus) — satu sumber kebenaran.
 * Urutan tampilan: Hotel Madinah → Hotel Mekkah → Visa → Tiket → Bus → Handling → Siskopatuh → Paket.
 * Label tampilan diseragamkan (Menunggu / Dokumen diterima / Dalam proses / Selesai) di progressStatusUnified.
 */
import React from 'react';
import { getHotelLocationFromItem } from '../../utils/constants';
import {
  PROGRESS_LABELS_BUS,
  PROGRESS_LABELS_HANDLING_SISKOPATUH,
  PROGRESS_LABELS_HOTEL,
  PROGRESS_LABELS_MEAL,
  PROGRESS_LABELS_TICKET,
  PROGRESS_LABELS_VISA,
  UNIFIED_PROGRESS,
  isUnifiedSelesai,
  labelBusIncludeCombined,
  labelBusIncludeLeg,
  labelBusItemProgress,
  labelHotelGroupProgress
} from '../../utils/progressStatusUnified';

export {
  PROGRESS_LABELS_VISA,
  PROGRESS_LABELS_TICKET,
  PROGRESS_LABELS_HOTEL,
  PROGRESS_LABELS_MEAL,
  PROGRESS_LABELS_BUS,
  PROGRESS_LABELS_HANDLING_SISKOPATUH
};

/** Untuk detail tab & badge: gabungan per tipe */
export const PROGRESS_LABELS = {
  visa: PROGRESS_LABELS_VISA,
  ticket: PROGRESS_LABELS_TICKET,
  hotel: PROGRESS_LABELS_HOTEL,
  meal: PROGRESS_LABELS_MEAL,
  bus: PROGRESS_LABELS_BUS
} as const;

/** Opsi filter/select Status Progress per divisi — satu sumber kebenaran, sama dengan label di tabel Invoice */
export const PROGRESS_STATUS_OPTIONS_VISA = Object.entries(PROGRESS_LABELS_VISA).map(([value, label]) => ({ value, label }));
export const PROGRESS_STATUS_OPTIONS_TICKET = Object.entries(PROGRESS_LABELS_TICKET).map(([value, label]) => ({ value, label }));
export const PROGRESS_STATUS_OPTIONS_HOTEL = Object.entries(PROGRESS_LABELS_HOTEL).map(([value, label]) => ({ value, label }));
export const PROGRESS_STATUS_OPTIONS_BUS = Object.entries(PROGRESS_LABELS_BUS).map(([value, label]) => ({ value, label }));
export const PROGRESS_STATUS_OPTIONS_MEAL = Object.entries(PROGRESS_LABELS_MEAL).map(([value, label]) => ({ value, label }));

export const ROOM_TYPE_LABELS: Record<string, string> = {
  double: 'Double',
  triple: 'Triple',
  quad: 'Quad',
  quint: 'Quint',
  single: 'Double'
};

/** Kapasitas orang per tipe kamar (untuk tampilan jumlah orang); legacy `single` ≈ double */
const ROOM_CAPACITY: Record<string, number> = { double: 2, triple: 3, quad: 4, quint: 5, single: 2 };

const BUS_TRIP_LABELS: Record<string, string> = {
  one_way: 'Pergi saja',
  return_only: 'Pulang saja',
  round_trip: 'Pulang pergi'
};

const defaultFormatDate = (d: string | null | undefined) => {
  if (!d) return '–';
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '–';
  }
};

const defaultFormatDateWithTime = (d: string | null | undefined, time: string | null | undefined) => {
  const dateStr = defaultFormatDate(d ?? null);
  if (dateStr === '–') return '–';
  const t = (time || '').trim();
  return t ? `${dateStr}, ${t}` : `${dateStr}, –`;
};

/** handling_status & siskopatuh_status di meta OrderItem — label seragam di progressStatusUnified */
export const PROGRESS_STATUS_OPTIONS_HANDLING_SISKOPATUH = Object.entries(PROGRESS_LABELS_HANDLING_SISKOPATUH).map(([value, label]) => ({
  value,
  label
}));

export type ProgressSectionKey = 'visa' | 'ticket' | 'hotel' | 'bus' | 'handling' | 'siskopatuh' | 'package';

export type InvoiceProgressLayout = 'stack' | 'table';

/**
 * Filter section Status Progress untuk halaman **menu Progress** divisi (HotelWorkPage, VisaWorkPage, …).
 * Di **menu Invoice** (OrdersInvoicesPage) jangan pakai ini — kolom progress harus menampilkan semua produk.
 * Undefined = tampilkan semua section.
 */
export function getProgressAllowedSectionsForRole(role: string | null | undefined): ProgressSectionKey[] | undefined {
  if (!role) return undefined;
  const byRole: Record<string, ProgressSectionKey[]> = {
    role_hotel: ['hotel'],
    visa_koordinator: ['visa'],
    tiket_koordinator: ['ticket'],
    role_bus: ['visa', 'bus'],
    handling: ['handling'],
    role_siskopatuh: ['siskopatuh'],
  };
  return byRole[role];
}

/** Satu baris progress (sumber tunggal untuk tabel ringkas & tumpukan kartu). */
export type InvoiceProgressRowModel = {
  key: string;
  serviceLabel: string;
  statusLabel: string;
  detailLines: string[];
  statusEmphasis: boolean;
  variant?: 'default' | 'bus-include';
  /** Untuk stack: suffix di baris yang sama setelah status (mis. "· 3 org"). */
  statusInlineSuffix?: string;
  /** Paket: teks "Qty n" di baris sama, gaya muted (bukan status progress). */
  statusMuted?: boolean;
  /** Hotel: baris pertama detail adalah room lines (warna lebih gelap di stack). */
  hotelRoomLine?: string;
  /** Hotel: baris meal jika ada. */
  hotelMealLine?: string | null;
};

export type InvoiceProgressSectionModel = {
  sortIndex: number;
  title: string;
  rows: InvoiceProgressRowModel[];
};

export interface InvoiceProgressStatusCellProps {
  /** Invoice row (dengan Order.OrderItems dan progress relations) */
  inv: any;
  formatDate?: (d: string | null | undefined) => string;
  formatDateWithTime?: (d: string | null | undefined, time?: string | null) => string;
  /** Jika diisi, hanya section dengan key ini yang ditampilkan (mis. role bus: hanya visa & bus). */
  allowedSections?: ProgressSectionKey[];
  /** stack = kartu per layanan (default); table = tabel ringkas untuk kolom daftar invoice. */
  layout?: InvoiceProgressLayout;
}

/** Membangun model progress — dipakai komponen & bisa dipakai di pengujian. */
export function buildInvoiceProgressSectionModels(
  inv: any,
  formatDate: (d: string | null | undefined) => string = defaultFormatDate,
  formatDateWithTime: (d: string | null | undefined, time?: string | null) => string = defaultFormatDateWithTime,
  allowedSections?: ProgressSectionKey[]
): InvoiceProgressSectionModel[] {
  const allow = (key: ProgressSectionKey) => !allowedSections || allowedSections.includes(key);
  const items = inv?.Order?.OrderItems || [];
  if (items.length === 0) return [];

  const visaItems = items.filter((i: any) => (i.type || i.product_type) === 'visa');
  const ticketItems = items.filter((i: any) => (i.type || i.product_type) === 'ticket');
  const hotelItems = items.filter((i: any) => (i.type || i.product_type) === 'hotel');
  const busItems = items.filter((i: any) => (i.type || i.product_type) === 'bus');
  const handlingItems = items.filter((i: any) => (i.type || i.product_type) === 'handling');
  const siskopatuhItems = items.filter((i: any) => (i.type || i.product_type) === 'siskopatuh');
  const packageItems = items.filter((i: any) => (i.type || i.product_type) === 'package');

  const sections: InvoiceProgressSectionModel[] = [];

  const hotelRowsForGroups = (hotelGroups: { key: string; name: string; items: any[] }[]): InvoiceProgressRowModel[] =>
    hotelGroups.map((group) => {
      const first = group.items[0];
      const status = labelHotelGroupProgress(group.items);
      const mealStatus = first?.HotelProgress?.meal_status;
      const mealLabel = mealStatus ? (PROGRESS_LABELS_MEAL[mealStatus] || mealStatus) : null;
      const checkIn = formatDateWithTime(first?.HotelProgress?.check_in_date ?? first?.meta?.check_in, first?.HotelProgress?.check_in_time ?? first?.meta?.check_in_time ?? '16:00');
      const checkOut = formatDateWithTime(first?.HotelProgress?.check_out_date ?? first?.meta?.check_out, first?.HotelProgress?.check_out_time ?? first?.meta?.check_out_time ?? '12:00');
      const roomLines = group.items.map((item: any) => {
        const rt = item.room_type || item.meta?.room_type || '';
        const qty = Math.max(0, parseInt(String(item.quantity ?? 0), 10) || 0);
        const cap = rt ? (ROOM_CAPACITY[rt] ?? 0) : 0;
        const orang = qty * cap;
        const label = ROOM_TYPE_LABELS[rt] || rt || '–';
        return `${qty} ${label}${cap > 0 ? ` (${orang} org)` : ''}`;
      });
      const roomJoined = roomLines.length > 0 ? roomLines.join(', ') : '';
      const tailLines: string[] = [];
      tailLines.push(`CI ${checkIn} · CO ${checkOut}`);
      return {
        key: group.key,
        serviceLabel: group.name,
        statusLabel: status,
        detailLines: tailLines,
        statusEmphasis: isUnifiedSelesai(status),
        hotelRoomLine: roomJoined || undefined,
        hotelMealLine: mealLabel != null ? `Makan: ${mealLabel}` : null,
      };
    });

  if (hotelItems.length > 0 && allow('hotel')) {
    const getCheckInOut = (item: any) => {
      const ci = (item.HotelProgress?.check_in_date ?? item.meta?.check_in ?? '').toString().slice(0, 10);
      const co = (item.HotelProgress?.check_out_date ?? item.meta?.check_out ?? '').toString().slice(0, 10);
      return { ci, co };
    };
    type HotelGroup = { key: string; name: string; items: any[] };
    const allHotelGroups = (hotelItems as any[]).reduce((acc: HotelGroup[], item: any) => {
      const pid = String(item.product_ref_id || item.product_id || '');
      const { ci, co } = getCheckInOut(item);
      const key = `${pid}|${ci}|${co}`;
      const name = item.Product?.name || item.product_name || 'Hotel';
      const existing = acc.find((g: HotelGroup) => g.key === key);
      if (existing) existing.items.push(item);
      else acc.push({ key, name, items: [item] });
      return acc;
    }, [] as HotelGroup[]);
    const hotelMadinah = allHotelGroups.filter((g) => getHotelLocationFromItem(g.items[0]) === 'madinah');
    const hotelMakkah = allHotelGroups.filter((g) => getHotelLocationFromItem(g.items[0]) === 'makkah');
    if (hotelMadinah.length > 0) sections.push({ sortIndex: 0, title: 'Hotel Madinah', rows: hotelRowsForGroups(hotelMadinah) });
    if (hotelMakkah.length > 0) sections.push({ sortIndex: 1, title: 'Hotel Mekkah', rows: hotelRowsForGroups(hotelMakkah) });
  }

  if (visaItems.length > 0 && allow('visa')) {
    const rows = visaItems.map((item: any, idx: number) => {
      const name = item.Product?.name || item.product_name || 'Visa';
      const statusLabel = PROGRESS_LABELS_VISA[item.VisaProgress?.status] || UNIFIED_PROGRESS.MENUNGGU;
      const depDate = formatDate(item.meta?.travel_date ?? null);
      const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
      const detailLines: string[] = [];
      if (depDate) detailLines.push(`Tgl ${depDate}`);
      return {
        key: String(item.id || `visa-${idx}`),
        serviceLabel: name,
        statusLabel,
        detailLines,
        statusEmphasis: isUnifiedSelesai(statusLabel),
        statusInlineSuffix: qty > 1 ? `· ${qty} org` : undefined,
      };
    });
    sections.push({ sortIndex: 2, title: 'Visa', rows });
  }

  if (ticketItems.length > 0 && allow('ticket')) {
    const rows = ticketItems.map((item: any, idx: number) => {
      const name = item.Product?.name || item.product_name || 'Tiket';
      const statusLabel = PROGRESS_LABELS_TICKET[item.TicketProgress?.status] || UNIFIED_PROGRESS.MENUNGGU;
      const tripType = String(item.meta?.trip_type || 'round_trip');
      const dep = formatDate(item.meta?.departure_date ?? null);
      const ret = formatDate(item.meta?.return_date ?? null);
      const dateLine =
        tripType === 'one_way' ? `Berangkat ${dep}` : tripType === 'return_only' ? `Pulang ${ret}` : `Berangkat ${dep} · Pulang ${ret}`;
      const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
      return {
        key: String(item.id || `ticket-${idx}`),
        serviceLabel: name,
        statusLabel,
        detailLines: dateLine ? [dateLine] : [],
        statusEmphasis: isUnifiedSelesai(statusLabel),
        statusInlineSuffix: qty > 1 ? `· ${qty} tiket` : undefined,
      };
    });
    sections.push({ sortIndex: 3, title: 'Tiket', rows });
  }

  if (busItems.length > 0 && allow('bus')) {
    const rows = busItems.map((item: any, idx: number) => {
      const name = item.Product?.name || item.product_name || 'Bus';
      const statusLabel = labelBusItemProgress(item);
      const travelDate = formatDate(item.meta?.travel_date ?? null);
      const routeType = item.meta?.route_type ? String(item.meta.route_type) : '';
      const tripTypeRaw = item.meta?.trip_type ? String(item.meta.trip_type) : '';
      const tripTypeLabel = tripTypeRaw ? (BUS_TRIP_LABELS[tripTypeRaw] || tripTypeRaw) : '';
      const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
      const metaLine = [travelDate ? `Tgl ${travelDate}` : null, routeType ? `Rute ${routeType}` : null, tripTypeLabel, qty > 1 ? `${qty} unit` : null]
        .filter(Boolean)
        .join(' · ');
      return {
        key: String(item.id || `bus-${idx}`),
        serviceLabel: name,
        statusLabel,
        detailLines: metaLine ? [metaLine] : [],
        statusEmphasis: isUnifiedSelesai(statusLabel),
      };
    });
    sections.push({ sortIndex: 4, title: 'Bus', rows });
    // Bus include (tanpa line item bus): hanya jika allow('bus') — hindari bocor ke halaman progress divisi lain.
  } else if (
    allow('bus') &&
    busItems.length === 0 &&
    visaItems.length > 0 &&
    String(inv?.Order?.bus_service_option || '') !== 'visa_only'
  ) {
    const order = inv?.Order;
    const waive = order?.waive_bus_penalty === true;
    const penalty = Number(order?.penalty_amount) || 0;
    const arrivalStatus = order?.bus_include_arrival_status || 'pending';
    const returnStatus = order?.bus_include_return_status || 'pending';
    const arrivalLabel = labelBusIncludeLeg(arrivalStatus);
    const returnLabel = labelBusIncludeLeg(returnStatus);
    const arrivalTerbit = arrivalStatus === 'terbit';
    const returnTerbit = returnStatus === 'terbit';
    const detailLines: string[] = [];
    if (waive) detailLines.push('Bus Hiace (tanpa penalti) · 1 unit');
    else if (penalty > 0) detailLines.push(`Penalti bus: Rp ${(penalty / 1e6).toFixed(0)} jt`);
    const arrExtra =
      arrivalTerbit && (order?.bus_include_arrival_bus_number || order?.bus_include_arrival_date || order?.bus_include_arrival_time)
        ? [
            order?.bus_include_arrival_bus_number && `No. ${order.bus_include_arrival_bus_number}`,
            (order?.bus_include_arrival_date || order?.bus_include_arrival_time) &&
              `${formatDate(order?.bus_include_arrival_date || null)}${order?.bus_include_arrival_time ? ` ${order.bus_include_arrival_time}` : ''}`,
          ]
            .filter(Boolean)
            .join(' · ')
        : '';
    const retExtra =
      returnTerbit && (order?.bus_include_return_bus_number || order?.bus_include_return_date || order?.bus_include_return_time)
        ? [
            order?.bus_include_return_bus_number && `No. ${order.bus_include_return_bus_number}`,
            (order?.bus_include_return_date || order?.bus_include_return_time) &&
              `${formatDate(order?.bus_include_return_date || null)}${order?.bus_include_return_time ? ` ${order.bus_include_return_time}` : ''}`,
          ]
            .filter(Boolean)
            .join(' · ')
        : '';
    detailLines.push(`Kedatangan: ${arrivalLabel}${arrExtra ? ` · ${arrExtra}` : ''}`);
    detailLines.push(`Kepulangan: ${returnLabel}${retExtra ? ` · ${retExtra}` : ''}`);
    sections.push({
      sortIndex: 4,
      title: 'Bus',
      rows: [
        {
          key: 'bus-include',
          serviceLabel: waive ? 'Bus Hiace (tanpa penalti)' : 'Bus include (dengan visa)',
          statusLabel: labelBusIncludeCombined(arrivalStatus, returnStatus),
          detailLines,
          statusEmphasis: arrivalStatus === 'terbit' && returnStatus === 'terbit',
          variant: 'bus-include',
        },
      ],
    });
  }

  if (handlingItems.length > 0 && allow('handling')) {
    const rows = handlingItems.map((item: any, idx: number) => {
      const name = item.Product?.name || item.product_name || 'Handling';
      const qty = Math.max(0, parseInt(String(item.quantity ?? 1), 10) || 1);
      const st = (item.meta && item.meta.handling_status) || 'pending';
        const stLabel = PROGRESS_LABELS_HANDLING_SISKOPATUH[st] || st;
      return {
        key: String(item.id || `handling-${idx}`),
        serviceLabel: name,
        statusLabel: stLabel,
        detailLines: [],
        statusEmphasis: isUnifiedSelesai(stLabel),
        statusInlineSuffix: `· Qty ${qty}`,
      };
    });
    sections.push({ sortIndex: 5, title: 'Handling', rows });
  }

  if (siskopatuhItems.length > 0 && allow('siskopatuh')) {
    const rows = siskopatuhItems.map((item: any, idx: number) => {
      const name = item.Product?.name || item.product_name || 'Siskopatuh';
      const qty = Math.max(0, parseInt(String(item.quantity ?? 1), 10) || 1);
      const st = (item.meta && item.meta.siskopatuh_status) || 'pending';
        const stLabel = PROGRESS_LABELS_HANDLING_SISKOPATUH[st] || st;
      const hasDoc = !!(item.meta && item.meta.siskopatuh_file_url && String(item.meta.siskopatuh_file_url).trim());
      const svcRaw = item.meta && item.meta.service_date ? String(item.meta.service_date).slice(0, 10) : '';
      const svcLine = svcRaw && /^\d{4}-\d{2}-\d{2}$/.test(svcRaw) ? `Tgl layanan ${formatDate(svcRaw)}` : '';
      const detailLines: string[] = [];
      if (svcLine) detailLines.push(svcLine);
      if (hasDoc) detailLines.push('Dokumen hasil: tersedia (unduh di detail Invoice)');
      return {
        key: String(item.id || `sisko-${idx}`),
        serviceLabel: name,
        statusLabel: stLabel,
        detailLines,
        statusEmphasis: isUnifiedSelesai(stLabel),
        statusInlineSuffix: `· Qty ${qty}`,
      };
    });
    sections.push({ sortIndex: 6, title: 'Siskopatuh', rows });
  }

  if (packageItems.length > 0 && allow('package')) {
    const rows = packageItems.map((item: any, idx: number) => {
      const name = item.Product?.name || item.product_name || 'Paket';
      const qty = Math.max(0, parseInt(String(item.quantity ?? 1), 10) || 1);
      return {
        key: String(item.id || `pkg-${idx}`),
        serviceLabel: name,
        statusLabel: `Qty ${qty}`,
        detailLines: [],
        statusEmphasis: false,
        statusMuted: true,
      };
    });
    sections.push({ sortIndex: 7, title: 'Paket', rows });
  }

  sections.sort((a, b) => a.sortIndex - b.sortIndex);
  return sections;
}

function renderStackRow(row: InvoiceProgressRowModel) {
  const statusClass = row.statusMuted
    ? 'text-slate-600'
    : row.statusEmphasis
      ? 'text-[#0D1A63] font-medium'
      : 'text-slate-600';
  return (
    <div className="rounded border border-slate-100 bg-slate-50/50 p-1.5 text-xs">
      <span className="font-medium text-slate-800" title={row.serviceLabel}>
        {row.serviceLabel}:
      </span>{' '}
      <span className={statusClass}>{row.statusLabel}</span>
      {row.statusInlineSuffix ? <span className="text-slate-600 ml-1">{row.statusInlineSuffix}</span> : null}
      {row.hotelRoomLine ? <div className="text-slate-700 mt-0.5">{row.hotelRoomLine}</div> : null}
      {row.hotelMealLine ? <div className="text-slate-600 mt-0.5">{row.hotelMealLine}</div> : null}
      {row.detailLines.map((line, i) => (
        <div key={i} className="text-slate-500 mt-0.5">
          {line}
        </div>
      ))}
    </div>
  );
}

function renderBusIncludeStackFromModel(row: InvoiceProgressRowModel) {
  const order = row.detailLines;
  const waiveLine = order.find((l) => l.startsWith('Bus Hiace'));
  const penaltyLine = order.find((l) => l.startsWith('Penalti'));
  const ked = order.find((l) => l.startsWith('Kedatangan:')) || '';
  const kep = order.find((l) => l.startsWith('Kepulangan:')) || '';
  const kedBody = ked.replace(/^Kedatangan:\s*/, '');
  const kepBody = kep.replace(/^Kepulangan:\s*/, '');
  const arrivalLabel = kedBody.split(' · ')[0] || '';
  const returnLabel = kepBody.split(' · ')[0] || '';
  const arrivalRest = kedBody.includes(' · ') ? kedBody.slice(kedBody.indexOf(' · ') + 3) : '';
  const returnRest = kepBody.includes(' · ') ? kepBody.slice(kepBody.indexOf(' · ') + 3) : '';
  const arrivalTerbit = arrivalRest.length > 0;
  const returnTerbit = returnRest.length > 0;

  return (
    <div className="rounded border border-amber-100 bg-amber-50/80 p-1.5 text-xs space-y-1">
      {waiveLine && <div className="text-slate-700">{waiveLine}</div>}
      {!waiveLine && (
        <>
          <div className="font-medium text-slate-800">Bus include (dengan visa)</div>
          {penaltyLine ? <div className="text-amber-800">{penaltyLine}</div> : null}
        </>
      )}
      <div className="text-slate-700">
        <span className="font-medium">Kedatangan:</span> {arrivalLabel}
        {arrivalTerbit && <div className="text-slate-600 mt-0.5">{arrivalRest}</div>}
      </div>
      <div className="text-slate-700">
        <span className="font-medium">Kepulangan:</span> {returnLabel}
        {returnTerbit && <div className="text-slate-600 mt-0.5">{returnRest}</div>}
      </div>
    </div>
  );
}

function renderStackSectionRow(row: InvoiceProgressRowModel) {
  if (row.variant === 'bus-include') return renderBusIncludeStackFromModel(row);
  return renderStackRow(row);
}

function renderProgressTable(sections: InvoiceProgressSectionModel[]) {
  const flat: { layanan: string; status: string; detail: string; key: string }[] = [];
  sections.forEach((sec) => {
    sec.rows.forEach((row) => {
      const layanan = sec.title === row.serviceLabel ? row.serviceLabel : `${sec.title}: ${row.serviceLabel}`;
      const suffixSansDot = row.statusInlineSuffix ? row.statusInlineSuffix.replace(/^\s*·\s*/, '').trim() : '';
      const detailParts = [...(suffixSansDot ? [suffixSansDot] : [])];
      if (row.hotelRoomLine) detailParts.push(row.hotelRoomLine);
      if (row.hotelMealLine) detailParts.push(row.hotelMealLine);
      detailParts.push(...row.detailLines.filter((l) => !l.startsWith('Kedatangan:') && !l.startsWith('Kepulangan:')));
      if (row.variant === 'bus-include') {
        flat.push({
          key: `${sec.sortIndex}-${row.key}`,
          layanan,
          status: row.statusLabel,
          detail: row.detailLines.join(' · '),
        });
      } else if (row.statusMuted) {
        flat.push({
          key: `${sec.sortIndex}-${row.key}`,
          layanan,
          status: '–',
          detail: row.statusLabel,
        });
      } else {
        flat.push({
          key: `${sec.sortIndex}-${row.key}`,
          layanan,
          status: row.statusLabel,
          detail: detailParts.filter(Boolean).join(' · '),
        });
      }
    });
  });
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-[11px]">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold">Layanan</th>
            <th className="px-2 py-1.5 text-left font-semibold">Status</th>
            <th className="px-2 py-1.5 text-left font-semibold">Detail</th>
          </tr>
        </thead>
        <tbody>
          {flat.map((r) => (
            <tr key={r.key} className="border-t border-slate-100">
              <td className="px-2 py-1.5 text-slate-700 align-top break-words">{r.layanan}</td>
              <td className="px-2 py-1.5 text-slate-800 align-top break-words">{r.status}</td>
              <td className="px-2 py-1.5 text-slate-600 align-top break-words">{r.detail || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Sel Status Progress untuk tabel Invoice. Menampilkan Visa, Tiket, Hotel, Bus, Handling, Paket
 * dengan label yang sama seperti di menu Progress masing-masing divisi.
 */
const InvoiceProgressStatusCell: React.FC<InvoiceProgressStatusCellProps> = ({
  inv,
  formatDate = defaultFormatDate,
  formatDateWithTime = defaultFormatDateWithTime,
  allowedSections,
  layout = 'stack',
}) => {
  const sections = buildInvoiceProgressSectionModels(inv, formatDate, formatDateWithTime, allowedSections);

  if (sections.length === 0) return <span className="text-slate-400 text-xs">–</span>;

  if (layout === 'table') return renderProgressTable(sections);

  return (
    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 text-xs">
      {sections.map((sec) => (
        <div key={`${sec.sortIndex}-${sec.title}`}>
          <div className="font-semibold text-slate-600 uppercase tracking-wide mb-1 text-[10px]">{sec.title}</div>
          <div className="space-y-1">{sec.rows.map((row) => <React.Fragment key={row.key}>{renderStackSectionRow(row)}</React.Fragment>)}</div>
        </div>
      ))}
    </div>
  );
};

export default InvoiceProgressStatusCell;
