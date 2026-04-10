/**
 * Satu sumber kebenaran untuk tampilan status invoice (termasuk "Refund diproses", "Sudah direfund", dll).
 * Gunakan getEffectiveInvoiceStatusLabel(inv) / getEffectiveInvoiceStatusBadgeVariant(inv) atau komponen
 * InvoiceStatusRefundCell di semua halaman dan popup yang menampilkan data invoice agar informasi konsisten
 * dengan PDF invoice dan dokumen refund.
 */

import React from 'react';
import Badge from './Badge';
import {
  INVOICE_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  CANCELLATION_TO_BALANCE_LABEL,
  REFUND_IN_PROCESS_LABEL,
  REALLOCATION_OUT_LABEL,
  REALLOCATION_IN_LABEL,
  REALLOCATION_OUT_STATUS_LABEL
} from '../../utils/constants';
import NominalDisplay from './NominalDisplay';
import { fromIDR, getRatesFromRates } from '../../utils/currencyConversion';

export type ReallocationItem = {
  amount: number | string;
  TargetInvoice?: { invoice_number?: string };
  SourceInvoice?: { invoice_number?: string };
};

export type InvoiceForStatusRefund = {
  status?: string;
  paid_amount?: number | string | null;
  total_amount?: number | string | null;
  total_amount_idr?: number | string | null;
  total_amount_sar?: number | string | null;
  cancelled_refund_amount?: number | string | null;
  cancellation_handling_note?: string | null;
  is_draft_order?: boolean;
  Order?: { currency_rates_override?: { SAR_TO_IDR?: number; USD_TO_IDR?: number } };
  PaymentProofs?: Array<{ amount?: number | string; payment_location?: string; verified_status?: string; verified_at?: unknown }>;
  Refunds?: Array<{ status: string; amount?: number }>;
  ReallocationsOut?: ReallocationItem[];
  ReallocationsIn?: ReallocationItem[];
};

const getStatusBadge = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
    paid: 'success', partial_paid: 'warning', tentative: 'default', draft: 'info', confirmed: 'info',
    processing: 'info', completed: 'success', overdue: 'error', canceled: 'error', cancelled: 'error', cancelled_refund: 'error',
    refunded: 'default', order_updated: 'warning', overpaid: 'warning', overpaid_transferred: 'info',
    overpaid_received: 'info', refund_canceled: 'error', overpaid_refund_pending: 'warning'
  };
  return (map[status] || 'default') as 'success' | 'warning' | 'info' | 'error' | 'default';
};

/** Label status dari data GET invoice (satu sumber kebenaran: refund ke saldo, pemindahan ke invoice lain, sudah direfund, refund diproses, atau status biasa). */
export function getEffectiveInvoiceStatusLabel(inv: InvoiceForStatusRefund): string {
  const st = (inv?.status || '').toLowerCase();
  const refunds = (inv.Refunds || []) as { status: string }[];
  const completedRefund = refunds.find((r: { status: string }) => r.status === 'refunded');
  const isRefunded = !!completedRefund;
  const latestRefund = refunds[0];
  const refundInProgress = !isRefunded && latestRefund && ['requested', 'approved'].includes(latestRefund.status);
  const note = (inv.cancellation_handling_note || '').toLowerCase();
  const reallocOut = (inv.ReallocationsOut || []) as ReallocationItem[];
  const hasNoteRefundToBalance = (note.includes('saldo akun') || note.includes('dipindahkan ke saldo')) && !isRefunded;
  const isRefundToBalance = hasNoteRefundToBalance;
  const hasNoteReallocOut = note.includes('dipindahkan ke invoice') || note.includes('dialihkan ke invoice') || note.includes('dialihkan ke ');
  const isReallocationOut =
    reallocOut.length > 0 &&
    (st === 'canceled' || st === 'cancelled' || st === 'cancelled_refund' || hasNoteReallocOut) &&
    !isRefunded;
  const statusLabel =
    st === 'cancelled_refund' || st === 'refund_canceled'
      ? (INVOICE_STATUS_LABELS[inv?.status || ''] || 'Dibatalkan Refund')
      : (INVOICE_STATUS_LABELS[inv?.status || ''] || inv?.status || '');
  if (isRefunded) return 'Sudah direfund';
  if (refundInProgress) return REFUND_IN_PROCESS_LABEL;
  if (isRefundToBalance) return CANCELLATION_TO_BALANCE_LABEL;
  if (isReallocationOut) return REALLOCATION_OUT_STATUS_LABEL;
  return statusLabel;
}

