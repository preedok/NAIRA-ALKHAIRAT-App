import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Receipt, DollarSign, ChevronRight, Package } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import StatCard from '../../../components/common/StatCard';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import ContentLoading from '../../../components/common/ContentLoading';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { accountingApi, type PurchasingByProduct } from '../../../services/api';
import { formatIDR } from '../../../utils';

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel',
  visa: 'Visa',
  ticket: 'Tiket',
  bus: 'Bus',
  handling: 'Handling',
  package: 'Paket'
};

const AccountingPurchasingPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<{ products: Array<{ id: string; code: string; name: string; type: string }>; by_product: PurchasingByProduct[]; suppliers_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Modul Pembelian"
        subtitle="Pembelian product baru ke supplier sesuai product yang ada di aplikasi (Hotel, Visa, Tiket, Bus, Handling)"
        right={
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={fetchSummary} disabled={loading} size="sm" />
          </div>
        }
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3">{error}</div>
      )}

      <Card className="travel-card">
        {loading && !data ? (
          <ContentLoading />
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Users className="w-5 h-5" />}
                label="Total Supplier"
                value={suppliersCount}
                iconClassName="bg-slate-600 text-white"
              />
              <StatCard
                icon={<FileText className="w-5 h-5" />}
                label="Total PO"
                value={byProduct.reduce((s, r) => s + r.po_count, 0)}
                iconClassName="bg-blue-600 text-white"
              />
              <StatCard
                icon={<Receipt className="w-5 h-5" />}
                label="Total Faktur"
                value={byProduct.reduce((s, r) => s + r.invoice_count, 0)}
                iconClassName="bg-amber-600 text-white"
              />
              <StatCard
                icon={<DollarSign className="w-5 h-5" />}
                label="Total Hutang (Sisa)"
                value={formatIDR(byProduct.reduce((s, r) => s + r.remaining_amount, 0))}
                iconClassName="bg-amber-100 text-amber-700"
              />
            </div>

            <div>
              <CardSectionHeader
                icon={<Package className="w-6 h-6" />}
                title="Pembelian per Product"
                subtitle="Ringkasan per product: Hotel, Visa, Tiket, Bus, Handling"
              />
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
                data={byProduct}
                emptyMessage="Belum ada data pembelian per product"
                renderRow={(row) => (
                  <tr key={row.product_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">{row.product_name}</span>
                      <span className="text-slate-500 ml-1">({PRODUCT_TYPE_LABELS[row.product_type] ?? row.product_type})</span>
                    </td>
                    <td className="py-3 px-4 text-right">{row.po_count}</td>
                    <td className="py-3 px-4 text-right">{row.invoice_count}</td>
                    <td className="py-3 px-4 text-right">{formatIDR(row.total_amount)}</td>
                    <td className="py-3 px-4 text-right text-blue-600">{formatIDR(row.paid_amount)}</td>
                    <td className="py-3 px-4 text-right text-amber-600">{formatIDR(row.remaining_amount)}</td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => navigate(`/dashboard/accounting/purchasing/orders?product_id=${row.product_id}`)}
                      >
                        Lihat PO <ChevronRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                )}
              />
            </div>

            <div>
              <CardSectionHeader title="Aksi Cepat" subtitle="Akses langsung ke modul pembelian" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/accounting/purchasing/suppliers')}>
                  <Users className="w-5 h-5 text-slate-600 shrink-0" />
                  <span className="text-xs font-medium text-center leading-tight">Master Supplier</span>
                </Button>
                <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/accounting/purchasing/orders')}>
                  <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-xs font-medium text-center leading-tight">PO Pembelian</span>
                </Button>
                <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/accounting/purchasing/invoices')}>
                  <Receipt className="w-5 h-5 text-amber-600 shrink-0" />
                  <span className="text-xs font-medium text-center leading-tight">Faktur Pembelian</span>
                </Button>
                <Button variant="outline" className="flex flex-col h-20 gap-2 justify-center items-center hover:bg-slate-50" onClick={() => navigate('/dashboard/accounting/purchasing/payments')}>
                  <DollarSign className="w-5 h-5 text-green-600 shrink-0" />
                  <span className="text-xs font-medium text-center leading-tight">Pembayaran Pembelian</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AccountingPurchasingPage;
