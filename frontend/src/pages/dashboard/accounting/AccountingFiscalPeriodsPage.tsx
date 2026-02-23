import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Plus,
  Filter,
  Search,
  X,
  LockKeyhole
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import {
  accountingApi,
  type FiscalYearItem,
  type AccountingPeriodItem
} from '../../../services/api';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const formatDate = (d: string) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const AccountingFiscalPeriodsPage: React.FC = () => {
  const [fiscalYears, setFiscalYears] = useState<FiscalYearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed'>('all');
  const [filterPeriodLock, setFilterPeriodLock] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [modalCreate, setModalCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ code: '', name: '', start_date: '', end_date: '' });
  const [createError, setCreateError] = useState('');

  const fetchFiscalYears = useCallback(async () => {
    setLoading(true);
    try {
      const params: { is_closed?: string; search?: string } = {};
      if (filterStatus === 'active') params.is_closed = 'false';
      else if (filterStatus === 'closed') params.is_closed = 'true';
      if (search.trim()) params.search = search.trim();
      const res = await accountingApi.getFiscalYears(params);
      if (res.data.success) {
        const data = res.data.data || [];
        setFiscalYears(data);
        if (data.length > 0 && expandedIds.size === 0) setExpandedIds(new Set([data[0].id]));
      } else setFiscalYears([]);
    } catch {
      setFiscalYears([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => {
    fetchFiscalYears();
  }, [fetchFiscalYears]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredYears = fiscalYears.filter((y) => {
    if (filterPeriodLock === 'all') return true;
    const periods = y.Periods || [];
    if (filterPeriodLock === 'locked') return periods.some((p) => p.is_locked);
    return periods.some((p) => !p.is_locked);
  });

  const getErrorMessage = (e: any, fallback: string) => {
    const data = e?.response?.data;
    const msg = data?.message || fallback;
    const path = data?.path;
    if (path) return `${msg}\n\nRequest: ${path}`;
    return msg;
  };

  const handleLockPeriod = async (period: AccountingPeriodItem) => {
    if (period.is_locked) return;
    setActionLoading(period.id);
    try {
      await accountingApi.lockPeriod(period.id);
      await fetchFiscalYears();
    } catch (e: any) {
      alert(getErrorMessage(e, 'Gagal mengunci periode'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlockPeriod = async (period: AccountingPeriodItem) => {
    if (!period.is_locked) return;
    if (!window.confirm('Buka kunci periode ini? Transaksi bisa diubah lagi.')) return;
    setActionLoading(period.id);
    try {
      await accountingApi.unlockPeriod(period.id);
      await fetchFiscalYears();
    } catch (e: any) {
      alert(getErrorMessage(e, 'Gagal membuka periode'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleLockAllPeriods = async (year: FiscalYearItem) => {
    if (year.is_closed) return;
    const openCount = (year.Periods || []).filter((p) => !p.is_locked).length;
    if (openCount === 0) return;
    if (!window.confirm(`Kunci semua ${openCount} periode yang masih terbuka untuk "${year.name}"?`)) return;
    setActionLoading(`lock-all-${year.id}`);
    try {
      const res = await accountingApi.lockAllPeriods(year.id);
      await fetchFiscalYears();
      if (res.data?.message) alert(res.data.message);
    } catch (e: any) {
      alert(getErrorMessage(e, 'Gagal mengunci periode'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseYear = async (year: FiscalYearItem) => {
    if (year.is_closed) return;
    const openCount = (year.Periods || []).filter((p) => !p.is_locked).length;
    if (openCount > 0) {
      alert(`Semua periode harus dikunci dulu (${openCount} periode masih terbuka).`);
      return;
    }
    if (!window.confirm(`Tutup tahun fiskal "${year.name}"? Setelah ditutup tidak bisa dibuka lagi.`)) return;
    setActionLoading(year.id);
    try {
      await accountingApi.closeFiscalYear(year.id);
      await fetchFiscalYears();
    } catch (e: any) {
      alert(getErrorMessage(e, 'Gagal menutup tahun fiskal'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!createForm.code.trim() || !createForm.name.trim() || !createForm.start_date || !createForm.end_date) {
      setCreateError('Semua field wajib diisi');
      return;
    }
    const start = new Date(createForm.start_date);
    const end = new Date(createForm.end_date);
    if (start >= end) {
      setCreateError('Tanggal selesai harus setelah tanggal mulai');
      return;
    }
    setActionLoading('create');
    try {
      await accountingApi.createFiscalYear({
        code: createForm.code.trim(),
        name: createForm.name.trim(),
        start_date: createForm.start_date,
        end_date: createForm.end_date
      });
      setModalCreate(false);
      setCreateForm({ code: '', name: '', end_date: '', start_date: '' });
      await fetchFiscalYears();
    } catch (e: any) {
      setCreateError(getErrorMessage(e, 'Gagal membuat tahun fiskal'));
    } finally {
      setActionLoading(null);
    }
  };

  const periodLabel = (p: AccountingPeriodItem) =>
    p.period_number >= 1 && p.period_number <= 12
      ? MONTH_NAMES[p.period_number - 1]
      : `Periode ${p.period_number}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Periode Fiskal</h1>
          <p className="text-slate-600 mt-1">
            Tahun fiskal dan periode akuntansi — kunci periode untuk mencegah perubahan data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setModalCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Tahun Fiskal
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchFiscalYears} disabled={loading}>
            {loading ? 'Memuat...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="bg-slate-50/80">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter
          </h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status Tahun Fiskal</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'closed')}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua</option>
                <option value="active">Aktif</option>
                <option value="closed">Ditutup</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status Periode</label>
              <select
                value={filterPeriodLock}
                onChange={(e) => setFilterPeriodLock(e.target.value as 'all' | 'locked' | 'unlocked')}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua</option>
                <option value="locked">Ada yang terkunci</option>
                <option value="unlocked">Ada yang terbuka</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Cari (kode / nama)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="FY2025, Tahun Fiskal..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="py-12 text-center text-slate-500">Memuat...</div>
        ) : filteredYears.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            {fiscalYears.length === 0
              ? 'Belum ada tahun fiskal. Klik "Tambah Tahun Fiskal" atau jalankan seeder accounting-defaults.'
              : 'Tidak ada data sesuai filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600 bg-slate-50/80">
                  <th className="pb-3 pr-4 w-10 font-semibold"></th>
                  <th className="pb-3 pr-4 font-semibold">Kode</th>
                  <th className="pb-3 pr-4 font-semibold">Nama</th>
                  <th className="pb-3 pr-4 font-semibold">Mulai</th>
                  <th className="pb-3 pr-4 font-semibold">Selesai</th>
                  <th className="pb-3 pr-4 font-semibold">Status Tahun</th>
                  <th className="pb-3 pr-4 font-semibold">Periode</th>
                  <th className="pb-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredYears.map((year) => {
                  const expanded = expandedIds.has(year.id);
                  const periods = year.Periods || [];
                  const lockedCount = periods.filter((p) => p.is_locked).length;
                  return (
                    <React.Fragment key={year.id}>
                      <tr
                        className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer"
                        onClick={() => toggleExpand(year.id)}
                      >
                        <td className="py-3 pr-4">
                          {expanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                          )}
                        </td>
                        <td className="py-3 pr-4 font-medium">{year.code}</td>
                        <td className="py-3 pr-4">{year.name}</td>
                        <td className="py-3 pr-4">{formatDate(year.start_date)}</td>
                        <td className="py-3 pr-4">{formatDate(year.end_date)}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              year.is_closed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {year.is_closed ? 'Ditutup' : 'Aktif'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-slate-600">
                            {lockedCount}/{periods.length} terkunci
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {!year.is_closed && lockedCount < periods.length && periods.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLockAllPeriods(year)}
                                disabled={!!actionLoading}
                              >
                                <Lock className="w-4 h-4 mr-1" />
                                Kunci Semua
                              </Button>
                            )}
                            {!year.is_closed && lockedCount === periods.length && periods.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCloseYear(year)}
                                disabled={!!actionLoading}
                              >
                                <LockKeyhole className="w-4 h-4 mr-1" />
                                Tutup Tahun
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && periods.length > 0 && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={8} className="p-0">
                            <div className="px-4 pb-4">
                              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                      <th className="py-2 pl-4 pr-3 text-left font-medium">Periode</th>
                                      <th className="py-2 pr-3 text-left font-medium">Mulai</th>
                                      <th className="py-2 pr-3 text-left font-medium">Selesai</th>
                                      <th className="py-2 pr-3 text-left font-medium">Status</th>
                                      <th className="py-2 pr-4 text-right font-medium">Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {periods.map((p) => (
                                      <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                        <td className="py-2 pl-4 pr-3 font-medium">
                                          {periodLabel(p)} (Periode {p.period_number})
                                        </td>
                                        <td className="py-2 pr-3">{formatDate(p.start_date)}</td>
                                        <td className="py-2 pr-3">{formatDate(p.end_date)}</td>
                                        <td className="py-2 pr-3">
                                          {p.is_locked ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                              <Lock className="w-3 h-3" /> Terkunci
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                              <Unlock className="w-3 h-3" /> Terbuka
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 pr-4 text-right">
                                          {year.is_closed ? (
                                            <span className="text-slate-400 text-xs">Tahun ditutup</span>
                                          ) : p.is_locked ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleUnlockPeriod(p)}
                                              disabled={actionLoading === p.id}
                                            >
                                              <Unlock className="w-4 h-4 mr-1" />
                                              Buka
                                            </Button>
                                          ) : (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleLockPeriod(p)}
                                              disabled={actionLoading === p.id}
                                            >
                                              <Lock className="w-4 h-4 mr-1" />
                                              Kunci
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-900">Tambah Tahun Fiskal</h2>
              <button
                type="button"
                onClick={() => { setModalCreate(false); setCreateError(''); }}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{createError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kode *</label>
                <input
                  type="text"
                  value={createForm.code}
                  onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="FY2026"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Tahun Fiskal 2026"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    value={createForm.end_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Periode bulanan akan dibuat otomatis dari tanggal mulai sampai selesai.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setModalCreate(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={!!actionLoading}>
                  {actionLoading === 'create' ? 'Membuat...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingFiscalPeriodsPage;
