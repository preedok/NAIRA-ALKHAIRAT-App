import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, FileText, Download, ClipboardList, Ticket, Clock, Inbox, Armchair, CalendarCheck, CreditCard, CheckCircle, Search, User, MapPin } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Checkbox from '../../../components/common/Checkbox';
import Modal, { ModalHeader, ModalBody, ModalBoxLg } from '../../../components/common/Modal';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { Input, Autocomplete, CardSectionHeader, ContentLoading } from '../../../components/common';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import { ticketApi } from '../../../services/api';
import type { TicketDashboardData } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { API_BASE_URL, INVOICE_STATUS_LABELS, AUTOCOMPLETE_FILTER } from '../../../utils/constants';
import { formatInvoiceNumberDisplay, formatIDR } from '../../../utils';
import Badge from '../../../components/common/Badge';

const UPLOAD_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'data_received', label: 'Data Diterima' },
  { value: 'seat_reserved', label: 'Kursi Direservasi' },
  { value: 'booking', label: 'Booking' },
  { value: 'payment_airline', label: 'Pembayaran Maskapai' },
  { value: 'ticket_issued', label: 'Tiket Terbit' }
];

const RECAP_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  data_received: 'Data Diterima',
  seat_reserved: 'Kursi Reserved',
  booking: 'Booking',
  payment_airline: 'Bayar Maskapai',
  ticket_issued: 'Terbit'
};

const RECAP_STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-5 h-5" />,
  data_received: <Inbox className="w-5 h-5" />,
  seat_reserved: <Armchair className="w-5 h-5" />,
  booking: <CalendarCheck className="w-5 h-5" />,
  payment_airline: <CreditCard className="w-5 h-5" />,
  ticket_issued: <CheckCircle className="w-5 h-5" />
};

const RECAP_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-600',
  data_received: 'bg-sky-100 text-sky-600',
  seat_reserved: 'bg-violet-100 text-violet-600',
  booking: 'bg-teal-100 text-teal-600',
  payment_airline: 'bg-orange-100 text-orange-600',
  ticket_issued: 'bg-emerald-100 text-emerald-600'
};

const TicketWorkPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice');
  const qParam = searchParams.get('q');
  const { showToast } = useToast();

  const [dashboard, setDashboard] = useState<TicketDashboardData | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadSetIssued, setUploadSetIssued] = useState<Record<string, boolean>>({});
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<string>('');
  const [filterProgressStatus, setFilterProgressStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>(() => qParam || '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await ticketApi.getDashboard();
      if (res.data.success && res.data.data) setDashboard(res.data.data);
    } catch {
      setDashboard(null);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const params: { status?: string; page?: number; limit?: number } = { page, limit };
      if (filterInvoiceStatus) params.status = filterInvoiceStatus;
      const res = await ticketApi.listInvoices(params);
      if (res.data.success) {
        setInvoices(res.data.data || []);
        const pag = (res.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(pag || null);
      }
    } catch {
      setInvoices([]);
      setPagination(null);
    }
  }, [filterInvoiceStatus, page, limit]);

  const refetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchInvoices()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchInvoices]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  useEffect(() => {
    setPage(1);
  }, [filterInvoiceStatus]);

  useEffect(() => {
    if (invoiceIdParam) {
      ticketApi.getInvoice(invoiceIdParam)
        .then((res: any) => {
          if (res.data.success && res.data.data) {
            setDetailInvoice(res.data.data);
            const invNum = res.data.data.invoice_number;
            if (invNum) setFilterSearch(invNum);
          }
        })
        .catch(() => setDetailInvoice(null));
    } else {
      setDetailInvoice(null);
    }
  }, [invoiceIdParam]);

  useEffect(() => {
    if (qParam && qParam.trim()) setFilterSearch(qParam.trim());
  }, [qParam]);

  const handleUpdateProgress = async (orderItemId: string, payload: { status?: string; notes?: string }) => {
    setUpdatingId(orderItemId);
    try {
      await ticketApi.updateItemProgress(orderItemId, payload);
      if (detailInvoice?.id) {
        const res = await ticketApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUploadTicket = async (orderItemId: string, file: File) => {
    if (!file) {
      showToast('Pilih file tiket', 'error');
      return;
    }
    setUploadingId(orderItemId);
    try {
      const formData = new FormData();
      formData.append('ticket_file', file);
      await ticketApi.uploadTicket(orderItemId, formData, uploadSetIssued[orderItemId]);
      showToast('Dokumen tiket berhasil diupload.', 'success');
      if (detailInvoice?.id) {
        const res = await ticketApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal upload tiket', 'error');
    } finally {
      setUploadingId(null);
    }
  };

  const ticketItems = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'ticket') || [];

  const fileUrl = (path: string | undefined) => path ? (path.startsWith('http') ? path : `${UPLOAD_BASE}${path}`) : null;

  const byStatus = dashboard?.by_status || {};
  const totalInvoices = dashboard?.total_invoices ?? 0;
  const totalItems = dashboard?.total_ticket_items ?? 0;

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    const q = (filterSearch || '').trim().toLowerCase();
    if (q) {
      list = list.filter((inv: any) => {
        const invNum = (inv.invoice_number || '').toLowerCase();
        const owner = (inv.User?.name || inv.User?.company_name || inv.Order?.User?.name || '').toLowerCase();
        const branch = (inv.Branch?.name || inv.Branch?.code || '').toLowerCase();
        return invNum.includes(q) || owner.includes(q) || branch.includes(q);
      });
    }
    if (filterProgressStatus) {
      list = list.filter((inv: any) => {
        const orderItems = inv.Order?.OrderItems || [];
        return orderItems.some((i: any) => (i.TicketProgress?.status || 'pending') === filterProgressStatus);
      });
    }
    return list;
  }, [invoices, filterSearch, filterProgressStatus]);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '–';
    try {
      return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '–';
    }
  };
  const isNewInvoice = (inv: any) => {
    if (!inv) return false;
    const at = inv.issued_at || inv.created_at;
    if (!at) return false;
    return Date.now() - new Date(at).getTime() < 24 * 60 * 60 * 1000;
  };
  const getOrderChangeDate = (inv: any) => {
    const at = inv?.order_updated_at ?? inv?.Order?.order_updated_at ?? null;
    return at ? new Date(at) : null;
  };

  const tableColumns: TableColumn[] = [
    { id: 'invoice', label: 'No. Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'company', label: 'Perusahaan', align: 'left' },
    { id: 'total', label: 'Total', align: 'right' },
    { id: 'status_invoice', label: 'Status Invoice', align: 'left' },
    { id: 'items', label: 'Item Tiket', align: 'right' },
    { id: 'status', label: 'Status Progress', align: 'left' },
    { id: 'action', label: 'Aksi', align: 'left' }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tiket – Penerbitan & Dokumen"
        subtitle="Data order yang sudah punya invoice (tagihan). Proses penerbitan tiket, update status, dan upload dokumen tiket terbit. Owner dapat mengunduh dokumen terbit di menu Invoice."
        right={<AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />}
      />

      {/* Stat cards - 2 utama + status breakdown */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Invoice" value={loading ? '–' : totalInvoices} iconClassName="bg-slate-100 text-slate-600" />
          <StatCard icon={<Ticket className="w-5 h-5" />} label="Item Tiket" value={loading ? '–' : totalItems} iconClassName="bg-emerald-100 text-emerald-600" />
        </div>
        {/* Status breakdown — pakai StatCard agar seragam */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {STATUS_OPTIONS.map((opt) => (
            <StatCard
              key={opt.value}
              icon={RECAP_STATUS_ICONS[opt.value] || <Ticket className="w-5 h-5" />}
              label={RECAP_STATUS_LABELS[opt.value] || opt.label}
              value={loading ? '–' : (byStatus[opt.value] ?? 0)}
            />
          ))}
        </div>
      </div>

      {/* Filter + Table card — layout konsisten dengan halaman lain */}
      <Card className="travel-card overflow-visible">
        <CardSectionHeader icon={<Ticket className="w-6 h-6" />} title="Daftar Invoice Tiket" subtitle="Invoice dengan item tiket. Filter menurut status invoice & progress." className="mb-4" />
        <div className="mb-6 flex flex-col sm:flex-row gap-4 sm:items-end flex-wrap">
          <div className="flex-1 min-w-0 sm:min-w-[200px]">
            <Input label="Cari (Invoice / Order / Owner)" type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="No. invoice, order, owner..." icon={<Search className="w-4 h-4" />} fullWidth />
          </div>
          <div className="sm:w-48">
            <Autocomplete label="Status Invoice" value={filterInvoiceStatus} onChange={setFilterInvoiceStatus} options={Object.entries(INVOICE_STATUS_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_STATUS} />
          </div>
          <div className="sm:w-48">
            <Autocomplete label="Status Progress" value={filterProgressStatus} onChange={setFilterProgressStatus} options={STATUS_OPTIONS} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_PROGRESS} />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          {loading ? (
            <ContentLoading />
          ) : (
            <Table
              columns={tableColumns}
              data={filteredInvoices}
              renderRow={(inv: any) => {
                const o = inv.Order;
                const orderItems = o?.OrderItems || [];
                const ticketCount = orderItems.filter((i: any) => i.type === 'ticket').length;
                const firstStatus = orderItems.find((i: any) => i.type === 'ticket')?.TicketProgress?.status || 'pending';
                const totalIdr = inv?.total_amount_idr != null ? parseFloat(inv.total_amount_idr) : parseFloat(inv?.total_amount || 0);
                const statusLabel = INVOICE_STATUS_LABELS[inv.status] || inv.status;
                return (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono font-semibold text-slate-800">{formatInvoiceNumberDisplay(inv, INVOICE_STATUS_LABELS)}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isNewInvoice(inv) && <Badge variant="success" className="text-xs">Baru</Badge>}
                          {getOrderChangeDate(inv) && (
                            <span className="text-xs text-slate-600">Perubahan {formatDate(getOrderChangeDate(inv)!.toISOString())}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 align-top">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                    <td className="px-6 py-4 text-slate-700 align-top text-sm">
                      <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900 align-top">{formatIDR(totalIdr)}</td>
                    <td className="px-6 py-4 align-top">
                      <Badge variant={inv.status === 'paid' || inv.status === 'completed' ? 'success' : inv.status === 'canceled' || inv.status === 'cancelled' ? 'error' : 'warning'}>
                        {statusLabel}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-800 align-top">{ticketCount}</td>
                    <td className="px-6 py-4 align-top">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${RECAP_STATUS_COLORS[firstStatus] || 'bg-slate-100 text-slate-600'}`}>
                        {RECAP_STATUS_ICONS[firstStatus]}
                        {STATUS_OPTIONS.find(s => s.value === firstStatus)?.label ?? firstStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <Button size="sm" variant="outline" onClick={() => setSearchParams({ invoice: inv.id })} className="rounded-xl">
                        <Eye className="w-4 h-4 mr-1" /> Detail
                      </Button>
                    </td>
                  </tr>
                );
              }}
              emptyMessage={invoices.length === 0 ? 'Belum ada invoice dengan item tiket' : 'Tidak ada hasil untuk filter ini'}
              emptyDescription={invoices.length === 0 ? 'Buat order & invoice dari menu Invoice terlebih dahulu.' : 'Coba ubah kata kunci atau status progress.'}
              stickyActionsColumn
              pagination={pagination ? {
                total: pagination.total,
                page: pagination.page,
                limit: pagination.limit,
                totalPages: pagination.totalPages,
                onPageChange: (p) => setPage(p),
                onLimitChange: (l) => { setLimit(l); setPage(1); }
              } : undefined}
            />
          )}
        </div>
      </Card>

      <Modal open={!!detailInvoice} onClose={() => setSearchParams({})}>
        {detailInvoice && (
          <ModalBoxLg>
            <ModalHeader
              title={formatInvoiceNumberDisplay(detailInvoice, INVOICE_STATUS_LABELS)}
              subtitle={`Owner: ${detailInvoice.User?.name ?? detailInvoice.Order?.User?.name ?? '–'}`}
              icon={<Ticket className="w-5 h-5" />}
              onClose={() => setSearchParams({})}
            />
            <ModalBody className="space-y-5">
              {ticketItems.map((item: any) => {
                const prog = item.TicketProgress;
                const status = prog?.status || 'pending';
                const manifestLink = fileUrl(item.manifest_file_url);
                const ticketLink = fileUrl(prog?.ticket_file_url);
                const productName = item.Product?.name || (item as any).product_name;
                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Card header */}
                    <div className="flex items-center justify-between gap-3 px-5 py-4 bg-slate-50/80 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
                          <Ticket className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{productName || 'Item Tiket'} · Qty {item.quantity}</p>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium mt-1 ${RECAP_STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
                            {RECAP_STATUS_ICONS[status]}
                            {STATUS_OPTIONS.find(s => s.value === status)?.label ?? status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* Data jamaah */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> Data Jamaah
                        </p>
                        {item.jamaah_data_type && item.jamaah_data_value ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {item.jamaah_data_type === 'link' ? (
                              <a href={item.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5 font-medium">
                                <Download className="w-4 h-4" /> Buka link
                              </a>
                            ) : (
                              <a href={fileUrl(item.jamaah_data_value) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5 font-medium">
                                <Download className="w-4 h-4" /> Unduh file ZIP
                              </a>
                            )}
                          </div>
                        ) : item.manifest_file_url ? (
                          <a href={manifestLink!} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5 font-medium">
                            <Download className="w-4 h-4" /> Unduh manifest
                          </a>
                        ) : (
                          <p className="text-sm text-amber-600 flex items-center gap-2">
                            <FileText className="w-4 h-4 shrink-0" />
                            Data jamaah belum diupload oleh owner/invoice (ZIP atau link di form Invoice).
                          </p>
                        )}
                      </div>

                      {/* Status progress */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Status Pekerjaan</label>
                        <select
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                          value={status}
                          onChange={(e) => handleUpdateProgress(item.id, { status: e.target.value })}
                          disabled={updatingId === item.id}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Upload dokumen tiket terbit */}
                      {status === 'ticket_issued' && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" /> Upload Dokumen Tiket Terbit
                          </p>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <input
                              type="file"
                              accept=".pdf,.xlsx,.xls,.doc,.docx,image/*"
                              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadTicket(item.id, f);
                                e.target.value = '';
                              }}
                              disabled={uploadingId === item.id}
                            />
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer shrink-0">
                              <Checkbox checked={uploadSetIssued[item.id] ?? false} onChange={(e) => setUploadSetIssued(prev => ({ ...prev, [item.id]: e.target.checked }))} />
                              Set Terbit & notifikasi
                            </label>
                          </div>
                          {uploadingId === item.id && <span className="text-xs text-slate-500">Mengunggah…</span>}
                          {prog?.ticket_file_url && (
                            <a href={ticketLink!} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline inline-flex items-center gap-1.5 font-medium">
                              <Download className="w-4 h-4" /> Unduh dokumen tiket
                            </a>
                          )}
                        </div>
                      )}

                      {prog?.issued_at && (
                        <p className="text-xs text-slate-500">Terbit: {new Date(prog.issued_at).toLocaleString('id-ID')}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </ModalBody>
          </ModalBoxLg>
        )}
      </Modal>
    </div>
  );
};

export default TicketWorkPage;
