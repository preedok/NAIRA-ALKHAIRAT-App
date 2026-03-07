import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, RefreshCw, Eye, Download, ClipboardList, Inbox, Send, Loader2, Check, CheckCircle, Search, User, MapPin, Play } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBoxLg } from '../../../components/common/Modal';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { Input, Autocomplete, ContentLoading } from '../../../components/common';
import { visaApi } from '../../../services/api';
import type { VisaDashboardData } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { API_BASE_URL, INVOICE_STATUS_LABELS, AUTOCOMPLETE_FILTER } from '../../../utils/constants';
import { formatIDR } from '../../../utils';
import { formatInvoiceNumberDisplay } from '../../../utils/formatters';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import Badge from '../../../components/common/Badge';

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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [detailDraft, setDetailDraft] = useState<Record<string, { status?: string }>>({});

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
      const params: { status?: string; page?: number; limit?: number } = { page, limit };
      if (filterInvoiceStatus) params.status = filterInvoiceStatus;
      const res = await visaApi.listInvoices(params);
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
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    setPage(1);
  }, [filterInvoiceStatus]);

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
      setDetailDraft({});
    }
  }, [invoiceIdParam]);

  const visaItems = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'visa') || [];
  useEffect(() => {
    if (visaItems.length) {
      const next: Record<string, { status?: string }> = {};
      visaItems.forEach((item: any) => {
        const prog = item.VisaProgress;
        next[item.id] = { status: prog?.status || 'document_received' };
      });
      setDetailDraft(prev => ({ ...prev, ...next }));
    }
  }, [detailInvoice?.id, visaItems.map((i: any) => i.id).join(',')]);

  const handleProsesVisaItem = (itemId: string) => {
    const d = detailDraft[itemId];
    if (!d) return;
    handleUpdateProgress(itemId, { status: d.status });
  };

  const handleProsesSemua = async () => {
    for (const item of visaItems) {
      const d = detailDraft[item.id];
      if (!d) continue;
      await handleUpdateProgress(item.id, { status: d.status });
    }
  };

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
        const owner = (inv.User?.name || inv.User?.company_name || inv.Order?.User?.name || '').toLowerCase();
        const branch = (inv.Branch?.name || inv.Branch?.code || '').toLowerCase();
        return invNum.includes(q) || owner.includes(q) || branch.includes(q);
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

  const tableColumns: TableColumn[] = [
    { id: 'invoice', label: 'No. Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'company', label: 'Perusahaan', align: 'left' },
    { id: 'total', label: 'Total', align: 'right' },
    { id: 'status_invoice', label: 'Status Invoice', align: 'left' },
    { id: 'items', label: 'Item Visa', align: 'right' },
    { id: 'status', label: 'Status Progress', align: 'left' },
    { id: 'action', label: 'Aksi', align: 'left' }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Visa"
        subtitle="Kelola invoice berisi item visa: update status penerbitan (Nusuk) dan upload dokumen visa terbit. Owner dapat mengunduh dokumen di menu Invoice."
        right={<AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />}
      />

      {/* Stat cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Invoice" value={loading ? '–' : totalInvoices} iconClassName="bg-slate-100 text-slate-600" />
          <StatCard icon={<FileText className="w-5 h-5" />} label="Total Item Visa" value={loading ? '–' : totalItems} iconClassName="bg-sky-100 text-sky-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Per Status Progress</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {STATUS_OPTIONS.map((opt) => (
              <StatCard
                key={opt.value}
                icon={STATUS_ICONS[opt.value] || <FileText className="w-5 h-5" />}
                label={RECAP_STATUS_LABELS[opt.value] || opt.label}
                value={loading ? '–' : (byStatus[opt.value] ?? 0)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Filter + Table card — layout konsisten dengan halaman lain */}
      <Card className="travel-card overflow-visible">
        <CardSectionHeader
          icon={<FileText className="w-6 h-6" />}
          title="Daftar Invoice Visa"
          subtitle={pagination ? `${pagination.total} invoice` : `${filteredInvoices.length} invoice. Filter menurut status invoice & progress.`}
          className="mb-4"
        />
        <div className="mb-6 flex flex-col sm:flex-row gap-4 sm:items-end flex-wrap">
          <div className="flex-1 min-w-0 sm:min-w-[200px]">
            <Input label="Cari (invoice / order / owner / cabang)" type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Ketik untuk filter..." icon={<Search className="w-4 h-4" />} fullWidth />
          </div>
          <div className="sm:w-44">
            <Autocomplete label="Status Invoice" value={filterInvoiceStatus} onChange={setFilterInvoiceStatus} options={Object.entries(INVOICE_STATUS_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_STATUS} />
          </div>
          <div className="sm:w-44">
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
                const visaCount = orderItems.filter((i: any) => i.type === 'visa').length;
                const firstStatus = orderItems.find((i: any) => i.type === 'visa')?.VisaProgress?.status || 'document_received';
                const totalIdr = inv?.total_amount_idr != null ? parseFloat(inv.total_amount_idr) : parseFloat(inv?.total_amount || 0);
                const hasRefundCompleted = (inv.Refunds || []).some((r: any) => r.status === 'refunded');
                const statusLabel = hasRefundCompleted ? 'Sudah direfund' : (INVOICE_STATUS_LABELS[inv.status] || inv.status);
                return (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 align-top">
                      <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan showDpPayment order={o} />
                    </td>
                    <td className="px-6 py-4 text-slate-700 align-top">{inv.User?.name ?? o?.User?.name ?? '–'}</td>
                    <td className="px-6 py-4 text-slate-700 align-top text-sm">
                      <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900 align-top">{formatIDR(totalIdr)}</td>
                    <td className="px-6 py-4 align-top">
                      <Badge variant={hasRefundCompleted ? 'success' : (inv.status === 'paid' || inv.status === 'completed' ? 'success' : inv.status === 'canceled' || inv.status === 'cancelled' ? 'error' : 'warning')}>
                        {statusLabel}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold tabular-nums text-slate-900 align-top">{visaCount}</td>
                    <td className="px-6 py-4 align-top">{STATUS_OPTIONS.find(s => s.value === firstStatus)?.label ?? firstStatus}</td>
                    <td className="px-6 py-4 align-top">
                      <Button size="sm" variant="outline" onClick={() => setSearchParams({ invoice: inv.id })} className="rounded-xl">
                        <Eye className="w-4 h-4 mr-1" /> Detail
                      </Button>
                    </td>
                  </tr>
                );
              }}
              emptyMessage="Belum ada invoice dengan item visa"
              emptyDescription="Buat order & invoice dari menu Invoice terlebih dahulu."
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
              subtitle={
                <>
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 opacity-90" />
                    {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name ?? '–'}
                  </span>
                  {(detailInvoice.Branch?.name || detailInvoice.Branch?.code) && (
                    <span className="flex items-center gap-1.5 ml-3">
                      <MapPin className="w-3.5 h-3.5 opacity-90" />
                      {detailInvoice.Branch?.name ?? detailInvoice.Branch?.code}
                    </span>
                  )}
                </>
              }
              icon={<FileText className="w-5 h-5" />}
              onClose={() => setSearchParams({})}
            />
            <ModalBody className="space-y-6 bg-slate-50/30">
              {visaItems.map((item: any) => {
                const prog = item.VisaProgress;
                const d = detailDraft[item.id] ?? { status: prog?.status || 'document_received' };
                const status = d.status ?? prog?.status ?? 'document_received';
                const manifestLink = fileUrl(item.manifest_file_url);
                const visaDocLink = fileUrl(prog?.visa_file_url);
                const productName = (item as any).product_name || item.Product?.name || item.Product?.code || 'Visa';
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Item card header */}
                    <div className="px-5 py-4 bg-sky-50/50 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-100 text-sky-600 shrink-0">
                          <FileText className="w-6 h-6" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Visa</p>
                          <p className="font-bold text-slate-900">{productName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity}</p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1.5 rounded-lg ${STATUS_CARD_COLORS[status] || 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_OPTIONS.find(s => s.value === status)?.label ?? status}
                        </span>
                        <Button size="sm" variant="primary" onClick={() => handleProsesVisaItem(item.id)} disabled={updatingId === item.id}>
                          {updatingId === item.id ? (
                            <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</>
                          ) : (
                            <><Play className="w-4 h-4 mr-1.5" /> Proses</>
                          )}
                        </Button>
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
                          onChange={(e) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), status: e.target.value } }))}
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
            </ModalBody>
            <ModalFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80">
              <p className="text-sm text-slate-600">Perubahan input hanya tersimpan setelah Anda klik <strong>Proses</strong> (per item) atau <strong>Proses semua</strong> di bawah.</p>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={handleProsesSemua} disabled={!!updatingId || visaItems.length === 0}>
                  {updatingId ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : <><Play className="w-4 h-4 mr-2" /> Proses semua</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSearchParams({})} className="rounded-xl">
                  Tutup
                </Button>
              </div>
            </ModalFooter>
          </ModalBoxLg>
        )}
      </Modal>
    </div>
  );
};

export default VisaWorkPage;
