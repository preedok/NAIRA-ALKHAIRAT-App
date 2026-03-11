/**
 * Status progress per divisi (Visa, Tiket, Hotel, Bus) — satu sumber kebenaran.
 * Dipakai di: tabel Invoice (OrdersInvoicesPage) dan tab Progress detail invoice.
 * Label diselaraskan dengan menu Progress masing-masing divisi (VisaWorkPage, TicketWorkPage, HotelWorkPage, BusWorkPage).
 */
import React from 'react';

/** Label status Visa (menu Progress Visa) */
export const PROGRESS_LABELS_VISA: Record<string, string> = {
  document_received: 'Dokumen diterima',
  submitted: 'Dikirim',
  in_process: 'Diproses',
  approved: 'Disetujui',
  issued: 'Terbit'
};

/** Label status Tiket (menu Progress Tiket) */
export const PROGRESS_LABELS_TICKET: Record<string, string> = {
  pending: 'Menunggu',
  data_received: 'Data diterima',
  seat_reserved: 'Kursi reserved',
  booking: 'Booking',
  payment_airline: 'Bayar maskapai',
  ticket_issued: 'Tiket terbit'
};

/** Label status Hotel (menu Progress Hotel) */
export const PROGRESS_LABELS_HOTEL: Record<string, string> = {
  waiting_confirmation: 'Menunggu konfirmasi',
  confirmed: 'Penetapan room',
  room_assigned: 'Pemberian nomor room',
  completed: 'Selesai'
};

/** Label status makan (Hotel) */
export const PROGRESS_LABELS_MEAL: Record<string, string> = {
  pending: 'Menunggu',
  confirmed: 'Dikonfirmasi',
  completed: 'Selesai'
};

/** Label status Tiket Bus (menu Progress Bus) */
export const PROGRESS_LABELS_BUS: Record<string, string> = {
  pending: 'Pending',
  issued: 'Terbit'
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
  single: 'Single',
  double: 'Double',
  triple: 'Triple',
  quad: 'Quad',
  quint: 'Quint'
};

/** Kapasitas orang per tipe kamar (untuk tampilan jumlah orang) */
const ROOM_CAPACITY: Record<string, number> = { single: 1, double: 2, triple: 3, quad: 4, quint: 5 };

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

export interface InvoiceProgressStatusCellProps {
  /** Invoice row (dengan Order.OrderItems dan progress relations) */
  inv: any;
  formatDate?: (d: string | null | undefined) => string;
  formatDateWithTime?: (d: string | null | undefined, time?: string | null) => string;
}

/**
 * Sel Status Progress untuk tabel Invoice. Menampilkan Visa, Tiket, Hotel, Bus, Handling, Paket
 * dengan label yang sama seperti di menu Progress masing-masing divisi.
 */
