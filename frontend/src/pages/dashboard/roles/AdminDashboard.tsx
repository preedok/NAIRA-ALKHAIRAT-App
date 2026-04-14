import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';

interface AnalyticsData {
  total_orders: number;
  total_invoices: number;
  total_users: number;
}

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    total_orders: 0,
    total_invoices: 0,
    total_users: 0
  });
  const [pendingProfiles, setPendingProfiles] = useState(0);
  const [activeKloters, setActiveKloters] = useState(0);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsRes, pendingRes, klotersRes] = await Promise.all([
        api.get('/reports/analytics'),
        api.get('/jamaah-profiles/admin/pending'),
        api.get('/kloters')
      ]);
      setAnalytics(analyticsRes?.data?.data || { total_orders: 0, total_invoices: 0, total_users: 0 });
      const pending = Array.isArray(pendingRes?.data?.data) ? pendingRes.data.data.length : 0;
      setPendingProfiles(pending);
      const kloters = Array.isArray(klotersRes?.data?.data) ? klotersRes.data.data : [];
      setActiveKloters(kloters.filter((k: any) => k.status === 'open' || k.status === 'active').length);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat ringkasan dashboard admin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const cards = useMemo(
    () => [
      { label: 'Total Jamaah', value: analytics.total_users },
      { label: 'Total Order', value: analytics.total_orders },
      { label: 'Total Invoice', value: analytics.total_invoices },
      { label: 'Profil Menunggu Verifikasi', value: pendingProfiles },
      { label: 'Kloter Aktif', value: activeKloters }
    ],
    [analytics, pendingProfiles, activeKloters]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard Admin"
        subtitle="Ringkasan operasional B2C untuk memantau jamaah, transaksi, dan proses keberangkatan."
        right={(
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-50"
          >
            Refresh
          </button>
        )}
      />

      {error && (
        <Card padding="sm">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((item) => (
          <Card key={item.label} padding="md">
            <p className="text-sm text-stone-500">{item.label}</p>
            <p className="text-2xl font-bold text-stone-900 mt-2">
              {loading ? '...' : Number(item.value || 0).toLocaleString('id-ID')}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
