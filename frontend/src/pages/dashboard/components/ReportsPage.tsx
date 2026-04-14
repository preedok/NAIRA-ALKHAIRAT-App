import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';

const ReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ total_orders: 0, total_invoices: 0, total_users: 0 });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports/analytics');
      setData(res?.data?.data || { total_orders: 0, total_invoices: 0, total_users: 0 });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const doExport = async (kind: 'pdf' | 'excel') => {
    try {
      const res = await api.get(kind === 'pdf' ? '/reports/export-pdf' : '/reports/export-excel');
      const msg = res?.data?.message || 'Export diproses';
      window.alert(msg);
    } catch (e: any) {
      window.alert(e?.response?.data?.message || 'Gagal export laporan');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Laporan"
        subtitle="Ringkasan analitik transaksi dan jamaah untuk evaluasi performa travel."
        right={(
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadData} className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-50">Refresh</button>
            <button type="button" onClick={() => doExport('excel')} className="px-3 py-2 text-sm rounded-lg bg-btn text-white hover:bg-btn-hover">Export Excel</button>
            <button type="button" onClick={() => doExport('pdf')} className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-50">Export PDF</button>
          </div>
        )}
      />

      {error && (
        <Card padding="sm"><p className="text-sm text-red-700">{error}</p></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><p className="text-sm text-stone-500">Total Order</p><p className="text-2xl font-bold mt-2">{loading ? '...' : data.total_orders}</p></Card>
        <Card><p className="text-sm text-stone-500">Total Invoice</p><p className="text-2xl font-bold mt-2">{loading ? '...' : data.total_invoices}</p></Card>
        <Card><p className="text-sm text-stone-500">Total Jamaah</p><p className="text-2xl font-bold mt-2">{loading ? '...' : data.total_users}</p></Card>
      </div>
    </div>
  );
};

export default ReportsPage;
