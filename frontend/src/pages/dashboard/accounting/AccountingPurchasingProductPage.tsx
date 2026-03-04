import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hotel, Plane, FileText, Bus, HandHelping, ChevronRight, Package } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import ContentLoading from '../../../components/common/ContentLoading';
import { accountingApi } from '../../../services/api';
import { formatIDR } from '../../../utils';

const PRODUCT_TYPE_PARAM: Record<string, string> = {
  hotel: 'hotel',
  visa: 'visa',
  ticket: 'ticket',
  bus: 'bus',
  handling: 'handling'
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel',
  visa: 'Visa',
  ticket: 'Tiket',
  bus: 'Bus',
  handling: 'Handling'
};

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  hotel: <Hotel className="w-6 h-6" />,
  visa: <Plane className="w-6 h-6" />,
  ticket: <FileText className="w-6 h-6" />,
  bus: <Bus className="w-6 h-6" />,
  handling: <HandHelping className="w-6 h-6" />
};

const AccountingPurchasingProductPage: React.FC = () => {
  const { productType } = useParams<{ productType: string }>();
  const navigate = useNavigate();
  const type = productType ? PRODUCT_TYPE_PARAM[productType] || productType : '';
  const [product, setProduct] = useState<{ id: string; code: string; name: string; type: string } | null>(null);
  const [summary, setSummary] = useState<{ po_count: number; invoice_count: number; total_amount: number; paid_amount: number; remaining_amount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    accountingApi.getPurchasingSummary()
      .then((r) => {
        if (r.data.success && r.data.data) {
          const products = r.data.data.products || [];
          const byProduct = r.data.data.by_product || [];
          const p = products.find((x: { type: string }) => (x.type || '').toLowerCase() === type);
          setProduct(p || null);
          if (p) {
            const row = byProduct.find((x: { product_id: string }) => x.product_id === p.id);
            setSummary(row ? {
              po_count: row.po_count || 0,
              invoice_count: row.invoice_count || 0,
              total_amount: row.total_amount || 0,
              paid_amount: row.paid_amount || 0,
              remaining_amount: row.remaining_amount || 0
            } : null);
          } else setSummary(null);
        } else setProduct(null);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [type]);

  const label = PRODUCT_TYPE_LABELS[type] || type;
  const icon = PRODUCT_ICONS[type];

  if (!type) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pembelian" subtitle="Product tidak valid." />
      </div>
    );
  }

  if (loading && !product) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Pembelian – ${label}`} subtitle="Memuat..." />
        <Card><ContentLoading /></Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Pembelian – ${label}`} subtitle="Product tidak ditemukan." />
        <Card className="p-6">
          <p className="text-slate-600">Product untuk tipe ini belum ada. Kembali ke <Button variant="ghost" size="sm" className="inline p-0 h-auto font-medium text-[#0D1A63] hover:underline" onClick={() => navigate('/dashboard/accounting/purchasing')}>Ringkasan Pembelian</Button>.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pembelian – ${label}`}
        subtitle={`PO, Faktur, dan Pembayaran untuk product ${product.name}. Setiap faktur pembelian wajib dilengkapi bukti.`}
      />

      <Card className="travel-card">
        <CardSectionHeader
          icon={icon}
          title={product.name}
          subtitle={`${label} · ${product.code || ''}`}
          className="mb-4"
        />
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide">PO</div>
              <div className="text-lg font-semibold text-slate-900">{summary.po_count}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Faktur</div>
              <div className="text-lg font-semibold text-slate-900">{summary.invoice_count}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Total</div>
              <div className="text-lg font-semibold text-slate-900">{formatIDR(summary.total_amount)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Terbayar</div>
              <div className="text-lg font-semibold text-blue-600">{formatIDR(summary.paid_amount)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Sisa</div>
              <div className="text-lg font-semibold text-amber-600">{formatIDR(summary.remaining_amount)}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="flex flex-col h-24 gap-2 justify-center items-center hover:bg-slate-50 border-slate-200"
            onClick={() => navigate(`/dashboard/accounting/purchasing/orders?product_id=${product.id}`)}
          >
            <FileText className="w-6 h-6 text-blue-600 shrink-0" />
            <span className="text-sm font-medium text-center">PO Pembelian</span>
            <span className="text-xs text-slate-500 flex items-center gap-1">Lihat & buat <ChevronRight className="w-3 h-3" /></span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col h-24 gap-2 justify-center items-center hover:bg-slate-50 border-slate-200"
            onClick={() => navigate(`/dashboard/accounting/purchasing/invoices?product_id=${product.id}`)}
          >
            <Package className="w-6 h-6 text-amber-600 shrink-0" />
            <span className="text-sm font-medium text-center">Faktur Pembelian</span>
            <span className="text-xs text-slate-500 flex items-center gap-1">Wajib ada bukti <ChevronRight className="w-3 h-3" /></span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col h-24 gap-2 justify-center items-center hover:bg-slate-50 border-slate-200"
            onClick={() => navigate(`/dashboard/accounting/purchasing/payments?product_id=${product.id}`)}
          >
            <span className="text-lg font-semibold text-green-600">Rp</span>
            <span className="text-sm font-medium text-center">Pembayaran Pembelian</span>
            <span className="text-xs text-slate-500 flex items-center gap-1">Lihat & bayar <ChevronRight className="w-3 h-3" /></span>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AccountingPurchasingProductPage;
