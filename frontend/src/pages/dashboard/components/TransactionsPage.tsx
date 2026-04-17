import React, { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CalendarDays, Plus, Search } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import CurrencyInput from '../../../components/common/CurrencyInput';
import Autocomplete from '../../../components/common/Autocomplete';
import Modal, { ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common/Modal';
import { SelectOption, TableColumn } from '../../../types';
import {
  PurchaseItem,
  PurchaseStatus,
  SalesItem,
  SalesStatus,
  getFinanceSummary,
  loadPurchases,
  loadSales,
  savePurchases,
  saveSales
} from '../../../utils/financeStore';
import { formatRupiah } from '../../../utils/currency';

type TransactionType = 'purchase' | 'sale';
type TransactionStatus = PurchaseStatus | SalesStatus;

type UnifiedTransaction = {
  id: string;
  type: TransactionType;
  date: string;
  counterpart: string;
  categoryOrProduct: string;
  referenceNo: string;
  amount: number;
  status: TransactionStatus;
};

const purchaseStatusMap: Record<PurchaseStatus, { label: string; variant: 'success' | 'warning' }> = {
  paid: { label: 'Lunas', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' }
};

const salesStatusMap: Record<SalesStatus, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  paid: { label: 'Lunas', variant: 'success' },
  partial: { label: 'Sebagian', variant: 'warning' },
  unpaid: { label: 'Belum Bayar', variant: 'error' }
};

const columns: TableColumn[] = [
  { id: 'date', label: 'Tanggal' },
  { id: 'type', label: 'Jenis', align: 'center' },
  { id: 'counterpart', label: 'Pihak Terkait' },
  { id: 'subject', label: 'Produk/Kategori' },
  { id: 'reference', label: 'Referensi' },
  { id: 'amount', label: 'Nominal', align: 'right' },
  { id: 'status', label: 'Status', align: 'center' }
];

const emptyForm = {
  type: 'sale' as TransactionType,
  date: '',
  counterpart: '',
  subject: '',
  referenceNo: '',
  amount: 0,
  status: 'unpaid' as TransactionStatus
};

const transactionTypeOptions: SelectOption[] = [
  { value: 'sale', label: 'Penjualan' },
  { value: 'purchase', label: 'Pembelian' }
];

const saleStatusOptions: SelectOption[] = [
  { value: 'unpaid', label: 'Belum Bayar' },
  { value: 'partial', label: 'Sebagian' },
  { value: 'paid', label: 'Lunas' }
];

const purchaseStatusOptions: SelectOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Lunas' }
];

