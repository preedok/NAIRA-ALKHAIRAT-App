import React, { useState, useEffect } from 'react';
import { Save, FileText, Download, ExternalLink, Shield, Building2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { authApi, ownersApi, type OwnerProfile } from '../../../services/api';
import { API_BASE_URL } from '../../../utils/constants';

const UPLOAD_BASE = (API_BASE_URL || '').replace(/\/api\/v1\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);

  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (!isOwner) return;
    setOwnerLoading(true);
    ownersApi
      .getMe()
      .then((res) => { if (res.data?.success && res.data?.data) setOwnerProfile(res.data.data); })
      .catch(() => setOwnerProfile(null))
      .finally(() => setOwnerLoading(false));
  }, [isOwner]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Password baru minimal 6 karakter', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi password tidak cocok', 'error');
      return;
    }
    if (!currentPassword.trim()) {
      showToast('Masukkan password saat ini', 'error');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      showToast('Password berhasil diubah', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Gagal mengubah password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const mouUrl = ownerProfile?.mou_generated_url
    ? `${UPLOAD_BASE.replace(/\/$/, '')}${ownerProfile.mou_generated_url.startsWith('/') ? '' : '/'}${ownerProfile.mou_generated_url}`
    : '';

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Profil</h1>
        <p className="text-slate-500 mt-1">Kelola data akun, MoU, dan keamanan</p>
      </div>

      {/* Card: Info akun */}
      <Card className="overflow-hidden border-0 shadow-lg shadow-slate-200/50 bg-gradient-to-br from-slate-50 to-white">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h2 className="text-xl font-semibold text-slate-900">{user?.name || '—'}</h2>
              <p className="text-slate-500 mt-0.5 flex items-center justify-center sm:justify-start gap-1.5">
                <span className="truncate">{user?.email || '—'}</span>
              </p>
              {user?.company_name && (
                <p className="text-slate-600 mt-2 flex items-center justify-center sm:justify-start gap-1.5 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  {user.company_name}
                </p>
              )}
              {isOwner && ownerProfile?.AssignedBranch && (
                <p className="text-slate-500 text-sm mt-1">
                  Cabang: {ownerProfile.AssignedBranch.code} – {ownerProfile.AssignedBranch.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Card: MoU (hanya owner) */}
      {isOwner && (
        <Card className="overflow-hidden border-0 shadow-lg shadow-slate-200/50">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Surat MoU</h2>
                <p className="text-sm text-slate-500">Dokumen perjanjian kerjasama Anda</p>
              </div>
            </div>
            {ownerLoading ? (
              <div className="py-8 text-center text-slate-500">Memuat...</div>
            ) : mouUrl ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-sm text-emerald-800 font-medium">MoU tersedia</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Anda dapat melihat atau mengunduh dokumen di bawah.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.open(mouUrl, '_blank')}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Buka di tab baru
                  </Button>
                  <a
                    href={mouUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-medium text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Unduh PDF
                  </a>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500">Aktivasi: {formatDate(ownerProfile?.activated_at)}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4 rounded-xl bg-slate-50 border border-slate-100">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">MoU belum tersedia</p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  Setelah akun Anda diaktivasi oleh Admin Pusat, surat MoU akan muncul di sini dan dikirim ke email Anda.
                </p>
                <p className="text-xs text-slate-400 mt-3">Email: {user?.email ?? '—'}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Card: Ubah password */}
      <Card className="overflow-hidden border-0 shadow-lg shadow-slate-200/50">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Keamanan</h2>
              <p className="text-sm text-slate-500">Ubah password akun Anda</p>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password saat ini</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-shadow"
                placeholder="Masukkan password saat ini"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password baru</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-shadow"
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Konfirmasi password baru</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-shadow"
                placeholder="Ulangi password baru"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" variant="primary" disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan password'}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default ProfilePage;
