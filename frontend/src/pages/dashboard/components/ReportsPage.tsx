import React, { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Download, Search, TrendingUp, Wallet } from 'lucide-react';
import Card from '../../../components/common/Card';
import Table from '../../../components/common/Table';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import { SelectOption, TableColumn } from '../../../types';
import { formatRupiah } from '../../../utils/currency';

type ReportStatus = 'excellent' | 'good' | 'warning';

type BranchReport = {
  id: string;
  branchName: string;
  period: string;
  totalJamaah: number;
  paidJamaah: number;
  omzet: number;
  installmentCollected: number;
  occupancy: number;
  status: ReportStatus;
};

const STATUS_MAP: Record<ReportStatus, { label: string; variant: 'success' | 'info' | 'warning' }> = {
  excellent: { label: 'Excellent', variant: 'success' },
  good: { label: 'Good', variant: 'info' },
  warning: { label: 'Needs Attention', variant: 'warning' }
};

const reportRows: BranchReport[] = [
  {
    id: 'RPT-001',
    branchName: 'Pusat Jakarta',
    period: '2026-04',
    totalJamaah: 124,
    paidJamaah: 108,
    omzet: 4820000000,
    installmentCollected: 930000000,
    occupancy: 88,
    status: 'excellent'
  },
  {
    id: 'RPT-002',
    branchName: 'Cabang Surabaya',
    period: '2026-04',
    totalJamaah: 92,
    paidJamaah: 73,
    omzet: 3110000000,
    installmentCollected: 610000000,
    occupancy: 76,
    status: 'good'
  },
  {
    id: 'RPT-003',
    branchName: 'Cabang Bandung',
    period: '2026-04',
    totalJamaah: 67,
    paidJamaah: 42,
    omzet: 1980000000,
    installmentCollected: 340000000,
    occupancy: 61,
    status: 'warning'
  },
  {
    id: 'RPT-004',
    branchName: 'Cabang Makassar',
    period: '2026-04',
    totalJamaah: 58,
    paidJamaah: 44,
    omzet: 1760000000,
    installmentCollected: 290000000,
    occupancy: 72,
    status: 'good'
  }
];

const columns: TableColumn[] = [
  { id: 'branch', label: 'Cabang' },
  { id: 'jamaah', label: 'Jamaah', align: 'center' },
  { id: 'omzet', label: 'Omzet', align: 'right' },
  { id: 'installment', label: 'Cicilan Terkumpul', align: 'right' },
  { id: 'occupancy', label: 'Occupancy', align: 'center' },
  { id: 'status', label: 'Status', align: 'center' }
];

const reportStatusOptions: SelectOption[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'warning', label: 'Needs Attention' }
];

const ReportsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('2026-04');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reportRows.filter((row) => {
      const queryMatch = q.length === 0 || row.branchName.toLowerCase().includes(q);
      const periodMatch = row.period === period;
      const statusMatch = statusFilter === 'all' || row.status === statusFilter;
      return queryMatch && periodMatch && statusMatch;
    });
  }, [period, query, statusFilter]);

  const summary = useMemo(() => {
    const totalOmzet = filtered.reduce((sum, row) => sum + row.omzet, 0);
    const totalInstallment = filtered.reduce((sum, row) => sum + row.installmentCollected, 0);
    const totalJamaah = filtered.reduce((sum, row) => sum + row.totalJamaah, 0);
    const totalPaidJamaah = filtered.reduce((sum, row) => sum + row.paidJamaah, 0);
    const avgOccupancy = filtered.length
      ? Math.round(filtered.reduce((sum, row) => sum + row.occupancy, 0) / filtered.length)
      : 0;
    const paymentRate = totalJamaah ? Math.round((totalPaidJamaah / totalJamaah) * 100) : 0;
    return { totalOmzet, totalInstallment, totalJamaah, paymentRate, avgOccupancy };
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-stone-500">Total Omzet</p>
          <p className="text-2xl font-bold mt-1">{formatRupiah(summary.totalOmzet)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Cicilan Terkumpul</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{formatRupiah(summary.totalInstallment)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Payment Rate</p>
          <p className="text-2xl font-bold mt-1 text-primary-700">{summary.paymentRate}%</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Rata-rata Occupancy</p>
          <p className="text-2xl font-bold mt-1">{summary.avgOccupancy}%</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:max-w-3xl">
            <Input
              ariaLabel="Cari cabang report"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              placeholder="Cari nama cabang..."
            />
            <Input
              ariaLabel="Pilih periode"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              icon={<CalendarDays className="w-4 h-4" />}
            />
            <Autocomplete
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={(value) => setStatusFilter((value || 'all') as 'all' | ReportStatus)}
              options={reportStatusOptions}
              emptyLabel="Semua status"
            />
          </div>
          <Button variant="outline" icon={<Download className="w-4 h-4" />}>
            Export Report
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padding="none">
          <Table
            columns={columns}
            data={filtered}
            emptyMessage="Data report tidak ditemukan"
            emptyDescription="Coba ganti periode atau filter status."
            renderRow={(row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{row.branchName}</p>
                  <p className="text-xs text-slate-500">Periode {row.period}</p>
                </td>
                <td className="px-4 py-3 text-center text-slate-700">{row.paidJamaah}/{row.totalJamaah}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupiah(row.omzet)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatRupiah(row.installmentCollected)}</td>
                <td className="px-4 py-3 text-center text-slate-700">{row.occupancy}%</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={STATUS_MAP[row.status].variant} size="sm">{STATUS_MAP[row.status].label}</Badge>
                </td>
              </tr>
            )}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <p className="text-sm text-stone-500 inline-flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Insight Performa
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>- Cabang dengan performa tertinggi: <span className="font-semibold">Pusat Jakarta</span>.</li>
              <li>- Payment rate keseluruhan sudah di atas <span className="font-semibold">75%</span>.</li>
              <li>- Fokus perbaikan: follow-up cicilan Cabang Bandung.</li>
            </ul>
          </Card>

          <Card>
            <p className="text-sm text-stone-500 inline-flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Komposisi Pendapatan
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Omzet Paket</span>
                  <span>{summary.totalOmzet ? Math.round((summary.totalOmzet / (summary.totalOmzet + summary.totalInstallment)) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-600 rounded-full" style={{ width: `${summary.totalOmzet ? Math.round((summary.totalOmzet / (summary.totalOmzet + summary.totalInstallment)) * 100) : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Pembayaran Cicilan</span>
                  <span>{summary.totalInstallment ? Math.round((summary.totalInstallment / (summary.totalOmzet + summary.totalInstallment)) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${summary.totalInstallment ? Math.round((summary.totalInstallment / (summary.totalOmzet + summary.totalInstallment)) * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-sm text-stone-500 inline-flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Rekomendasi Cepat
            </p>
            <p className="mt-3 text-sm text-slate-700">
              Tingkatkan reminder otomatis H-3 jatuh tempo dan optimalkan campaign untuk cabang occupancy di bawah 70%.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
