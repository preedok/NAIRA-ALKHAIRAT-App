import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, BookOpen } from 'lucide-react';
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
import { formatCurrency } from '../../../utils/formatters';

const PAYMENT_STATUS_LABELS: Record<string, string> = { draft: 'Draft', posted: 'Posted' };
const DEFAULT_LIMIT = 20;

interface AccountingPurchasingPaymentsPageProps {
  embedded?: boolean;
  triggerCreate?: boolean;
  onClearCreateTrigger?: () => void;
}

const AccountingPurchasingPaymentsPage: React.FC<AccountingPurchasingPaymentsPageProps> = ({ embedded = false, triggerCreate, onClearCreateTrigger }) => {
  const [searchParams] = useSearchParams();
  const productIdFromUrl = searchParams.get('product_id') || '';
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [productId, setProductId] = useState(productIdFromUrl);
  const [statusFilter, setStatusFilter] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ purchase_invoice_id: '', payment_date: new Date().toISOString().slice(0, 10), amount: 0, currency: 'IDR', payment_method: 'transfer', bank_account_id: '', reference_number: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (productId) params.product_id = productId;
      if (statusFilter) params.status = statusFilter;
      const res = await accountingApi.listPurchasePayments(params);
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
    if (triggerCreate) {
      openCreate();
      onClearCreateTrigger?.();
    }
  }, [triggerCreate]);

  useEffect(() => {
    const invParams: Record<string, string | number> = { status: 'posted', limit: 500 };
    if (productId) invParams.product_id = productId;
    accountingApi.listPurchaseInvoices(invParams).then((r) => {
      if (r.data.success) setInvoices((r.data.data || []).filter((inv: any) => parseFloat(inv.remaining_amount) > 0));
    }).catch(() => {});
    accountingApi.getBankAccounts({ is_active: 'true' }).then((r) => {
      if (r.data.success) setBankAccounts(r.data.data || []);
    }).catch(() => {});
  }, [productId]);

  const openCreate = () => {
    setForm({
      purchase_invoice_id: '',
      payment_date: new Date().toISOString().slice(0, 10),
      amount: 0,
      currency: 'IDR',
      payment_method: 'transfer',
      bank_account_id: '',
      reference_number: '',
      notes: ''
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.purchase_invoice_id) { setFormError('Pilih faktur pembelian'); return; }
    if (!(form.amount > 0)) { setFormError('Jumlah harus > 0'); return; }
    setFormError('');
    setActionLoading(true);
    try {
      await accountingApi.createPurchasePayment({
        purchase_invoice_id: form.purchase_invoice_id,
        payment_date: form.payment_date,
        amount: form.amount,
        currency: form.currency,
        payment_method: form.payment_method,
        bank_account_id: form.bank_account_id || undefined,
        reference_number: form.reference_number || undefined,
        notes: form.notes || undefined
      });
      setModalOpen(false);
      fetchList();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Gagal membuat pembayaran');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async (id: string) => {
    setActionLoading(true);
    try {
      await accountingApi.postPurchasePayment(id);
      fetchList();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Gagal posting');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Pembayaran Pembelian"
          subtitle="Pembayaran faktur pembelian ke supplier: buat pembayaran, post ke jurnal"
          right={
            <div className="flex items-center gap-2">
              <AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />
              <Button variant="primary" size="sm" className="gap-1" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Buat Pembayaran
              </Button>
            </div>
          }
        />
      )}
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Pembayaran Pembelian</h2>
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={fetchList} disabled={loading} size="sm" />
            <Button variant="primary" size="sm" className="gap-1" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Buat Pembayaran
            </Button>
          </div>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <Autocomplete
            label="Status"
            size="sm"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v || '')}
            emptyLabel="Semua"
            options={Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            className="min-w-[140px]"
            fullWidth={false}
          />
        </div>
        <Table
          columns={[
            { id: 'payment_number', label: 'No. Pembayaran', align: 'left' },
            { id: 'invoice', label: 'Faktur', align: 'left' },
            { id: 'supplier', label: 'Supplier', align: 'left' },
            { id: 'payment_date', label: 'Tanggal', align: 'left' },
            { id: 'amount', label: 'Jumlah', align: 'right' },
            { id: 'status', label: 'Status', align: 'left' },
            { id: 'actions', label: '', align: 'right' }
          ] as TableColumn[]}
          data={loading ? [] : list}
          emptyMessage={loading ? 'Memuat...' : 'Tidak ada pembayaran'}
          pagination={
            total > 0
              ? { total, page, limit, totalPages, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }
              : undefined
          }
          renderRow={(row) => {
            const menuItems: ActionsMenuItem[] = [];
            if (row.status === 'draft') {
              menuItems.push({ id: 'post', label: 'Post ke Jurnal', icon: <BookOpen className="w-4 h-4" />, onClick: () => handlePost(row.id) });
            }
            return (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium">{row.payment_number}</td>
                <td className="px-4 py-3 text-sm">{row.PurchaseInvoice?.invoice_number ?? '-'}</td>
                <td className="px-4 py-3 text-sm">{row.Supplier?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm">{row.payment_date ? new Date(row.payment_date).toLocaleDateString('id-ID') : '–'}</td>
                <td className="px-4 py-3 text-right"><NominalDisplay amount={parseFloat(row.amount || 0)} currency="IDR" /></td>
                <td className="px-4 py-3">
                  <Badge variant={row.status === 'posted' ? 'success' : 'default'}>{PAYMENT_STATUS_LABELS[row.status] ?? row.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">{menuItems.length > 0 && <ActionsMenu items={menuItems} />}</td>
              </tr>
            );
          }}
        />
      </Card>

      {modalOpen && (
        <Modal open onClose={() => setModalOpen(false)}>
          <ModalBox>
            <ModalHeader title="Buat Pembayaran Pembelian" onClose={() => setModalOpen(false)} />
            <ModalBody>
              {formError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}
              <div className="space-y-4">
                <Autocomplete
                  label="Faktur Pembelian *"
                  value={form.purchase_invoice_id}
                  onChange={(v) => {
                    const inv = invoices.find((i) => i.id === v);
                    setForm((f) => ({ ...f, purchase_invoice_id: v || '', amount: inv ? parseFloat(inv.remaining_amount) || 0 : 0, currency: inv?.currency || 'IDR' }));
                  }}
                  placeholder="Pilih faktur"
                  emptyLabel="Pilih faktur"
                  options={invoices.map((inv) => ({
                    value: inv.id,
                    label: `${inv.invoice_number} – ${inv.Supplier?.name} – Sisa ${formatCurrency(parseFloat(inv.remaining_amount || 0), 'IDR')}`
                  }))}
                />
                <Input type="date" label="Tanggal pembayaran" value={form.payment_date} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} />
                <Input type="number" label="Jumlah *" value={String(form.amount)} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} placeholder="0" />
                <Autocomplete
                  label="Rekening bank"
                  value={form.bank_account_id}
                  onChange={(v) => setForm((f) => ({ ...f, bank_account_id: v || '' }))}
                  placeholder="Pilih rekening"
                  emptyLabel="Pilih rekening"
                  options={bankAccounts.map((b) => ({ value: b.id, label: `${b.name} – ${b.account_number}` }))}
                />
                <Input label="No. referensi" value={form.reference_number} onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))} placeholder="Opsional" />
                <Input label="Catatan" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Opsional" />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Batal</Button>
              <Button variant="primary" onClick={handleCreate} disabled={actionLoading}>{actionLoading ? 'Menyimpan...' : 'Simpan'}</Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default AccountingPurchasingPaymentsPage;
