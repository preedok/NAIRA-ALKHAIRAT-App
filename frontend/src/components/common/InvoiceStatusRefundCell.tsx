/**
 * Tampilan status invoice + status refund + jumlah dibayar/refund (sama persis dengan menu Invoice).
 * Gunakan di semua halaman yang menampilkan daftar invoice: Report, Accounting, Dashboard, Work pages.
 */

import React from 'react';
import Badge from './Badge';
import {
  INVOICE_STATUS_LABELS,
  REFUND_STATUS_LABELS
} from '../../utils/constants';
import { formatIDR, formatSAR, formatUSD } from '../../utils/formatters';
import { fromIDR, getRatesFromRates } from '../../utils/currencyConversion';

export type InvoiceForStatusRefund = {
  status?: string;
  paid_amount?: number | string | null;
  total_amount?: number | string | null;
  total_amount_idr?: number | string | null;
  total_amount_sar?: number | string | null;
  cancelled_refund_amount?: number | string | null;
  is_draft_order?: boolean;
  Order?: { currency_rates_override?: { SAR_TO_IDR?: number; USD_TO_IDR?: number } };
  PaymentProofs?: Array<{ amount?: number | string; payment_location?: string; verified_status?: string; verified_at?: unknown }>;
  Refunds?: Array<{ status: string; amount?: number }>;
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
  const displayRefundAmount = refundAmt > 0 ? refundAmt : (isRefunded && completedRefund && Number((completedRefund as any).amount)) || 0;
  const showRefundBlock = isRefunded || (isCancelledRefund && displayRefundAmount > 0);
  const effectiveStatusLabel = isRefunded ? 'Sudah direfund' : statusLabel;

  const alignClass = align === 'right' ? 'items-end' : 'items-start';
  const textAlign = align === 'right' ? 'text-right' : 'text-left';

  return (
    <div className={`flex flex-col gap-1 ${alignClass} ${textAlign} ${className}`}>
      <Badge variant={isRefunded ? 'success' : getStatusBadge(inv.status || '')} className="w-fit text-xs">
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
      ) : showRefundBlock ? (
        displayRefundAmount > 0 ? (
          (() => {
            const t = amountTriple(displayRefundAmount);
            const pctR = totalInv > 0 ? Math.round((displayRefundAmount / totalInv) * 100) : null;
            return (
              <>
                <div className="text-amber-700 font-medium text-sm">Refund: {formatIDR(displayRefundAmount)}</div>
                <div className="text-xs text-slate-500">
                  <span className="text-slate-400">SAR:</span> {formatSAR(t.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(t.usd, false)}
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
          const t = amountTriple(paid);
          return (
            <>
              <div className="text-[#0D1A63] font-medium">{formatIDR(paid)}</div>
              <div className="text-xs text-slate-500">
                <span className="text-slate-400">SAR:</span> {formatSAR(t.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(t.usd, false)}
              </div>
              {pctPaid != null && <div className="text-xs text-slate-600 mt-0.5">{pctPaid}% dari total tagihan</div>}
            </>
          );
        })()
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
