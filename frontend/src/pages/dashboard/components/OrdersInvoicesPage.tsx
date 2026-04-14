import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/common/Input';

const OrdersInvoicesPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [ordersRes, invoicesRes] = await Promise.all([api.get('/orders'), api.get('/invoices')]);
      setOrders(Array.isArray(ordersRes?.data?.data) ? ordersRes.data.data : []);
      setInvoices(Array.isArray(invoicesRes?.data?.data) ? invoicesRes.data.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat order dan invoice');
      setOrders([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const keyword = q.trim().toLowerCase();
  const filteredOrders = useMemo(
    () => (!keyword ? orders : orders.filter((o) => JSON.stringify(o).toLowerCase().includes(keyword))),
    [orders, keyword]
  );
  const filteredInvoices = useMemo(
    () => (!keyword ? invoices : invoices.filter((i) => JSON.stringify(i).toLowerCase().includes(keyword))),
    [invoices, keyword]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Order & Invoice"
        subtitle="Pantau seluruh transaksi jamaah dari order sampai status pembayaran."
        right={(
          <button type="button" onClick={loadData} className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-50">
            Refresh
          </button>
        )}
      />

      <Card padding="sm">
        <Input name="search" placeholder="Cari data order / invoice" value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>

      {error && (
        <Card padding="sm">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="none">
          <div className="px-4 py-3 border-b border-stone-200">
            <h3 className="font-semibold text-stone-900">Daftar Order ({filteredOrders.length})</h3>
          </div>
          <div className="max-h-[420px] overflow-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-stone-500">Memuat...</p>
            ) : filteredOrders.length === 0 ? (
              <p className="px-4 py-6 text-sm text-stone-500">Belum ada order</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {filteredOrders.map((o) => (
                  <li key={o.id} className="px-4 py-3">
                    <p className="font-medium text-stone-900">{o.order_number || o.id}</p>
                    <p className="text-xs text-stone-500 mt-1">Status: {o.status || '-'} | Total: Rp {Number(o.total_amount || 0).toLocaleString('id-ID')}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card padding="none">
          <div className="px-4 py-3 border-b border-stone-200">
            <h3 className="font-semibold text-stone-900">Daftar Invoice ({filteredInvoices.length})</h3>
          </div>
          <div className="max-h-[420px] overflow-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-stone-500">Memuat...</p>
            ) : filteredInvoices.length === 0 ? (
              <p className="px-4 py-6 text-sm text-stone-500">Belum ada invoice</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {filteredInvoices.map((i) => (
                  <li key={i.id} className="px-4 py-3">
                    <p className="font-medium text-stone-900">{i.invoice_number || i.id}</p>
                    <p className="text-xs text-stone-500 mt-1">Status: {i.status || '-'} | Tagihan: Rp {Number(i.total_amount || 0).toLocaleString('id-ID')}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OrdersInvoicesPage;
