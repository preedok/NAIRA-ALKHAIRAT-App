import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Receipt, ExternalLink, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBoxLg } from './Modal';
import Button from './Button';
import Badge from './Badge';
import Table from './Table';
import ContentLoading from './ContentLoading';
import NominalDisplay from './NominalDisplay';
import { InvoiceNumberCell } from './InvoiceNumberCell';
import PageFilter, { FilterIconButton } from './PageFilter';
import DashboardFilterBar from './DashboardFilterBar';
import {
  getEffectiveInvoiceStatusLabel,
  getEffectiveInvoiceStatusBadgeVariant
} from './InvoiceStatusRefundCell';
import { INVOICE_STATUS_LABELS, AUTOCOMPLETE_FILTER } from '../../utils/constants';
import { useAuth } from '../../contexts/AuthContext';
import { invoicesApi, businessRulesApi, branchesApi, ownersApi } from '../../services/api';
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

/** Tanggal hari ini YYYY-MM-DD di Asia/Jakarta (selaras filter due di backend). */
function jakartaTodayYmd(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Kategori jatuh tempo DP untuk filter (current / due / overdue). */
function invoiceDueDpCategory(due: string | null | undefined): 'current' | 'due' | 'overdue' | 'none' {
  if (!due) return 'none';
  const dOnly = String(due).slice(0, 10);
  if (dOnly.length < 10) return 'none';
  const today = jakartaTodayYmd();
  if (dOnly < today) return 'overdue';
  if (dOnly > today) return 'current';
  return 'due';
}

function branchLocationIds(inv: any): { wilayah: string; provinsi: string; branch: string } {
  const b = inv?.Branch;
  const wilayah = String(b?.wilayah_id ?? b?.Provinsi?.Wilayah?.id ?? '').trim();
  const provinsi = String(b?.provinsi_id ?? b?.Provinsi?.id ?? '').trim();
  const branch = String(b?.id ?? inv?.branch_id ?? '').trim();
  return { wilayah, provinsi, branch };
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
  { id: 'hotel_qty', label: 'Detail kamar (qty)', align: 'left' },
  { id: 'actions', label: 'Aksi', align: 'center' }
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [wilayahId, setWilayahId] = useState('');
  const [provinsiId, setProvinsiId] = useState('');
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ id: string | number; name?: string; nama?: string; wilayah_id?: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; user_id?: string; User?: { id: string; name: string; company_name?: string } }[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOwnerId, setFilterOwnerId] = useState('');
  const [filterInvoiceNumber, setFilterInvoiceNumber] = useState('');
  const [filterDueStatus, setFilterDueStatus] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const isAdminPusat = user?.role === 'admin_pusat';
  const isAccounting = user?.role === 'role_accounting';
  const isInvoiceSaudi = user?.role === 'invoice_saudi';
  const showLocationFilters =
    isAdminPusat || isAccounting || isInvoiceSaudi || user?.role === 'invoice_koordinator';
  const canListOwners = showLocationFilters;

  const resetFilters = useCallback(() => {
    setBranchId('');
    setWilayahId('');
    setProvinsiId('');
    setFilterStatus('');
    setFilterOwnerId('');
    setFilterInvoiceNumber('');
    setFilterDueStatus('');
    setSortBy('created_at');
    setSortOrder('desc');
  }, []);

  const hasActiveFilters = !!(
    branchId ||
    wilayahId ||
    provinsiId ||
    filterStatus ||
    (!restrictToOwnerId && filterOwnerId) ||
    filterInvoiceNumber.trim() ||
    filterDueStatus ||
    sortBy !== 'created_at' ||
    sortOrder !== 'desc'
  );

  useEffect(() => {
    if (!open) {
      setInvoices([]);
      resetFilters();
      setShowFilters(false);
      return;
    }
    resetFilters();
  }, [open, resetFilters]);

  const load = useCallback(async () => {
    if (!open || !orderIds.length) return;
    setLoading(true);
    try {
      const [invRes, rulesRes] = await Promise.all([
        invoicesApi.list({
          order_ids: orderIds.join(','),
          limit: Math.min(500, Math.max(orderIds.length, 1)),
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
    if (!open) return;
    load();
  }, [open, load]);

  useEffect(() => {
    if (!open || !showLocationFilters) return;
    branchesApi.listWilayah().then((r) => {
      if (r.data.success) setWilayahList(r.data.data || []);
    }).catch(() => {});
    branchesApi.listProvinces().then((r) => {
      if (r.data.success) setProvinces(r.data.data || []);
    }).catch(() => {});
  }, [open, showLocationFilters]);

  const fetchBranches = useCallback(async () => {
    if (!open || !showLocationFilters) return;
    try {
      const params: { limit: number; page: number; wilayah_id?: string; provinsi_id?: string } = { limit: 500, page: 1 };
      if (wilayahId) params.wilayah_id = wilayahId;
      if (provinsiId) params.provinsi_id = provinsiId;
      const res = await branchesApi.list(params);
      if (res.data.success) setBranches(res.data.data || []);
    } catch {
      setBranches([]);
    }
  }, [open, showLocationFilters, wilayahId, provinsiId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const fetchOwners = useCallback(async () => {
    if (!open || !canListOwners) return;
    try {
      const params: { branch_id?: string; wilayah_id?: string; limit?: number } = { limit: 500 };
      if (branchId) params.branch_id = branchId;
      if (user?.role === 'invoice_koordinator' && user?.wilayah_id) params.wilayah_id = user.wilayah_id;
      const res = await ownersApi.list(params);
      if (res.data.success) setOwners(res.data.data || []);
    } catch {
      setOwners([]);
    }
  }, [open, canListOwners, branchId, user?.role, user?.wilayah_id]);

  useEffect(() => {
    if (!open) return;
    fetchOwners();
  }, [open, fetchOwners]);

  const ownerFilterOptions = useMemo(() => {
    const map = new Map<string, { id: string; name?: string; User?: { name?: string; company_name?: string } }>();
    owners.forEach((o) => {
      const userId = (o as { user_id?: string }).user_id ?? o.User?.id ?? '';
      const id = String(userId).trim();
      if (!id) return;
      const name = o.User?.name || o.User?.company_name;
      if (!map.has(id)) map.set(id, { id, name, User: o.User });
    });
    invoices.forEach((inv: any) => {
      const id = inv.owner_id || inv.User?.id || inv.Order?.User?.id;
      if (!id) return;
      const sid = String(id).trim();
      if (map.has(sid)) return;
      const name =
        (inv.User?.name ||
          inv.User?.company_name ||
          inv.Order?.User?.name ||
          inv.Order?.User?.company_name ||
          '').trim() || undefined;
      map.set(sid, {
        id: sid,
        name,
        User: { name, company_name: inv.User?.company_name || inv.Order?.User?.company_name }
      });
    });
    return Array.from(map.values()).filter((o) => Boolean(o.id));
  }, [owners, invoices]);

  const filteredInvoices = useMemo(() => {
    const ownerNeedle = restrictToOwnerId || filterOwnerId;
    const numNeedle = filterInvoiceNumber.trim().toLowerCase();

    let rows = invoices.filter((inv: any) => {
      if (filterStatus && String(inv.status || '').toLowerCase() !== String(filterStatus).toLowerCase()) {
        return false;
      }
      if (ownerNeedle && String(inv.owner_id || inv.User?.id || '').trim() !== String(ownerNeedle).trim()) {
        return false;
      }
      if (numNeedle) {
        const num = String(inv.invoice_number || '').toLowerCase();
        if (!num.includes(numNeedle)) return false;
      }
      if (filterDueStatus) {
        const cat = invoiceDueDpCategory(inv.due_date_dp);
        if (cat === 'none') return false;
        if (cat !== filterDueStatus) return false;
      }
      if (showLocationFilters) {
        const loc = branchLocationIds(inv);
        if (wilayahId && loc.wilayah !== wilayahId) return false;
        if (provinsiId && loc.provinsi !== provinsiId) return false;
        if (branchId && loc.branch !== branchId) return false;
      }
      return true;
    });

    const mul = sortOrder === 'asc' ? 1 : -1;
    rows = [...rows].sort((a: any, b: any) => {
      if (sortBy === 'invoice_number') {
        return mul * String(a.invoice_number || '').localeCompare(String(b.invoice_number || ''), 'id');
      }
      if (sortBy === 'total_amount') {
        const ta =
          a.total_amount_idr != null ? parseFloat(a.total_amount_idr) : parseFloat(a.total_amount || 0);
        const tb =
          b.total_amount_idr != null ? parseFloat(b.total_amount_idr) : parseFloat(b.total_amount || 0);
        return mul * (ta - tb);
      }
      if (sortBy === 'status') {
        return mul * String(a.status || '').localeCompare(String(b.status || ''), 'id');
      }
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return mul * (da - db);
    });

    return rows;
  }, [
    invoices,
    filterStatus,
    filterOwnerId,
    restrictToOwnerId,
    filterInvoiceNumber,
    filterDueStatus,
    wilayahId,
    provinsiId,
    branchId,
    showLocationFilters,
    sortBy,
    sortOrder
  ]);

  const openInvoiceDetail = useCallback(
    (invoiceId: string) => {
      navigate(`/dashboard/orders-invoices?invoice_id=${encodeURIComponent(invoiceId)}`);
      onClose();
    },
    [navigate, onClose]
  );

  const sarToIdr = currencyRates.SAR_TO_IDR || 4200;
  const usdToIdr = currencyRates.USD_TO_IDR || 15500;

  const subtitle = [hotelLabel, seasonName ? `Musim: ${seasonName}` : null].filter(Boolean).join(' · ');

  const tableEmptyMessage =
    filteredInvoices.length === 0 && invoices.length > 0
      ? 'Tidak ada invoice yang cocok dengan filter. Sesuaikan filter atau klik reset.'
      : 'Belum ada invoice untuk order pada tanggal ini, atau order belum diterbitkan.';

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
          <div className="shrink-0 px-4 pt-3 pb-2 flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 bg-white">
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-200 text-slate-600"
                onClick={resetFilters}
              >
                Reset filter
              </Button>
            ) : null}
            <FilterIconButton
              open={showFilters}
              onToggle={() => setShowFilters((v) => !v)}
              hasActiveFilters={hasActiveFilters}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            />
          </div>
          <PageFilter
            open={showFilters}
            onToggle={() => setShowFilters((v) => !v)}
            hasActiveFilters={hasActiveFilters}
            loading={loading}
            hideToggleRow
            className="px-4 pb-2 w-full shrink-0"
            cardTitle="Filter invoice"
            cardDescription="Status, lokasi, owner, nomor invoice, jatuh tempo, dan urutan. Data di sini difilter di perangkat Anda."
          >
            <DashboardFilterBar
              variant="modal"
              loading={loading}
              showWilayah={showLocationFilters}
              showProvinsi={showLocationFilters}
              showBranch={showLocationFilters}
              showStatus
              statusType="invoice"
              showOwner={!restrictToOwnerId}
              showSearch2
              search2Placeholder="No. Invoice..."
              search2={filterInvoiceNumber}
              onSearch2Change={setFilterInvoiceNumber}
              showDueStatus
              showSort
              hideActions
              wilayahId={wilayahId}
              provinsiId={provinsiId}
              branchId={branchId}
              status={filterStatus}
              ownerId={restrictToOwnerId ? '' : filterOwnerId}
              dueStatus={filterDueStatus}
              sortBy={sortBy}
              sortOrder={sortOrder}
              sortOptions={[
                { value: 'created_at', label: 'Tanggal dibuat' },
                { value: 'invoice_number', label: 'Nomor invoice' },
                { value: 'total_amount', label: 'Total' },
                { value: 'status', label: 'Status' }
              ]}
              onSortByChange={setSortBy}
              onSortOrderChange={setSortOrder}
              onWilayahChange={(v) => {
                setWilayahId(v);
                setProvinsiId('');
                setBranchId('');
              }}
              onProvinsiChange={(v) => {
                setProvinsiId(v);
                setBranchId('');
              }}
              onBranchChange={setBranchId}
              onStatusChange={setFilterStatus}
              onOwnerChange={setFilterOwnerId}
              onDueStatusChange={setFilterDueStatus}
              onApply={() => {}}
              wilayahList={wilayahList}
              provinces={
                wilayahId
                  ? provinces.filter((p) => String(p.wilayah_id ?? '') === String(wilayahId))
                  : provinces
              }
              branches={branches}
              branchLabel="Cabang"
              branchEmptyLabel={AUTOCOMPLETE_FILTER.SEMUA_CABANG}
              invoiceStatusOptions={[
                { value: '', label: 'Semua status' },
                ...Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))
              ]}
              owners={ownerFilterOptions}
              dueStatusOptions={[
                { value: '', label: 'Semua' },
                { value: 'current', label: 'Belum Jatuh Tempo' },
                { value: 'due', label: 'Jatuh Tempo' },
                { value: 'overdue', label: 'Terlambat' }
              ]}
            />
          </PageFilter>
          {loading ? (
            <div className="p-8">
              <ContentLoading minHeight={200} />
            </div>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <Table
                columns={columns}
                data={filteredInvoices}
                emptyMessage={tableEmptyMessage}
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
                      <td className="py-2 px-3 text-center align-middle">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-[#0D1A63]"
                          onClick={() => openInvoiceDetail(inv.id)}
                          title="Lihat detail invoice"
                        >
                          <Eye className="w-4 h-4" />
                          Detail
                        </Button>
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
              navigate('/dashboard/orders-invoices');
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
