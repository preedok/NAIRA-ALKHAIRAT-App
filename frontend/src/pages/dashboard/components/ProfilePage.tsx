import React, { useState, useEffect, useCallback } from 'react';
import { Save, FileText, Download, ExternalLink, Shield, Building2, User, CheckCircle, Clock, Lock, Eye, EyeOff, Mail } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { authApi, ownersApi, type OwnerProfile } from '../../../services/api';
import { API_BASE_URL } from '../../../utils/constants';
import { CONTENT_LOADING_MESSAGE, AutoRefreshControl } from '../../../components/common';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import { ROLE_NAMES } from '../../../types';

const UPLOAD_BASE = (API_BASE_URL || '').replace(/\/api\/v1\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'mou' | 'security'>('profile');

  const isOwner = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';

  const fetchProfile = useCallback(() => {
    if (!isOwner) return;
    setOwnerLoading(true);
    ownersApi
      .getMe()
      .then((res) => {
        if (res.data?.success && res.data?.data) setOwnerProfile(res.data.data);
      })
      .catch(() => setOwnerProfile(null))
      .finally(() => setOwnerLoading(false));
  }, [isOwner]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { showToast('Password baru minimal 6 karakter', 'error'); return; }
    if (newPassword !== confirmPassword) { showToast('Konfirmasi password tidak cocok', 'error'); return; }
    if (!currentPassword.trim()) { showToast('Masukkan password saat ini', 'error'); return; }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      showToast('Password berhasil diubah', 'success');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Gagal mengubah password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const mouUrl = ownerProfile?.mou_generated_url
    ? `${UPLOAD_BASE.replace(/\/$/, '')}${ownerProfile.mou_generated_url.startsWith('/') ? '' : '/'}${ownerProfile.mou_generated_url}`
    : '';

  const isOwnerMou = user?.role === 'owner_mou';
  const tabs = [
    { id: 'profile' as const, label: 'Profil', icon: User },
    ...(isOwnerMou ? [{ id: 'mou' as const, label: 'Surat MoU', icon: FileText }] : []),
    { id: 'security' as const, label: 'Keamanan', icon: Shield },
  ];

  useEffect(() => {
    if (activeTab === 'mou' && !isOwnerMou) setActiveTab('profile');
  }, [activeTab, isOwnerMou]);

  const avatarInitial = user?.name?.charAt(0)?.toUpperCase() || '?';
  const roleLabel = user?.role ? (ROLE_NAMES[user.role as keyof typeof ROLE_NAMES] || user.role) : '—';
  const passwordStrength = newPassword.length === 0 ? 0 : newPassword.length < 6 ? 1 : newPassword.length < 10 ? 2 : 3;
  const strengthLabels = ['', 'Lemah', 'Sedang', 'Kuat'];
  const strengthColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500'];

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-100">
      {/* Header - neutral modern */}
      <div className="w-full flex-shrink-0 border-b border-slate-200 bg-white">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-slate-700 flex items-center justify-center text-2xl md:text-3xl font-bold text-white shadow-sm">
                  {avatarInitial}
                </div>
                {isOwner && ownerProfile?.activated_at && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow">
                    <CheckCircle size={14} className="text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{user?.name || '—'}</h1>
                <p className="mt-0.5 flex items-center gap-2 text-slate-500 text-sm truncate">
                  <Mail size={14} className="flex-shrink-0" />
                  {user?.email || '—'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {roleLabel}
                  </span>
                  {user?.company_name && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      <Building2 size={12} />
                      {user.company_name}
                    </span>
                  )}
                  {isOwner && ownerProfile?.AssignedBranch && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {ownerProfile.AssignedBranch.code} – {ownerProfile.AssignedBranch.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <AutoRefreshControl onRefresh={fetchProfile} disabled={ownerLoading} size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + content */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col gap-6">
          <nav className="flex gap-1 p-1 rounded-lg bg-slate-200/70 w-fit border border-slate-200/80" aria-label="Tabs">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === id
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0">
            {activeTab === 'profile' && (
              <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200/80">
                      <User className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Informasi Akun</h2>
                      <p className="text-sm text-slate-500">Data pribadi dan organisasi Anda</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {[
                      { label: 'Nama Lengkap', value: user?.name },
                      { label: 'Alamat Email', value: user?.email },
                      { label: 'Peran Akun', value: roleLabel },
                      { label: 'Nama Perusahaan', value: user?.company_name },
                      ...(isOwner && ownerProfile?.AssignedBranch
                        ? [{ label: 'Cabang', value: `${ownerProfile.AssignedBranch.code} – ${ownerProfile.AssignedBranch.name}` }]
                        : []),
                      ...(isOwner && ownerProfile?.activated_at
                        ? [{ label: 'Tanggal Aktivasi', value: formatDate(ownerProfile.activated_at) }]
                        : []),
                    ].map(
                      (item) =>
                        item.value && (
                          <div key={item.label} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                              {item.label}
                            </span>
                            <span className="text-base font-medium text-slate-800">{item.value}</span>
                          </div>
                        )
                    )}
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'mou' && isOwnerMou && (
              <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Surat MoU</h2>
                      <p className="text-sm text-slate-500">Dokumen perjanjian kerjasama Anda dengan kami</p>
                    </div>
                  </div>

                  {ownerLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <div className="w-10 h-10 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                      <p className="text-sm text-slate-500">{CONTENT_LOADING_MESSAGE}</p>
                    </div>
                  ) : mouUrl ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-5 p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80">
                        <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shadow-sm">
                          <FileText className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-800">Dokumen MoU Tersedia</p>
                          <p className="text-sm text-emerald-600 mt-0.5">Dokumen ditandatangani dan siap diakses</p>
                          {ownerProfile?.activated_at && (
                            <p className="flex items-center gap-1.5 mt-2 text-xs text-emerald-700 font-medium">
                              <Clock size={14} />
                              Aktivasi: {formatDate(ownerProfile.activated_at)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => window.open(mouUrl, '_blank')}
                          icon={<ExternalLink size={18} />}
                        >
                          Buka di Tab Baru
                        </Button>
                        <a href={mouUrl} download className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-emerald-200 text-emerald-700 font-semibold text-sm hover:bg-emerald-50 transition-colors">
                          <Download size={18} />
                          Unduh PDF
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center py-12 px-4">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center mb-4">
                        <FileText className="w-10 h-10 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-700">MoU Belum Tersedia</p>
                      <p className="mt-2 text-sm text-slate-500 max-w-md">
                        Setelah akun Anda diaktivasi oleh Admin Pusat, surat MoU akan muncul di sini dan dikirim ke email Anda.
                      </p>
                      <div className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 border border-slate-200">
                        <span className="text-xs font-semibold text-slate-500 uppercase">Email terdaftar</span>
                        <span className="text-sm font-medium text-slate-700">{user?.email ?? '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200/80">
                      <Shield className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Keamanan Akun</h2>
                      <p className="text-sm text-slate-500">Perbarui password untuk menjaga keamanan akun</p>
                    </div>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-5 max-w-xl">
                    <Input
                      label="Password Saat Ini"
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan password saat ini"
                      autoComplete="current-password"
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowCurrent((p) => !p)}
                          className="text-slate-400 hover:text-slate-600"
                          aria-label={showCurrent ? 'Sembunyikan' : 'Tampilkan'}
                        >
                          {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                    <Input
                      label="Password Baru"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      autoComplete="new-password"
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowNew((p) => !p)}
                          className="text-slate-400 hover:text-slate-600"
                          aria-label={showNew ? 'Sembunyikan' : 'Tampilkan'}
                        >
                          {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                    <Input
                      label="Konfirmasi Password Baru"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      autoComplete="new-password"
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowConfirm((p) => !p)}
                          className="text-slate-400 hover:text-slate-600"
                          aria-label={showConfirm ? 'Sembunyikan' : 'Tampilkan'}
                        >
                          {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />

                    {newPassword.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1 flex-1">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span
                          className={`text-sm font-semibold min-w-[4rem] ${
                            passwordStrength === 1
                              ? 'text-red-500'
                              : passwordStrength === 2
                                ? 'text-amber-500'
                                : 'text-emerald-600'
                          }`}
                        >
                          {strengthLabels[passwordStrength]}
                        </span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={saving}
                      isLoading={saving}
                      icon={!saving ? <Save size={18} /> : undefined}
                      className="mt-2"
                    >
                      {saving ? 'Menyimpan...' : 'Simpan Password'}
                    </Button>
                  </form>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
