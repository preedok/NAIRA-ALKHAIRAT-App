/**
 * Satu komponen untuk kolom "No. Invoice" di semua tabel yang menampilkan data invoice.
 * Di tabel: hanya nomor invoice (tanpa label status). Status tampil di kolom Status.
 * Menampilkan: nomor, badge Baru, Perubahan, catatan batal, optional DP payment.
 * Gunakan di: OrdersInvoicesPage, InvoiceDashboard, AdminPusatDashboard, ReportsPage, Accounting*, Visa/Ticket/Hotel/Bus/Handling Work, RefundsPage, OwnerDashboard.
 */

import React from 'react';
import Badge from './Badge';
import { INVOICE_STATUS_LABELS } from '../../utils/constants';
import NominalDisplay from './NominalDisplay';

export type InvoiceNumberCellInv = {
  id?: string;
  status?: string;
  invoice_number?: string;
  is_draft_order?: boolean;
  issued_at?: string | null;
  created_at?: string | null;
  order_updated_at?: string | null;
  paid_amount?: number | string | null;
  dp_amount?: number | string | null;
  cancellation_handling_note?: string | null;
  Refunds?: Array<{ status: string; amount?: number }>;
  Order?: { order_updated_at?: string | null; dp_payment_status?: string };
};

const formatDateForChange = (d: string | Date | null): string =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

/** Tanggal + jam untuk teks "Perubahan" (contoh: 12 Mar 2026, 14:30). */
const formatDateAndTimeForChange = (d: string | Date | null): string => {
  if (!d) return '';
  const date = new Date(d);
  const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dateStr}, ${timeStr}`;
};

/** Baru: invoice diterbitkan/dibuat dalam 24 jam terakhir (bukan draft). */
export function isNewInvoice(inv: InvoiceNumberCellInv | null | undefined): boolean {
  if (!inv || inv.status === 'draft' || inv.is_draft_order) return false;
  const at = inv.issued_at || inv.created_at;
  if (!at) return false;
  const then = new Date(at).getTime();
  return Date.now() - then < 24 * 60 * 60 * 1000;
}

/** Perubahan: ada update form order. Sumber: order_updated_at. */
export function getOrderChangeDate(inv: InvoiceNumberCellInv | null | undefined): Date | null {
  const at = inv?.order_updated_at ?? inv?.Order?.order_updated_at ?? null;
  return at ? new Date(at) : null;
}

const isDraftRow = (inv: InvoiceNumberCellInv | null | undefined): boolean => {
  if (!inv) return false;
  const st = (inv.status || '').toLowerCase();
  return st === 'draft' || !!inv.is_draft_order;
};

export interface InvoiceNumberCellProps {
  /** Invoice (atau object mirip invoice dengan status, invoice_number, Refunds, dll). */
  inv: InvoiceNumberCellInv | null | undefined;
  /** Label status invoice (default: INVOICE_STATUS_LABELS). */
  statusLabels?: Record<string, string>;
  /** Tampilkan badge "Baru" dan teks "Perubahan [tanggal]". Default true. */
  showBaruAndPerubahan?: boolean;
  /** Tampilkan baris "Pembayaran DP: Rp X (sudah dibayar)" untuk progress. Default false. */
  showDpPayment?: boolean;
  /** Order untuk showDpPayment (dp_payment_status). Bisa dari inv.Order atau row order. */
  order?: { dp_payment_status?: string } | null;
  /** Tampilkan catatan pembatalan (cancellation_handling_note) untuk status batal. Default true. */
  showCancellationNote?: boolean;
  className?: string;
  /** Untuk tampilan ringkas (tanpa Baru/Perubahan), mis. di RefundsPage. */
  compact?: boolean;
}

export function InvoiceNumberCell({
  inv,
  statusLabels = INVOICE_STATUS_LABELS,
  showBaruAndPerubahan = true,
  showDpPayment = false,
  order,
  showCancellationNote = true,
  className = '',
  compact = false,
}: InvoiceNumberCellProps) {
  if (!inv) return <span className="text-slate-400">–</span>;

  const changeDate = getOrderChangeDate(inv);
  const changeDateStr = changeDate ? formatDateAndTimeForChange(changeDate.toISOString()) : '';
  const statusLabel = inv.status && statusLabels[inv.status] ? statusLabels[inv.status] : (inv.status || '');
  const o = order ?? inv.Order;
  const showDp = showDpPayment && o?.dp_payment_status === 'pembayaran_dp' && (inv.dp_amount != null || inv.paid_amount != null);
  const paidForDp = parseFloat(String(inv.paid_amount || 0)) || 0;

  const cancelledNote =
    showCancellationNote &&
    (inv.status === 'canceled' || inv.status === 'cancelled' || inv.status === 'cancelled_refund') &&
    (inv as { cancellation_handling_note?: string }).cancellation_handling_note;
  const noteRaw = typeof cancelledNote === 'string' ? cancelledNote : '';
  const noteCleaned = noteRaw
    .replace(/Refund\.\s*Jumlah:\s*Rp\s*[\d.,]+\.?\s*/gi, '')
    .replace(/Diproses di menu Refund\.?\s*/gi, '')
    .trim();

  const numberOnly = isDraftRow(inv) ? 'Draft' : (inv.invoice_number || '–');

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span>
        {numberOnly}
        {noteCleaned ? (
          <span className="block text-xs text-slate-600 mt-1 max-w-md">{noteCleaned}</span>
        ) : null}
      </span>
      {showDp && (
        <span className="text-xs text-emerald-700 font-medium">
          Pembayaran DP: <NominalDisplay amount={paidForDp} currency="IDR" /> (sudah dibayar)
        </span>
      )}
      {!compact && showBaruAndPerubahan && !isDraftRow(inv) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {statusLabel ? (
            <span className="text-xs text-slate-600" title="Status invoice">
              Status: {statusLabel}
            </span>
          ) : null}
          {isNewInvoice(inv) && (
            <Badge variant="success" className="text-xs">
              Baru
            </Badge>
          )}
          {changeDateStr && (
            <span className="text-xs text-slate-600" title="Perubahan form order">
              Perubahan {changeDateStr}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default InvoiceNumberCell;
