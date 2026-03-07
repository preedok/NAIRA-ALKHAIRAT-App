import React, { useState, useEffect, useRef } from 'react';
import { FileText, Circle, FileDown, FileSpreadsheet, Search } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import { Input, Autocomplete, AutoRefreshControl } from '../../../components/common';
import ContentLoading from '../../../components/common/ContentLoading';
import { superAdminApi } from '../../../services/api';

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

const POLL_INTERVAL_MS = 2000;

export const SuperAdminLogsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [live, setLive] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const exportParams = { source: source || undefined, level: level || undefined, limit: 2000 };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const res = await superAdminApi.exportLogsExcel(exportParams);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data as Blob, `system-logs-${date}.xlsx`);
    } catch {
      alert('Gagal export Excel');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const res = await superAdminApi.exportLogsPdf(exportParams);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data as Blob, `system-logs-${date}.pdf`);
    } catch {
      alert('Gagal export PDF');
    } finally {
      setExporting(null);
    }
  };

  const limit = 200;

  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await superAdminApi.getLogs({
        source: source || undefined,
        level: level || undefined,
        q: search.trim() || undefined,
        page: 1,
        limit
      });
      if (res.data.success) {
        setItems(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [source, level, search]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      fetchLogs(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [live, source, level, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Logs (realtime)"
        subtitle="Log sistem backend, frontend, dan database"
      />

      {/* Toolbar: refresh, live, filter, search, export */}
      <Card className="rounded-xl border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <AutoRefreshControl onRefresh={() => fetchLogs()} disabled={loading} size="sm" />
              <span className="hidden sm:inline text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setLive(!live)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  live ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <Circle className={`w-2.5 h-2.5 shrink-0 ${live ? 'fill-emerald-500 text-emerald-500' : ''}`} />
                {live ? 'Live' : 'Paused'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Autocomplete value={source} onChange={setSource} options={[{ value: 'backend', label: 'Backend' }, { value: 'frontend', label: 'Frontend' }, { value: 'database', label: 'Database' }]} emptyLabel="Semua sumber" className="min-w-[140px]" fullWidth={false} />
              <Autocomplete value={level} onChange={setLevel} options={[{ value: 'info', label: 'Info' }, { value: 'warn', label: 'Warn' }, { value: 'error', label: 'Error' }, { value: 'debug', label: 'Debug' }]} emptyLabel="Semua level" className="min-w-[120px]" fullWidth={false} />
              <div className="flex-1 min-w-[180px] max-w-[280px]">
                <Input type="text" placeholder="Cari pesan..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="w-4 h-4 text-slate-400" />} className="rounded-xl" />
              </div>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!!exporting} className="rounded-xl shrink-0">
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                {exporting === 'excel' ? '...' : 'Excel'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!!exporting} className="rounded-xl shrink-0">
                <FileDown className="w-4 h-4 mr-1.5" />
                {exporting === 'pdf' ? '...' : 'PDF'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-xl border-slate-200/80 shadow-sm">
        {loading ? (
          <ContentLoading />
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm">Belum ada log.</p>
            <p className="text-xs mt-1 max-w-md mx-auto">Log akan muncul saat ada aktivitas atau error di aplikasi (backend, frontend, database).</p>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className="overflow-x-auto overflow-y-auto max-h-[70vh] font-mono text-sm bg-slate-900 text-slate-100 rounded-b-xl"
            >
              <table className="w-full text-sm">
                <thead className="bg-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-3 text-slate-300">Waktu</th>
                    <th className="text-left py-2 px-3 text-slate-300">Sumber</th>
                    <th className="text-left py-2 px-3 text-slate-300">Level</th>
                    <th className="text-left py-2 px-3 text-slate-300">Pesan</th>
                    <th className="text-left py-2 px-3 text-slate-300">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log) => (
                    <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                      <td className="py-1.5 px-3 whitespace-nowrap text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-1.5 px-3 text-cyan-300">{log.source}</td>
                      <td className="py-1.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                          log.level === 'warn' ? 'bg-yellow-500/20 text-yellow-400' :
                          log.level === 'debug' ? 'bg-slate-500/20 text-slate-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>{log.level}</span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-200 max-w-md break-all" title={log.message}>{log.message}</td>
                      <td className="py-1.5 px-3">
                        {log.meta && Object.keys(log.meta).length > 0 ? (
                          <pre className="text-xs text-slate-400 max-w-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.meta)}</pre>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-between items-center gap-2 py-3 px-4 border-t border-slate-200 bg-slate-50/80">
              <span className="text-sm text-slate-600">Total: <strong>{total}</strong> log</span>
              {live && <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium"><Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" /> Update otomatis tiap 2 detik</span>}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default SuperAdminLogsPage;
