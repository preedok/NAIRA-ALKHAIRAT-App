import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, Eye, FileCheck, X, ChevronLeft, ChevronRight, Users, Zap, Clock, CreditCard, XCircle } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBox } from '../../../components/common/Modal';
import { PageFilter, AutoRefreshControl, PageHeader, FilterIconButton, StatCard, CardSectionHeader, ContentLoading } from '../../../components/common';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { ownersApi, branchesApi, type OwnerStats } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { API_BASE_URL } from '../../../utils/constants';

const UPLOAD_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');

const OWNER_STATUS_LABELS: Record<string, string> = {
  pending_registration_payment: 'Upload Bukti Bayar',
  pending_registration_verification: 'Verifikasi Bukti Bayar',
  deposit_verified: 'Siap Aktivasi',
  assigned_to_branch: 'Siap Aktivasi',
  active: 'Aktif',
  rejected: 'Ditolak',
  registered_pending_mou: 'Pending MoU',
  pending_mou_approval: 'Menunggu Approve MoU',
  pending_deposit_payment: 'Bayar Deposit',
  pending_deposit_verification: 'Verifikasi Deposit'
};

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  ...Object.entries(OWNER_STATUS_LABELS).map(([value, label]) => ({ value, label }))
];

const KoordinatorOwnersPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [branchesForFilter, setBranchesForFilter] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterWilayahId, setFilterWilayahId] = useState<string>('');
  const [filterBranchId, setFilterBranchId] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;
  const [detailOwner, setDetailOwner] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVerifyMouModal, setShowVerifyMouModal] = useState(false);
  const [verifyMouProfile, setVerifyMouProfile] = useState<any | null>(null);
  const [verifyMouRejectReason, setVerifyMouRejectReason] = useState('');
  const [verifyingMou, setVerifyingMou] = useState(false);
  const [showVerifyRegPaymentModal, setShowVerifyRegPaymentModal] = useState(false);
  const [verifyRegPaymentProfile, setVerifyRegPaymentProfile] = useState<any | null>(null);
  const [verifyRegPaymentRejectReason, setVerifyRegPaymentRejectReason] = useState('');
  const [verifyingRegPayment, setVerifyingRegPayment] = useState(false);
  const [activateResult, setActivateResult] = useState<{ password: string; mouUrl: string } | null>(null);

  const isInvoiceKoordinator = user?.role === 'invoice_koordinator';
  const canAssignOrActivate = isInvoiceKoordinator;
  const canVerifyDeposit = user?.role === 'admin_pusat' || user?.role === 'super_admin';
  const isAdminPusatOrSuperAdmin = user?.role === 'admin_pusat' || user?.role === 'super_admin';
  const canVerifyMou = isAdminPusatOrSuperAdmin;

  const fetchStats = useCallback(() => {
    const params: { status?: string; wilayah_id?: string; branch_id?: string } = {};
    if (filterStatus) params.status = filterStatus;
    if (filterWilayahId) params.wilayah_id = filterWilayahId;
    if (filterBranchId) params.branch_id = filterBranchId;
    ownersApi.getStats(params)
      .then((r) => { if (r.data.success && r.data.data) setStats(r.data.data); })
      .catch(() => setStats(null));
  }, [filterStatus, filterWilayahId, filterBranchId]);

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; wilayah_id?: string; branch_id?: string; q?: string; page?: number; limit?: number } = {
        page,
        limit
      };
      if (filterStatus) params.status = filterStatus;
      if (filterWilayahId) params.wilayah_id = filterWilayahId;
      if (filterBranchId) params.branch_id = filterBranchId;
      if (filterSearch.trim()) params.q = filterSearch.trim();
      const res = await ownersApi.list(params);
      if (res.data.success) {
        setList(res.data.data || []);
        setTotal(res.data.total ?? 0);
      } else {
        setList([]);
        setTotal(0);
      }
    } catch {
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterWilayahId, filterBranchId, filterSearch, page, limit]);

  const fetchBranches = useCallback(async () => {
    if (!canAssignOrActivate) return;
    try {
      const params: { limit?: number; wilayah_id?: string } = { limit: 500 };
      if (user?.wilayah_id) params.wilayah_id = user.wilayah_id;
      const res = await branchesApi.list(params);
      if (res.data.success) setBranches(res.data.data || []);
      else setBranches([]);
    } catch {
      setBranches([]);
    }
  }, [canAssignOrActivate, user?.wilayah_id]);

  const fetchWilayahList = useCallback(async () => {
    if (!isAdminPusatOrSuperAdmin) return;
    try {
      const res = await branchesApi.listWilayah();
      if (res.data?.success && Array.isArray(res.data.data)) setWilayahList(res.data.data);
      else setWilayahList([]);
    } catch {
      setWilayahList([]);
    }
  }, [isAdminPusatOrSuperAdmin]);

  const fetchBranchesForFilter = useCallback(async () => {
    if (!isAdminPusatOrSuperAdmin) return;
    try {
      const params: { limit?: number; wilayah_id?: string } = { limit: 500 };
      if (filterWilayahId) params.wilayah_id = filterWilayahId;
      const res = await branchesApi.list(params);
      if (res.data.success) setBranchesForFilter(res.data.data || []);
      else setBranchesForFilter([]);
    } catch {
      setBranchesForFilter([]);
    }
  }, [isAdminPusatOrSuperAdmin, filterWilayahId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  useEffect(() => {
    if (canAssignOrActivate) fetchBranches();
  }, [canAssignOrActivate, fetchBranches]);

  useEffect(() => {
    fetchWilayahList();
  }, [fetchWilayahList]);

  useEffect(() => {
    fetchBranchesForFilter();
  }, [fetchBranchesForFilter]);

  const openDetail = useCallback(async (owner: any) => {
    setDetailOwner(owner);
    setShowDetailModal(true);
    try {
      const res = await ownersApi.getById(owner.id);
      if (res.data?.success && res.data?.data) setDetailOwner(res.data.data);
    } catch {
      setShowDetailModal(false);
    }
  }, []);

  const openVerifyMou = (owner: any) => {
    setVerifyMouProfile(owner);
    setVerifyMouRejectReason('');
    setShowVerifyMouModal(true);
  };

  const handleVerifyMou = async (approved: boolean) => {
    if (!verifyMouProfile) return;
    if (!approved && !verifyMouRejectReason.trim()) {
      showToast('Isi alasan penolakan.', 'warning');
      return;
    }
    setVerifyingMou(true);
    try {
      await ownersApi.verifyMou(verifyMouProfile.id, { approved, rejection_reason: verifyMouRejectReason.trim() || undefined });
      showToast(approved ? 'MoU disetujui.' : 'MoU ditolak.', 'success');
      setShowVerifyMouModal(false);
      setVerifyMouProfile(null);
      fetchOwners();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal', 'error');
    } finally {
      setVerifyingMou(false);
    }
  };

  const openVerifyRegPayment = (owner: any) => {
    setVerifyRegPaymentProfile(owner);
    setVerifyRegPaymentRejectReason('');
    setShowVerifyRegPaymentModal(true);
  };

  const handleVerifyRegistrationPayment = async (approved: boolean) => {
    if (!verifyRegPaymentProfile) return;
    if (!approved && !verifyRegPaymentRejectReason.trim()) {
      showToast('Isi alasan penolakan.', 'warning');
      return;
    }
    setVerifyingRegPayment(true);
    try {
      await ownersApi.verifyRegistrationPayment(verifyRegPaymentProfile.id, { approved, rejection_reason: verifyRegPaymentRejectReason.trim() || undefined });
      showToast(approved ? 'Bukti bayar disetujui.' : 'Bukti bayar ditolak.', 'success');
      setShowVerifyRegPaymentModal(false);
      setVerifyRegPaymentProfile(null);
      fetchOwners();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal', 'error');
    } finally {
      setVerifyingRegPayment(false);
    }
  };

  const handleVerifyDeposit = async (profileId: string) => {
    if (!canVerifyDeposit) return;
    setActingId(profileId);
    try {
      await ownersApi.verifyDeposit(profileId);
      showToast('Deposit terverifikasi.', 'success');
      fetchOwners();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal verifikasi deposit', 'error');
    } finally {
      setActingId(null);
    }
  };

  const handleActivate = async (profileId: string) => {
    if (!canAssignOrActivate) return;
    setActingId(profileId);
    try {
      const res = await ownersApi.activate(profileId);
      const data = res.data?.data;
      if (data?.generated_password != null && data?.mou_generated_url) {
        setActivateResult({ password: data.generated_password, mouUrl: data.mou_generated_url });
      } else {
        showToast('Owner berhasil diaktifkan.', 'success');
      }
      fetchOwners();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal aktivasi', 'error');
    } finally {
      setActingId(null);
    }
  };

  const resetFilters = () => {
    setFilterStatus('');
    setFilterWilayahId('');
    setFilterBranchId('');
    setFilterSearch('');
    setPage(1);
  };

  const applyFilters = () => {
    setPage(1);
    fetchOwners();
  };

  const hasActiveFilters = !!(filterStatus || filterWilayahId || filterBranchId || filterSearch.trim());
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owners Wilayah"
        subtitle={isAdminPusatOrSuperAdmin ? 'Daftar owner per wilayah. Filter menurut wilayah, cabang, status, dan cari nama/email.' : 'Owner yang dilayani koordinator wilayah Anda. Verifikasi bukti bayar/deposit lalu aktivasi.'}
        right={
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={() => { fetchStats(); fetchOwners(); }} disabled={loading} />
            <FilterIconButton open={showFilters} onToggle={() => setShowFilters((v) => !v)} hasActiveFilters={hasActiveFilters} />
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total Owner" value={stats?.total_owners ?? '–'} iconClassName="bg-[#0D1A63] text-white" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Aktif" value={stats?.active ?? '–'} iconClassName="bg-emerald-100 text-emerald-600" />
        <StatCard icon={<Zap className="w-5 h-5" />} label="Siap Aktivasi" value={stats?.siap_aktivasi ?? '–'} iconClassName="bg-amber-100 text-amber-600" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pending Verifikasi" value={stats?.pending_verifikasi ?? '–'} iconClassName="bg-sky-100 text-sky-600" />
        <StatCard icon={<FileCheck className="w-5 h-5" />} label="Pending MoU" value={stats?.pending_mou ?? '–'} iconClassName="bg-violet-100 text-violet-600" />
        <StatCard icon={<CreditCard className="w-5 h-5" />} label="Pending Bayar" value={stats?.pending_bayar ?? '–'} iconClassName="bg-teal-100 text-teal-600" />
        <StatCard icon={<XCircle className="w-5 h-5" />} label="Ditolak" value={stats?.rejected ?? '–'} iconClassName="bg-red-100 text-red-600" />
      </div>

      <PageFilter
        open={showFilters}
        onToggle={() => setShowFilters((v) => !v)}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
        hideToggleRow
        className="w-full"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {isAdminPusatOrSuperAdmin && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Wilayah</label>
                <select
                  value={filterWilayahId}
                  onChange={(e) => {
                    setFilterWilayahId(e.target.value);
                    setFilterBranchId('');
                    setPage(1);
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Semua wilayah</option>
                  {wilayahList.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cabang</label>
                <select
                  value={filterBranchId}
                  onChange={(e) => { setFilterBranchId(e.target.value); setPage(1); }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Semua cabang</option>
                  {branchesForFilter.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} – {b.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Cari nama / email</label>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="Nama, perusahaan, email..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </PageFilter>

      <Card>
        <CardSectionHeader
          icon={<Users className="w-6 h-6" />}
          title="Daftar Owner"
          subtitle={isAdminPusatOrSuperAdmin ? 'Daftar owner per wilayah. Verifikasi, aktivasi, atau kelola dari tabel.' : 'Owner yang dilayani koordinator wilayah Anda.'}
          className="mb-4"
        />
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Nama / Perusahaan</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Cabang</th>
                <th className="text-left py-3 px-4 w-32">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center">
                    <ContentLoading inline />
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    {hasActiveFilters ? 'Tidak ada owner sesuai filter.' : 'Belum ada owner di wilayah Anda.'}
                  </td>
                </tr>
              ) : (
                list.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-medium">{o.User?.name}</p>
                      {o.User?.company_name && <p className="text-xs text-slate-500">{o.User.company_name}</p>}
                    </td>
                    <td className="py-3 px-4">{o.User?.email}</td>
                    <td className="py-3 px-4">{OWNER_STATUS_LABELS[o.status] || o.status}</td>
                    <td className="py-3 px-4">{o.AssignedBranch?.name || '-'}</td>
                    <td className="py-3 px-4">
                      {(() => {
                        const items: ActionsMenuItem[] = [];
                        items.push({
                          id: 'detail',
                          label: 'Lihat Detail',
                          icon: <Eye className="w-4 h-4" />,
                          onClick: () => openDetail(o)
                        });
                        if (o.status === 'pending_registration_verification' && canVerifyMou) {
                          items.push({
                            id: 'verify-reg-payment',
                            label: 'Verifikasi Bukti Bayar',
                            icon: <FileCheck className="w-4 h-4" />,
                            onClick: () => openVerifyRegPayment(o)
                          });
                        }
                        if (o.status === 'pending_mou_approval' && canVerifyMou) {
                          items.push({
                            id: 'verify-mou',
                            label: 'Verifikasi MoU',
                            icon: <FileCheck className="w-4 h-4" />,
                            onClick: () => openVerifyMou(o)
                          });
                        }
                        if (o.status === 'pending_deposit_verification' && canVerifyDeposit) {
                          items.push({
                            id: 'verify-deposit',
                            label: 'Verifikasi Deposit',
                            icon: <CheckCircle className="w-4 h-4" />,
                            onClick: () => handleVerifyDeposit(o.id),
                            disabled: actingId !== null
                          });
                        }
                        if ((o.status === 'assigned_to_branch' || o.status === 'deposit_verified') && canAssignOrActivate) {
                          items.push({
                            id: 'activate',
                            label: 'Aktivasi',
                            icon: <CheckCircle className="w-4 h-4" />,
                            onClick: () => handleActivate(o.id),
                            disabled: actingId !== null
                          });
                        }
                        return <ActionsMenu align="right" items={items} />;
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > limit && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50">
            <span className="text-sm text-slate-600">
              Menampilkan {from}–{to} dari {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-600 px-1">
                Halaman {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal Detail Owner */}
      <Modal open={showDetailModal && !!detailOwner} onClose={() => setShowDetailModal(false)}>
        {detailOwner && (
          <ModalBox>
            <ModalHeader title="Detail Owner" subtitle="Data lengkap owner dan perusahaan" icon={<Eye className="w-5 h-5" />} onClose={() => setShowDetailModal(false)} />
            <ModalBody className="space-y-3 text-sm">
              <div><span className="text-slate-500">Nama</span><p className="font-medium">{detailOwner.User?.name || '-'}</p></div>
              <div><span className="text-slate-500">Perusahaan</span><p className="font-medium">{detailOwner.User?.company_name || '-'}</p></div>
              <div><span className="text-slate-500">Email</span><p>{detailOwner.User?.email || '-'}</p></div>
              <div><span className="text-slate-500">Telepon</span><p>{detailOwner.User?.phone || detailOwner.phone || '-'}</p></div>
              <div><span className="text-slate-500">Status</span><p><Badge variant={detailOwner.status === 'active' ? 'success' : detailOwner.status === 'rejected' ? 'error' : 'warning'}>{OWNER_STATUS_LABELS[detailOwner.status] || detailOwner.status}</Badge></p></div>
              <div><span className="text-slate-500">Cabang</span><p>{detailOwner.AssignedBranch ? `${detailOwner.AssignedBranch.code} – ${detailOwner.AssignedBranch.name}` : '-'}</p></div>
              {detailOwner.User?.address && <div><span className="text-slate-500">Alamat</span><p>{detailOwner.User.address}</p></div>}
              {detailOwner.User?.whatsapp && <div><span className="text-slate-500">WhatsApp</span><p>{detailOwner.User.whatsapp}</p></div>}
            </ModalBody>
          </ModalBox>
        )}
      </Modal>

      {/* Modal Verifikasi Bukti Bayar Pendaftaran */}
      <Modal open={showVerifyRegPaymentModal && !!verifyRegPaymentProfile} onClose={() => setShowVerifyRegPaymentModal(false)}>
        {verifyRegPaymentProfile && (
          <ModalBox>
            <ModalHeader
              title="Verifikasi Bukti Bayar Pendaftaran"
              subtitle={`${verifyRegPaymentProfile.User?.name || verifyRegPaymentProfile.User?.company_name} – ${verifyRegPaymentProfile.User?.email}`}
              icon={<FileCheck className="w-5 h-5" />}
              onClose={() => setShowVerifyRegPaymentModal(false)}
            />
            <ModalBody className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Alasan penolakan (jika tolak)</label>
                <textarea
                  value={verifyRegPaymentRejectReason}
                  onChange={(e) => setVerifyRegPaymentRejectReason(e.target.value)}
                  placeholder="Opsional jika setujui"
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowVerifyRegPaymentModal(false)}>Batal</Button>
              <Button variant="outline" onClick={() => handleVerifyRegistrationPayment(false)} disabled={verifyingRegPayment || !verifyRegPaymentRejectReason.trim()}>Tolak</Button>
              <Button variant="primary" onClick={() => handleVerifyRegistrationPayment(true)} disabled={verifyingRegPayment}>{verifyingRegPayment ? 'Memproses...' : 'Setujui Bukti Bayar'}</Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal Verifikasi MoU */}
      <Modal open={showVerifyMouModal && !!verifyMouProfile} onClose={() => setShowVerifyMouModal(false)}>
        {verifyMouProfile && (
          <ModalBox>
            <ModalHeader
              title="Verifikasi MoU"
              subtitle={`${verifyMouProfile.User?.name || verifyMouProfile.User?.company_name} – ${verifyMouProfile.User?.email}`}
              icon={<CreditCard className="w-5 h-5" />}
              onClose={() => setShowVerifyMouModal(false)}
            />
            <ModalBody className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Alasan penolakan (jika tolak)</label>
                <textarea
                  value={verifyMouRejectReason}
                  onChange={(e) => setVerifyMouRejectReason(e.target.value)}
                  placeholder="Opsional jika setujui"
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowVerifyMouModal(false)}>Batal</Button>
              <Button variant="outline" onClick={() => handleVerifyMou(false)} disabled={verifyingMou || !verifyMouRejectReason.trim()}>Tolak</Button>
              <Button variant="primary" onClick={() => handleVerifyMou(true)} disabled={verifyingMou}>{verifyingMou ? 'Memproses...' : 'Setujui MoU'}</Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal Hasil Aktivasi: password baru + link MOU */}
      <Modal open={!!activateResult} onClose={() => setActivateResult(null)}>
        {activateResult && (
          <ModalBox>
            <ModalHeader title="Owner Diaktivasi" subtitle="Berikan password baru kepada owner. Password lama tidak berlaku." icon={<CheckCircle className="w-5 h-5" />} onClose={() => setActivateResult(null)} />
            <ModalBody className="space-y-4">
            <p className="text-sm text-slate-600 mb-3">Berikan data berikut kepada owner. Password lama tidak berlaku.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Password baru</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-100 rounded-lg font-mono text-sm break-all">{activateResult.password}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(activateResult.password); showToast('Disalin', 'success'); }}>Salin</Button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Surat MoU</label>
                <a href={`${UPLOAD_BASE}${activateResult.mouUrl}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-sm">
                  Unduh / Buka MoU (PDF)
                </a>
              </div>
            </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="primary" className="w-full" onClick={() => setActivateResult(null)}>Tutup</Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>
    </div>
  );
};

export default KoordinatorOwnersPage;
