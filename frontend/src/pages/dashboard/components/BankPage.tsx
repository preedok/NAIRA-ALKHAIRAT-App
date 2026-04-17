import React, { useMemo, useState } from 'react';
import { Building2, Landmark, Pencil, Plus, Search, Star, Wallet } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import ActionMenu from '../../../components/common/ActionMenu';
import StatCard from '../../../components/common/StatCard';
import Modal, { ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common/Modal';
import { SelectOption, TableColumn } from '../../../types';

type BankStatus = 'active' | 'inactive';

type BankAccountItem = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  status: BankStatus;
  isPrimary: boolean;
};

const STATUS_MAP: Record<BankStatus, { label: string; variant: 'success' | 'default' }> = {
  active: { label: 'Aktif', variant: 'success' },
  inactive: { label: 'Nonaktif', variant: 'default' }
};

const initialAccounts: BankAccountItem[] = [
  {
    id: 'BNK-001',
    bankName: 'BCA',
    accountNumber: '1234567890',
    accountHolder: 'PT Nail Al-Khairat Travel',
    branch: 'KCP Jakarta Pusat',
    status: 'active',
    isPrimary: true
  },
  {
    id: 'BNK-002',
    bankName: 'Bank Syariah Indonesia',
    accountNumber: '7770001234',
    accountHolder: 'PT Nail Al-Khairat Travel',
    branch: 'KCP Surabaya',
    status: 'active',
    isPrimary: false
  },
  {
    id: 'BNK-003',
    bankName: 'Mandiri',
    accountNumber: '9876543210',
    accountHolder: 'PT Nail Al-Khairat Travel',
    branch: 'KC Bandung',
    status: 'inactive',
    isPrimary: false
  }
];

const columns: TableColumn[] = [
  { id: 'bank', label: 'Bank' },
  { id: 'account', label: 'Nomor Rekening' },
  { id: 'holder', label: 'Pemilik Rekening' },
  { id: 'status', label: 'Status', align: 'center' },
  { id: 'actions', label: 'Aksi', align: 'right' }
];

const emptyForm = {
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  branch: '',
  status: 'active' as BankStatus
};

const BankPage: React.FC = () => {
  const [accounts, setAccounts] = useState<BankAccountItem[]>(initialAccounts);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BankStatus>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BankAccountItem | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const statusOptions: SelectOption[] = [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Nonaktif' }
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((item) => {
      const queryMatch =
        q.length === 0 ||
        item.bankName.toLowerCase().includes(q) ||
        item.accountNumber.toLowerCase().includes(q) ||
        item.accountHolder.toLowerCase().includes(q);
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      return queryMatch && statusMatch;
    });
  }, [accounts, query, statusFilter]);

  const stats = useMemo(() => {
    const active = accounts.filter((x) => x.status === 'active').length;
    const primary = accounts.filter((x) => x.isPrimary).length;
    return { total: accounts.length, active, inactive: accounts.length - active, primary };
  }, [accounts]);

  const openCreate = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (item: BankAccountItem) => {
    setEditingItem(item);
    setFormData({
      bankName: item.bankName,
      accountNumber: item.accountNumber,
      accountHolder: item.accountHolder,
      branch: item.branch,
      status: item.status
    });
    setFormOpen(true);
  };

  const saveAccount = () => {
    if (!formData.bankName || !formData.accountNumber || !formData.accountHolder) return;
    if (editingItem) {
      setAccounts((prev) =>
        prev.map((item) => (item.id === editingItem.id ? { ...item, ...formData } : item))
      );
    } else {
      setAccounts((prev) => [
        {
          id: `BNK-${String(prev.length + 1).padStart(3, '0')}`,
          ...formData,
          isPrimary: prev.length === 0
        },
        ...prev
      ]);
    }
    setFormOpen(false);
  };

  const setPrimary = (id: string) => {
    setAccounts((prev) => prev.map((item) => ({ ...item, isPrimary: item.id === id })));
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Rekening" value={stats.total} />
        <StatCard label="Rekening Aktif" value={stats.active} accentClassName="text-emerald-600" />
        <StatCard label="Rekening Nonaktif" value={stats.inactive} />
        <StatCard label="Rekening Utama" value={stats.primary} accentClassName="text-[#8f6828]" />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:col-span-2">
            <Input
              ariaLabel="Cari rekening bank"
              placeholder="Cari bank / no rekening / pemilik"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
            <Autocomplete
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={(value) => setStatusFilter((value || 'all') as 'all' | BankStatus)}
              options={statusOptions}
              emptyLabel="Semua status"
            />
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate} className="w-full lg:w-auto lg:justify-self-end">Tambah Rekening</Button>
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          stickyActionsColumn
          emptyMessage="Belum ada data rekening bank"
          emptyDescription="Tambahkan rekening untuk pembayaran invoice dan cicilan."
          renderRow={(item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{item.bankName}</p>
                <p className="text-xs text-slate-500">{item.branch}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-mono text-slate-700">{item.accountNumber}</p>
                {item.isPrimary && <Badge variant="info" size="sm" className="mt-1">Rekening Utama</Badge>}
              </td>
              <td className="px-4 py-3 text-slate-700">{item.accountHolder}</td>
              <td className="px-4 py-3 text-center">
                <Badge variant={STATUS_MAP[item.status].variant} size="sm">{STATUS_MAP[item.status].label}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="relative flex items-center justify-end">
                  <ActionMenu
                    menuWidthClass="w-[170px]"
                    items={[
                      {
                        id: 'edit',
                        label: 'Edit',
                        icon: <Pencil className="w-4 h-4" />,
                        onClick: () => openEdit(item)
                      },
                      ...(!item.isPrimary
                        ? [{
                            id: 'set-primary',
                            label: 'Set Utama',
                            icon: <Star className="w-4 h-4" />,
                            tone: 'success' as const,
                            onClick: () => setPrimary(item.id)
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

      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        <ModalBox className="max-w-2xl min-h-0">
          <ModalHeader title={editingItem ? 'Edit Rekening Bank' : 'Tambah Rekening Bank'} subtitle="Lengkapi data rekening perusahaan" onClose={() => setFormOpen(false)} icon={<Landmark className="w-5 h-5" />} />
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Nama Bank" value={formData.bankName} onChange={(e) => setFormData((p) => ({ ...p, bankName: e.target.value }))} />
              <Input label="Nomor Rekening" value={formData.accountNumber} onChange={(e) => setFormData((p) => ({ ...p, accountNumber: e.target.value }))} />
              <Input label="Nama Pemilik Rekening" value={formData.accountHolder} onChange={(e) => setFormData((p) => ({ ...p, accountHolder: e.target.value }))} />
              <Input label="Cabang Bank" value={formData.branch} onChange={(e) => setFormData((p) => ({ ...p, branch: e.target.value }))} />
              <Autocomplete
                label="Status"
                value={formData.status}
                onChange={(value) => setFormData((p) => ({ ...p, status: value as BankStatus }))}
                options={statusOptions}
              />
            </div>
            <Card className="mt-4 bg-slate-50 border-slate-200">
              <p className="text-sm text-slate-600 inline-flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Pastikan nomor rekening valid karena akan ditampilkan di invoice dan halaman pembayaran.
              </p>
            </Card>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={saveAccount}>Simpan Rekening</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>

      <Card>
        <p className="text-sm text-slate-600 inline-flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          Rekening utama otomatis digunakan pada invoice dan instruksi pembayaran cicilan.
        </p>
      </Card>
    </div>
  );
};

export default BankPage;
