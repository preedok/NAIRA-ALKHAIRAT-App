import React, { useState, useEffect, useCallback } from 'react';
import { Landmark, Plus, Pencil, Trash2, Power, PowerOff, RefreshCw, Search, Filter } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { Input, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ActionsMenu, ContentLoading, CONTENT_LOADING_MESSAGE } from '../../../components/common';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { accountingApi, type BankAccountItem } from '../../../services/api';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' }
];

const CURRENCY_OPTIONS = [
  { value: 'IDR', label: 'IDR' },
  { value: 'SAR', label: 'SAR' },
  { value: 'USD', label: 'USD' }
];

const CURRENCY_FILTER_OPTIONS = [{ value: '', label: 'Semua mata uang' }, ...CURRENCY_OPTIONS];

const DEFAULT_PAGE_SIZE = 25;

const AccountingChartOfAccountsPage: React.FC = () => {
  const [banks, setBanks] = useState<{ id: string; code: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<BankAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterBankName, setFilterBankName] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [search, setSearch] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const [tableLimit, setTableLimit] = useState(DEFAULT_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState<'create' | 'edit' | null>(null);
  const [editingAccount, setEditingAccount] = useState<BankAccountItem | null>(null);
  const [form, setForm] = useState({
    bank_name: '',
    account_number: '',
    name: '',
    currency: 'IDR' as 'IDR' | 'SAR' | 'USD'
  });
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params: { is_active?: string } = {};
      if (filterStatus === 'active') params.is_active = 'true';
      else if (filterStatus === 'inactive') params.is_active = 'false';
      const res = await accountingApi.getBankAccounts(params);
      if (res.data.success) setAccounts(res.data.data || []);
      else setAccounts([]);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const searchLower = search.trim().toLowerCase();
  let filteredAccounts = accounts;
  if (searchLower) {
    filteredAccounts = filteredAccounts.filter(
      (a) =>
        (a.bank_name || '').toLowerCase().includes(searchLower) ||
        (a.account_number || '').toLowerCase().includes(searchLower) ||
        (a.name || '').toLowerCase().includes(searchLower)
    );
  }
  if (filterBankName) {
    filteredAccounts = filteredAccounts.filter((a) => (a.bank_name || '').trim() === filterBankName.trim());
  }
  if (filterCurrency) {
    filteredAccounts = filteredAccounts.filter((a) => (a.currency || 'IDR') === filterCurrency);
  }

  const totalFiltered = filteredAccounts.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / tableLimit));
  const paginatedRows = filteredAccounts.slice((tablePage - 1) * tableLimit, tablePage * tableLimit);

  const hasActiveFilters = filterStatus !== 'all' || search.trim() !== '' || filterBankName !== '' || filterCurrency !== '';
  const resetFilters = () => {
    setFilterStatus('all');
    setFilterBankName('');
    setFilterCurrency('');
    setSearch('');
    setTablePage(1);
  };

  const getErrorMessage = (e: any, fallback: string) => {
    const data = e?.response?.data;
    return data?.message || fallback;
  };

  const openCreate = () => {
    setEditingAccount(null);
    setForm({ bank_name: '', account_number: '', name: '', currency: 'IDR' });
    setFormError('');
    setModalOpen('create');
  };

  const openEdit = (account: BankAccountItem) => {
    setEditingAccount(account);
    const curr = account.currency === 'SAR' || account.currency === 'USD' ? account.currency : 'IDR';
    setForm({
      bank_name: account.bank_name || '',
      account_number: account.account_number || '',
      name: account.name || '',
      currency: curr
    });
    setFormError('');
    setModalOpen('edit');
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.bank_name.trim() || !form.account_number.trim() || !form.name.trim()) {
      setFormError('Nama bank, nomor rekening, dan nama rekening wajib diisi');
      return;
    }
    setActionLoading('create');
    try {
      await accountingApi.createBankAccount({
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        name: form.name.trim()
      });
      setModalOpen(null);
      await fetchAccounts();
    } catch (err: any) {
      setFormError(getErrorMessage(err, 'Gagal menambah rekening'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setFormError('');
    if (!form.bank_name.trim() || !form.account_number.trim() || !form.name.trim()) {
      setFormError('Nama bank, nomor rekening, dan nama rekening wajib diisi');
      return;
    }
    setActionLoading('edit');
    try {
      await accountingApi.updateBankAccount(editingAccount.id, {
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        name: form.name.trim(),
        currency: form.currency
      });
      setModalOpen(null);
      setEditingAccount(null);
      await fetchAccounts();
    } catch (err: any) {
      setFormError(getErrorMessage(err, 'Gagal mengupdate rekening'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (account: BankAccountItem) => {
    setActionLoading(account.id);
    try {
      await accountingApi.updateBankAccount(account.id, { is_active: !account.is_active });
      await fetchAccounts();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Gagal mengubah status'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (account: BankAccountItem) => {
    if (!window.confirm(`Hapus rekening "${account.bank_name} - ${account.account_number}"?`)) return;
    setActionLoading(account.id);
    try {
      await accountingApi.deleteBankAccount(account.id);
      await fetchAccounts();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Gagal menghapus rekening'));
    } finally {
      setActionLoading(null);
    }
  };

  const columns: TableColumn[] = [
    { id: 'no', label: 'No', align: 'left' },
    { id: 'bank_name', label: 'Nama Bank', align: 'left' },
    { id: 'account_number', label: 'No. Rekening', align: 'left' },
    { id: 'name', label: 'Nama Rekening', align: 'left' },
    { id: 'currency', label: 'Mata Uang', align: 'left' },
    { id: 'status', label: 'Status', align: 'left' },
    { id: 'actions', label: 'Aksi', align: 'left' }
  ];

  const bankOptions = banks.map((b) => ({ value: b.name, label: b.name }));

  const buildActionItems = (row: BankAccountItem): ActionsMenuItem[] => [
    { id: 'edit', label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(row) },
    {
      id: 'toggle',
      label: row.is_active ? 'Nonaktifkan' : 'Aktifkan',
      icon: row.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />,
      onClick: () => handleToggleActive(row),
      disabled: !!actionLoading
    },
    { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(row), danger: true, disabled: !!actionLoading }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Rekening Bank"
        subtitle="Pendataan rekening untuk pembayaran invoice melalui transfer atau tunai"
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchAccounts} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? CONTENT_LOADING_MESSAGE : 'Refresh'}
            </Button>
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Tambah Rekening
            </Button>
          </div>
        }
      />

      <Card className="min-w-0" padding="sm">
        <CardSectionHeader
          icon={<Filter className="w-5 h-5" />}
          title="Filter"
          subtitle={hasActiveFilters ? 'Filter aktif' : 'Status, nama bank, mata uang & cari'}
          right={hasActiveFilters ? <Button variant="outline" size="sm" onClick={resetFilters}>Reset</Button> : null}
          className="mb-2"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-2 pb-2 border-b border-slate-200 items-end">
          <Autocomplete label="Status" value={filterStatus} onChange={(v) => { setFilterStatus((v as 'all' | 'active' | 'inactive') || 'all'); setTablePage(1); }} options={STATUS_OPTIONS} />
          <Autocomplete label="Nama Bank" value={filterBankName} onChange={(v) => { setFilterBankName(v || ''); setTablePage(1); }} options={bankOptions} emptyLabel="Semua bank" />
          <Autocomplete label="Mata Uang" value={filterCurrency} onChange={(v) => { setFilterCurrency(v || ''); setTablePage(1); }} options={CURRENCY_FILTER_OPTIONS} emptyLabel="Semua mata uang" />
          <div className="col-span-2">
            <Input label="Cari" type="text" value={search} onChange={(e) => { setSearch(e.target.value); setTablePage(1); }} placeholder="Nama bank, no. rekening, atau nama rekening..." icon={<Search className="w-4 h-4" />} />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[120px]">
          {loading ? (
            <ContentLoading />
          ) : (
          <Table<BankAccountItem>
            columns={columns}
            data={paginatedRows}
            emptyMessage={accounts.length === 0 ? 'Belum ada data rekening. Klik Tambah Rekening atau jalankan seeder accounting-bank-accounts.' : 'Tidak ada rekening yang cocok dengan filter.'}
            stickyActionsColumn
            pagination={
              totalFiltered > 0
                ? {
                    total: totalFiltered,
                    page: tablePage,
                    limit: tableLimit,
                    totalPages,
                    onPageChange: setTablePage,
                    onLimitChange: (l) => {
                      setTableLimit(l);
                      setTablePage(1);
                    }
                  }
                : undefined
            }
            renderRow={(row, idx) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="py-3 px-4">{(tablePage - 1) * tableLimit + idx + 1}</td>
                <td className="py-3 px-4 font-medium">{row.bank_name || '–'}</td>
                <td className="py-3 px-4 font-mono text-sm">{row.account_number || '–'}</td>
                <td className="py-3 px-4">{row.name || '–'}</td>
                <td className="py-3 px-4">{row.currency || 'IDR'}</td>
                <td className="py-3 px-4">
                  <Badge variant={row.is_active ? 'success' : 'default'}>
                    {row.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <ActionsMenu align="right" items={buildActionItems(row)} />
                </td>
              </tr>
            )}
          />
          )}
        </div>
      </Card>

      {modalOpen === 'create' && (
        <Modal open onClose={() => setModalOpen(null)}>
          <ModalBox>
            <ModalHeader title="Tambah Rekening Bank" subtitle="Data rekening untuk pembayaran invoice (transfer/tunai)" icon={<Landmark className="w-5 h-5" />} onClose={() => setModalOpen(null)} />
            <ModalBody className="space-y-4">
              <form id="bank-create-form" onSubmit={handleSubmitCreate} className="space-y-4">
                {formError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
                <Autocomplete label="Nama Bank *" value={form.bank_name} onChange={(v) => setForm((f) => ({ ...f, bank_name: v || '' }))} options={bankOptions} placeholder="Pilih bank" emptyLabel="Pilih bank" />
                <Input label="No. Rekening *" type="text" value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} placeholder="Nomor rekening" />
                <Input label="Nama Rekening *" type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: PT. BINTANG GLOBAL GRUP" />
                <Autocomplete label="Mata Uang Pembayaran" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: (v as 'IDR' | 'SAR' | 'USD') || 'IDR' }))} options={CURRENCY_OPTIONS} />
              </form>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(null)}>Batal</Button>
              <Button type="submit" form="bank-create-form" variant="primary" disabled={!!actionLoading}>{actionLoading === 'create' ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {modalOpen === 'edit' && editingAccount && (
        <Modal open onClose={() => { setModalOpen(null); setEditingAccount(null); }}>
          <ModalBox>
            <ModalHeader title="Edit Rekening Bank" subtitle="Ubah data rekening" icon={<Pencil className="w-5 h-5" />} onClose={() => { setModalOpen(null); setEditingAccount(null); }} />
            <ModalBody className="space-y-4">
              <form id="bank-edit-form" onSubmit={handleSubmitEdit} className="space-y-4">
                {formError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
                <Autocomplete label="Nama Bank *" value={form.bank_name} onChange={(v) => setForm((f) => ({ ...f, bank_name: v || '' }))} options={bankOptions} placeholder="Pilih bank" emptyLabel="Pilih bank" />
                <Input label="No. Rekening *" type="text" value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} placeholder="Nomor rekening" />
                <Input label="Nama Rekening *" type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: PT. BINTANG GLOBAL GRUP" />
                <Autocomplete label="Mata Uang Pembayaran" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: (v as 'IDR' | 'SAR' | 'USD') || 'IDR' }))} options={CURRENCY_OPTIONS} />
              </form>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="outline" onClick={() => { setModalOpen(null); setEditingAccount(null); }}>Batal</Button>
              <Button type="submit" form="bank-edit-form" variant="primary" disabled={!!actionLoading}>{actionLoading === 'edit' ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default AccountingChartOfAccountsPage;
