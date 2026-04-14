import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/common/Input';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/settings/users-status');
      setUsers(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat data user');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((u) => `${u.name || ''} ${u.email || ''} ${u.role || ''}`.toLowerCase().includes(keyword));
  }, [users, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manajemen User"
        subtitle="Pantau akun jamaah dan admin yang terdaftar di platform."
        right={(
          <button type="button" onClick={loadData} className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-50">
            Refresh
          </button>
        )}
      />

      <Card padding="sm">
        <Input name="q" placeholder="Cari nama / email / role" value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>

      {error && (
        <Card padding="sm">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3">Nama</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-500">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-500">Belum ada data user</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="border-b border-stone-100">
                  <td className="px-4 py-3 font-medium text-stone-900">{u.name || '-'}</td>
                  <td className="px-4 py-3 text-stone-600">{u.email || '-'}</td>
                  <td className="px-4 py-3 text-stone-700">{u.role || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default UsersPage;
