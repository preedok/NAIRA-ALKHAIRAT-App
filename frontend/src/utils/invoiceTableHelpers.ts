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
