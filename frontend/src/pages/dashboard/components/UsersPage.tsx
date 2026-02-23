import React, { useState, useEffect, useCallback } from 'react';
import { Users as UsersIcon, Plus, Search, Edit, Trash2, Eye, Shield, Mail, FileCheck, CheckCircle, X, Copy } from 'lucide-react';
import { ROLE_NAMES, TableColumn, OWNER_STATUS_LABELS } from '../../../types';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import Modal from '../../../components/common/Modal';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { adminPusatApi, branchesApi, ownersApi, UserListItem } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { API_BASE_URL } from '../../../utils/constants';

const UPLOAD_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
const roleLabel = (role: string): string =>
  (ROLE_NAMES as Record<string, string>)[role] || role;
const ownerStatusLabel = (s: string) => (OWNER_STATUS_LABELS as Record<string, string>)[s] || s;

const REGISTRATION_REJECTION_REASONS = [
  { value: '', label: '— Pilih alasan (jika tolak) —' },
  { value: 'bukti_tidak_terbaca', label: 'Bukti transfer tidak terbaca / blur' },
  { value: 'nominal_tidak_sesuai', label: 'Nominal tidak sesuai' },
  { value: 'rekening_tujuan_salah', label: 'Rekening tujuan salah' },
  { value: 'bukan_bukti_transfer', label: 'Dokumen bukan bukti transfer' },
  { value: 'tanggal_transfer_tidak_jelas', label: 'Tanggal transfer tidak jelas' },
  { value: 'data_tidak_lengkap', label: 'Data tidak lengkap' },
  { value: 'lainnya', label: 'Lainnya' }
];

