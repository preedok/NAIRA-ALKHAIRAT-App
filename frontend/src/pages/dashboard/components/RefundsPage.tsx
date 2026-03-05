import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Receipt, Wallet, Clock, CheckCircle, XCircle, Banknote, Upload, Download } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl } from '../../../components/common';
import PageFilter from '../../../components/common/PageFilter';
import { FilterIconButton, Input, Autocomplete, StatCard, CardSectionHeader, ContentLoading } from '../../../components/common';
import Table from '../../../components/common/Table';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { formatIDR } from '../../../utils';
import { formatInvoiceNumberDisplay } from '../../../utils/formatters';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { refundsApi, accountingApi, type RefundStats } from '../../../services/api';
import type { TableColumn } from '../../../types';

/** Refund - halaman untuk admin pusat & role accounting (lihat & update status permintaan refund). */

const STATUS_LABELS: Record<string, string> = { requested: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', refunded: 'Sudah direfund' };
const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error'> = { requested: 'warning', approved: 'default', rejected: 'error', refunded: 'success' };
const SOURCE_LABELS: Record<string, string> = { cancel: 'Refund pembatalan order', balance: 'Penarikan saldo' };

const RefundsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ownerIdFilter, setOwnerIdFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [owners, setOwners] = useState<{ id: string; name?: string }[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [uploadingProofId, setUploadingProofId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const canUpdateStatus = user?.role === 'admin_pusat' || user?.role === 'super_admin' || user?.role === 'role_accounting';

  const refundColumns: TableColumn[] = [
    { id: 'invoice_order', label: 'Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'amount', label: 'Jumlah', align: 'right' },
    { id: 'bank', label: 'Rekening', align: 'left' },
    { id: 'status', label: 'Status', align: 'left' },
    ...(canUpdateStatus ? [{ id: 'actions', label: 'Aksi', align: 'left' as const }] : [])
  ];
  const totalRefunds = list.length;
  const totalPages = Math.max(1, Math.ceil(totalRefunds / limit));
  const pagedList = list.slice((page - 1) * limit, page * limit);

  const hasActiveFilters = !!(statusFilter || ownerIdFilter || dateFrom || dateTo || sourceFilter);

  const resetFilters = () => {
    setStatusFilter('');
    setOwnerIdFilter('');
    setDateFrom('');
    setDateTo('');
    setSourceFilter('');
  };

  useEffect(() => {
    if (canUpdateStatus) {
      accountingApi.listAccountingOwners().then((res) => {
        const data = (res.data as { data?: { id: string; name?: string }[] })?.data;
        setOwners(Array.isArray(data) ? data : []);
      }).catch(() => setOwners([]));
    }
  }, [canUpdateStatus]);

  const fetchStats = useCallback(() => {
    const params: { status?: string; owner_id?: string; date_from?: string; date_to?: string; source?: string } = {};
    if (statusFilter) params.status = statusFilter;
    if (ownerIdFilter) params.owner_id = ownerIdFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (sourceFilter) params.source = sourceFilter;
    refundsApi.getStats(params)
      .then((r) => { if (r.data.success && r.data.data) setStats(r.data.data); })
      .catch(() => setStats(null));
  }, [statusFilter, ownerIdFilter, dateFrom, dateTo, sourceFilter]);

  const fetchRefunds = useCallback(() => {
    setLoading(true);
    const params: { limit?: number; page?: number; status?: string; owner_id?: string; date_from?: string; date_to?: string; source?: string } = { limit: 100, page: 1 };
    if (statusFilter) params.status = statusFilter;
    if (ownerIdFilter) params.owner_id = ownerIdFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (sourceFilter) params.source = sourceFilter;
    refundsApi.list(params)
      .then((res) => {
        const d = (res.data as any)?.data;
        setList(Array.isArray(d) ? d : []);
        setPage(1);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [statusFilter, ownerIdFilter, dateFrom, dateTo, sourceFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  const handleUpdateStatus = (id: string, status: string, rejection_reason?: string) => {
    setUpdatingId(id);
    refundsApi.updateStatus(id, { status, rejection_reason })
      .then(() => {
        showToast(`Status diubah menjadi ${STATUS_LABELS[status] || status}`, 'success');
        fetchStats();
        fetchRefunds();
      })
      .catch((e: any) => showToast(e.response?.data?.message || 'Gagal update status', 'error'))
      .finally(() => setUpdatingId(null));
  };

  const handleUploadProof = (id: string, file: File) => {
    if (!file) return;
    setUploadingProofId(id);
    const form = new FormData();
    form.append('proof_file', file);
    refundsApi.uploadProof(id, form)
      .then((res: any) => {
        showToast(res.data?.message || 'Bukti refund berhasil diupload. Email bukti telah dikirim ke pemesan.', 'success');
        fetchStats();
        fetchRefunds();
      })
      .catch((e: any) => showToast(e.response?.data?.message || 'Gagal upload bukti refund', 'error'))
      .finally(() => setUploadingProofId(null));
  };

  const handleDownloadProof = (id: string) => {
    refundsApi.getProofFile(id)
      .then((res) => {
        const contentType = (res.headers?.['content-type'] || '').toLowerCase();
        if (res.status !== 200 || !(res.data instanceof Blob) || contentType.includes('application/json')) {
          showToast('Gagal unduh bukti refund. File tidak ditemukan.', 'error');
          return;
        }
        const blob = res.data as Blob;
        const disp = res.headers?.['content-disposition'];
        let name = `bukti-refund-${id.slice(-6)}.pdf`;
        if (typeof disp === 'string' && /filename/i.test(disp)) {
          const m = disp.match(/filename[*]?=(?:UTF-8'')?["']?([^"'\s;]+)/i);
          if (m?.[1]) name = m[1].replace(/^["']|["']$/g, '');
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => showToast('Gagal unduh bukti refund', 'error'));
  };

  const onRefresh = () => {
    fetchStats();
    fetchRefunds();
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Refund"
        subtitle={canUpdateStatus ? 'Daftar permintaan refund. Beri status (Setujui / Tolak) lalu upload bukti bayar refund; setelah upload, status otomatis Sudah direfund dan bukti dikirim ke email pemesan.' : 'Daftar permintaan refund Anda.'}
        right={
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={onRefresh} disabled={loading} />
            <FilterIconButton open={showFilters} onToggle={() => setShowFilters((v) => !v)} hasActiveFilters={hasActiveFilters} />
          </div>
        }
      />

      <PageFilter
        open={showFilters}
        onToggle={() => setShowFilters((v) => !v)}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
        cardTitle="Pengaturan Filter"
        cardDescription="Filter berdasarkan status, owner, periode tanggal, dan sumber. Filter berlaku otomatis."
        hideToggleRow
        className="w-full"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <Autocomplete
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            emptyLabel="Semua status"
          />
          {canUpdateStatus && (
            <Autocomplete
              label="Owner"
              value={ownerIdFilter}
              onChange={setOwnerIdFilter}
              options={owners.map((o) => ({ value: o.id, label: o.name ?? o.id }))}
              emptyLabel="Semua owner"
            />
          )}
          <Input
            label="Dari tanggal"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            fullWidth
          />
          <Input
            label="Sampai tanggal"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            fullWidth
          />
          <Autocomplete
            label="Sumber"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={Object.entries(SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            emptyLabel="Semua sumber"
          />
        </div>
      </PageFilter>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Refund" value={stats?.total_refunds ?? '–'} iconClassName="bg-[#0D1A63] text-white" />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Menunggu"
          value={stats?.requested ?? '–'}
          iconClassName="bg-amber-100 text-amber-600"
          subtitle={(stats?.amount_pending ?? 0) > 0 ? formatIDR(stats!.amount_pending) : undefined}
        />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Disetujui" value={stats?.approved ?? '–'} iconClassName="bg-sky-100 text-sky-600" />
        <StatCard icon={<XCircle className="w-5 h-5" />} label="Ditolak" value={stats?.rejected ?? '–'} iconClassName="bg-red-100 text-red-600" />
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          label="Sudah direfund"
          value={stats?.refunded ?? '–'}
          iconClassName="bg-emerald-100 text-emerald-600"
          subtitle={(stats?.amount_refunded ?? 0) > 0 ? formatIDR(stats!.amount_refunded) : undefined}
        />
        <StatCard
          icon={<Banknote className="w-5 h-5" />}
          label="Nominal Pending"
          value={formatIDR(stats?.amount_requested ?? 0)}
          iconClassName="bg-teal-100 text-teal-600"
        />
      </div>

      <Card>
        <CardSectionHeader
          icon={<Receipt className="w-6 h-6" />}
          title="Daftar Permintaan Refund"
          subtitle={`${totalRefunds} permintaan. ${canUpdateStatus ? 'Upload bukti bayar refund untuk menandai selesai; bukti otomatis dikirim ke email pemesan.' : 'Lihat daftar permintaan refund Anda.'}`}
          className="mb-4"
        />
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          {loading ? (
            <ContentLoading />
          ) : (
          <Table
            columns={refundColumns}
            data={pagedList}
            emptyMessage="Belum ada permintaan refund"
            emptyDescription="Ubah filter atau tunggu ada permintaan refund."
            stickyActionsColumn={canUpdateStatus}
            pagination={
              totalRefunds > 0
                ? {
                    total: totalRefunds,
                    page,
                    limit,
                    totalPages,
                    onPageChange: setPage,
                    onLimitChange: (l) => { setLimit(l); setPage(1); }
                  }
                : undefined
            }
            renderRow={(r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="py-3 px-4">
                  <span className="font-medium">{formatInvoiceNumberDisplay(r.Invoice, INVOICE_STATUS_LABELS)}</span>
                </td>
                <td className="py-3 px-4">
                  {r.Owner ? <span>{r.Owner.name || r.Owner.company_name}</span> : '-'}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-emerald-700">{formatIDR(parseFloat(r.amount))}</td>
                <td className="py-3 px-4 text-slate-600">{r.bank_name && r.account_number ? `${r.bank_name} ${r.account_number}` : '-'}</td>
                <td className="py-3 px-4">
                  <Badge variant={STATUS_VARIANT[r.status] || 'default'}>{STATUS_LABELS[r.status] || r.status}</Badge>
                </td>
                {canUpdateStatus && (
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.proof_file_url && (
                        <Button size="sm" variant="outline" onClick={() => handleDownloadProof(r.id)} className="inline-flex items-center gap-1">
                          <Download className="w-3.5 h-3.5" /> Unduh bukti
                        </Button>
                      )}
                      {(r.status === 'requested' || r.status === 'approved') && (
                        <>
                          <input
                            type="file"
                            ref={(el) => { fileInputRefs.current[r.id] = el; }}
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadProof(r.id, f);
                              e.target.value = '';
                            }}
                          />
                          <Button size="sm" variant="primary" disabled={uploadingProofId === r.id} onClick={() => fileInputRefs.current[r.id]?.click()} className="inline-flex items-center gap-1">
                            <Upload className="w-3.5 h-3.5" /> {uploadingProofId === r.id ? 'Uploading...' : 'Upload bukti refund'}
                          </Button>
                        </>
                      )}
                      {r.status === 'requested' && (
                        <>
                          <Button size="sm" variant="outline" disabled={updatingId === r.id} onClick={() => handleUpdateStatus(r.id, 'approved')}>Setujui</Button>
                          <Button size="sm" variant="outline" className="text-red-600" disabled={updatingId === r.id} onClick={() => handleUpdateStatus(r.id, 'rejected')}>Tolak</Button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )}
          />
          )}
        </div>
      </Card>
    </div>
  );
};

export default RefundsPage;
