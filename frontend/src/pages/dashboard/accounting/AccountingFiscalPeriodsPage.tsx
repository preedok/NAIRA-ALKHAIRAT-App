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
  LockKeyhole,
  RefreshCw,
  Calendar
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import PageFilter from '../../../components/common/PageFilter';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { FilterIconButton, Input, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox } from '../../../components/common';
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
  const [showFilters, setShowFilters] = useState(false);
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

  const hasActiveFilters = filterStatus !== 'all' || filterPeriodLock !== 'all' || search.trim() !== '';
  const resetFilters = () => { setFilterStatus('all'); setFilterPeriodLock('all'); setSearch(''); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Periode Fiskal"
        subtitle="Tahun fiskal dan periode akuntansi — kunci periode untuk mencegah perubahan data"
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchFiscalYears} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Memuat...' : 'Refresh'}
            </Button>
            <FilterIconButton open={showFilters} onToggle={() => setShowFilters((v: boolean) => !v)} hasActiveFilters={hasActiveFilters} />
            <Button variant="primary" size="sm" onClick={() => setModalCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tambah Tahun Fiskal
            </Button>
          </div>
        }
      />

      <PageFilter
        open={showFilters}
        onToggle={() => setShowFilters((v: boolean) => !v)}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        onApply={() => { setShowFilters(false); fetchFiscalYears(); }}
        loading={loading}
        hideToggleRow
      >
        <div className="flex flex-wrap gap-4 items-end">
          <Autocomplete
            label="Status Tahun Fiskal"
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as 'all' | 'active' | 'closed')}
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'active', label: 'Aktif' },
              { value: 'closed', label: 'Ditutup' }
            ]}
            fullWidth={false}
            className="min-w-[140px]"
          />
          <Autocomplete
            label="Status Periode"
            value={filterPeriodLock}
            onChange={(v) => setFilterPeriodLock(v as 'all' | 'locked' | 'unlocked')}
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'locked', label: 'Ada yang terkunci' },
              { value: 'unlocked', label: 'Ada yang terbuka' }
            ]}
            fullWidth={false}
            className="min-w-[160px]"
          />
          <div className="flex-1 min-w-[200px]">
            <Input
              label="Cari (kode / nama)"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="FY2025, Tahun Fiskal..."
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>
      </PageFilter>

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
          <Table<FiscalYearItem>
            columns={[
              { id: 'expand', label: '', align: 'left' },
              { id: 'code', label: 'Kode', align: 'left' },
              { id: 'name', label: 'Nama', align: 'left' },
              { id: 'start', label: 'Mulai', align: 'left' },
              { id: 'end', label: 'Selesai', align: 'left' },
              { id: 'status', label: 'Status Tahun', align: 'left' },
              { id: 'periods', label: 'Periode', align: 'left' },
              { id: 'actions', label: 'Aksi', align: 'right' }
            ] as TableColumn[]}
            data={filteredYears}
            emptyMessage="Belum ada tahun fiskal"
            renderRow={(year) => {
              const expanded = expandedIds.has(year.id);
              const periods = year.Periods || [];
              const lockedCount = periods.filter((p) => p.is_locked).length;
              return (
                <React.Fragment key={year.id}>
                  <tr
                    className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => toggleExpand(year.id)}
                  >
                    <td className="py-3 px-4">
                      {expanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium">{year.code}</td>
                    <td className="py-3 px-4">{year.name}</td>
                    <td className="py-3 px-4">{formatDate(year.start_date)}</td>
                    <td className="py-3 px-4">{formatDate(year.end_date)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          year.is_closed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {year.is_closed ? 'Ditutup' : 'Aktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-600">
                        {lockedCount}/{periods.length} terkunci
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
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
                                <Table<AccountingPeriodItem>
                                  columns={[
                                    { id: 'periode', label: 'Periode', align: 'left' },
                                    { id: 'mulai', label: 'Mulai', align: 'left' },
                                    { id: 'selesai', label: 'Selesai', align: 'left' },
                                    { id: 'status', label: 'Status', align: 'left' },
                                    { id: 'aksi', label: 'Aksi', align: 'right' }
                                  ] as TableColumn[]}
                                  data={periods}
                                  emptyMessage="Tidak ada periode"
                                  renderRow={(p) => (
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
                                  )}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                  )}
                </React.Fragment>
              );
            }}
          />
        )}
      </Card>

      <Modal open={modalCreate} onClose={() => { setModalCreate(false); setCreateError(''); }}>
        <ModalBox>
          <ModalHeader title="Tambah Tahun Fiskal" subtitle="Buat tahun fiskal baru untuk periode akuntansi" icon={<Calendar className="w-5 h-5" />} onClose={() => { setModalCreate(false); setCreateError(''); }} />
          <ModalBody className="space-y-4">
            <form id="fiscal-create-form" onSubmit={handleCreateSubmit} className="space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{createError}</div>
              )}
              <Input label="Kode *" type="text" value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} placeholder="FY2026" fullWidth required />
              <Input label="Nama *" type="text" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tahun Fiskal 2026" fullWidth required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Tanggal Mulai *" type="date" value={createForm.start_date} onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))} fullWidth required />
                <Input label="Tanggal Selesai *" type="date" value={createForm.end_date} onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))} fullWidth required />
              </div>
              <p className="text-xs text-slate-500">
                Periode bulanan akan dibuat otomatis dari tanggal mulai sampai selesai.
              </p>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setModalCreate(false)}>
              Batal
            </Button>
            <Button type="submit" form="fiscal-create-form" variant="primary" disabled={!!actionLoading}>
              {actionLoading === 'create' ? 'Membuat...' : 'Simpan'}
            </Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default AccountingFiscalPeriodsPage;
