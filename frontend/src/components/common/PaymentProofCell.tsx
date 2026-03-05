/**
 * Sel tabel "Bukti Bayar" seragam di semua halaman (Invoice, Dashboard Wilayah, Accounting Aging).
 * Menampilkan daftar bukti pembayaran: tipe (DP/Cicilan/Lunas), channel (Transfer/KES), nominal, status verifikasi.
 */

import React from 'react';
import Badge from './Badge';
import { formatIDR, formatSAR, formatUSD } from '../../utils/formatters';

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

export interface PaymentProofCellProps {
  /** Daftar bukti pembayaran (PaymentProofs dari invoice). */
  paymentProofs: PaymentProofItem[] | null | undefined;
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
  currencyRates,
  compact = false,
  isDraft = false,
  className = '',
}: PaymentProofCellProps) {
  const list = paymentProofs || [];
  const sarToIdr = currencyRates?.SAR_TO_IDR ?? 4200;
  const usdToIdr = currencyRates?.USD_TO_IDR ?? 15800;

  if (isDraft) {
    return <span className={`text-slate-400 text-xs ${className}`}>Tidak tersedia (belum diterbitkan)</span>;
  }
  if (list.length === 0) {
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
      </div>
    );
  }

  return (
    <div className={`max-h-[140px] overflow-y-auto grid grid-cols-1 gap-2 min-w-[160px] pr-1 ${className}`}>
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
        return (
          <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-xs">
            <div className="font-semibold text-slate-700 truncate">{getProofDisplayLabel(p)}</div>
            <div className="text-slate-600 mt-0.5 truncate">
              {isKesNominal ? (
                <>
                  <span className="text-slate-500">Nominal:</span>{' '}
                  {p.payment_currency === 'SAR' ? formatSAR(Number(p.amount_original)) : formatUSD(Number(p.amount_original))} = {formatIDR(amt)}
                </>
              ) : (
                <>
                  <span className="text-slate-500">IDR:</span> {formatIDR(amt)} · <span className="text-slate-500">SAR:</span> {formatSAR(sar, false)} · <span className="text-slate-500">USD:</span> {formatUSD(usd, false)}
                </>
              )}
            </div>
            {p.payment_location !== 'saudi' && (hasSender || hasRec) && (
              <>
                {hasSender && (
                  <div className="text-slate-600 mt-0.5 space-y-0.5">
                    <span className="text-slate-500 font-medium">Pengirim:</span> {[senderBank, senderName, senderNo].filter(Boolean).join(' · ')}
                  </div>
                )}
                {hasRec && (
                  <div className="text-slate-600 mt-0.5 space-y-0.5">
                    <span className="text-slate-500 font-medium">Penerima:</span>{' '}
                    {rec ? [rec.bank_name, rec.account_number, rec.name ? `A.n. ${rec.name}` : ''].filter(Boolean).join(' · ') : [p.bank_name, p.account_number].filter(Boolean).join(' · ')}
                  </div>
                )}
              </>
            )}
            {p.created_at && (
              <div className="text-slate-600 mt-0.5 truncate">
                <span className="text-slate-500">Tanggal upload bukti:</span> {formatDate(p.created_at)}
                <span className="text-slate-500"> · Jam:</span> {new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Badge variant={ps.variant} className="text-xs">
                {statusLabel}
              </Badge>
              {ps.status === 'verified' && p.VerifiedBy?.name && <span className="text-slate-500 truncate">oleh {p.VerifiedBy.name}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PaymentProofCell;
