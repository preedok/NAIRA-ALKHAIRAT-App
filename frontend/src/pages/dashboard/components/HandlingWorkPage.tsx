import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HandHelping, Eye, ChevronRight, Loader2 } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ContentLoading from '../../../components/common/ContentLoading';
import { AutoRefreshControl } from '../../../components/common';
import { handlingApi } from '../../../services/api';
import type { HandlingDashboardData } from '../../../services/api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu',
  in_progress: 'Dalam Proses',
  completed: 'Selesai'
};

const STATUS_OPTIONS: { value: 'pending' | 'in_progress' | 'completed'; label: string }[] = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'in_progress', label: 'Dalam Proses' },
  { value: 'completed', label: 'Selesai' }
];

const HandlingWorkPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice_id');

  const [data, setData] = useState<HandlingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await handlingApi.getDashboard();
      if (res.data.success) setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (orderItemId: string, handling_status: 'pending' | 'in_progress' | 'completed') => {
    setUpdatingId(orderItemId);
    try {
      await handlingApi.updateOrderItemProgress(orderItemId, { handling_status });
      await fetchData();
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingList = data?.pending_list ?? [];
  const byStatus = data?.by_status ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Handling"
        subtitle="Daftar item handling yang perlu diproses. Ubah status lalu buka invoice untuk detail."
        right={<AutoRefreshControl onRefresh={fetchData} disabled={loading} size="sm" />}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-600">Total Order</p>
          <p className="text-2xl font-semibold text-slate-900">{data?.total_orders ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-600">Total Item Handling</p>
          <p className="text-2xl font-semibold text-slate-900">{data?.total_handling_items ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-600">Menunggu / Dalam Proses</p>
          <p className="text-2xl font-semibold text-amber-600">{(byStatus.pending ?? 0) + (byStatus.in_progress ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-600">Selesai</p>
          <p className="text-2xl font-semibold text-emerald-600">{byStatus.completed ?? 0}</p>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          {loading ? (
            <ContentLoading />
          ) : pendingList.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <HandHelping className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">Tidak ada item handling yang menunggu</p>
              <p className="text-sm mt-1">Semua item handling sudah selesai atau belum ada order dengan item handling.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Invoice / Order</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Pemesan</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Produk · Qty</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pendingList.map((row) => (
                  <tr key={row.order_item_id} className="border-b border-slate-100 hover:bg-slate-50/50 last:border-b-0">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{row.invoice_number || '–'}</p>
                      <p className="text-xs text-slate-500">{row.order_number || '–'}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{row.owner_name || '–'}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {row.product_name || 'Handling'} {row.quantity > 1 ? `× ${row.quantity}` : ''}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={row.status}
                        onChange={(e) => handleStatusChange(row.order_item_id, e.target.value as 'pending' | 'in_progress' | 'completed')}
                        disabled={updatingId === row.order_item_id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {updatingId === row.order_item_id && (
                        <Loader2 className="inline-block w-4 h-4 ml-2 animate-spin text-slate-400" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/dashboard/orders-invoices?tab=invoices&invoice_id=${row.invoice_id}`)}
                        className="gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Lihat Invoice
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {invoiceIdParam && (
        <div className="flex justify-center">
          <Button variant="primary" onClick={() => navigate(`/dashboard/orders-invoices?tab=invoices&invoice_id=${invoiceIdParam}`)}>
            Buka Invoice
          </Button>
        </div>
      )}
    </div>
  );
};

export default HandlingWorkPage;
