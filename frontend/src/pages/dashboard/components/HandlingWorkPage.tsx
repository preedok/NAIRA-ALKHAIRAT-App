import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HandHelping, Eye, ChevronRight, Loader2, Clock, CheckCircle } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ContentLoading from '../../../components/common/ContentLoading';
import { AutoRefreshControl } from '../../../components/common';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { handlingApi } from '../../../services/api';
import type { HandlingDashboardData } from '../../../services/api';
import { DivisionStatCardsWithModal, type DivisionStatItem } from '../../../components/common';
import { getProgressDateRange, PROGRESS_DATE_RANGE_OPTIONS, type ProgressDateRangeKey } from '../../../utils/progressDateFilter';

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
  const [filterDateRange, setFilterDateRange] = useState<ProgressDateRangeKey>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const range = getProgressDateRange(filterDateRange);
      const params = range ? { date_from: range.date_from, date_to: range.date_to } : undefined;
      const res = await handlingApi.getDashboard(params);
      if (res.data.success) setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filterDateRange]);

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

  const invoiceLikeList = useMemo(() => pendingList.map((row: any) => ({
    id: row.invoice_id || row.order_item_id || row.order_id,
    invoice_number: row.invoice_number || row.order_number || '–',
    total_amount: row.total_amount ?? 0,
    status: row.status || 'pending',
    Order: { User: { name: row.owner_name || '–' } }
  })), [pendingList]);

  const divisionStats: DivisionStatItem[] = useMemo(() => [
    { id: 'total_orders', label: 'Total Order', value: data?.total_orders ?? 0, icon: <HandHelping className="w-5 h-5" />, iconClassName: 'bg-slate-100 text-slate-600', modalTitle: 'Daftar – Total Order' },
    { id: 'total_items', label: 'Total Item Handling', value: data?.total_handling_items ?? 0, icon: <HandHelping className="w-5 h-5" />, iconClassName: 'bg-sky-100 text-sky-600', modalTitle: 'Daftar – Total Item Handling' },
    { id: 'pending_progress', label: 'Menunggu / Dalam Proses', value: (byStatus.pending ?? 0) + (byStatus.in_progress ?? 0), icon: <Clock className="w-5 h-5" />, iconClassName: 'bg-amber-100 text-amber-600', modalTitle: 'Daftar – Menunggu / Dalam Proses' },
    { id: 'completed', label: 'Selesai', value: byStatus.completed ?? 0, icon: <CheckCircle className="w-5 h-5" />, iconClassName: 'bg-emerald-100 text-emerald-600', modalTitle: 'Daftar – Selesai' }
  ], [data?.total_orders, data?.total_handling_items, byStatus]);

  const getFilteredForStat = useCallback((statId: string) => {
    if (statId === 'total_orders' || statId === 'total_items') return invoiceLikeList;
    if (statId === 'pending_progress') return invoiceLikeList.filter((r: any) => r.status === 'pending' || r.status === 'in_progress');
    if (statId === 'completed') return invoiceLikeList.filter((r: any) => r.status === 'completed');
    return invoiceLikeList;
  }, [invoiceLikeList]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Handling"
        subtitle="Daftar item handling yang perlu diproses. Ubah status lalu buka invoice untuk detail."
        right={<AutoRefreshControl onRefresh={fetchData} disabled={loading} size="sm" />}
      />

      <DivisionStatCardsWithModal
        stats={divisionStats}
        invoices={invoiceLikeList}
        getFilteredInvoices={getFilteredForStat}
        loading={loading}
        getStatusLabel={(row: any) => row.status === 'completed' ? 'Selesai' : row.status === 'in_progress' ? 'Dalam Proses' : 'Menunggu'}
        getStatusBadgeVariant={(row: any) => (row.status === 'completed' ? 'success' : row.status === 'in_progress' ? 'warning' : 'default') as 'default' | 'success' | 'warning' | 'error' | 'info'}
      />

      <Card>
        <div className="mb-4 rounded-xl bg-slate-50/80 border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Pengaturan Filter</p>
          <p className="text-xs text-slate-500 mb-3">Filter data menurut tanggal (hari ini, 2/3/4/5 hari, 1/2/3 minggu, 1 bulan kedepan)</p>
          <div className="flex flex-wrap gap-2">
            {PROGRESS_DATE_RANGE_OPTIONS.map((opt) => (
              <button key={opt.value || 'all'} type="button" onClick={() => setFilterDateRange(opt.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterDateRange === opt.value ? 'bg-[#0D1A63] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
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
                      <InvoiceNumberCell inv={{ invoice_number: row.invoice_number, status: row.status, Refunds: [] }} statusLabels={INVOICE_STATUS_LABELS} compact />
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
