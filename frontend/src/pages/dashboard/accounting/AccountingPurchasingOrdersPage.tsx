import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Plus, Trash2, Send, CheckCircle } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { Input, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ActionsMenu, AutoRefreshControl } from '../../../components/common';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { accountingApi } from '../../../services/api';
import { formatIDR } from '../../../utils';

const PO_STATUS_LABELS: Record<string, string> = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved' };
const DEFAULT_LIMIT = 20;

const AccountingPurchasingOrdersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const productIdFromUrl = searchParams.get('product_id') || '';
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [productId, setProductId] = useState(productIdFromUrl);
  const [statusFilter, setStatusFilter] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; code: string; name: string; type: string }>>([]);
  const [modalOpen, setModalOpen] = useState<'create' | null>(null);
  const [form, setForm] = useState({ supplier_id: '', product_description: '', order_date: new Date().toISOString().slice(0, 10), expected_date: '' });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (productId) params.product_id = productId;
      if (statusFilter) params.status = statusFilter;
      const res = await accountingApi.listPurchaseOrders(params);
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
      if (r.data.success && r.data.data) {
        setProducts(r.data.data.products || []);
      }
    }).catch(() => {});
    accountingApi.listSuppliers({ limit: 500, is_active: 'true' }).then((r) => {
      if (r.data.success) setSuppliers(r.data.data || []);
    }).catch(() => {});
  }, []);

  const openCreate = () => {
    setForm({
      supplier_id: '',
      product_description: '',
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: ''
    });
    setProofFile(null);
    setFormError('');
    setModalOpen('create');
  };

  const handleCreate = async () => {
    if (!form.supplier_id) { setFormError('Pilih supplier'); return; }
    if (!proofFile) { setFormError('Bukti pembelian (file) wajib diunggah'); return; }
    setFormError('');
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('proof_file', proofFile);
      formData.append('supplier_id', form.supplier_id);
      formData.append('order_date', form.order_date);
      if (form.expected_date) formData.append('expected_date', form.expected_date);
      const lines = form.product_description.trim()
        ? [{ description: form.product_description.trim(), quantity: 1, unit: 'pcs', unit_price: 0 }]
        : [];
      formData.append('lines', JSON.stringify(lines));
      await accountingApi.createPurchaseOrder(formData);
      setModalOpen(null);
      fetchList();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Gagal membuat PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (id: string) => {
    setActionLoading(true);
    try {
      await accountingApi.submitPurchaseOrder(id);
      fetchList();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Gagal submit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await accountingApi.approvePurchaseOrder(id);
      fetchList();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Gagal approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin hapus PO ini?')) return;
    setActionLoading(true);
    try {
      await accountingApi.deletePurchaseOrder(id);
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
      <PageHeader
        title="PO Pembelian"
        subtitle="Pembelian product baru ke supplier sesuai product di aplikasi: buat PO, submit, approve"
        right={
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />
            <Button variant="primary" size="sm" className="gap-1" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Buat PO
            </Button>
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <Autocomplete
            label="Product"
            size="sm"
            value={productId}
            onChange={(v) => setProductId(v || '')}
            emptyLabel="Semua product"
            options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.type})` }))}
            className="min-w-[200px]"
            fullWidth={false}
          />
          <Autocomplete
            label="Status"
            size="sm"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v || '')}
            emptyLabel="Semua"
            options={Object.entries(PO_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            className="min-w-[140px]"
            fullWidth={false}
          />
        </div>
        <Table
          columns={[
            { id: 'po_number', label: 'No. PO', align: 'left' },
            { id: 'supplier', label: 'Supplier', align: 'left' },
            { id: 'product', label: 'Product', align: 'left' },
            { id: 'order_date', label: 'Tanggal', align: 'left' },
            { id: 'total', label: 'Total', align: 'right' },
            { id: 'status', label: 'Status', align: 'left' },
            { id: 'actions', label: '', align: 'right' }
          ] as TableColumn[]}
          data={loading ? [] : list}
          emptyMessage={loading ? 'Memuat...' : 'Tidak ada PO'}
          pagination={
            total > 0
              ? { total, page, limit, totalPages, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }
              : undefined
          }
          renderRow={(row) => {
            const menuItems: ActionsMenuItem[] = [];
            if (row.status === 'draft') {
              menuItems.push({ id: 'submit', label: 'Submit', icon: <Send className="w-4 h-4" />, onClick: () => handleSubmit(row.id) });
              menuItems.push({ id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(row.id), danger: true });
            }
            if (row.status === 'submitted') {
              menuItems.push({ id: 'approve', label: 'Approve', icon: <CheckCircle className="w-4 h-4" />, onClick: () => handleApprove(row.id) });
            }
            return (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium">{row.po_number}</td>
                <td className="px-4 py-3 text-sm">{row.Supplier?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm">{row.Product?.name ?? '–'}</td>
                <td className="px-4 py-3 text-sm">{row.order_date ? new Date(row.order_date).toLocaleDateString('id-ID') : '–'}</td>
                <td className="px-4 py-3 text-right">{formatIDR(parseFloat(row.total_amount || 0))}</td>
                <td className="px-4 py-3">
                  <Badge variant={row.status === 'approved' ? 'success' : row.status === 'submitted' ? 'warning' : 'default'}>{PO_STATUS_LABELS[row.status] ?? row.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {menuItems.length > 0 && <ActionsMenu items={menuItems} />}
                </td>
              </tr>
            );
          }}
        />
      </Card>

      {modalOpen === 'create' && (
        <Modal open onClose={() => setModalOpen(null)}>
          <ModalBox>
            <ModalHeader title="Buat PO Pembelian" onClose={() => setModalOpen(null)} />
            <ModalBody>
              {formError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
              <div className="space-y-4">
                <Autocomplete
                  label="Supplier *"
                  value={form.supplier_id}
                  onChange={(v) => setForm((f) => ({ ...f, supplier_id: v || '' }))}
                  placeholder="Pilih supplier"
                  emptyLabel="Pilih supplier"
                  options={suppliers.map((s) => ({ value: s.id, label: `${s.code} – ${s.name}` }))}
                />
                <Input label="Product" value={form.product_description} onChange={(e) => setForm((f) => ({ ...f, product_description: e.target.value }))} placeholder="Nama/deskripsi product" />
                <div className="grid grid-cols-2 gap-4">
                  <Input type="date" label="Tanggal pembelian" value={form.order_date} onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))} />
                  <Input type="date" label="Tanggal berakhir pembelian" value={form.expected_date} onChange={(e) => setForm((f) => ({ ...f, expected_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bukti pembelian *</label>
                  <p className="text-xs text-slate-500 mb-2">Setiap PO wajib dilampiri bukti (PDF/gambar)</p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700"
                  />
                  {proofFile && <span className="text-xs text-slate-600 mt-1 block">{proofFile.name}</span>}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setModalOpen(null)}>Batal</Button>
              <Button variant="primary" onClick={handleCreate} disabled={actionLoading}>{actionLoading ? 'Menyimpan...' : 'Buat PO'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default AccountingPurchasingOrdersPage;
