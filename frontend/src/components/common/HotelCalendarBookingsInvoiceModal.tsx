import React, { useEffect, useState, useCallback } from 'react';
import { Receipt, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBoxLg } from './Modal';
import Button from './Button';
import Badge from './Badge';
import Table from './Table';
import ContentLoading from './ContentLoading';
import NominalDisplay from './NominalDisplay';
import { InvoiceNumberCell } from './InvoiceNumberCell';
import {
  getEffectiveInvoiceStatusLabel,
  getEffectiveInvoiceStatusBadgeVariant
} from './InvoiceStatusRefundCell';
import { INVOICE_STATUS_LABELS } from '../../utils/constants';
import { invoicesApi, businessRulesApi } from '../../services/api';
import {
  invoiceTotalTriple,
  getDisplayRemaining,
  isCancelledNoPayment
} from '../../utils/invoiceTableHelpers';
import type { TableColumn } from '../../types';

const ROOM_LABELS: Record<string, string> = {
  single: 'Single',
  double: 'Double',
  triple: 'Triple',
  quad: 'Quad',
  quint: 'Quint'
};

/** Waktu sekarang di WIB (selaras backend hotelAvailabilityService). */
function getJakartaYmdAndMinutesFromMidnight(): { ymd: string; minutesFromMidnight: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  const h = parseInt(get('hour'), 10) || 0;
  const m = parseInt(get('minute'), 10) || 0;
  return { ymd, minutesFromMidnight: h * 60 + m };
}

/**
 * Item hotel “aktif” pada sel tanggal dateStr: malam menginap seperti biasa,
 * plus tanggal checkout sampai jam 12:00 WIB (setelah itu tidak ditampilkan di sel itu).
 */
function hotelItemForCalendarDate(item: any, hotelProductId: string, dateStr: string): boolean {
  if ((item?.type || '').toLowerCase() !== 'hotel') return false;
  if (String(item?.product_ref_id || '') !== String(hotelProductId)) return false;
  const meta = item?.meta || {};
  const prog = item?.HotelProgress || {};
  const ci = String(prog.check_in_date || meta.check_in || '')
    .slice(0, 10)
    .trim();
  const co = String(prog.check_out_date || meta.check_out || '')
    .slice(0, 10)
    .trim();
  if (!ci || !co) return true;
  if (ci <= dateStr && co > dateStr) return true;
  if (co === dateStr) {
    const { ymd, minutesFromMidnight } = getJakartaYmdAndMinutesFromMidnight();
    if (ymd < dateStr) return true;
    if (ymd > dateStr) return false;
    return minutesFromMidnight < 12 * 60;
  }
  return false;
}

function formatShortYmd(ymd: string): string {
  if (!ymd || ymd.length < 10) return ymd;
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface HotelCalendarBookingsInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  zIndex?: number;
  dateStr: string;
  seasonName?: string;
  hotelProductId: string;
  hotelLabel?: string;
  orderIds: string[];
  /** Jika diisi (mis. owner): hanya tampilkan baris invoice milik user ini. */
  restrictToOwnerId?: string;
}

