import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt, BookOpen } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { Autocomplete, ActionsMenu, AutoRefreshControl } from '../../../components/common';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { accountingApi } from '../../../services/api';
import { formatIDR } from '../../../utils';

const INVOICE_STATUS_LABELS: Record<string, string> = { draft: 'Draft', posted: 'Posted', partial_paid: 'Partial', paid: 'Lunas' };
const DEFAULT_LIMIT = 20;

const AccountingPurchasingInvoicesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const productIdFromUrl = searchParams.get('product_id') || '';
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [productId, setProductId] = useState(productIdFromUrl);
  const [statusFilter, setStatusFilter] = useState('');
  const [products, setProducts] = useState<Array<{ id: string; code: string; name: string; type: string }>>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (productId) params.product_id = productId;
      if (statusFilter) params.status = statusFilter;
      const res = await accountingApi.listPurchaseInvoices(params);
      if (res.data.success) {
        setList(res.data.data || []);
        setTotal((res.data as { total?: number }).total ?? 0);
      } else setList([]);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, productId, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { setProductId(productIdFromUrl || productId); }, [productIdFromUrl]);

  useEffect(() => {
    accountingApi.getPurchasingSummary().then((r) => {
      if (r.data.success && r.data.data) setProducts(r.data.data.products || []);
    }).catch(() => {});
  }, []);

  const handlePost = async (id: string) => {
    if (!window.confirm('Posting faktur akan membuat jurnal. Lanjutkan?')) return;
    setActionLoading(true);
    try {
      await accountingApi.postPurchaseInvoice(id);
      fetchList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err?.response?.data?.message || 'Gagal posting');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faktur Pembelian"
        subtitle="Faktur pembelian product ke supplier: posting ke jurnal"
        right={<AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />}
      />
      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <Autocomplete
            label="Product"
            size="sm"
            value={productId}
            onChange={(v: string) => setProductId(v || '')}
            emptyLabel="Semua product"
            options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.type})` }))}
            className="min-w-[200px]"
            fullWidth={false}
          />
          <Autocomplete
            label="Status"
            size="sm"
            value={statusFilter}
            onChange={(v: string) => setStatusFilter(v || '')}
            emptyLabel="Semua"
            options={Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            className="min-w-[140px]"
            fullWidth={false}
          />
        </div>
        <Table
          columns={[
            { id: 'invoice_number', label: 'No. Faktur', align: 'left' },
            { id: 'supplier', label: 'Supplier', align: 'left' },
            { id: 'product', label: 'Product', align: 'left' },
            { id: 'invoice_date', label: 'Tanggal', align: 'left' },
            { id: 'total', label: 'Total', align: 'right' },
            { id: 'paid', label: 'Terbayar', align: 'right' },
            { id: 'remaining', label: 'Sisa', align: 'right' },
            { id: 'status', label: 'Status', align: 'left' },
            { id: 'actions', label: '', align: 'right' }
          ] as TableColumn[]}
          data={loading ? [] : list}
          emptyMessage={loading ? 'Memuat...' : 'Tidak ada faktur pembelian'}
          pagination={total > 0 ? { total, page, limit, totalPages, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } } : undefined}
          renderRow={(row) => {
            const menuItems: ActionsMenuItem[] = [];
            if (row.status === 'draft') {
              menuItems.push({ id: 'post', label: 'Post ke Jurnal', icon: <BookOpen className="w-4 h-4" />, onClick: () => handlePost(row.id) });
            }
            return (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium">{row.invoice_number}</td>
                <td className="px-4 py-3 text-sm">{row.Supplier?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm">{row.Product?.name ?? '–'}</td>
                <td className="px-4 py-3 text-sm">{row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('id-ID') : '–'}</td>
                <td className="px-4 py-3 text-right">{formatIDR(parseFloat(row.total_amount || 0))}</td>
                <td className="px-4 py-3 text-right text-blue-600">{formatIDR(parseFloat(row.paid_amount || 0))}</td>
                <td className="px-4 py-3 text-right text-amber-600">{formatIDR(parseFloat(row.remaining_amount || 0))}</td>
                <td className="px-4 py-3"><Badge variant={row.status === 'paid' ? 'success' : row.status === 'posted' || row.status === 'partial_paid' ? 'warning' : 'default'}>{INVOICE_STATUS_LABELS[row.status] ?? row.status}</Badge></td>
                <td className="px-4 py-3 text-right">{menuItems.length > 0 && <ActionsMenu items={menuItems} />}</td>
              </tr>
            );
          }}
        />
      </Card>
    </div>
  );
};

export default AccountingPurchasingInvoicesPage;
