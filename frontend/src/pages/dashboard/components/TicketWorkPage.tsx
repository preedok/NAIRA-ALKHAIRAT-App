import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, FileText, Download, ClipboardList, Ticket, Clock, Inbox, Armchair, CalendarCheck, CreditCard, CheckCircle } from 'lucide-react';
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
  const { showToast } = useToast();

  const [dashboard, setDashboard] = useState<TicketDashboardData | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadSetIssued, setUploadSetIssued] = useState<Record<string, boolean>>({});

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
      const res = await ticketApi.listInvoices({});
      if (res.data.success) setInvoices(res.data.data || []);
    } catch {
      setInvoices([]);
    }
  }, []);

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
        .then((res: any) => res.data.success && setDetailInvoice(res.data.data))
        .catch(() => setDetailInvoice(null));
    } else {
      setDetailInvoice(null);
    }
  }, [invoiceIdParam]);

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
  const hasTicketInvoices = invoices.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tiket – Penerbitan & Dokumen</h1>
          <p className="text-slate-600 text-sm mt-1">Data order yang sudah punya invoice (tagihan). Proses penerbitan tiket, update status, dan upload dokumen tiket terbit. Owner dapat mengunduh dokumen terbit di menu Invoice.</p>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />
      </div>

      {/* Rekap statistik pekerjaan tiket */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <Card hover className="travel-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-600">Total Invoice</p>
              <p className="text-xl font-bold tabular-nums text-stone-900">{loading ? '–' : totalInvoices}</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Ticket className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-600">Item Tiket</p>
              <p className="text-xl font-bold tabular-nums text-stone-900">{loading ? '–' : totalItems}</p>
            </div>
          </div>
        </Card>
        {STATUS_OPTIONS.map((opt) => (
          <Card key={opt.value} hover className="travel-card">
            <div className="flex items-center gap-3 p-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${RECAP_STATUS_COLORS[opt.value] || 'bg-slate-100 text-slate-600'}`}>
                {RECAP_STATUS_ICONS[opt.value] || <Ticket className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-stone-600">{RECAP_STATUS_LABELS[opt.value] || opt.label}</p>
                <p className="text-xl font-bold tabular-nums text-stone-900">{loading ? '–' : (byStatus[opt.value] ?? 0)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabel invoice tiket – hanya tampil jika ada invoice dengan item tiket */}
      <Card>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : !hasTicketInvoices ? (
          <div className="py-12 text-center text-slate-500">Belum ada invoice dengan item tiket di cabang Anda. Buat order & invoice dari menu Order/Invoice terlebih dahulu.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4">No. Invoice</th>
                  <th className="text-left py-3 px-4">Owner</th>
                  <th className="text-right py-3 px-4">Item Tiket</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const o = inv.Order;
                  const orderItems = o?.OrderItems || [];
                  const ticketCount = orderItems.filter((i: any) => i.type === 'ticket').length;
                  const firstStatus = orderItems.find((i: any) => i.type === 'ticket')?.TicketProgress?.status || 'pending';
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">{formatInvoiceDisplay(inv.status, inv.invoice_number ?? '', INVOICE_STATUS_LABELS)}</td>
                      <td className="py-3 px-4">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                      <td className="py-3 px-4 text-right">{ticketCount}</td>
                      <td className="py-3 px-4">{STATUS_OPTIONS.find(s => s.value === firstStatus)?.label ?? firstStatus}</td>
                      <td className="py-3 px-4">
                        <Button size="sm" variant="outline" onClick={() => setSearchParams({ invoice: inv.id })}>
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
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900">{formatInvoiceDisplay(detailInvoice.status, detailInvoice.invoice_number ?? '', INVOICE_STATUS_LABELS)}</h2>
              <button className="p-2 hover:bg-slate-100 rounded-lg" onClick={() => setSearchParams({})}>×</button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Owner: {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name}</p>
            <div className="space-y-4">
              {ticketItems.map((item: any) => {
                const prog = item.TicketProgress;
                const status = prog?.status || 'pending';
                const manifestLink = fileUrl(item.manifest_file_url);
                const ticketLink = fileUrl(prog?.ticket_file_url);
                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl space-y-3">
                    <p className="font-semibold">Item Tiket · Qty: {item.quantity}</p>

                    {/* Data jamaah (ZIP atau link Google Drive) dari owner/invoice untuk proses penerbitan */}
                    {item.jamaah_data_type && item.jamaah_data_value ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-sm text-slate-600">Data jamaah (dari owner/invoice):</span>
                        {item.jamaah_data_type === 'link' ? (
                          <a
                            href={item.jamaah_data_value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            <Download className="w-4 h-4" /> Link Google Drive
                          </a>
                        ) : (
                          <a
                            href={fileUrl(item.jamaah_data_value) ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            <Download className="w-4 h-4" /> Unduh file ZIP
                          </a>
                        )}
                      </div>
                    ) : item.manifest_file_url ? (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">Manifest jamaah (legacy):</span>
                        <a href={manifestLink!} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Unduh manifest</a>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-600">Data jamaah belum diupload oleh owner/invoice (ZIP atau link Google Drive di form invoice).</p>
                    )}

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Status Pekerjaan</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        value={status}
                        onChange={(e) => handleUpdateProgress(item.id, { status: e.target.value })}
                        disabled={updatingId === item.id}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Dokumen tiket jamaah (upload)</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept=".pdf,.xlsx,.xls,.doc,.docx,image/*"
                          className="text-sm"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadTicket(item.id, f);
                            e.target.value = '';
                          }}
                          disabled={uploadingId === item.id}
                        />
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={uploadSetIssued[item.id] ?? false}
                            onChange={(e) => setUploadSetIssued(prev => ({ ...prev, [item.id]: e.target.checked }))}
                          />
                          Set status Terbit & kirim notifikasi
                        </label>
                      </div>
                      {uploadingId === item.id && <span className="text-xs text-slate-500">Uploading...</span>}
                      {prog?.ticket_file_url && (
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={ticketLink!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Download className="w-4 h-4" /> Unduh dokumen tiket
                          </a>
                        </div>
                      )}
                    </div>

                    {prog?.issued_at && (
                      <p className="text-xs text-slate-500">Terbit: {new Date(prog.issued_at).toLocaleString('id-ID')}</p>
                    )}
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
