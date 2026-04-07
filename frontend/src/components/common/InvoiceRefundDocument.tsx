/**
 * Dokumen tampilan Invoice Refund / Dibatalkan.
 * Background biru gelap, header merah, lengkap informasi refund/saldo/pemindahan.
 * Dipakai di: modal detail (tab Invoice Refund) dan modal batalkan (tab Invoice batal).
 */

import React from 'react';
import NominalDisplay from './NominalDisplay';
import { getEffectiveInvoiceStatusLabel, type InvoiceForStatusRefund } from './InvoiceStatusRefundCell';

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
    updated_at?: string;
  }>;
  Order?: { order_updated_at?: string | null };
};

/** Preview data saat user belum submit (modal batalkan): saldo akun atau refund rekening */
export type InvoiceRefundDocumentPreview = {
  action: 'to_balance' | 'refund';
  refundAmount?: number;
  remainderAction?: 'to_balance';
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
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
    allocate_to_order: 'Pemindahan ke invoice lain (riwayat lama)',
  };
  const refundStatusLabel: Record<string, string> = {
    requested: 'Menunggu proses',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    refunded: 'Sudah direfund',
  };
  const refundStatusClass: Record<string, string> = {
    requested: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    rejected: 'bg-rose-100 text-rose-800',
    refunded: 'bg-emerald-100 text-emerald-800',
  };
  const refunds = (inv.Refunds || []).map((r) => ({ ...r, amountNum: parseFloat(String(r.amount || 0)) || 0 }));
  const sumRefund = refunds.reduce((s, r) => s + r.amountNum, 0);
  const note = String(inv.cancellation_handling_note || '').toLowerCase();
  const hasBalanceSettlement = note.includes('saldo akun') || note.includes('dipindahkan ke saldo');
  const balanceAmount = hasBalanceSettlement ? Math.max(0, amountDisplay - sumRefund) : 0;
  const refundHistoryRows = [
    ...(balanceAmount > 0
      ? [{
          id: 'to-balance',
          date: inv.Order?.order_updated_at || inv.created_at || inv.issued_at || null,
          method: 'Refund ke saldo akun owner',
          amount: balanceAmount,
          status: 'done',
          note: 'Selesai otomatis',
        }]
      : []),
    ...refunds.map((r) => ({
      id: r.id || `${r.status}-${r.created_at || ''}`,
      date: r.updated_at || r.created_at || null,
      method: 'Refund ke rekening',
      amount: r.amountNum,
      status: r.status,
      note: [r.bank_name, r.account_number].filter(Boolean).join(' · ') || r.reason || '—',
    })),
  ];

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-slate-300 shadow-xl ${className}`}
      style={{ backgroundColor: '#0D1A63' }}
    >
      {/* Header merah */}
      <div className="bg-red-600 px-6 py-4 text-white">
        <h2 className="text-lg font-bold tracking-wide">INVOICE REFUND / DIBATALKAN</h2>
        <p className="text-sm text-red-100 mt-0.5 opacity-95">
          Dokumen ini mencatat pembatalan invoice dan pengembalian dana (saldo atau rekening)
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
            {!isPreview && (
              <p className="text-slate-300 text-sm mt-0.5">{getEffectiveInvoiceStatusLabel(inv as InvoiceForStatusRefund)}</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-slate-300 mb-0.5">Jumlah yang dibayarkan (sebelum dibatalkan)</p>
          <p className="text-xl font-bold text-amber-300"><NominalDisplay amount={amountDisplay} currency="IDR" /></p>
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
                    <p>Jumlah refund: <span className="text-amber-300 font-medium"><NominalDisplay amount={preview.refundAmount ?? 0} currency="IDR" /></span></p>
                  )}
                  {(preview.bankName || preview.accountNumber) && (
                    <p>Rekening: {[preview.bankName, preview.accountNumber].filter(Boolean).join(' · ')}</p>
                  )}
                  {preview.accountHolderName && <p>A.n. {preview.accountHolderName}</p>}
                  {preview.remainderAction === 'to_balance' &&
                    preview.refundAmount != null &&
                    paid > 0 &&
                    preview.refundAmount < paid && (
                    <p>Sisa setelah refund masuk <strong>saldo akun</strong>.</p>
                  )}
                </div>
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
                      <span className="font-semibold text-amber-300"><NominalDisplay amount={parseFloat(String(r.amount || 0))} currency="IDR" /></span>
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
            {refundHistoryRows.length > 0 && (
              <div className="pt-3 border-t border-slate-500/50 space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-300 mb-1">Riwayat Refund</p>
                <div className="overflow-x-auto border border-slate-600/40 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/60 text-slate-300">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Tanggal</th>
                        <th className="text-left px-3 py-2 font-medium">Metode</th>
                        <th className="text-left px-3 py-2 font-medium">Nominal</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-left px-3 py-2 font-medium">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refundHistoryRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-700/60">
                          <td className="px-3 py-2 text-slate-200">{formatDate(row.date)}</td>
                          <td className="px-3 py-2 text-slate-100">{row.method}</td>
                          <td className="px-3 py-2 text-amber-300 font-medium"><NominalDisplay amount={row.amount} currency="IDR" /></td>
                          <td className="px-3 py-2">
                            {row.status === 'done' ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Selesai</span>
                            ) : (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${refundStatusClass[row.status] || 'bg-slate-200 text-slate-800'}`}>
                                {refundStatusLabel[row.status] || row.status}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-300">{row.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default InvoiceRefundDocument;
