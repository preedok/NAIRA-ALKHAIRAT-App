import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, RefreshCw, Wallet, Clock, CheckCircle, XCircle, Banknote } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { formatIDR } from '../../../utils';
import { refundsApi, type RefundStats } from '../../../services/api';

/** Refund - halaman untuk admin pusat & role accounting (lihat & update status permintaan refund). */

const STATUS_LABELS: Record<string, string> = { requested: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', refunded: 'Sudah direfund' };
const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error'> = { requested: 'warning', approved: 'default', rejected: 'error', refunded: 'success' };

const RefundsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const canUpdateStatus = user?.role === 'admin_pusat' || user?.role === 'super_admin' || user?.role === 'role_accounting';

  const fetchStats = useCallback(() => {
    const params: { status?: string } = {};
    if (statusFilter) params.status = statusFilter;
    refundsApi.getStats(params)
      .then((r) => { if (r.data.success && r.data.data) setStats(r.data.data); })
      .catch(() => setStats(null));
  }, [statusFilter]);

  const fetchRefunds = useCallback(() => {
    setLoading(true);
    const params: { limit?: number; page?: number; status?: string; owner_id?: string } = { limit: 100, page: 1 };
    if (statusFilter) params.status = statusFilter;
    refundsApi.list(params)
      .then((res) => {
        const d = (res.data as any)?.data;
        setList(Array.isArray(d) ? d : []);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  const handleUpdateStatus = (id: string, status: string, rejection_reason?: string) => {
    setUpdatingId(id);
    refundsApi.updateStatus(id, { status, rejection_reason })
      .then(() => {
        showToast(`Status diubah menjadi ${STATUS_LABELS[status] || status}`, 'success');
        fetchStats();
        fetchRefunds();
      })
      .catch((e: any) => showToast(e.response?.data?.message || 'Gagal update status', 'error'))
      .finally(() => setUpdatingId(null));
  };

  const onRefresh = () => {
    fetchStats();
    fetchRefunds();
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Refund</h1>
          <p className="text-stone-600 mt-1">
            {canUpdateStatus ? 'Daftar permintaan refund. Ubah status (Disetujui / Ditolak / Sudah direfund) untuk memproses.' : 'Daftar permintaan refund Anda.'}
          </p>
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-3 py-2">
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card hover className="travel-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-card">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-stone-600">Total Refund</p>
              <p className="text-xl font-bold text-stone-900 tabular-nums">{stats?.total_refunds ?? '–'}</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-stone-600">Menunggu</p>
              <p className="text-xl font-bold text-stone-900 tabular-nums">{stats?.requested ?? '–'}</p>
              {(stats?.amount_pending ?? 0) > 0 && (
                <p className="text-xs text-stone-500 mt-0.5">{formatIDR(stats!.amount_pending)}</p>
              )}
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-600">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-stone-600">Disetujui</p>
              <p className="text-xl font-bold text-stone-900 tabular-nums">{stats?.approved ?? '–'}</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 text-red-600">
              <XCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-stone-600">Ditolak</p>
              <p className="text-xl font-bold text-stone-900 tabular-nums">{stats?.rejected ?? '–'}</p>
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-stone-600">Sudah direfund</p>
              <p className="text-xl font-bold text-stone-900 tabular-nums">{stats?.refunded ?? '–'}</p>
              {(stats?.amount_refunded ?? 0) > 0 && (
                <p className="text-xs text-stone-500 mt-0.5">{formatIDR(stats!.amount_refunded)}</p>
              )}
            </div>
          </div>
        </Card>
        <Card hover className="travel-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-100 text-teal-600">
              <Banknote className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-stone-600">Nominal Pending</p>
              <p className="text-lg font-bold text-stone-900 tabular-nums">{formatIDR(stats?.amount_requested ?? 0)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Belum ada permintaan refund</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Invoice / Order</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Owner</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Jumlah</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Rekening</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  {canUpdateStatus && <th className="text-left py-3 px-4 font-semibold text-slate-700 sticky right-0 z-10 bg-slate-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <span className="font-medium">{r.Invoice?.invoice_number || '-'}</span>
                      <span className="text-slate-500 ml-1">{r.Order?.order_number}</span>
                    </td>
                    <td className="py-3 px-4">
                      {r.Owner ? <span>{r.Owner.name || r.Owner.company_name}</span> : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-700">{formatIDR(parseFloat(r.amount))}</td>
                    <td className="py-3 px-4 text-slate-600">{r.bank_name && r.account_number ? `${r.bank_name} ${r.account_number}` : '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={STATUS_VARIANT[r.status] || 'default'}>{STATUS_LABELS[r.status] || r.status}</Badge>
                    </td>
                    {canUpdateStatus && (
                      <td className="py-3 px-4 sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                        {r.status === 'requested' && (
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="outline" disabled={updatingId === r.id} onClick={() => handleUpdateStatus(r.id, 'approved')}>Setujui</Button>
                            <Button size="sm" variant="outline" className="text-red-600" disabled={updatingId === r.id} onClick={() => handleUpdateStatus(r.id, 'rejected')}>Tolak</Button>
                            <Button size="sm" variant="primary" disabled={updatingId === r.id} onClick={() => handleUpdateStatus(r.id, 'refunded')}>{updatingId === r.id ? '...' : 'Tandai sudah direfund'}</Button>
                          </div>
                        )}
                        {r.status === 'approved' && (
                          <Button size="sm" variant="primary" disabled={updatingId === r.id} onClick={() => handleUpdateStatus(r.id, 'refunded')}>{updatingId === r.id ? '...' : 'Tandai sudah direfund'}</Button>
                        )}
                      </td>
                    )}
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

export default RefundsPage;
