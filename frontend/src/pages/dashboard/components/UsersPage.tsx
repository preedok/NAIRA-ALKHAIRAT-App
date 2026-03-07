import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users as UsersIcon, Plus, Search, Edit, Trash2, Eye, Shield, Mail, FileCheck, CheckCircle, Copy, Power, PowerOff } from 'lucide-react';
import { ROLE_NAMES, TableColumn, OWNER_STATUS_LABELS } from '../../../types';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBox } from '../../../components/common/Modal';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import ContentLoading from '../../../components/common/ContentLoading';
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import { adminPusatApi, branchesApi, ownersApi, UserListItem, type KabupatenForOwnerItem } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { API_BASE_URL, AUTOCOMPLETE_FILTER, AUTOCOMPLETE_PILIH } from '../../../utils/constants';

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
  const [editForm, setEditForm] = useState<{
    name: string; email: string; phone: string; company_name: string; is_active: boolean; password: string;
    role: string; region: string; provinsi_id: string; kabupaten_kode: string; kabupaten_nama: string;
  }>({
    name: '', email: '', phone: '', company_name: '', is_active: true, password: '',
    role: 'role_bus', region: '', provinsi_id: '', kabupaten_kode: '', kabupaten_nama: ''
  });
  const [editActivationPassword, setEditActivationPassword] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [verifyRegPaymentUser, setVerifyRegPaymentUser] = useState<UserListItem | null>(null);
  const [verifyRegPaymentReject, setVerifyRegPaymentReject] = useState('');
  const [verifyingRegPayment, setVerifyingRegPayment] = useState(false);
  const [activateResult, setActivateResult] = useState<{ password: string; mouUrl: string } | null>(null);
  const tableSectionRef = useRef<HTMLDivElement>(null);

  /** Modal Tambah User: owner (kabupaten→provinsi&wilayah), koordinator (pilih wilayah), pusat/bus/hotel/accounting (tanpa wilayah) */
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState<{
    name: string; email: string; password: string; role: string; region: string;
    provinsi_id: string; kabupaten_kode: string; kabupaten_nama: string;
  }>({
    name: '',
    email: '',
    password: '',
    role: 'role_bus',
    region: '',
    provinsi_id: '',
    kabupaten_kode: '',
    kabupaten_nama: ''
  });
  const [addUserSaving, setAddUserSaving] = useState(false);
  const [addUserProvinces, setAddUserProvinces] = useState<{ id: string; name: string }[]>([]);
  /** Semua kabupaten dengan provinsi & wilayah untuk dropdown owner (pilih kabupaten → auto provinsi & wilayah) */
  const [kabupatenForOwner, setKabupatenForOwner] = useState<KabupatenForOwnerItem[]>([]);
  /** Legacy: reset when opening modal (owner now uses kabupatenForOwner) */
  const [, setAddUserKabupaten] = useState<{ id: string; kode: string; nama: string }[]>([]);

  const canListUsers =
    currentUser?.role === 'super_admin' || currentUser?.role === 'admin_pusat';

  useEffect(() => {
    branchesApi.listWilayah().then((res) => {
      if (res.data?.data) setWilayahList(res.data.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const params = wilayahId && String(wilayahId).trim() !== '' ? { wilayah_id: wilayahId } : undefined;
    branchesApi.listProvinces(params).then((res) => {
      if (res.data?.data && Array.isArray(res.data.data)) {
        const list = (res.data.data as { id: string; name?: string; nama?: string; wilayah_id?: string }[]).map((p: any) => ({
          id: p.id,
          name: p.name || p.nama || '',
          wilayah_id: p.wilayah_id
        }));
        setProvincesList(list);
      } else setProvincesList([]);
    }).catch(() => setProvincesList([]));
  }, [wilayahId]);

  const provincesFiltered = provincesList;

  useEffect(() => {
    const params: { limit: number; page: number; provinsi_id?: string; wilayah_id?: string } = { limit: 500, page: 1 };
    if (provinsiId) params.provinsi_id = provinsiId;
    else if (wilayahId) params.wilayah_id = wilayahId;
    branchesApi.list(params).then((res) => {
      if (res.data?.data) setBranches(res.data.data);
    }).catch(() => {});
  }, [wilayahId, provinsiId]);

  useEffect(() => {
    if (addUserModalOpen) {
      branchesApi.listProvinces().then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          const list = (res.data.data as { id: string; name?: string; nama?: string }[]).map((p: any) => ({
            id: p.id,
            name: p.name || p.nama || ''
          }));
          setAddUserProvinces(list);
        } else setAddUserProvinces([]);
      }).catch(() => setAddUserProvinces([]));
    }
  }, [addUserModalOpen]);

  /** Untuk owner: load semua kabupaten dengan provinsi & wilayah (pilih kabupaten → auto provinsi & wilayah) */
  useEffect(() => {
    if (!addUserModalOpen || addUserForm.role !== 'owner') {
      setKabupatenForOwner([]);
      return;
    }
    branchesApi.listKabupatenForOwner().then((res) => {
      if (res.data?.data && Array.isArray(res.data.data)) {
        setKabupatenForOwner(res.data.data);
      } else setKabupatenForOwner([]);
    }).catch(() => setKabupatenForOwner([]));
  }, [addUserModalOpen, addUserForm.role]);

  const openAddUserModal = useCallback(() => {
    setAddUserForm({
      name: '',
      email: '',
      password: '',
      role: 'role_bus',
      region: '',
      provinsi_id: '',
      kabupaten_kode: '',
      kabupaten_nama: ''
    });
    setAddUserKabupaten([]);
    setAddUserModalOpen(true);
  }, []);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password, role, region, provinsi_id, kabupaten_kode, kabupaten_nama } = addUserForm;
    if (!name.trim() || !email.trim() || !password.trim()) {
      showToast('Nama, email, dan password wajib diisi', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password minimal 6 karakter', 'error');
      return;
    }
    const isKoordinatorRole = ['visa_koordinator', 'tiket_koordinator', 'invoice_koordinator'].includes(role);
    if (isKoordinatorRole && !region.trim()) {
      showToast('Pilih wilayah untuk koordinator', 'error');
      return;
    }
    if (role === 'owner' && (!provinsi_id.trim() || !kabupaten_kode.trim())) {
      showToast('Pilih kabupaten (provinsi dan kabupaten/kota)', 'error');
      return;
    }
    setAddUserSaving(true);
    try {
      const body: Parameters<typeof adminPusatApi.createUser>[0] = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role
      };
      if (isKoordinatorRole && region.trim()) body.region = region.trim();
      if (role === 'owner') {
        body.provinsi_id = provinsi_id.trim();
        body.kabupaten_kode = kabupaten_kode.trim();
        if (kabupaten_nama.trim()) body.kabupaten_nama = kabupaten_nama.trim();
      }
      await adminPusatApi.createUser(body);
      showToast('User berhasil ditambahkan', 'success');
      setAddUserModalOpen(false);
      setAddUserForm({
        name: '', email: '', password: '', role: 'role_bus', region: '',
        provinsi_id: '', kabupaten_kode: '', kabupaten_nama: ''
      });
      fetchUsers();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Gagal menambah user', 'error');
    } finally {
      setAddUserSaving(false);
    }
  };

  const openEdit = useCallback(async (user: UserListItem) => {
    setEditUser(user);
    const listPw = (user as UserListItem & { activation_generated_password?: string | null }).activation_generated_password;
    setEditActivationPassword(listPw && String(listPw).trim() ? String(listPw).trim() : null);
    const baseForm = {
      name: user.name || '',
      email: user.email || '',
      phone: (user as any).phone ?? '',
      company_name: user.company_name ?? '',
      is_active: user.is_active !== false,
      password: '',
      role: (user as any).role || 'role_bus',
      region: '',
      provinsi_id: '',
      kabupaten_kode: '',
      kabupaten_nama: ''
    };
    if ((user as any).role && ['visa_koordinator', 'tiket_koordinator', 'invoice_koordinator'].includes((user as any).role)) {
      baseForm.region = (user as any).wilayah_id ?? '';
    }
    setEditForm(baseForm);
    try {
      let kabList: KabupatenForOwnerItem[] = [];
      if ((user as any).role === 'owner') {
        const kabRes = await branchesApi.listKabupatenForOwner();
        if (kabRes.data?.data) {
          kabList = kabRes.data.data;
          setKabupatenForOwner(kabList);
        }
      }
      const res = await adminPusatApi.getUserById(user.id);
      if (res.data?.success && res.data?.data) {
        const d = res.data.data as {
          name?: string; email?: string; phone?: string; company_name?: string; is_active?: boolean;
          role?: string; wilayah_id?: string; Branch?: { id?: string; provinsi_id?: string; name?: string; city?: string };
          activation_generated_password?: string | null; OwnerProfile?: { activation_generated_password?: string | null }; assigned_branch_id?: string; operational_region?: string;
        };
        const next: typeof baseForm = {
          ...baseForm,
          name: d.name || '',
          email: d.email || '',
          phone: d.phone ?? '',
          company_name: d.company_name ?? '',
          is_active: d.is_active !== false,
          role: d.role || baseForm.role,
          region: d.wilayah_id ?? baseForm.region,
          provinsi_id: '',
          kabupaten_kode: '',
          kabupaten_nama: ''
        };
        if (d.role === 'owner' && d.Branch?.provinsi_id) {
          next.provinsi_id = d.Branch.provinsi_id;
          const cityOrName = (d.Branch.city || d.Branch.name || '').trim();
          if (cityOrName && kabList.length > 0) {
            const match = kabList.find((k) => k.provinsi_id === d.Branch!.provinsi_id && (k.nama.toLowerCase().includes(cityOrName.toLowerCase()) || cityOrName.toLowerCase().includes(k.nama.toLowerCase())));
            if (match) {
              next.kabupaten_kode = match.kode;
              next.kabupaten_nama = match.nama;
            }
          }
        }
        setEditForm(next);
        const activationPw = d.activation_generated_password ?? d.OwnerProfile?.activation_generated_password;
        if (activationPw && String(activationPw).trim()) setEditActivationPassword(String(activationPw).trim());
      }
    } catch {
      setEditForm((f) => ({ ...f, name: user.name || '', email: user.email || '' }));
    }
  }, []);

  const handleToggleActive = async (user: UserListItem) => {
    try {
      await adminPusatApi.updateUser(user.id, { is_active: !user.is_active });
      showToast(user.is_active ? 'User dinonaktifkan' : 'User diaktifkan', 'success');
      fetchUsers();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal mengubah status', 'error');
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;
    const isKoordinator = ['visa_koordinator', 'tiket_koordinator', 'invoice_koordinator'].includes(editForm.role);
    if (isKoordinator && !editForm.region.trim()) {
      showToast('Pilih wilayah untuk koordinator', 'error');
      return;
    }
    if (editForm.role === 'owner' && (!editForm.provinsi_id.trim() || !editForm.kabupaten_kode.trim())) {
      showToast('Pilih kabupaten/kota untuk owner', 'error');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role
      };
      if (editForm.password.length >= 6) body.password = editForm.password;
      if (isKoordinator) body.region = editForm.region.trim();
      if (editForm.role === 'owner') {
        body.provinsi_id = editForm.provinsi_id.trim();
        body.kabupaten_kode = editForm.kabupaten_kode.trim();
        if (editForm.kabupaten_nama.trim()) body.kabupaten_nama = editForm.kabupaten_nama.trim();
      }
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
    items.push({
      id: 'toggle_active',
      label: user.is_active ? 'Nonaktifkan' : 'Aktifkan',
      icon: user.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />,
      onClick: () => handleToggleActive(user)
    });
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen User"
        subtitle="Daftar user – tambah akun via Admin Pusat / Admin Cabang"
        right={<AutoRefreshControl onRefresh={fetchUsers} disabled={loading} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <StatCard
            key={i}
            icon={<UsersIcon className="w-5 h-5" />}
            label={stat.label}
            value={stat.value}
            iconClassName={`bg-gradient-to-br ${stat.color} text-white`}
            onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
            action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>}
          />
        ))}
      </div>

      <div ref={tableSectionRef}>
      <Card className="travel-card overflow-visible">
        <CardSectionHeader
          icon={<UsersIcon className="w-6 h-6" />}
          title="Daftar User"
          subtitle="Filter menurut tipe, wilayah, provinsi, cabang. Hanya dapat diakses Super Admin dan Admin Pusat."
          className="mb-4"
          right={
            canListUsers ? (
              <Button variant="primary" size="sm" className="gap-1.5" onClick={openAddUserModal}>
                <Plus className="w-4 h-4" /> Tambah User
              </Button>
            ) : undefined
          }
        />

        {/* Filter: judul section + input + tombol Semua/Divisi/Owner */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2 lg:col-span-1 min-w-0">
              <Input
                label="Cari"
                type="text"
                placeholder="Nama atau email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            {canListUsers && (
              <>
                <div className="min-w-0">
                  <Autocomplete
                    value={wilayahId}
                    onChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }}
                    options={[{ value: '', label: 'Semua wilayah' }, ...wilayahList.map((w) => ({ value: w.id, label: w.name }))]}
                    placeholder="Wilayah"
                    emptyLabel="Semua wilayah"
                    fullWidth
                  />
                </div>
                <div className="min-w-0">
                  <Autocomplete
                    value={provinsiId}
                    onChange={(v) => { setProvinsiId(v); setBranchId(''); }}
                    options={[{ value: '', label: AUTOCOMPLETE_FILTER.SEMUA_PROVINSI }, ...provincesFiltered.map((p) => ({ value: p.id, label: p.name }))]}
                    placeholder={AUTOCOMPLETE_FILTER.SEMUA_PROVINSI}
                    emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_PROVINSI}
                    fullWidth
                  />
                </div>
                <div className="min-w-0">
                  <Autocomplete
                    value={branchId}
                    onChange={(v) => setBranchId(v)}
                    options={[{ value: '', label: 'Semua cabang' }, ...branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}${b.city ? ` (${b.city})` : ''}` }))]}
                    placeholder="Cabang"
                    emptyLabel="Semua cabang"
                    fullWidth
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'divisi', 'owner'] as const).map((tab) => (
              <Button
                key={tab}
                variant={tabFilter === tab ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTabFilter(tab)}
              >
                {tab === 'all' ? 'Semua' : tab === 'divisi' ? 'Divisi' : 'Owner'}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          {error ? (
            <div className="rounded-lg bg-red-50 p-4 text-red-700 text-sm m-4">
              {error}
            </div>
          ) : loading ? (
            <ContentLoading />
          ) : (
          <Table
          columns={tableColumns}
          data={filteredUsers}
          sort={{ columnId: sortBy, order: sortOrder }}
          onSortChange={(col, order) => { setSortBy(col); setSortOrder(order); setPage(1); }}
          stickyActionsColumn
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
          )}
        </div>
      </Card>
      </div>

      {/* Modal Edit User — isi sama dengan Tambah User */}
      <Modal open={!!editUser} onClose={() => { setEditUser(null); setEditActivationPassword(null); }}>
        {editUser && (
          <ModalBox>
            <ModalHeader
              title="Edit User"
              subtitle="Ubah data user. Untuk Owner: pilih Kabupaten/Kota. Koordinator: pilih Wilayah. Pusat, Bus, Hotel, Accounting tidak perlu lokasi."
              icon={<Edit className="w-5 h-5" />}
              onClose={() => { setEditUser(null); setEditActivationPassword(null); }}
            />
            <ModalBody className="space-y-4">
              <Input label="Nama *" type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama lengkap" />
              <Input label="Email *" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@contoh.com" />
              <Autocomplete
                label="Role *"
                value={editForm.role}
                onChange={(v) => setEditForm((f) => ({ ...f, role: v, region: '', provinsi_id: '', kabupaten_kode: '', kabupaten_nama: '' }))}
                options={[
                  { value: 'owner', label: 'Owner' },
                  { value: 'role_bus', label: 'Bus Saudi' },
                  { value: 'role_hotel', label: 'Hotel Saudi' },
                  { value: 'admin_pusat', label: 'Admin Pusat' },
                  { value: 'role_accounting', label: 'Accounting' },
                  { value: 'visa_koordinator', label: 'Visa Koordinator' },
                  { value: 'tiket_koordinator', label: 'Tiket Koordinator' },
                  { value: 'invoice_koordinator', label: 'Invoice Koordinator' },
                  { value: 'invoice_saudi', label: 'Invoice Saudi' },
                  { value: 'handling', label: 'Handling' }
                ]}
                placeholder={AUTOCOMPLETE_PILIH.PILIH_ROLE}
              />
              {(editForm.role === 'visa_koordinator' || editForm.role === 'tiket_koordinator' || editForm.role === 'invoice_koordinator') && (
                <>
                  <Autocomplete
                    label="Wilayah *"
                    value={editForm.region}
                    onChange={(v) => setEditForm((f) => ({ ...f, region: v }))}
                    options={wilayahList.map((w) => ({ value: w.id, label: w.name }))}
                    placeholder={AUTOCOMPLETE_PILIH.PILIH_WILAYAH}
                    emptyLabel={AUTOCOMPLETE_PILIH.PILIH_WILAYAH}
                  />
                  <p className="text-xs text-slate-500 mt-1">Provinsi dan kota di wilayah ini otomatis berlaku.</p>
                </>
              )}
              {editForm.role === 'owner' && (
                <>
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    Untuk role Owner: cukup pilih <strong>Kabupaten/Kota</strong>. Provinsi dan Wilayah otomatis mengikuti.
                  </p>
                  <Autocomplete
                    label="Kabupaten/Kota *"
                    value={editForm.provinsi_id && editForm.kabupaten_kode ? `${editForm.provinsi_id}:${editForm.kabupaten_kode}` : ''}
                    onChange={(v) => {
                      const item = kabupatenForOwner.find((k) => `${k.provinsi_id}:${k.kode}` === v);
                      if (item) {
                        setEditForm((f) => ({ ...f, provinsi_id: item.provinsi_id, kabupaten_kode: item.kode, kabupaten_nama: item.nama }));
                      } else {
                        setEditForm((f) => ({ ...f, provinsi_id: '', kabupaten_kode: '', kabupaten_nama: '' }));
                      }
                    }}
                    options={kabupatenForOwner.map((k) => ({
                      value: `${k.provinsi_id}:${k.kode}`,
                      label: `${k.nama} (${k.provinsi_nama}${k.wilayah_nama ? `, ${k.wilayah_nama}` : ''})`
                    }))}
                    placeholder={AUTOCOMPLETE_PILIH.PILIH_KABUPATEN}
                    emptyLabel={AUTOCOMPLETE_PILIH.PILIH_KABUPATEN}
                  />
                  {editForm.provinsi_id && editForm.kabupaten_kode && (() => {
                    const sel = kabupatenForOwner.find((k) => k.provinsi_id === editForm.provinsi_id && k.kode === editForm.kabupaten_kode);
                    return sel ? (
                      <p className="text-xs text-slate-500 mt-1">Otomatis: Provinsi <strong>{sel.provinsi_nama}</strong>{sel.wilayah_nama ? <> · Wilayah <strong>{sel.wilayah_nama}</strong></> : null}</p>
                    ) : null;
                  })()}
                </>
              )}
              {editForm.role === 'owner' && (
                <div>
                  {editActivationPassword ? (
                    <>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Password saat ini (dari aktivasi sistem)</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono break-all">{editActivationPassword}</code>
                        <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(editActivationPassword); showToast('Password disalin', 'success'); }}>Salin</Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Password dari aktivasi hanya tampil untuk owner yang diaktivasi setelah fitur ini. Gunakan &quot;Ubah password&quot; di bawah untuk set password baru.</p>
                  )}
                </div>
              )}
              <Input label="Ubah password (kosongkan jika tidak diubah)" type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 6 karakter" autoComplete="new-password" />
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditUser(null)}>Batal</Button>
              <Button variant="primary" onClick={saveEdit} disabled={saving || !editForm.name.trim() || !editForm.email.trim()}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        {deleteTarget && (
          <ModalBox>
            <ModalHeader title="Hapus User" subtitle="User akan dinonaktifkan dan tidak dapat login" icon={<Trash2 className="w-5 h-5" />} onClose={() => setDeleteTarget(null)} />
            <ModalBody className="space-y-4">
              <p className="text-sm text-slate-600">Yakin ingin menghapus user <strong>{deleteTarget.name}</strong> ({deleteTarget.email})? User akan dinonaktifkan.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Menghapus...' : 'Hapus'}</Button>
            </ModalFooter>
          </ModalBox>
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
            <ModalBox>
              <ModalHeader
                title="Verifikasi Bukti Bayar MoU (diupload owner)"
                icon={<FileCheck className="w-5 h-5" />}
                subtitle={
                  <>
                    {verifyRegPaymentUser.name} – {verifyRegPaymentUser.email}
                    {(verifyRegPaymentUser as UserListItem & { registration_payment_amount?: number }).registration_payment_amount != null && (
                      <span className="block mt-1">
                        Jumlah yang diinput: <strong>Rp {new Intl.NumberFormat('id-ID').format((verifyRegPaymentUser as UserListItem & { registration_payment_amount?: number }).registration_payment_amount!)}</strong>
                      </span>
                    )}
                  </>
                }
                onClose={() => { setVerifyRegPaymentUser(null); setVerifyRegPaymentReject(''); }}
              />
              <ModalBody className="space-y-4">
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
                <Autocomplete
                  label="Alasan penolakan (wajib jika tolak)"
                  value={verifyRegPaymentReject}
                  onChange={(v) => setVerifyRegPaymentReject(v)}
                  options={REGISTRATION_REJECTION_REASONS}
                  placeholder={AUTOCOMPLETE_PILIH.PILIH_ALASAN}
                  emptyLabel={AUTOCOMPLETE_PILIH.PILIH_ALASAN}
                  fullWidth
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="outline" onClick={() => { setVerifyRegPaymentUser(null); setVerifyRegPaymentReject(''); }}>Batal</Button>
                <Button variant="outline" onClick={() => handleVerifyRegistrationPayment(false)} disabled={verifyingRegPayment || !verifyRegPaymentReject.trim()}>Tolak</Button>
                <Button variant="primary" onClick={() => handleVerifyRegistrationPayment(true)} disabled={verifyingRegPayment}>{verifyingRegPayment ? 'Memproses...' : 'Setujui Bukti Bayar'}</Button>
              </ModalFooter>
            </ModalBox>
          );
        })()}
      </Modal>

      {/* Modal Hasil Aktivasi */}
      <Modal open={!!activateResult} onClose={() => setActivateResult(null)}>
        {activateResult && (
          <ModalBox>
            <ModalHeader title="Owner Diaktifkan" subtitle="Email MOU dan kredensial telah dikirim ke owner" icon={<CheckCircle className="w-5 h-5" />} onClose={() => setActivateResult(null)} />
            <ModalBody className="space-y-4">
            <p className="text-sm text-slate-600">Email berisi MOU dan kredensial telah dikirim ke owner. Berikan data berikut jika diperlukan.</p>
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
            </ModalBody>
            <ModalFooter>
              <Button variant="primary" className="w-full" onClick={() => setActivateResult(null)}>Tutup</Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal Tambah User */}
      <Modal open={addUserModalOpen} onClose={() => !addUserSaving && setAddUserModalOpen(false)}>
        <ModalBox>
          <ModalHeader
            title="Tambah User"
            subtitle="Buat akun baru: pilih role. Untuk Owner: cukup pilih Kabupaten/Kota — provinsi dan wilayah otomatis terisi. Koordinator pilih Wilayah. Pusat, Bus, Hotel, Accounting tidak perlu lokasi."
            icon={<UsersIcon className="w-5 h-5" />}
            onClose={() => !addUserSaving && setAddUserModalOpen(false)}
          />
          <form onSubmit={handleAddUserSubmit}>
            <ModalBody className="space-y-4">
              <Input
                label="Nama *"
                type="text"
                value={addUserForm.name}
                onChange={(e) => setAddUserForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama lengkap"
                required
              />
              <Input
                label="Email *"
                type="email"
                value={addUserForm.email}
                onChange={(e) => setAddUserForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@contoh.com"
                required
              />
              <Input
                label="Password * (min. 6 karakter)"
                type="password"
                value={addUserForm.password}
                onChange={(e) => setAddUserForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                minLength={6}
                required
              />
              <Autocomplete
                label="Role *"
                value={addUserForm.role}
                onChange={(v) => setAddUserForm((f) => ({
                  ...f,
                  role: v,
                  region: '',
                  provinsi_id: '',
                  kabupaten_kode: '',
                  kabupaten_nama: ''
                }))}
                options={[
                  { value: 'owner', label: 'Owner' },
                  { value: 'role_bus', label: 'Bus Saudi' },
                  { value: 'role_hotel', label: 'Hotel Saudi' },
                  { value: 'admin_pusat', label: 'Admin Pusat' },
                  { value: 'role_accounting', label: 'Accounting' },
                  { value: 'visa_koordinator', label: 'Visa Koordinator' },
                  { value: 'tiket_koordinator', label: 'Tiket Koordinator' },
                  { value: 'invoice_koordinator', label: 'Invoice Koordinator' },
                  { value: 'invoice_saudi', label: 'Invoice Saudi' },
                  { value: 'handling', label: 'Handling' }
                ]}
                placeholder={AUTOCOMPLETE_PILIH.PILIH_ROLE}
              />
              {(addUserForm.role === 'visa_koordinator' || addUserForm.role === 'tiket_koordinator' || addUserForm.role === 'invoice_koordinator') && (
                <>
                  <Autocomplete
                    label="Wilayah *"
                    value={addUserForm.region}
                    onChange={(v) => setAddUserForm((f) => ({ ...f, region: v }))}
                    options={wilayahList.map((w) => ({ value: w.id, label: w.name }))}
                    placeholder={AUTOCOMPLETE_PILIH.PILIH_WILAYAH}
                    emptyLabel={AUTOCOMPLETE_PILIH.PILIH_WILAYAH}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Provinsi dan kota di wilayah ini otomatis berlaku. User bekerja di daerah-daerah dalam wilayah tersebut.
                  </p>
                </>
              )}
              {addUserForm.role === 'owner' && (
                <>
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    Untuk role Owner: cukup pilih <strong>Kabupaten/Kota</strong>. Provinsi dan Wilayah otomatis mengikuti.
                  </p>
                  <Autocomplete
                    label="Kabupaten/Kota *"
                    value={addUserForm.provinsi_id && addUserForm.kabupaten_kode ? `${addUserForm.provinsi_id}:${addUserForm.kabupaten_kode}` : ''}
                    onChange={(v) => {
                      const item = kabupatenForOwner.find((k) => `${k.provinsi_id}:${k.kode}` === v);
                      if (item) {
                        setAddUserForm((f) => ({
                          ...f,
                          provinsi_id: item.provinsi_id,
                          kabupaten_kode: item.kode,
                          kabupaten_nama: item.nama
                        }));
                      } else {
                        setAddUserForm((f) => ({ ...f, provinsi_id: '', kabupaten_kode: '', kabupaten_nama: '' }));
                      }
                    }}
                    options={kabupatenForOwner.map((k) => ({
                      value: `${k.provinsi_id}:${k.kode}`,
                      label: `${k.nama} (${k.provinsi_nama}${k.wilayah_nama ? `, ${k.wilayah_nama}` : ''})`
                    }))}
                    placeholder={AUTOCOMPLETE_PILIH.PILIH_KABUPATEN}
                    emptyLabel={AUTOCOMPLETE_PILIH.PILIH_KABUPATEN}
                  />
                  {addUserForm.provinsi_id && addUserForm.kabupaten_kode && (() => {
                    const sel = kabupatenForOwner.find((k) => k.provinsi_id === addUserForm.provinsi_id && k.kode === addUserForm.kabupaten_kode);
                    return sel ? (
                      <p className="text-xs text-slate-500 mt-1">
                        Otomatis: Provinsi <strong>{sel.provinsi_nama}</strong>
                        {sel.wilayah_nama ? <> · Wilayah <strong>{sel.wilayah_nama}</strong></> : null}
                      </p>
                    ) : null;
                  })()}
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="outline" onClick={() => setAddUserModalOpen(false)} disabled={addUserSaving}>
                Batal
              </Button>
              <Button type="submit" variant="primary" disabled={addUserSaving}>
                {addUserSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </ModalFooter>
          </form>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default UsersPage;