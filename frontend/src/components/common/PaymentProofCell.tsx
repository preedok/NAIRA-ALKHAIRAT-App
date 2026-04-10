/**
 * Sel tabel "Bukti Bayar" seragam di semua halaman (Invoice, Dashboard Wilayah, Accounting Aging).
 * Menampilkan daftar bukti pembayaran: tipe (DP/Cicilan/Lunas), channel (Transfer/KES), nominal, status verifikasi.
 */

import React from 'react';
import Badge from './Badge';
import NominalDisplay from './NominalDisplay';

export type PaymentProofItem = {
  id: string;
  payment_type?: string;
  payment_location?: string;
  amount?: number | string;
  amount_original?: number | string;
  payment_currency?: string;
  verified_status?: string;
  verified_at?: string | null;
  bank_name?: string;
  account_number?: string;
  sender_account_name?: string;
  sender_account_number?: string;
  transfer_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
  proof_file_url?: string;
  proof_file_name?: string;
  Bank?: { name?: string };
  RecipientAccount?: { bank_name?: string; account_number?: string; name?: string };
  VerifiedBy?: { name?: string };
};

/** Status bukti bayar: rejected > verified > pending. KES (Saudi) selalu terverifikasi. */
export function getProofStatus(p: PaymentProofItem): { status: 'rejected' | 'verified' | 'pending'; label: string; variant: 'error' | 'success' | 'warning' } {
  if (p.verified_status === 'rejected') return { status: 'rejected', label: 'Tidak valid', variant: 'error' };
  if (p.payment_location === 'saudi') return { status: 'verified', label: 'Diverifikasi', variant: 'success' };
  if (p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')) return { status: 'verified', label: 'Diverifikasi', variant: 'success' };
  return { status: 'pending', label: 'Menunggu verifikasi', variant: 'warning' };
}

export function getProofTypeLabel(type: string): string {
  return type === 'dp' ? 'DP' : type === 'partial' ? 'Cicilan' : 'Lunas';
}

/** Label tampilan: "DP Transfer", "Cicilan KES", "Lunas Transfer", dll. */
export function getProofDisplayLabel(p: PaymentProofItem): string {
  const typeLabel = getProofTypeLabel(p.payment_type || '');
  const channel = p.payment_location === 'saudi' ? 'KES' : 'Transfer';
  return `${typeLabel} ${channel}`;
}

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const formatTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

const transferTimeFromNotes = (notes: string | null | undefined): string => {
  if (!notes) return '';
  const m = String(notes).match(/jam\s+transfer(?:\s+pada\s+bukti)?\s*:\s*([0-2]\d:[0-5]\d(?::[0-5]\d)?)/i);
  return m?.[1] || '';
};

/** Alokasi saldo akun ke invoice (bukan file bukti transfer). */
export type BalanceAllocationItem = {
  id: string;
  amount?: number | string;
  notes?: string | null;
  created_at?: string | null;
};

export interface PaymentProofCellProps {
  /** Daftar bukti pembayaran (PaymentProofs dari invoice). */
  paymentProofs: PaymentProofItem[] | null | undefined;
  /** Alokasi dari saldo akun (BalanceAllocations dari API). */
  balanceAllocations?: BalanceAllocationItem[] | null | undefined;
  /** Untuk tampilan detailed: konversi IDR ke SAR/USD. Jika tidak diisi, SAR/USD pakai amount/4200 dan amount/15800. */
  currencyRates?: { SAR_TO_IDR?: number; USD_TO_IDR?: number };
  /** true = hanya badge (DP ✓ / Cicilan ...). false = kartu lengkap per bukti. */
  compact?: boolean;
  /** true = tampil "Tidak tersedia (belum diterbitkan)" untuk invoice draft. */
  isDraft?: boolean;
  className?: string;
}

export function PaymentProofCell({
  paymentProofs,
  balanceAllocations,
  currencyRates,
  compact = false,
  isDraft = false,
  className = '',
}: PaymentProofCellProps) {
  const list = paymentProofs || [];
  const allocs = balanceAllocations || [];
  const sarToIdr = currencyRates?.SAR_TO_IDR ?? 4200;
  const usdToIdr = currencyRates?.USD_TO_IDR ?? 15800;

  if (isDraft) {
    return <span className={`text-slate-400 text-xs ${className}`}>Tidak tersedia (belum diterbitkan)</span>;
  }
  if (list.length === 0 && allocs.length === 0) {
    return <span className={`text-slate-400 text-xs ${className}`}>–</span>;
  }

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {list.map((p) => {
          const ps = getProofStatus(p);
          return (
            <Badge key={p.id} variant={ps.variant} className="text-xs">
              {getProofTypeLabel(p.payment_type || '')} {ps.status === 'verified' ? '✓' : ps.status === 'rejected' ? '✗' : '...'}
            </Badge>
          );
        })}
        {allocs.map((b) => (
          <Badge key={b.id} variant="success" className="text-xs">
            Saldo ✓
          </Badge>
        ))}
      </div>
    );
  }

  /** Blok status menggantikan Badge inline-flex agar tidak meluber ke kolom lain di sel sempit */
  const StatusBlock = ({ variant, children }: { variant: 'error' | 'success' | 'warning'; children: React.ReactNode }) => {
    const cls =
      variant === 'success'
        ? 'bg-emerald-100 text-emerald-800'
        : variant === 'error'
          ? 'bg-red-100 text-red-800'
          : 'bg-amber-100 text-amber-900';
    return (
      <div className={`rounded-lg px-1.5 py-1 text-[10px] font-semibold leading-snug break-words max-w-full min-w-0 [overflow-wrap:anywhere] ${cls}`}>
        {children}
      </div>
    );
  };

  const cellBase = 'px-1.5 py-1.5 align-top break-words min-w-0 max-w-0';

  return (
    <div className={`max-h-[300px] overflow-y-auto overflow-x-hidden min-w-0 w-full max-w-full ${className}`}>
      <table className="w-full max-w-full table-fixed text-[11px] border border-slate-200 rounded-lg overflow-hidden border-collapse">
        <colgroup>
          <col style={{ width: '10%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '36%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '24%' }} />
        </colgroup>
        <thead>
          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <th className={`${cellBase} text-left font-semibold`}>Tipe</th>
            <th className={`${cellBase} text-left font-semibold`}>Nominal</th>
            <th className={`${cellBase} text-left font-semibold`}>Rekening / keterangan</th>
            <th className={`${cellBase} text-left font-semibold`}>Transfer</th>
            <th className={`${cellBase} text-left font-semibold`}>Status</th>
          </tr>
        </thead>
        <tbody className="text-slate-700">
          {list.map((p) => {
            const ps = getProofStatus(p);
            const amt = parseFloat(String(p.amount || 0));
            const sar = amt / sarToIdr;
            const usd = amt / usdToIdr;
            const isKesNominal = p.payment_location === 'saudi' && p.amount_original != null && p.payment_currency && p.payment_currency !== 'IDR';
            const statusLabel = ps.status === 'verified' ? 'Sudah konfirmasi' : ps.status === 'rejected' ? 'Ditolak' : 'Belum konfirmasi';
            const senderBank = p.Bank?.name || p.bank_name;
            const senderName = p.sender_account_name;
            const senderNo = p.sender_account_number;
            const rec = p.RecipientAccount;
            const hasSender = !!(senderBank || senderName || senderNo);
            const hasRec = !!(rec?.bank_name || rec?.account_number || rec?.name || (!rec && (p.bank_name || p.account_number)));
            const rekLines =
              p.payment_location === 'saudi'
                ? (
                    <div className="space-y-0.5">
                      <div><span className="text-slate-500">Pengirim:</span> Bagian Keuangan Kantor KSA</div>
                      <div><span className="text-slate-500">Penerima:</span> Pembayaran KES</div>
                    </div>
                  )
                : (hasSender || hasRec)
                  ? (
                      <div className="space-y-0.5">
                        {hasSender && <div><span className="text-slate-500">Pengirim:</span> {[senderBank, senderName, senderNo].filter(Boolean).join(' · ')}</div>}
                        {hasRec && (
                          <div>
                            <span className="text-slate-500">Penerima:</span>{' '}
                            {rec ? [rec.bank_name, rec.account_number, rec.name ? `A.n. ${rec.name}` : ''].filter(Boolean).join(' · ') : [p.bank_name, p.account_number].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    )
                  : (
                    <span className="text-slate-400">–</span>
                    );
            return (
              <tr key={p.id} className="border-b border-slate-100 align-top">
                <td className={`${cellBase} font-semibold text-slate-800`}>{getProofDisplayLabel(p)}</td>
                <td className={cellBase}>
                  {isKesNominal ? (
                    <div className="space-y-0.5">
                      <div>
                        {p.payment_currency === 'SAR' ? <NominalDisplay amount={Number(p.amount_original)} currency="SAR" /> : <NominalDisplay amount={Number(p.amount_original)} currency="USD" />}
                      </div>
                      <div className="text-slate-600">= <NominalDisplay amount={amt} currency="IDR" /></div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <div><NominalDisplay amount={amt} currency="IDR" /></div>
                      <div className="text-slate-500 text-[10px]">
                        SAR <NominalDisplay amount={sar} currency="SAR" showCurrency={false} /> · USD <NominalDisplay amount={usd} currency="USD" showCurrency={false} />
                      </div>
                    </div>
                  )}
                </td>
                <td className={`${cellBase} text-slate-700 [overflow-wrap:anywhere]`}>{rekLines}</td>
                <td className={`${cellBase} text-slate-600 text-[10px] leading-snug whitespace-normal`}>
                  {p.transfer_date ? (
                    <div className="space-y-0.5">
                      <div>{formatDate(p.transfer_date)}</div>
                      <div className="text-slate-500">{transferTimeFromNotes(p.notes) || formatTime(p.transfer_date) || '-'}</div>
                    </div>
                  ) : (
                    '–'
                  )}
                </td>
                <td className={`${cellBase} overflow-hidden`}>
                  <div className="flex flex-col gap-1 min-w-0 max-w-full">
                    <StatusBlock variant={ps.variant}>{statusLabel}</StatusBlock>
                    {ps.status === 'verified' && p.VerifiedBy?.name && (
                      <span className="text-slate-500 break-words text-[10px] leading-snug block [overflow-wrap:anywhere]">
                        oleh {p.VerifiedBy.name}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {allocs.map((b) => {
            const amt = parseFloat(String(b.amount || 0));
            const sar = amt / sarToIdr;
            const usd = amt / usdToIdr;
            return (
              <tr key={b.id} className="border-b border-emerald-100 bg-emerald-50/40 align-top">
                <td className={`${cellBase} font-semibold text-emerald-900`}>Saldo akun</td>
                <td className={cellBase}>
                  <div className="space-y-0.5">
                    <div><NominalDisplay amount={amt} currency="IDR" /></div>
                    <div className="text-slate-500 text-[10px]">
                      SAR <NominalDisplay amount={sar} currency="SAR" showCurrency={false} /> · USD <NominalDisplay amount={usd} currency="USD" showCurrency={false} />
                    </div>
                  </div>
                </td>
                <td className={`${cellBase} [overflow-wrap:anywhere]`}>
                  <div className="space-y-0.5">
                    <div>Potongan saldo pemilik order (tanpa file bukti).</div>
                    {b.notes ? <div className="text-slate-600"><span className="text-slate-500">Cat:</span> {b.notes}</div> : null}
                  </div>
                </td>
                <td className={`${cellBase} text-slate-600 text-[10px] leading-snug whitespace-normal`}>
                  {b.created_at ? (
                    <div className="space-y-0.5">
                      <div>{formatDate(b.created_at)}</div>
                      <div className="text-slate-500">{formatTime(b.created_at)}</div>
                    </div>
                  ) : (
                    '–'
                  )}
                </td>
                <td className={`${cellBase} overflow-hidden`}>
                  <StatusBlock variant="success">Tercatat otomatis</StatusBlock>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PaymentProofCell;
