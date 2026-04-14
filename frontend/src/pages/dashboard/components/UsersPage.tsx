import React, { useEffect, useMemo, useState } from 'react';
import { api, publicApi } from '../../../services/api';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/common/Input';
import { useAuth } from '../../../contexts/AuthContext';
import { normalizeUserRole } from '../../../types';

const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const myRole = normalizeUserRole(user?.role || 'jamaah');
  const isAdminPusat = myRole === 'admin_pusat';
  const isAdminCabang = myRole === 'admin_cabang';
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchProvinceId, setNewBranchProvinceId] = useState('');
  const [newBranchWilayahId, setNewBranchWilayahId] = useState('');
  const [provinces, setProvinces] = useState<Array<{ id: string; name: string }>>([]);
  const [branchWilayahOptions, setBranchWilayahOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'jamaah',
    branch_id: ''
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const [usersRes, branchesRes] = await Promise.all([
        api.get('/settings/users-status'),
        api.get('/settings/branches')
      ]);
      setUsers(Array.isArray(usersRes?.data?.data) ? usersRes.data.data : []);
      setBranches(Array.isArray(branchesRes?.data?.data) ? branchesRes.data.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat data user');
      setUsers([]);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    publicApi
      .getProvinces()
      .then((res) => {
        const data = Array.isArray(res?.data?.data) ? res.data.data : [];
        setProvinces(data);
      })
      .catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    if (!newBranchProvinceId) {
      setBranchWilayahOptions([]);
      setNewBranchWilayahId('');
      return;
    }
    publicApi
      .getWilayahs(newBranchProvinceId)
      .then((res) => {
        const data = Array.isArray(res?.data?.data) ? res.data.data : [];
        setBranchWilayahOptions(data);
        setNewBranchWilayahId((prev) => (data.some((w: { id: string }) => w.id === prev) ? prev : ''));
      })
      .catch(() => {
        setBranchWilayahOptions([]);
        setNewBranchWilayahId('');
      });
  }, [newBranchProvinceId]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((u) => `${u.name || ''} ${u.email || ''} ${u.role || ''}`.toLowerCase().includes(keyword));
  }, [users, q]);

  const onCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || !newBranchProvinceId || !newBranchWilayahId) return;
    setCreatingBranch(true);
    setError('');
    setMessage('');
    try {
      await api.post('/settings/branches', {
        name: newBranchName.trim(),
        province_id: newBranchProvinceId,
        wilayah_id: newBranchWilayahId
      });
      setNewBranchName('');
      setNewBranchProvinceId('');
      setNewBranchWilayahId('');
      setMessage('Cabang berhasil dibuat');
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal membuat cabang');
    } finally {
      setCreatingBranch(false);
    }
  };

  const onCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setError('');
    setMessage('');
    try {
      await api.post('/settings/users', {
        ...newUser,
        branch_id: newUser.branch_id || undefined
      });
      setNewUser({ name: '', email: '', phone: '', password: '', role: 'jamaah', branch_id: '' });
      setMessage('User berhasil dibuat');
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal membuat user');
    } finally {
      setCreatingUser(false);
    }
  };

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

      {isAdminPusat && (
        <Card>
          <h3 className="font-semibold text-stone-900 mb-3">Buat Cabang Baru</h3>
          <form onSubmit={onCreateBranch} className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <Input name="branch_name" placeholder="Nama cabang" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} />
            </div>
            <button type="submit" disabled={creatingBranch} className="px-4 py-2 rounded-lg bg-btn text-white hover:bg-btn-hover disabled:opacity-60">
              {creatingBranch ? 'Menyimpan...' : 'Tambah Cabang'}
            </button>
          </form>
        </Card>
      )}

      {(isAdminPusat || isAdminCabang) && (
        <Card>
          <h3 className="font-semibold text-stone-900 mb-3">Tambah User</h3>
          <form onSubmit={onCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input label="Nama" name="name" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} />
            <Input label="Email" name="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            <Input label="Telepon" name="phone" value={newUser.phone} onChange={(e) => setNewUser((p) => ({ ...p, phone: e.target.value }))} />
            <Input label="Password" name="password" type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
              <select
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                value={newUser.role}
                onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
              >
                {isAdminPusat && <option value="admin_cabang">Admin Cabang</option>}
                <option value="jamaah">Jamaah</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Cabang</label>
              <select
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                value={newUser.branch_id}
                onChange={(e) => setNewUser((p) => ({ ...p, branch_id: e.target.value }))}
              >
                <option value="">Pilih cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.Province?.name ? ` — ${b.Province.name}` : ''}
                    {b.Wilayah?.name ? `, ${b.Wilayah.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <button type="submit" disabled={creatingUser} className="px-4 py-2 rounded-lg bg-btn text-white hover:bg-btn-hover disabled:opacity-60">
                {creatingUser ? 'Menyimpan...' : 'Buat User'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {message && (
        <Card padding="sm">
          <p className="text-sm text-emerald-700">{message}</p>
        </Card>
      )}

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
                <th className="text-left px-4 py-3">Cabang</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-500">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-500">Belum ada data user</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="border-b border-stone-100">
                  <td className="px-4 py-3 font-medium text-stone-900">{u.name || '-'}</td>
                  <td className="px-4 py-3 text-stone-600">{u.email || '-'}</td>
                  <td className="px-4 py-3 text-stone-700">{u.role || '-'}</td>
                  <td className="px-4 py-3 text-stone-700">
                    {u.Branch?.name || '-'}
                    {(u.Branch?.Province?.name || u.Branch?.Wilayah?.name) && (
                      <span className="block text-xs text-stone-500 mt-0.5">
                        {[u.Branch?.Province?.name, u.Branch?.Wilayah?.name].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </td>
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
