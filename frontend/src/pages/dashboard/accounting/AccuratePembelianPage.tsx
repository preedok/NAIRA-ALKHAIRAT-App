import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, FileText, RotateCcw, CreditCard, RefreshCw } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { accountingApi } from '../../../services/api';

function formatDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';
}

const AccuratePembelianPage: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPO = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.accurate.listPurchaseOrders();
      setPurchaseOrders(res.data.success && Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPO(); }, [fetchPO]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Pembelian</h2>
        <p className="text-sm text-slate-600 mt-0.5">PO, Faktur pembelian, Retur pembelian, Hutang & pembayaran supplier.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><ShoppingCart className="w-5 h-5" /></div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Purchase Order</p>
              <p className="text-lg font-bold text-slate-900">{purchaseOrders.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 opacity-75">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-500 inline-block"><FileText className="w-5 h-5" /></div>
          <p className="text-xs font-medium text-slate-500 uppercase mt-2">Faktur Pembelian</p>
          <p className="text-sm text-slate-500">Segera hadir</p>
        </Card>
        <Card className="p-4 border border-slate-200 opacity-75">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-500 inline-block"><RotateCcw className="w-5 h-5" /></div>
          <p className="text-xs font-medium text-slate-500 uppercase mt-2">Retur Pembelian</p>
          <p className="text-sm text-slate-500">Segera hadir</p>
        </Card>
        <Card className="p-4 border border-slate-200 opacity-75">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-500 inline-block"><CreditCard className="w-5 h-5" /></div>
          <p className="text-xs font-medium text-slate-500 uppercase mt-2">Hutang & Pembayaran</p>
          <p className="text-sm text-slate-500">Segera hadir</p>
        </Card>
      </div>
      <Card className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Daftar Purchase Order</h3>
          <Button variant="outline" size="sm" onClick={fetchPO} disabled={loading}>
            <RefreshCw className={loading ? 'w-4 h-4 mr-2 animate-spin' : 'w-4 h-4 mr-2'} /> Refresh
          </Button>
        </div>
        {loading && (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        )}
        {!loading && purchaseOrders.length === 0 && (
          <div className="py-12 text-center text-slate-500">Belum ada purchase order.</div>
        )}
        {!loading && purchaseOrders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">No. PO</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Tanggal</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Cabang</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-medium">{po.po_number || po.order_number || String(po.id).slice(0, 8)}</td>
                    <td className="py-3 px-4 text-slate-600">{formatDate(po.order_date || po.po_date)}</td>
                    <td className="py-3 px-4">{po.Branch ? po.Branch.name : (po.branch_id || '–')}</td>
                    <td className="py-3 px-4">{po.status || '–'}</td>
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

export default AccuratePembelianPage;
