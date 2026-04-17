import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Eye, Plus, Search, Wallet } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import ActionMenu from '../../../components/common/ActionMenu';
import StatCard from '../../../components/common/StatCard';
import Modal, { ModalBody, ModalBox, ModalFooter, ModalHeader } from '../../../components/common/Modal';
import { SelectOption, TableColumn } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { formatRupiah } from '../../../utils/currency';

type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

type InvoiceItem = {
  id: string;
  invoiceNo: string;
  jamaahName: string;
  packageName: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  note?: string;
};

type OrderForm = {
  packageName: string;
  note: string;
};

const STATUS_MAP: Record<InvoiceStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  paid: { label: 'Lunas', variant: 'success' },
  partial: { label: 'Sebagian', variant: 'warning' },
  unpaid: { label: 'Belum Bayar', variant: 'default' },
  overdue: { label: 'Terlambat', variant: 'error' }
};

const initialInvoices: InvoiceItem[] = [
  {
    id: 'INVROW-001',
    invoiceNo: 'INV-2026-014',
    jamaahName: 'Ahmad Fauzi',
    packageName: 'Umroh Ramadhan Premium',
    issueDate: '2026-04-10',
    dueDate: '2026-04-20',
    totalAmount: 35000000,
    paidAmount: 20000000,
    status: 'partial',
    note: 'Cicilan berjalan'
  },
  {
    id: 'INVROW-002',
    invoiceNo: 'INV-2026-028',
    jamaahName: 'Siti Rahma',
    packageName: 'Umroh Plus Turki',
    issueDate: '2026-04-11',
    dueDate: '2026-04-22',
    totalAmount: 38900000,
    paidAmount: 38900000,
    status: 'paid'
  },
  {
    id: 'INVROW-003',
    invoiceNo: 'INV-2026-031',
    jamaahName: 'Budi Santoso',
    packageName: 'Umroh Liburan',
    issueDate: '2026-04-13',
    dueDate: '2026-04-18',
    totalAmount: 29900000,
    paidAmount: 0,
    status: 'overdue',
    note: 'Butuh follow up pembayaran'
  }
];

const PACKAGE_PRICE_MAP: Record<string, number> = {
  'Umroh Ramadhan Premium': 35000000,
  'Umroh Plus Turki': 38900000,
  'Umroh Liburan': 29900000,
  'Umroh Awal Musim': 31500000
};

const columns: TableColumn[] = [
  { id: 'invoice', label: 'No Invoice' },
  { id: 'jamaah', label: 'Jamaah' },
  { id: 'schedule', label: 'Tanggal' },
  { id: 'amount', label: 'Tagihan', align: 'right' },
  { id: 'paid', label: 'Terbayar', align: 'right' },
  { id: 'remaining', label: 'Sisa Tagihan', align: 'right' },
  { id: 'status', label: 'Status', align: 'center' },
  { id: 'action', label: 'Aksi', align: 'right' }
];

