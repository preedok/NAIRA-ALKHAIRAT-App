import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, RefreshCw, ArrowRightLeft, CheckCircle, AlertCircle, List, Trash2, X, Banknote, Download, Eye, Filter, Search
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { accountingApi } from '../../../services/api';
import type {
  BankStatementUploadItem,
  BankStatementReconciliationData,
  BankStatementLineItem,
  BankStatementUploadWithLines
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
  const [detailUpload, setDetailUpload] = useState<BankStatementUploadWithLines | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterPeriodFrom, setFilterPeriodFrom] = useState('');
  const [filterPeriodTo, setFilterPeriodTo] = useState('');

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
    if (!reconId) {
      setRecon(null);
      return;
    }
    setLoadingRecon(true);
    accountingApi.bankStatements
      .getReconciliation(reconId)
      .then((res) => {
        if (res.data.success && res.data.data) setRecon(res.data.data);
        else setRecon(null);
      })
      .catch(() => setRecon(null))
      .finally(() => setLoadingRecon(false));
  }, [reconId]);

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
        <Card className="p-4 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Upload</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{loading ? '–' : uploads.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
              <List className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Baris</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{loading ? '–' : totalLines.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </Card>
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
              <Upload className="w-5 h-5 text-primary-600" /> Upload Rekening Koran (Excel)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              File Excel (.xlsx / .xls) dengan kolom: <strong>Tanggal</strong>, <strong>Keterangan</strong>, <strong>No. Ref</strong>, <strong>Debit</strong>, <strong>Kredit</strong> (nama kolom bisa bervariasi). Baris pertama dianggap header.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
            {downloadingTemplate ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            {downloadingTemplate ? 'Mengunduh...' : 'Download template Excel'}
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">File Excel</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama / Label (opsional)</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Contoh: Rekening Koran Maret 2026"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Periode dari (opsional)</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Periode sampai (opsional)</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </div>
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
            <label className="block text-xs font-medium text-slate-500 mb-1">Cari nama / file</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Ketik nama atau nama file..." className="w-full text-sm border border-slate-300 rounded-lg pl-9 pr-3 py-2" />
            </div>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Periode dari</label>
            <input type="date" value={filterPeriodFrom} onChange={(e) => setFilterPeriodFrom(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Periode sampai</label>
            <input type="date" value={filterPeriodTo} onChange={(e) => setFilterPeriodTo(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
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
          <Table
            columns={tableColumns}
            data={filteredUploads}
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
        )}
      </Card>

      {/* Rekonsiliasi */}
      {reconId && (
        <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/80">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary-600" /> Rekonsiliasi: Penerimaan Tercatat vs Bank
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => reconId && handleExportReconciliation(reconId)} disabled={!!exportingReconId || !recon}>
                {exportingReconId === reconId ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                {exportingReconId === reconId ? 'Mengunduh...' : 'Export ke Excel'}
              </Button>
              <button type="button" onClick={() => setReconId(null)} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {loadingRecon ? (
            <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
            </div>
          ) : recon ? (
            <div className="p-5 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-center gap-2 text-emerald-800 font-medium">
                    <CheckCircle className="w-5 h-5" /> Cocok
                  </div>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">{recon.matched.length}</p>
                  <p className="text-xs text-emerald-700 mt-0.5">Penerimaan yang cocok tanggal & nominal dengan bank</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-2 text-amber-800 font-medium">
                    <Banknote className="w-5 h-5" /> Hanya di sistem
                  </div>
                  <p className="text-2xl font-bold text-amber-900 mt-1">{recon.onlyInRecorded.length}</p>
                  <p className="text-xs text-amber-700 mt-0.5">Penerimaan tercatat belum ada di bank</p>
                </div>
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-4">
                  <div className="flex items-center gap-2 text-sky-800 font-medium">
                    <AlertCircle className="w-5 h-5" /> Hanya di bank
                  </div>
                  <p className="text-2xl font-bold text-sky-900 mt-1">{recon.onlyInBank.length}</p>
                  <p className="text-xs text-sky-700 mt-0.5">Transaksi bank belum tercatat di sistem</p>
                </div>
              </div>

              {recon.matched.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Yang cocok (tanggal + nominal)</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm min-w-max">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left py-2 px-3 whitespace-nowrap">Tgl</th>
                          <th className="text-right py-2 px-3 whitespace-nowrap">Nominal</th>
                          <th className="text-left py-2 px-3 whitespace-nowrap">Invoice / Payer</th>
                          <th className="text-left py-2 px-3 whitespace-nowrap">Keterangan bank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recon.matched.map((m, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="py-2 px-3 whitespace-nowrap">{formatDate(m.recorded.transfer_date)}</td>
                            <td className="py-2 px-3 text-right font-medium">{formatIDR(m.recorded.amount)}</td>
                            <td className="py-2 px-3">{m.recorded.invoice_number || m.recorded.payer || '–'}</td>
                            <td className="py-2 px-3 text-slate-600 truncate max-w-[200px]">{m.bankLine.description || '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-amber-800 mb-2">Penerimaan hanya di sistem ({recon.onlyInRecorded.length})</h3>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 max-h-[320px] overflow-y-auto">
                    {recon.onlyInRecorded.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">Tidak ada</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-amber-100/80 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3">Tgl</th>
                            <th className="text-right py-2 px-3">Nominal</th>
                            <th className="text-left py-2 px-3">Invoice / Payer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recon.onlyInRecorded.map((r) => (
                            <tr key={r.id} className="border-t border-amber-200/50">
                              <td className="py-2 px-3">{formatDate(r.transfer_date)}</td>
                              <td className="py-2 px-3 text-right font-medium">{formatIDR(r.amount)}</td>
                              <td className="py-2 px-3">{r.invoice_number || r.payer || '–'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">Transaksi hanya di bank ({recon.onlyInBank.length})</h3>
                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 max-h-[320px] overflow-y-auto">
                    {recon.onlyInBank.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">Tidak ada</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-sky-100/80 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3">Tgl</th>
                            <th className="text-right py-2 px-3">Kredit</th>
                            <th className="text-left py-2 px-3">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recon.onlyInBank.map((b: BankStatementLineItem) => (
                            <tr key={b.id} className="border-t border-sky-200/50">
                              <td className="py-2 px-3">{formatDate(b.transaction_date)}</td>
                              <td className="py-2 px-3 text-right font-medium">{formatIDR(Number(b.amount))}</td>
                              <td className="py-2 px-3 text-slate-600 truncate max-w-[200px]">{b.description || '–'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
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
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
            <h2 className="text-lg font-semibold text-slate-900">Detail Transaksi Rekening Koran</h2>
            <button type="button" onClick={() => setDetailUpload(null)} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          {loadingDetail ? (
            <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
            </div>
          ) : detailUpload ? (
            <>
              <div className="px-5 py-3 border-b border-slate-100 bg-white">
                <p className="text-sm text-slate-600"><strong>{detailUpload.name || detailUpload.file_name || '–'}</strong> · Periode: {detailUpload.period_from && detailUpload.period_to ? `${formatDate(detailUpload.period_from)} – ${formatDate(detailUpload.period_to)}` : '–'} · {(detailUpload.Lines || []).length} baris</p>
              </div>
              <div className="flex-1 overflow-auto p-5">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm min-w-max">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left py-2 px-3 whitespace-nowrap">No</th>
                        <th className="text-left py-2 px-3 whitespace-nowrap">Tanggal</th>
                        <th className="text-left py-2 px-3 whitespace-nowrap">Keterangan</th>
                        <th className="text-left py-2 px-3 whitespace-nowrap">No Ref</th>
                        <th className="text-right py-2 px-3 whitespace-nowrap">Debit</th>
                        <th className="text-right py-2 px-3 whitespace-nowrap">Kredit</th>
                        <th className="text-right py-2 px-3 whitespace-nowrap">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailUpload.Lines || []).map((line: BankStatementLineItem, idx: number) => (
                        <tr key={line.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="py-2 px-3 tabular-nums">{idx + 1}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{formatDate(line.transaction_date)}</td>
                          <td className="py-2 px-3 text-slate-700 max-w-[280px] truncate" title={line.description || ''}>{line.description || '–'}</td>
                          <td className="py-2 px-3 text-slate-600">{line.reference_number || '–'}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{Number(line.amount_debit) > 0 ? formatIDR(Number(line.amount_debit)) : '–'}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium">{Number(line.amount_credit) > 0 ? formatIDR(Number(line.amount_credit)) : '–'}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-600">{line.balance_after != null ? formatIDR(Number(line.balance_after)) : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-500">Data tidak tersedia.</div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RekeningKoranPage;
