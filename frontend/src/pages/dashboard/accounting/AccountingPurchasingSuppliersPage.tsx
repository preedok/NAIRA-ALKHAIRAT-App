import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Plus, Pencil, Trash2, Search } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { Input, Autocomplete, Checkbox, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ActionsMenu, AutoRefreshControl } from '../../../components/common';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { accountingApi } from '../../../services/api';

const DEFAULT_LIMIT = 20;

interface AccountingPurchasingSuppliersPageProps {
  embedded?: boolean;
  triggerCreate?: boolean;
  onClearCreateTrigger?: () => void;
}

const AccountingPurchasingSuppliersPage: React.FC<AccountingPurchasingSuppliersPageProps> = ({ embedded = false, triggerCreate, onClearCreateTrigger }) => {
  const [searchParams] = useSearchParams();
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [modalOpen, setModalOpen] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', supplier_type: 'vendor', currency: 'IDR', term_of_payment_days: 0, is_active: true });
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (activeOnly) params.is_active = 'true';
      const res = await accountingApi.listSuppliers(params);
      if (res.data.success) {
        setList(res.data.data || []);
        setTotal((res.data as { total?: number }).total ?? 0);
      } else setList([]);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, activeOnly]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    if (triggerCreate) {
      openCreate();
      onClearCreateTrigger?.();
    }
  }, [triggerCreate]);

  const openCreate = () => {
    setForm({ code: '', name: '', supplier_type: 'vendor', currency: 'IDR', term_of_payment_days: 0, is_active: true });
    setFormError('');
    setEditingId(null);
    setModalOpen('create');
  };

  const openEdit = (row: any) => {
    setForm({
      code: row.code ?? '',
      name: row.name ?? '',
      supplier_type: row.supplier_type ?? 'vendor',
      currency: row.currency ?? 'IDR',
      term_of_payment_days: row.term_of_payment_days ?? 0,
      is_active: row.is_active !== false
    });
    setFormError('');
    setEditingId(row.id);
    setModalOpen('edit');
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setFormError('Nama supplier wajib'); return; }
    setFormError('');
    setActionLoading(true);
    try {
      if (modalOpen === 'create') {
        await accountingApi.createSupplier({
          code: form.code.trim() || form.name.trim().slice(0, 20),
          name: form.name.trim(),
          supplier_type: form.supplier_type,
          currency: form.currency,
          term_of_payment_days: form.term_of_payment_days,
          is_active: form.is_active
        });
      } else if (editingId) {
        await accountingApi.updateSupplier(editingId, {
          name: form.name.trim(),
          supplier_type: form.supplier_type,
          currency: form.currency,
          term_of_payment_days: form.term_of_payment_days,
          is_active: form.is_active
        });
      }
      setModalOpen(null);
      fetchList();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin hapus supplier ini?')) return;
    setActionLoading(true);
    try {
      await accountingApi.deleteSupplier(id);
      fetchList();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Gagal menghapus');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Master Supplier"
          subtitle="Data supplier untuk modul pembelian"
          right={
            <div className="flex items-center gap-2">
              <AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />
              <Button variant="primary" size="sm" className="gap-1" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Tambah Supplier
              </Button>
            </div>
          }
        />
      )}
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Master Supplier</h2>
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />
            <Button variant="primary" size="sm" className="gap-1" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Tambah Supplier
            </Button>
          </div>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari kode / nama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Checkbox label="Hanya aktif" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="self-center" />
        </div>
        <Table
          columns={[
            { id: 'code', label: 'Kode', align: 'left' },
            { id: 'name', label: 'Nama', align: 'left' },
            { id: 'type', label: 'Tipe', align: 'left' },
            { id: 'currency', label: 'Mata Uang', align: 'left' },
            { id: 'term', label: 'Term (hari)', align: 'right' },
            { id: 'status', label: 'Status', align: 'left' },
            { id: 'actions', label: '', align: 'right' }
          ] as TableColumn[]}
          data={loading ? [] : list}
          emptyMessage={loading ? 'Memuat...' : 'Tidak ada supplier'}
          pagination={
            total > 0
              ? { total, page, limit, totalPages, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }
              : undefined
          }
          renderRow={(row) => {
            const menuItems: ActionsMenuItem[] = [
              { id: 'edit', label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(row) },
              { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(row.id), danger: true }
            ];
            return (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-sm">{row.code}</td>
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 text-sm">{row.supplier_type || 'vendor'}</td>
                <td className="px-4 py-3 text-sm">{row.currency || 'IDR'}</td>
                <td className="px-4 py-3 text-right text-sm">{row.term_of_payment_days ?? 0}</td>
                <td className="px-4 py-3">
                  <Badge variant={row.is_active !== false ? 'success' : 'default'}>{row.is_active !== false ? 'Aktif' : 'Nonaktif'}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionsMenu items={menuItems} />
                </td>
              </tr>
            );
          }}
        />
      </Card>

      {modalOpen && (
        <Modal open onClose={() => setModalOpen(null)}>
          <ModalBox>
            <ModalHeader title={modalOpen === 'create' ? 'Tambah Supplier' : 'Edit Supplier'} onClose={() => setModalOpen(null)} />
            <ModalBody>
              {formError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
              <div className="space-y-4">
                {modalOpen === 'create' && (
                  <Input label="Kode" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="Opsional, default dari nama" />
                )}
                <Input label="Nama *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama supplier" required />
                <div className="grid grid-cols-2 gap-4">
                  <Autocomplete
                    label="Tipe"
                    value={form.supplier_type}
                    onChange={(v) => setForm((f) => ({ ...f, supplier_type: v || 'vendor' }))}
                    options={[
                      { value: 'vendor', label: 'Vendor' },
                      { value: 'supplier', label: 'Supplier' }
                    ]}
                    placeholder="Pilih tipe"
                  />
                  <Autocomplete
                    label="Mata Uang"
                    value={form.currency}
                    onChange={(v) => setForm((f) => ({ ...f, currency: v || 'IDR' }))}
                    options={[
                      { value: 'IDR', label: 'IDR' },
                      { value: 'USD', label: 'USD' },
                      { value: 'SAR', label: 'SAR' }
                    ]}
                    placeholder="Pilih mata uang"
                  />
                </div>
                <Input
                  type="number"
                  label="Term of payment (hari)"
                  value={String(form.term_of_payment_days)}
                  onChange={(e) => setForm((f) => ({ ...f, term_of_payment_days: parseInt(e.target.value, 10) || 0 }))}
                />
                {modalOpen === 'edit' && (
                  <Checkbox label="Aktif" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setModalOpen(null)}>Batal</Button>
              <Button variant="primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default AccountingPurchasingSuppliersPage;
