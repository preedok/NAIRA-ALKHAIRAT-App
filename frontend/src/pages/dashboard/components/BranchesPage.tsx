import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, Plus, Edit, Search, Filter, MapPin, Globe, UserPlus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { branchesApi, adminPusatApi, type Branch, type ProvinceItem, type UserListItem } from '../../../services/api';
import { TableColumn } from '../../../types';

type AddAccountMode = 'akun_wilayah' | 'akun_provinsi';

const BranchesPage: React.FC = () => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [addAccountMode, setAddAccountMode] = useState<AddAccountMode>('akun_wilayah');
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    password: '',
    branch_id: '',
    region: ''
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [allBranchesForSelect, setAllBranchesForSelect] = useState<Branch[]>([]);
  const [provincesForSelect, setProvincesForSelect] = useState<ProvinceItem[]>([]);
  const [wilayahForSelect, setWilayahForSelect] = useState<Array<{ id: string; name: string }>>([]);
  const [adminWilayahList, setAdminWilayahList] = useState<UserListItem[]>([]);
  const [adminProvinsiList, setAdminProvinsiList] = useState<UserListItem[]>([]);

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [filterWilayah, setFilterWilayah] = useState('');
  const [filterProvinsi, setFilterProvinsi] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const canCreateBranch = user?.role === 'super_admin' || user?.role === 'admin_pusat';

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);

  // Load filter options and admin lists on mount
  useEffect(() => {
    branchesApi.listProvinces().then((r) => { if (r.data?.data) setProvincesForSelect(r.data.data); }).catch(() => {});
    branchesApi.listWilayah().then((r) => { if (r.data?.data) setWilayahForSelect(r.data.data); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (canCreateBranch) {
      adminPusatApi.listUsers({ role: 'admin_wilayah', limit: 100 }).then((r) => { if (r.data?.data) setAdminWilayahList(r.data.data); }).catch(() => {});
      adminPusatApi.listUsers({ role: 'admin_provinsi', limit: 100 }).then((r) => { if (r.data?.data) setAdminProvinsiList(r.data.data); }).catch(() => {});
    }
  }, [canCreateBranch]);

  const provincesByWilayah = useMemo(() => {
    if (!filterWilayah) return provincesForSelect;
    return provincesForSelect.filter((p) => p.wilayah_id === filterWilayah);
  }, [provincesForSelect, filterWilayah]);

  const hasActiveFilters = searchText || filterWilayah || filterProvinsi || filterCity || filterStatus !== 'all';

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof branchesApi.list>[0] = {
        limit,
        page,
        include_inactive: 'true',
        search: searchText.trim() || undefined,
        provinsi_id: filterProvinsi || undefined,
        wilayah_id: filterWilayah || undefined,
        city: filterCity.trim() || undefined,
        is_active: filterStatus === 'all' ? undefined : filterStatus === 'active' ? 'true' : 'false',
        sort_by: sortBy,
        sort_order: sortOrder
      };
      const res = await branchesApi.list(params);
      if (res.data.success && res.data.data) {
        setBranches(res.data.data);
        const p = (res.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(p || { total: res.data.data.length, page: 1, limit: res.data.data.length, totalPages: 1 });
      }
    } catch {
      setBranches([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [limit, page, searchText, filterProvinsi, filterWilayah, filterCity, filterStatus, sortBy, sortOrder]);

  useEffect(() => {
    setPage(1);
  }, [searchText, filterWilayah, filterProvinsi, filterCity, filterStatus]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const openAddAccount = () => {
    setEditingBranchId(null);
    setEditingUserId(null);
    setAddAccountMode('akun_wilayah');
    setAccountForm({ name: '', email: '', password: '', branch_id: '', region: '' });
    setModalOpen(true);
    setMessage(null);
    branchesApi.list({ limit: 600, include_inactive: 'true' })
      .then((r) => { if (r.data.success && r.data.data) setAllBranchesForSelect(r.data.data); })
      .catch(() => setAllBranchesForSelect([]));
    branchesApi.listProvinces()
      .then((r) => { if (r.data?.data) setProvincesForSelect(r.data.data); })
      .catch(() => setProvincesForSelect([]));
    branchesApi.listWilayah()
      .then((r) => { if (r.data?.data) setWilayahForSelect(r.data.data); })
      .catch(() => setWilayahForSelect([]));
  };

  const openEdit = async (b: Branch) => {
    setEditingBranchId(b.id);
    setModalOpen(true);
    setMessage(null);
    setAddAccountMode('akun_wilayah');
    setAccountForm({ name: '', email: '', password: '', branch_id: b.id, region: '' });
    branchesApi.list({ limit: 600, include_inactive: 'true' })
      .then((r) => { if (r.data.success && r.data.data) setAllBranchesForSelect(r.data.data); })
      .catch(() => setAllBranchesForSelect((prev) => (prev.some((x) => x.id === b.id) ? prev : [...prev, b])));
    try {
      const res = await branchesApi.getById(b.id);
      const data = res.data?.data as { admin_user?: { id: string; name?: string; email?: string } };
      if (data?.admin_user) {
        setEditingUserId(data.admin_user.id);
        setAccountForm({
          name: data.admin_user.name || '',
          email: data.admin_user.email || '',
          password: '',
          branch_id: b.id,
          region: ''
        });
      } else {
        setEditingUserId(null);
      }
    } catch {
      setEditingUserId(null);
    }
  };

  const openEditAccount = (u: UserListItem) => {
    setEditingBranchId(null);
    setEditingUserId(u.id);
    const mode = u.role === 'admin_wilayah' ? 'akun_wilayah' : u.role === 'admin_provinsi' ? 'akun_provinsi' : 'akun_wilayah';
    setAddAccountMode(mode);
    setAccountForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      branch_id: u.branch_id || '',
      region: u.region || ''
    });
    setModalOpen(true);
    setMessage(null);
    branchesApi.list({ limit: 600, include_inactive: 'true' }).then((r) => { if (r.data.success && r.data.data) setAllBranchesForSelect(r.data.data); }).catch(() => {});
    branchesApi.listProvinces().then((r) => { if (r.data?.data) setProvincesForSelect(r.data.data); }).catch(() => {});
    branchesApi.listWilayah().then((r) => { if (r.data?.data) setWilayahForSelect(r.data.data); }).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitLoading(true);
    try {
      if (editingUserId) {
        if (!accountForm.name.trim() || !accountForm.email.trim()) {
          setMessage({ type: 'error', text: 'Nama dan email wajib diisi' });
          return;
        }
        const body: { name?: string; email?: string; password?: string } = {
          name: accountForm.name.trim(),
          email: accountForm.email.trim().toLowerCase()
        };
        if (accountForm.password && accountForm.password.length >= 6) {
          body.password = accountForm.password;
        }
        await adminPusatApi.updateUser(editingUserId, body);
        setMessage({ type: 'success', text: 'Akun berhasil diperbarui' });
        setModalOpen(false);
        setEditingBranchId(null);
        setEditingUserId(null);
        setAccountForm({ name: '', email: '', password: '', branch_id: '', region: '' });
        fetchBranches();
        adminPusatApi.listUsers({ role: 'admin_wilayah', limit: 100 }).then((r) => { if (r.data?.data) setAdminWilayahList(r.data.data); }).catch(() => {});
        adminPusatApi.listUsers({ role: 'admin_provinsi', limit: 100 }).then((r) => { if (r.data?.data) setAdminProvinsiList(r.data.data); }).catch(() => {});
      } else {
        if (!accountForm.name.trim() || !accountForm.email.trim() || !accountForm.password.trim()) {
          setMessage({ type: 'error', text: 'Nama, email, dan password wajib diisi' });
          return;
        }
        if (accountForm.password.length < 6) {
          setMessage({ type: 'error', text: 'Password minimal 6 karakter' });
          return;
        }
        const roleMap = { akun_wilayah: 'admin_wilayah', akun_provinsi: 'admin_provinsi' } as const;
        const role = roleMap[addAccountMode];
        const body: { name: string; email: string; password: string; role: string; branch_id?: string; region?: string } = {
          name: accountForm.name.trim(),
          email: accountForm.email.trim().toLowerCase(),
          password: accountForm.password,
          role
        };
        if (addAccountMode === 'akun_wilayah') {
          if (!accountForm.region) {
            setMessage({ type: 'error', text: 'Pilih wilayah (Sumatra, Jawa, dll) terlebih dahulu' });
            return;
          }
          body.region = accountForm.region;
        } else {
          if (!accountForm.region) {
            setMessage({ type: 'error', text: 'Pilih provinsi terlebih dahulu' });
            return;
          }
          body.region = accountForm.region;
        }
        await adminPusatApi.createUser(body);
        setMessage({ type: 'success', text: 'Akun berhasil dibuat' });
        setModalOpen(false);
        setEditingBranchId(null);
        setAccountForm({ name: '', email: '', password: '', branch_id: '', region: '' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Gagal menyimpan' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const tableColumns: TableColumn[] = [
    { id: 'code', label: 'Kode', align: 'left', sortable: true },
    { id: 'name', label: 'Nama Cabang', align: 'left', sortable: true },
    { id: 'city', label: 'Kota', align: 'left', sortable: true },
    { id: 'region', label: 'Provinsi', align: 'left', sortable: true },
    { id: 'manager', label: 'Manager', align: 'left', sortable: true, sortKey: 'manager_name' },
    { id: 'phone', label: 'Telepon', align: 'left' },
    { id: 'email', label: 'Email', align: 'left' },
    { id: 'address', label: 'Alamat', align: 'left' },
    { id: 'koord_prov', label: 'Koord. Provinsi', align: 'left' },
    { id: 'koord_prov_phone', label: 'Koord. Prov - Telp', align: 'left' },
    { id: 'koord_prov_email', label: 'Koord. Prov - Email', align: 'left' },
    { id: 'koord_wilayah', label: 'Koord. Wilayah', align: 'left' },
    { id: 'koord_wilayah_phone', label: 'Koord. Wilayah - Telp', align: 'left' },
    { id: 'koord_wilayah_email', label: 'Koord. Wilayah - Email', align: 'left' },
    { id: 'status', label: 'Status', align: 'center', sortable: true, sortKey: 'is_active' },
    ...(canCreateBranch ? [{ id: 'actions', label: 'Aksi', align: 'center' as const }] : [])
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">Kelola Cabang</h1>
          <p className="text-stone-600 mt-1">Daftar cabang dan tambah akun admin cabang, wilayah, atau provinsi</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AutoRefreshControl onRefresh={fetchBranches} disabled={loading} />
          {canCreateBranch && (
            <Button variant="primary" onClick={openAddAccount}><UserPlus className="w-5 h-5 mr-2" />Tambah Akun</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hover className="travel-card">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-card">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-stone-600">Total Cabang</p>
              <p className="text-2xl font-bold text-stone-900">{pagination?.total ?? branches.length}</p>
            </div>
          </div>
        </Card>
        {hasActiveFilters && (
          <Card hover className="travel-card">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary-100 text-primary-600">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-stone-600">Filter aktif</p>
                <p className="text-2xl font-bold text-stone-900">{pagination?.total ?? 0} tampil</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card className="travel-card">
        {loading ? (
          <p className="text-stone-500 py-8 text-center">Memuat...</p>
        ) : (
          <>
            <div className="space-y-4 mb-4">
              <div className="p-4 bg-primary-50/50 rounded-xl border border-primary-100">
                <p className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary-600" /> Filter Cabang
                </p>
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Cari kode, nama, kota, provinsi..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <select
                    value={filterWilayah}
                    onChange={(e) => { setFilterWilayah(e.target.value); setFilterProvinsi(''); }}
                    className="px-4 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white min-w-[180px]"
                  >
                    <option value="">Semua Wilayah</option>
                    {wilayahForSelect.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <select
                    value={filterProvinsi}
                    onChange={(e) => setFilterProvinsi(e.target.value)}
                    className="px-4 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white min-w-[180px]"
                  >
                    <option value="">Semua Provinsi</option>
                    {provincesByWilayah.map((p) => (
                      <option key={p.id} value={p.id}>{p.nama ?? p.name ?? ''}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Filter kota..."
                    value={filterCity}
                    onChange={(e) => setFilterCity(e.target.value)}
                    className="px-4 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[140px]"
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                    className="px-4 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white min-w-[140px]"
                  >
                    <option value="all">Semua Status</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchText('');
                        setFilterWilayah('');
                        setFilterProvinsi('');
                        setFilterCity('');
                        setFilterStatus('all');
                      }}
                      className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Reset filter
                    </button>
                  )}
                </div>
              </div>
            </div>
            <Table
              columns={tableColumns}
              data={branches}
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
              renderRow={(branch: Branch) => (
              <tr key={branch.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <code className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-mono text-sm">{branch.code}</code>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900 min-w-[140px]">{branch.name || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{branch.city || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{branch.region || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{branch.manager_name || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm whitespace-nowrap">{branch.phone || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{branch.email || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm max-w-[200px] truncate" title={branch.address || ''}>{branch.address || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{branch.koordinator_provinsi || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm whitespace-nowrap">{branch.koordinator_provinsi_phone || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{branch.koordinator_provinsi_email || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{branch.koordinator_wilayah || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm whitespace-nowrap">{branch.koordinator_wilayah_phone || '-'}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{branch.koordinator_wilayah_email || '-'}</td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <Badge variant={branch.is_active !== false ? 'success' : 'error'}>
                    {branch.is_active !== false ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </td>
                {canCreateBranch && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex justify-center">
                      <button
                        type="button"
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                        onClick={() => openEdit(branch)}
                        title="Edit Cabang"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            )}
          />
          </>
        )}
      </Card>

      {canCreateBranch && (adminWilayahList.length > 0 || adminProvinsiList.length > 0) && (
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Daftar Akun Wilayah & Provinsi</h3>
          <div className="space-y-4">
            {adminWilayahList.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> Admin Wilayah</p>
                <div className="flex flex-wrap gap-2">
                  {adminWilayahList.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-sm font-medium text-slate-800">{u.name}</span>
                      <span className="text-xs text-slate-500">({u.region})</span>
                      <button type="button" className="p-1.5 text-primary-600 hover:bg-primary-50 rounded" onClick={() => openEditAccount(u)}>
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {adminProvinsiList.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2"><Globe className="w-4 h-4" /> Admin Provinsi</p>
                <div className="flex flex-wrap gap-2">
                  {adminProvinsiList.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-sm font-medium text-slate-800">{u.name}</span>
                      <span className="text-xs text-slate-500">({u.region})</span>
                      <button type="button" className="p-1.5 text-primary-600 hover:bg-primary-50 rounded" onClick={() => openEditAccount(u)}>
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingBranchId(null); setEditingUserId(null); }}>
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">
              {editingUserId ? `Edit Akun ${addAccountMode === 'akun_wilayah' ? 'Wilayah' : 'Provinsi'}` : 'Tambah Akun'}
            </h3>
            {message && (
              <div className={`mb-4 rounded-lg px-4 py-3 ${message.type === 'success' ? 'bg-primary-50 text-primary-800 border border-primary-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingBranchId && !editingUserId && (
                <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Jenis akun</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setAddAccountMode('akun_wilayah')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${addAccountMode === 'akun_wilayah' ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                      <MapPin className="w-4 h-4" /> Akun Wilayah
                    </button>
                    <button type="button" onClick={() => setAddAccountMode('akun_provinsi')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${addAccountMode === 'akun_provinsi' ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                      <Globe className="w-4 h-4" /> Akun Provinsi
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {addAccountMode === 'akun_wilayah' && 'Pilih wilayah utama (Sumatra, Jawa, Kalimantan, dll).'}
                    {addAccountMode === 'akun_provinsi' && 'Pilih provinsi → sistem otomatis masukkan ke wilayah yang sesuai.'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama *</label>
                <input type="text" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" required placeholder="Nama lengkap" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input type="email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" required placeholder="email@contoh.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password {editingUserId ? '(kosongkan jika tidak ingin mengubah)' : '* (min. 6 karakter)'}</label>
                <input type="password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" required={!editingUserId} minLength={6} placeholder="••••••••" />
              </div>

              {editingBranchId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Kabupaten/Kota (Cabang) *</label>
                  <select value={accountForm.branch_id} onChange={(e) => setAccountForm({ ...accountForm, branch_id: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" required disabled={!!editingBranchId || !!editingUserId}>
                    <option value="">-- Pilih cabang --</option>
                    {allBranchesForSelect.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code}) - {b.region}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Provinsi & wilayah otomatis dari cabang yang dipilih.</p>
                </div>
              )}

              {addAccountMode === 'akun_wilayah' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Wilayah {editingUserId ? '(tidak dapat diubah)' : '*'}</label>
                  <select value={accountForm.region} onChange={(e) => setAccountForm({ ...accountForm, region: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" required disabled={!!editingUserId}>
                    <option value="">-- Pilih wilayah (Sumatra, Jawa, dll) --</option>
                    {wilayahForSelect.map((w) => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                    {accountForm.region && !wilayahForSelect.some((w) => w.name === accountForm.region) && (
                      <option value={accountForm.region}>{accountForm.region}</option>
                    )}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Wilayah utama: Sumatra, Jawa, Kalimantan, Sulawesi, Bali-Nusa Tenggara, Maluku, Papua.</p>
                </div>
              )}

              {addAccountMode === 'akun_provinsi' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Provinsi {editingUserId ? '(tidak dapat diubah)' : '*'}</label>
                  <select value={accountForm.region} onChange={(e) => setAccountForm({ ...accountForm, region: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" required disabled={!!editingUserId}>
                    <option value="">-- Pilih provinsi --</option>
                    {provincesForSelect.map((p) => (
                      <option key={p.id} value={p.nama ?? p.name ?? ''}>{p.nama ?? p.name ?? ''}</option>
                    ))}
                    {accountForm.region && !provincesForSelect.some((p) => (p.nama ?? p.name) === accountForm.region) && (
                      <option value={accountForm.region}>{accountForm.region}</option>
                    )}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Sistem otomatis masukkan ke wilayah yang sesuai (tidak perlu pilih wilayah).</p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditingBranchId(null); setEditingUserId(null); }}>Batal</Button>
                <Button type="submit" variant="primary" disabled={submitLoading}>
                  {submitLoading ? 'Menyimpan...' : editingUserId ? 'Simpan' : 'Buat Akun'}
                </Button>
              </div>
            </form>
          </div>
      </Modal>
    </div>
  );
};

export default BranchesPage;
