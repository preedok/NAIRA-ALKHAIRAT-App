import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Eye, FileUp, Search, ShieldAlert, Wallet } from 'lucide-react';
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
import { formatRupiah } from '../../../utils/currency';

type ReconStatus = 'matched' | 'pending' | 'mismatch';
type ReconFlow = 'income' | 'expense';

type ReconItem = {
  id: string;
  flow: ReconFlow;
  bankName: string;
  transactionDate: string;
  referenceNo: string;
  counterpartName: string;
  systemDocNo?: string;
  systemAmount: number;
  bankAmount: number;
  status: ReconStatus;
  note?: string;
};

const STATUS_MAP: Record<ReconStatus, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  matched: { label: 'Matched', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  mismatch: { label: 'Mismatch', variant: 'error' }
};

const initialData: ReconItem[] = [
  {
    id: 'RCN-001',
    flow: 'income',
    bankName: 'BCA',
    transactionDate: '2026-04-14',
    referenceNo: 'TRX-774991',
    counterpartName: 'Ahmad Fauzi',
    systemDocNo: 'INV-2026-014',
    systemAmount: 3000000,
    bankAmount: 3000000,
    status: 'matched'
  },
  {
    id: 'RCN-002',
    flow: 'income',
    bankName: 'BSI',
    transactionDate: '2026-04-15',
    referenceNo: 'TRX-889122',
    counterpartName: 'Siti Rahma',
    systemDocNo: 'INV-2026-028',
    systemAmount: 2500000,
    bankAmount: 2500000,
    status: 'pending'
  },
  {
    id: 'RCN-003',
    flow: 'expense',
    bankName: 'Mandiri',
    transactionDate: '2026-04-15',
    referenceNo: 'TRX-889990',
    counterpartName: 'Hotel Zamzam',
    systemDocNo: 'BILL-2026-044',
    systemAmount: 1500000,
    bankAmount: 1400000,
    status: 'mismatch',
    note: 'Nominal pengeluaran bank berbeda dengan bukti pengeluaran sistem.'
  },
  {
    id: 'RCN-004',
    flow: 'expense',
    bankName: 'BCA',
    transactionDate: '2026-04-16',
    referenceNo: 'TRX-900123',
    counterpartName: 'Maskapai Saudi',
    systemDocNo: 'BILL-2026-051',
    systemAmount: 5200000,
    bankAmount: 5200000,
    status: 'matched'
  }
];

const columns: TableColumn[] = [
  { id: 'date', label: 'Tanggal Mutasi' },
  { id: 'flow', label: 'Arus', align: 'center' },
  { id: 'bank', label: 'Bank & Referensi' },
  { id: 'counterpart', label: 'Pihak Terkait' },
  { id: 'system', label: 'Sistem', align: 'right' },
  { id: 'bankAmount', label: 'Buku Koran', align: 'right' },
  { id: 'diff', label: 'Selisih', align: 'right' },
  { id: 'status', label: 'Status', align: 'center' },
  { id: 'action', label: 'Aksi', align: 'right' }
];

