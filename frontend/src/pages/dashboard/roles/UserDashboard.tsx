import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';

const UserDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileStatus, setProfileStatus] = useState('belum_diisi');
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [activeInstallments, setActiveInstallments] = useState(0);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRes, invoicesRes, installmentsRes] = await Promise.all([
        api.get('/jamaah-profiles/me'),
        api.get('/invoices'),
        api.get('/installments/me')
      ]);
      setProfileStatus(profileRes?.data?.data?.profile_status || 'belum_diisi');
      const invoices = Array.isArray(invoicesRes?.data?.data) ? invoicesRes.data.data : [];
      setInvoiceCount(invoices.length);
      const plans = Array.isArray(installmentsRes?.data?.data) ? installmentsRes.data.data : [];
      const items = plans.flatMap((p: any) => (Array.isArray(p.Items) ? p.Items : []));
      setActiveInstallments(items.filter((x: any) => x.status === 'pending' || x.status === 'late').length);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat dashboard jamaah');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard Jamaah"
        subtitle="Pantau progres profil, tagihan, dan cicilan Anda di satu tempat."
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-stone-500">Status Profil</p>
          <p className="text-lg font-bold text-stone-900 mt-2">{loading ? '...' : profileStatus}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Jumlah Invoice</p>
          <p className="text-lg font-bold text-stone-900 mt-2">{loading ? '...' : invoiceCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Cicilan Aktif</p>
          <p className="text-lg font-bold text-stone-900 mt-2">{loading ? '...' : activeInstallments}</p>
        </Card>
      </div>
    </div>
  );
};

export default UserDashboard;
