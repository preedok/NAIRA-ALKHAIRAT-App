import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Filter,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  X,
  RefreshCw
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import PageFilter from '../../../components/common/PageFilter';
import { FilterIconButton, Input, Autocomplete, Checkbox, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox } from '../../../components/common';
import { accountingApi, type ChartOfAccountItem } from '../../../services/api';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Aset',
  liability: 'Kewajiban',
  equity: 'Ekuitas',
  revenue: 'Pendapatan',
  expense: 'Beban'
};

function buildTree(flat: ChartOfAccountItem[], parentId: string | null = null): ChartOfAccountItem[] {
  return flat
    .filter((a) => (a.parent_id || null) === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.code || '').localeCompare(b.code || ''))
    .map((node) => ({
      ...node,
      Children: buildTree(flat, node.id)
    }));
}

const AccountingChartOfAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<ChartOfAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterHeader, setFilterHeader] = useState<'all' | 'yes' | 'no'>('all');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [modalOpen, setModalOpen] = useState<'create' | 'edit' | null>(null);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccountItem | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    account_type: 'asset',
    parent_id: '' as string,
    is_header: false,
    currency: 'IDR',
    sort_order: 0,
    is_active: true
  });
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (filterType) params.account_type = filterType;
      if (filterActive === 'active') params.active_only = 'true';
      else if (filterActive === 'inactive') params.active_only = 'false';
      if (filterLevel) params.level = filterLevel;
      if (filterHeader === 'yes') params.is_header = 'true';
      else if (filterHeader === 'no') params.is_header = 'false';
      if (search.trim()) params.search = search.trim();
      const res = await accountingApi.getChartOfAccounts(params);
      if (res.data.success) setAccounts(res.data.data || []);
      else setAccounts([]);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterActive, filterLevel, filterHeader, search]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const tree = buildTree(accounts);
  const hasChildren = (id: string) => accounts.some((a) => a.parent_id === id);
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getErrorMessage = (e: any, fallback: string) => {
    const data = e?.response?.data;
    const msg = data?.message || fallback;
    const path = data?.path;
    if (path) return `${msg}\n\nRequest: ${path}`;
    return msg;
  };

  const openCreate = (parentId?: string) => {
    setEditingAccount(null);
    setForm({
      code: '',
      name: '',
      account_type: 'asset',
      parent_id: parentId || '',
      is_header: false,
      currency: 'IDR',
      sort_order: 0,
      is_active: true
    });
    setFormError('');
    setModalOpen('create');
  };

  const openEdit = (account: ChartOfAccountItem) => {
    setEditingAccount(account);
    setForm({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      parent_id: account.parent_id || '',
      is_header: !!account.is_header,
      currency: account.currency || 'IDR',
      sort_order: account.sort_order ?? 0,
      is_active: account.is_active ?? true
    });
    setFormError('');
    setModalOpen('edit');
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Kode dan nama wajib diisi');
      return;
    }
    setActionLoading('create');
    try {
      await accountingApi.createChartOfAccount({
        code: form.code.trim(),
        name: form.name.trim(),
        account_type: form.account_type,
        parent_id: form.parent_id || undefined,
        is_header: form.is_header,
        currency: form.currency,
        sort_order: form.sort_order
      });
      setModalOpen(null);
      await fetchAccounts();
    } catch (err: any) {
      setFormError(getErrorMessage(err, 'Gagal membuat akun'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Nama wajib diisi');
      return;
    }
    setActionLoading('edit');
    try {
      await accountingApi.updateChartOfAccount(editingAccount.id, {
        name: form.name.trim(),
        account_type: form.account_type,
        is_header: form.is_header,
        currency: form.currency,
        sort_order: form.sort_order,
        is_active: form.is_active
      });
      setModalOpen(null);
      setEditingAccount(null);
      await fetchAccounts();
    } catch (err: any) {
      setFormError(getErrorMessage(err, 'Gagal mengupdate akun'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (account: ChartOfAccountItem) => {
    setActionLoading(account.id);
    try {
      await accountingApi.updateChartOfAccount(account.id, { is_active: !account.is_active });
      await fetchAccounts();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Gagal mengubah status'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (account: ChartOfAccountItem) => {
    if (!window.confirm(`Hapus akun "${account.code} - ${account.name}"? Anak akun akan jadi level atas.`)) return;
    setActionLoading(account.id);
    try {
      await accountingApi.deleteChartOfAccount(account.id);
      await fetchAccounts();
    } catch (err: any) {
      alert(getErrorMessage(err, 'Gagal menghapus akun'));
    } finally {
      setActionLoading(null);
    }
  };

  const renderRow = (account: ChartOfAccountItem, depth: number) => {
    const children = account.Children || [];
    const hasKids = children.length > 0;
    const expanded = expandedIds.has(account.id);
    const indent = depth * 20;

    return (
      <React.Fragment key={account.id}>
        <tr className={`border-b border-slate-100 hover:bg-slate-50/50 ${account.is_header ? 'bg-slate-50 font-semibold' : ''}`}>
          <td className="py-2 pr-4 align-middle">
            <div className="flex items-center gap-1" style={{ paddingLeft: indent }}>
              {hasKids ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(account.id)}
                  className="p-0.5 rounded hover:bg-slate-200"
                >
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              ) : (
                <span className="w-5 inline-block" />
              )}
              <span className="font-mono text-sm">{account.code}</span>
            </div>
          </td>
          <td className="py-2 pr-4">{account.name}</td>
          <td className="py-2 pr-4">
            <Badge variant="info">{ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}</Badge>
          </td>
          <td className="py-2 pr-4">{account.level}</td>
          <td className="py-2 pr-4">{account.is_header ? 'Ya' : 'Tidak'}</td>
          <td className="py-2 pr-4">{account.currency || 'IDR'}</td>
          <td className="py-2 pr-4">
            <Badge variant={account.is_active ? 'success' : 'default'}>{account.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
          </td>
          <td className="py-2 pr-4">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => openEdit(account)} className="p-1.5 rounded hover:bg-slate-200" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleToggleActive(account)}
                disabled={!!actionLoading}
                className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-50"
                title={account.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              >
                {account.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(account)}
                disabled={!!actionLoading}
                className="p-1.5 rounded hover:bg-slate-200 text-red-600 hover:text-red-700 disabled:opacity-50"
                title="Hapus"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => openCreate(account.id)} className="p-1.5 rounded hover:bg-slate-200 border border-slate-200" title="Tambah anak">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
        {hasKids && expanded && children.map((child) => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const hasActiveFilters = filterType !== '' || filterActive !== 'all' || filterLevel !== '' || filterHeader !== 'all' || search.trim() !== '';
  const resetFilters = () => { setFilterType(''); setFilterActive('all'); setFilterLevel(''); setFilterHeader('all'); setSearch(''); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Daftar akun perkiraan multi-level — kelola kode, nama, tipe, dan hierarki"
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchAccounts} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Memuat...' : 'Refresh'}
            </Button>
            <FilterIconButton open={showFilters} onToggle={() => setShowFilters((v: boolean) => !v)} hasActiveFilters={hasActiveFilters} />
            <Button variant="primary" size="sm" onClick={() => openCreate()}>
              <Plus className="w-4 h-4 mr-2" />
              Tambah Akun
            </Button>
          </div>
        }
      />

      <PageFilter
        open={showFilters}
        onToggle={() => setShowFilters((v: boolean) => !v)}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        onApply={() => setShowFilters(false)}
        hideToggleRow
      >
        <div className="flex flex-wrap gap-4 items-end">
          <Autocomplete label="Tipe Akun" value={filterType} onChange={setFilterType} options={Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} emptyLabel="Semua" fullWidth={false} className="min-w-[140px]" />
          <Autocomplete label="Status" value={filterActive} onChange={(v) => setFilterActive(v as 'all' | 'active' | 'inactive')} options={[{ value: 'all', label: 'Semua' }, { value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }]} fullWidth={false} className="min-w-[120px]" />
          <Autocomplete label="Level" value={filterLevel} onChange={setFilterLevel} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} emptyLabel="Semua" fullWidth={false} className="min-w-[100px]" />
          <Autocomplete label="Header" value={filterHeader} onChange={(v) => setFilterHeader(v as 'all' | 'yes' | 'no')} options={[{ value: 'all', label: 'Semua' }, { value: 'yes', label: 'Ya' }, { value: 'no', label: 'Tidak' }]} fullWidth={false} className="min-w-[100px]" />
          <div className="flex-1 min-w-[200px]">
            <Input label="Cari (kode / nama)" type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kode atau nama akun..." icon={<Search className="w-4 h-4" />} />
          </div>
        </div>
      </PageFilter>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600 bg-slate-50/80">
                <th className="pb-3 pr-4 font-semibold">Kode</th>
                <th className="pb-3 pr-4 font-semibold">Nama</th>
                <th className="pb-3 pr-4 font-semibold">Tipe</th>
                <th className="pb-3 pr-4 font-semibold">Level</th>
                <th className="pb-3 pr-4 font-semibold">Header</th>
                <th className="pb-3 pr-4 font-semibold">Mata Uang</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-500">Memuat...</td></tr>
              ) : tree.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-500">Belum ada data. Klik "Tambah Akun" atau jalankan seeder accounting-defaults.</td></tr>
              ) : (
                tree.map((node) => renderRow(node, 0))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen === 'create' && (
        <Modal open onClose={() => setModalOpen(null)}>
          <ModalBox>
            <ModalHeader title="Tambah Akun" subtitle="Kode dan nama akun untuk chart of accounts" icon={<Plus className="w-5 h-5" />} onClose={() => setModalOpen(null)} />
            <ModalBody className="space-y-4">
              <form id="chart-create-form" onSubmit={handleSubmitCreate} className="space-y-4">
                {formError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
                <Input label="Kode *" type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="1-1-01" />
                <Input label="Nama *" type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Kas Kecil" />
                <Autocomplete label="Tipe Akun *" value={form.account_type} onChange={(v) => setForm((f) => ({ ...f, account_type: v }))} options={Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                <div className="grid grid-cols-2 gap-4">
                  <Autocomplete label="Mata Uang" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v }))} options={[{ value: 'IDR', label: 'IDR' }, { value: 'USD', label: 'USD' }, { value: 'SAR', label: 'SAR' }]} />
                  <Input label="Urutan" type="number" value={String(form.sort_order)} onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))} min={0} />
                </div>
                <Checkbox label="Akun header (tidak untuk posting)" checked={form.is_header} onChange={(e) => setForm((f) => ({ ...f, is_header: e.target.checked }))} />
              </form>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(null)}>Batal</Button>
              <Button type="submit" form="chart-create-form" variant="primary" disabled={!!actionLoading}>{actionLoading === 'create' ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {modalOpen === 'edit' && editingAccount && (
        <Modal open onClose={() => { setModalOpen(null); setEditingAccount(null); }}>
          <ModalBox>
            <ModalHeader title="Edit Akun" subtitle="Ubah nama akun (kode tidak dapat diubah)" icon={<Pencil className="w-5 h-5" />} onClose={() => { setModalOpen(null); setEditingAccount(null); }} />
            <ModalBody className="space-y-4">
              <form id="chart-edit-form" onSubmit={handleSubmitEdit} className="space-y-4">
                {formError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
                <Input label="Kode" type="text" value={form.code} readOnly />
                <Input label="Nama *" type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                <Autocomplete label="Tipe Akun" value={form.account_type} onChange={(v) => setForm((f) => ({ ...f, account_type: v }))} options={Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                <div className="grid grid-cols-2 gap-4">
                  <Autocomplete label="Mata Uang" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v }))} options={[{ value: 'IDR', label: 'IDR' }, { value: 'USD', label: 'USD' }, { value: 'SAR', label: 'SAR' }]} />
                  <Input label="Urutan" type="number" value={String(form.sort_order)} onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))} min={0} />
                </div>
                <Checkbox label="Akun header" checked={form.is_header} onChange={(e) => setForm((f) => ({ ...f, is_header: e.target.checked }))} />
                <Checkbox label="Aktif" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              </form>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="outline" onClick={() => { setModalOpen(null); setEditingAccount(null); }}>Batal</Button>
              <Button type="submit" form="chart-edit-form" variant="primary" disabled={!!actionLoading}>{actionLoading === 'edit' ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default AccountingChartOfAccountsPage;
