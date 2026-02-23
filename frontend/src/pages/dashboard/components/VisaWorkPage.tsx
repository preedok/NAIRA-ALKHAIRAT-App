import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, RefreshCw, Eye, Download, ClipboardList } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { visaApi } from '../../../services/api';
import type { VisaDashboardData } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { API_BASE_URL } from '../../../utils/constants';

const UPLOAD_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const STATUS_OPTIONS = [
  { value: 'document_received', label: 'Dokumen Diterima' },
  { value: 'submitted', label: 'Terkirim (Nusuk)' },
  { value: 'in_process', label: 'Dalam Proses' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'issued', label: 'Visa Terbit' }
];

const RECAP_STATUS_LABELS: Record<string, string> = {
  document_received: 'Dok. Diterima',
  submitted: 'Terkirim',
  in_process: 'Proses',
  approved: 'Disetujui',
  issued: 'Terbit'
};

const VisaWorkPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice');
  const { showToast } = useToast();

  const [dashboard, setDashboard] = useState<VisaDashboardData | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadSetIssued, setUploadSetIssued] = useState<Record<string, boolean>>({});

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await visaApi.getDashboard();
      if (res.data.success && res.data.data) setDashboard(res.data.data);
    } catch {
      setDashboard(null);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await visaApi.listInvoices({});
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
      visaApi.getInvoice(invoiceIdParam)
        .then((res: any) => res.data.success && setDetailInvoice(res.data.data))
        .catch(() => setDetailInvoice(null));
    } else {
      setDetailInvoice(null);
    }
  }, [invoiceIdParam]);

  const handleUpdateProgress = async (orderItemId: string, payload: { status?: string; notes?: string }) => {
    setUpdatingId(orderItemId);
    try {
      await visaApi.updateItemProgress(orderItemId, payload);
      if (detailInvoice?.id) {
        const res = await visaApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUploadVisa = async (orderItemId: string, file: File) => {
    if (!file) {
      showToast('Pilih file visa', 'error');
      return;
    }
    setUploadingId(orderItemId);
    try {
      const formData = new FormData();
      formData.append('visa_file', file);
      await visaApi.uploadVisa(orderItemId, formData, uploadSetIssued[orderItemId]);
      showToast('Dokumen visa berhasil diupload.', 'success');
      if (detailInvoice?.id) {
        const res = await visaApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal upload visa', 'error');
    } finally {
      setUploadingId(null);
    }
  };

  const visaItems = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'visa') || [];

  const fileUrl = (path: string | undefined) => path ? (path.startsWith('http') ? path : `${UPLOAD_BASE}${path}`) : null;

  const byStatus = dashboard?.by_status || {};
  const totalInvoices = dashboard?.total_invoices ?? 0;
  const totalItems = dashboard?.total_visa_items ?? 0;
  const hasVisaInvoices = invoices.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visa – Penerbitan & Dokumen (Nusuk)</h1>
          <p className="text-slate-600 text-sm mt-1">Data order yang sudah punya invoice (tagihan). Proses penerbitan visa, update status, dan upload dokumen visa terbit. Owner dapat mengunduh dokumen terbit di menu Invoice.</p>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />
      </div>

      {/* Rekap statistik pekerjaan visa – selalu tampil */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <ClipboardList className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Invoice</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{loading ? '–' : totalInvoices}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Total Item Visa</div>
          <div className="text-2xl font-bold text-slate-900">{loading ? '–' : totalItems}</div>
        </Card>
        {STATUS_OPTIONS.map((opt) => (
          <Card key={opt.value} className="p-4">
            <div className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">{RECAP_STATUS_LABELS[opt.value] || opt.label}</div>
            <div className="text-xl font-bold text-slate-800">{loading ? '–' : (byStatus[opt.value] ?? 0)}</div>
          </Card>
        ))}
      </div>

      {/* Tabel invoice visa – hanya tampil jika ada invoice dengan item visa */}
      <Card>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : !hasVisaInvoices ? (
          <div className="py-12 text-center text-slate-500">Belum ada invoice dengan item visa di wilayah/cabang Anda. Buat order & invoice dari menu Order/Invoice terlebih dahulu.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4">Invoice</th>
                  <th className="text-left py-3 px-4">Order</th>
                  <th className="text-left py-3 px-4">Owner</th>
                  <th className="text-right py-3 px-4">Item Visa</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const o = inv.Order;
                  if (!o) return null;
                  const visaCount = (o.OrderItems || []).filter((i: any) => i.type === 'visa').length;
                  const firstStatus = (o.OrderItems || []).find((i: any) => i.type === 'visa')?.VisaProgress?.status || 'document_received';
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">{inv.invoice_number ?? '–'}</td>
                      <td className="py-3 px-4 font-medium">{o.order_number}</td>
                      <td className="py-3 px-4">{inv.User?.name ?? o.User?.name}</td>
                      <td className="py-3 px-4 text-right">{visaCount}</td>
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
              <h2 className="text-xl font-bold text-slate-900">Invoice {detailInvoice.invoice_number}</h2>
              <button className="p-2 hover:bg-slate-100 rounded-lg" onClick={() => setSearchParams({})}>×</button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Order: <span className="font-mono font-medium">{detailInvoice.Order?.order_number}</span> · Owner: {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name}</p>
            <div className="space-y-4">
              {visaItems.map((item: any) => {
                const prog = item.VisaProgress;
                const status = prog?.status || 'document_received';
                const manifestLink = fileUrl(item.manifest_file_url);
                const visaDocLink = fileUrl(prog?.visa_file_url);
                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-xl space-y-3">
                    <p className="font-semibold">Item Visa · Qty: {item.quantity}</p>

                    {/* Data jamaah (ZIP atau link Google Drive) dari owner/invoice untuk proses penerbitan di Nusuk */}
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
                        <span className="text-sm text-slate-600">Manifest visa jamaah (legacy):</span>
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
                      <label className="block text-xs text-slate-500 mb-1">Dokumen visa jamaah (upload)</label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept=".pdf,.xlsx,.xls,.doc,.docx,image/*"
                          className="text-sm"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadVisa(item.id, f);
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
                      {prog?.visa_file_url && (
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={visaDocLink!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Download className="w-4 h-4" /> Unduh dokumen visa
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

export default VisaWorkPage;
