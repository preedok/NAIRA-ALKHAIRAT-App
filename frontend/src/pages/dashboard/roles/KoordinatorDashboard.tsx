import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Users, FileText, Hotel, Plane, Bus, RefreshCw, Settings } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { koordinatorApi, ordersApi } from '../../../services/api';

const OWNER_STATUS_LABELS: Record<string, string> = {
  registered_pending_mou: 'Pending MoU',
  pending_mou_approval: 'Menunggu Approve MoU',
  pending_deposit_payment: 'Bayar Deposit',
  pending_deposit_verification: 'Verifikasi Deposit',
  deposit_verified: 'Siap Ditetapkan Cabang',
  assigned_to_branch: 'Siap Aktivasi',
  active: 'Aktif',
  rejected: 'Ditolak'
};

const KoordinatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await koordinatorApi.getDashboard();
      if (res.data.success) setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  const d = data || {};
  const orders = d.orders || {};
  const owners = d.owners || {};
  const recapInv = d.recap_invoice || {};
  const recapHotel = d.recap_hotel || {};
  const recapVisa = d.recap_visa || {};
  const recapTicket = d.recap_ticket || {};
  const recapBus = d.recap_bus || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Koordinator Wilayah</h1>
          <p className="text-slate-600 mt-1">Rekapitulasi wilayah Anda: order, owner, dan pekerjaan. Hanya data wilayah Anda.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card hover><div className="cursor-pointer" onClick={() => navigate('/dashboard/orders-invoices')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/orders-invoices')}>
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
              <Receipt className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2">Total Order Wilayah</p>
          <p className="text-2xl font-bold text-slate-900">{orders.total ?? 0}</p>
          <p className="text-xs text-slate-500">Order & invoice wilayah Anda</p>
        </div></Card>
        <Card hover><div className="cursor-pointer" onClick={() => navigate('/dashboard/koordinator/owners')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/koordinator/owners')}>
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2">Owner di Wilayah</p>
          <p className="text-2xl font-bold text-slate-900">{owners.total ?? 0}</p>
          <p className="text-xs text-slate-500">Owner yang dilayani koordinator wilayah Anda</p>
        </div></Card>
        <Card hover><div className="cursor-pointer" onClick={() => navigate('/dashboard/products')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/products')}>
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Settings className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2">Pengaturan Harga</p>
          <p className="text-lg font-bold text-slate-900">Harga General & Khusus</p>
          <p className="text-xs text-slate-500">Produk, paket, kurs cabang di wilayah</p>
        </div></Card>
        <Card>
          <div className="p-3 rounded-xl bg-slate-100 text-slate-600">
            <p className="text-sm font-medium">Wilayah Anda</p>
            <p className="text-xs mt-1">Owner dari daerah lain tidak tampil di sini. Hanya orderan wilayah Anda.</p>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-bold text-slate-900 mb-3">Rekap Pekerjaan per Role (wilayah)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="font-semibold text-slate-700 flex items-center gap-2"><FileText className="w-4 h-4" /> Invoice</p>
            <p className="text-slate-600">Total: {recapInv.total ?? 0}</p>
            <p className="text-xs text-slate-500">By status: {JSON.stringify(recapInv.by_status || {})}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="font-semibold text-slate-700 flex items-center gap-2"><Hotel className="w-4 h-4" /> Hotel</p>
            <p className="text-slate-600">Total item: {recapHotel.total ?? 0}</p>
            <p className="text-xs text-slate-500">By status: {JSON.stringify(recapHotel.by_status || {})}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="font-semibold text-slate-700 flex items-center gap-2"><FileText className="w-4 h-4" /> Visa</p>
            <p className="text-slate-600">Total item: {recapVisa.total ?? 0}</p>
            <p className="text-xs text-slate-500">By status: {JSON.stringify(recapVisa.by_status || {})}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="font-semibold text-slate-700 flex items-center gap-2"><Plane className="w-4 h-4" /> Tiket</p>
            <p className="text-slate-600">Total item: {recapTicket.total ?? 0}</p>
            <p className="text-xs text-slate-500">By status: {JSON.stringify(recapTicket.by_status || {})}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="font-semibold text-slate-700 flex items-center gap-2"><Bus className="w-4 h-4" /> Bus</p>
            <p className="text-slate-600">Total item: {recapBus.total ?? 0}</p>
            <p className="text-xs text-slate-500">By status: {JSON.stringify(recapBus.by_status || {})}</p>
          </div>
        </div>
      </Card>

      {orders.by_status && Object.keys(orders.by_status).length > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Order Wilayah per Status</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(orders.by_status).map(([status, count]) => (
              <span key={status} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm">
                {status}: <strong>{Number(count)}</strong>
              </span>
            ))}
          </div>
        </Card>
      )}

      {(owners.list?.length ?? 0) > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Owner di Wilayah Anda</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 px-3">Nama / Perusahaan</th>
                  <th className="text-left py-2 px-3">Email</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(owners.list as any[]).slice(0, 10).map((o: { id: string; User?: { name: string; company_name?: string; email?: string }; status: string }) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="py-2 px-3">{o.User?.name} {o.User?.company_name && `(${o.User.company_name})`}</td>
                    <td className="py-2 px-3">{o.User?.email}</td>
                    <td className="py-2 px-3">{OWNER_STATUS_LABELS[o.status] || o.status}</td>
                    <td className="py-2 px-3">
                      <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/koordinator/owners?id=' + o.id)}>
                        Kelola
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/koordinator/owners')}>
              Lihat semua owner
            </Button>
          </div>
        </Card>
      )}

      {(d.orders_recent?.length ?? 0) > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Invoice Terbaru (wilayah)</h3>
          <ul className="space-y-2">
            {d.orders_recent.slice(0, 5).map((o: any) => (
              <li key={o.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                <span className="font-medium">{o.order_number}</span>
                <span className="text-slate-600">{o.User?.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={sendingId === o.id}
                  onClick={async () => {
                    setSendingId(o.id);
                    try {
                      await ordersApi.sendResult(o.id, 'both');
                      showToast('Notifikasi hasil order telah dikirim ke owner.', 'success');
                    } catch (e: any) {
                      showToast(e.response?.data?.message || 'Gagal mengirim', 'error');
                    } finally {
                      setSendingId(null);
                    }
                  }}
                >
                  {sendingId === o.id ? 'Mengirim...' : 'Kirim hasil ke owner'}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!data && !loading && (
        <Card>
          <p className="text-slate-600 text-center py-8">Tidak ada data wilayah. Pastikan akun Anda terikat ke wilayah.</p>
        </Card>
      )}
    </div>
  );
};

export default KoordinatorDashboard;