const BankReconciliationPage: React.FC = () => {
  const [rows, setRows] = useState<ReconItem[]>(initialData);
  const [flowFilter, setFlowFilter] = useState<'all' | ReconFlow>('all');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReconStatus>('all');
  const [detail, setDetail] = useState<ReconItem | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedAt, setUploadedAt] = useState<string>('');
  const flowOptions: SelectOption[] = [
    { value: 'income', label: 'Penerimaan' },
    { value: 'expense', label: 'Pengeluaran' }
  ];
  const statusOptions: SelectOption[] = [
    { value: 'matched', label: 'Matched' },
    { value: 'pending', label: 'Pending' },
    { value: 'mismatch', label: 'Mismatch' }
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const flowMatch = flowFilter === 'all' || row.flow === flowFilter;
      const queryMatch =
        q.length === 0 ||
        row.referenceNo.toLowerCase().includes(q) ||
        row.counterpartName.toLowerCase().includes(q) ||
        (row.systemDocNo || '').toLowerCase().includes(q);
      const statusMatch = statusFilter === 'all' || row.status === statusFilter;
      return queryMatch && statusMatch && flowMatch;
    });
  }, [rows, query, statusFilter, flowFilter]);

  const summary = useMemo(() => {
    const matched = rows.filter((x) => x.status === 'matched').length;
    const pending = rows.filter((x) => x.status === 'pending').length;
    const mismatch = rows.filter((x) => x.status === 'mismatch').length;
    const incomeSystem = rows.filter((x) => x.flow === 'income').reduce((sum, x) => sum + x.systemAmount, 0);
    const expenseSystem = rows.filter((x) => x.flow === 'expense').reduce((sum, x) => sum + x.systemAmount, 0);
    return { matched, pending, mismatch, incomeSystem, expenseSystem };
  }, [rows]);

  const markMatched = (item: ReconItem) => {
    setRows((prev) =>
      prev.map((x) =>
        x.id === item.id
          ? { ...x, status: 'matched', systemDocNo: x.systemDocNo || 'AUTO-MATCH', note: undefined }
          : x
      )
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Mutasi" value={rows.length} />
        <StatCard label="Matched" value={summary.matched} accentClassName="text-emerald-600" />
        <StatCard label="Penerimaan Sistem" value={formatRupiah(summary.incomeSystem)} />
        <StatCard label="Pengeluaran Sistem" value={formatRupiah(summary.expenseSystem)} />
      </div>

      <Card>
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 min-h-[96px] flex flex-col justify-between">
              <p className="text-xs text-slate-500">Upload Buku Koran (CSV/XLSX/PDF)</p>
              <label className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
                <FileUp className="w-4 h-4 text-slate-500" />
                <span>Pilih file</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadedFileName(file.name);
                    setUploadedAt(new Date().toLocaleString('id-ID'));
                  }}
                />
              </label>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 min-h-[96px] flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">File aktif</p>
                <p className="text-sm font-semibold text-slate-700 break-all">{uploadedFileName || 'Belum ada upload'}</p>
              </div>
              <FileUp className="w-4 h-4 text-slate-400" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 min-h-[96px] flex flex-col justify-center">
              <p className="text-xs text-slate-500">Waktu import</p>
              <p className="text-sm font-semibold text-slate-700">{uploadedAt || '-'}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:max-w-3xl">
              <Autocomplete
                value={flowFilter === 'all' ? '' : flowFilter}
                onChange={(value) => setFlowFilter((value || 'all') as 'all' | ReconFlow)}
                options={flowOptions}
                emptyLabel="Semua arus"
              />
              
            <Input
              ariaLabel="Cari transaksi bank"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              placeholder="Cari referensi, nama, invoice..."
            />
            <Autocomplete
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={(value) => setStatusFilter((value || 'all') as 'all' | ReconStatus)}
              options={statusOptions}
              emptyLabel="Semua status"
            />
            </div>
            <Badge variant="warning" size="sm">Pending: {summary.pending} | Mismatch: {summary.mismatch}</Badge>
          </div>
        </div>
      </Card>

      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          stickyActionsColumn
          emptyMessage="Tidak ada data rekonsiliasi"
          emptyDescription="Mutasi bank akan muncul di sini untuk dicocokkan dengan invoice."
          renderRow={(row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-700">{new Date(row.transactionDate).toLocaleDateString('id-ID')}</td>
              <td className="px-4 py-3 text-center">
                <Badge variant={row.flow === 'income' ? 'success' : 'info'} size="sm">
                  {row.flow === 'income' ? 'Penerimaan' : 'Pengeluaran'}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{row.bankName}</p>
                <p className="text-xs text-slate-500">{row.referenceNo}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{row.counterpartName}</td>
              <td className="px-4 py-3 text-right text-slate-800">{formatRupiah(row.systemAmount)}</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupiah(row.bankAmount)}</td>
              <td className={`px-4 py-3 text-right font-semibold ${(row.bankAmount - row.systemAmount) === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatRupiah(row.bankAmount - row.systemAmount)}
              </td>
              <td className="px-4 py-3 text-center">
                <Badge variant={STATUS_MAP[row.status].variant} size="sm">{STATUS_MAP[row.status].label}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="relative flex items-center justify-end">
                  <ActionMenu
                    menuWidthClass="w-[170px]"
                    items={[
                      { id: 'detail', label: 'Detail', icon: <Eye className="w-4 h-4" />, onClick: () => setDetail(row) },
                      ...(row.status !== 'matched'
                        ? [{
                            id: 'match',
                            label: 'Cocokkan',
                            icon: <CheckCircle2 className="w-4 h-4" />,
                            tone: 'success' as const,
                            onClick: () => markMatched(row)
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
          <ModalHeader title="Detail Rekonsiliasi" subtitle={detail?.id} onClose={() => setDetail(null)} />
          <ModalBody>
            {detail && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-500">Bank</p><p className="font-semibold">{detail.bankName}</p></div>
                  <div><p className="text-slate-500">Referensi</p><p className="font-semibold">{detail.referenceNo}</p></div>
                  <div><p className="text-slate-500">Arus</p><p className="font-semibold">{detail.flow === 'income' ? 'Penerimaan' : 'Pengeluaran'}</p></div>
                  <div><p className="text-slate-500">Pihak Terkait</p><p className="font-semibold">{detail.counterpartName}</p></div>
                  <div><p className="text-slate-500">Nominal Sistem</p><p className="font-semibold">{formatRupiah(detail.systemAmount)}</p></div>
                  <div><p className="text-slate-500">Nominal Bank</p><p className="font-semibold">{formatRupiah(detail.bankAmount)}</p></div>
                  <div><p className="text-slate-500">Dokumen Sistem</p><p className="font-semibold">{detail.systemDocNo || '-'}</p></div>
                  <div><p className="text-slate-500">Status</p><Badge variant={STATUS_MAP[detail.status].variant} size="sm">{STATUS_MAP[detail.status].label}</Badge></div>
                </div>
                {detail.note ? (
                  <Card className="bg-amber-50 border-amber-100">
                    <p className="text-sm text-amber-700 inline-flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" />
                      {detail.note}
                    </p>
                  </Card>
                ) : (
                  <Card className="bg-emerald-50 border-emerald-100">
                    <p className="text-sm text-emerald-700 inline-flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Transaksi sesuai dengan invoice.
                    </p>
                  </Card>
                )}
                <Card className="bg-slate-50 border-slate-200">
                  <p className="text-sm text-slate-600 inline-flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Pastikan referensi transfer cocok sebelum finalisasi rekonsiliasi.
                  </p>
                </Card>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setDetail(null)}>Tutup</Button>
            {detail && detail.status !== 'matched' && (
              <Button
                onClick={() => {
                  markMatched(detail);
                  setDetail(null);
                }}
                icon={<Clock3 className="w-4 h-4" />}
              >
                Tandai Matched
              </Button>
            )}
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default BankReconciliationPage;