const TransactionsPage: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseItem[]>(() => loadPurchases());
  const [sales, setSales] = useState<SalesItem[]>(() => loadSales());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const transactions = useMemo<UnifiedTransaction[]>(() => {
    const purchaseRows: UnifiedTransaction[] = purchases.map((row) => ({
      id: row.id,
      type: 'purchase',
      date: row.date,
      counterpart: row.vendor,
      categoryOrProduct: row.category,
      referenceNo: row.description,
      amount: row.amount,
      status: row.status
    }));
    const salesRows: UnifiedTransaction[] = sales.map((row) => ({
      id: row.id,
      type: 'sale',
      date: row.date,
      counterpart: row.customerName,
      categoryOrProduct: row.product,
      referenceNo: row.invoiceNo,
      amount: row.amount,
      status: row.status
    }));
    return [...purchaseRows, ...salesRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [purchases, sales]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      const typeMatch = typeFilter === 'all' || t.type === typeFilter;
      const queryMatch =
        q.length === 0 ||
        t.counterpart.toLowerCase().includes(q) ||
        t.categoryOrProduct.toLowerCase().includes(q) ||
        t.referenceNo.toLowerCase().includes(q);
      return typeMatch && queryMatch;
    });
  }, [transactions, query, typeFilter]);

  const summary = useMemo(() => getFinanceSummary(purchases, sales), [purchases, sales]);

  const addTransaction = () => {
    if (!form.date || !form.counterpart || !form.subject || !form.referenceNo || form.amount <= 0) return;
    if (form.type === 'purchase') {
      const next: PurchaseItem[] = [
        {
          id: `PUR-${String(purchases.length + 1).padStart(3, '0')}`,
          date: form.date,
          vendor: form.counterpart,
          category: form.subject,
          description: form.referenceNo,
          amount: form.amount,
          status: (form.status as PurchaseStatus) === 'paid' ? 'paid' : 'pending'
        },
        ...purchases
      ];
      setPurchases(next);
      savePurchases(next);
    } else {
      const next: SalesItem[] = [
        {
          id: `SAL-${String(sales.length + 1).padStart(3, '0')}`,
          date: form.date,
          customerName: form.counterpart,
          product: form.subject,
          invoiceNo: form.referenceNo,
          amount: form.amount,
          status: (['paid', 'partial', 'unpaid'].includes(form.status) ? form.status : 'unpaid') as SalesStatus
        },
        ...sales
      ];
      setSales(next);
      saveSales(next);
    }
    setForm(emptyForm);
    setFormOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><p className="text-sm text-stone-500">Total Penjualan</p><p className="text-2xl font-bold mt-1">{formatRupiah(summary.totalSales)}</p></Card>
        <Card><p className="text-sm text-stone-500">Total Pembelian</p><p className="text-2xl font-bold mt-1">{formatRupiah(summary.totalPurchases)}</p></Card>
        <Card><p className="text-sm text-stone-500">Laba Kotor</p><p className={`text-2xl font-bold mt-1 ${summary.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupiah(summary.grossProfit)}</p></Card>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:max-w-2xl">
            <Input ariaLabel="Cari transaksi" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari pihak, kategori/produk, referensi..." icon={<Search className="w-4 h-4" />} />
            <Autocomplete
              value={typeFilter === 'all' ? '' : typeFilter}
              onChange={(value) => setTypeFilter((value || 'all') as 'all' | TransactionType)}
              options={transactionTypeOptions}
              emptyLabel="Semua jenis"
            />
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setFormOpen(true)}>Tambah Transaksi</Button>
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          emptyMessage="Belum ada data transaksi"
          emptyDescription="Pembelian dan penjualan tampil dalam satu daftar."
          renderRow={(row) => (
            <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-700 inline-flex items-center gap-1"><CalendarDays className="w-4 h-4 text-slate-400" />{new Date(row.date).toLocaleDateString('id-ID')}</td>
              <td className="px-4 py-3 text-center">
                <Badge variant={row.type === 'sale' ? 'success' : 'info'} size="sm">
                  <span className="inline-flex items-center gap-1">
                    {row.type === 'sale' ? <ArrowUpCircle className="w-3.5 h-3.5" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}
                    {row.type === 'sale' ? 'Penjualan' : 'Pembelian'}
                  </span>
                </Badge>
              </td>
              <td className="px-4 py-3 font-semibold text-slate-800">{row.counterpart}</td>
              <td className="px-4 py-3 text-slate-700">{row.categoryOrProduct}</td>
              <td className="px-4 py-3 text-slate-700">{row.referenceNo}</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupiah(row.amount)}</td>
              <td className="px-4 py-3 text-center">
                {row.type === 'sale' ? (
                  <Badge variant={salesStatusMap[row.status as SalesStatus].variant} size="sm">{salesStatusMap[row.status as SalesStatus].label}</Badge>
                ) : (
                  <Badge variant={purchaseStatusMap[row.status as PurchaseStatus].variant} size="sm">{purchaseStatusMap[row.status as PurchaseStatus].label}</Badge>
                )}
              </td>
            </tr>
          )}
        />
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        <ModalBox className="max-w-2xl min-h-0">
          <ModalHeader title="Tambah Transaksi" subtitle="Pilih jenis pembelian atau penjualan" onClose={() => setFormOpen(false)} />
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Autocomplete
                label="Jenis"
                value={form.type}
                onChange={(value) =>
                  setForm((p) => ({
                    ...p,
                    type: value as TransactionType,
                    status: value === 'sale' ? 'unpaid' : 'pending'
                  }))
                }
                options={transactionTypeOptions}
              />
              <Input label="Tanggal" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              <Input label={form.type === 'sale' ? 'Customer/Jamaah' : 'Vendor'} value={form.counterpart} onChange={(e) => setForm((p) => ({ ...p, counterpart: e.target.value }))} />
              <Input label={form.type === 'sale' ? 'Produk/Paket' : 'Kategori Biaya'} value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
              <Input label={form.type === 'sale' ? 'No Invoice' : 'Keterangan'} value={form.referenceNo} onChange={(e) => setForm((p) => ({ ...p, referenceNo: e.target.value }))} />
              <CurrencyInput label="Nominal" value={form.amount} onChange={(value) => setForm((p) => ({ ...p, amount: value }))} />
              <Autocomplete
                label="Status"
                value={form.status}
                onChange={(value) => setForm((p) => ({ ...p, status: value as TransactionStatus }))}
                options={form.type === 'sale' ? saleStatusOptions : purchaseStatusOptions}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={addTransaction}>Simpan</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default TransactionsPage;
