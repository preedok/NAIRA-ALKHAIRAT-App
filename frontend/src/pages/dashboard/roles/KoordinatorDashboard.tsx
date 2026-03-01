import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Users, FileText, Hotel, Plane, Bus, RefreshCw, Settings } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import Table from '../../../components/common/Table';
import { koordinatorApi, ordersApi } from '../../../services/api';
import type { TableColumn } from '../../../types';

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
      <PageHeader
        title="Dashboard Koordinator Wilayah"
        subtitle="Rekapitulasi wilayah Anda: order, owner, dan pekerjaan. Hanya data wilayah Anda."
        right={
          <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="cursor-pointer" onClick={() => navigate('/dashboard/orders-invoices')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/orders-invoices')}>
          <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Order Wilayah" value={orders.total ?? 0} subtitle="Order & invoice wilayah Anda" iconClassName="bg-[#0D1A63] text-white" />
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/dashboard/koordinator/owners')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/koordinator/owners')}>
          <StatCard icon={<Users className="w-5 h-5" />} label="Owner di Wilayah" value={owners.total ?? 0} subtitle="Owner yang dilayani koordinator wilayah Anda" iconClassName="bg-[#0D1A63] text-white" />
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/dashboard/products')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard/products')}>
          <StatCard icon={<Settings className="w-5 h-5" />} label="Pengaturan Harga" value="Harga General & Khusus" subtitle="Produk, paket, kurs cabang di wilayah" iconClassName="bg-amber-100 text-amber-600" />
        </div>
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
          <Table
            columns={[
              { id: 'name', label: 'Nama / Perusahaan', align: 'left' },
              { id: 'email', label: 'Email', align: 'left' },
              { id: 'status', label: 'Status', align: 'left' },
              { id: 'actions', label: 'Aksi', align: 'left' }
            ] as TableColumn[]}
            data={(owners.list as any[]).slice(0, 10)}
            emptyMessage="Belum ada owner"
            pagination={
              (owners.list as any[])?.length > 0
                ? {
                    total: (owners.list as any[]).length,
                    page: 1,
                    limit: 10,
                    totalPages: Math.ceil((owners.list as any[]).length / 10) || 1,
                    onPageChange: () => {},
                    onLimitChange: () => {}
                  }
                : undefined
            }
            renderRow={(o: { id: string; User?: { name: string; company_name?: string; email?: string }; status: string }) => (
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
            )}
          />
          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/koordinator/owners')}>
              Lihat semua owner
            </Button>
          </div>
        </Card>
      )}

      {(d.orders_recent?.length ?? 0) > 0 && (
        <Card>
          <CardSectionHeader
            icon={<Receipt className="w-6 h-6" />}
            title="Invoice Terbaru (wilayah)"
            subtitle="Daftar invoice terbaru di wilayah Anda"
            className="mb-3"
          />
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
