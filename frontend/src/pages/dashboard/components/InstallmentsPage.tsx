import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Eye, Search, Wallet } from 'lucide-react';
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

type InstallmentStatus = 'paid' | 'due_soon' | 'overdue';

type InstallmentItem = {
  id: string;
  jamaahName: string;
  packageName: string;
  dueDate: string;
  amount: number;
  paidAt?: string;
  status: InstallmentStatus;
  method?: string;
  note?: string;
};

const INSTALLMENT_STATUS: Record<InstallmentStatus, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  paid: { label: 'Lunas', variant: 'success' },
  due_soon: { label: 'Jatuh Tempo', variant: 'warning' },
  overdue: { label: 'Terlambat', variant: 'error' }
};

const initialInstallments: InstallmentItem[] = [
  {
    id: 'INS-001',
    jamaahName: 'Ahmad Fauzi',
    packageName: 'Umroh Ramadhan Premium',
    dueDate: '2026-05-12',
    amount: 3000000,
    status: 'due_soon',
    note: 'Cicilan ke-2'
  },
  {
    id: 'INS-002',
    jamaahName: 'Siti Rahma',
    packageName: 'Umroh Plus Turki',
    dueDate: '2026-04-01',
    amount: 3500000,
    status: 'overdue',
    note: 'Cicilan ke-3'
  },
  {
    id: 'INS-003',
    jamaahName: 'Budi Santoso',
    packageName: 'Umroh Liburan Keluarga',
    dueDate: '2026-03-10',
    amount: 4000000,
    status: 'paid',
    paidAt: '2026-03-08',
    method: 'Transfer VA',
    note: 'Pelunasan'
  },
  {
    id: 'INS-004',
    jamaahName: 'Maya Fitri',
    packageName: 'Umroh Awal Musim',
    dueDate: '2026-05-20',
    amount: 2500000,
    status: 'due_soon',
    note: 'Cicilan ke-1'
  }
];

const columns: TableColumn[] = [
  { id: 'jamaah', label: 'Jamaah' },
  { id: 'package', label: 'Paket' },
  { id: 'dueDate', label: 'Jatuh Tempo' },
  { id: 'amount', label: 'Nominal', align: 'right' },
  { id: 'status', label: 'Status', align: 'center' },
  { id: 'action', label: 'Aksi', align: 'right' }
];

