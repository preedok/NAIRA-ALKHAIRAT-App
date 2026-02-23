import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ChevronLeft, Plus, Settings, Users, FileText, Calendar } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { accountingApi, branchesApi, type PayrollRunData } from '../../../services/api';
import { formatIDR } from '../../../utils';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const PayrollRunsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<PayrollRunData[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createBranchId, setCreateBranchId] = useState<string>('');
  const [createYear, setCreateYear] = useState(new Date().getFullYear());
  const [createMonth, setCreateMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    branchesApi.list({ limit: 500 }).then((r) => { if (r.data.success) setBranches(r.data.data || []); }).catch(() => {});
  }, []);

  const fetchRuns = () => {
    setLoading(true);
    const params: { branch_id?: string; period_year?: number; period_month?: number; status?: string; page: number; limit: number } = { page, limit };
    if (branchId) params.branch_id = branchId;
    if (periodYear) params.period_year = periodYear;
    if (periodMonth) params.period_month = periodMonth;
    if (statusFilter) params.status = statusFilter;
    accountingApi.payroll.listRuns(params)
      .then((r) => {
        if (r.data.success) setRuns(r.data.data || []);
        const pag = (r.data as { pagination?: typeof pagination }).pagination;
        setPagination(pag || null);
      })
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRuns();
  }, [branchId, periodYear, periodMonth, statusFilter, page]);

  const handleCreateRun = async () => {
    setCreating(true);
    try {
      const res = await accountingApi.payroll.createRun({
        period_month: createMonth,
        period_year: createYear,
        branch_id: createBranchId || undefined
      });
      if (res.data.success && res.data.data?.id) {
        setShowCreateModal(false);
        navigate(`/dashboard/accounting/payroll/runs/${res.data.data.id}`);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal membuat payroll');
    } finally {
      setCreating(false);
    }
  };

  const statusLabel = (s: string) => {
    if (s === 'draft') return 'Draft';
    if (s === 'processed') return 'Diproses';
    if (s === 'finalized') return 'Final';
    return s;
  };

  const statusColor = (s: string) => {
    if (s === 'draft') return 'bg-amber-100 text-amber-800';
    if (s === 'finalized') return 'bg-emerald-100 text-emerald-800';
    return 'bg-slate-100 text-slate-700';
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-emerald-600" />
            Penggajian
          </h1>
          <p className="text-slate-600 mt-1">Buat dan kelola run payroll per periode; finalisasi untuk generate slip dan notifikasi</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/accounting/payroll/settings')}>
          <Settings className="w-4 h-4 mr-1" />
          Pengaturan
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/accounting/payroll/employees')}>
          <Users className="w-4 h-4 mr-1" />
          Karyawan & Gaji
        </Button>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Buat Payroll Baru
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cabang</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Semua</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tahun</label>
            <select value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bulan</label>
            <select value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Semua</option>
              <option value="draft">Draft</option>
              <option value="processed">Diproses</option>
              <option value="finalized">Final</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500 py-8 text-center">Memuat...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="pb-2 pr-4">Periode</th>
                  <th className="pb-2 pr-4">Cabang</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Metode</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2 pr-4">Dibuat</th>
                  <th className="pb-2 pr-4 w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium">
                      <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {MONTH_NAMES[run.period_month - 1]} {run.period_year}</span>
                    </td>
                    <td className="py-3 pr-4">{run.Branch ? `${run.Branch.code} - ${run.Branch.name}` : 'Global'}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColor(run.status)}`}>
                        {statusLabel(run.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{run.method === 'scheduled' ? 'Terjadwal' : 'Manual'}</td>
                    <td className="py-3 pr-4">{formatIDR(run.total_amount || 0)}</td>
                    <td className="py-3 pr-4 text-slate-600">{run.CreatedBy?.name || '-'}</td>
                    <td className="py-3 pr-4">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/accounting/payroll/runs/${run.id}`)}>
                        <FileText className="w-4 h-4 mr-1" /> Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {runs.length === 0 && <p className="text-slate-500 py-8 text-center">Belum ada run payroll</p>}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600">Total {pagination.total} run</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
              <span className="py-1 px-2 text-sm">Hal {page} / {pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Selanjutnya</Button>
            </div>
          </div>
        )}
      </Card>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !creating && setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Buat Payroll Baru</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cabang</label>
                <select value={createBranchId} onChange={(e) => setCreateBranchId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Global (semua cabang)</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tahun</label>
                  <select value={createYear} onChange={(e) => setCreateYear(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bulan</label>
                  <select value={createMonth} onChange={(e) => setCreateMonth(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={creating}>Batal</Button>
              <Button onClick={handleCreateRun} disabled={creating}>{creating ? 'Membuat...' : 'Buat'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollRunsPage;
