import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, FileText, Receipt, DollarSign, Package, Trash2, LayoutDashboard, Plus, ChevronDown } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import PageHeader from '../../../components/common/PageHeader';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import StatCard from '../../../components/common/StatCard';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import ContentLoading from '../../../components/common/ContentLoading';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { accountingApi, type PurchasingByProduct } from '../../../services/api';
import { formatIDR } from '../../../utils';
import AccountingPurchasingSuppliersPage from './AccountingPurchasingSuppliersPage';
import AccountingPurchasingOrdersPage from './AccountingPurchasingOrdersPage';
import AccountingPurchasingInvoicesPage from './AccountingPurchasingInvoicesPage';
import AccountingPurchasingPaymentsPage from './AccountingPurchasingPaymentsPage';

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel',
  visa: 'Visa',
  ticket: 'Tiket',
  bus: 'Bus Saudi',
  handling: 'Handling',
  package: 'Paket'
};

/** Tab filter per tipe product (tetap: Hotel, Visa, Tiket, Bus Saudi, Handling) */
const PURCHASING_PRODUCT_TABS: { id: string; label: string }[] = [
  { id: '', label: 'Semua' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'visa', label: 'Visa' },
  { id: 'ticket', label: 'Tiket' },
  { id: 'bus', label: 'Bus Saudi' },
  { id: 'handling', label: 'Handling' }
];

const TABS = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'suppliers', label: 'Master Supplier', icon: Users },
  { id: 'orders', label: 'PO Pembelian', icon: FileText },
  { id: 'invoices', label: 'Faktur Pembelian', icon: Receipt },
  { id: 'payments', label: 'Pembayaran Pembelian', icon: DollarSign }
] as const;
type TabId = typeof TABS[number]['id'];

const AccountingPurchasingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const tab = (searchParams.get('tab') || 'ringkasan') as TabId;
  const effectiveTab = TABS.some((t) => t.id === tab) ? tab : 'ringkasan';
  const setTab = (t: TabId) => setSearchParams((p) => { p.set('tab', t); p.delete('product_id'); p.delete('action'); return p; });
  const setTabWithProduct = (t: TabId, productId: string) => setSearchParams({ tab: t, product_id: productId });
  const actionCreate = searchParams.get('action') === 'create';
  const clearAction = useCallback(() => {
    setSearchParams((p) => { p.delete('action'); return p; });
  }, [setSearchParams]);
  const goToAdd = (targetTab: TabId) => {
    setAddMenuOpen(false);
    setSearchParams((p) => { p.set('tab', targetTab); p.set('action', 'create'); p.delete('product_id'); return p; });
  };
  const [data, setData] = useState<{ products: Array<{ id: string; code: string; name: string; type: string }>; by_product: PurchasingByProduct[]; suppliers_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  /** Tab filter: '' = Semua, atau product type (hotel, visa, ticket, bus, handling) */
  const [selectedProductType, setSelectedProductType] = useState<string>('');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await accountingApi.getPurchasingSummary();
      if (res.data.success && res.data.data) setData(res.data.data);
      else setData(null);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal memuat ringkasan pembelian');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const byProduct = data?.by_product ?? [];
  const suppliersCount = data?.suppliers_count ?? 0;
  const totalPo = byProduct.reduce((s, r) => s + r.po_count, 0);
  const totalInv = byProduct.reduce((s, r) => s + r.invoice_count, 0);
  const totalRemaining = byProduct.reduce((s, r) => s + r.remaining_amount, 0);

  /** Data yang tampil sesuai tab: Semua = byProduct, atau filter by product_type */
  const filteredByProduct = selectedProductType
    ? byProduct.filter((r) => r.product_type === selectedProductType)
    : byProduct;

  const handleDeleteByProduct = useCallback(
    async (row: PurchasingByProduct) => {
      if (!window.confirm(`Hapus semua data pembelian draft (PO, Faktur, Pembayaran) untuk product "${row.product_name}"? Data yang sudah disetujui/diposting tidak dihapus.`)) return;
      setError(null);
      setDeletingProductId(row.product_id);
      try {
        const res = await accountingApi.deletePurchasingByProduct(row.product_id);
        const d = res.data?.data;
        if (res.data?.success) {
          const msg = d ? `Dihapus: ${d.deleted_orders} PO, ${d.deleted_invoices} faktur, ${d.deleted_payments} pembayaran.` : res.data?.message;
          window.alert(msg || 'Data pembelian draft dihapus.');
          fetchSummary();
        }
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal menghapus data pembelian';
        setError(msg);
      } finally {
        setDeletingProductId(null);
      }
    },
    [fetchSummary]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modul Pembelian"
        subtitle="Pembelian product baru ke supplier per product. Setiap pembelian wajib dilampiri bukti."
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setAddMenuOpen((o) => !o)}>
                <Plus className="w-4 h-4" /> Tambah Pembelian <ChevronDown className="w-4 h-4 opacity-80" />
              </Button>
              {addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setAddMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 min-w-[200px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => goToAdd('orders')}>
                      <FileText className="w-4 h-4 text-slate-500" /> Buat PO Pembelian
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => goToAdd('invoices')}>
                      <Receipt className="w-4 h-4 text-slate-500" /> Buat Faktur Pembelian
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => goToAdd('payments')}>
                      <DollarSign className="w-4 h-4 text-slate-500" /> Buat Pembayaran
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => goToAdd('suppliers')}>
                      <Users className="w-4 h-4 text-slate-500" /> Tambah Supplier
                    </button>
                  </div>
                </>
              )}
            </div>
            {effectiveTab === 'ringkasan' && (
              <AutoRefreshControl onRefresh={fetchSummary} disabled={loading} size="sm" />
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                effectiveTab === t.id ? 'bg-[#0D1A63] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {effectiveTab !== 'ringkasan' && (
        <div className="min-h-[200px]">
          {effectiveTab === 'suppliers' && <AccountingPurchasingSuppliersPage embedded triggerCreate={actionCreate && effectiveTab === 'suppliers'} onClearCreateTrigger={clearAction} />}
          {effectiveTab === 'orders' && <AccountingPurchasingOrdersPage embedded triggerCreate={actionCreate && effectiveTab === 'orders'} onClearCreateTrigger={clearAction} />}
          {effectiveTab === 'invoices' && <AccountingPurchasingInvoicesPage embedded triggerCreate={actionCreate && effectiveTab === 'invoices'} onClearCreateTrigger={clearAction} />}
          {effectiveTab === 'payments' && <AccountingPurchasingPaymentsPage embedded triggerCreate={actionCreate && effectiveTab === 'payments'} onClearCreateTrigger={clearAction} />}
        </div>
      )}

      {effectiveTab === 'ringkasan' && (
        <>
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3">{error}</div>
      )}

      {/* Ringkasan global */}
      <Card className="travel-card">
        {loading && !data ? (
          <ContentLoading />
        ) : (
          <div className="space-y-6">
            <CardSectionHeader
              icon={<Package className="w-6 h-6" />}
              title="Ringkasan"
              subtitle="Total supplier dan agregat pembelian"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Users className="w-5 h-5" />} label="Total Supplier" value={suppliersCount} iconClassName="bg-slate-600 text-white" />
              <StatCard icon={<FileText className="w-5 h-5" />} label="Total PO" value={totalPo} iconClassName="bg-blue-600 text-white" />
              <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Faktur" value={totalInv} iconClassName="bg-amber-600 text-white" />
              <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Hutang (Sisa)" value={formatIDR(totalRemaining)} iconClassName="bg-amber-100 text-amber-700" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTab('suppliers')}>
                <Users className="w-4 h-4 mr-2" /> Master Supplier
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Tab filter per product */}
      <Card>
        <CardSectionHeader
          icon={<Package className="w-6 h-6" />}
          title="Pembelian per Product"
          subtitle="Pilih tab product untuk memfilter. Setiap pembelian baru wajib ada bukti."
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {PURCHASING_PRODUCT_TABS.map((tab) => (
            <Button
              key={tab.id || 'all'}
              type="button"
              variant={selectedProductType === tab.id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedProductType(tab.id)}
              className={selectedProductType === tab.id ? '' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {loading && !data ? (
          <ContentLoading />
        ) : (
          <Table
            columns={[
              { id: 'product', label: 'Product', align: 'left' },
              { id: 'po_count', label: 'PO', align: 'right' },
              { id: 'invoice_count', label: 'Faktur', align: 'right' },
              { id: 'total_amount', label: 'Total', align: 'right' },
              { id: 'paid_amount', label: 'Terbayar', align: 'right' },
              { id: 'remaining_amount', label: 'Sisa', align: 'right' },
              { id: 'actions', label: 'Aksi', align: 'right' }
            ] as TableColumn[]}
            data={filteredByProduct}
            emptyMessage={selectedProductType ? 'Tidak ada data pembelian untuk tipe product ini.' : 'Belum ada data pembelian per product.'}
            renderRow={(row) => {
              const typeLabel = PRODUCT_TYPE_LABELS[row.product_type] ?? row.product_type;
              return (
                <tr key={row.product_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-900">{row.product_name}</span>
                    <span className="text-slate-500 ml-1 text-sm">({typeLabel})</span>
                  </td>
                  <td className="py-3 px-4 text-right">{row.po_count}</td>
                  <td className="py-3 px-4 text-right">{row.invoice_count}</td>
                  <td className="py-3 px-4 text-right">{formatIDR(row.total_amount)}</td>
                  <td className="py-3 px-4 text-right text-blue-600">{formatIDR(row.paid_amount)}</td>
                  <td className="py-3 px-4 text-right text-amber-600">{formatIDR(row.remaining_amount)}</td>
                  <td className="py-3 px-4 text-right">
                    <ActionsMenu
                      items={[
                        { id: 'po', label: 'PO', icon: <FileText className="w-4 h-4" />, onClick: () => setTabWithProduct('orders', row.product_id) },
                        { id: 'faktur', label: 'Faktur', icon: <Receipt className="w-4 h-4" />, onClick: () => setTabWithProduct('invoices', row.product_id) },
                        { id: 'pembayaran', label: 'Pembayaran', icon: <DollarSign className="w-4 h-4" />, onClick: () => setTabWithProduct('payments', row.product_id) },
                        { id: 'hapus', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteByProduct(row), danger: true }
                      ] as ActionsMenuItem[]}
                    />
                  </td>
                </tr>
              );
            }}
          />
        )}
      </Card>
        </>
      )}
    </div>
  );
};

export default AccountingPurchasingPage;
