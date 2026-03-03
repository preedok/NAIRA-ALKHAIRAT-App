import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Receipt, DollarSign, ChevronRight, Package, Hotel, Plane, Bus, HandHelping } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import StatCard from '../../../components/common/StatCard';
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

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  hotel: <Hotel className="w-5 h-5" />,
  visa: <FileText className="w-5 h-5" />,
  ticket: <Plane className="w-5 h-5" />,
  bus: <Bus className="w-5 h-5" />,
  handling: <HandHelping className="w-5 h-5" />,
  package: <Package className="w-5 h-5" />
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
  const totalPo = byProduct.reduce((s, r) => s + r.po_count, 0);
  const totalInv = byProduct.reduce((s, r) => s + r.invoice_count, 0);
  const totalRemaining = byProduct.reduce((s, r) => s + r.remaining_amount, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Modul Pembelian"
        subtitle="Pembelian product baru ke supplier per product. Setiap pembelian wajib dilampiri bukti."
        right={
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={fetchSummary} disabled={loading} size="sm" />
          </div>
        }
      />

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
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/accounting/purchasing/suppliers')}>
                <Users className="w-4 h-4 mr-2" /> Master Supplier
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Per product: card tiap product dengan stat + aksi */}
      <CardSectionHeader
        icon={<Package className="w-6 h-6" />}
        title="Pembelian per Product"
        subtitle="Pilih product untuk mengelola PO, Faktur, dan Pembayaran. Setiap pembelian baru wajib ada bukti."
      />
      {loading && !data ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {byProduct.map((row) => {
            const typeLabel = PRODUCT_TYPE_LABELS[row.product_type] ?? row.product_type;
            const Icon = PRODUCT_ICONS[row.product_type] ?? <Package className="w-5 h-5" />;
            return (
              <Card key={row.product_id} className="p-5 border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-600">{Icon}</div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{row.product_name}</h3>
                    <p className="text-sm text-slate-500">{typeLabel}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <div className="text-slate-600">PO</div>
                  <div className="text-right font-medium">{row.po_count}</div>
                  <div className="text-slate-600">Faktur</div>
                  <div className="text-right font-medium">{row.invoice_count}</div>
                  <div className="text-slate-600">Sisa hutang</div>
                  <div className="text-right font-medium text-amber-600">{formatIDR(row.remaining_amount)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => navigate(`/dashboard/accounting/purchasing/orders?product_id=${row.product_id}`)}
                  >
                    PO <ChevronRight className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => navigate(`/dashboard/accounting/purchasing/invoices?product_id=${row.product_id}`)}
                  >
                    Faktur <ChevronRight className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => navigate(`/dashboard/accounting/purchasing/payments?product_id=${row.product_id}`)}
                  >
                    Pembayaran <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && byProduct.length === 0 && (
        <Card className="p-8 text-center text-slate-500">
          Belum ada data pembelian per product. Tambah PO dan Faktur per product dari menu di atas.
        </Card>
      )}
    </div>
  );
};

export default AccountingPurchasingPage;
