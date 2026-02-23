import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search, Filter, Edit, Trash2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { adminPusatApi, type UserListItem } from '../../../services/api';
import { TableColumn } from '../../../types';

const ROLES = [
  { value: 'role_bus', label: 'Role Bus (Saudi)' },
  { value: 'role_hotel', label: 'Role Hotel (Saudi)' }
];

const AdminPusatCreateUserPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('role_bus');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '' });
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingList(true);
    try {
      let list: UserListItem[] = [];
      if (filterRole) {
        const res = await adminPusatApi.listUsers({
          limit: 500,
          page: 1,
          role: filterRole,
          is_active: filterStatus === 'active' ? 'true' : filterStatus === 'inactive' ? 'false' : undefined,
          sort_by: 'created_at',
          sort_order: 'desc'
        });
        list = res.data?.data || [];
      } else {
        const [resBus, resHotel] = await Promise.all([
          adminPusatApi.listUsers({
            limit: 250,
            page: 1,
            role: 'role_bus',
            is_active: filterStatus === 'active' ? 'true' : filterStatus === 'inactive' ? 'false' : undefined,
            sort_by: 'created_at',
            sort_order: 'desc'
          }),
          adminPusatApi.listUsers({
            limit: 250,
            page: 1,
            role: 'role_hotel',
            is_active: filterStatus === 'active' ? 'true' : filterStatus === 'inactive' ? 'false' : undefined,
            sort_by: 'created_at',
            sort_order: 'desc'
          })
        ]);
        const busList = resBus.data?.data || [];
        const hotelList = resHotel.data?.data || [];
        list = [...busList, ...hotelList].sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      }
      if (filterSearch.trim()) {
        const q = filterSearch.trim().toLowerCase();
        list = list.filter(
          (u) =>
            (u.name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
      }
      const total = list.length;
      const start = (page - 1) * limit;
      const pagedList = list.slice(start, start + limit);
      setUsers(pagedList);
      setPagination({
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      });
    } catch {
      setUsers([]);
      setPagination(null);
    } finally {
      setLoadingList(false);
    }
  }, [limit, page, filterRole, filterStatus, filterSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [filterRole, filterStatus, filterSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!name.trim() || !email.trim() || !password.trim()) {
      setMessage({ type: 'error', text: 'Nama, email, dan password wajib diisi' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password minimal 6 karakter' });
      return;
    }
    setLoading(true);
    try {
      await adminPusatApi.createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role
      });
      setMessage({ type: 'success', text: 'Akun berhasil dibuat' });
      setName('');
      setEmail('');
      setPassword('');
      setRole('role_bus');
      fetchUsers();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Gagal membuat akun' });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (u: UserListItem) => {
    setEditingUser(u);
    setEditForm({ name: u.name || '', email: u.email || '', password: '' });
    setModalOpen(true);
    setMessage(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setMessage(null);
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setMessage({ type: 'error', text: 'Nama dan email wajib diisi' });
      return;
    }
    setSubmitLoading(true);
    try {
      const body: { name?: string; email?: string; password?: string } = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase()
      };
      if (editForm.password && editForm.password.length >= 6) body.password = editForm.password;
      await adminPusatApi.updateUser(editingUser.id, body);
      setMessage({ type: 'success', text: 'Akun berhasil diperbarui' });
      setModalOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Gagal memperbarui akun' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (u: UserListItem) => {
    if (!window.confirm(`Yakin ingin menghapus akun "${u.name}" (${u.email})?`)) return;
    try {
      await adminPusatApi.deleteUser(u.id);
      setMessage({ type: 'success', text: 'Akun berhasil dihapus' });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      if (pagination) {
        setPagination((p) => (p ? { ...p, total: Math.max(0, p.total - 1) } : null));
      }
      fetchUsers();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Gagal menghapus akun' });
    }
  };

  const tableColumns: TableColumn[] = [
    { id: 'name', label: 'Nama', align: 'left', sortable: true },
    { id: 'email', label: 'Email', align: 'left', sortable: true },
    { id: 'role', label: 'Role', align: 'left' },
    { id: 'status', label: 'Status', align: 'center' },
    { id: 'created', label: 'Dibuat', align: 'left' },
    { id: 'actions', label: 'Aksi', align: 'center' }
  ];

  const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label || r;

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
        >
          {message.text}
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Buat Akun</h1>
          <p className="text-slate-600 mt-1">Kelola akun Role Bus dan Role Hotel (bertugas di Saudi Arabia)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Tambah Akun Baru</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                placeholder="Nama lengkap"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                placeholder="email@contoh.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password * (min. 6 karakter)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Memproses...' : 'Buat Akun'}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Akun Bus & Hotel</p>
              <p className="text-2xl font-bold text-slate-900">{pagination?.total ?? users.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-4">
          <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama atau email..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-white min-w-[160px]"
            >
              <option value="">Semua Role</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-white min-w-[140px]"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            {(filterSearch || filterRole || filterStatus !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterSearch('');
                  setFilterRole('');
                  setFilterStatus('all');
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {loadingList ? (
          <p className="text-slate-500 py-8 text-center">Memuat...</p>
        ) : (
          <Table
            columns={tableColumns}
            data={users}
            emptyMessage="Belum ada akun Role Bus atau Hotel"
            pagination={
              pagination
                ? {
                    ...pagination,
                    onPageChange: setPage,
                    onLimitChange: (l) => {
                      setLimit(l);
                      setPage(1);
                    }
                  }
                : undefined
            }
            renderRow={(u: UserListItem) => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{u.name || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{u.email || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{roleLabel(u.role)}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={u.is_active !== false ? 'success' : 'error'}>
                    {u.is_active !== false ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600 text-sm">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID') : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <ActionsMenu
                      align="right"
                      items={[
                        { id: 'edit', label: 'Edit', icon: <Edit className="w-4 h-4" />, onClick: () => openEdit(u) },
                        { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(u), danger: true },
                      ] as ActionsMenuItem[]}
                    />
                  </div>
                </td>
              </tr>
            )}
          />
        )}
      </Card>

      {modalOpen && editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => { setModalOpen(false); setEditingUser(null); }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-900 mb-4">Edit Akun</h3>
            {message && (
              <div
                className={`mb-4 rounded-lg px-4 py-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
              >
                {message.text}
              </div>
            )}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password baru (kosongkan jika tidak ingin mengubah)</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="Min. 6 karakter"
                  minLength={6}
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={submitLoading}>
                  {submitLoading ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPusatCreateUserPage;