const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string; city?: string; provinsi_id?: string }[]>([]);
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [provincesList, setProvincesList] = useState<{ id: string; name: string; wilayah_id?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabFilter, setTabFilter] = useState<'all' | 'divisi' | 'owner'>('all');
  const [wilayahId, setWilayahId] = useState<string>('');
  const [provinsiId, setProvinsiId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);

  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; email: string; phone: string; company_name: string; is_active: boolean; password: string }>({ name: '', email: '', phone: '', company_name: '', is_active: true, password: '' });
  const [editActivationPassword, setEditActivationPassword] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [verifyRegPaymentUser, setVerifyRegPaymentUser] = useState<UserListItem | null>(null);
  const [verifyRegPaymentReject, setVerifyRegPaymentReject] = useState('');
  const [verifyingRegPayment, setVerifyingRegPayment] = useState(false);
  const [activateResult, setActivateResult] = useState<{ password: string; mouUrl: string } | null>(null);

  const canListUsers =
    currentUser?.role === 'super_admin' || currentUser?.role === 'admin_pusat';
  const isAdminPusat = currentUser?.role === 'admin_pusat';

  useEffect(() => {
    branchesApi.listWilayah().then((res) => {
      if (res.data?.data) setWilayahList(res.data.data);
    }).catch(() => {});
    branchesApi.listProvinces().then((res) => {
      if (res.data?.data) setProvincesList(Array.isArray(res.data.data) ? (res.data.data as { id: string; name: string; wilayah_id?: string }[]).map((p: any) => ({ id: p.id, name: p.name || p.nama, wilayah_id: p.wilayah_id })) : []);
    }).catch(() => {});
  }, []);

  const provincesFiltered = wilayahId
    ? provincesList.filter((p) => p.wilayah_id === wilayahId)
    : provincesList;

  useEffect(() => {
    const params: { limit: number; page: number; provinsi_id?: string; wilayah_id?: string } = { limit: 500, page: 1 };
    if (provinsiId) params.provinsi_id = provinsiId;
    else if (wilayahId) params.wilayah_id = wilayahId;
    branchesApi.list(params).then((res) => {
      if (res.data?.data) setBranches(res.data.data);
    }).catch(() => {});
  }, [wilayahId, provinsiId]);

  const openEdit = useCallback(async (user: UserListItem) => {
    setEditUser(user);
    const listPw = (user as UserListItem & { activation_generated_password?: string | null }).activation_generated_password;
    setEditActivationPassword(listPw && String(listPw).trim() ? String(listPw).trim() : null);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: (user as any).phone ?? '',
      company_name: user.company_name ?? '',
      is_active: user.is_active !== false,
      password: ''
    });
    try {
      const res = await adminPusatApi.getUserById(user.id);
      if (res.data?.success && res.data?.data) {
        const d = res.data.data as { name?: string; email?: string; phone?: string; company_name?: string; is_active?: boolean; activation_generated_password?: string | null; OwnerProfile?: { activation_generated_password?: string | null } };
        setEditForm((f) => ({
          ...f,
          name: d.name || '',
          email: d.email || '',
          phone: d.phone ?? '',
          company_name: d.company_name ?? '',
          is_active: d.is_active !== false
        }));
        const activationPw = d.activation_generated_password ?? d.OwnerProfile?.activation_generated_password;
        if (activationPw && String(activationPw).trim()) setEditActivationPassword(String(activationPw).trim());
      }
      } catch {
      setEditForm((f) => ({ ...f, name: user.name || '', email: user.email || '' }));
    }
  }, []);

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const body: any = { name: editForm.name.trim(), email: editForm.email.trim(), phone: editForm.phone || undefined, company_name: editForm.company_name || undefined, is_active: editForm.is_active };
      if (editForm.password.length >= 6) body.password = editForm.password;
      await adminPusatApi.updateUser(editUser.id, body);
      showToast('Data berhasil disimpan', 'success');
      setEditUser(null);
      fetchUsers();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminPusatApi.deleteUser(deleteTarget.id);
      showToast('User berhasil dihapus', 'success');
      setDeleteTarget(null);
      fetchUsers();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menghapus', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleVerifyRegistrationPayment = async (approved: boolean) => {
    if (!verifyRegPaymentUser?.owner_profile_id) return;
    if (!approved && !verifyRegPaymentReject.trim()) {
      showToast('Isi alasan penolakan jika tolak', 'warning');
      return;
    }
    setVerifyingRegPayment(true);
    try {
      await ownersApi.verifyRegistrationPayment(verifyRegPaymentUser.owner_profile_id, { approved, rejection_reason: verifyRegPaymentReject.trim() || undefined });
      showToast(approved ? 'Bukti bayar disetujui' : 'Bukti bayar ditolak', 'success');
      setVerifyRegPaymentUser(null);
      fetchUsers();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal', 'error');
    } finally {
      setVerifyingRegPayment(false);
    }
  };

  const handleActivate = async (profileId: string) => {
    setActingId(profileId);
    try {
      const res = await ownersApi.activate(profileId);
      const data = res.data?.data;
      if (data?.generated_password != null && data?.mou_generated_url) {
        setActivateResult({ password: data.generated_password, mouUrl: data.mou_generated_url });
      } else {
        showToast('Owner berhasil diaktifkan', 'success');
      }
      fetchUsers();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal aktivasi', 'error');
    } finally {
      setActingId(null);
    }
  };

  const fetchUsers = useCallback(() => {
    if (!canListUsers) return;
    setLoading(true);
    setError(null);
    const params: { role?: string; branch_id?: string; wilayah_id?: string; provinsi_id?: string; limit?: number; page?: number; sort_by?: string; sort_order?: 'asc' | 'desc' } = { limit, page, sort_by: sortBy, sort_order: sortOrder };
    if (branchId) params.branch_id = branchId;
    if (wilayahId) params.wilayah_id = wilayahId;
    if (provinsiId) params.provinsi_id = provinsiId;
    if (tabFilter === 'owner') params.role = 'owner';
    else if (tabFilter === 'divisi') params.role = 'divisi';
    adminPusatApi
      .listUsers(params)
      .then((res) => {
        if (res.data?.data) setUsers(res.data.data);
        const p = (res.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(p || (res.data?.data ? { total: (res.data.data as unknown[]).length, page: 1, limit: (res.data.data as unknown[]).length, totalPages: 1 } : null));
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Gagal memuat daftar user');
      })
      .finally(() => setLoading(false));
  }, [canListUsers, branchId, wilayahId, provinsiId, tabFilter, page, limit, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [branchId, wilayahId, provinsiId, tabFilter]);

  const filteredUsers = users.filter((user: UserListItem) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const stats = [
    { label: 'Total Users', value: pagination?.total ?? users.length, color: 'from-blue-500 to-cyan-500' },
    { label: 'Aktif', value: users.filter((u: UserListItem) => u.is_active).length, color: 'from-emerald-500 to-teal-500' },
    { label: 'Owner', value: users.filter((u: UserListItem) => u.role === 'owner').length, color: 'from-purple-500 to-pink-500' },
    { label: 'Staff', value: users.filter((u: UserListItem) => u.role !== 'owner').length, color: 'from-orange-500 to-red-500' }
  ];

  const tableColumns: TableColumn[] = [
    { id: 'name', label: 'Nama', align: 'left', sortable: true },
    { id: 'email', label: 'Email', align: 'left', sortable: true },
    { id: 'role', label: 'Role', align: 'left', sortable: true },
    { id: 'company', label: 'Perusahaan', align: 'left' },
    { id: 'branch', label: 'Cabang', align: 'left' },
    { id: 'wilayah', label: 'Wilayah', align: 'left' },
    { id: 'provinsi', label: 'Provinsi', align: 'left' },
    { id: 'status', label: 'Status', align: 'center' },
    { id: 'password_aktivasi', label: 'Password (aktivasi)', align: 'left' },
    { id: 'actions', label: 'Aksi', align: 'center' }
  ];

  const buildActionItems = (user: UserListItem): ActionsMenuItem[] => {
    const ownerStatus = (user as UserListItem & { owner_status?: string }).owner_status;
    const ownerProfileId = user.owner_profile_id;
    const isOwner = user.role === 'owner';
    const hideEdit = isOwner && ownerStatus != null && ownerStatus !== 'active';
    const items: ActionsMenuItem[] = [];
    if (!hideEdit) {
      items.push({ id: 'edit', label: 'Edit', icon: <Edit className="w-4 h-4" />, onClick: () => openEdit(user) });
    }
    items.push({ id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteTarget(user), danger: true });
    if (isOwner && ownerProfileId) {
      if (ownerStatus === 'pending_registration_verification') {
        items.unshift({ id: 'verify_reg', label: 'Verifikasi Bukti Bayar', icon: <FileCheck className="w-4 h-4" />, onClick: () => setVerifyRegPaymentUser(user) });
      }
      if (ownerStatus === 'deposit_verified' || ownerStatus === 'assigned_to_branch') {
        items.unshift({ id: 'activate', label: 'Aktivasi Owner', icon: <CheckCircle className="w-4 h-4" />, onClick: () => handleActivate(ownerProfileId) });
      }
    }
    return items;
  };

  if (!canListUsers) {
    return (
      <div className="rounded-travel bg-primary-50 border border-primary-200 p-4 text-primary-800">
        <p>Daftar user hanya dapat diakses oleh Super Admin dan Admin Pusat.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Memuat daftar user...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">Manajemen User</h1>
          <p className="text-stone-600 mt-1">Daftar user – tambah akun via Admin Pusat / Admin Cabang</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AutoRefreshControl onRefresh={fetchUsers} disabled={loading} />
          <Button variant="primary"><Plus className="w-5 h-5 mr-2" />Tambah User</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} hover className="travel-card">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-card`}>
                <UsersIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-stone-600">{stat.label}</p>
                <p className="text-2xl font-bold text-stone-900">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="travel-card">
        {/* Tab: Semua / Divisi / Owner */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm font-medium text-stone-600 mr-1">Filter:</span>
          <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1">
            {(['all', 'divisi', 'owner'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTabFilter(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tabFilter === tab
                    ? 'bg-white text-primary-600 shadow-sm border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab === 'all' ? 'Semua' : tab === 'divisi' ? 'Divisi' : 'Owner'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 items-stretch sm:items-center">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          {isAdminPusat && (
            <>
              <select
                value={wilayahId}
                onChange={(e) => { setWilayahId(e.target.value); setProvinsiId(''); setBranchId(''); }}
                className="px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-primary-500 min-w-[140px] sm:min-w-[160px]"
                title="Filter wilayah"
              >
                <option value="">Semua wilayah</option>
                {wilayahList.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <select
                value={provinsiId}
                onChange={(e) => { setProvinsiId(e.target.value); setBranchId(''); }}
                className="px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-primary-500 min-w-[140px] sm:min-w-[160px]"
                title="Filter provinsi"
              >
                <option value="">Semua provinsi</option>
                {provincesFiltered.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-primary-500 min-w-[160px] sm:min-w-[200px]"
                title="Filter cabang (kota)"
              >
                <option value="">Semua cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.code} - {b.name}{b.city ? ` (${b.city})` : ''}</option>
                ))}
              </select>
            </>
          )}
        </div>

        <Table
          columns={tableColumns}
          data={filteredUsers}
          sort={{ columnId: sortBy, order: sortOrder }}
          onSortChange={(col, order) => { setSortBy(col); setSortOrder(order); setPage(1); }}
          pagination={pagination ? {
            total: pagination.total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: pagination.totalPages,
            onPageChange: setPage,
            onLimitChange: (l) => { setLimit(l); setPage(1); }
          } : undefined}
          renderRow={(user: UserListItem) => (
            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.branch_name || user.Branch?.name || '-'}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {user.email}
                </div>
              </td>
              <td className="px-6 py-4">
                <Badge variant="info">
                  <Shield className="w-3 h-3 mr-1" />
                  {roleLabel(user.role)}
                </Badge>
              </td>
              <td className="px-6 py-4 text-slate-700">{user.company_name || '-'}</td>
              <td className="px-6 py-4 text-slate-700">
                {user.branch_name ? (user.branch_code ? `${user.branch_code} - ${user.branch_name}` : user.branch_name) + (user.city ? ` (${user.city})` : '') : '-'}
              </td>
              <td className="px-6 py-4 text-slate-700">{user.wilayah_name ?? '-'}</td>
              <td className="px-6 py-4 text-slate-700">{user.provinsi_name ?? '-'}</td>
              <td className="px-6 py-4 text-center">
                {user.role === 'owner' ? (
                  (() => {
                    const status = (user as UserListItem & { owner_status?: string }).owner_status;
                    const isOwnerActive = status === 'active';
                    return (
                      <Badge variant={isOwnerActive ? 'success' : 'warning'}>
                        {status ? ownerStatusLabel(status) : 'Menunggu bukti bayar'}
                      </Badge>
                    );
                  })()
                ) : (
                  <Badge variant={user.is_active ? 'success' : 'error'}>
                    {user.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                )}
              </td>
              <td className="px-6 py-4">
                {user.role === 'owner' && user.activation_generated_password ? (
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded break-all max-w-[120px] truncate" title={user.activation_generated_password}>
                      {user.activation_generated_password}
                    </code>
                    <Button type="button" size="sm" variant="ghost" className="shrink-0 p-1" onClick={() => { navigator.clipboard.writeText(user.activation_generated_password!); showToast('Password disalin', 'success'); }} title="Salin">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-center">
                  <ActionsMenu
                    align="right"
                    items={buildActionItems(user)}
                  />
                </div>
              </td>
            </tr>
          )}
        />
      </Card>

      {/* Modal Edit User */}
      <Modal open={!!editUser} onClose={() => { setEditUser(null); setEditActivationPassword(null); }}>
        {editUser && (
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Edit User</h2>
              <button type="button" className="p-1 rounded hover:bg-slate-100" onClick={() => setEditUser(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nama</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Telepon</label>
                <input type="text" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Opsional" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Perusahaan</label>
                <input type="text" value={editForm.company_name} onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Opsional" />
              </div>
              {editUser.role === 'owner' && (
                <div>
                  {editActivationPassword ? (
                    <>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Password saat ini (dari aktivasi sistem)</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono break-all">
                          {editActivationPassword}
                        </code>
                        <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(editActivationPassword); showToast('Password disalin', 'success'); }}>
                          Salin
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Password dari aktivasi hanya tampil untuk owner yang diaktivasi setelah fitur ini. Gunakan &quot;Ubah password&quot; di bawah untuk set password baru.</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Ubah password (kosongkan jika tidak diubah)</label>
                <input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Min. 6 karakter" autoComplete="new-password" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-300" />
                <span className="text-sm text-slate-700">Aktif</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
              <Button variant="outline" onClick={() => setEditUser(null)}>Batal</Button>
              <Button variant="primary" onClick={saveEdit} disabled={saving || !editForm.name.trim() || !editForm.email.trim()}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        {deleteTarget && (
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Hapus User</h2>
            <p className="text-sm text-slate-600 mb-4">Yakin ingin menghapus user <strong>{deleteTarget.name}</strong> ({deleteTarget.email})? User akan dinonaktifkan.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Menghapus...' : 'Hapus'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Verifikasi Bukti Bayar: view dokumen + setujui/aktifkan */}
      <Modal open={!!verifyRegPaymentUser} onClose={() => { setVerifyRegPaymentUser(null); setVerifyRegPaymentReject(''); }}>
        {verifyRegPaymentUser && (() => {
          const proofPath = verifyRegPaymentUser.registration_payment_proof_url;
          const proofUrl = proofPath
            ? `${(UPLOAD_BASE || '').replace(/\/$/, '')}${proofPath.startsWith('/') ? '' : '/'}${proofPath}`
            : '';
          return (
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Verifikasi Bukti Bayar MoU (diupload owner)</h2>
                <p className="text-sm text-slate-600 mt-1">{verifyRegPaymentUser.name} – {verifyRegPaymentUser.email}</p>
                {(verifyRegPaymentUser as UserListItem & { registration_payment_amount?: number }).registration_payment_amount != null && (
                  <p className="text-sm text-slate-700 mt-1">
                    Jumlah yang diinput: <strong>Rp {new Intl.NumberFormat('id-ID').format((verifyRegPaymentUser as UserListItem & { registration_payment_amount?: number }).registration_payment_amount!)}</strong>
                  </p>
                )}
              </div>
              <div className="p-4 flex-1 overflow-auto space-y-4">
                {proofPath ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Bukti bayar yang diupload owner</label>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 min-h-[240px]">
                      <iframe
                        title="Bukti bayar yang diupload owner"
                        src={proofUrl}
                        className="w-full h-[360px] min-h-[240px] border-0"
                      />
                    </div>
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline mt-1 inline-block">Buka dokumen di tab baru</a>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Owner belum mengupload bukti bayar.</p>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Alasan penolakan (wajib jika tolak)</label>
                  <select
                    value={verifyRegPaymentReject}
                    onChange={(e) => setVerifyRegPaymentReject(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {REGISTRATION_REJECTION_REASONS.map((opt) => (
                      <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
                <Button variant="outline" onClick={() => { setVerifyRegPaymentUser(null); setVerifyRegPaymentReject(''); }}>Batal</Button>
                <Button variant="outline" onClick={() => handleVerifyRegistrationPayment(false)} disabled={verifyingRegPayment || !verifyRegPaymentReject.trim()}>Tolak</Button>
                <Button variant="primary" onClick={() => handleVerifyRegistrationPayment(true)} disabled={verifyingRegPayment}>{verifyingRegPayment ? 'Memproses...' : 'Setujui Bukti Bayar'}</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal Hasil Aktivasi */}
      <Modal open={!!activateResult} onClose={() => setActivateResult(null)}>
        {activateResult && (
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <h2 className="text-lg font-semibold text-slate-900">Owner Diaktifkan</h2>
              <button type="button" className="p-1 rounded hover:bg-slate-100" onClick={() => setActivateResult(null)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-3">Email berisi MOU dan kredensial telah dikirim ke owner. Berikan data berikut jika diperlukan.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Password baru</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-100 rounded-lg font-mono text-sm break-all">{activateResult.password}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(activateResult.password); showToast('Disalin', 'success'); }}>Salin</Button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Surat MoU</label>
                <a href={`${UPLOAD_BASE}${activateResult.mouUrl}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-sm">Unduh / Buka MoU (PDF)</a>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200">
              <Button variant="primary" className="w-full" onClick={() => setActivateResult(null)}>Tutup</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UsersPage;