/** Variant badge untuk status efektif (success jika sudah direfund, info jika refund diproses, else dari status invoice). */
export function getEffectiveInvoiceStatusBadgeVariant(inv: InvoiceForStatusRefund): 'success' | 'warning' | 'info' | 'error' | 'default' {
  const refunds = (inv.Refunds || []) as { status: string }[];
  const isRefunded = refunds.some((r: { status: string }) => r.status === 'refunded');
  if (isRefunded) return 'success';
  const latest = refunds[0];
  if (latest && ['requested', 'approved'].includes(latest.status)) return 'info';
  return getStatusBadge(inv?.status || '');
}

/**
 * Sembunyikan / blokir aksi "Batalkan Invoice" bila invoice sudah terminal di DB atau status efektif
 * menunjukkan pembatalan/refund sudah ditangani (mis. Direfund ke saldo akun meski status masih paid).
 */
export function shouldHideInvoiceCancelAction(inv: InvoiceForStatusRefund): boolean {
  const st = (inv?.status || '').toLowerCase();
  if (['canceled', 'cancelled', 'refunded'].includes(st)) return true;
  if (st === 'cancelled_refund' || st === 'refund_canceled') {
    const refunds = (inv?.Refunds || []) as Array<{ status?: string }>;
    const latest = refunds[0];
    const latestStatus = String(latest?.status || '').toLowerCase();
    const hasActiveRefund = refunds.some((r) => ['requested', 'approved'].includes(String(r?.status || '').toLowerCase()));
    if (hasActiveRefund) return true;
    if (latestStatus === 'rejected') return false; // allow retry refund after rejection
    return true;
  }

  const effective = getEffectiveInvoiceStatusLabel(inv);
  if (effective === CANCELLATION_TO_BALANCE_LABEL) return true;
  if (effective === REALLOCATION_OUT_STATUS_LABEL) return true;
  if (effective === REFUND_STATUS_LABELS.refunded) return true;
  if (effective === REFUND_IN_PROCESS_LABEL) return true;
  return false;
}

const getInvoiceStatusLabel = (inv: InvoiceForStatusRefund): string => {
  const st = (inv?.status || '').toLowerCase();
  if (st === 'cancelled_refund' || st === 'refund_canceled') {
    return INVOICE_STATUS_LABELS[inv?.status || ''] || 'Dibatalkan Refund';
  }
  return INVOICE_STATUS_LABELS[inv?.status || ''] || inv?.status || '';
};

const isDraftRow = (inv: InvoiceForStatusRefund): boolean => {
  const st = (inv?.status || '').toLowerCase();
  return st === 'draft' || !!inv?.is_draft_order;
};

interface InvoiceStatusRefundCellProps {
  inv: InvoiceForStatusRefund;
  /** Optional: SAR_TO_IDR, USD_TO_IDR. Default from getRatesFromRates(). Order rates (inv.Order?.currency_rates_override) override this. */
  currencyRates?: { SAR_TO_IDR?: number; USD_TO_IDR?: number };
  align?: 'left' | 'right';
  className?: string;
}

