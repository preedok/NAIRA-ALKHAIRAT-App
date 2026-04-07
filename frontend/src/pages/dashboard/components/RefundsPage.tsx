import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Wallet, Clock, CheckCircle, XCircle, Banknote, Upload, Download, Eye } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl } from '../../../components/common';
import PageFilter from '../../../components/common/PageFilter';
import { FilterIconButton, Input, Autocomplete, StatCard, CardSectionHeader, ContentLoading, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ModalBoxLg, NominalDisplay } from '../../../components/common';
import Table from '../../../components/common/Table';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { refundsApi, accountingApi, type RefundStats, type BankItem, type BankAccountItem } from '../../../services/api';
import type { TableColumn } from '../../../types';

/** Refund - halaman untuk admin pusat & role accounting (lihat & update status permintaan refund). */

const STATUS_LABELS: Record<string, string> = { requested: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', refunded: 'Sudah direfund' };
const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error'> = { requested: 'warning', approved: 'default', rejected: 'error', refunded: 'success' };
const SOURCE_LABELS: Record<string, string> = { cancel: 'Refund pembatalan order', balance: 'Penarikan saldo' };

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function nowLocalDateTimeParts() {
  const now = new Date();
  return {
    local: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    seconds: pad2(now.getSeconds())
  };
}

/** datetime-local "YYYY-MM-DDTHH:mm" + detik → ISO UTC untuk API */
function transferLocalToISO(dateTimeLocal: string, secondsStr: string): string | null {
  if (!dateTimeLocal?.trim()) return null;
  const sec = Math.min(59, Math.max(0, parseInt(secondsStr, 10) || 0));
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dateTimeLocal.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const mi = parseInt(m[5], 10);
  const dt = new Date(y, mo - 1, d, h, mi, sec, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/** Tampilan tanggal di tabel: utamakan waktu di bukti transfer */
function getRefundDisplayInstant(r: any): string | undefined {
  const v =
    r?.proof_transfer_at ??
    r?.proofTransferAt ??
    r?.refunded_at ??
    r?.refundedAt ??
    r?.created_at ??
    r?.createdAt;
  return v != null && v !== '' ? String(v) : undefined;
}

function isBalanceWithdrawalRow(r: any): boolean {
  if (String(r?.source || '').toLowerCase() === 'balance') return true;
  if (r?.Invoice || r?.Order) return false;
  const reason = String(r?.reason || '').toLowerCase();
  return reason.includes('penarikan') && reason.includes('saldo');
}

const RefundsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ownerIdFilter, setOwnerIdFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [owners, setOwners] = useState<{ id: string; name?: string }[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [payoutModalRow, setPayoutModalRow] = useState<any | null>(null);
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutBank, setPayoutBank] = useState('');
  const [payoutHolder, setPayoutHolder] = useState('');
  const [payoutNumber, setPayoutNumber] = useState('');
  const [payoutFile, setPayoutFile] = useState<File | null>(null);
  const [payoutBanks, setPayoutBanks] = useState<BankItem[]>([]);
  const [payoutSenderMode, setPayoutSenderMode] = useState<'db' | 'manual'>('db');
  const [payoutBankAccounts, setPayoutBankAccounts] = useState<BankAccountItem[]>([]);
  const [payoutBankAccountId, setPayoutBankAccountId] = useState('');
  const [payoutTransferAtLocal, setPayoutTransferAtLocal] = useState('');
  const [payoutTransferSeconds, setPayoutTransferSeconds] = useState('00');
  const [replaceProofRow, setReplaceProofRow] = useState<any | null>(null);
  const [replaceProofFile, setReplaceProofFile] = useState<File | null>(null);
  const [replaceTransferAtLocal, setReplaceTransferAtLocal] = useState('');
  const [replaceTransferSeconds, setReplaceTransferSeconds] = useState('00');
  const [replaceProofSubmitting, setReplaceProofSubmitting] = useState(false);
  const [statModal, setStatModal] = useState<'total' | 'requested' | 'approved' | 'rejected' | 'refunded' | 'amount_pending' | null>(null);

  const canUpdateStatus = user?.role === 'admin_pusat' || user?.role === 'super_admin' || user?.role === 'role_accounting';
  const isOwnerViewer = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';
  const formatDateTime = (value?: string) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const refundColumns: TableColumn[] = [
    { id: 'invoice_order', label: 'Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'tanggal', label: 'Tanggal bukti', align: 'left' },
    { id: 'amount', label: 'Jumlah', align: 'right' },
    { id: 'bank', label: 'Rek. penerima', align: 'left' },
    { id: 'payout_sender', label: 'Dari (BGG)', align: 'left' },
    { id: 'status', label: 'Status', align: 'left' },
    ...(isOwnerViewer ? [{ id: 'owner_followup', label: 'Tindak lanjut', align: 'left' as const }] : []),
    ...(canUpdateStatus ? [{ id: 'actions', label: 'Aksi', align: 'left' as const }] : [])
  ];

  const renderBankCell = (r: any) => {
    if (!r.bank_name && !r.account_number) return '-';
    return (
      <div>
        <div>{r.bank_name} {r.account_number}</div>
        {r.account_holder_name ? <div className="text-xs text-slate-500 mt-0.5">a.n. {r.account_holder_name}</div> : null}
      </div>
    );
  };

  const renderPayoutSenderCell = (r: any) => {
    if (r.status !== 'refunded' || !r.payout_sender_bank_name) return '–';
    return (
      <div className="text-sm">
        <div className="font-medium text-slate-800">{r.payout_sender_bank_name}</div>
        {r.payout_sender_account_holder ? (
          <div className="text-xs text-slate-500 mt-0.5">a.n. {r.payout_sender_account_holder}</div>
        ) : null}
        {r.payout_sender_account_number ? (
          <div className="text-xs text-slate-500">No. {r.payout_sender_account_number}</div>
        ) : null}
      </div>
    );
  };
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

  useEffect(() => {
    if (!payoutModalRow) return;
    Promise.all([
      accountingApi.getBanks({ is_active: 'true' }).catch(() => null),
      accountingApi.getBankAccounts({ is_active: 'true' }).catch(() => null)
    ]).then(([banksRes, accountsRes]) => {
      const banks = banksRes?.data?.success && Array.isArray(banksRes.data.data) ? banksRes.data.data : [];
      const accounts = accountsRes?.data?.success && Array.isArray(accountsRes.data.data) ? accountsRes.data.data : [];
      setPayoutBanks(banks);
      setPayoutBankAccounts(accounts);
      if (!payoutBankAccountId && accounts.length > 0) setPayoutBankAccountId(accounts[0].id);
    });
  }, [payoutModalRow]);

  useEffect(() => {
    if (!payoutModalRow || payoutSenderMode !== 'db') return;
    const picked = payoutBankAccounts.find((a) => a.id === payoutBankAccountId);
    if (!picked) return;
    setPayoutBank(picked.bank_name || '');
    setPayoutHolder((picked.name || '').trim());
    setPayoutNumber((picked.account_number || '').trim());
  }, [payoutModalRow, payoutSenderMode, payoutBankAccountId, payoutBankAccounts]);

  const openCompletePayoutModal = (r: any) => {
    setPayoutModalRow(r);
    setPayoutSenderMode('db');
    setPayoutBankAccountId('');
    setPayoutBank('');
    setPayoutHolder('');
    setPayoutNumber('');
    setPayoutFile(null);
    const { local, seconds } = nowLocalDateTimeParts();
    setPayoutTransferAtLocal(local);
    setPayoutTransferSeconds(seconds);
  };

  const openReplaceProofModal = (r: any) => {
    setReplaceProofRow(r);
    setReplaceProofFile(null);
    const ex = r.proof_transfer_at ?? r.proofTransferAt ?? r.refunded_at ?? r.refundedAt;
    if (ex) {
      const d = new Date(ex);
      if (!Number.isNaN(d.getTime())) {
        setReplaceTransferAtLocal(
          `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
        );
        setReplaceTransferSeconds(pad2(d.getSeconds()));
        return;
      }
    }
    const { local, seconds } = nowLocalDateTimeParts();
    setReplaceTransferAtLocal(local);
    setReplaceTransferSeconds(seconds);
  };

  const submitReplaceProof = () => {
    if (!replaceProofRow?.id || !replaceProofFile) {
      showToast('Pilih file bukti dan isi tanggal/waktu di bukti transfer.', 'error');
      return;
    }
    const iso = transferLocalToISO(replaceTransferAtLocal, replaceTransferSeconds);
    if (!iso) {
      showToast('Isi tanggal dan waktu bukti transfer dengan benar.', 'error');
      return;
    }
    setReplaceProofSubmitting(true);
    const form = new FormData();
    form.append('proof_file', replaceProofFile);
    form.append('transfer_proof_at', iso);
    refundsApi
      .uploadProof(replaceProofRow.id, form)
      .then((res: any) => {
        showToast(res.data?.message || 'Bukti berhasil diperbarui.', 'success');
        setReplaceProofRow(null);
        fetchStats();
        fetchRefunds();
      })
      .catch((e: any) => showToast(e.response?.data?.message || 'Gagal mengunggah bukti', 'error'))
      .finally(() => setReplaceProofSubmitting(false));
  };

  const submitCompletePayout = () => {
    if (!payoutModalRow?.id) return;
    if (payoutSenderMode === 'db' && !payoutBankAccountId) {
      showToast('Pilih rekening pengirim dari database terlebih dahulu', 'error');
      return;
    }
    if (!payoutBank.trim() || !payoutHolder.trim()) {
      showToast('Bank pengirim dan nama pemilik rekening pengirim wajib diisi', 'error');
      return;
    }
    if (!payoutFile) {
      showToast('Unggah file bukti transfer', 'error');
      return;
    }
    const transferIso = transferLocalToISO(payoutTransferAtLocal, payoutTransferSeconds);
    if (!transferIso) {
      showToast('Isi tanggal dan waktu di bukti transfer (jam, menit, detik) dengan benar.', 'error');
      return;
    }
    const fd = new FormData();
    fd.append('proof_file', payoutFile);
    fd.append('transfer_proof_at', transferIso);
    fd.append('payout_sender_bank_name', payoutBank.trim());
    fd.append('payout_sender_account_holder', payoutHolder.trim());
    if (payoutNumber.trim()) fd.append('payout_sender_account_number', payoutNumber.trim());
    setPayoutSubmitting(true);
    refundsApi
      .completePayout(payoutModalRow.id, fd)
      .then((res) => {
        showToast((res.data as { message?: string })?.message || 'Transfer selesai. Owner menerima notifikasi & email.', 'success');
        setPayoutModalRow(null);
        fetchStats();
        fetchRefunds();
      })
      .catch((e: any) => showToast(e.response?.data?.message || 'Gagal menyelesaikan transfer', 'error'))
      .finally(() => setPayoutSubmitting(false));
  };

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
        subtitle={
          canUpdateStatus
            ? 'Selesaikan transfer: isi bank & nama rekening pengirim (BGG), unggah bukti — status jadi Sudah direfund; owner dapat notifikasi + email lengkap. Tolak = pengajuan dibatalkan.'
            : 'Penarikan: saldo owner langsung berkurang saat pengajuan. Menunggu persetujuan lalu transfer. Jika ditolak saldo dikembalikan otomatis. Detail pengirim + bukti tampil di sini, notifikasi, dan email.'
        }
        right={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isOwnerViewer && (
              <Button size="sm" variant="primary" className="gap-1" onClick={() => navigate('/dashboard', { state: { openWithdraw: true } })}>
                <Wallet className="w-4 h-4" /> Tarik saldo
              </Button>
            )}
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
        <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Refund" value={stats?.total_refunds ?? '–'} iconClassName="bg-[#0D1A63] text-white" onClick={() => setStatModal('total')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('total')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Menunggu"
          value={stats?.requested ?? '–'}
          iconClassName="bg-amber-100 text-amber-600"
          subtitle={(stats?.amount_pending ?? 0) > 0 ? <NominalDisplay amount={stats!.amount_pending} currency="IDR" /> : undefined}
          onClick={() => setStatModal('requested')}
          action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('requested')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
        />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Disetujui" value={stats?.approved ?? '–'} iconClassName="bg-sky-100 text-sky-600" onClick={() => setStatModal('approved')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('approved')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        <StatCard icon={<XCircle className="w-5 h-5" />} label="Ditolak" value={stats?.rejected ?? '–'} iconClassName="bg-red-100 text-red-600" onClick={() => setStatModal('rejected')} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('rejected')}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          label="Sudah direfund"
          value={stats?.refunded ?? '–'}
          iconClassName="bg-emerald-100 text-emerald-600"
          subtitle={(stats?.amount_refunded ?? 0) > 0 ? <NominalDisplay amount={stats!.amount_refunded} currency="IDR" /> : undefined}
          onClick={() => setStatModal('refunded')}
          action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('refunded')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
        />
        <StatCard
          icon={<Banknote className="w-5 h-5" />}
          label="Nominal Pending"
          value={<NominalDisplay amount={stats?.amount_requested ?? 0} currency="IDR" />}
          iconClassName="bg-teal-100 text-teal-600"
          onClick={() => setStatModal('amount_pending')}
          action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('amount_pending')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
        />
      </div>

      {statModal && (() => {
        const filterByStatus = statModal === 'total' ? list : statModal === 'amount_pending' ? list.filter((r: any) => r.status === 'requested' || r.status === 'approved') : list.filter((r: any) => r.status === statModal);
        const title = statModal === 'total' ? 'Total Refund' : statModal === 'requested' ? 'Menunggu' : statModal === 'approved' ? 'Disetujui' : statModal === 'rejected' ? 'Ditolak' : statModal === 'refunded' ? 'Sudah direfund' : 'Nominal Pending';
        return (
          <Modal open onClose={() => setStatModal(null)}>
            <ModalBoxLg>
              <ModalHeader title={title} subtitle={`${filterByStatus.length} permintaan sesuai statistik`} onClose={() => setStatModal(null)} />
              <ModalBody className="p-0 overflow-hidden flex flex-col min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <Table
                    columns={refundColumns}
                    data={filterByStatus}
                    emptyMessage="Tidak ada data dalam kategori ini."
                    renderRow={(r: any) => (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-2 px-4 text-sm">
                          {r.Invoice ? <InvoiceNumberCell inv={r.Invoice} statusLabels={INVOICE_STATUS_LABELS} compact /> : isBalanceWithdrawalRow(r) ? 'Refund saldo' : '–'}
                        </td>
                        <td className="py-2 px-4 text-sm">{r.Owner ? (r.Owner.name || r.Owner.company_name) : '-'}</td>
                        <td className="py-2 px-4 text-sm whitespace-nowrap">{formatDateTime(getRefundDisplayInstant(r))}</td>
                        <td className="py-2 px-4 text-right text-sm font-semibold text-emerald-700"><NominalDisplay amount={parseFloat(r.amount)} currency="IDR" /></td>
                        <td className="py-2 px-4 text-slate-600 text-sm">{renderBankCell(r)}</td>
                        <td className="py-2 px-4 text-slate-600 text-sm">{renderPayoutSenderCell(r)}</td>
                        <td className="py-2 px-4">
                          <Badge variant={STATUS_VARIANT[r.status] || 'default'}>{STATUS_LABELS[r.status] || r.status}</Badge>
                          {r.status === 'rejected' && r.rejection_reason ? (
                            <p className="text-xs text-red-600 mt-1 max-w-[14rem]">{r.rejection_reason}</p>
                          ) : null}
                        </td>
                        {isOwnerViewer && (
                          <td className="py-2 px-4 text-sm">
                            {r.status === 'refunded' && r.proof_file_url ? (
                              <div className="space-y-2 max-w-[14rem]">
                                {r.payout_sender_bank_name ? (
                                  <p className="text-xs text-slate-600 leading-snug">
                                    <span className="font-medium text-slate-700">Dari BGG:</span> {r.payout_sender_bank_name}
                                    {r.payout_sender_account_holder ? ` a.n. ${r.payout_sender_account_holder}` : ''}
                                    {r.payout_sender_account_number ? ` · ${r.payout_sender_account_number}` : ''}
                                  </p>
                                ) : null}
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => handleDownloadProof(r.id)} title="Unduh bukti">
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : isBalanceWithdrawalRow(r) && r.status === 'requested' ? (
                              <span className="text-slate-500 text-xs">Menunggu transfer dari BGG</span>
                            ) : isBalanceWithdrawalRow(r) && r.status === 'approved' ? (
                              <span className="text-slate-500 text-xs">Menunggu bukti transfer</span>
                            ) : null}
                          </td>
                        )}
                        {canUpdateStatus && <td className="py-2 px-4" />}
                      </tr>
                    )}
                  />
                </div>
              </ModalBody>
            </ModalBoxLg>
          </Modal>
        );
      })()}

      <Card>
        <CardSectionHeader
          icon={<Receipt className="w-6 h-6" />}
          title="Daftar Permintaan Refund"
          subtitle={`${totalRefunds} permintaan. ${canUpdateStatus ? 'Gunakan Selesaikan transfer untuk input rekening pengirim + bukti. Tolak mengembalikan saldo penarikan.' : 'Lihat detail transfer dari BGG setelah selesai.'}`}
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
                  <span className="font-medium">
                    {r.Invoice
                      ? <InvoiceNumberCell inv={r.Invoice} statusLabels={INVOICE_STATUS_LABELS} compact />
                      : isBalanceWithdrawalRow(r)
                        ? 'Refund saldo'
                        : '–'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {r.Owner ? <span>{r.Owner.name || r.Owner.company_name}</span> : '-'}
                </td>
                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-600">{formatDateTime(getRefundDisplayInstant(r))}</td>
                <td className="py-3 px-4 text-right font-semibold text-emerald-700"><NominalDisplay amount={parseFloat(r.amount)} currency="IDR" /></td>
                <td className="py-3 px-4 text-slate-600">{renderBankCell(r)}</td>
                <td className="py-3 px-4 text-slate-600">{renderPayoutSenderCell(r)}</td>
                <td className="py-3 px-4">
                  <Badge variant={STATUS_VARIANT[r.status] || 'default'}>{STATUS_LABELS[r.status] || r.status}</Badge>
                  {r.status === 'rejected' && r.rejection_reason ? (
                    <p className="text-xs text-red-600 mt-1 max-w-xs">{r.rejection_reason}</p>
                  ) : null}
                </td>
                {isOwnerViewer && (
                  <td className="py-3 px-4 text-sm">
                    {r.status === 'refunded' && r.proof_file_url ? (
                      <div className="space-y-2 max-w-xs">
                        {r.payout_sender_bank_name ? (
                          <p className="text-xs text-slate-600 leading-snug">
                            <span className="font-medium text-slate-700">Dari BGG:</span> {r.payout_sender_bank_name}
                            {r.payout_sender_account_holder ? ` a.n. ${r.payout_sender_account_holder}` : ''}
                            {r.payout_sender_account_number ? ` · ${r.payout_sender_account_number}` : ''}
                          </p>
                        ) : null}
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => handleDownloadProof(r.id)} title="Unduh bukti">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : isBalanceWithdrawalRow(r) && r.status === 'requested' ? (
                      <span className="text-slate-500 text-xs">Menunggu transfer dari BGG</span>
                    ) : isBalanceWithdrawalRow(r) && r.status === 'approved' ? (
                      <span className="text-slate-500 text-xs">Menunggu bukti transfer</span>
                    ) : null}
                  </td>
                )}
                {canUpdateStatus && (
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.proof_file_url && (
                        <Button size="sm" variant="outline" onClick={() => handleDownloadProof(r.id)} className="inline-flex items-center gap-1" title="Unduh bukti">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {(r.status === 'requested' || (r.status === 'approved' && !r.proof_file_url)) && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="inline-flex items-center gap-1"
                          disabled={payoutSubmitting && payoutModalRow?.id === r.id}
                          onClick={() => openCompletePayoutModal(r)}
                        >
                          <Upload className="w-3.5 h-3.5" /> Selesaikan transfer
                        </Button>
                      )}
                      {r.proof_file_url && (r.status === 'refunded' || r.status === 'approved') && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={replaceProofSubmitting && replaceProofRow?.id === r.id}
                          onClick={() => openReplaceProofModal(r)}
                          className="inline-flex items-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5" /> Ganti bukti
                        </Button>
                      )}
                      {r.status === 'requested' && (
                        <Button size="sm" variant="outline" className="text-red-600" disabled={updatingId === r.id} onClick={() => handleUpdateStatus(r.id, 'rejected')}>Tolak</Button>
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

      {payoutModalRow && (
        <Modal open onClose={() => !payoutSubmitting && setPayoutModalRow(null)}>
          <ModalBox className="max-w-md w-full">
            <ModalHeader
              title="Selesaikan transfer"
              subtitle={
                <span>
                  Transfer ke penerima: <strong>{payoutModalRow.bank_name || '—'}</strong>
                  {payoutModalRow.account_number ? ` · ${payoutModalRow.account_number}` : ''}
                  {payoutModalRow.account_holder_name ? ` a.n. ${payoutModalRow.account_holder_name}` : ''}. Jumlah{' '}
                  <NominalDisplay amount={parseFloat(payoutModalRow.amount)} currency="IDR" />. Isi rekening pengirim BGG dan unggah bukti — owner dapat notifikasi & email.
                </span>
              }
              onClose={() => !payoutSubmitting && setPayoutModalRow(null)}
            />
            <ModalBody className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Sumber data rekening pengirim *</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={payoutSenderMode === 'db' ? 'primary' : 'outline'}
                    onClick={() => setPayoutSenderMode('db')}
                    disabled={payoutSubmitting}
                  >
                    Dari database
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={payoutSenderMode === 'manual' ? 'primary' : 'outline'}
                    onClick={() => setPayoutSenderMode('manual')}
                    disabled={payoutSubmitting}
                  >
                    Input manual
                  </Button>
                </div>
              </div>
              {payoutSenderMode === 'db' && (
                <Autocomplete
                  label="Pilih rekening pengirim (database) *"
                  value={payoutBankAccountId}
                  onChange={(v) => setPayoutBankAccountId(v || '')}
                  options={payoutBankAccounts.map((a) => ({
                    value: a.id,
                    label: `${a.bank_name} · ${a.account_number} · a.n. ${a.name}`
                  }))}
                  placeholder="Pilih rekening"
                  emptyLabel="Pilih rekening"
                  disabled={payoutSubmitting}
                />
              )}
              <Autocomplete
                label="Bank pengirim (BGG) *"
                value={payoutBank}
                onChange={(v) => setPayoutBank(v || '')}
                options={payoutBanks.map((b) => ({ value: b.name, label: b.name }))}
                placeholder="Pilih bank"
                emptyLabel="Pilih bank"
                disabled={payoutSubmitting || payoutSenderMode === 'db'}
              />
              <Input
                label="Nama pemilik rekening pengirim *"
                type="text"
                value={payoutHolder}
                onChange={(e) => setPayoutHolder(e.target.value)}
                placeholder="Sesuai rekening pengirim"
                disabled={payoutSubmitting || payoutSenderMode === 'db'}
                fullWidth
              />
              <Input
                label="Nomor rekening pengirim (opsional)"
                type="text"
                value={payoutNumber}
                onChange={(e) => setPayoutNumber(e.target.value)}
                placeholder="Jika ingin ditampilkan ke owner"
                disabled={payoutSubmitting || payoutSenderMode === 'db'}
                fullWidth
              />
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-3 space-y-2">
                <p className="text-sm font-medium text-slate-800">Waktu di bukti transfer *</p>
                <p className="text-xs text-slate-600">Sesuai tanggal, jam, menit, dan detik pada bukti/bilyet (bukan waktu unggah file).</p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <Input
                    label="Tanggal & jam"
                    type="datetime-local"
                    value={payoutTransferAtLocal}
                    onChange={(e) => setPayoutTransferAtLocal(e.target.value)}
                    step={60}
                    disabled={payoutSubmitting}
                    fullWidth
                  />
                  <Input
                    label="Detik"
                    type="number"
                    min={0}
                    max={59}
                    value={payoutTransferSeconds}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') { setPayoutTransferSeconds(''); return; }
                      const n = parseInt(v, 10);
                      if (Number.isNaN(n)) return;
                      setPayoutTransferSeconds(pad2(Math.min(59, Math.max(0, n))));
                    }}
                    disabled={payoutSubmitting}
                    fullWidth={false}
                    className="min-w-[5rem]"
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Bukti transfer *</p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={payoutSubmitting}
                  className="block w-full text-sm text-slate-600"
                  onChange={(e) => setPayoutFile(e.target.files?.[0] || null)}
                />
                {payoutFile ? <p className="text-xs text-slate-500 mt-1">{payoutFile.name}</p> : null}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => !payoutSubmitting && setPayoutModalRow(null)} disabled={payoutSubmitting}>
                Batal
              </Button>
              <Button variant="primary" onClick={submitCompletePayout} disabled={payoutSubmitting}>
                {payoutSubmitting ? 'Mengirim…' : 'Simpan & kirim ke owner'}
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {replaceProofRow && (
        <Modal open onClose={() => !replaceProofSubmitting && setReplaceProofRow(null)}>
          <ModalBox className="max-w-md w-full">
            <ModalHeader
              title="Ganti bukti transfer"
              subtitle="Unggah file baru dan isi tanggal/waktu sesuai bukti yang baru."
              onClose={() => !replaceProofSubmitting && setReplaceProofRow(null)}
            />
            <ModalBody className="space-y-3">
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-3 space-y-2">
                <p className="text-sm font-medium text-slate-800">Waktu di bukti transfer *</p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <Input
                    label="Tanggal & jam"
                    type="datetime-local"
                    value={replaceTransferAtLocal}
                    onChange={(e) => setReplaceTransferAtLocal(e.target.value)}
                    step={60}
                    disabled={replaceProofSubmitting}
                    fullWidth
                  />
                  <Input
                    label="Detik"
                    type="number"
                    min={0}
                    max={59}
                    value={replaceTransferSeconds}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') { setReplaceTransferSeconds(''); return; }
                      const n = parseInt(v, 10);
                      if (Number.isNaN(n)) return;
                      setReplaceTransferSeconds(pad2(Math.min(59, Math.max(0, n))));
                    }}
                    disabled={replaceProofSubmitting}
                    fullWidth={false}
                    className="min-w-[5rem]"
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">File bukti *</p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={replaceProofSubmitting}
                  className="block w-full text-sm text-slate-600"
                  onChange={(e) => setReplaceProofFile(e.target.files?.[0] || null)}
                />
                {replaceProofFile ? <p className="text-xs text-slate-500 mt-1">{replaceProofFile.name}</p> : null}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => !replaceProofSubmitting && setReplaceProofRow(null)} disabled={replaceProofSubmitting}>
                Batal
              </Button>
              <Button variant="primary" onClick={submitReplaceProof} disabled={replaceProofSubmitting}>
                {replaceProofSubmitting ? 'Mengunggah…' : 'Simpan'}
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default RefundsPage;
