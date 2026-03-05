/**
 * Dokumen tampilan Invoice Refund / Dibatalkan.
 * Background biru gelap, header merah, lengkap informasi refund/saldo/pemindahan.
 * Dipakai di: modal detail (tab Invoice Refund) dan modal batalkan (tab Invoice batal).
 */

import React from 'react';
import { formatIDR } from '../../utils/formatters';

export type InvoiceRefundDocumentInv = {
  id?: string;
  invoice_number?: string;
  status?: string;
  paid_amount?: number | string | null;
  total_amount?: number | string | null;
  cancelled_refund_amount?: number | string | null;
  cancellation_handling_note?: string | null;
  issued_at?: string | null;
  created_at?: string | null;
  Refunds?: Array<{
    id?: string;
    status: string;
    amount?: number | string;
    bank_name?: string;
    account_number?: string;
    reason?: string;
    created_at?: string;
  }>;
  Order?: { order_updated_at?: string | null };
};

/** Preview data saat user belum submit (modal batalkan): pilihan jadikan saldo / refund / pindah */
export type InvoiceRefundDocumentPreview = {
  action: 'to_balance' | 'refund' | 'allocate_to_order';
  refundAmount?: number;
  remainderAction?: 'to_balance' | 'allocate_to_order';
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  targetInvoiceNumber?: string;
  remainderTargetInvoiceNumber?: string;
  reason?: string;
};

export type InvoiceRefundDocumentProps = {
  /** Data invoice (sudah tersimpan atau yang akan dibatalkan) */
  inv: InvoiceRefundDocumentInv;
  /** Jika ada: tampilkan sebagai preview (belum submit); jika null: tampilkan data tersimpan */
  preview?: InvoiceRefundDocumentPreview | null;
  /** Format tanggal untuk ditampilkan */
  formatDate?: (d: string | null | undefined) => string;
  className?: string;
};

const defaultFormatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';

export function InvoiceRefundDocument({
  inv,
  preview = null,
  formatDate = defaultFormatDate,
  className = '',
}: InvoiceRefundDocumentProps) {
  const paid = parseFloat(String(inv.paid_amount || 0)) || 0;
  const cancelledAmt = parseFloat(String(inv.cancelled_refund_amount || 0)) || 0;
  const amountDisplay = cancelledAmt > 0 ? cancelledAmt : paid;
  const isPreview = preview != null;

  const actionLabels: Record<string, string> = {
    to_balance: 'Jadikan saldo akun',
    refund: 'Refund ke rekening',
    allocate_to_order: 'Pemindahan ke invoice lain',
  };

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-slate-300 shadow-xl ${className}`}
      style={{ backgroundColor: '#0D1A63' }}
    >
      {/* Header merah */}
      <div className="bg-red-600 px-6 py-4 text-white">
        <h2 className="text-lg font-bold tracking-wide">INVOICE REFUND / DIBATALKAN</h2>
        <p className="text-sm text-red-100 mt-0.5 opacity-95">
          Dokumen ini mencatat pembatalan invoice dan pengembalian/pemindahan dana
        </p>
      </div>

      {/* Body: informasi */}
      <div className="px-6 py-5 space-y-4 text-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-300 mb-0.5">No. Invoice</p>
            <p className="font-mono font-semibold text-white">{inv.invoice_number || '–'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-300 mb-0.5">Tanggal / Status</p>
            <p className="text-white">
              {isPreview ? 'Akan dicatat setelah konfirmasi' : formatDate(inv.issued_at ?? inv.created_at ?? null)}
            </p>
            {!isPreview && inv.status && (
              <p className="text-slate-300 text-sm mt-0.5 capitalize">{inv.status.replace(/_/g, ' ')}</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-slate-300 mb-0.5">Jumlah yang dibayarkan (sebelum dibatalkan)</p>
          <p className="text-xl font-bold text-amber-300">{formatIDR(amountDisplay)}</p>
        </div>

        {isPreview ? (
          <>
            <div className="pt-3 border-t border-slate-500/50">
              <p className="text-xs uppercase tracking-wider text-slate-300 mb-1">Tindakan yang akan dicatat</p>
              <p className="font-semibold text-white">
                {amountDisplay === 0 ? 'Invoice dibatalkan (tanpa pembayaran)' : (actionLabels[preview.action] || preview.action)}
              </p>
              {preview.action === 'refund' && (
                <div className="mt-2 space-y-1 text-sm">
                  {preview.refundAmount != null && preview.refundAmount > 0 && (
                    <p>Jumlah refund: <span className="text-amber-300 font-medium">{formatIDR(preview.refundAmount)}</span></p>
                  )}
                  {(preview.bankName || preview.accountNumber) && (
                    <p>Rekening: {[preview.bankName, preview.accountNumber].filter(Boolean).join(' · ')}</p>
                  )}
                  {preview.accountHolderName && <p>A.n. {preview.accountHolderName}</p>}
                  {preview.remainderAction && preview.remainderAction === 'allocate_to_order' && preview.remainderTargetInvoiceNumber && (
                    <p>Sisa dana dialokasikan ke invoice: <strong>{preview.remainderTargetInvoiceNumber}</strong></p>
                  )}
                </div>
              )}
              {preview.action === 'allocate_to_order' && preview.targetInvoiceNumber && (
                <p className="mt-1 text-sm">Seluruh dana dialihkan ke invoice: <strong className="text-white">{preview.targetInvoiceNumber}</strong></p>
              )}
            </div>
            {preview.reason && (
              <div className="pt-2">
                <p className="text-xs uppercase tracking-wider text-slate-300 mb-0.5">Alasan pembatalan</p>
                <p className="text-slate-200 whitespace-pre-wrap">{preview.reason}</p>
              </div>
            )}
          </>
        ) : (
          <>
            {inv.cancellation_handling_note && (
              <div className="pt-3 border-t border-slate-500/50">
                <p className="text-xs uppercase tracking-wider text-slate-300 mb-1">Informasi pembatalan</p>
                <p className="text-slate-200 whitespace-pre-wrap">{String(inv.cancellation_handling_note).trim()}</p>
              </div>
            )}
            {(inv.Refunds?.length ?? 0) > 0 && (
              <div className="pt-3 border-t border-slate-500/50 space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-300 mb-1">Detail refund</p>
                <ul className="space-y-2">
                  {inv.Refunds!.map((r) => (
                    <li key={r.id ?? r.status} className="bg-slate-800/50 rounded-lg px-4 py-3 text-sm">
                      <span className="font-semibold text-amber-300">{formatIDR(parseFloat(String(r.amount || 0)))}</span>
                      <span className="ml-2 text-slate-300 capitalize">({r.status})</span>
                      {(r.bank_name || r.account_number) && (
                        <p className="mt-1 text-slate-400">Rekening: {[r.bank_name, r.account_number].filter(Boolean).join(' · ')}</p>
                      )}
                      {r.reason && <p className="text-slate-400 mt-0.5">Alasan: {r.reason}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default InvoiceRefundDocument;
