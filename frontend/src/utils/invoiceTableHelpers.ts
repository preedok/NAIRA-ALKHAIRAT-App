/**
 * Helper untuk tabel invoice (menu Invoice & Progress divisi).
 * Dipakai agar view dan data tabel Progress sama dengan menu Invoice.
 */

export function amountTriple(
  idr: number,
  sarToIdr: number,
  usdToIdr: number
): { idr: number; sar: number; usd: number } {
  return { idr, sar: idr / sarToIdr, usd: idr / usdToIdr };
}

export function isCancelledNoPayment(inv: any): boolean {
  const st = (inv?.status || '').toLowerCase();
  if (st !== 'canceled' && st !== 'cancelled' && st !== 'cancelled_refund') return false;
  const paidFromProofs = (inv?.PaymentProofs || []).filter(
    (p: any) =>
      p.payment_location === 'saudi' ||
      p.verified_status === 'verified' ||
      (p.verified_at && p.verified_status !== 'rejected')
  ).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
  const paid = parseFloat(inv?.paid_amount || 0) || paidFromProofs;
  return paid <= 0;
}

export function invoiceTotalTriple(
  inv: any,
  sarToIdr: number,
  usdToIdr: number
): { idr: number; sar: number; usd: number } {
  if (isCancelledNoPayment(inv)) return { idr: 0, sar: 0, usd: 0 };
  const idr =
    inv?.total_amount_idr != null
      ? parseFloat(inv.total_amount_idr)
      : parseFloat(inv?.total_amount || 0);
  const sar =
    inv?.total_amount_sar != null ? parseFloat(inv.total_amount_sar) : idr / sarToIdr;
  return { idr, sar, usd: idr / usdToIdr };
}

/** True jika SISA harus ditampilkan 0: lunas, direfund ke saldo, dipindah ke invoice lain, sudah direfund, atau batal tanpa bayar. */
export function isSisaZero(inv: any): boolean {
  const st = (inv?.status || '').toLowerCase();
  if (st === 'paid') return true;
  const refunds = (inv?.Refunds || []) as { status: string }[];
  if (refunds.some((r: { status: string }) => r.status === 'refunded')) return true;
  if (isCancelledNoPayment(inv)) return true;
  const note = (inv?.cancellation_handling_note || '').toLowerCase();
  const hasRefundToBalance = (note.includes('saldo akun') || note.includes('dipindahkan ke saldo')) && !refunds.some((r: { status: string }) => r.status === 'refunded');
  if (hasRefundToBalance) return true;
  const reallocOut = (inv?.ReallocationsOut || []) as any[];
  const hasReallocOut = reallocOut.length > 0 && (st === 'canceled' || st === 'cancelled' || st === 'cancelled_refund' || note.includes('dipindahkan ke invoice') || note.includes('dialihkan ke invoice'));
  if (hasReallocOut) return true;
  return false;
}

/** Jumlah paid dari invoice (paid_amount atau jumlah bukti terverifikasi). */
function getPaidFromInv(inv: any): number {
  const paidFromProofs = (inv?.PaymentProofs || []).filter(
    (p: any) =>
      p.payment_location === 'saudi' ||
      p.verified_status === 'verified' ||
      (p.verified_at && p.verified_status !== 'rejected')
  ).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
  return parseFloat(inv?.paid_amount || 0) || paidFromProofs;
}

/** SISA yang ditampilkan: 0 jika lunas/direfund ke saldo/dipindah/refunded/batal tanpa bayar, else max(0, total - paid). */
export function getDisplayRemaining(inv: any): number {
  if (isSisaZero(inv)) return 0;
  const totalInv = parseFloat(inv?.total_amount || 0);
  const paid = getPaidFromInv(inv);
  return Math.max(0, totalInv - paid);
}
