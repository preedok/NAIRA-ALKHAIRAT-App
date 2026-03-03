import React, { useState, useEffect, useCallback } from 'react';
import { Save, FileText, Download, ExternalLink, Shield, Building2, User, CheckCircle, Clock, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { authApi, ownersApi, type OwnerProfile } from '../../../services/api';
import { API_BASE_URL } from '../../../utils/constants';
import { CONTENT_LOADING_MESSAGE, AutoRefreshControl } from '../../../components/common';

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

  const isOwner = user?.role === 'owner';

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

  const tabs = [
    { id: 'profile' as const, label: 'Profil', icon: User },
    ...(isOwner ? [{ id: 'mou' as const, label: 'Surat MoU', icon: FileText }] : []),
    { id: 'security' as const, label: 'Keamanan', icon: Shield },
  ];

  const avatarInitial = user?.name?.charAt(0)?.toUpperCase() || '?';
  const passwordStrength = newPassword.length === 0 ? 0 : newPassword.length < 6 ? 1 : newPassword.length < 10 ? 2 : 3;
  const strengthLabels = ['', 'Lemah', 'Sedang', 'Kuat'];
  const strengthColors = ['', '#ef4444', '#f59e0b', '#10b981'];

  return (
    <div style={styles.page}>
      <div className="flex justify-end mb-4">
        <AutoRefreshControl onRefresh={fetchProfile} disabled={ownerLoading} size="sm" />
      </div>
      {/* Hero header */}
      <div style={styles.heroSection}>
        <div style={styles.heroBg} />
        <div style={styles.heroContent}>
          <div style={styles.avatarWrap}>
            <div style={styles.avatarRing}>
              <div style={styles.avatar}>{avatarInitial}</div>
            </div>
            {isOwner && ownerProfile?.activated_at && (
              <div style={styles.verifiedBadge}>
                <CheckCircle size={12} color="#fff" />
              </div>
            )}
          </div>
          <div style={styles.heroText}>
            <h1 style={styles.heroName}>{user?.name || '—'}</h1>
            <p style={styles.heroEmail}>{user?.email || '—'}</p>
            <div style={styles.heroBadges}>
              <span style={styles.roleBadge}>{user?.role || 'user'}</span>
              {user?.company_name && (
                <span style={styles.companyBadge}>
                  <Building2 size={11} style={{ marginRight: 4 }} />
                  {user.company_name}
                </span>
              )}
              {isOwner && ownerProfile?.AssignedBranch && (
                <span style={styles.branchBadge}>
                  {ownerProfile.AssignedBranch.code} – {ownerProfile.AssignedBranch.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        <div style={styles.tabList}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              style={{ ...styles.tab, ...(activeTab === id ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={15} style={{ marginRight: 6 }} />
              {label}
              {activeTab === id && <div style={styles.tabUnderline} />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardIconWrap}>
                <User size={18} color="#6366f1" />
              </div>
              <div>
                <h2 style={styles.cardTitle}>Informasi Akun</h2>
                <p style={styles.cardSub}>Data pribadi dan organisasi Anda</p>
              </div>
            </div>
            <div style={styles.divider} />
            <div style={styles.infoGrid}>
              {[
                { label: 'Nama Lengkap', value: user?.name },
                { label: 'Alamat Email', value: user?.email },
                { label: 'Peran Akun', value: user?.role },
                { label: 'Nama Perusahaan', value: user?.company_name },
                ...(isOwner && ownerProfile?.AssignedBranch ? [
                  { label: 'Cabang', value: `${ownerProfile.AssignedBranch.code} – ${ownerProfile.AssignedBranch.name}` },
                ] : []),
                ...(isOwner && ownerProfile?.activated_at ? [
                  { label: 'Tanggal Aktivasi', value: formatDate(ownerProfile.activated_at) },
                ] : []),
              ].map(({ label, value }) => value ? (
                <div key={label} style={styles.infoItem}>
                  <span style={styles.infoLabel}>{label}</span>
                  <span style={styles.infoValue}>{value}</span>
                </div>
              ) : null)}
            </div>
          </div>
        )}

        {/* ── MOU TAB ── */}
        {activeTab === 'mou' && isOwner && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={{ ...styles.cardIconWrap, background: '#f0fdf4' }}>
                <FileText size={18} color="#16a34a" />
              </div>
              <div>
                <h2 style={styles.cardTitle}>Surat MoU</h2>
                <p style={styles.cardSub}>Dokumen perjanjian kerjasama Anda dengan kami</p>
              </div>
            </div>
            <div style={styles.divider} />

            {ownerLoading ? (
              <div style={styles.mouLoading}>
                <div style={styles.spinner} />
                <p style={{ color: '#94a3b8', fontSize: 14 }}>{CONTENT_LOADING_MESSAGE}</p>
              </div>
            ) : mouUrl ? (
              <div>
                <div style={styles.mouAvailable}>
                  <div style={styles.mouIcon}>
                    <FileText size={36} color="#16a34a" />
                  </div>
                  <div>
                    <p style={styles.mouAvailTitle}>Dokumen MoU Tersedia</p>
                    <p style={styles.mouAvailSub}>Dokumen ditandatangani dan siap diakses</p>
                    {ownerProfile?.activated_at && (
                      <p style={styles.mouDate}>
                        <Clock size={12} style={{ marginRight: 4 }} />
                        Aktivasi: {formatDate(ownerProfile.activated_at)}
                      </p>
                    )}
                  </div>
                </div>
                <div style={styles.mouActions}>
                  <button style={styles.btnPrimary} onClick={() => window.open(mouUrl, '_blank')}>
                    <ExternalLink size={15} style={{ marginRight: 8 }} />
                    Buka di Tab Baru
                  </button>
                  <a href={mouUrl} download style={{ ...styles.btnSecondary, textDecoration: 'none' }}>
                    <Download size={15} style={{ marginRight: 8 }} />
                    Unduh PDF
                  </a>
                </div>
              </div>
            ) : (
              <div style={styles.mouEmpty}>
                <div style={styles.mouEmptyIcon}>
                  <FileText size={40} color="#cbd5e1" />
                </div>
                <p style={styles.mouEmptyTitle}>MoU Belum Tersedia</p>
                <p style={styles.mouEmptyDesc}>
                  Setelah akun Anda diaktivasi oleh Admin Pusat, surat MoU akan muncul di sini dan dikirim ke email Anda.
                </p>
                <div style={styles.mouEmailBox}>
                  <span style={styles.mouEmailLabel}>Email terdaftar</span>
                  <span style={styles.mouEmailVal}>{user?.email ?? '—'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {activeTab === 'security' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={{ ...styles.cardIconWrap, background: '#fdf4ff' }}>
                <Shield size={18} color="#a855f7" />
              </div>
              <div>
                <h2 style={styles.cardTitle}>Keamanan Akun</h2>
                <p style={styles.cardSub}>Perbarui password untuk menjaga keamanan akun</p>
              </div>
            </div>
            <div style={styles.divider} />

            <form onSubmit={handleChangePassword} style={styles.form}>
              {[
                { label: 'Password Saat Ini', value: currentPassword, set: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(p => !p), auto: 'current-password', placeholder: 'Masukkan password saat ini' },
                { label: 'Password Baru', value: newPassword, set: setNewPassword, show: showNew, toggle: () => setShowNew(p => !p), auto: 'new-password', placeholder: 'Minimal 6 karakter' },
                { label: 'Konfirmasi Password Baru', value: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(p => !p), auto: 'new-password', placeholder: 'Ulangi password baru' },
              ].map(({ label, value, set, show, toggle, auto, placeholder }) => (
                <div key={label} style={styles.fieldGroup}>
                  <label style={styles.label}>{label}</label>
                  <div style={styles.inputWrap}>
                    <Lock size={16} color="#94a3b8" style={styles.inputIcon} />
                    <input
                      type={show ? 'text' : 'password'}
                      value={value}
                      onChange={e => set(e.target.value)}
                      style={styles.input}
                      placeholder={placeholder}
                      autoComplete={auto}
                    />
                    <button type="button" onClick={toggle} style={styles.eyeBtn}>
                      {show ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                    </button>
                  </div>
                </div>
              ))}

              {/* Password strength */}
              {newPassword.length > 0 && (
                <div style={styles.strengthWrap}>
                  <div style={styles.strengthBars}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ ...styles.strengthBar, background: i <= passwordStrength ? strengthColors[passwordStrength] : '#e2e8f0' }} />
                    ))}
                  </div>
                  <span style={{ ...styles.strengthLabel, color: strengthColors[passwordStrength] }}>
                    {strengthLabels[passwordStrength]}
                  </span>
                </div>
              )}

              <button type="submit" style={styles.submitBtn} disabled={saving}>
                {saving ? (
                  <><div style={styles.spinnerSm} /> Menyimpan...</>
                ) : (
                  <><Save size={15} style={{ marginRight: 8 }} /> Simpan Password</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Styles ─── */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },
  heroSection: {
    position: 'relative',
    overflow: 'hidden',
    padding: '48px 40px 36px',
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
  },
  heroBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(99,102,241,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(167,139,250,0.2) 0%, transparent 40%)',
    pointerEvents: 'none',
  },
  heroContent: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 28,
    maxWidth: 1200,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarRing: {
    padding: 3,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #818cf8, #c084fc)',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#1e1b4b',
    border: '3px solid #1e1b4b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: 700,
    color: '#a5b4fc',
    letterSpacing: -1,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    background: '#16a34a',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #1e1b4b',
  },
  heroText: {
    flex: 1,
  },
  heroName: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroEmail: {
    margin: '4px 0 12px',
    fontSize: 14,
    color: '#a5b4fc',
  },
  heroBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleBadge: {
    padding: '3px 12px',
    background: 'rgba(165,180,252,0.2)',
    border: '1px solid rgba(165,180,252,0.3)',
    borderRadius: 20,
    fontSize: 12,
    color: '#c7d2fe',
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  companyBadge: {
    padding: '3px 12px',
    background: 'rgba(165,180,252,0.15)',
    border: '1px solid rgba(165,180,252,0.25)',
    borderRadius: 20,
    fontSize: 12,
    color: '#c7d2fe',
    display: 'flex',
    alignItems: 'center',
  },
  branchBadge: {
    padding: '3px 12px',
    background: 'rgba(52,211,153,0.15)',
    border: '1px solid rgba(52,211,153,0.3)',
    borderRadius: 20,
    fontSize: 12,
    color: '#6ee7b7',
    fontWeight: 500,
  },

  /* Tab bar */
  tabBar: {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 40px',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  tabList: {
    display: 'flex',
    gap: 4,
  },
  tab: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#94a3b8',
    transition: 'color 0.2s',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    color: '#4f46e5',
    fontWeight: 600,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
    borderRadius: '2px 2px 0 0',
  },

  /* Content */
  content: {
    padding: '32px 40px 60px',
    maxWidth: 760,
  },

  /* Card */
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '24px 28px',
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#eef2ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: '#0f172a',
  },
  cardSub: {
    margin: '2px 0 0',
    fontSize: 13,
    color: '#94a3b8',
  },
  divider: {
    height: 1,
    background: '#f1f5f9',
    margin: '0 28px',
  },

  /* Info grid */
  infoGrid: {
    padding: '20px 28px 28px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: 500,
  },

  /* MoU */
  mouLoading: {
    padding: '48px 28px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  mouAvailable: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    margin: '24px 28px',
    padding: '20px 24px',
    background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
    borderRadius: 12,
    border: '1px solid #bbf7d0',
  },
  mouIcon: {
    width: 64,
    height: 64,
    background: '#fff',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(22,163,74,0.15)',
  },
  mouAvailTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#15803d',
  },
  mouAvailSub: {
    margin: '4px 0',
    fontSize: 13,
    color: '#16a34a',
  },
  mouDate: {
    display: 'flex',
    alignItems: 'center',
    margin: '6px 0 0',
    fontSize: 12,
    color: '#4ade80',
    fontWeight: 500,
  },
  mouActions: {
    display: 'flex',
    gap: 12,
    padding: '0 28px 28px',
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
  },
  btnSecondary: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 20px',
    background: '#fff',
    color: '#16a34a',
    border: '1.5px solid #bbf7d0',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  mouEmpty: {
    padding: '40px 28px 36px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  mouEmptyIcon: {
    width: 80,
    height: 80,
    background: '#f8fafc',
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    border: '2px dashed #e2e8f0',
  },
  mouEmptyTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: '#475569',
  },
  mouEmptyDesc: {
    margin: '8px 0 20px',
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 1.6,
    maxWidth: 420,
  },
  mouEmailBox: {
    padding: '12px 24px',
    background: '#f8fafc',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  mouEmailLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 600,
  },
  mouEmailVal: {
    fontSize: 14,
    color: '#334155',
    fontWeight: 500,
  },

  /* Form */
  form: {
    padding: '24px 28px 28px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    pointerEvents: 'none' as const,
  },
  input: {
    width: '100%',
    padding: '12px 44px 12px 42px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    fontSize: 14,
    color: '#1e293b',
    background: '#fafafa',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box' as const,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  strengthWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: -8,
  },
  strengthBars: {
    display: 'flex',
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    transition: 'background 0.3s',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: 600,
    minWidth: 40,
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '13px 24px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
    marginTop: 4,
    transition: 'opacity 0.2s',
  },
  spinnerSm: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.4)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginRight: 8,
  },
};

/* Inject keyframe */
if (typeof document !== 'undefined') {
  const id = '__profile_spin';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `@keyframes spin { to { transform: rotate(360deg) } }`;
    document.head.appendChild(s);
  }
}

export default ProfilePage;