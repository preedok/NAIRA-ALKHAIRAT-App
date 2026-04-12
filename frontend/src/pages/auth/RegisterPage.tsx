import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Mail, Lock, User, Phone, Building2,
  MapPin, FileText, Globe, ArrowRight, Upload,
  CheckCircle, AlertCircle, ChevronDown, Search, X,
} from 'lucide-react';
import { ownersApi, branchesApi, businessRulesApi, type Branch } from '../../services/api';
import { validateEmail } from '../../utils';
import { AUTOCOMPLETE_PILIH } from '../../utils/constants';
import Input from '../../components/common/Input';
import Autocomplete from '../../components/common/Autocomplete';
import { AuthSplitLayout, AuthBrandLogoRow } from './AuthSplitLayout';

/* ─── Styles ─────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  @keyframes blobFloat {
    0%,100% { transform:scale(1);    opacity:.32; }
    50%      { transform:scale(1.13); opacity:.55; }
  }
  @keyframes ringPulse {
    0%,100% { transform:translate(-50%,-50%) scale(1);    opacity:.2; }
    50%      { transform:translate(-50%,-50%) scale(1.07); opacity:.45; }
  }
  @keyframes cardIn {
    from { opacity:0; transform:translateY(28px) scale(.97); }
    to   { opacity:1; transform:translateY(0)    scale(1);   }
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes dropIn {
    from { opacity:0; transform:translateY(-6px) scale(.98); }
    to   { opacity:1; transform:translateY(0)    scale(1);   }
  }
  @keyframes spin    { to { transform:rotate(360deg); } }
  @keyframes errIn   {
    from { opacity:0; transform:translateY(-6px); max-height:0; }
    to   { opacity:1; transform:translateY(0);    max-height:70px; }
  }
  @keyframes successIn {
    from { opacity:0; transform:scale(.92); }
    to   { opacity:1; transform:scale(1);   }
  }

  .rg-card    { animation:cardIn .65s cubic-bezier(.22,1,.36,1) both; }
  .rg-success { animation:successIn .55s cubic-bezier(.22,1,.36,1) both; }
  .fu         { animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both; }
  .fu-1       { animation-delay:.08s; }
  .fu-2       { animation-delay:.16s; }
  .fu-3       { animation-delay:.24s; }

  .blob   { animation:blobFloat 9s ease-in-out infinite; filter:blur(90px); position:absolute; border-radius:50%; pointer-events:none; }
  .blob-b { animation-duration:11s; animation-delay:2s; }
  .blob-c { animation-duration:8s;  animation-delay:4s; }
  .ring   { animation:ringPulse 6s ease-in-out infinite; position:absolute; border-radius:50%; pointer-events:none; transform:translate(-50%,-50%); }
  .ring-b { animation-delay:1.5s; }

  .err-msg { animation:errIn .25s ease-out both; overflow:hidden; }

  .grid-bg {
    background-image:
      linear-gradient(rgba(56,189,248,0.04) 1px,transparent 1px),
      linear-gradient(90deg,rgba(56,189,248,0.04) 1px,transparent 1px);
    background-size:48px 48px;
  }

  /* ─ standard field ─ */
  .rg-field {
    background:rgba(255,255,255,0.04);
    border:1.5px solid rgba(255,255,255,0.1);
    border-radius:12px;
    display:flex; align-items:center; gap:10px;
    padding:12px 14px;
    transition:border-color .2s, background .2s, box-shadow .2s;
  }
  .rg-field:focus-within {
    background:rgba(56,189,248,0.06);
    border-color:#38bdf8;
    box-shadow:0 0 0 3px rgba(56,189,248,0.13);
  }
  .rg-field.err {
    border-color:rgba(239,68,68,0.65);
    box-shadow:0 0 0 3px rgba(239,68,68,0.09);
  }
  .rg-field input, .rg-field textarea {
    flex:1; background:transparent; color:white; font-size:13px;
    outline:none; min-width:0; border:none; caret-color:#38bdf8;
    font-family:inherit;
  }
  .rg-field input::placeholder,
  .rg-field textarea::placeholder { color:#334155; }
  .rg-field textarea { resize:none; line-height:1.45; }

  .rg-label {
    font-size:10.5px; font-weight:700; letter-spacing:.1em;
    text-transform:uppercase; color:#475569;
    display:block; margin-bottom:5px; user-select:none;
  }
  .rg-label.req::after { content:' *'; color:#38bdf8; }

  /* ─ custom dropdown ─ */
  .dd-trigger {
    background:rgba(255,255,255,0.04);
    border:1.5px solid rgba(255,255,255,0.1);
    border-radius:12px;
    display:flex; align-items:center; gap:10px;
    padding:12px 14px;
    cursor:pointer; user-select:none;
    transition:border-color .2s, background .2s, box-shadow .2s;
  }
  .dd-trigger:hover, .dd-trigger.open {
    background:rgba(56,189,248,0.06);
    border-color:#38bdf8;
    box-shadow:0 0 0 3px rgba(56,189,248,0.13);
  }
  .dd-trigger.err {
    border-color:rgba(239,68,68,0.65);
    box-shadow:0 0 0 3px rgba(239,68,68,0.09);
  }
  .dd-trigger .dd-value {
    flex:1; font-size:13px; color:white; font-family:inherit;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .dd-trigger .dd-placeholder { color:#334155; }

  .dd-panel {
    position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:999;
    background:#0d1526;
    border:1.5px solid rgba(56,189,248,0.3);
    border-radius:13px;
    overflow:hidden;
    box-shadow:0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.08);
    animation:dropIn .2s cubic-bezier(.22,1,.36,1) both;
  }

  .dd-search-wrap {
    padding:10px 10px 8px;
    border-bottom:1px solid rgba(255,255,255,0.06);
    display:flex; align-items:center; gap:8px;
  }
  .dd-search {
    flex:1; background:transparent; border:none; outline:none;
    color:white; font-size:13px; caret-color:#38bdf8;
    font-family:inherit;
  }
  .dd-search::placeholder { color:#334155; }

  .dd-list {
    max-height:200px; overflow-y:auto;
    padding:4px 0;
  }
  .dd-list::-webkit-scrollbar { width:3px; }
  .dd-list::-webkit-scrollbar-track { background:transparent; }
  .dd-list::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.3); border-radius:99px; }

  .dd-item {
    display:flex; align-items:center; gap:10px;
    padding:8px 12px; cursor:pointer;
    transition:background .15s;
    font-size:13px; color:#94a3b8;
  }
  .dd-item:hover   { background:rgba(56,189,248,0.09); color:white; }
  .dd-item.active  { background:rgba(56,189,248,0.14); color:#38bdf8; font-weight:600; }
  .dd-item .dd-name  { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .dd-item .dd-badge {
    font-size:10px; padding:1px 7px; border-radius:99px;
    background:rgba(56,189,248,0.1); color:#38bdf8; flex-shrink:0;
    border:1px solid rgba(56,189,248,0.2);
  }
  .dd-empty { padding:14px 12px; text-align:center; font-size:12px; color:#334155; }

  /* ─ branch info card ─ */
  .branch-info {
    margin-top:6px; padding:8px 10px; border-radius:9px;
    background:rgba(56,189,248,0.07); border:1px solid rgba(56,189,248,0.15);
    font-size:11px; color:#94a3b8; line-height:1.6;
  }

  /* ─ submit btn ─ */
  .btn-submit {
    position:relative; overflow:hidden; border:none; cursor:pointer;
    background:linear-gradient(135deg,#38bdf8 0%,#2563eb 55%,#4f46e5 100%);
    box-shadow:0 4px 28px rgba(56,189,248,0.38), inset 0 1px 0 rgba(255,255,255,0.12);
    border-radius:12px; color:white; font-weight:700; font-size:14px;
    letter-spacing:.04em; width:100%; padding:13px;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:transform .15s, box-shadow .2s; font-family:inherit;
  }
  .btn-submit:hover:not(:disabled) { transform:scale(1.012); box-shadow:0 8px 40px rgba(56,189,248,0.5); }
  .btn-submit:active:not(:disabled) { transform:scale(.978); }
  .btn-submit:disabled { opacity:.75; cursor:not-allowed; }
  .btn-submit .shine {
    position:absolute; inset:0;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent);
    transform:translateX(-110%); transition:transform .65s ease;
  }
  .btn-submit:hover:not(:disabled) .shine { transform:translateX(110%); }

  .spinner {
    width:15px; height:15px; border-radius:50%;
    border:2px solid rgba(255,255,255,0.3); border-top-color:white;
    animation:spin .75s linear infinite; flex-shrink:0;
  }

  .rg-scroll::-webkit-scrollbar { width:4px; }
  .rg-scroll::-webkit-scrollbar-track { background:transparent; }
  .rg-scroll::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.2); border-radius:99px; }

  .sec-label {
    font-size:10px; font-weight:700; letter-spacing:.12em;
    text-transform:uppercase; color:#1e3a5f; margin-bottom:10px;
    display:flex; align-items:center; gap:8px;
  }
  .sec-label::after { content:''; flex:1; height:1px; background:rgba(56,189,248,0.1); }

  /* Section cards — modern grouped blocks */
  .rg-section {
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(56,189,248,0.1);
    border-radius:16px;
    padding:24px;
    margin-bottom:24px;
  }
  .rg-section-title {
    font-size:11px; font-weight:700; letter-spacing:.12em;
    text-transform:uppercase; color:#38bdf8; margin-bottom:18px;
    display:flex; align-items:center; gap:10px;
  }
  .rg-section-title::before {
    content:''; width:4px; height:16px; border-radius:2px;
    background:linear-gradient(180deg,#38bdf8,#2563eb);
  }

  /* Dark form overrides (register page only) */
  .rg-form-dark label {
    color:#64748b !important; font-size:11px !important; font-weight:700 !important;
    letter-spacing:.08em !important; text-transform:uppercase !important;
  }
  .rg-form-dark input:not([type=file]):not([type=submit]):not([type=button]),
  .rg-form-dark textarea {
    background:rgba(255,255,255,0.04) !important; border:1.5px solid rgba(255,255,255,0.1) !important;
    color:#fff !important; border-radius:12px !important; caret-color:#38bdf8 !important;
  }
  .rg-form-dark input::placeholder, .rg-form-dark textarea::placeholder { color:#475569 !important; }
  .rg-form-dark input:focus, .rg-form-dark textarea:focus {
    border-color:#38bdf8 !important; box-shadow:0 0 0 3px rgba(56,189,248,0.15) !important;
    background:rgba(56,189,248,0.06) !important;
  }
  .rg-form-dark .relative input { padding-left:42px !important; padding-right:14px !important; }
  .rg-form-dark .absolute.left-4 { color:#64748b !important; }
  .rg-form-dark textarea { padding:12px 14px !important; min-height:72px !important; }
  .rg-autocomplete-wrap button[type=button] {
    background:rgba(255,255,255,0.04) !important; border:1.5px solid rgba(255,255,255,0.1) !important;
    color:#fff !important; border-radius:12px !important;
  }
  .rg-autocomplete-wrap button[type=button]:hover {
    border-color:rgba(56,189,248,0.35) !important; background:rgba(56,189,248,0.06) !important;
  }
  .rg-autocomplete-wrap button[type=button] span { color:inherit !important; }
  .rg-autocomplete-wrap button[type=button] span:empty + span, .rg-autocomplete-wrap button[type=button] .text-slate-500 { color:#64748b !important; }

  /* Responsive form grids */
  .rg-form-row-3 {
    display:grid; grid-template-columns:repeat(3,1fr); gap:14px 16px;
  }
  .rg-form-row-2 {
    display:grid; grid-template-columns:repeat(2,1fr); gap:14px 16px;
  }
  .rg-form-row-1 { display:flex; flex-direction:column; gap:14px; }
  @media (max-width:768px) {
    .rg-form-row-3 { grid-template-columns:repeat(2,1fr); }
    .rg-form-row-2 { grid-template-columns:1fr; }
  }
  @media (max-width:520px) {
    .rg-form-row-3 { grid-template-columns:1fr; }
  }
`;

const SKY   = '#38bdf8';
const MUTED = '#475569';

interface DropdownOption { value: string; label: string; sub?: string; }

/* ─── RegisterPage ───────────────────────────────────────────────── */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ownerType = searchParams.get('type'); // 'mou' | 'non_mou' | null
  const [branches, setBranches]          = useState<Branch[]>([]);
  const [branchesLoading, setBranchLoad] = useState(true);
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    company_name: '', address: '', preferred_branch_id: '',
    operational_region: '', whatsapp: '', npwp: '',
    registration_payment_amount: '',
  });
  const [registrationPaymentFile, setRegistrationPaymentFile] = useState<File | null>(null);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const injected = useRef(false);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!injected.current) {
      injected.current = true;
      const s = document.createElement('style');
      s.innerHTML = STYLES;
      document.head.appendChild(s);
    }
    branchesApi.listPublic({ limit: 600 })
      .then(res => { if (res.data?.data) setBranches(res.data.data); })
      .catch(() => {})
      .finally(() => setBranchLoad(false));
  }, []);

  useEffect(() => {
    if (ownerType === 'mou') {
      businessRulesApi.getPublic()
        .then(res => {
          if (res.data?.success && res.data?.data?.registration_deposit_idr != null) {
            const amount = Number(res.data.data.registration_deposit_idr);
            if (Number.isFinite(amount) && amount > 0) {
              setForm(f => ({ ...f, registration_payment_amount: String(amount) }));
            }
          }
        })
        .catch(() => {});
    }
  }, [ownerType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (error) setError('');
  };

  const handleBranchChange = (val: string) => {
    const b = branches.find(x => x.id === val);
    setForm(f => ({ ...f, preferred_branch_id: val, operational_region: b?.region || f.operational_region }));
    if (error) setError('');
  };

  const selectedBranch = form.preferred_branch_id
    ? branches.find(b => b.id === form.preferred_branch_id)
    : null;

  const branchOptions: DropdownOption[] = branches.map(b => ({
    value: b.id,
    label: b.name,
    sub: b.region,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim())  { setError('Nama wajib diisi'); return; }
    if (!form.email.trim()) { setError('Email wajib diisi'); return; }
    const emailErr = validateEmail(form.email);
    if (emailErr)           { setError(emailErr); return; }
    if (!form.password || form.password.length < 6) { setError('Password minimal 6 karakter'); return; }
    if (!form.phone.trim()) { setError('Telepon wajib diisi'); return; }
    if (!form.whatsapp.trim()) { setError('WhatsApp wajib diisi'); return; }
    if (!form.company_name.trim()) { setError('Nama perusahaan / travel wajib diisi'); return; }
    if (!form.address.trim()) { setError('Alamat kantor wajib diisi'); return; }
    if (!form.preferred_branch_id) { setError('Kota operasional wajib dipilih'); return; }
    const isMou = ownerType === 'mou';
    if (isMou) {
      const amountNum = parseFloat(String(form.registration_payment_amount).replace(/[^\d.-]/g, ''));
      if (!Number.isFinite(amountNum) || amountNum <= 0) { setError('Jumlah pembayaran MoU wajib diisi dan harus lebih dari 0'); return; }
      if (!registrationPaymentFile) { setError('Bukti bayar MoU wajib diupload'); return; }
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('email', form.email.trim().toLowerCase());
      fd.append('password', form.password);
      if (form.phone.trim()) fd.append('phone', form.phone.trim());
      if (form.company_name.trim()) fd.append('company_name', form.company_name.trim());
      if (form.address.trim()) fd.append('address', form.address.trim());
      if (form.operational_region.trim()) fd.append('operational_region', form.operational_region.trim());
      if (form.preferred_branch_id) fd.append('preferred_branch_id', form.preferred_branch_id);
      fd.append('whatsapp', (form.whatsapp.trim() || form.phone.trim()) || '');
      if (form.npwp.trim()) fd.append('npwp', form.npwp.trim());
      if (isMou) {
        const amountNum = parseFloat(String(form.registration_payment_amount).replace(/[^\d.-]/g, ''));
        fd.append('registration_payment_amount', String(amountNum));
        if (registrationPaymentFile) fd.append('registration_payment_file', registrationPaymentFile);
      }
      fd.append('is_mou_owner', isMou ? 'true' : 'false');
      await ownersApi.register(fd);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Redirect: no type or invalid type ── */
  if (ownerType !== 'mou' && ownerType !== 'non_mou') {
    return null;
  }

  /* ── Success screen ── */
  if (success) {
    return (
      <div
        className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 sm:p-6"
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200/80 p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">Registrasi berhasil</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-8">
            Registrasi dan bukti bayar MoU Anda telah diterima. Admin Pusat akan memverifikasi bukti bayar dan mengaktifkan akun. Setelah akun diaktifkan, Anda dapat login dan mengakses seluruh fitur aplikasi serta akan mendapat surat MoU dan password baru dari sistem.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-xl font-bold text-sm text-white inline-flex items-center justify-center gap-2 hover:brightness-110 transition-all"
            style={{ backgroundColor: '#0D1A63', boxShadow: '0 8px 24px rgba(13,26,99,0.2)' }}
          >
            Ke halaman login
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <AuthSplitLayout
      panelTitle="Gabung sebagai mitra travel."
      panelSubtitle="Lengkapi data perusahaan dan kontak Anda. Setelah diverifikasi Admin Pusat, Anda dapat mengelola order dan invoice dari satu dasbor."
      panelFooterLink={{ to: '/login', label: 'Sudah punya akun? Masuk →' }}
    >
      <AuthBrandLogoRow />

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
        {ownerType === 'mou' ? 'Buat akun Owner MOU' : 'Buat akun Owner Non-MOU'}
      </h1>
      <p className="text-sm text-slate-500 mt-1 mb-6 max-w-lg">
        {ownerType === 'mou'
          ? 'Mitra dengan MOU — harga produk mengikuti ketentuan diskon mitra. Lengkapi form di bawah.'
          : 'Mitra tanpa MOU — harga standar. Lengkapi form di bawah; tidak ada pembayaran MoU di awal.'}
      </p>

      <div
        className="rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-inner"
        style={{
          background: 'rgba(8,13,30,0.96)',
          maxHeight: 'min(72vh, calc(100vh - 14rem))',
        }}
      >
        <div
          className="fu flex-shrink-0 px-5 py-4 sm:px-6 border-b flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <p className="text-sm font-semibold text-white">Form pendaftaran</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/register-owner-type" className="text-xs font-semibold text-slate-400 hover:text-sky-400 px-2 py-1 rounded-lg">
              Ganti jenis
            </Link>
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10"
            >
              ← Masuk
            </Link>
          </div>
        </div>

        <div className="rg-scroll fu fu-1 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">

            {/* Error */}
            {error && (
              <div className="err-msg" style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'12px 16px', borderRadius:12, marginBottom:20,
                background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.35)',
                color:'#fca5a5', fontSize:13,
              }}>
                <AlertCircle size={16} style={{ flexShrink:0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="rg-form-dark">

              {/* Section: Akun */}
              <div className="rg-section">
                <div className="rg-section-title">Informasi Akun</div>
                <div className="rg-form-row-3">
                  <Input label="Nama Lengkap" name="name" value={form.name} onChange={handleChange} placeholder="Nama lengkap" icon={<User size={16} style={{ color:'#64748b' }} />} required />
                  <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="email@travel.com" icon={<Mail size={16} style={{ color:'#64748b' }} />} required />
                  <Input label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 6 karakter" icon={<Lock size={16} style={{ color:'#64748b' }} />} required />
                </div>
              </div>

              {/* Section: Kontak */}
              <div className="rg-section">
                <div className="rg-section-title">Informasi Kontak</div>
                <div className="rg-form-row-3">
                  <Input label="Telepon" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+62 812 ..." icon={<Phone size={16} style={{ color:'#64748b' }} />} required />
                  <Input label="WhatsApp" name="whatsapp" type="tel" value={form.whatsapp} onChange={handleChange} placeholder="Nomor WhatsApp" icon={<Phone size={16} style={{ color:'#64748b' }} />} required />
                  <Input label="NPWP" name="npwp" value={form.npwp} onChange={handleChange} placeholder="Opsional" icon={<FileText size={16} style={{ color:'#64748b' }} />} />
                </div>
              </div>

              {/* Section: Perusahaan */}
              <div className="rg-section">
                <div className="rg-section-title">Informasi Perusahaan</div>
                <div className="rg-form-row-3">
                  <Input label="Nama Perusahaan / Travel" name="company_name" value={form.company_name} onChange={handleChange} placeholder="PT / CV / Nama travel" icon={<Building2 size={16} style={{ color:'#64748b' }} />} required />
                  <Input label="Alamat Kantor" name="address" value={form.address} onChange={handleChange} placeholder="Alamat kantor" icon={<MapPin size={16} style={{ color:'#64748b' }} />} required />
                  <div className="rg-autocomplete-wrap">
                    <Autocomplete
                      label="Kota Operasional *"
                      value={form.preferred_branch_id}
                      onChange={handleBranchChange}
                      options={branchOptions.map(b => ({ value: b.value, label: b.label }))}
                      placeholder={AUTOCOMPLETE_PILIH.PILIH_KABUPATEN}
                      emptyLabel={AUTOCOMPLETE_PILIH.PILIH_KABUPATEN}
                    />
                    {selectedBranch && (
                      <div className="branch-info" style={{ marginTop:8 }}>
                        <span>Provinsi: </span>
                        <span>{selectedBranch.region}</span>
                        {selectedBranch.koordinator_provinsi && (
                          <>
                            {' · '}
                            <span>Koord: </span>
                            <span>{selectedBranch.koordinator_provinsi}</span>
                            {selectedBranch.koordinator_provinsi_phone && (
                              <span> · {selectedBranch.koordinator_provinsi_phone}</span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section: Pembayaran MoU — hanya untuk Owner MOU */}
              {ownerType === 'mou' && (
                <>
                  <div className="rg-section">
                    <div className="rg-section-title">Pembayaran MoU (wajib di awal pendaftaran)</div>
                    <div className="rg-form-row-2">
                      <div>
                        <span className="rg-label req">Jumlah pembayaran (Rp)</span>
                        <div className="rg-field">
                          <FileText size={16} color={MUTED} style={{ flexShrink:0 }} />
                          <input
                            name="registration_payment_amount"
                            type="text"
                            inputMode="numeric"
                            value={form.registration_payment_amount}
                            onChange={handleChange}
                            placeholder="Contoh: 25000000"
                            readOnly
                            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                          />
                        </div>
                        <p style={{ fontSize:11, color:MUTED, marginTop:6 }}>Nominal dari Settings. Hanya Admin Pusat yang dapat mengubah di menu Settings.</p>
                      </div>
                      <div>
                        <span className="rg-label req">Bukti bayar MoU</span>
                        <input
                          ref={paymentFileInputRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => setRegistrationPaymentFile(e.target.files?.[0] || null)}
                        />
                        <button
                          type="button"
                          onClick={() => paymentFileInputRef.current?.click()}
                          className="dd-trigger"
                          style={{ width:'100%', justifyContent:'flex-start', padding:'12px 14px' }}
                        >
                          <Upload size={16} color={MUTED} style={{ flexShrink:0 }} />
                          <span className="dd-value" style={{ color: registrationPaymentFile ? '#e2e8f0' : MUTED }}>
                            {registrationPaymentFile ? registrationPaymentFile.name : 'Pilih file (PDF / gambar)'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {ownerType === 'non_mou' && (
                <div className="rg-section" style={{ background: 'rgba(100,116,139,0.08)', borderColor: 'rgba(100,116,139,0.2)' }}>
                  <div className="rg-section-title" style={{ color: '#94a3b8' }}>Pendaftaran Non-MOU (gratis)</div>
                  <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.6, margin:0 }}>
                    Tidak ada pembayaran MoU. Akun Anda tetap akan divalidasi oleh Admin Pusat. Setelah disetujui dan diaktifkan, Anda dapat login dan menggunakan aplikasi.
                  </p>
                </div>
              )}

              {/* Info: Alur aktivasi */}
              <div className="fu fu-2" style={{
                padding:'18px 20px', borderRadius:14, marginBottom:24,
                background:'rgba(56,189,248,0.06)', border:'1px solid rgba(56,189,248,0.18)',
              }}>
                <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.65, margin:0, maxWidth:'100%' }}>
                  {ownerType === 'mou'
                    ? <><strong style={{ color:'#e2e8f0' }}>Alur aktivasi:</strong> Pembayaran MoU dilakukan di awal pendaftaran (upload bukti + isi jumlah). Setelah Anda daftar, Admin Pusat akan memverifikasi bukti bayar dan mengaktifkan akun. Setelah akun aktif, Anda dapat login dan mengakses seluruh fitur aplikasi.</>
                    : <><strong style={{ color:'#e2e8f0' }}>Alur aktivasi:</strong> Setelah mendaftar, Admin Pusat akan memvalidasi dan mengaktifkan akun Anda. Setelah diaktifkan, Anda dapat login dan mengakses seluruh fitur aplikasi.</>}
                </p>
              </div>

              {/* Submit */}
              <div className="fu fu-2" style={{ marginTop:8 }}>
                <button type="submit" disabled={loading} className="btn-submit" style={{ padding:'14px' }}>
                  <span className="shine" />
                  {loading
                    ? <><span className="spinner" />Memproses...</>
                    : <>Daftar Sekarang<ArrowRight size={16} /></>
                  }
                </button>
                <p style={{ fontSize:12, color:'#64748b', textAlign:'center', marginTop:16 }}>
                  Sudah punya akun?{' '}
                  <Link to="/login" style={{ color:SKY, fontWeight:600, textDecoration:'none' }}>Masuk di sini</Link>
                </p>
              </div>
            </form>
        </div>
      </div>
    </AuthSplitLayout>
  );
};

export default RegisterPage;