import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, FileText, Download, ClipboardList, Ticket, Clock, Inbox, Armchair, CalendarCheck, CreditCard, CheckCircle, Filter, Search, User, MapPin, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { ticketApi } from '../../../services/api';
import type { TicketDashboardData } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { API_BASE_URL, INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { formatInvoiceDisplay } from '../../../utils';

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
  pending: <Clock className="h-5 w-5" />,
  data_received: <Inbox className="h-5 w-5" />,
  seat_reserved: <Armchair className="h-5 w-5" />,
  booking: <CalendarCheck className="h-5 w-5" />,
  payment_airline: <CreditCard className="h-5 w-5" />,
  ticket_issued: <CheckCircle className="h-5 w-5" />
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
      const params = filterInvoiceStatus ? { status: filterInvoiceStatus } : {};
      const res = await ticketApi.listInvoices(params);
      if (res.data.success) setInvoices(res.data.data || []);
    } catch {
      setInvoices([]);
    }
  }, [filterInvoiceStatus]);

  const refetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchInvoices()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchInvoices]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

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
        const orderNum = (inv.Order?.order_number || '').toLowerCase();
        const owner = (inv.User?.name || inv.User?.company_name || inv.Order?.User?.name || '').toLowerCase();
        const branch = (inv.Branch?.name || inv.Branch?.code || '').toLowerCase();
        return invNum.includes(q) || orderNum.includes(q) || owner.includes(q) || branch.includes(q);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-100 rounded-2xl shadow-sm shrink-0">
            <Ticket className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tiket – Penerbitan & Dokumen</h1>
            <p className="text-slate-600 text-sm mt-1 max-w-xl">Data order yang sudah punya invoice (tagihan). Proses penerbitan tiket, update status, dan upload dokumen tiket terbit. Owner dapat mengunduh dokumen terbit di menu Invoice.</p>
          </div>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />
      </div>

      {/* Stat cards - 2 utama + status breakdown */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Invoice</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900 mt-0.5">{loading ? '–' : totalInvoices}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 shrink-0">
                <Ticket className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Item Tiket</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900 mt-0.5">{loading ? '–' : totalItems}</p>
              </div>
            </div>
          </Card>
        </div>
        {/* Status breakdown - compact row */}
        <div className="flex flex-wrap gap-3">
          {STATUS_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-200/80 bg-white shadow-sm ${RECAP_STATUS_COLORS[opt.value] ? '' : 'bg-slate-50'}`}
            >
              <div className={`p-1.5 rounded-lg shrink-0 ${RECAP_STATUS_COLORS[opt.value] || 'bg-slate-200 text-slate-600'}`}>
                {RECAP_STATUS_ICONS[opt.value] || <Ticket className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">{RECAP_STATUS_LABELS[opt.value] || opt.label}</p>
                <p className="text-lg font-bold tabular-nums text-slate-900">{loading ? '–' : (byStatus[opt.value] ?? 0)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      {!loading && invoices.length > 0 && (
        <Card className="p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Cari (Invoice / Order / Owner)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="No. invoice, order, owner..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Status Progress</label>
              <select
                value={filterProgressStatus}
                onChange={(e) => setFilterProgressStatus(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">Semua</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Tabel invoice tiket */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <div className="p-5 rounded-2xl bg-slate-100 w-fit mx-auto mb-4">
              <Ticket className="w-14 h-14 text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold">Belum ada invoice dengan item tiket</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Buat order & invoice dari menu Invoice terlebih dahulu.</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-14 text-center">
            <div className="p-4 rounded-2xl bg-slate-100 w-fit mx-auto mb-3">
              <Search className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold">Tidak ada hasil untuk filter ini</p>
            <p className="text-sm text-slate-500 mt-1">Coba ubah kata kunci atau status progress.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/95 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">No. Invoice</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Owner</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Item Tiket</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 sticky right-0 z-10 bg-slate-50/95 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] text-xs font-semibold text-slate-600 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv: any) => {
                  const o = inv.Order;
                  const orderItems = o?.OrderItems || [];
                  const ticketCount = orderItems.filter((i: any) => i.type === 'ticket').length;
                  const firstStatus = orderItems.find((i: any) => i.type === 'ticket')?.TicketProgress?.status || 'pending';
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">{formatInvoiceDisplay(inv.status, inv.invoice_number ?? '', INVOICE_STATUS_LABELS)}</td>
                      <td className="py-3 px-4 text-slate-700">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">{ticketCount}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${RECAP_STATUS_COLORS[firstStatus] || 'bg-slate-100 text-slate-600'}`}>
                          {RECAP_STATUS_ICONS[firstStatus]}
                          {STATUS_OPTIONS.find(s => s.value === firstStatus)?.label ?? firstStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                        <Button size="sm" variant="outline" onClick={() => setSearchParams({ invoice: inv.id })} className="rounded-xl">
                          <Eye className="w-4 h-4 mr-1" /> Detail
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!detailInvoice} onClose={() => setSearchParams({})}>
        {detailInvoice && (
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200/80">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-xl shadow-sm">
                  <Ticket className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{formatInvoiceDisplay(detailInvoice.status, detailInvoice.invoice_number ?? '', INVOICE_STATUS_LABELS)}</h2>
                  <p className="text-sm text-slate-600 mt-0.5">Owner: {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name}</p>
                </div>
              </div>
              <button className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-700" onClick={() => setSearchParams({})}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                              <input type="checkbox" checked={uploadSetIssued[item.id] ?? false} onChange={(e) => setUploadSetIssued(prev => ({ ...prev, [item.id]: e.target.checked }))} className="rounded border-slate-300" />
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
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TicketWorkPage;
