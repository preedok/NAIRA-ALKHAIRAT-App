import React, { useMemo, useState } from 'react';
import { Eye, Mail, Pencil, Phone, Plus, Search, ShieldCheck, UserCog } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import ActionMenu from '../../../components/common/ActionMenu';
import StatCard from '../../../components/common/StatCard';
import Modal, { ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common/Modal';
import { SelectOption, TableColumn, UserRole } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';

type UserStatus = 'active' | 'inactive';

type UserItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branchName: string;
  status: UserStatus;
  joinedAt: string;
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  jamaah: 'Jamaah'
};

const STATUS_LABEL: Record<UserStatus, { label: string; variant: 'success' | 'default' }> = {
  active: { label: 'Aktif', variant: 'success' },
  inactive: { label: 'Nonaktif', variant: 'default' }
};

const initialUsers: UserItem[] = [
  {
    id: 'USR-001',
    name: 'Ahmad Fauzi',
    email: 'ahmad.fauzi@naira.com',
    phone: '081234567890',
    role: 'admin',
    branchName: 'Pusat Jakarta',
    status: 'active',
    joinedAt: '2025-07-01'
  },
  {
    id: 'USR-002',
    name: 'Siti Rahma',
    email: 'siti.rahma@naira.com',
    phone: '081298765432',
    role: 'admin',
    branchName: 'Cabang Surabaya',
    status: 'active',
    joinedAt: '2025-10-15'
  },
  {
    id: 'USR-003',
    name: 'Budi Santoso',
    email: 'budi.santoso@gmail.com',
    phone: '082112223334',
    role: 'jamaah',
    branchName: 'Cabang Bandung',
    status: 'inactive',
    joinedAt: '2026-01-12'
  }
];

const emptyForm: Omit<UserItem, 'id' | 'joinedAt'> = {
  name: '',
  email: '',
  phone: '',
  role: 'jamaah',
  branchName: '',
  status: 'active'
};

const columns: TableColumn[] = [
  { id: 'name', label: 'Nama User' },
  { id: 'role', label: 'Role' },
  { id: 'branch', label: 'Cabang' },
  { id: 'status', label: 'Status', align: 'center' },
  { id: 'joined', label: 'Bergabung' },
  { id: 'actions', label: 'Aksi', align: 'right' }
];

