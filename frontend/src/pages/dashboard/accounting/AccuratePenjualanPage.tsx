import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, FileText, RotateCcw, RefreshCw } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">No.</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Tanggal</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Cabang</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono">{q.quotation_number || q.id?.slice(0, 8)}</td>
                    <td className="py-3 px-4 text-slate-600">{fmt(q.quotation_date)}</td>
                    <td className="py-3 px-4">{q.Branch?.name || q.branch_id || '–'}</td>
                    <td className="py-3 px-4">{q.status || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AccuratePenjualanPage;