export function InvoiceStatusRefundCell({ inv, currencyRates, align = 'right', className = '' }: InvoiceStatusRefundCellProps) {
  const orderRates = inv?.Order?.currency_rates_override;
  const rates = getRatesFromRates(orderRates || currencyRates);
  const amountTriple = (idr: number) => fromIDR(idr, rates);

  const st = (inv?.status || '').toLowerCase();
  const paidFromProofs = (inv.PaymentProofs || []).filter(
    (p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')
  ).reduce((s: number, p: any) => s + (parseFloat(String(p.amount)) || 0), 0);
  const paid = parseFloat(String(inv.paid_amount || 0)) || paidFromProofs;
  const totalInv = parseFloat(String(inv.total_amount || 0));
  const pctPaid = totalInv > 0 ? Math.round((paid / totalInv) * 100) : null;
  const refundAmt = parseFloat(String(inv.cancelled_refund_amount || 0)) || 0;
  const statusLabel = getInvoiceStatusLabel(inv);
  const isCancelNoPayment = (st === 'canceled' || st === 'cancelled') && paid <= 0;
  const isCancelledRefund = st === 'cancelled_refund';
  const refunds = (inv.Refunds || []) as { status: string; amount?: number }[];
  const completedRefund = refunds.find((r: any) => r.status === 'refunded');
  const latestRefund = refunds[0];
  const refundProcessLabel = latestRefund ? (REFUND_STATUS_LABELS[latestRefund.status] || latestRefund.status) : null;
  const isRefunded = !!completedRefund;
  const note = (inv.cancellation_handling_note || '').toLowerCase();
  const reallocOut = (inv.ReallocationsOut || []) as ReallocationItem[];
  const reallocIn = (inv.ReallocationsIn || []) as ReallocationItem[];

  // Refund ke saldo: pakai note sebagai sumber utama agar tidak tampil "Tagihan DP" saat sudah jadikan saldo (meski status belum di-update)
  const hasNoteRefundToBalance = (note.includes('saldo akun') || note.includes('dipindahkan ke saldo')) && !isRefunded;
  const isRefundToBalance = hasNoteRefundToBalance;

  // Pemindahan ke invoice lain: ada ReallocationsOut dan invoice dibatalkan / note menyebut dialihkan
  const hasNoteReallocOut = note.includes('dipindahkan ke invoice') || note.includes('dialihkan ke invoice') || note.includes('dialihkan ke ');
  const isReallocationOut =
    reallocOut.length > 0 &&
    (st === 'canceled' || st === 'cancelled' || st === 'cancelled_refund' || hasNoteReallocOut) &&
    !isRefunded;

  const displayRefundAmount = refundAmt > 0 ? refundAmt : (isRefunded && completedRefund && Number((completedRefund as any).amount)) || 0;
  const showRefundBlock = isRefunded || (isCancelledRefund && displayRefundAmount > 0 && !isRefundToBalance);
  // Refund dalam proses (requested / approved): tampilkan "Refund diproses" bukan "Pembayaran DP" / "Tagihan DP"
  const refundInProgress = !isRefunded && latestRefund && ['requested', 'approved'].includes(latestRefund.status);
  // Prioritas badge: Sudah direfund > Refund diproses > Direfund ke saldo akun > Dana dipindahkan ke invoice lain > status biasa
  const effectiveStatusLabel = isRefunded
    ? 'Sudah direfund'
    : refundInProgress
      ? REFUND_IN_PROCESS_LABEL
      : isRefundToBalance
        ? CANCELLATION_TO_BALANCE_LABEL
        : isReallocationOut
          ? REALLOCATION_OUT_STATUS_LABEL
          : statusLabel;

  const alignClass = align === 'right' ? 'items-end' : 'items-start';
  const textAlign = align === 'right' ? 'text-right' : 'text-left';

  const badgeVariant = isRefunded ? 'success' : refundInProgress ? 'info' : getStatusBadge(inv.status || '');

  return (
    <div className={`flex flex-col gap-1 ${alignClass} ${textAlign} ${className}`}>
      <Badge variant={badgeVariant} className="w-fit text-xs">
        {effectiveStatusLabel}
      </Badge>
      {refundProcessLabel != null && !isRefunded && (
        <span className="text-xs text-slate-600">Proses refund: <strong>{refundProcessLabel}</strong></span>
      )}
      {isDraftRow(inv) ? (
        <>
          <span className="text-slate-400 text-sm">–</span>
          {pctPaid != null && <div className="text-xs text-slate-500">{pctPaid}% dari total tagihan</div>}
        </>
      ) : isCancelNoPayment ? (
        <>
          <span className="text-slate-400 text-sm">–</span>
          {pctPaid != null && <div className="text-xs text-slate-500">{pctPaid}% dari total tagihan</div>}
        </>
      ) : isRefundToBalance ? (
        (() => {
          const amt = refundAmt || displayRefundAmount || 0;
          const t = amountTriple(amt);
          return (
            <>
              <div className="text-violet-700 font-medium text-sm"><NominalDisplay amount={amt} currency="IDR" /></div>
              <div className="text-xs text-slate-500">
                <span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} />
              </div>
              <div className="text-xs text-violet-600 mt-0.5">Dana masuk ke saldo akun owner. Sisa tagihan: Rp 0.</div>
            </>
          );
        })()
      ) : isReallocationOut && reallocOut.length > 0 ? (
        (() => {
          const totalMoved = reallocOut.reduce((s, r) => s + (parseFloat(String(r.amount || 0)) || 0), 0);
          const t = amountTriple(totalMoved);
          return (
            <>
              <div className="text-amber-700 font-medium text-sm"><NominalDisplay amount={totalMoved} currency="IDR" /></div>
              <div className="text-xs text-slate-500">
                <span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} />
              </div>
              <div className="text-xs text-amber-600 mt-0.5">Dana dipindahkan ke invoice lain. Sisa tagihan: Rp 0.</div>
            </>
          );
        })()
      ) : showRefundBlock ? (
        displayRefundAmount > 0 ? (
          (() => {
            const t = amountTriple(displayRefundAmount);
            const pctR = totalInv > 0 ? Math.round((displayRefundAmount / totalInv) * 100) : null;
            return (
              <>
                <div className="text-amber-700 font-medium text-sm">Refund: <NominalDisplay amount={displayRefundAmount} currency="IDR" /></div>
                <div className="text-xs text-slate-500">
                  <span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} />
                </div>
                {pctR != null && <div className="text-xs text-slate-600 mt-0.5">{pctR}% dari total tagihan</div>}
              </>
            );
          })()
        ) : (
          <span className="text-emerald-700 font-medium text-sm">Sudah direfund</span>
        )
      ) : (
        (() => {
          // Lunas: tampilkan total tagihan sebagai jumlah dibayar dan 100%, agar tidak tampil Rp 0 / 0%
          const isLunas = st === 'paid' || (totalInv > 0 && paid >= totalInv);
          const displayPaid = isLunas && totalInv > 0 ? totalInv : paid;
          const displayPct = isLunas && totalInv > 0 ? 100 : pctPaid;
          const t = amountTriple(displayPaid);
          return (
            <>
              <div className="text-[#0D1A63] font-medium"><NominalDisplay amount={displayPaid} currency="IDR" /></div>
              <div className="text-xs text-slate-500">
                <span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} />
              </div>
              {displayPct != null && <div className="text-xs text-slate-600 mt-0.5">{displayPct}% dari total tagihan</div>}
              {isLunas && <div className="text-xs text-emerald-600 mt-0.5">Lunas. Sisa tagihan: Rp 0.</div>}
            </>
          );
        })()
      )}
      {reallocOut.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-slate-100 pt-1.5">
          {reallocOut.map((r, i) => {
            const amt = parseFloat(String(r.amount || 0)) || 0;
            const targetNum = r.TargetInvoice?.invoice_number || '–';
            return (
              <div key={`out-${i}`} className="text-xs text-amber-700">
                {REALLOCATION_OUT_LABEL} <strong>{targetNum}</strong>: <NominalDisplay amount={amt} currency="IDR" />
              </div>
            );
          })}
        </div>
      )}
      {reallocIn.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-slate-100 pt-1.5">
          {reallocIn.map((r, i) => {
            const amt = parseFloat(String(r.amount || 0)) || 0;
            const sourceNum = r.SourceInvoice?.invoice_number || '–';
            return (
              <div key={`in-${i}`} className="text-xs text-emerald-700">
                {REALLOCATION_IN_LABEL} <strong>{sourceNum}</strong>: <NominalDisplay amount={amt} currency="IDR" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Label singkat status refund untuk ditampilkan di kolom No. Invoice (satu baris: "Status refund: Menunggu" / "Sudah direfund").
 * Sama dengan menu Invoice: jika ada refund selesai tampilkan "Sudah direfund", else status proses terbaru.
 */
export function InvoiceRefundStatusLabel({ inv }: { inv: { Refunds?: Array<{ status: string }> } }) {
  const refunds = (inv.Refunds || []) as { status: string }[];
  if (refunds.length === 0) return null;
  const completed = refunds.find((r: any) => r.status === 'refunded');
  const latest = refunds[0];
  const label = completed ? 'Sudah direfund' : (latest ? (REFUND_STATUS_LABELS[latest.status] || latest.status) : null);
  return label ? <span className="block text-xs text-amber-700 font-medium mt-0.5">Status refund: {label}</span> : null;
}

export default InvoiceStatusRefundCell;