const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'jamaah';
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [detailUser, setDetailUser] = useState<UserItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const roleOptions: SelectOption[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'jamaah', label: 'Jamaah' }
  ];
  const statusOptions: SelectOption[] = [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Nonaktif' }
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((item) => {
      const matchQuery =
        q.length === 0 ||
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.phone.includes(q);
      const matchRole = roleFilter === 'all' || item.role === roleFilter;
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchQuery && matchRole && matchStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = users.filter((x) => x.status === 'active').length;
    const admin = users.filter((x) => x.role !== 'jamaah').length;
    return {
      total: users.length,
      active,
      inactive: users.length - active,
      admin
    };
  }, [users]);

  const openCreate = () => {
    setEditingUser(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (item: UserItem) => {
    setEditingUser(item);
    setFormData({
      name: item.name,
      email: item.email,
      phone: item.phone,
      role: item.role,
      branchName: item.branchName,
      status: item.status
    });
    setFormOpen(true);
  };

  const saveUser = () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.branchName) return;
    if (editingUser) {
      setUsers((prev) => prev.map((item) => (item.id === editingUser.id ? { ...item, ...formData } : item)));
    } else {
      setUsers((prev) => [
        {
          id: `USR-${String(prev.length + 1).padStart(3, '0')}`,
          ...formData,
          joinedAt: new Date().toISOString().slice(0, 10)
        },
        ...prev
      ]);
    }
    setFormOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total User" value={stats.total} />
        <StatCard label="User Aktif" value={stats.active} accentClassName="text-emerald-600" />
        <StatCard label="User Nonaktif" value={stats.inactive} />
        <StatCard label="Admin" value={stats.admin} accentClassName="text-[#8f6828]" />
      </div>

      <Card>
        <div className={`grid grid-cols-1 gap-3 ${isReadOnly ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-3">
            <Input
              ariaLabel="Cari user"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              placeholder="Cari nama, email, atau nomor HP"
            />
            <Autocomplete
              value={roleFilter === 'all' ? '' : roleFilter}
              onChange={(value) => setRoleFilter((value || 'all') as 'all' | UserRole)}
              options={roleOptions}
              emptyLabel="Semua role"
            />
            <Autocomplete
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={(value) => setStatusFilter((value || 'all') as 'all' | UserStatus)}
              options={statusOptions}
              emptyLabel="Semua status"
            />
          </div>
          {!isReadOnly && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate} className="w-full lg:w-auto lg:justify-self-end">
              Tambah User
            </Button>
          )}
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          emptyMessage="Belum ada data user"
          emptyDescription="Tambahkan user untuk mulai kelola akses dashboard."
          stickyActionsColumn
          renderRow={(item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-500">{item.email}</p>
              </td>
              <td className="px-4 py-3">
                <Badge variant={item.role === 'jamaah' ? 'default' : 'info'} size="sm">
                  {ROLE_LABEL[item.role]}
                </Badge>
              </td>
              <td className="px-4 py-3 text-slate-700">{item.branchName}</td>
              <td className="px-4 py-3 text-center">
                <Badge variant={STATUS_LABEL[item.status].variant} size="sm">{STATUS_LABEL[item.status].label}</Badge>
              </td>
              <td className="px-4 py-3 text-slate-700">{new Date(item.joinedAt).toLocaleDateString('id-ID')}</td>
              <td className="px-4 py-3">
                <div className="relative flex items-center justify-end">
                  <ActionMenu
                    menuWidthClass="w-[170px]"
                    items={[
                      { id: 'detail', label: 'Detail', icon: <Eye className="w-4 h-4" />, onClick: () => setDetailUser(item) },
                      ...(!isReadOnly
                        ? [{
                            id: 'edit',
                            label: 'Edit',
                            icon: <Pencil className="w-4 h-4" />,
                            tone: 'warning' as const,
                            onClick: () => openEdit(item)
                          }]
                        : [])
                    ]}
                  />
                </div>
              </td>
            </tr>
          )}
        />
      </Card>

      <Modal open={!!detailUser} onClose={() => setDetailUser(null)}>
        <ModalBox className="max-w-2xl min-h-0">
          <ModalHeader title={detailUser?.name || 'Detail User'} subtitle={detailUser?.id} onClose={() => setDetailUser(null)} icon={<UserCog className="w-5 h-5" />} />
          <ModalBody>
            {detailUser && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Role</p>
                    <p className="font-semibold">{ROLE_LABEL[detailUser.role]}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Cabang</p>
                    <p className="font-semibold">{detailUser.branchName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tanggal Bergabung</p>
                    <p className="font-semibold">{new Date(detailUser.joinedAt).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <Badge variant={STATUS_LABEL[detailUser.status].variant} size="sm">{STATUS_LABEL[detailUser.status].label}</Badge>
                  </div>
                </div>
                <Card className="bg-slate-50 border-slate-100">
                  <p className="text-sm text-slate-700 inline-flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {detailUser.email}
                  </p>
                  <p className="text-sm text-slate-700 inline-flex items-center gap-2 mt-2">
                    <Phone className="w-4 h-4" />
                    {detailUser.phone}
                  </p>
                </Card>
                <Card className="bg-amber-50 border-amber-100">
                  <p className="text-sm text-amber-700 inline-flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Hak akses sesuai role: {ROLE_LABEL[detailUser.role]}
                  </p>
                </Card>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setDetailUser(null)}>Tutup</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>

      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        <ModalBox>
          <ModalHeader title={editingUser ? 'Edit User' : 'Tambah User'} subtitle="Kelola akun dan role user" onClose={() => setFormOpen(false)} />
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Nama lengkap" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
              <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} />
              <Input label="Nomor HP" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} />
              <Input label="Cabang" value={formData.branchName} onChange={(e) => setFormData((p) => ({ ...p, branchName: e.target.value }))} />
              <Autocomplete
                label="Role"
                value={formData.role}
                onChange={(value) => setFormData((p) => ({ ...p, role: value as UserRole }))}
                options={roleOptions}
              />
              <Autocomplete
                label="Status"
                value={formData.status}
                onChange={(value) => setFormData((p) => ({ ...p, status: value as UserStatus }))}
                options={statusOptions}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={saveUser}>{editingUser ? 'Update User' : 'Simpan User'}</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default UsersPage;