const columns: TableColumn[] = [
  { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
  { id: 'owner', label: 'Owner', align: 'left' },
  { id: 'status', label: 'Status', align: 'left' },
  { id: 'total', label: 'Total', align: 'right' },
  { id: 'paid', label: 'Dibayar', align: 'right' },
  { id: 'remaining', label: 'Sisa', align: 'right' },
  { id: 'hotel_qty', label: 'Detail kamar (qty)', align: 'left' }
];

const HotelCalendarBookingsInvoiceModal: React.FC<HotelCalendarBookingsInvoiceModalProps> = ({
  open,
  onClose,
  zIndex = 55,
  dateStr,
  seasonName,
  hotelProductId,
  hotelLabel,
  orderIds,
  restrictToOwnerId
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});

  const load = useCallback(async () => {
    if (!open || !orderIds.length) return;
    setLoading(true);
    try {
      const [invRes, rulesRes] = await Promise.all([
        invoicesApi.list({
          order_ids: orderIds.join(','),
          limit: Math.min(100, Math.max(orderIds.length, 1)),
          page: 1
        }),
        businessRulesApi.get({}).catch(() => null)
      ]);
      if (invRes.data?.success) {
        let rows = invRes.data.data;
        rows = Array.isArray(rows) ? rows : [];
        if (restrictToOwnerId) {
          rows = rows.filter((inv: any) => String(inv.owner_id || '') === String(restrictToOwnerId));
        }
        setInvoices(rows);
      } else {
        setInvoices([]);
      }
      if (rulesRes?.data?.data?.currency_rates) {
        const cr = rulesRes.data.data.currency_rates;
        setCurrencyRates(typeof cr === 'string' ? JSON.parse(cr) : cr);
      }
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [open, orderIds, restrictToOwnerId]);

  useEffect(() => {
    if (!open) {
      setInvoices([]);
      return;
    }
    load();
  }, [open, load]);

  const sarToIdr = currencyRates.SAR_TO_IDR || 4200;
  const usdToIdr = currencyRates.USD_TO_IDR || 15500;

  const subtitle = [hotelLabel, seasonName ? `Musim: ${seasonName}` : null].filter(Boolean).join(' · ');

  return (
    <Modal open={open} onClose={onClose} zIndex={zIndex}>
      <ModalBoxLg className="max-w-[min(96vw,1200px)]">
        <ModalHeader
          icon={<Receipt className="w-5 h-5" />}
          title={`Invoice · ${dateStr}`}
          subtitle={subtitle || 'Data invoice order pada tanggal kalender ini'}
          onClose={onClose}
        />
        <ModalBody className="p-0 overflow-hidden flex flex-col min-h-0 max-h-[min(70vh,640px)]">
          {loading ? (
            <div className="p-8">
              <ContentLoading minHeight={200} />
            </div>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <Table
                columns={columns}
                data={invoices}
                emptyMessage="Belum ada invoice untuk order pada tanggal ini, atau order belum diterbitkan."
                renderRow={(inv: any) => {
                  const paidFromProofs = (inv.PaymentProofs || [])
                    .filter(
                      (p: any) =>
                        p.payment_location === 'saudi' ||
                        p.verified_status === 'verified' ||
                        (p.verified_at && p.verified_status !== 'rejected')
                    )
                    .reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                  const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                  const remaining = getDisplayRemaining(inv);
                  const totalTriple = invoiceTotalTriple(inv, sarToIdr, usdToIdr);
                  const items = (inv.Order?.OrderItems || []) as any[];
                  const hotelLines = items.filter((it) => hotelItemForCalendarDate(it, hotelProductId, dateStr));
                  const statusLabel = getEffectiveInvoiceStatusLabel(inv);
                  const statusVariant = getEffectiveInvoiceStatusBadgeVariant(inv);

                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 align-top">
                      <td className="py-2 px-3 font-mono text-sm">
                        <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan compact />
                      </td>
                      <td className="py-2 px-3 text-slate-700 text-sm">
                        {inv.User?.name || inv.User?.company_name || inv.owner_name_manual || inv.Order?.owner_name_manual || '—'}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={statusVariant} size="sm">
                          {statusLabel}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-sm">
                        {isCancelledNoPayment(inv) ? (
                          '—'
                        ) : (
                          <>
                            <NominalDisplay amount={totalTriple.idr} currency="IDR" />
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              ≈ <NominalDisplay amount={totalTriple.sar} currency="SAR" showCurrency={false} /> · ≈{' '}
                              <NominalDisplay amount={totalTriple.usd} currency="USD" showCurrency={false} />
                            </div>
                          </>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-600 text-sm">
                        <NominalDisplay amount={paid} currency="IDR" />
                      </td>
                      <td className="py-2 px-3 text-right text-amber-600 font-medium text-sm">
                        <NominalDisplay amount={remaining} currency="IDR" />
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-700 max-w-[280px]">
                        {hotelLines.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <ul className="space-y-1 list-disc list-inside">
                            {hotelLines.map((it) => {
                              const meta = it.meta || {};
                              const rt = (meta.room_type || '—') as string;
                              const label = ROOM_LABELS[rt.toLowerCase()] || rt;
                              const q = it.quantity ?? 0;
                              const ci = String(meta.check_in || it.HotelProgress?.check_in_date || '').slice(0, 10);
                              const co = String(meta.check_out || it.HotelProgress?.check_out_date || '').slice(0, 10);
                              return (
                                <li key={it.id}>
                                  <span className="font-medium">{label}</span>: qty <strong>{q}</strong>
                                  {ci && co ? (
                                    <span className="text-slate-500">
                                      {' '}
                                      · in {formatShortYmd(ci)} → {formatShortYmd(co)}
                                    </span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                }}
              />
            </div>
          )}
        </ModalBody>
        <ModalFooter className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              navigate('/dashboard/orders-invoices?tab=invoices');
              onClose();
            }}
          >
            <ExternalLink className="w-4 h-4" />
            Menu Invoice
          </Button>
          <Button type="button" variant="primary" onClick={onClose}>
            Tutup
          </Button>
        </ModalFooter>
      </ModalBoxLg>
    </Modal>
  );
};

export default HotelCalendarBookingsInvoiceModal;
