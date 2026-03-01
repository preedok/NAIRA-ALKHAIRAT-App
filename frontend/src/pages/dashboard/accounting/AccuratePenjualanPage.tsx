import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Receipt, FileText, RotateCcw, RefreshCw } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { accountingApi } from '../../../services/api';

const AccuratePenjualanPage: React.FC = () => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.accurate.listQuotations();
      setQuotations(res.data.success && Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const paginatedQuotations = useMemo(() => {
    const start = (page - 1) * limit;
    return quotations.slice(start, start + limit);
  }, [quotations, page, limit]);
  const totalPages = Math.max(1, Math.ceil(quotations.length / limit));

  const columns: TableColumn[] = [
    { id: 'number', label: 'No.', align: 'left' },
    { id: 'date', label: 'Tanggal', align: 'left' },
    { id: 'branch', label: 'Cabang', align: 'left' },
    { id: 'status', label: 'Status', align: 'left' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Penjualan</h2>
        <p className="text-sm text-slate-600 mt-0.5">Invoice, Penawaran (quotation), Retur penjualan.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600"><FileText className="w-5 h-5" /></div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Penawaran</p>
              <p className="text-lg font-bold text-slate-900">{quotations.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 opacity-75">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-500 inline-block"><Receipt className="w-5 h-5" /></div>
          <p className="text-xs font-medium text-slate-500 uppercase mt-2">Invoice</p>
          <p className="text-sm text-slate-500">Segera hadir</p>
        </Card>
        <Card className="p-4 border border-slate-200 opacity-75">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-500 inline-block"><RotateCcw className="w-5 h-5" /></div>
          <p className="text-xs font-medium text-slate-500 uppercase mt-2">Retur</p>
          <p className="text-sm text-slate-500">Segera hadir</p>
        </Card>
      </div>
      <Card className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Daftar Penawaran</h3>
          <Button variant="outline" size="sm" onClick={fetchQuotations} disabled={loading}>Refresh</Button>
        </div>
        {loading && <div className="py-12 text-center text-slate-500">Memuat...</div>}
        {!loading && quotations.length === 0 && <div className="py-12 text-center text-slate-500">Belum ada penawaran.</div>}
        {!loading && quotations.length > 0 && (
          <Table
            columns={columns}
            data={paginatedQuotations}
            emptyMessage="Belum ada penawaran"
            pagination={quotations.length > 0 ? {
              total: quotations.length,
              page,
              limit,
              totalPages,
              onPageChange: setPage,
              onLimitChange: (l) => { setLimit(l); setPage(1); }
            } : undefined}
            renderRow={(q) => (
              <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="py-3 px-4 font-mono">{q.quotation_number || q.id?.slice(0, 8)}</td>
                <td className="py-3 px-4 text-slate-600">{fmt(q.quotation_date)}</td>
                <td className="py-3 px-4">{q.Branch?.name || q.branch_id || '–'}</td>
                <td className="py-3 px-4">{q.status || '–'}</td>
              </tr>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default AccuratePenjualanPage;
