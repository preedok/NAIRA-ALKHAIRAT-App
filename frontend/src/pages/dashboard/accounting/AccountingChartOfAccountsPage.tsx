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
  X
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Chart of Accounts</h1>
          <p className="text-slate-600 mt-1">Daftar akun perkiraan multi-level — kelola kode, nama, tipe, dan hierarki</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Akun
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchAccounts} disabled={loading}>
            {loading ? 'Memuat...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="bg-slate-50/80">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter
          </h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipe Akun</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Semua</option>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[120px] focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Level</label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[100px] focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Semua</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Header</label>
              <select
                value={filterHeader}
                onChange={(e) => setFilterHeader(e.target.value as 'all' | 'yes' | 'no')}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[100px] focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua</option>
                <option value="yes">Ya</option>
                <option value="no">Tidak</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Cari (kode / nama)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Kode atau nama akun..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-900">Tambah Akun</h2>
              <button type="button" onClick={() => setModalOpen(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              {formError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kode *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="1-1-01"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Kas Kecil"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Akun *</label>
                <select
                  value={form.account_type}
                  onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mata Uang</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="IDR">IDR</option>
                    <option value="USD">USD</option>
                    <option value="SAR">SAR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Urutan</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                    min={0}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_header} onChange={(e) => setForm((f) => ({ ...f, is_header: e.target.checked }))} className="rounded" />
                Akun header (tidak untuk posting)
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(null)}>Batal</Button>
                <Button type="submit" variant="primary" disabled={!!actionLoading}>{actionLoading === 'create' ? 'Menyimpan...' : 'Simpan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalOpen === 'edit' && editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-900">Edit Akun</h2>
              <button type="button" onClick={() => { setModalOpen(null); setEditingAccount(null); }} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitEdit} className="space-y-4">
              {formError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kode</label>
                <input type="text" value={form.code} readOnly className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Akun</label>
                <select
                  value={form.account_type}
                  onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mata Uang</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="IDR">IDR</option>
                    <option value="USD">USD</option>
                    <option value="SAR">SAR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Urutan</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                    min={0}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_header} onChange={(e) => setForm((f) => ({ ...f, is_header: e.target.checked }))} className="rounded" />
                Akun header
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                Aktif
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => { setModalOpen(null); setEditingAccount(null); }}>Batal</Button>
                <Button type="submit" variant="primary" disabled={!!actionLoading}>{actionLoading === 'edit' ? 'Menyimpan...' : 'Simpan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingChartOfAccountsPage;