const InstallmentsPage: React.FC = () => {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'jamaah';
  const [installments, setInstallments] = useState<InstallmentItem[]>(initialInstallments);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InstallmentStatus>('all');
  const [detailItem, setDetailItem] = useState<InstallmentItem | null>(null);
  const statusOptions: SelectOption[] = [
    { value: 'paid', label: 'Lunas' },
    { value: 'due_soon', label: 'Jatuh Tempo' },
    { value: 'overdue', label: 'Terlambat' }
  ];

  const scopedInstallments = useMemo(() => {
    if (!isReadOnly) return installments;
    const currentUserName = (user?.name || '').trim().toLowerCase();
    if (!currentUserName) return [];
    return installments.filter((item) => item.jamaahName.trim().toLowerCase() === currentUserName);
  }, [installments, isReadOnly, user?.name]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedInstallments.filter((item) => {
      const queryMatch =
        q.length === 0 ||
        item.jamaahName.toLowerCase().includes(q) ||
        item.packageName.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      return queryMatch && statusMatch;
    });
  }, [scopedInstallments, query, statusFilter]);

  const stats = useMemo(() => {
    const paid = scopedInstallments.filter((x) => x.status === 'paid').length;
    const dueSoon = scopedInstallments.filter((x) => x.status === 'due_soon').length;
    const overdue = scopedInstallments.filter((x) => x.status === 'overdue').length;
    const totalAmount = scopedInstallments.reduce((sum, x) => sum + x.amount, 0);
    return { paid, dueSoon, overdue, totalAmount };
  }, [scopedInstallments]);

  const markAsPaid = (id: string) => {
    setInstallments((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: 'paid', paidAt: new Date().toISOString().slice(0, 10), method: 'Konfirmasi Admin' }
          : item
      )
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Nominal Cicilan" value={formatRupiah(stats.totalAmount)} />
        <StatCard label="Sudah Lunas" value={stats.paid} accentClassName="text-emerald-600" />
        <StatCard label="Jatuh Tempo" value={stats.dueSoon} accentClassName="text-amber-600" />
        <StatCard label="Terlambat" value={stats.overdue} accentClassName="text-red-600" />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            ariaLabel="Cari cicilan"
            placeholder="Cari jamaah, paket, atau ID cicilan"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
          <Autocomplete
            value={statusFilter === 'all' ? '' : statusFilter}
            onChange={(value) => setStatusFilter((value || 'all') as 'all' | InstallmentStatus)}
            options={statusOptions}
            emptyLabel="Semua status"
          />
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          emptyMessage="Belum ada data cicilan"
          emptyDescription="Data cicilan akan muncul setelah invoice dibuat."
          stickyActionsColumn
          renderRow={(item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{item.jamaahName}</p>
                <p className="text-xs text-slate-500">{item.id}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{item.packageName}</td>
              <td className="px-4 py-3">
                <div className="inline-flex items-center gap-1 text-slate-700 text-sm">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  {new Date(item.dueDate).toLocaleDateString('id-ID')}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupiah(item.amount)}</td>
              <td className="px-4 py-3 text-center">
                <Badge variant={INSTALLMENT_STATUS[item.status].variant} size="sm">
                  {INSTALLMENT_STATUS[item.status].label}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="relative flex items-center justify-end">
                  <ActionMenu
                    items={[
                      { id: 'detail', label: 'Detail', icon: <Eye className="w-4 h-4" />, onClick: () => setDetailItem(item) },
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
                    menuWidthClass="w-[180px]"
                  />
                </div>
              </td>
            </tr>
          )}
        />
      </Card>

      <Modal open={!!detailItem} onClose={() => setDetailItem(null)}>
        <ModalBox className="max-w-2xl min-h-0">
          <ModalHeader title="Detail Cicilan" subtitle={detailItem?.id} onClose={() => setDetailItem(null)} />
          <ModalBody>
            {detailItem && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-500">Nama Jamaah</p><p className="font-semibold">{detailItem.jamaahName}</p></div>
                  <div><p className="text-slate-500">Paket</p><p className="font-semibold">{detailItem.packageName}</p></div>
                  <div><p className="text-slate-500">Jatuh Tempo</p><p className="font-semibold">{new Date(detailItem.dueDate).toLocaleDateString('id-ID')}</p></div>
                  <div><p className="text-slate-500">Nominal</p><p className="font-semibold">{formatRupiah(detailItem.amount)}</p></div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <Badge variant={INSTALLMENT_STATUS[detailItem.status].variant} size="sm">{INSTALLMENT_STATUS[detailItem.status].label}</Badge>
                  </div>
                  <div><p className="text-slate-500">Metode Bayar</p><p className="font-semibold">{detailItem.method || '-'}</p></div>
                </div>
                {detailItem.paidAt && (
                  <Card className="bg-emerald-50 border-emerald-100">
                    <p className="text-sm text-emerald-700 inline-flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      Dibayar pada {new Date(detailItem.paidAt).toLocaleDateString('id-ID')}
                    </p>
                  </Card>
                )}
                {!detailItem.paidAt && (
                  <Card className="bg-amber-50 border-amber-100">
                    <p className="text-sm text-amber-700 inline-flex items-center gap-2">
                      <Clock3 className="w-4 h-4" />
                      Belum ada konfirmasi pembayaran.
                    </p>
                  </Card>
                )}
                <p className="text-sm text-slate-600">Catatan: {detailItem.note || '-'}</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setDetailItem(null)}>Tutup</Button>
            {!isReadOnly && detailItem?.status !== 'paid' && (
              <Button
                onClick={() => {
                  if (detailItem) markAsPaid(detailItem.id);
                  setDetailItem(null);
                }}
              >
                Konfirmasi Bayar
              </Button>
            )}
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default InstallmentsPage;
