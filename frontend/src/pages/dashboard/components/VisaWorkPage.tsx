import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, RefreshCw, Eye, Download, ClipboardList, Inbox, Send, Loader2, Check, CheckCircle, Search, User, MapPin, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { visaApi } from '../../../services/api';
import type { VisaDashboardData } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { API_BASE_URL, INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { formatInvoiceDisplay } from '../../../utils';

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

const STATUS_ICONS: Record<string, React.ReactNode> = {
  document_received: <Inbox className="h-5 w-5" />,
  submitted: <Send className="h-5 w-5" />,
  in_process: <Loader2 className="h-5 w-5" />,
  approved: <Check className="h-5 w-5" />,
  issued: <CheckCircle className="h-5 w-5" />
};

const STATUS_CARD_COLORS: Record<string, string> = {
  document_received: 'bg-sky-100 text-sky-600',
  submitted: 'bg-violet-100 text-violet-600',
  in_process: 'bg-amber-100 text-amber-600',
  approved: 'bg-teal-100 text-teal-600',
  issued: 'bg-emerald-100 text-emerald-600'
};

const VisaWorkPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice');
  const qParam = searchParams.get('q');
  const { showToast } = useToast();

  const [dashboard, setDashboard] = useState<VisaDashboardData | null>(null);
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
      const res = await visaApi.getDashboard();
      if (res.data.success && res.data.data) setDashboard(res.data.data);
    } catch {
      setDashboard(null);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const params = filterInvoiceStatus ? { status: filterInvoiceStatus } : {};
      const res = await visaApi.listInvoices(params);
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
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (qParam && qParam.trim()) setFilterSearch(qParam.trim());
  }, [qParam]);

  useEffect(() => {
    if (invoiceIdParam) {
      visaApi.getInvoice(invoiceIdParam)
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
        return orderItems.some((i: any) => (i.VisaProgress?.status || 'document_received') === filterProgressStatus);
      });
    }
    return list;
  }, [invoices, filterSearch, filterProgressStatus]);

  const hasVisaInvoices = filteredInvoices.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-sky-100 rounded-2xl shadow-sm shrink-0">
            <FileText className="w-8 h-8 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Progress Visa</h1>
            <p className="text-slate-600 text-sm mt-1 max-w-xl">Kelola invoice berisi item visa: update status penerbitan (Nusuk) dan upload dokumen visa terbit. Owner dapat mengunduh dokumen di menu Invoice.</p>
          </div>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />
      </div>

      {/* Stat cards */}
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
              <div className="p-3 rounded-xl bg-sky-100 text-sky-600 shrink-0">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Item Visa</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900 mt-0.5">{loading ? '–' : totalItems}</p>
              </div>
            </div>
          </Card>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Per Status Progress</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {STATUS_OPTIONS.map((opt) => (
              <Card key={opt.value} className="p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 bg-white">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl shrink-0 ${STATUS_CARD_COLORS[opt.value] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_ICONS[opt.value] || <FileText className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">{RECAP_STATUS_LABELS[opt.value] || opt.label}</p>
                    <p className="text-2xl font-bold tabular-nums text-slate-900 mt-0.5">{loading ? '–' : (byStatus[opt.value] ?? 0)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Filter */}
      <Card className="p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end flex-wrap">
          <div className="flex-1 min-w-0 sm:min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Cari (invoice / order / owner / cabang)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Ketik untuk filter..." className="w-full text-sm border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white" />
            </div>
          </div>
          <div className="sm:w-44">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Status Invoice</label>
            <select value={filterInvoiceStatus} onChange={(e) => setFilterInvoiceStatus(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-sky-500 bg-white">
              <option value="">Semua status</option>
              {Object.entries(INVOICE_STATUS_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
          <div className="sm:w-44">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Status Progress</label>
            <select value={filterProgressStatus} onChange={(e) => setFilterProgressStatus(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-sky-500 bg-white">
              <option value="">Semua progress</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setFilterInvoiceStatus(''); setFilterProgressStatus(''); setFilterSearch(''); }} className="rounded-xl">Reset</Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <h2 className="text-lg font-semibold text-slate-900">Daftar Invoice Visa</h2>
          <p className="text-sm text-slate-500 mt-0.5">{filteredInvoices.length} invoice</p>
        </div>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : !hasVisaInvoices ? (
          <div className="py-16 text-center">
            <div className="p-5 rounded-2xl bg-slate-100 w-fit mx-auto mb-4">
              <FileText className="w-14 h-14 text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold">Belum ada invoice dengan item visa</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Buat order & invoice dari menu Invoice terlebih dahulu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4">No. Invoice</th>
                  <th className="text-left py-3 px-4">Owner</th>
                  <th className="text-right py-3 px-4">Item Visa</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4 sticky right-0 z-10 bg-slate-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv: any) => {
                  const o = inv.Order;
                  const orderItems = o?.OrderItems || [];
                  const visaCount = orderItems.filter((i: any) => i.type === 'visa').length;
                  const firstStatus = orderItems.find((i: any) => i.type === 'visa')?.VisaProgress?.status || 'document_received';
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">{formatInvoiceDisplay(inv.status, inv.invoice_number ?? '', INVOICE_STATUS_LABELS)}</td>
                      <td className="py-3 px-4 text-slate-700">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-slate-900">{visaCount}</td>
                      <td className="py-3 px-4">{STATUS_OPTIONS.find(s => s.value === firstStatus)?.label ?? firstStatus}</td>
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
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-sky-50/80 via-white to-slate-50/50">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 bg-sky-100 rounded-xl shadow-sm shrink-0">
                  <FileText className="w-6 h-6 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 truncate">
                    {formatInvoiceDisplay(detailInvoice.status, detailInvoice.invoice_number ?? '', INVOICE_STATUS_LABELS)}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name ?? '–'}
                    </span>
                    {(detailInvoice.Branch?.name || detailInvoice.Branch?.code) && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {detailInvoice.Branch?.name ?? detailInvoice.Branch?.code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setSearchParams({})} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors shrink-0" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
              {visaItems.map((item: any) => {
                const prog = item.VisaProgress;
                const status = prog?.status || 'document_received';
                const manifestLink = fileUrl(item.manifest_file_url);
                const visaDocLink = fileUrl(prog?.visa_file_url);
                const productName = (item as any).product_name || item.Product?.name || item.Product?.code || 'Visa';
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Item card header */}
                    <div className="px-5 py-4 bg-sky-50/50 border-b border-slate-100">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-100 text-sky-600 shrink-0">
                          <FileText className="w-6 h-6" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Visa</p>
                          <p className="font-bold text-slate-900">{productName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity}</p>
                        </div>
                        <span className={`ml-auto text-xs font-medium px-2.5 py-1.5 rounded-lg ${STATUS_CARD_COLORS[status] || 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_OPTIONS.find(s => s.value === status)?.label ?? status}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Data jamaah */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Inbox className="w-3.5 h-3.5 text-sky-500" /> Data Jamaah
                        </label>
                        {item.jamaah_data_type && item.jamaah_data_value ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {item.jamaah_data_type === 'link' ? (
                              <a href={item.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline rounded-lg px-3 py-2 bg-sky-50 border border-sky-100">
                                <Download className="w-4 h-4" /> Link Google Drive
                              </a>
                            ) : (
                              <a href={fileUrl(item.jamaah_data_value) ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline rounded-lg px-3 py-2 bg-sky-50 border border-sky-100">
                                <Download className="w-4 h-4" /> Unduh file ZIP
                              </a>
                            )}
                          </div>
                        ) : item.manifest_file_url ? (
                          <a href={manifestLink!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:underline">
                            <Download className="w-4 h-4" /> Unduh manifest (legacy)
                          </a>
                        ) : (
                          <p className="text-sm text-amber-600">Data jamaah belum diupload oleh owner (ZIP atau link di form invoice).</p>
                        )}
                      </div>

                      {/* Status Pekerjaan */}
                      <div className="rounded-xl border border-slate-100 bg-white p-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-sky-500" /> Status Pekerjaan
                        </label>
                        <select
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={status}
                          onChange={(e) => handleUpdateProgress(item.id, { status: e.target.value })}
                          disabled={updatingId === item.id}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Upload dokumen visa — hanya tampil ketika status Terbit */}
                      {status === 'issued' && (
                        <div className="rounded-xl border border-slate-100 bg-white p-4">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-sky-500" /> {prog?.visa_file_url ? 'Upload ulang dokumen visa' : 'Dokumen visa (upload)'}
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500 bg-white">
                              <input
                                type="file"
                                accept=".pdf,.xlsx,.xls,.doc,.docx,image/*"
                                className="sr-only"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadVisa(item.id, f);
                                  e.target.value = '';
                                }}
                                disabled={uploadingId === item.id}
                              />
                              {uploadingId === item.id ? <RefreshCw className="w-4 h-4 animate-spin text-slate-500" /> : <Download className="w-4 h-4 text-sky-500" />}
                              {uploadingId === item.id ? 'Mengunggah...' : 'Pilih file'}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={uploadSetIssued[item.id] ?? false}
                                onChange={(e) => setUploadSetIssued(prev => ({ ...prev, [item.id]: e.target.checked }))}
                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              Set status Terbit & kirim notifikasi
                            </label>
                          </div>
                          {prog?.visa_file_url && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-xs font-medium text-slate-500 mb-1">Dokumen terunggah</p>
                              <a href={visaDocLink!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:underline">
                                <Download className="w-4 h-4" /> Unduh dokumen visa
                              </a>
                            </div>
                          )}
                          {prog?.issued_at && (
                            <p className="text-xs text-slate-500 mt-2">Terbit: {new Date(prog.issued_at).toLocaleString('id-ID')}</p>
                          )}
                        </div>
                      )}

                      {updatingId === item.id && (
                        <p className="flex items-center gap-2 text-sm text-slate-500">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSearchParams({})} className="rounded-xl">
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VisaWorkPage;
