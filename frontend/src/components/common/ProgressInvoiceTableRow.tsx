/**
 * Satu baris tabel invoice untuk menu Progress (Visa, Tiket, Hotel, Bus, Handling).
 * View dan data sama dengan menu Invoice: No. Invoice, Owner, Tipe Owner, Perusahaan,
 * PIC, Total (IDR·SAR·USD), Status · Dibayar, Sisa, Status Progress, Bukti Bayar, Tgl, Aksi.
 */
import React from 'react';
import { Eye } from 'lucide-react';
import Button from './Button';
import { InvoiceNumberCell } from './InvoiceNumberCell';
import { InvoiceStatusRefundCell, getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant } from './InvoiceStatusRefundCell';
import { PaymentProofCell } from './PaymentProofCell';
import InvoiceProgressStatusCell, { type ProgressSectionKey } from './InvoiceProgressStatusCell';
import NominalDisplay from './NominalDisplay';
import { INVOICE_STATUS_LABELS } from '../../utils/constants';
import { invoiceTotalTriple, amountTriple, isCancelledNoPayment, getDisplayRemaining } from '../../utils/invoiceTableHelpers';

const isDraftRow = (inv: any) => {
  const st = (inv?.status || '').toLowerCase();
  return st === 'draft' || !!inv?.is_draft_order;
};

export interface ProgressInvoiceTableRowProps {
  inv: any;
  currencyRates: { SAR_TO_IDR?: number; USD_TO_IDR?: number };
  formatDate: (d: string | null | undefined) => string;
  formatDateWithTime?: (d: string | null | undefined, time?: string | null) => string;
  onViewDetail: (inv: any) => void;
  getStatusLabel?: (inv: any) => string;
  getStatusBadgeVariant?: (inv: any) => 'default' | 'success' | 'warning' | 'error' | 'info';
  /** Hanya tampilkan section Status Progress ini (mis. role bus: ['visa', 'bus']). */
  progressAllowedSections?: ProgressSectionKey[];
}

export function ProgressInvoiceTableRow({
  inv,
  currencyRates,
  formatDate,
  formatDateWithTime = (d, t) => (d ? `${formatDate(d ?? null)}${t ? `, ${t}` : ''}` : '–'),
  onViewDetail,
  getStatusLabel = getEffectiveInvoiceStatusLabel,
  getStatusBadgeVariant = getEffectiveInvoiceStatusBadgeVariant,
  progressAllowedSections
}: ProgressInvoiceTableRowProps) {
  const sarToIdr = currencyRates.SAR_TO_IDR ?? 4200;
  const usdToIdr = currencyRates.USD_TO_IDR ?? 15500;
  const totalTriple = invoiceTotalTriple(inv, sarToIdr, usdToIdr);
  const ownerIsMou = !!(inv?.owner_is_mou ?? inv?.User?.OwnerProfile?.is_mou_owner);
  const statusLabel = getStatusLabel(inv);
  const statusBadgeVariant = getStatusBadgeVariant(inv);

  const remaining = getDisplayRemaining(inv);
  const remainingTriple = amountTriple(remaining, sarToIdr, usdToIdr);

  return (
    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
      <td className="py-3 px-4 font-mono font-semibold text-slate-900 align-top">
        <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan showCancellationNote />
      </td>
      <td className="py-3 px-4 text-slate-700 align-top">{inv.User?.name || inv.User?.company_name || inv.Order?.User?.name || '–'}</td>
      <td className="py-3 px-4 align-top">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ownerIsMou ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
          {ownerIsMou ? 'Owner MOU' : 'Non-MOU'}
        </span>
      </td>
      <td className="py-3 px-4 text-slate-700 align-top text-sm">
        <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
        <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
      </td>
      <td className="py-3 px-4 text-slate-700 align-top text-sm">{inv.pic_name || inv.Order?.pic_name || '–'}</td>
      <td className="py-3 px-4 text-right font-medium text-slate-900 align-top">
        <div><NominalDisplay amount={totalTriple.idr} currency="IDR" /></div>
        <div className="text-xs text-slate-500 mt-0.5">
          <span className="text-slate-400">SAR:</span> <NominalDisplay amount={totalTriple.sar} currency="SAR" showCurrency={false} />
          <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={totalTriple.usd} currency="USD" showCurrency={false} />
        </div>
      </td>
      <td className="py-3 px-4 text-right align-top">
        <InvoiceStatusRefundCell inv={inv} currencyRates={currencyRates} align="right" />
      </td>
      <td className="py-3 px-4 text-right text-red-600 font-medium align-top">
        <div><NominalDisplay amount={remainingTriple.idr} currency="IDR" /></div>
        <div className="text-xs text-slate-500 mt-0.5">
          <span className="text-slate-400">SAR:</span> <NominalDisplay amount={remainingTriple.sar} currency="SAR" showCurrency={false} />
          <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={remainingTriple.usd} currency="USD" showCurrency={false} />
        </div>
      </td>
      <td className="py-3 px-4 align-top min-w-[280px] max-w-[380px]">
        <InvoiceProgressStatusCell
          inv={inv}
          formatDate={formatDate}
          formatDateWithTime={formatDateWithTime}
          allowedSections={progressAllowedSections}
          layout="table"
        />
      </td>
      <td className="py-3 px-4 align-top min-w-[260px] max-w-[400px] max-h-[260px] overflow-y-auto">
        <PaymentProofCell paymentProofs={inv.PaymentProofs || []} balanceAllocations={inv.BalanceAllocations} currencyRates={currencyRates} isDraft={isDraftRow(inv)} />
      </td>
      <td className="py-3 px-4 text-slate-600 align-top whitespace-nowrap">{formatDate(inv.issued_at || inv.created_at)}</td>
      <td className="py-3 px-4 sticky right-0 bg-white hover:bg-slate-50/80 border-l border-slate-100 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
        <div className="flex justify-center">
          <Button size="sm" variant="outline" onClick={() => onViewDetail(inv)} className="rounded-xl">
            <Eye className="w-4 h-4 mr-1" /> Detail
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default ProgressInvoiceTableRow;