const InvoiceProgressStatusCell: React.FC<InvoiceProgressStatusCellProps> = ({
  inv,
  formatDate = defaultFormatDate,
  formatDateWithTime = defaultFormatDateWithTime
}) => {
  const items = inv?.Order?.OrderItems || [];
  if (items.length === 0) return <span className="text-slate-400 text-xs">–</span>;

  const visaItems = items.filter((i: any) => (i.type || i.product_type) === 'visa');
  const ticketItems = items.filter((i: any) => (i.type || i.product_type) === 'ticket');
  const hotelItems = items.filter((i: any) => (i.type || i.product_type) === 'hotel');
  const busItems = items.filter((i: any) => (i.type || i.product_type) === 'bus');
  const handlingItems = items.filter((i: any) => (i.type || i.product_type) === 'handling');
  const packageItems = items.filter((i: any) => (i.type || i.product_type) === 'package');

  const sections: { title: string; nodes: React.ReactNode[] }[] = [];

  if (visaItems.length > 0) {
    sections.push({
      title: 'Visa',
      nodes: visaItems.map((item: any, idx: number) => {
        const name = item.Product?.name || item.product_name || 'Visa';
        const statusLabel = PROGRESS_LABELS_VISA[item.VisaProgress?.status] || item.VisaProgress?.status || 'Menunggu';
        const depDate = formatDate(item.meta?.travel_date ?? null);
        const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
        return (
          <div key={item.id || idx} className="rounded border border-slate-100 bg-slate-50/50 p-1.5 text-xs">
            <span className="font-medium text-slate-800" title={name}>{name}:</span>{' '}
            <span className={statusLabel === 'Terbit' ? 'text-[#0D1A63] font-medium' : 'text-slate-600'}>{statusLabel}</span>
            {qty > 1 && <span className="text-slate-600 ml-1">· {qty} org</span>}
            {depDate ? <div className="text-slate-500 mt-0.5">Tgl {depDate}</div> : null}
          </div>
        );
      })
    });
  }

  if (ticketItems.length > 0) {
    sections.push({
      title: 'Tiket',
      nodes: ticketItems.map((item: any, idx: number) => {
        const name = item.Product?.name || item.product_name || 'Tiket';
        const statusLabel = PROGRESS_LABELS_TICKET[item.TicketProgress?.status] || item.TicketProgress?.status || 'Menunggu';
        const tripType = String(item.meta?.trip_type || 'round_trip');
        const dep = formatDate(item.meta?.departure_date ?? null);
        const ret = formatDate(item.meta?.return_date ?? null);
        const dateLine = tripType === 'one_way' ? `Berangkat ${dep}` : tripType === 'return_only' ? `Pulang ${ret}` : `Berangkat ${dep} · Pulang ${ret}`;
        const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
        return (
          <div key={item.id || idx} className="rounded border border-slate-100 bg-slate-50/50 p-1.5 text-xs">
            <span className="font-medium text-slate-800" title={name}>{name}:</span>{' '}
            <span className={statusLabel === 'Tiket terbit' ? 'text-[#0D1A63] font-medium' : 'text-slate-600'}>{statusLabel}</span>
            {qty > 1 && <span className="text-slate-600 ml-1">· {qty} tiket</span>}
            {dateLine ? <div className="text-slate-500 mt-0.5">{dateLine}</div> : null}
          </div>
        );
      })
    });
  }

  if (hotelItems.length > 0) {
    const getCheckInOut = (item: any) => {
      const ci = (item.HotelProgress?.check_in_date ?? item.meta?.check_in ?? '').toString().slice(0, 10);
      const co = (item.HotelProgress?.check_out_date ?? item.meta?.check_out ?? '').toString().slice(0, 10);
      return { ci, co };
    };
    type HotelGroup = { key: string; name: string; items: any[] };
    const hotelGroups = (hotelItems as any[]).reduce((acc: HotelGroup[], item: any) => {
      const pid = String(item.product_ref_id || item.product_id || '');
      const { ci, co } = getCheckInOut(item);
      const key = `${pid}|${ci}|${co}`;
      const name = item.Product?.name || item.product_name || 'Hotel';
      const existing = acc.find((g: HotelGroup) => g.key === key);
      if (existing) existing.items.push(item);
      else acc.push({ key, name, items: [item] });
      return acc;
    }, [] as HotelGroup[]);
    sections.push({
      title: 'Hotel',
      nodes: hotelGroups.map((group: HotelGroup) => {
        const first = group.items[0];
        const status = PROGRESS_LABELS_HOTEL[first?.HotelProgress?.status] || first?.HotelProgress?.status || 'Menunggu konfirmasi';
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
        return (
          <div key={group.key} className="rounded border border-slate-100 bg-slate-50/50 p-1.5 text-xs">
            <span className="font-medium text-slate-800" title={group.name}>{group.name}:</span>{' '}
            <span className={status === 'Selesai' ? 'text-[#0D1A63] font-medium' : 'text-slate-600'}>{status}</span>
            {roomLines.length > 0 && <div className="text-slate-700 mt-0.5">{roomLines.join(', ')}</div>}
            {mealLabel != null && <div className="text-slate-600 mt-0.5">Makan: {mealLabel}</div>}
            <div className="text-slate-500 mt-0.5">CI {checkIn} · CO {checkOut}</div>
          </div>
        );
      })
    });
  }

  if (busItems.length > 0) {
    sections.push({
      title: 'Bus',
      nodes: busItems.map((item: any, idx: number) => {
        const name = item.Product?.name || item.product_name || 'Bus';
        const statusLabel = PROGRESS_LABELS_BUS[item.BusProgress?.bus_ticket_status] || item.BusProgress?.bus_ticket_status || 'Pending';
        const travelDate = formatDate(item.meta?.travel_date ?? null);
        const routeType = item.meta?.route_type ? String(item.meta.route_type) : '';
        const tripTypeRaw = item.meta?.trip_type ? String(item.meta.trip_type) : '';
        const tripTypeLabel = tripTypeRaw ? (BUS_TRIP_LABELS[tripTypeRaw] || tripTypeRaw) : '';
        const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10) || 1);
        const metaLine = [travelDate ? `Tgl ${travelDate}` : null, routeType ? `Rute ${routeType}` : null, tripTypeLabel, qty > 1 ? `${qty} unit` : null].filter(Boolean).join(' · ');
        return (
          <div key={item.id || idx} className="rounded border border-slate-100 bg-slate-50/50 p-1.5 text-xs">
            <span className="font-medium text-slate-800" title={name}>{name}:</span>{' '}
            <span className={statusLabel === 'Terbit' ? 'text-[#0D1A63] font-medium' : 'text-slate-600'}>{statusLabel}</span>
            {metaLine ? <div className="text-slate-500 mt-0.5">{metaLine}</div> : null}
          </div>
        );
      })
    });
  } else if (visaItems.length > 0) {
    const order = inv?.Order;
    const waive = order?.waive_bus_penalty === true;
    const penalty = Number(order?.penalty_amount) || 0;
    sections.push({
      title: 'Bus',
      nodes: [
        <div key="bus-include" className="rounded border border-amber-100 bg-amber-50/80 p-1.5 text-xs">
          {waive ? (
            <span className="text-slate-700">Bus Hiace (tanpa penalti) · 1 unit</span>
          ) : (
            <>
              <span className="font-medium text-slate-800">Bus include (dengan visa)</span>
              {penalty > 0 ? (
                <div className="text-amber-800 mt-0.5">Penalti bus: Rp {(penalty / 1e6).toFixed(0)} jt</div>
              ) : (
                <div className="text-slate-600 mt-0.5">Min 35 pack visa; jika kurang kena penalti atau centang pakai Hiace</div>
              )}
            </>
          )}
        </div>
      ]
    });
  }

  if (handlingItems.length > 0) {
    sections.push({
      title: 'Handling',
      nodes: handlingItems.map((item: any, idx: number) => {
        const name = item.Product?.name || item.product_name || 'Handling';
        const qty = Math.max(0, parseInt(String(item.quantity ?? 1), 10) || 1);
        return (
          <div key={item.id || idx} className="rounded border border-slate-100 bg-slate-50/50 p-1.5 text-xs">
            <span className="font-medium text-slate-800" title={name}>{name}:</span> <span className="text-slate-600">Qty {qty}</span>
          </div>
        );
      })
    });
  }

  if (packageItems.length > 0) {
    sections.push({
      title: 'Paket',
      nodes: packageItems.map((item: any, idx: number) => {
        const name = item.Product?.name || item.product_name || 'Paket';
        const qty = Math.max(0, parseInt(String(item.quantity ?? 1), 10) || 1);
        return (
          <div key={item.id || idx} className="rounded border border-slate-100 bg-slate-50/50 p-1.5 text-xs">
            <span className="font-medium text-slate-800" title={name}>{name}:</span> <span className="text-slate-600">Qty {qty}</span>
          </div>
        );
      })
    });
  }

  if (sections.length === 0) return <span className="text-slate-400 text-xs">–</span>;

  return (
    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 text-xs">
      {sections.map((sec) => (
        <div key={sec.title}>
          <div className="font-semibold text-slate-600 uppercase tracking-wide mb-1 text-[10px]">{sec.title}</div>
          <div className="space-y-1">{sec.nodes}</div>
        </div>
      ))}
    </div>
  );
};

export default InvoiceProgressStatusCell;
