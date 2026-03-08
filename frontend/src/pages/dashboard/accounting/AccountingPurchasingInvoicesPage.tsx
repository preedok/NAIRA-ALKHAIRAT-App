import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt, BookOpen, Plus } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { Input, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ActionsMenu, AutoRefreshControl } from '../../../components/common';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { accountingApi } from '../../../services/api';
import { NominalDisplay } from '../../../components/common';

const INVOICE_STATUS_LABELS: Record<string, string> = { draft: 'Draft', posted: 'Posted', partial_paid: 'Partial', paid: 'Lunas' };
const DEFAULT_LIMIT = 20;
const PURCHASE_TYPE_TABS: Array<{ value: string; label: string }> = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'visa', label: 'Visa' },
  { value: 'ticket', label: 'Tiket' },
  { value: 'bus', label: 'Bus Saudi' },
  { value: 'handling', label: 'Handling' }
];

interface AccountingPurchasingInvoicesPageProps {
  embedded?: boolean;
  triggerCreate?: boolean;
  onClearCreateTrigger?: () => void;
}

const AccountingPurchasingInvoicesPage: React.FC<AccountingPurchasingInvoicesPageProps> = ({ embedded = false, triggerCreate, onClearCreateTrigger }) => {
  const [searchParams] = useSearchParams();
  const productIdFromUrl = searchParams.get('product_id') || '';
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [productId, setProductId] = useState(productIdFromUrl);
  const [statusFilter, setStatusFilter] = useState('');
  const [products, setProducts] = useState<Array<{ id: string; code: string; name: string; type: string }>>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', product_id: '', purchase_order_id: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', notes: '', lines: [{ description: '', quantity: 1, unit: 'pcs', unit_price: 0 }] });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [purchaseType, setPurchaseType] = useState<string>('');
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (productId) params.product_id = productId;
      if (statusFilter) params.status = statusFilter;
      const res = await accountingApi.listPurchaseInvoices(params);
      if (res.data.success) {
        setList(res.data.data || []);
        setTotal((res.data as { total?: number }).total ?? 0);
      } else setList([]);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, productId, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { setProductId(productIdFromUrl || productId); }, [productIdFromUrl]);

  useEffect(() => {
    accountingApi.getPurchasingSummary().then((r) => {
      if (r.data.success && r.data.data) setProducts(r.data.data.products || []);
    }).catch(() => {});
    accountingApi.listSuppliers({ limit: 500, is_active: 'true' }).then((r) => {
      if (r.data.success) setSuppliers(r.data.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    accountingApi.listPurchaseOrders({ limit: 500, status: 'approved' }).then((r) => {
      if (r.data.success) setPurchaseOrders(r.data.data || []);
    }).catch(() => {});
  }, [modalOpen]);

  useEffect(() => {
    if (triggerCreate) {
      openCreate();
      onClearCreateTrigger?.();
    }
  }, [triggerCreate]);

  const openCreate = () => {
    setForm({
      supplier_id: '',
      product_id: productId || '',
      purchase_order_id: '',
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: '',
      notes: '',
      lines: [{ description: '', quantity: 1, unit: 'pcs', unit_price: 0 }]
    });
    const current = (productId || '').trim();
    const preType = current ? (products.find((p) => p.id === current)?.type || '') : '';
    setPurchaseType(preType);
    setProofFile(null);
    setFormError('');
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.supplier_id) { setFormError('Pilih supplier'); return; }
    if (!proofFile) { setFormError('Bukti faktur pembelian (file) wajib diunggah'); return; }
    setFormError('');
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('proof_file', proofFile);
      formData.append('supplier_id', form.supplier_id);
      if (form.product_id) formData.append('product_id', form.product_id);
      if (form.purchase_order_id) formData.append('purchase_order_id', form.purchase_order_id);
      formData.append('invoice_date', form.invoice_date);
      if (form.due_date) formData.append('due_date', form.due_date);
      if (form.notes) formData.append('notes', form.notes);
      const lines = form.lines.filter((l) => l.description || l.unit_price > 0).map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit, unit_price: l.unit_price }));
      formData.append('lines', JSON.stringify(lines));
      await accountingApi.createPurchaseInvoice(formData);
      setModalOpen(false);
      fetchList();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Gagal membuat faktur');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async (id: string) => {
    if (!window.confirm('Posting faktur akan membuat jurnal. Lanjutkan?')) return;
    setActionLoading(true);
    try {
      await accountingApi.postPurchaseInvoice(id);
      fetchList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err?.response?.data?.message || 'Gagal posting');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Faktur Pembelian"
          subtitle="Faktur pembelian product ke supplier. Setiap faktur baru wajib dilampiri bukti."
          right={
            <div className="flex items-center gap-2">
              <AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />
              <Button variant="primary" size="sm" className="gap-1" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Buat Faktur
              </Button>
            </div>
          }
        />
      )}
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Faktur Pembelian</h2>
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />
            <Button variant="primary" size="sm" className="gap-1" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Buat Faktur
            </Button>
          </div>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <Autocomplete
            label="Product"
            size="sm"
            value={productId}
            onChange={(v: string) => setProductId(v || '')}
            emptyLabel="Semua product"
            options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.type})` }))}
            className="min-w-[200px]"
            fullWidth={false}
          />
          <Autocomplete
            label="Status"
            size="sm"
            value={statusFilter}
            onChange={(v: string) => setStatusFilter(v || '')}
            emptyLabel="Semua"
            options={Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            className="min-w-[140px]"
            fullWidth={false}
          />
        </div>
        <Table
          columns={[
            { id: 'invoice_number', label: 'No. Faktur', align: 'left' },
            { id: 'supplier', label: 'Supplier', align: 'left' },
            { id: 'product', label: 'Product', align: 'left' },
            { id: 'invoice_date', label: 'Tanggal', align: 'left' },
            { id: 'total', label: 'Total', align: 'right' },
            { id: 'paid', label: 'Terbayar', align: 'right' },
            { id: 'remaining', label: 'Sisa', align: 'right' },
            { id: 'status', label: 'Status', align: 'left' },
            { id: 'actions', label: '', align: 'right' }
          ] as TableColumn[]}
          data={loading ? [] : list}
          emptyMessage={loading ? 'Memuat...' : 'Tidak ada faktur pembelian'}
          pagination={total > 0 ? { total, page, limit, totalPages, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } } : undefined}
          renderRow={(row) => {
            const menuItems: ActionsMenuItem[] = [];
            if (row.status === 'draft') {
              menuItems.push({ id: 'post', label: 'Post ke Jurnal', icon: <BookOpen className="w-4 h-4" />, onClick: () => handlePost(row.id) });
            }
            return (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium">{row.invoice_number}</td>
                <td className="px-4 py-3 text-sm">{row.Supplier?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm">{row.Product?.name ?? '–'}</td>
                <td className="px-4 py-3 text-sm">{row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('id-ID') : '–'}</td>
                <td className="px-4 py-3 text-right"><NominalDisplay amount={parseFloat(row.total_amount || 0)} currency="IDR" /></td>
                <td className="px-4 py-3 text-right text-blue-600"><NominalDisplay amount={parseFloat(row.paid_amount || 0)} currency="IDR" /></td>
                <td className="px-4 py-3 text-right text-amber-600"><NominalDisplay amount={parseFloat(row.remaining_amount || 0)} currency="IDR" /></td>
                <td className="px-4 py-3"><Badge variant={row.status === 'paid' ? 'success' : row.status === 'posted' || row.status === 'partial_paid' ? 'warning' : 'default'}>{INVOICE_STATUS_LABELS[row.status] ?? row.status}</Badge></td>
                <td className="px-4 py-3 text-right">{menuItems.length > 0 && <ActionsMenu items={menuItems} />}</td>
              </tr>
            );
          }}
        />
      </Card>

      {modalOpen && (
        <Modal open onClose={() => setModalOpen(false)}>
          <ModalBox>
            <ModalHeader title="Buat Faktur Pembelian" onClose={() => setModalOpen(false)} />
            <ModalBody>
              {formError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
              <div className="space-y-4">
                <Autocomplete label="Supplier *" value={form.supplier_id} onChange={(v) => setForm((f) => ({ ...f, supplier_id: v || '' }))} placeholder="Pilih supplier" emptyLabel="Pilih supplier" options={suppliers.map((s) => ({ value: s.id, label: `${s.code} – ${s.name}` }))} />
                <Autocomplete
                  label="Tipe Pembelian"
                  value={purchaseType}
                  onChange={(v) => { setPurchaseType(v || ''); setForm((f) => ({ ...f, product_id: '' })); }}
                  placeholder="Pilih tipe"
                  emptyLabel="Semua"
                  options={PURCHASE_TYPE_TABS}
                />
                <Autocomplete label="Product" value={form.product_id} onChange={(v) => setForm((f) => ({ ...f, product_id: v || '' }))} placeholder="Pilih product" emptyLabel="Pilih product" options={products.filter((p) => !purchaseType || p.type === purchaseType).map((p) => ({ value: p.id, label: `${p.name} (${p.type})` }))} />
                <Autocomplete label="PO (opsional)" value={form.purchase_order_id} onChange={(v) => setForm((f) => ({ ...f, purchase_order_id: v || '' }))} placeholder="–" emptyLabel="Tanpa PO" options={purchaseOrders.map((po) => ({ value: po.id, label: `${po.po_number} – ${po.Supplier?.name}` }))} />
                <div className="grid grid-cols-2 gap-4">
                  <Input type="date" label="Tanggal faktur" value={form.invoice_date} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} />
                  <Input type="date" label="Jatuh tempo" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                </div>
                <Input label="Catatan" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Opsional" />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bukti faktur pembelian *</label>
                  <p className="text-xs text-slate-500 mb-2">Setiap faktur wajib dilampiri bukti (PDF/gambar)</p>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700" />
                  {proofFile && <span className="text-xs text-slate-600 mt-1 block">{proofFile.name}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Baris (min 1)</label>
                  {form.lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-end mb-2">
                      <Input placeholder="Deskripsi" value={line.description} onChange={(e) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))} className="flex-1" />
                      <Input type="number" placeholder="Qty" value={String(line.quantity)} onChange={(e) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, quantity: parseFloat(e.target.value) || 0 } : l) }))} className="w-20" />
                      <Input type="number" placeholder="Harga" value={line.unit_price ? String(line.unit_price) : ''} onChange={(e) => setForm((f) => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, unit_price: parseFloat(e.target.value) || 0 } : l) }))} className="w-28" />
                    </div>
                  ))}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Batal</Button>
              <Button variant="primary" onClick={handleCreate} disabled={actionLoading}>{actionLoading ? 'Menyimpan...' : 'Buat Faktur'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default AccountingPurchasingInvoicesPage;
