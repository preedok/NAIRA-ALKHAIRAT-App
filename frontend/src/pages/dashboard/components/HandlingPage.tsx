import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Plus, Pencil, Trash2, HandHelping, ShoppingCart } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl } from '../../../components/common';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { Input, PriceInput, Textarea, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ContentLoading } from '../../../components/common';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, businessRulesApi } from '../../../services/api';
import { fillFromSource, getEditPriceDisplay } from '../../../utils/currencyConversion';
import { getPriceTripleForTable, PRICE_COLUMN_LABEL, parsePriceInput } from '../../../utils';

interface HandlingProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  price_general_idr?: number | null;
  price_general_sar?: number | null;
  price_general_usd?: number | null;
  price_general?: number | null;
  currency?: string;
}

const PAGE_SIZE = 25;

const HandlingPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { addItem: addDraftItem } = useOrderDraft();
  const canConfig = user?.role === 'super_admin' || user?.role === 'admin_pusat' || user?.role === 'role_accounting';
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const canShowProductActions = ['owner', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'role_accounting', 'super_admin'].includes(user?.role || '');

  const [list, setList] = useState<HandlingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({ SAR_TO_IDR: 4200, USD_TO_IDR: 15500 });

  type PriceCurrency = 'IDR' | 'SAR' | 'USD';

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<{ name: string; description: string; price_currency: PriceCurrency; price_value: number }>({ name: '', description: '', price_currency: 'IDR', price_value: 0 });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [editing, setEditing] = useState<HandlingProduct | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string; price_currency: PriceCurrency; price_value: number }>({ name: '', description: '', price_currency: 'IDR', price_value: 0 });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleting, setDeleting] = useState(false);

  const [filterIncludeInactive, setFilterIncludeInactive] = useState<'false' | 'true'>('false');
  const [filterSortBy, setFilterSortBy] = useState<string>('code');
  const [filterSortOrder, setFilterSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchName, setSearchName] = useState('');
  const [debouncedSearchName, setDebouncedSearchName] = useState('');
  const lastFilterKeyRef = useRef<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchName(searchName), 350);
    return () => clearTimeout(t);
  }, [searchName]);

  const fetchList = useCallback(() => {
    const filterKey = `${debouncedSearchName}|${filterIncludeInactive}`;
    let pageToUse = page;
    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      setPage(1);
      pageToUse = 1;
    }
    setLoading(true);
    businessRulesApi.get().then((res) => {
      const data = (res.data as { data?: { currency_rates?: unknown } })?.data;
      let cr = data?.currency_rates;
      if (typeof cr === 'string') {
        try { cr = JSON.parse(cr) as { SAR_TO_IDR?: number; USD_TO_IDR?: number }; } catch { cr = null; }
      }
      const rates = cr as { SAR_TO_IDR?: number; USD_TO_IDR?: number } | null;
      if (rates && typeof rates === 'object') setCurrencyRates({ SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 });
    }).catch(() => {});

    productsApi.list({
        type: 'handling',
        with_prices: 'true',
        include_inactive: filterIncludeInactive,
        sort_by: filterSortBy,
        sort_order: filterSortOrder,
        ...(debouncedSearchName.trim() ? { name: debouncedSearchName.trim() } : {}),
        limit,
        page: pageToUse
      })
      .then((res) => {
        const body = res.data as { data?: HandlingProduct[]; pagination?: { total: number; page: number; limit: number; totalPages: number } };
        setList(Array.isArray(body.data) ? body.data : []);
        const p = body.pagination;
        if (p) {
          setTotal(p.total);
          setPage(p.page);
          setLimit(p.limit);
          setTotalPages(p.totalPages || 1);
        }
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [page, limit, filterIncludeInactive, filterSortBy, filterSortOrder, debouncedSearchName]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const nextCode = (): string => {
    const nums = list.map((p) => {
      const m = p.code.match(/^HDL-(\d+)$/i);
      return m ? parseInt(m[1], 10) : 0;
    });
    const max = nums.length ? Math.max(...nums) : 0;
    return `HDL-${String(max + 1).padStart(2, '0')}`;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.name.trim()) {
      setAddError('Nama wajib diisi');
      return;
    }
    const priceNum = addForm.price_value;
    setAddSaving(true);
    try {
      const code = nextCode();
      const createRes = await productsApi.create({
        type: 'handling',
        code,
        name: addForm.name.trim(),
        description: addForm.description.trim() || undefined
      });
      const productId = (createRes.data as { data?: { id: string } })?.data?.id;
      if (!productId) throw new Error('Product id tidak ditemukan');
      if (priceNum > 0) {
        const triple = fillFromSource(addForm.price_currency, priceNum, currencyRates);
        await productsApi.createPrice({
          product_id: productId,
          branch_id: null,
          owner_id: null,
          amount_idr: triple.idr,
          amount_sar: triple.sar,
          amount_usd: triple.usd,
          reference_currency: addForm.price_currency
        });
      }
      showToast('Produk handling berhasil ditambah', 'success');
      setShowAddModal(false);
      setAddForm({ name: '', description: '', price_currency: 'IDR', price_value: 0 });
      fetchList();
    } catch (err: unknown) {
      const raw = err && typeof err === 'object' && 'response' in err ? (err.response as { data?: { message?: string } })?.data?.message : undefined;
      const msg = typeof raw === 'string' ? raw : 'Gagal menambah produk';
      setAddError(msg);
      showToast(msg, 'error');
    } finally {
      setAddSaving(false);
    }
  };

  const openEdit = (p: HandlingProduct) => {
    setEditing(p);
    const { currency, value } = getEditPriceDisplay(p, currencyRates);
    setEditForm({
      name: p.name,
      description: p.description || '',
      price_currency: currency,
      price_value: value > 0 ? value : 0
    });
    setEditError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditError('');
    if (!editForm.name.trim()) {
      setEditError('Nama wajib diisi');
      return;
    }
    setEditSaving(true);
    try {
      await productsApi.update(editing.id, { name: editForm.name.trim(), description: editForm.description.trim() || null });
      const priceNum = editForm.price_value;
      const pricesRes = await productsApi.listPrices({ product_id: editing.id });
      const prices = (pricesRes.data as { data?: Array<{ id: string; branch_id: string | null; owner_id: string | null; currency: string }> })?.data ?? [];
      const generalPrices = prices.filter((p: { branch_id: string | null; owner_id: string | null }) => !p.branch_id && !p.owner_id);
      for (const gp of generalPrices) {
        await productsApi.deletePrice(gp.id);
      }
      if (priceNum > 0) {
        const triple = fillFromSource(editForm.price_currency, priceNum, currencyRates);
        await productsApi.createPrice({
          product_id: editing.id,
          branch_id: null,
          owner_id: null,
          amount_idr: triple.idr,
          amount_sar: triple.sar,
          amount_usd: triple.usd,
          reference_currency: editForm.price_currency
        });
      }
      showToast('Produk handling berhasil diubah', 'success');
      setEditing(null);
      fetchList();
    } catch (err: unknown) {
      const raw = err && typeof err === 'object' && 'response' in err ? (err.response as { data?: { message?: string } })?.data?.message : undefined;
      const msg = typeof raw === 'string' ? raw : 'Gagal menyimpan';
      setEditError(msg);
      showToast(msg, 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (row: HandlingProduct) => {
    setDeleting(true);
    try {
      await productsApi.delete(row.id);
      showToast('Produk handling berhasil dihapus', 'success');
      fetchList();
    } catch {
      showToast('Gagal menghapus produk', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn[] = [
    { id: 'code', label: 'Kode', align: 'left' },
    { id: 'name', label: 'Nama', align: 'left' },
    { id: 'description', label: 'Deskripsi', align: 'left' },
    { id: 'currency', label: 'Mata Uang', align: 'center' },
    { id: 'price', label: 'Harga (IDR · SAR · USD)', align: 'right' },
    { id: 'status', label: 'Status', align: 'center' },
    ...(canShowProductActions ? [{ id: 'actions', label: 'Aksi', align: 'center' as const }] : []),
    ...(canAddToOrder ? [{ id: 'order_action', label: 'Aksi order', align: 'center' as const }] : [])
  ].filter(Boolean) as TableColumn[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produk Handling"
        subtitle="Daftar produk jasa handling. Set harga default per produk."
        right={<AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />}
      />

      <Card>
        <CardSectionHeader
          icon={<HandHelping className="w-6 h-6" />}
          title="Daftar Handling"
          subtitle={`${total} produk handling · Set harga default per produk`}
          right={canConfig ? (
            <Button variant="primary" size="sm" className="gap-1.5" onClick={() => { setShowAddModal(true); setAddError(''); setAddForm({ name: '', description: '', price_currency: 'IDR', price_value: 0 }); }}>
              <Plus className="w-4 h-4" /> Tambah Produk Handling
            </Button>
          ) : undefined}
        />
        <div className="pb-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)] gap-4 items-end">
          <Input label="Cari nama" type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Nama produk handling..." fullWidth />
          <Autocomplete
            label="Tampilkan"
            value={filterIncludeInactive}
            onChange={(v) => setFilterIncludeInactive(v as 'false' | 'true')}
            options={[
              { value: 'false', label: 'Aktif saja' },
              { value: 'true', label: 'Semua (termasuk nonaktif)' }
            ]}
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[120px]">
          {loading ? (
            <ContentLoading />
          ) : (
          <Table
            columns={columns}
            data={list}
            renderRow={(row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 last:border-b-0">
                <td className="py-3 px-4 font-mono text-slate-600">{row.code}</td>
                <td className="py-3 px-4 font-medium text-slate-900">{row.name}</td>
                <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">{row.description || '–'}</td>
                <td className="py-3 px-4 text-center text-sm text-slate-700">{(row as any).meta?.currency || row.currency || 'IDR'}</td>
                <td className="py-3 px-4 text-right text-slate-800 align-top">
                  {(() => {
                    const t = getPriceTripleForTable(row.price_general_idr, row.price_general_sar, row.price_general_usd);
                    if (!t.hasPrice) return '–';
                    return (
                      <>
                        <div className="tabular-nums">{t.idrText}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="text-slate-400">SAR:</span> {t.sarText}
                          <span className="text-slate-400 ml-1">USD:</span> {t.usdText}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">per orang</div>
                      </>
                    );
                  })()}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {row.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                {canShowProductActions && (
                  <td className="py-3 px-4">
                    {canConfig && (
                      <ActionsMenu
                        items={[
                          { id: 'edit', label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(row) },
                          { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => { void handleDelete(row); }, danger: true }
                        ]}
                      />
                    )}
                  </td>
                )}
                {canAddToOrder && (
                  <td className="py-3 px-4 text-center">
                    {row.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          const sar = currencyRates.SAR_TO_IDR ?? 4200;
                          const usd = currencyRates.USD_TO_IDR ?? 15500;
                          const cur = ((row as any).meta?.currency || row.currency || 'IDR').toUpperCase();
                          let unitPriceIdr = Number(row.price_general_idr) || 0;
                          if (unitPriceIdr <= 0 && cur === 'SAR' && (row as any).price_general_sar) unitPriceIdr = Number((row as any).price_general_sar) * sar;
                          if (unitPriceIdr <= 0 && cur === 'USD' && (row as any).price_general_usd) unitPriceIdr = Number((row as any).price_general_usd) * usd;
                          if (unitPriceIdr <= 0 && (row as any).price_general) unitPriceIdr = cur === 'IDR' ? Number((row as any).price_general) : cur === 'SAR' ? Number((row as any).price_general) * sar : Number((row as any).price_general) * usd;
                          addDraftItem({
                            type: 'handling',
                            product_id: row.id,
                            product_name: row.name,
                            unit_price_idr: Math.round(unitPriceIdr),
                            quantity: 1
                          });
                          showToast('Handling ditambahkan ke order. Buka menu Invoice / Buat order untuk melanjutkan.', 'success');
                        }}
                        title="Tambah ke order"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Tambah ke order
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            )}
            emptyMessage="Belum ada produk handling"
            emptyDescription={canConfig ? 'Klik Tambah Produk Handling untuk menambah data.' : undefined}
            pagination={{
              total,
              page,
              limit,
              totalPages,
              onPageChange: setPage,
              onLimitChange: (l) => { setLimit(l); setPage(1); }
            }}
            stickyActionsColumn={canShowProductActions}
          />
          )}
        </div>
      </Card>

      {/* Modal Tambah */}
      {showAddModal && (
        <Modal open onClose={() => !addSaving && setShowAddModal(false)}>
          <ModalBox>
            <ModalHeader title="Tambah Produk Handling" subtitle="Nama, deskripsi, dan harga default. Pilih mata uang input (IDR/SAR/USD) — mata uang lain mengikuti konversi kurs aplikasi." icon={<Package className="w-5 h-5" />} onClose={() => !addSaving && setShowAddModal(false)} />
            <ModalBody className="space-y-4">
              <form id="handling-add-form" onSubmit={handleAddSubmit} className="space-y-4">
                {addError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{addError}</div>}
                <Input label="Kode" type="text" value={nextCode()} readOnly fullWidth />
                <Input label="Nama *" type="text" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Jasa Handling Bandara" required fullWidth />
                <Textarea label="Deskripsi" value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} rows={2} fullWidth />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Harga default — pilih mata uang input</label>
                  <p className="text-xs text-slate-500 mb-2">Mata uang lain mengikuti kurs aplikasi (read-only).</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(['IDR', 'SAR', 'USD'] as const).map((cur) => (
                      <Button
                        key={cur}
                        type="button"
                        variant={addForm.price_currency === cur ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => {
                          if (addForm.price_value === 0) { setAddForm((f) => ({ ...f, price_currency: cur })); return; }
                          const triple = fillFromSource(addForm.price_currency, addForm.price_value, currencyRates);
                          const newVal = cur === 'IDR' ? triple.idr : cur === 'SAR' ? triple.sar : triple.usd;
                          setAddForm((f) => ({ ...f, price_currency: cur, price_value: cur === 'IDR' ? Math.round(newVal) : newVal }));
                        }}
                      >
                        {cur}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(() => {
                      const triple = fillFromSource(addForm.price_currency, addForm.price_value, currencyRates);
                      return (['IDR', 'SAR', 'USD'] as const).map((cur) => {
                        const val = cur === 'IDR' ? triple.idr : cur === 'SAR' ? triple.sar : triple.usd;
                        return (
                          <PriceInput
                            key={cur}
                            label={cur === 'IDR' ? 'Rp (IDR)' : cur}
                            value={val}
                            currency={cur}
                            onChange={(n) => setAddForm((f) => ({ ...f, price_currency: cur, price_value: n }))}
                            placeholder="0"
                            fullWidth
                          />
                        );
                      });
                    })()}
                  </div>
                </div>
              </form>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={addSaving}>Batal</Button>
              <Button variant="primary" type="submit" form="handling-add-form" disabled={addSaving}>{addSaving ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {/* Modal Edit */}
      {editing && (
        <Modal open onClose={() => !editSaving && setEditing(null)}>
          <ModalBox>
            <ModalHeader title="Edit Produk Handling" subtitle="Ubah nama, deskripsi, dan harga default. Pilih mata uang input (IDR/SAR/USD) — mata uang lain mengikuti konversi kurs aplikasi." icon={<Pencil className="w-5 h-5" />} onClose={() => !editSaving && setEditing(null)} />
            <ModalBody className="space-y-4">
              <form id="handling-edit-form" onSubmit={handleEditSubmit} className="space-y-4">
                {editError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{editError}</div>}
                <Input label="Kode" type="text" value={editing.code} readOnly fullWidth />
                <Input label="Nama *" type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required fullWidth />
                <Textarea label="Deskripsi" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} fullWidth />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Harga default — pilih mata uang input</label>
                  <p className="text-xs text-slate-500 mb-2">Mata uang lain mengikuti kurs aplikasi (read-only).</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(['IDR', 'SAR', 'USD'] as const).map((cur) => (
                      <Button
                        key={cur}
                        type="button"
                        variant={editForm.price_currency === cur ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => {
                          if (editForm.price_value === 0) { setEditForm((f) => ({ ...f, price_currency: cur })); return; }
                          const triple = fillFromSource(editForm.price_currency, editForm.price_value, currencyRates);
                          const newVal = cur === 'IDR' ? triple.idr : cur === 'SAR' ? triple.sar : triple.usd;
                          setEditForm((f) => ({ ...f, price_currency: cur, price_value: cur === 'IDR' ? Math.round(newVal) : newVal }));
                        }}
                      >
                        {cur}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(() => {
                      const triple = fillFromSource(editForm.price_currency, editForm.price_value, currencyRates);
                      return (['IDR', 'SAR', 'USD'] as const).map((cur) => {
                        const val = cur === 'IDR' ? triple.idr : cur === 'SAR' ? triple.sar : triple.usd;
                        return (
                          <PriceInput
                            key={cur}
                            label={cur === 'IDR' ? 'Rp (IDR)' : cur}
                            value={val}
                            currency={cur}
                            onChange={(n) => setEditForm((f) => ({ ...f, price_currency: cur, price_value: n }))}
                            placeholder="0"
                            fullWidth
                          />
                        );
                      });
                    })()}
                  </div>
                </div>
              </form>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={editSaving}>Batal</Button>
              <Button variant="primary" type="submit" form="handling-edit-form" disabled={editSaving}>{editSaving ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

    </div>
  );
};

export default HandlingPage;
