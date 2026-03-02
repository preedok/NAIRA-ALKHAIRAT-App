import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, RefreshCw, ArrowRightLeft, CheckCircle, AlertCircle, List, Trash2, X, Banknote, Download, Eye, Filter, Search, FileText, Check, Link2, Lock
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal, { ModalHeader, ModalBody, ModalBox, ModalBoxLg } from '../../../components/common/Modal';
import Table from '../../../components/common/Table';
import TablePagination from '../../../components/common/TablePagination';
import type { TableColumn } from '../../../types';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import Input from '../../../components/common/Input';
import { accountingApi } from '../../../services/api';
import type {
  BankStatementUploadItem,
  BankStatementReconciliationData,
  BankStatementLineItem,
  BankStatementUploadWithLines,
  SystemTransactionItem
} from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { formatIDR } from '../../../utils';

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';

const RekeningKoranPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [uploads, setUploads] = useState<BankStatementUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [recon, setRecon] = useState<BankStatementReconciliationData | null>(null);
  const [reconId, setReconId] = useState<string | null>(null);
  const [loadingRecon, setLoadingRecon] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exportingReconId, setExportingReconId] = useState<string | null>(null);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);
  const [downloadingOriginalId, setDownloadingOriginalId] = useState<string | null>(null);
  const [detailUpload, setDetailUpload] = useState<BankStatementUploadWithLines | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterPeriodFrom, setFilterPeriodFrom] = useState('');
  const [filterPeriodTo, setFilterPeriodTo] = useState('');
  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState(25);
  const [reconPdfUrl, setReconPdfUrl] = useState<string | null>(null);
  const [approvingLineId, setApprovingLineId] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [manualMapLineId, setManualMapLineId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.bankStatements.list();
      if (res.data.success && res.data.data) setUploads(res.data.data);
      else setUploads([]);
    } catch {
      setUploads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    setListPage(1);
  }, [filterName, filterPeriodFrom, filterPeriodTo]);

  useEffect(() => {
    if (!reconId) {
      setRecon(null);
      if (reconPdfUrl) {
        URL.revokeObjectURL(reconPdfUrl);
        setReconPdfUrl(null);
      }
      return;
    }
    setLoadingRecon(true);
    accountingApi.bankStatements
      .getReconciliation(reconId)
      .then(async (res) => {
        if (res.data.success && res.data.data) {
          setRecon(res.data.data);
          const data = res.data.data;
          const upload = data.upload as BankStatementReconciliationData['upload'];
          const isPdf = (upload?.file_name || '').toLowerCase().endsWith('.pdf');
          if (upload?.original_file_path && isPdf) {
            try {
              const fileRes = await accountingApi.bankStatements.getOriginalFile(reconId, true);
              const blob = fileRes.data instanceof Blob ? fileRes.data : new Blob([fileRes.data]);
              const url = URL.createObjectURL(blob);
              setReconPdfUrl(url);
            } catch {
              setReconPdfUrl(null);
            }
          } else {
            setReconPdfUrl(null);
          }
        } else {
          setRecon(null);
        }
      })
      .catch(() => setRecon(null))
      .finally(() => setLoadingRecon(false));
  }, [reconId]);

  useEffect(() => {
    return () => {
      if (reconPdfUrl) URL.revokeObjectURL(reconPdfUrl);
    };
  }, [reconPdfUrl]);

  const filteredUploads = useMemo(() => {
    let list = uploads;
    const q = (filterName || '').trim().toLowerCase();
    if (q) {
      list = list.filter((u) => (u.name || u.file_name || '').toLowerCase().includes(q));
    }
    if (filterPeriodFrom) {
      list = list.filter((u) => u.period_to && u.period_to >= filterPeriodFrom);
    }
    if (filterPeriodTo) {
      list = list.filter((u) => u.period_from && u.period_from <= filterPeriodTo);
    }
    return list;
  }, [uploads, filterName, filterPeriodFrom, filterPeriodTo]);

  const paginatedUploads = useMemo(() => {
    const start = (listPage - 1) * listLimit;
    return filteredUploads.slice(start, start + listLimit);
  }, [filteredUploads, listPage, listLimit]);
  const totalFiltered = filteredUploads.length;

  const totalLines = useMemo(() => uploads.reduce((s, u) => s + (u.line_count ?? 0), 0), [uploads]);

  const handleUpload = async () => {
    if (!file) {
      showToast('Pilih file Excel (.xlsx / .xls) terlebih dahulu', 'error');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (uploadName.trim()) form.append('name', uploadName.trim());
      if (periodFrom) form.append('period_from', periodFrom);
      if (periodTo) form.append('period_to', periodTo);
      const res = await accountingApi.bankStatements.upload(form);
      if (res.data.success) {
        showToast(res.data.message || 'Rekening koran berhasil diunggah', 'success');
        setFile(null);
        setUploadName('');
        setPeriodFrom('');
        setPeriodTo('');
        fetchList();
      }
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal mengunggah file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus data rekening koran ini? Baris transaksi juga akan terhapus.')) return;
    setDeletingId(id);
    try {
      await accountingApi.bankStatements.delete(id);
      showToast('Rekening koran telah dihapus', 'success');
      if (reconId === id) setReconId(null);
      if (detailUpload?.id === id) setDetailUpload(null);
      fetchList();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menghapus', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await accountingApi.bankStatements.downloadTemplate();
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Rekening_Koran_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      showToast('Template Excel berhasil diunduh', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal mengunduh template', 'error');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleExportReconciliation = async (id: string) => {
    setExportingReconId(id);
    try {
      const res = await accountingApi.bankStatements.exportReconciliation(id);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekonsiliasi_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      showToast('Export rekonsiliasi berhasil diunduh', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal export', 'error');
    } finally {
      setExportingReconId(null);
    }
  };

  const handleExportPdf = async (id: string) => {
    setExportingPdfId(id);
    try {
      const res = await accountingApi.bankStatements.exportPdf(id);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const disposition = res.headers?.['content-disposition'];
      let filename = `Acc_Statement_${id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.pdf`;
      if (typeof disposition === 'string' && disposition.includes('filename=')) {
        const m = disposition.match(/filename="?([^";\n]+)"?/);
        if (m && m[1]) filename = m[1].trim();
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      showToast('Export PDF rekening koran berhasil diunduh', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal export PDF', 'error');
    } finally {
      setExportingPdfId(null);
    }
  };

  const refetchRecon = useCallback(() => {
    if (!reconId) return;
    accountingApi.bankStatements.getReconciliation(reconId).then((res) => {
      if (res.data.success && res.data.data) setRecon(res.data.data);
    });
  }, [reconId]);

  const handleApproveSuggested = async (bankLineId: string) => {
    if (!reconId) return;
    setApprovingLineId(bankLineId);
    try {
      await accountingApi.bankStatements.approveSuggested(reconId, bankLineId);
      showToast('Saran cocok disetujui', 'success');
      refetchRecon();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menyetujui', 'error');
    } finally {
      setApprovingLineId(null);
    }
  };

  const handleManualMap = async (bankLineId: string, paymentProofId: string) => {
    if (!reconId) return;
    try {
      await accountingApi.bankStatements.manualMap(reconId, bankLineId, paymentProofId);
      showToast('Pemetaan manual berhasil', 'success');
      setManualMapLineId(null);
      refetchRecon();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal memetakan', 'error');
    }
  };

  const handleFinalize = async () => {
    if (!reconId) return;
    setFinalizingId(reconId);
    try {
      await accountingApi.bankStatements.finalize(reconId);
      showToast('Rekonsiliasi berhasil difinalisasi', 'success');
      refetchRecon();
      fetchList();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal finalisasi', 'error');
    } finally {
      setFinalizingId(null);
    }
  };

  const handleDownloadOriginalFile = async (id: string) => {
    setDownloadingOriginalId(id);
    try {
      const res = await accountingApi.bankStatements.getOriginalFile(id);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const disposition = res.headers?.['content-disposition'];
      let filename = `RekeningKoran_${id.slice(0, 8)}.pdf`;
      if (typeof disposition === 'string' && disposition.includes('filename=')) {
        const m = disposition.match(/filename="?([^";\n]+)"?/);
        if (m && m[1]) filename = m[1].trim();
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      showToast('File asli berhasil diunduh', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'File asli tidak tersedia', 'error');
    } finally {
      setDownloadingOriginalId(null);
    }
  };

  const openDetail = (id: string) => {
    setDetailUpload(null);
    setLoadingDetail(true);
    accountingApi.bankStatements
      .get(id)
      .then((res) => {
        if (res.data.success && res.data.data) setDetailUpload(res.data.data);
      })
      .catch(() => setDetailUpload(null))
      .finally(() => setLoadingDetail(false));
  };

  const tableColumns: TableColumn[] = [
    { id: 'name', label: 'Nama', align: 'left' },
    { id: 'period', label: 'Periode', align: 'left' },
    { id: 'line_count', label: 'Baris', align: 'right' },
    { id: 'uploaded_by', label: 'Diunggah oleh', align: 'left' },
    { id: 'created_at', label: 'Diunggah', align: 'left' },
    { id: 'actions', label: 'Aksi', align: 'center' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rekening Koran Bank</h1>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl">
            Upload data rekening koran (Excel) untuk rekonsiliasi antara <strong>penerimaan yang dicatat di sistem</strong> dengan <strong>data pencatatan penerimaan bank</strong>. Cocokkan tanggal dan nominal untuk memastikan pembayaran yang terverifikasi sesuai mutasi bank.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            Ke Dashboard
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<FileSpreadsheet className="w-5 h-5" />} label="Total Upload" value={loading ? '–' : uploads.length} />
        <StatCard icon={<List className="w-5 h-5" />} label="Total Baris" value={loading ? '–' : totalLines.toLocaleString('id-ID')} />
        <Card className="p-4 rounded-2xl border border-sky-200 shadow-sm bg-gradient-to-br from-sky-50 to-white sm:col-span-2">
          <p className="text-xs font-medium text-sky-700 uppercase tracking-wide">Setelah upload</p>
          <p className="text-sm text-slate-600 mt-1">Klik <strong>Rekon</strong> untuk membandingkan dengan penerimaan terverifikasi. Gunakan <strong>Lihat detail</strong> untuk melihat semua transaksi bank dalam file.</p>
        </Card>
      </div>

      {/* Upload */}
      <Card className="p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary-600" /> Upload Rekening Koran (Excel / PDF)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              File Excel atau PDF dengan urutan kolom: <strong>Posting Date (Tanggal)</strong>, <strong>Remark (Keterangan)</strong>, <strong>Reference No.</strong>, <strong>Debit</strong>, <strong>Credit (Kredit)</strong>, <strong>Balance (Saldo)</strong>. Excel: baris pertama = header. PDF: diekstrak otomatis sesuai kolom tersebut.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
            {downloadingTemplate ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            {downloadingTemplate ? 'Mengunduh...' : 'Download template Excel'}
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">File Excel atau PDF</label>
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Nama / Label (opsional)" type="text" placeholder="Contoh: Rekening Koran Maret 2026" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
            <Input label="Periode dari (opsional)" type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            <Input label="Periode sampai (opsional)" type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          </div>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            {uploading ? 'Mengunggah...' : 'Unggah & Impor'}
          </Button>
        </div>
      </Card>

      {/* Filter */}
      <Card className="p-4 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filter daftar
        </h3>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              label="Cari nama / file"
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Ketik nama atau nama file..."
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="min-w-[140px]">
            <Input label="Periode dari" type="date" value={filterPeriodFrom} onChange={(e) => setFilterPeriodFrom(e.target.value)} />
          </div>
          <div className="min-w-[140px]">
            <Input label="Periode sampai" type="date" value={filterPeriodTo} onChange={(e) => setFilterPeriodTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => { setFilterName(''); setFilterPeriodFrom(''); setFilterPeriodTo(''); }}>Reset</Button>
          </div>
        </div>
      </Card>

      {/* Daftar upload */}
      <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <List className="w-5 h-5 text-slate-600" /> Daftar Rekening Koran
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{filteredUploads.length} dari {uploads.length} upload · Rekon = bandingkan dengan penerimaan tercatat</p>
        </div>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : filteredUploads.length === 0 ? (
          <div className="py-12 text-center text-slate-500 px-4">{uploads.length === 0 ? 'Belum ada data rekening koran. Upload file Excel di atas.' : 'Tidak ada hasil sesuai filter.'}</div>
        ) : (
          <>
          <Table
            columns={tableColumns}
            data={paginatedUploads}
            emptyMessage="Tidak ada data"
            stickyActionsColumn
            renderRow={(u: BankStatementUploadItem) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="py-3 px-4 font-medium text-slate-800">{u.name || u.file_name || '–'}</td>
                <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{u.period_from && u.period_to ? `${formatDate(u.period_from)} – ${formatDate(u.period_to)}` : '–'}</td>
                <td className="py-3 px-4 text-right tabular-nums font-medium">{u.line_count ?? 0}</td>
                <td className="py-3 px-4 text-slate-600">{u.UploadedBy?.name ?? '–'}</td>
                <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatDate(u.created_at)}</td>
                <td className="py-3 px-4 sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openDetail(u.id)} title="Lihat detail transaksi">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleExportPdf(u.id)} disabled={exportingPdfId === u.id} title="Export PDF (kolom bank)">
                      {exportingPdfId === u.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDownloadOriginalFile(u.id)} disabled={downloadingOriginalId === u.id} title="Unduh file asli (PDF/Excel yang diunggah)">
                      {downloadingOriginalId === u.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReconId(u.id)} title="Rekonsiliasi">
                      <ArrowRightLeft className="w-4 h-4 mr-1" /> Rekon
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)} disabled={deletingId === u.id} title="Hapus">
                      {deletingId === u.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          />
          {totalFiltered > 0 && (
            <TablePagination
              total={totalFiltered}
              page={listPage}
              limit={listLimit}
              onPageChange={setListPage}
              onLimitChange={(l) => { setListLimit(l); setListPage(1); }}
              limitOptions={[10, 25, 50, 100]}
            />
          )}
        </>
        )}
      </Card>

      {/* Rekonsiliasi */}
      {reconId && (
        <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/80">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary-600" /> Rekonsiliasi: File Asli vs Hasil Pencocokan
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {recon?.upload?.finalized_at ? (
                <span className="text-sm text-slate-600 flex items-center gap-1"><Lock className="w-4 h-4" /> Sudah difinalisasi</span>
              ) : (
                <Button size="sm" variant="primary" onClick={handleFinalize} disabled={!!finalizingId || !recon}>
                  {finalizingId === reconId ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  {finalizingId === reconId ? 'Memproses...' : 'Finalize'}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => reconId && handleExportReconciliation(reconId)} disabled={!!exportingReconId || !recon}>
                {exportingReconId === reconId ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Export Excel
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setReconId(null)} title="Tutup">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          {loadingRecon ? (
            <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
            </div>
          ) : recon ? (
            <div className="flex flex-col lg:flex-row gap-0 min-h-[480px]">
              {/* Kiri: PDF Viewer (file asli) */}
              <div className="lg:w-[42%] border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/50 flex flex-col">
                <div className="px-4 py-2 border-b border-slate-200 text-sm font-medium text-slate-700">File asli (PDF)</div>
                <div className="flex-1 min-h-[320px] p-2">
                  {reconPdfUrl ? (
                    <iframe src={reconPdfUrl} title="PDF asli" className="w-full h-full min-h-[400px] rounded border border-slate-200 bg-white" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 text-sm">File asli tidak tersedia atau bukan PDF. Gunakan tombol &quot;File asli&quot; di daftar untuk unduh.</div>
                  )}
                </div>
              </div>
              {/* Kanan: Tabel hasil pencocokan dengan label warna */}
              <div className="lg:w-[58%] flex flex-col overflow-hidden">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 border-b border-slate-200 bg-white">
                  <StatCard icon={<CheckCircle className="w-4 h-4 text-green-600" />} label="Matched" value={recon.matched?.length ?? 0} subtitle="Hijau" />
                  <StatCard icon={<AlertCircle className="w-4 h-4 text-amber-600" />} label="Suggested" value={recon.suggested?.length ?? 0} subtitle="Kuning" />
                  <StatCard icon={<AlertCircle className="w-4 h-4 text-red-600" />} label="Unmatched" value={recon.unmatched?.length ?? 0} subtitle="Merah" />
                  <StatCard icon={<Banknote className="w-4 h-4" />} label="Hanya sistem" value={recon.onlyInRecorded?.length ?? 0} />
                  <StatCard icon={<List className="w-4 h-4" />} label="Hanya bank" value={recon.onlyInBank?.length ?? 0} />
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Semua baris bank (warna = status)</h3>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <Table
                      columns={[
                        { id: 'status', label: 'Status', align: 'left' },
                        { id: 'tanggal', label: 'Tanggal', align: 'left' },
                        { id: 'kredit', label: 'Kredit', align: 'right' },
                        { id: 'keterangan', label: 'Keterangan', align: 'left' },
                        { id: 'pasangan', label: 'Pasangan sistem', align: 'left' },
                        { id: 'aksi', label: 'Aksi', align: 'center' }
                      ]}
                      data={recon.bankLines || []}
                      emptyMessage="Tidak ada baris"
                      renderRow={(line: BankStatementLineItem) => {
                        const status = line.reconciliation_status || 'unreconciled';
                        const bg = status === 'matched' ? 'bg-green-50' : status === 'suggested' ? 'bg-amber-50' : 'bg-red-50';
                        const border = status === 'matched' ? 'border-l-4 border-l-green-500' : status === 'suggested' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-red-500';
                        const suggested = line.suggestedMatch;
                        const isFinalized = !!(recon.upload as { finalized_at?: string })?.finalized_at;
                        return (
                          <tr key={line.id} className={`border-t border-slate-100 ${bg} ${border}`}>
                            <td className="py-2 px-4">
                              <span className={`text-xs font-medium ${status === 'matched' ? 'text-green-700' : status === 'suggested' ? 'text-amber-700' : 'text-red-700'}`}>
                                {status === 'matched' ? 'Matched' : status === 'suggested' ? 'Suggested' : 'Unmatched'}
                              </span>
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap">{formatDate(line.transaction_date)}</td>
                            <td className="py-2 px-4 text-right font-medium">{formatIDR(Number(line.amount))}</td>
                            <td className="py-2 px-4 text-slate-700 max-w-[180px] truncate" title={line.description || ''}>{line.description || '–'}</td>
                            <td className="py-2 px-4 text-slate-600 text-sm">
                              {suggested ? `${suggested.invoice_number || suggested.payer || '–'} · ${formatIDR(suggested.amount)}` : '–'}
                            </td>
                            <td className="py-2 px-4">
                              {!isFinalized && status === 'suggested' && (
                                <Button size="sm" variant="outline" onClick={() => handleApproveSuggested(line.id)} disabled={approvingLineId === line.id} title="Approve saran">
                                  {approvingLineId === line.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </Button>
                              )}
                              {!isFinalized && (status === 'unmatched' || !status) && (
                                <>
                                  {manualMapLineId === line.id ? (
                                    <div className="flex flex-col gap-1">
                                      <select
                                        className="text-xs border rounded px-2 py-1"
                                        onChange={(e) => {
                                          const id = e.target.value;
                                          if (id) handleManualMap(line.id, id);
                                        }}
                                        onBlur={() => setManualMapLineId(null)}
                                        autoFocus
                                      >
                                        <option value="">Pilih pembayaran...</option>
                                        {(recon.systemTransactions || recon.recorded || []).map((r: SystemTransactionItem) => (
                                          <option key={r.id} value={r.id}>{formatDate(r.transfer_date)} · {formatIDR(r.amount)} · {r.invoice_number || r.payer || '–'}</option>
                                        ))}
                                      </select>
                                      <button type="button" className="text-xs text-slate-500" onClick={() => setManualMapLineId(null)}>Batal</button>
                                    </div>
                                  ) : (
                                    <Button size="sm" variant="ghost" onClick={() => setManualMapLineId(line.id)} title="Manual mapping">
                                      <Link2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <h3 className="text-sm font-semibold text-amber-800 mb-2">Penerimaan hanya di sistem ({recon.onlyInRecorded?.length ?? 0})</h3>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/50 max-h-[200px] overflow-y-auto">
                        <Table
                          columns={[{ id: 'tgl', label: 'Tgl', align: 'left' }, { id: 'nominal', label: 'Nominal', align: 'right' }, { id: 'invoice', label: 'Invoice / Payer', align: 'left' }]}
                          data={recon.onlyInRecorded || []}
                          emptyMessage="Tidak ada"
                          renderRow={(r: SystemTransactionItem) => (
                            <tr key={r.id} className="border-t border-amber-200/50">
                              <td className="py-2 px-4">{formatDate(r.transfer_date)}</td>
                              <td className="py-2 px-4 text-right font-medium">{formatIDR(r.amount)}</td>
                              <td className="py-2 px-4">{r.invoice_number || r.payer || '–'}</td>
                            </tr>
                          )}
                        />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-sky-800 mb-2">Transaksi hanya di bank ({recon.onlyInBank?.length ?? 0})</h3>
                      <div className="rounded-xl border border-sky-200 bg-sky-50/50 max-h-[200px] overflow-y-auto">
                        <Table
                          columns={[{ id: 'tgl', label: 'Tgl', align: 'left' }, { id: 'kredit', label: 'Kredit', align: 'right' }, { id: 'keterangan', label: 'Keterangan', align: 'left' }]}
                          data={recon.onlyInBank || []}
                          emptyMessage="Tidak ada"
                          renderRow={(b: BankStatementLineItem) => (
                            <tr key={b.id} className="border-t border-sky-200/50">
                              <td className="py-2 px-4">{formatDate(b.transaction_date)}</td>
                              <td className="py-2 px-4 text-right font-medium">{formatIDR(Number(b.amount))}</td>
                              <td className="py-2 px-4 text-slate-600 truncate max-w-[160px]">{b.description || '–'}</td>
                            </tr>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">Data rekonsiliasi tidak tersedia.</div>
          )}
        </Card>
      )}

      {/* Modal detail transaksi */}
      <Modal open={!!detailUpload || loadingDetail} onClose={() => setDetailUpload(null)}>
        <ModalBoxLg>
          <ModalHeader
            title="Detail Transaksi Rekening Koran"
            subtitle={detailUpload && !loadingDetail ? `${detailUpload.name || detailUpload.file_name || '–'} · Periode: ${detailUpload.period_from && detailUpload.period_to ? `${formatDate(detailUpload.period_from)} – ${formatDate(detailUpload.period_to)}` : '–'} · ${(detailUpload.Lines || []).length} baris` : undefined}
            icon={<FileSpreadsheet className="w-5 h-5" />}
            onClose={() => setDetailUpload(null)}
          />
          <ModalBody className="flex-1 overflow-auto">
            {detailUpload && !loadingDetail && (
              <div className="flex justify-end gap-2 mb-3 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => handleDownloadOriginalFile(detailUpload.id)} disabled={!!downloadingOriginalId} title="Unduh file asli yang diunggah">
                  {downloadingOriginalId === detailUpload.id ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />}
                  {downloadingOriginalId === detailUpload.id ? 'Mengunduh...' : 'File asli'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExportPdf(detailUpload.id)} disabled={!!exportingPdfId} title="Export PDF (kolom bank)">
                  {exportingPdfId === detailUpload.id ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
                  {exportingPdfId === detailUpload.id ? 'Mengunduh...' : 'Export PDF'}
                </Button>
              </div>
            )}
            {loadingDetail ? (
              <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
              </div>
            ) : detailUpload ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <Table
                  columns={[
                    { id: 'no', label: 'No', align: 'left' },
                    { id: 'tanggal', label: 'Tanggal', align: 'left' },
                    { id: 'keterangan', label: 'Keterangan', align: 'left' },
                    { id: 'ref', label: 'No Ref', align: 'left' },
                    { id: 'debit', label: 'Debit', align: 'right' },
                    { id: 'kredit', label: 'Kredit', align: 'right' },
                    { id: 'saldo', label: 'Saldo', align: 'right' }
                  ]}
                  data={detailUpload.Lines || []}
                  emptyMessage="Tidak ada transaksi"
                  renderRow={(line: BankStatementLineItem, idx: number) => (
                    <tr key={line.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2 px-4 tabular-nums">{idx + 1}</td>
                      <td className="py-2 px-4 whitespace-nowrap">{formatDate(line.transaction_date)}</td>
                      <td className="py-2 px-4 text-slate-700 max-w-[280px] truncate" title={line.description || ''}>{line.description || '–'}</td>
                      <td className="py-2 px-4 text-slate-600">{line.reference_number || '–'}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{Number(line.amount_debit) > 0 ? formatIDR(Number(line.amount_debit)) : '–'}</td>
                      <td className="py-2 px-4 text-right tabular-nums font-medium">{Number(line.amount_credit) > 0 ? formatIDR(Number(line.amount_credit)) : '–'}</td>
                      <td className="py-2 px-4 text-right tabular-nums text-slate-600">{line.balance_after != null ? formatIDR(Number(line.balance_after)) : '–'}</td>
                    </tr>
                  )}
                />
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">Data tidak tersedia.</div>
            )}
          </ModalBody>
        </ModalBoxLg>
      </Modal>
    </div>
  );
};

export default RekeningKoranPage;
