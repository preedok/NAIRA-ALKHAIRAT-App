import React, { useMemo, useState } from 'react';
import { CalendarDays, Plus, Search, ShoppingBag } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import CurrencyInput from '../../../components/common/CurrencyInput';
import Autocomplete from '../../../components/common/Autocomplete';
import Modal, { ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common/Modal';
import { SelectOption, TableColumn } from '../../../types';
import { PurchaseItem, PurchaseStatus, getFinanceSummary, loadPurchases, loadSales, savePurchases } from '../../../utils/financeStore';
import { formatRupiah } from '../../../utils/currency';

const statusMap: Record<PurchaseStatus, { label: string; variant: 'success' | 'warning' }> = {
  paid: { label: 'Lunas', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' }
};

const columns: TableColumn[] = [
  { id: 'date', label: 'Tanggal' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'category', label: 'Kategori' },
  { id: 'description', label: 'Keterangan' },
  { id: 'amount', label: 'Nominal', align: 'right' },
  { id: 'status', label: 'Status', align: 'center' }
];

const emptyForm = { date: '', vendor: '', category: '', description: '', amount: 0, status: 'pending' as PurchaseStatus };
const purchaseStatusOptions: SelectOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Lunas' }
];

const PurchasesPage: React.FC = () => {
  const [rows, setRows] = useState<PurchaseItem[]>(() => loadPurchases());
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseStatus>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const salesRows = loadSales();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const queryMatch = q.length === 0 || r.vendor.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      const statusMatch = statusFilter === 'all' || r.status === statusFilter;
      return queryMatch && statusMatch;
    });
  }, [rows, query, statusFilter]);

  const summary = useMemo(() => {
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    const paid = rows.filter((r) => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
    const finance = getFinanceSummary(rows, salesRows);
    return { total, paid, pending: total - paid, profit: finance.grossProfit };
  }, [rows, salesRows]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><p className="text-sm text-stone-500">Total Pembelian</p><p className="text-2xl font-bold mt-1">{formatRupiah(summary.total)}</p></Card>
        <Card><p className="text-sm text-stone-500">Sudah Dibayar</p><p className="text-2xl font-bold mt-1 text-emerald-600">{formatRupiah(summary.paid)}</p></Card>
        <Card><p className="text-sm text-stone-500">Belum Dibayar</p><p className="text-2xl font-bold mt-1 text-amber-600">{formatRupiah(summary.pending)}</p></Card>
        <Card><p className="text-sm text-stone-500">Estimasi Laba Kotor</p><p className={`text-2xl font-bold mt-1 ${summary.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupiah(summary.profit)}</p></Card>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:max-w-2xl">
            <Input ariaLabel="Cari pembelian" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari vendor / keterangan..." icon={<Search className="w-4 h-4" />} />
            <Autocomplete
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={(value) => setStatusFilter((value || 'all') as 'all' | PurchaseStatus)}
              options={purchaseStatusOptions}
              emptyLabel="Semua status"
            />
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setFormOpen(true)}>Tambah Pembelian</Button>
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          emptyMessage="Belum ada data pembelian"
          emptyDescription="Tambahkan transaksi pembelian operasional."
          renderRow={(row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-700 inline-flex items-center gap-1"><CalendarDays className="w-4 h-4 text-slate-400" />{new Date(row.date).toLocaleDateString('id-ID')}</td>
              <td className="px-4 py-3 font-semibold text-slate-800">{row.vendor}</td>
              <td className="px-4 py-3 text-slate-700">{row.category}</td>
              <td className="px-4 py-3 text-slate-700">{row.description}</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupiah(row.amount)}</td>
              <td className="px-4 py-3 text-center"><Badge variant={statusMap[row.status].variant} size="sm">{statusMap[row.status].label}</Badge></td>
            </tr>
          )}
        />
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        <ModalBox className="max-w-2xl min-h-0">
          <ModalHeader title="Tambah Pembelian" subtitle="Catat transaksi pembelian dari sistem" onClose={() => setFormOpen(false)} icon={<ShoppingBag className="w-5 h-5" />} />
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Tanggal" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              <Input label="Vendor" value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} />
              <Input label="Kategori" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
              <CurrencyInput label="Nominal" value={form.amount} onChange={(value) => setForm((p) => ({ ...p, amount: value }))} />
              <Input label="Keterangan" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              <Autocomplete
                label="Status"
                value={form.status}
                onChange={(value) => setForm((p) => ({ ...p, status: value as PurchaseStatus }))}
                options={purchaseStatusOptions}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button
              onClick={() => {
                if (!form.date || !form.vendor || !form.category || !form.description || form.amount <= 0) return;
                setRows((prev) => {
                  const next = [{ id: `PUR-${String(prev.length + 1).padStart(3, '0')}`, ...form }, ...prev];
                  savePurchases(next);
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

export default PurchasesPage;
