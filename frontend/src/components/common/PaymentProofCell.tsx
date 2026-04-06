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

  return (
    <div className={`max-h-[280px] overflow-y-auto min-w-0 ${className}`}>
      <table className="w-full min-w-[760px] text-[11px] border border-slate-200 rounded-lg border-collapse table-fixed">
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '38%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <th className="px-2.5 py-2 text-left font-semibold align-top border-b border-slate-200">Tipe</th>
            <th className="px-2.5 py-2 text-left font-semibold align-top border-b border-slate-200">Nominal</th>
            <th className="px-2.5 py-2 text-left font-semibold align-top border-b border-slate-200">Rekening / keterangan</th>
            <th className="px-2.5 py-2 text-left font-semibold align-top border-b border-slate-200">Diunggah</th>
            <th className="px-2.5 py-2 text-left font-semibold align-top border-b border-slate-200">Status</th>
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
                <td className="px-2.5 py-2 font-semibold text-slate-800 align-top break-words">{getProofDisplayLabel(p)}</td>
                <td className="px-2.5 py-2 align-top break-words">
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
                <td className="px-2.5 py-2 align-top break-words text-slate-700">{rekLines}</td>
                <td className="px-2.5 py-2 text-slate-600 align-top whitespace-nowrap">
                  {p.created_at ? (
                    <>
                      {formatDate(p.created_at)}
                      <br />
                      <span className="text-slate-500">{formatTime(p.created_at)}</span>
                    </>
                  ) : (
                    '–'
                  )}
                </td>
                <td className="px-2.5 py-2 align-top">
                  <div className="flex flex-col gap-0.5 items-start break-words">
                    <Badge variant={ps.variant} className="text-xs whitespace-normal text-left max-w-full">
                      {statusLabel}
                    </Badge>
                    {ps.status === 'verified' && p.VerifiedBy?.name && (
                      <span className="text-slate-500 break-words">oleh {p.VerifiedBy.name}</span>
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
                <td className="px-2.5 py-2 font-semibold text-emerald-900 align-top break-words">Saldo akun</td>
                <td className="px-2.5 py-2 align-top break-words">
                  <div className="space-y-0.5">
                    <div><NominalDisplay amount={amt} currency="IDR" /></div>
                    <div className="text-slate-500 text-[10px]">
                      SAR <NominalDisplay amount={sar} currency="SAR" showCurrency={false} /> · USD <NominalDisplay amount={usd} currency="USD" showCurrency={false} />
                    </div>
                  </div>
                </td>
                <td className="px-2.5 py-2 align-top break-words">
                  <div className="space-y-0.5">
                    <div>Potongan saldo pemilik order (tanpa file bukti).</div>
                    {b.notes ? <div className="text-slate-600"><span className="text-slate-500">Cat:</span> {b.notes}</div> : null}
                  </div>
                </td>
                <td className="px-2.5 py-2 text-slate-600 align-top whitespace-nowrap">
                  {b.created_at ? (
                    <>
                      {formatDate(b.created_at)}
                      <br />
                      <span className="text-slate-500">{formatTime(b.created_at)}</span>
                    </>
                  ) : (
                    '–'
                  )}
                </td>
                <td className="px-2.5 py-2 align-top">
                  <Badge variant="success" className="text-xs whitespace-normal text-left">
                    Tercatat otomatis
                  </Badge>
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
