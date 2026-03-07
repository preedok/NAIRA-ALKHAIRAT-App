import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Unlock,
  Search,
  ChevronRight,
  FileText,
  DollarSign,
  Wallet
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl, Modal, ModalHeader, ModalBody, ModalBox, ModalBoxLg } from '../../../components/common';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import ContentLoading from '../../../components/common/ContentLoading';
import Table from '../../../components/common/Table';
import { InvoiceStatusRefundCell } from '../../../components/common/InvoiceStatusRefundCell';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { PaymentProofCell } from '../../../components/common/PaymentProofCell';
import { formatIDR, formatSAR, formatUSD } from '../../../utils';
import type { TableColumn } from '../../../types';
import { INVOICE_STATUS_LABELS, INVOICE_TABLE_COLUMN_PROOF } from '../../../utils/constants';
import { invoicesApi, businessRulesApi } from '../../../services/api';
import type { InvoicesSummaryData } from '../../../services/api';

const formatDate = (d: string | null | undefined) => {
  if (!d) return '–';
  try {
    const date = new Date(d);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '–';
  }
};

const formatDateWithTime = (d: string | null | undefined, time: string | null | undefined) => {
  const dateStr = formatDate(d ?? null);
  if (dateStr === '–') return '–';
  const t = (time || '').trim();
  return t ? `${dateStr}, ${t}` : `${dateStr}, –`;
};

const BUS_TRIP_LABELS: Record<string, string> = { one_way: 'Pergi saja', return_only: 'Pulang saja', round_trip: 'Pulang pergi' };

const isDraftRow = (inv: any) => inv?.status === 'draft' || inv?.is_draft_order;

const InvoiceDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<InvoicesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [statModal, setStatModal] = useState<'pending_verification' | 'verified_today' | 'total_invoice' | 'blocked' | 'total_tagihan' | 'dibayar' | 'sisa' | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, sumRes] = await Promise.all([
        invoicesApi.list({ limit: 50, page: 1, sort_by: 'created_at', sort_order: 'desc' }),
        invoicesApi.getSummary({})
      ]);
      if (invRes.data.success) setInvoices(invRes.data.data || []);
      if (sumRes.data?.success && sumRes.data.data) setSummary(sumRes.data.data);
    } catch {
      setInvoices([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    businessRulesApi.get({}).then((res) => {
      if (res.data?.data?.currency_rates) {
        const cr = res.data.data.currency_rates;
        setCurrencyRates(typeof cr === 'string' ? JSON.parse(cr) : cr);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pendingVerification = invoices.filter(
    (inv) => inv.PaymentProofs?.length > 0 && inv.PaymentProofs.some((p: any) => !p.verified_at)
  );
  const blockedInvoices = invoices.filter((inv) => inv.is_blocked);
  const today = new Date().toISOString().slice(0, 10);
  const verifiedToday = invoices.filter((inv) =>
    inv.PaymentProofs?.some((p: any) => p.verified_at && String(p.verified_at).slice(0, 10) === today)
  );
  const verifiedTodayAmount = verifiedToday.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0);

  const filteredRecent = searchQuery.trim()
    ? invoices.filter((inv) => {
        const q = searchQuery.trim().toLowerCase();
        const invNum = (inv.invoice_number ?? '').toLowerCase();
        const owner = (inv.User?.name ?? inv.Order?.User?.name ?? '').toLowerCase();
        const branch = (inv.Branch?.name ?? inv.Branch?.code ?? '').toLowerCase();
        return invNum.includes(q) || owner.includes(q) || branch.includes(q);
      })
    : invoices;
  const totalFiltered = filteredRecent.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
  const pagedInvoices = filteredRecent.slice((page - 1) * limit, page * limit);

  const sarToIdrList = currencyRates.SAR_TO_IDR || 4200;
  const usdToIdrList = currencyRates.USD_TO_IDR || 15500;
  const amountTriple = (idr: number) => ({ idr, sar: idr / sarToIdrList, usd: idr / usdToIdrList });
  const invoiceTotalTriple = (inv: any) => {
    const idr = inv?.total_amount_idr != null ? parseFloat(inv.total_amount_idr) : parseFloat(inv?.total_amount || 0);
    return { idr, sar: idr / sarToIdrList, usd: idr / usdToIdrList };
  };
  const invoiceTableColumns: TableColumn[] = [
    { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'company_wilayah', label: 'Perusahaan', align: 'left' },
    { id: 'total', label: 'Total (IDR·SAR·USD)', align: 'right' },
    { id: 'paid', label: 'Status · Dibayar (IDR·SAR·USD)', align: 'right' },
    { id: 'remaining', label: 'Sisa (IDR·SAR·USD)', align: 'right' },
    { id: 'status_visa', label: 'Status Visa', align: 'left' },
    { id: 'status_ticket', label: 'Status Tiket', align: 'left' },
    { id: 'status_hotel', label: 'Status Hotel', align: 'left' },
    { id: 'status_bus', label: 'Status Bus', align: 'left' },
    { id: 'status_handling', label: 'Status Handling', align: 'left' },
    { id: 'status_package', label: 'Status Paket', align: 'left' },
    INVOICE_TABLE_COLUMN_PROOF,
    { id: 'date', label: 'Tgl', align: 'left' },
    { id: 'actions', label: 'Aksi', align: 'center' }
  ];

  const handleUnblock = async (invoiceId: string) => {
    try {
      await invoicesApi.unblock(invoiceId);
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal unblock');
    }
  };

  const openInvoice = (inv: any) => {
    navigate(`/dashboard/orders-invoices?tab=invoices&invoice_id=${inv.id}`);
  };

  const scopeLabel = user?.role === 'invoice_saudi' ? 'Semua wilayah' : 'Cabang Anda';

  const invoiceSubtitle = user?.role === 'invoice_saudi'
    ? 'Semua invoice seluruh wilayah. Input pembayaran SAR/USD/IDR + upload bukti bayar; sistem update sisa tagihan otomatis.'
    : `Rekapitulasi pekerjaan invoice ${scopeLabel.toLowerCase()}.`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoice Dashboard"
        subtitle={invoiceSubtitle}
        right={
          <>
            <AutoRefreshControl onRefresh={fetchData} disabled={loading} size="sm" />
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>
              <Receipt className="w-4 h-4 mr-2" />
              Semua Invoice
            </Button>
          </>
        }
      />

      {/* Stat cards — klik untuk lihat daftar invoice sesuai statistik */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pending Verifikasi" value={pendingVerification.length} subtitle="Bukti bayar perlu diverifikasi" iconClassName="bg-amber-100 text-amber-600" onClick={() => setStatModal('pending_verification')} />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Terverifikasi Hari Ini" value={`${verifiedToday.length} invoice`} subtitle={verifiedToday.length ? formatIDR(verifiedTodayAmount) : '–'} iconClassName="bg-emerald-100 text-emerald-600" onClick={() => setStatModal('verified_today')} />
        <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Invoice" value={summary?.total_invoices ?? invoices.length} subtitle={scopeLabel} iconClassName="bg-sky-100 text-sky-600" onClick={() => setStatModal('total_invoice')} />
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="Terblokir (DP Overdue)" value={blockedInvoices.length} subtitle="Bisa diaktifkan kembali" iconClassName="bg-red-100 text-red-600" onClick={() => setStatModal('blocked')} />
      </div>

      {/* Ringkasan nominal (summary) — pakai StatCard agar seragam; klik untuk detail */}
      {summary && (summary.total_amount > 0 || summary.total_remaining > 0 || summary.total_paid > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Total Tagihan"
            value={formatIDR(summary.total_amount)}
            subtitle="Total nilai semua invoice (seluruh tagihan)"
            onClick={() => setStatModal('total_tagihan')}
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Dibayar"
            value={formatIDR(summary.total_paid)}
            onClick={() => setStatModal('dibayar')}
          />
          <StatCard
            icon={<Wallet className="w-5 h-5" />}
            label="Sisa"
            value={formatIDR(summary.total_remaining)}
            subtitle="Belum dibayar (sisa tagihan)"
            onClick={() => setStatModal('sisa')}
          />
        </div>
      )}

      {/* Modal detail card statistik: daftar invoice terfilter sesuai statistik */}
      {statModal && (() => {
        const getPaid = (inv: any) => {
          const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
          return parseFloat(inv.paid_amount || 0) || paidFromProofs;
        };
        const getRemaining = (inv: any) => {
          const totalInv = parseFloat(inv.total_amount || 0);
          return Math.max(0, totalInv - getPaid(inv));
        };
        const filteredList = statModal === 'pending_verification' ? pendingVerification
          : statModal === 'verified_today' ? verifiedToday
          : statModal === 'total_invoice' ? invoices
          : statModal === 'blocked' ? blockedInvoices
          : statModal === 'dibayar' ? invoices.filter((inv) => getPaid(inv) > 0)
          : statModal === 'sisa' ? invoices.filter((inv) => getRemaining(inv) > 0)
          : invoices;
        const modalTitle = statModal === 'pending_verification' ? 'Pending Verifikasi' : statModal === 'verified_today' ? 'Terverifikasi Hari Ini' : statModal === 'total_invoice' ? 'Total Invoice' : statModal === 'blocked' ? 'Terblokir (DP Overdue)' : statModal === 'total_tagihan' ? 'Total Tagihan' : statModal === 'dibayar' ? 'Dibayar' : 'Sisa';
        const statModalColumns: TableColumn[] = [
          { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
          { id: 'owner', label: 'Owner', align: 'left' },
          { id: 'company', label: 'Perusahaan', align: 'left' },
          { id: 'total', label: 'Total', align: 'right' },
          { id: 'paid', label: 'Dibayar', align: 'right' },
          { id: 'remaining', label: 'Sisa', align: 'right' }
        ];
        return (
          <Modal open onClose={() => setStatModal(null)}>
            <ModalBoxLg>
              <ModalHeader
                title={modalTitle}
                subtitle={`${filteredList.length} invoice sesuai data statistik`}
                onClose={() => setStatModal(null)}
              />
              <ModalBody className="p-0 overflow-hidden flex flex-col min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <Table
                    columns={statModalColumns}
                    data={filteredList}
                    emptyMessage="Tidak ada invoice dalam kategori ini."
                    renderRow={(inv) => {
                      const totalInv = parseFloat(inv.total_amount || 0);
                      const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                      const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                      const remaining = Math.max(0, totalInv - paid);
                      const tRem = amountTriple(remaining);
                      const totalTriple = invoiceTotalTriple(inv);
                      return (
                        <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="py-2 px-4 font-mono text-sm"><InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} compact /></td>
                          <td className="py-2 px-4 text-slate-700 text-sm">{inv.User?.name ?? inv.User?.company_name ?? '–'}</td>
                          <td className="py-2 px-4 text-slate-600 text-sm max-w-[180px] truncate">{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</td>
                          <td className="py-2 px-4 text-right text-sm">{formatIDR(totalTriple.idr)}</td>
                          <td className="py-2 px-4 text-right text-emerald-600 text-sm">{formatIDR(paid)}</td>
                          <td className="py-2 px-4 text-right text-amber-600 font-medium text-sm">{formatIDR(remaining)}</td>
                        </tr>
                      );
                    }}
                  />
                </div>
              </ModalBody>
            </ModalBoxLg>
          </Modal>
        );
      })()}

      {/* Invoice Terbaru (wilayah) – data invoice lengkap */}
      <Card>
        <div className="p-4 border-b border-slate-100">
          <CardSectionHeader
            icon={<FileText className="w-6 h-6" />}
            title="Invoice Terbaru (wilayah)"
            subtitle="Invoice di wilayah Anda. Cari no. invoice, order, owner, atau cabang."
            right={
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari no. invoice, order, owner, cabang..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            }
            className="mb-0"
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          {loading ? (
            <ContentLoading />
          ) : (
        <Table
          columns={invoiceTableColumns}
          data={pagedInvoices}
          emptyMessage={invoices.length === 0 ? 'Belum ada invoice.' : 'Tidak ada hasil untuk pencarian ini.'}
          stickyActionsColumn
          pagination={
            totalFiltered > 0
              ? {
                  total: totalFiltered,
                  page,
                  limit,
                  totalPages,
                  onPageChange: setPage,
                  onLimitChange: (l) => { setLimit(l); setPage(1); }
                }
              : undefined
          }
          renderRow={(inv) => {
            const totalInv = parseFloat(inv.total_amount || 0);
            const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
            const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
            const remaining = Math.max(0, totalInv - paid);
            const t = amountTriple(remaining);
            const totalTriple = invoiceTotalTriple(inv);
            const labelsVisa: Record<string, string> = { document_received: 'Dokumen diterima', submitted: 'Dikirim', in_process: 'Diproses', approved: 'Disetujui', issued: 'Terbit' };
            const labelsTicket: Record<string, string> = { pending: 'Menunggu', data_received: 'Data diterima', seat_reserved: 'Kursi reserved', booking: 'Booking', payment_airline: 'Bayar maskapai', ticket_issued: 'Tiket terbit' };
            const labelsHotel: Record<string, string> = { waiting_confirmation: 'Menunggu konfirmasi', confirmed: 'Penetapan room', room_assigned: 'Pemberian nomor room', completed: 'Selesai' };
            const mealLabels: Record<string, string> = { pending: 'Menunggu', confirmed: 'Dikonfirmasi', completed: 'Selesai' };
            const labelsBus: Record<string, string> = { pending: 'Pending', issued: 'Terbit' };
            return (
              <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 font-mono font-semibold text-slate-900 align-top">
                  <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan showCancellationNote />
                </td>
                <td className="py-3 px-4 text-slate-700 align-top">{inv.User?.name || inv.User?.company_name || '–'}</td>
                <td className="py-3 px-4 text-slate-700 align-top text-sm">
                  <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                </td>
                <td className="py-3 px-4 text-right font-medium text-slate-900 align-top">
                  <div>{formatIDR(totalTriple.idr)}</div>
                  <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {formatSAR(totalTriple.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(totalTriple.usd, false)}</div>
                </td>
                <td className="py-3 px-4 text-right align-top">
                  <InvoiceStatusRefundCell inv={inv} currencyRates={currencyRates} align="right" />
                </td>
                <td className="py-3 px-4 text-right text-red-600 font-medium align-top">
                  <div>{formatIDR(remaining)}</div>
                  <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {formatSAR(t.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(t.usd, false)}</div>
                </td>
                <td className="py-3 px-4 align-top max-h-[180px] overflow-hidden">
                  {(() => {
                    const visaItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'visa');
                    if (visaItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                    return (
                      <div className="max-h-[140px] overflow-y-auto text-xs space-y-2 pr-1">
                        {visaItems.map((item: any, idx: number) => {
                          const name = item.Product?.name || item.product_name || 'Visa';
                          const statusLabel = labelsVisa[item.VisaProgress?.status] || item.VisaProgress?.status || 'Menunggu';
                          return (
                            <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 space-y-0.5">
                              <div className="flex flex-wrap items-baseline gap-1">
                                <span className="font-medium text-slate-800 truncate max-w-[140px]" title={name}>{name}:</span>
                                <span className={statusLabel === 'Terbit' ? 'text-[#0D1A63]' : 'text-slate-600'}>{statusLabel}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3 px-4 align-top max-h-[180px] overflow-hidden">
                  {(() => {
                    const ticketItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'ticket');
                    if (ticketItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                    return (
                      <div className="max-h-[140px] overflow-y-auto text-xs space-y-2 pr-1">
                        {ticketItems.map((item: any, idx: number) => {
                          const name = item.Product?.name || item.product_name || 'Tiket';
                          const statusLabel = labelsTicket[item.TicketProgress?.status] || item.TicketProgress?.status || 'Menunggu';
                          return (
                            <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 space-y-0.5">
                              <div className="flex flex-wrap items-baseline gap-1">
                                <span className="font-medium text-slate-800 truncate max-w-[140px]" title={name}>{name}:</span>
                                <span className={statusLabel === 'Tiket terbit' ? 'text-[#0D1A63]' : 'text-slate-600'}>{statusLabel}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3 px-4 align-top max-h-[180px] overflow-hidden">
                  {(() => {
                    const hotelItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'hotel');
                    if (hotelItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                    return (
                      <div className="max-h-[140px] overflow-y-auto text-xs space-y-2 pr-1">
                        {hotelItems.map((item: any, idx: number) => {
                          const name = item.Product?.name || item.product_name || 'Hotel';
                          const status = labelsHotel[item.HotelProgress?.status] || item.HotelProgress?.status || 'Menunggu konfirmasi';
                          const mealStatus = item.HotelProgress?.meal_status;
                          const mealLabel = mealStatus ? (mealLabels[mealStatus] || mealStatus) : null;
                          const checkIn = formatDateWithTime(item.HotelProgress?.check_in_date ?? item.meta?.check_in, item.HotelProgress?.check_in_time ?? item.meta?.check_in_time ?? '16:00');
                          const checkOut = formatDateWithTime(item.HotelProgress?.check_out_date ?? item.meta?.check_out, item.HotelProgress?.check_out_time ?? item.meta?.check_out_time ?? '12:00');
                          return (
                            <div key={item.id || idx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 space-y-0.5">
                              <div className="flex flex-wrap items-baseline gap-1">
                                <span className="font-medium text-slate-800 truncate max-w-[140px]" title={name}>{name}:</span>
                                <span className={status === 'Selesai' ? 'text-[#0D1A63]' : 'text-slate-600'}>{status}</span>
                              </div>
                              {mealLabel != null && <div className="text-slate-600 pl-0.5 text-xs">Status makan: {mealLabel}</div>}
                              <div className="text-slate-500 pl-0.5"><span>CI {checkIn}</span><span className="mx-1">·</span><span>CO {checkOut}</span></div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3 px-4 align-top max-h-[180px] overflow-hidden">
                  {(() => {
                    const busItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'bus');
                    if (busItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                    return (
                      <div className="max-h-[140px] overflow-y-auto text-xs space-y-2 pr-1">
                        {busItems.map((item: any, idx: number) => {
                          const name = item.Product?.name || item.product_name || 'Bus';
                          const statusLabel = labelsBus[item.BusProgress?.bus_ticket_status] || item.BusProgress?.bus_ticket_status || 'Pending';
                          const travelDate = formatDate(item.meta?.travel_date ?? null);
                          const tripTypeRaw = item.meta?.trip_type ? String(item.meta.trip_type) : '';
                          const tripTypeLabel = tripTypeRaw ? (BUS_TRIP_LABELS[tripTypeRaw] || tripTypeRaw) : '';
                          const metaLine = [travelDate ? `Tgl ${travelDate}` : null, tripTypeLabel ? tripTypeLabel : null].filter(Boolean).join(' · ');
                          return (
                            <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 space-y-0.5">
                              <div className="flex flex-wrap items-baseline gap-1">
                                <span className="font-medium text-slate-800 truncate max-w-[140px]" title={name}>{name}:</span>
                                <span className={statusLabel === 'Terbit' ? 'text-[#0D1A63]' : 'text-slate-600'}>{statusLabel}</span>
                              </div>
                              {metaLine ? <div className="text-slate-500 pl-0.5">{metaLine}</div> : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3 px-4 align-top max-h-[180px] overflow-hidden">
                  {(() => {
                    const handlingItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'handling');
                    if (handlingItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                    return (
                      <div className="max-h-[140px] overflow-y-auto text-xs space-y-2 pr-1">
                        {handlingItems.map((item: any, idx: number) => {
                          const name = item.Product?.name || item.product_name || 'Handling';
                          const qty = Math.max(0, item.quantity ?? 1);
                          return (
                            <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 space-y-0.5">
                              <div className="flex flex-wrap items-baseline gap-1">
                                <span className="font-medium text-slate-800 truncate max-w-[140px]" title={name}>{name}:</span>
                                <span className="text-slate-600">Qty {qty}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3 px-4 align-top max-h-[180px] overflow-hidden">
                  {(() => {
                    const packageItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'package');
                    if (packageItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                    return (
                      <div className="max-h-[140px] overflow-y-auto text-xs space-y-2 pr-1">
                        {packageItems.map((item: any, idx: number) => {
                          const name = item.Product?.name || item.product_name || 'Paket';
                          const qty = Math.max(0, item.quantity ?? 1);
                          return (
                            <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 space-y-0.5">
                              <div className="flex flex-wrap items-baseline gap-1">
                                <span className="font-medium text-slate-800 truncate max-w-[140px]" title={name}>{name}:</span>
                                <span className="text-slate-600">Qty {qty}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3 px-4 align-top max-h-[180px] overflow-hidden">
                  <PaymentProofCell paymentProofs={inv.PaymentProofs} currencyRates={currencyRates} isDraft={isDraftRow(inv)} />
                </td>
                <td className="py-3 px-4 text-slate-600 align-top whitespace-nowrap">{formatDate(inv.issued_at || inv.created_at)}</td>
                <td className="py-3 px-4 sticky right-0 bg-white hover:bg-slate-50/80 border-l border-slate-100">
                  <Button size="sm" variant="outline" onClick={() => openInvoice(inv)}>
                    <Eye className="w-4 h-4 mr-1" /> Buka
                  </Button>
                </td>
              </tr>
            );
          }}
        />
          )}
        </div>
        {invoices.length > 0 && (
          <div className="p-3 border-t border-slate-100 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>
              Lihat semua invoice <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </Card>

      {/* Pending Verifikasi – tampilkan data invoice (no. invoice utama) */}
      {pendingVerification.length > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Pending Verifikasi Bukti Bayar
          </h3>
          <div className="space-y-3">
            {pendingVerification.slice(0, 10).map((inv) => {
              const proof = inv.PaymentProofs?.find((p: any) => !p.verified_at);
              return (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl">
                  <div>
                    <div className="font-semibold text-slate-900">
                      <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} compact />
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {inv.User?.name ?? inv.Order?.User?.name} · Cabang: {inv.Branch?.name ?? inv.Branch?.code ?? '–'} · Total {formatIDR(inv.total_amount)}
                    </p>
                    {proof && (
                      <p className="text-xs text-slate-500 mt-1">
                        Klaim: {formatIDR(proof.amount)} · {proof.bank_name || '-'}
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => navigate('/dashboard/orders-invoices?tab=invoices')}>
                    <Eye className="w-4 h-4 mr-2" /> Verifikasi
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Invoice Terblokir – data invoice lengkap */}
      {blockedInvoices.length > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Invoice Terblokir (DP lewat waktu)
          </h3>
          <p className="text-sm text-slate-600 mb-4">Aktifkan kembali agar owner bisa upload bukti bayar.</p>
          <div className="space-y-3">
            {blockedInvoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-red-50 rounded-xl">
                <div>
                  <div className="font-semibold text-slate-900">
                    <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} compact />
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {inv.User?.name ?? inv.Order?.User?.name} · Cabang: {inv.Branch?.name ?? inv.Branch?.code ?? '–'} · {formatIDR(inv.total_amount)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleUnblock(inv.id)}>
                  <Unlock className="w-4 h-4 mr-2" /> Aktifkan Kembali
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {invoices.length === 0 && !loading && (
        <Card>
          <p className="text-slate-600 text-center py-8">Belum ada invoice. Buat order lalu buat invoice dari menu Order / Invoices.</p>
        </Card>
      )}
    </div>
  );
};

export default InvoiceDashboard;
