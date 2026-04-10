import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { ownersApi } from '../../../services/api';
import { OWNER_STATUS_LABELS, type OwnerStatus } from '../../../types';

const STATUS = {
  pending_registration_payment: 'pending_registration_payment',
  pending_registration_verification: 'pending_registration_verification',
  deposit_verified: 'deposit_verified',
  assigned_to_branch: 'assigned_to_branch',
  active: 'active',
  rejected: 'rejected',
} as const;

const STEPS_MOU = [
  { key: STATUS.pending_registration_payment, label: 'Pembayaran', short: '01' },
  { key: STATUS.pending_registration_verification, label: 'Verifikasi', short: '02' },
  { key: STATUS.deposit_verified, label: 'Aktivasi', short: '03' },
  { key: STATUS.active, label: 'Selesai', short: '04' },
];

const STEPS_NON_MOU = [
  { label: 'Daftar', short: '01' },
  { label: 'Verifikasi', short: '02' },
  { label: 'Aktivasi', short: '03' },
  { label: 'Selesai', short: '04' },
];

function getStepIndex(status: string) {
  if (status === STATUS.pending_registration_payment) return 0;
  if (status === STATUS.pending_registration_verification) return 1;
  if (status === STATUS.deposit_verified || status === STATUS.assigned_to_branch) return 2;
  if (status === STATUS.active) return 3;
  if (status === STATUS.rejected) return -1;
  return 0;
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);
// ─────────────────────────────────────────────────────────────────────────────

const OwnerActivationPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<{
    status: string;
    registration_payment_proof_url?: string | null;
    mou_rejected_reason?: string | null;
    is_mou_owner?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    ownersApi.getMe()
      .then((res: any) => {
        if (!cancelled && res.data.success && res.data.data) setProfile(res.data.data);
      })
      .catch(() => { if (!cancelled) setProfile(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleUpload = async (file: File) => {
    setError(''); setSuccess(''); setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res: any = await ownersApi.uploadRegistrationPayment(formData);
      if (res.data.success) {
        setSuccess(res.data.message || 'Bukti bayar berhasil diupload.');
        setProfile((p) => p ? { ...p, status: res.data.data?.owner_status || p.status } : null);
        refreshUser();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload gagal. Coba lagi.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const status = (profile?.status || (user as any)?.owner_status || '') as OwnerStatus;
  const isMouOwner = user?.role === 'owner_mou' || profile?.is_mou_owner === true;
  const isPendingPayment = status === STATUS.pending_registration_payment && isMouOwner;
  const isPendingVerification = status === STATUS.pending_registration_verification;
  const isRejected = status === STATUS.rejected;
  const isWaitingActivation = status === STATUS.deposit_verified || status === STATUS.assigned_to_branch;
  const currentStep = getStepIndex(status);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .oap-root {
          --accent: #0d9488;
          --accent-light: #14b8a6;
          --accent-dim: rgba(13,148,136,0.08);
          --accent-border: rgba(13,148,136,0.35);
          --bg: #f0f9ff;
          --surface: #ffffff;
          --surface-2: #f8fafc;
          --surface-3: #e2e8f0;
          --text: #0f172a;
          --text-muted: #475569;
          --text-dim: #64748b;
          --danger: #dc2626;
          --danger-dim: rgba(220,38,38,0.08);
          --success: #1e40af;
          --success-dim: rgba(30,64,175,0.1);
          --amber: #d97706;

          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          min-height: 100vh;
          color: var(--text);
          padding: 48px 24px 80px;
          overflow-x: hidden;
          position: relative;
        }

        .oap-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 80% -20%, rgba(13,148,136,0.06) 0%, transparent 50%),
            radial-gradient(ellipse 50% 40% at -10% 90%, rgba(99,102,241,0.04) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        .oap-inner {
          position: relative;
          z-index: 1;
          max-width: 680px;
          margin: 0 auto;
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .oap-inner.mounted { opacity: 1; transform: translateY(0); }

        /* Header */
        .oap-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .oap-eyebrow::before {
          content: '';
          display: block;
          width: 24px; height: 1px;
          background: var(--accent);
        }
        .oap-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(28px, 5vw, 40px);
          line-height: 1.15;
          color: var(--text);
          margin-bottom: 10px;
          letter-spacing: -0.01em;
        }
        .oap-subtitle {
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 300;
          line-height: 1.6;
          margin-bottom: 40px;
        }

        /* Step progress */
        .oap-steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          margin-bottom: 40px;
          position: relative;
        }
        .oap-step-track {
          position: absolute;
          top: 18px;
          left: calc(12.5%);
          right: calc(12.5%);
          height: 2px;
          background: var(--surface-3);
          z-index: 0;
          border-radius: 1px;
        }
        .oap-step-fill {
          position: absolute;
          left: 0; top: 0; height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--accent-light));
          transition: width 0.7s cubic-bezier(0.4,0,0.2,1);
          border-radius: 1px;
        }
        .oap-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          position: relative;
          z-index: 1;
          cursor: default;
        }
        .oap-step-dot {
          width: 36px; height: 36px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          transition: all 0.4s ease;
          position: relative;
        }
        .oap-step-dot.done {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 0 0 4px var(--accent-dim), 0 4px 16px rgba(13,148,136,0.2);
        }
        .oap-step-dot.active {
          background: var(--surface);
          color: var(--accent);
          border: 1.5px solid var(--accent);
          box-shadow: 0 0 0 4px var(--accent-dim);
          animation: pulse-dot 2.5s ease-in-out infinite;
        }
        .oap-step-dot.idle {
          background: var(--surface-2);
          color: var(--text-dim);
          border: 1px solid var(--surface-3);
        }
        .oap-step-dot.rejected-dot {
          background: var(--danger-dim);
          color: var(--danger);
          border: 1.5px solid var(--danger);
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 4px var(--accent-dim); }
          50% { box-shadow: 0 0 0 8px rgba(13,148,136,0.06); }
        }
        .oap-step-label {
          font-size: 11px;
          color: var(--text-dim);
          font-weight: 500;
          letter-spacing: 0.04em;
          text-align: center;
          transition: color 0.3s;
        }
        .oap-step-label.active { color: var(--accent); }
        .oap-step-label.done { color: var(--text-muted); }

        /* Alert banners */
        .oap-alert {
          padding: 14px 18px;
          border-radius: 10px;
          font-size: 13.5px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 20px;
          animation: slide-in 0.35s ease;
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .oap-alert.err { background: var(--danger-dim); border: 1px solid rgba(220,38,38,0.2); color: var(--danger); }
        .oap-alert.ok { background: var(--success-dim); border: 1px solid rgba(5,150,105,0.2); color: var(--success); }
        .oap-alert-icon { flex-shrink: 0; margin-top: 1px; }

        /* Card */
        .oap-card {
          background: var(--surface);
          border: 1px solid var(--surface-3);
          border-radius: 18px;
          overflow: hidden;
          animation: card-in 0.5s ease forwards;
          box-shadow: 0 4px 24px rgba(15,23,42,0.06);
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .oap-card-header {
          padding: 28px 32px 20px;
          border-bottom: 1px solid var(--surface-3);
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }
        .oap-card-icon {
          width: 48px; height: 48px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .oap-card-icon.amber { background: rgba(217,119,6,0.12); color: var(--amber); }
        .oap-card-icon.blue { background: rgba(13,148,136,0.12); color: var(--accent); }
        .oap-card-icon.red { background: var(--danger-dim); color: var(--danger); }
        .oap-card-icon.green { background: var(--success-dim); color: var(--success); }
        .oap-card-title { font-family: 'DM Serif Display', serif; font-size: 20px; line-height: 1.2; color: var(--text); margin-bottom: 4px; }
        .oap-card-desc { font-size: 13px; color: var(--text-muted); font-weight: 400; line-height: 1.6; }
        .oap-card-body { padding: 24px 32px 28px; }

        /* Upload zone */
        .oap-dropzone {
          border: 1.5px dashed var(--accent-border);
          border-radius: 14px;
          padding: 36px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s ease;
          background: var(--accent-dim);
          position: relative;
          overflow: hidden;
        }
        .oap-dropzone:hover, .oap-dropzone.drag {
          border-color: var(--accent);
          background: rgba(13,148,136,0.06);
        }
        .oap-dropzone-inner { position: relative; z-index: 1; }
        .oap-dropzone-icon {
          width: 56px; height: 56px;
          border-radius: 16px;
          background: rgba(13,148,136,0.1);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          color: var(--accent);
        }
        .oap-dropzone-title { font-size: 15px; font-weight: 500; color: var(--text); margin-bottom: 6px; }
        .oap-dropzone-sub { font-size: 12.5px; color: var(--text-muted); }
        .oap-dropzone-sub span { color: var(--accent); font-weight: 500; }

        .oap-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 13px 28px;
          border-radius: 10px;
          background: var(--accent);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          letter-spacing: 0.01em;
        }
        .oap-upload-btn:hover:not(:disabled) {
          background: var(--accent-light);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(13,148,136,0.25);
        }
        .oap-upload-btn:disabled {
          opacity: 0.6; cursor: not-allowed;
        }

        /* Spinner */
        .spin {
          display: inline-block;
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Info rows */
        .oap-info-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid var(--surface-3);
          font-size: 13.5px;
          color: var(--text-muted);
        }
        .oap-info-row:last-child { border-bottom: none; }
        .oap-info-bullet {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
        }

        /* View link */
        .oap-view-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--accent);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          margin-top: 18px;
          padding: 9px 16px;
          border-radius: 8px;
          border: 1px solid var(--accent-border);
          background: var(--accent-dim);
          transition: all 0.2s;
        }
        .oap-view-link:hover { background: rgba(13,148,136,0.1); border-color: var(--accent); }

        /* Waiting pulse animation */
        .oap-waiting-dots {
          display: flex;
          gap: 5px;
          margin-top: 16px;
          justify-content: center;
        }
        .oap-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent);
          animation: dot-pulse 1.4s ease-in-out infinite;
        }
        .oap-dot:nth-child(2) { animation-delay: 0.2s; }
        .oap-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }

        /* Status footer */
        .oap-status-footer {
          margin-top: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2px;
        }
        .oap-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 14px;
          border-radius: 100px;
          background: var(--surface-2);
          border: 1px solid var(--surface-3);
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .oap-status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent);
          animation: pulse-dot 2s ease-in-out infinite;
        }
        .oap-status-dot.red { background: var(--danger); }
        .oap-status-dot.green { background: var(--success); }

        /* Loading */
        .oap-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          gap: 20px;
        }
        .oap-loading-ring {
          width: 48px; height: 48px;
          border: 2px solid var(--surface-3);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .oap-loading-text { font-size: 13px; color: var(--text-dim); letter-spacing: 0.08em; text-transform: uppercase; }

        /* Amount chip */
        .oap-amount {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          background: var(--accent-dim);
          border: 1px solid var(--accent-border);
          margin-bottom: 20px;
        }
        .oap-amount-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; }
        .oap-amount-value { font-family: 'DM Serif Display', serif; font-size: 20px; color: var(--accent); }

        @media (max-width: 480px) {
          .oap-card-header, .oap-card-body { padding-left: 20px; padding-right: 20px; }
          .oap-step-label { display: none; }
        }
      `}</style>

      <div className="oap-root">
        {loading ? (
          <div className="oap-loading">
            <div className="oap-loading-ring" />
            <p className="oap-loading-text">Memuat data...</p>
          </div>
        ) : (
          <div className={`oap-inner${mounted ? ' mounted' : ''}`}>

            {/* Header */}
            <div className="oap-eyebrow">Partner Program</div>
            <h1 className="oap-title">{isMouOwner ? 'Aktivasi Akun Partner' : 'Aktivasi Akun Partner (Non-MoU)'}</h1>
            <p className="oap-subtitle">
              {isMouOwner
                ? 'Selesaikan langkah berikut agar akun Anda dapat digunakan penuh dan mulai beroperasi.'
                : 'Lengkapi verifikasi agar akun Anda dapat digunakan penuh dan mulai beroperasi.'}
            </p>

            {/* Step Progress */}
            {(() => {
              const steps = isMouOwner ? STEPS_MOU : STEPS_NON_MOU;
              return (
                <div className="oap-steps">
                  <div className="oap-step-track">
                    <div
                      className="oap-step-fill"
                      style={{ width: isRejected ? '0%' : `${Math.min(100, (currentStep / (steps.length - 1)) * 100)}%` }}
                    />
                  </div>
                  {steps.map((step, i) => {
                    const isDone = currentStep > i;
                    const isActive = currentStep === i;
                    return (
                      <div className="oap-step" key={`step-${i}-${step.short}`}>
                        <div className={`oap-step-dot ${isDone ? 'done' : isActive ? (isRejected ? 'rejected-dot' : 'active') : 'idle'}`}>
                          {isDone ? <CheckIcon /> : step.short}
                        </div>
                        <span className={`oap-step-label ${isDone ? 'done' : isActive ? 'active' : ''}`}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Alerts */}
            {error && (
              <div className="oap-alert err">
                <span className="oap-alert-icon"><AlertIcon /></span>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="oap-alert ok">
                <span className="oap-alert-icon"><CheckIcon /></span>
                <span>{success}</span>
              </div>
            )}

            {/* ── State: Pending Payment ─────────────────────────────── */}
            {isPendingPayment && (
              <div className="oap-card">
                <div className="oap-card-header">
                  <div className="oap-card-icon amber"><UploadIcon /></div>
                  <div>
                    <div className="oap-card-title">Upload Bukti Bayar MoU</div>
                    <div className="oap-card-desc">
                      Transfer biaya pendaftaran, lalu upload bukti di sini. Admin akan memverifikasi dalam 1–2 hari kerja.
                    </div>
                  </div>
                </div>
                <div className="oap-card-body">
                  <div className="oap-amount">
                    <div>
                      <div className="oap-amount-label">Biaya MoU Pendaftaran</div>
                      <div className="oap-amount-value">Rp 25.000.000</div>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />

                  <div
                    className={`oap-dropzone${dragOver ? ' drag' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                  >
                    <div className="oap-dropzone-inner">
                      <div className="oap-dropzone-icon"><UploadIcon /></div>
                      <div className="oap-dropzone-title">Seret file ke sini, atau klik untuk memilih</div>
                      <div className="oap-dropzone-sub">JPG, PNG, PDF — maks <span>10 MB</span></div>

                      <button
                        className="oap-upload-btn"
                        disabled={uploading}
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      >
                        {uploading
                          ? <><span className="spin" /> Mengupload...</>
                          : <><UploadIcon /> Pilih File & Upload</>
                        }
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    {[
                      'Pastikan nama pengirim sesuai dengan nama akun terdaftar',
                      'Lampirkan bukti transfer yang jelas dan terbaca',
                      'Setelah diverifikasi, Anda akan mendapat surat MoU & password baru',
                    ].map((t, i) => (
                      <div className="oap-info-row" key={i}>
                        <span className="oap-info-bullet" />
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── State: Pending Verification ───────────────────────── */}
            {isPendingVerification && (
              <div className="oap-card">
                <div className="oap-card-header">
                  <div className="oap-card-icon blue"><ClockIcon /></div>
                  <div>
                    <div className="oap-card-title">
                      {isMouOwner ? 'Menunggu Verifikasi Admin' : 'Pendaftaran Dalam Peninjauan'}
                    </div>
                    <div className="oap-card-desc">
                      {isMouOwner
                        ? 'Bukti bayar Anda sedang ditinjau. Setelah disetujui, admin akan menetapkan kota dan mengaktivasi akun.'
                        : 'Pendaftaran Anda sedang ditinjau oleh Admin Pusat. Setelah disetujui, kota akan ditetapkan dan akun Anda diaktivasi.'}
                    </div>
                  </div>
                </div>
                <div className="oap-card-body">
                  <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>
                      {isMouOwner ? 'Proses verifikasi sedang berjalan' : 'Proses peninjauan pendaftaran sedang berjalan'}
                    </div>
                    <div className="oap-waiting-dots">
                      <div className="oap-dot" /><div className="oap-dot" /><div className="oap-dot" />
                    </div>
                  </div>
                  {isMouOwner && profile?.registration_payment_proof_url && (
                    <div style={{ marginTop: 20 }}>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await ownersApi.getRegistrationPaymentFile('me');
                            const blob = res.data as unknown as Blob;
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank', 'noopener');
                          } catch {
                            window.open(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/owners/me/registration-payment-file`, '_blank');
                          }
                        }}
                        className="oap-view-link"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit', textDecoration: 'underline' }}
                      >
                        <ExternalLinkIcon /> Lihat Bukti yang Diupload
                      </button>
                    </div>
                  )}
                  {(isMouOwner
                    ? [
                        'Estimasi verifikasi: 1–2 hari kerja',
                        'Anda akan mendapat notifikasi via email setelah diverifikasi',
                        'Hubungi Admin Pusat jika belum ada kabar dalam 3 hari',
                      ]
                    : [
                        'Estimasi peninjauan: 1–2 hari kerja',
                        'Anda akan mendapat notifikasi via email setelah akun diaktivasi',
                        'Hubungi Admin Pusat jika belum ada kabar dalam 3 hari kerja',
                      ]
                  ).map((t, i) => (
                    <div className="oap-info-row" key={i}>
                      <span className="oap-info-bullet" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── State: Rejected ───────────────────────────────────── */}
            {isRejected && (
              <div className="oap-card">
                <div className="oap-card-header">
                  <div className="oap-card-icon red"><AlertIcon /></div>
                  <div>
                    <div className="oap-card-title">Verifikasi Ditolak</div>
                    <div className="oap-card-desc">Bukti pembayaran tidak dapat disetujui. Silakan hubungi Admin Pusat.</div>
                  </div>
                </div>
                <div className="oap-card-body">
                  {profile?.mou_rejected_reason && (
                    <div style={{
                      padding: '16px 20px',
                      borderRadius: 12,
                      background: 'var(--danger-dim)',
                      border: '1px solid rgba(224,84,84,0.2)',
                      fontSize: 13.5,
                      color: 'var(--danger)',
                      lineHeight: 1.6,
                      marginBottom: 20,
                    }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, opacity: 0.7 }}>Alasan Penolakan</div>
                      {profile.mou_rejected_reason}
                    </div>
                  )}
                  {[
                    'Pastikan nama pengirim sesuai data akun',
                    'Upload bukti transfer yang jelas dan terbaca',
                    'Hubungi Admin Pusat via email atau telepon untuk panduan lebih lanjut',
                  ].map((t, i) => (
                    <div className="oap-info-row" key={i}>
                      <span className="oap-info-bullet" style={{ background: 'var(--danger)' }} />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── State: Waiting Activation ─────────────────────────── */}
            {isWaitingActivation && (
              <div className="oap-card">
                <div className="oap-card-header">
                  <div className="oap-card-icon green"><CheckIcon /></div>
                  <div>
                    <div className="oap-card-title">Bukti Disetujui — Menunggu Aktivasi</div>
                    <div className="oap-card-desc">
                      Pembayaran Anda telah diverifikasi. Admin akan segera mengaktivasi akun dan mengirimkan surat MoU.
                    </div>
                  </div>
                </div>
                <div className="oap-card-body">
                  <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>Proses aktivasi dalam antrian</div>
                    <div className="oap-waiting-dots">
                      <div className="oap-dot" style={{ background: 'var(--success)' }} />
                      <div className="oap-dot" style={{ background: 'var(--success)' }} />
                      <div className="oap-dot" style={{ background: 'var(--success)' }} />
                    </div>
                  </div>
                  {[
                    'Anda akan mendapat surat MoU resmi via email',
                    'Password yang dibuat saat pendaftaran tidak lagi berlaku setelah aktivasi',
                    'Password baru akan dikirim otomatis oleh sistem setelah akun aktif',
                  ].map((t, i) => (
                    <div className="oap-info-row" key={i}>
                      <span className="oap-info-bullet" style={{ background: 'var(--success)' }} />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status footer */}
            <div className="oap-status-footer">
              <div className="oap-status-badge">
                <div className={`oap-status-dot${isRejected ? ' red' : status === STATUS.active ? ' green' : ''}`} />
                Status: {!isMouOwner && status === STATUS.pending_registration_verification
                  ? 'Pendaftaran dalam peninjauan'
                  : (OWNER_STATUS_LABELS[status] || status)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>ID akun: {(user as any)?.id || '—'}</div>
            </div>

          </div>
        )}
      </div>
    </>
  );
};

export default OwnerActivationPage;