const OrdersInvoicesPage: React.FC = () => {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'jamaah';
  const [rows, setRows] = useState<InvoiceItem[]>(initialInvoices);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [detail, setDetail] = useState<InvoiceItem | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>({
    packageName: '',
    note: ''
  });
  const statusOptions: SelectOption[] = [
    { value: 'paid', label: 'Lunas' },
    { value: 'partial', label: 'Sebagian' },
    { value: 'unpaid', label: 'Belum Bayar' },
    { value: 'overdue', label: 'Terlambat' }
  ];
  const packageOptions: SelectOption[] = Object.keys(PACKAGE_PRICE_MAP).map((name) => ({ value: name, label: name }));
  const registrationProfile = useMemo(() => {
    try {
      const raw = localStorage.getItem('jamaah_registration_profile');
      if (!raw) return null;
      return JSON.parse(raw) as {
        name?: string;
        email?: string;
        phone?: string;
        whatsapp?: string;
        ktp?: {
          fullName?: string;
          nik?: string;
          birthPlace?: string;
          birthDate?: string;
          address?: string;
        };
      };
    } catch {
      return null;
    }
  }, []);

  const autoOrderIdentity = useMemo(() => {
    return {
      name: registrationProfile?.ktp?.fullName || registrationProfile?.name || user?.name || '-',
      email: user?.email || registrationProfile?.email || '-',
      phone: user?.phone || registrationProfile?.phone || registrationProfile?.whatsapp || '-',
      nik: registrationProfile?.ktp?.nik || '-',
      birthPlace: registrationProfile?.ktp?.birthPlace || '-',
      birthDate: registrationProfile?.ktp?.birthDate || '-',
      address: registrationProfile?.ktp?.address || '-'
    };
  }, [registrationProfile, user?.email, user?.name, user?.phone]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((item) => {
      const queryMatch =
        q.length === 0 ||
        item.invoiceNo.toLowerCase().includes(q) ||
        item.jamaahName.toLowerCase().includes(q) ||
        item.packageName.toLowerCase().includes(q);
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      return queryMatch && statusMatch;
    });
  }, [rows, query, statusFilter]);

  const summary = useMemo(() => {
    const totalInvoice = rows.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalPaid = rows.reduce((sum, item) => sum + item.paidAmount, 0);
    const outstanding = totalInvoice - totalPaid;
    const overdueCount = rows.filter((x) => x.status === 'overdue').length;
    return { totalInvoice, totalPaid, outstanding, overdueCount };
  }, [rows]);

  const markAsPaid = (id: string) => {
    setRows((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, paidAmount: item.totalAmount, status: 'paid', note: 'Dilunasi via konfirmasi admin' }
          : item
      )
    );
  };

  const submitOrder = () => {
    if (!orderForm.packageName) return;
    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + 10);
    const totalAmount = PACKAGE_PRICE_MAP[orderForm.packageName] ?? 0;
    const seq = rows.length + 1;
    const createdInvoice: InvoiceItem = {
      id: `INVROW-${String(seq).padStart(3, '0')}`,
      invoiceNo: `INV-${now.getFullYear()}-${String(100 + seq)}`,
      jamaahName: autoOrderIdentity.name !== '-' ? autoOrderIdentity.name : (user?.name || 'Jamaah'),
      packageName: orderForm.packageName,
      issueDate: now.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      totalAmount,
      paidAmount: 0,
      status: 'unpaid',
      note: orderForm.note || 'Order dibuat berdasarkan dokumen terverifikasi saat registrasi'
    };
    setRows((prev) => [createdInvoice, ...prev]);
    setOrderForm({
      packageName: '',
      note: ''
    });
    setOrderOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Tagihan" value={formatRupiah(summary.totalInvoice)} />
        <StatCard label="Total Terbayar" value={formatRupiah(summary.totalPaid)} accentClassName="text-emerald-600" />
        <StatCard label="Outstanding" value={formatRupiah(summary.outstanding)} accentClassName="text-amber-600" />
        <StatCard label="Invoice Terlambat" value={summary.overdueCount} accentClassName="text-red-600" />
      </div>

      <Card>
        <div className={`grid grid-cols-1 gap-3 ${isReadOnly ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2">
            <Input
              ariaLabel="Cari invoice"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              placeholder="Cari invoice, jamaah, atau paket..."
            />
            <Autocomplete
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={(value) => setStatusFilter((value || 'all') as 'all' | InvoiceStatus)}
              options={statusOptions}
              emptyLabel="Semua status"
            />
          </div>
          {isReadOnly ? (
            <Button
              icon={<Plus className="w-4 h-4" />}
              className="w-full lg:w-auto lg:justify-self-end"
              onClick={() => setOrderOpen(true)}
            >
              Buat Order
            </Button>
          ) : (
            <Button icon={<Plus className="w-4 h-4" />} className="w-full lg:w-auto lg:justify-self-end">
              Buat Invoice
            </Button>
          )}
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          stickyActionsColumn
          emptyMessage="Belum ada data invoice"
          emptyDescription="Data invoice akan tampil setelah pembuatan order."
          renderRow={(item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{item.invoiceNo}</p>
                <p className="text-xs text-slate-500">{item.packageName}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{item.jamaahName}</td>
              <td className="px-4 py-3">
                <p className="text-sm text-slate-700 inline-flex items-center gap-1">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  {new Date(item.issueDate).toLocaleDateString('id-ID')}
                </p>
                <p className="text-xs text-slate-500 mt-1">Jatuh tempo: {new Date(item.dueDate).toLocaleDateString('id-ID')}</p>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupiah(item.totalAmount)}</td>
              <td className="px-4 py-3 text-right text-slate-700">{formatRupiah(item.paidAmount)}</td>
              <td className={`px-4 py-3 text-right font-semibold ${(item.totalAmount - item.paidAmount) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {formatRupiah(item.totalAmount - item.paidAmount)}
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant={STATUS_MAP[item.status].variant} size="sm">{STATUS_MAP[item.status].label}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="relative flex items-center justify-end">
                  <ActionMenu
                    items={[
                      { id: 'detail', label: 'Detail', icon: <Eye className="w-4 h-4" />, onClick: () => setDetail(item) },
                      ...(!isReadOnly && item.status !== 'paid'
                        ? [{
                            id: 'mark-paid',
                            label: 'Tandai Lunas',
                            icon: <CheckCircle2 className="w-4 h-4" />,
                            tone: 'success' as const,
                            onClick: () => markAsPaid(item.id)
                          }]
                        : [])
                    ]}
                  />
                </div>
              </td>
            </tr>
          )}
        />
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)}>
        <ModalBox className="max-w-2xl min-h-0">
          <ModalHeader title="Detail Invoice" subtitle={detail?.invoiceNo} onClose={() => setDetail(null)} />
          <ModalBody>
            {detail && (
              <div className="rounded-2xl border border-stone-200 bg-white p-4 md:p-6 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice Umroh</p>
                    <p className="text-lg font-bold text-slate-900">{detail.invoiceNo}</p>
                    <p className="text-sm text-slate-600">{detail.jamaahName}</p>
                  </div>
                  <Badge variant={STATUS_MAP[detail.status].variant}>{STATUS_MAP[detail.status].label}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-stone-200 p-3">
                    <p className="text-slate-500">Paket</p>
                    <p className="font-semibold text-slate-900">{detail.packageName}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 p-3">
                    <p className="text-slate-500">Tanggal Terbit</p>
                    <p className="font-semibold text-slate-900">{new Date(detail.issueDate).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 p-3">
                    <p className="text-slate-500">Jatuh Tempo</p>
                    <p className="font-semibold text-slate-900">{new Date(detail.dueDate).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 p-3">
                    <p className="text-slate-500">Metode Pembayaran</p>
                    <p className="font-semibold text-slate-900">Transfer Bank</p>
                  </div>
                </div>
                <div className="rounded-xl border border-stone-200 overflow-hidden">
                  <div className="grid grid-cols-2 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <p>Rincian</p>
                    <p className="text-right">Nominal</p>
                  </div>
                  <div className="grid grid-cols-2 px-4 py-2 text-sm">
                    <p>Tagihan paket {detail.packageName}</p>
                    <p className="text-right font-semibold">{formatRupiah(detail.totalAmount)}</p>
                  </div>
                  <div className="grid grid-cols-2 px-4 py-2 text-sm border-t border-stone-200">
                    <p>Sudah dibayar</p>
                    <p className="text-right text-emerald-700 font-semibold">{formatRupiah(detail.paidAmount)}</p>
                  </div>
                  <div className="grid grid-cols-2 px-4 py-3 text-sm border-t border-stone-200 bg-amber-50/60">
                    <p className="font-semibold inline-flex items-center gap-2"><Wallet className="w-4 h-4" /> Sisa tagihan</p>
                    <p className="text-right font-bold text-amber-700">{formatRupiah(detail.totalAmount - detail.paidAmount)}</p>
                  </div>
                </div>
                {detail.note && <p className="text-sm text-slate-600">Catatan: {detail.note}</p>}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setDetail(null)}>Tutup</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>

      <Modal open={orderOpen} onClose={() => setOrderOpen(false)}>
        <ModalBox className="max-w-2xl min-h-0">
          <ModalHeader title="Buat Order Saya" subtitle="Per akun hanya untuk 1 jamaah terverifikasi" onClose={() => setOrderOpen(false)} />
          <ModalBody>
            <div className="grid grid-cols-1 gap-3">
              <Card className="bg-slate-50 border-slate-200">
                <p className="text-sm text-slate-700">
                  Jamaah akun ini: <span className="font-semibold">{autoOrderIdentity.name}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Data order otomatis terisi dari data registrasi akun dan verifikasi KTP.
                </p>
              </Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Nama Jamaah" value={autoOrderIdentity.name} readOnly />
                <Input label="Email" value={autoOrderIdentity.email} readOnly />
                <Input label="Nomor HP / WhatsApp" value={autoOrderIdentity.phone} readOnly />
                <Input label="NIK" value={autoOrderIdentity.nik} readOnly />
                <Input label="Tempat Lahir" value={autoOrderIdentity.birthPlace} readOnly />
                <Input label="Tanggal Lahir" value={autoOrderIdentity.birthDate} readOnly />
              </div>
              <Input label="Alamat (KTP)" value={autoOrderIdentity.address} readOnly />
              <Autocomplete
                label="Pilih Paket"
                value={orderForm.packageName}
                onChange={(value) => setOrderForm((p) => ({ ...p, packageName: value }))}
                options={packageOptions}
              />
              <Input
                label="Catatan (opsional)"
                value={orderForm.note}
                onChange={(e) => setOrderForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Contoh: request kamar family"
              />
              {orderForm.packageName && (
                <Card className="bg-slate-50 border-slate-200">
                  <p className="text-sm text-slate-600">
                    Estimasi total tagihan (1 jamaah):{' '}
                    <span className="font-semibold text-slate-900">
                      {formatRupiah(PACKAGE_PRICE_MAP[orderForm.packageName] ?? 0)}
                    </span>
                  </p>
                </Card>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setOrderOpen(false)}>Batal</Button>
            <Button onClick={submitOrder}>Simpan Order</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default OrdersInvoicesPage;
