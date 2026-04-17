import React, { useMemo, useState } from 'react';
import { CalendarDays, CircleDollarSign, Plus, Search } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import CurrencyInput from '../../../components/common/CurrencyInput';
import Autocomplete from '../../../components/common/Autocomplete';
import Modal, { ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common/Modal';
import { SelectOption, TableColumn } from '../../../types';
import { SalesItem, SalesStatus, getFinanceSummary, loadPurchases, loadSales, saveSales } from '../../../utils/financeStore';
import { formatRupiah } from '../../../utils/currency';

const statusMap: Record<SalesStatus, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  paid: { label: 'Lunas', variant: 'success' },
  partial: { label: 'Sebagian', variant: 'warning' },
  unpaid: { label: 'Belum Bayar', variant: 'error' }
};

const columns: TableColumn[] = [
  { id: 'date', label: 'Tanggal' },
  { id: 'customer', label: 'Customer/Jamaah' },
  { id: 'product', label: 'Produk/Paket' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'amount', label: 'Nominal', align: 'right' },
  { id: 'status', label: 'Status', align: 'center' }
];

const emptyForm = { date: '', customerName: '', product: '', invoiceNo: '', amount: 0, status: 'unpaid' as SalesStatus };
const salesStatusOptions: SelectOption[] = [
  { value: 'paid', label: 'Lunas' },
  { value: 'partial', label: 'Sebagian' },
  { value: 'unpaid', label: 'Belum Bayar' }
];

const SalesPage: React.FC = () => {
  const [rows, setRows] = useState<SalesItem[]>(() => loadSales());
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SalesStatus>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const purchaseRows = loadPurchases();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const queryMatch = q.length === 0 || r.customerName.toLowerCase().includes(q) || r.invoiceNo.toLowerCase().includes(q) || r.product.toLowerCase().includes(q);
      const statusMatch = statusFilter === 'all' || r.status === statusFilter;
      return queryMatch && statusMatch;
    });
  }, [rows, query, statusFilter]);

  const summary = useMemo(() => {
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    const paid = rows.filter((r) => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
    const outstanding = rows.filter((r) => r.status !== 'paid').reduce((sum, r) => sum + r.amount, 0);
    const finance = getFinanceSummary(purchaseRows, rows);
    return { total, paid, outstanding, profit: finance.grossProfit };
  }, [rows, purchaseRows]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><p className="text-sm text-stone-500">Total Penjualan</p><p className="text-2xl font-bold mt-1">{formatRupiah(summary.total)}</p></Card>
        <Card><p className="text-sm text-stone-500">Sudah Tertagih</p><p className="text-2xl font-bold mt-1 text-emerald-600">{formatRupiah(summary.paid)}</p></Card>
        <Card><p className="text-sm text-stone-500">Outstanding</p><p className="text-2xl font-bold mt-1 text-rose-600">{formatRupiah(summary.outstanding)}</p></Card>
        <Card><p className="text-sm text-stone-500">Estimasi Laba Kotor</p><p className={`text-2xl font-bold mt-1 ${summary.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupiah(summary.profit)}</p></Card>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:max-w-2xl">
            <Input ariaLabel="Cari penjualan" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari customer / invoice / produk..." icon={<Search className="w-4 h-4" />} />
            <Autocomplete
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={(value) => setStatusFilter((value || 'all') as 'all' | SalesStatus)}
              options={salesStatusOptions}
              emptyLabel="Semua status"
            />
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setFormOpen(true)}>Tambah Penjualan</Button>
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          emptyMessage="Belum ada data penjualan"
          emptyDescription="Tambahkan transaksi penjualan dari invoice sistem."
          renderRow={(row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-700 inline-flex items-center gap-1"><CalendarDays className="w-4 h-4 text-slate-400" />{new Date(row.date).toLocaleDateString('id-ID')}</td>
              <td className="px-4 py-3 font-semibold text-slate-800">{row.customerName}</td>
              <td className="px-4 py-3 text-slate-700">{row.product}</td>
              <td className="px-4 py-3 text-slate-700">{row.invoiceNo}</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupiah(row.amount)}</td>
              <td className="px-4 py-3 text-center"><Badge variant={statusMap[row.status].variant} size="sm">{statusMap[row.status].label}</Badge></td>
            </tr>
          )}
        />
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        <ModalBox className="max-w-2xl min-h-0">
          <ModalHeader title="Tambah Penjualan" subtitle="Catat transaksi penjualan dari sistem" onClose={() => setFormOpen(false)} icon={<CircleDollarSign className="w-5 h-5" />} />
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Tanggal" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              <Input label="Nama Customer/Jamaah" value={form.customerName} onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))} />
              <Input label="Produk/Paket" value={form.product} onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))} />
              <Input label="No Invoice" value={form.invoiceNo} onChange={(e) => setForm((p) => ({ ...p, invoiceNo: e.target.value }))} />
              <CurrencyInput label="Nominal" value={form.amount} onChange={(value) => setForm((p) => ({ ...p, amount: value }))} />
              <Autocomplete
                label="Status"
                value={form.status}
                onChange={(value) => setForm((p) => ({ ...p, status: value as SalesStatus }))}
                options={salesStatusOptions}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button
              onClick={() => {
                if (!form.date || !form.customerName || !form.product || !form.invoiceNo || form.amount <= 0) return;
                setRows((prev) => {
                  const next = [{ id: `SAL-${String(prev.length + 1).padStart(3, '0')}`, ...form }, ...prev];
                  saveSales(next);
                  return next;
                });
                setForm(emptyForm);
                setFormOpen(false);
              }}
            >
              Simpan
            </Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default SalesPage;
