import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Lock, User, Phone, Building2,
  MapPin, FileText, Globe, ArrowRight, Upload,
  CheckCircle, AlertCircle, ChevronDown, Search, X,
} from 'lucide-react';
import { ownersApi, branchesApi, type Branch } from '../../services/api';
import { validateEmail } from '../../utils';

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
    background:rgba(255,255,255,0.03);
    border:1.5px solid rgba(255,255,255,0.08);
    border-radius:11px;
    display:flex; align-items:center; gap:9px;
    padding:9px 12px;
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
    background:rgba(255,255,255,0.03);
    border:1.5px solid rgba(255,255,255,0.08);
    border-radius:11px;
    display:flex; align-items:center; gap:9px;
    padding:9px 12px;
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
`;

const SKY   = '#38bdf8';
const MUTED = '#475569';
const DARK  = '#0a0f1e';

/* ─── Field wrapper ──────────────────────────────────────────────── */
const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label, required, children,
}) => (
  <div>
    <span className={`rg-label${required ? ' req' : ''}`}>{label}</span>
    <div className="rg-field">{children}</div>
  </div>
);

/* ─── Custom Dropdown ────────────────────────────────────────────── */
interface DropdownOption { value: string; label: string; sub?: string; }
interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  placeholder?: string;
  loading?: boolean;
  hasError?: boolean;
  icon?: React.ReactNode;
}

const Dropdown: React.FC<DropdownProps> = ({
  value, options, onChange, placeholder = 'Pilih...', loading, hasError, icon,
}) => {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = search.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sub || '').toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleClose = useCallback(() => { setOpen(false); setSearch(''); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handleClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [handleClose]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div
        className={`dd-trigger${open ? ' open' : ''}${hasError ? ' err' : ''}`}
        onClick={() => setOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
      >
        {icon && <span style={{ color: selected ? SKY : MUTED, flexShrink: 0, transition: 'color .2s' }}>{icon}</span>}
        <span className={`dd-value${!selected ? ' dd-placeholder' : ''}`}>
          {loading ? 'Memuat data...' : (selected ? selected.label : placeholder)}
        </span>
        {value && !loading && (
          <span
            style={{ color: MUTED, flexShrink: 0, padding: 2 }}
            onClick={e => { e.stopPropagation(); handleSelect(''); }}
            title="Hapus pilihan"
          >
            <X size={12} />
          </span>
        )}
        <span style={{
          color: MUTED, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform .2s',
          display: 'flex',
        }}>
          <ChevronDown size={14} />
        </span>
      </div>

      {/* Panel */}
      {open && (
        <div className="dd-panel">
          {/* Search */}
          <div className="dd-search-wrap">
            <Search size={13} color={MUTED} style={{ flexShrink: 0 }} />
            <input
              className="dd-search"
              placeholder="Cari kabupaten..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* List */}
          <div className="dd-list">
            {loading ? (
              <div className="dd-empty">Memuat...</div>
            ) : filtered.length === 0 ? (
              <div className="dd-empty">Tidak ditemukan</div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  className={`dd-item${opt.value === value ? ' active' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <Globe size={12} style={{ flexShrink: 0, opacity: .6 }} />
                  <span className="dd-name">{opt.label}</span>
                  {opt.sub && <span className="dd-badge">{opt.sub}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── RegisterPage ───────────────────────────────────────────────── */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
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
    const amountNum = parseFloat(String(form.registration_payment_amount).replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(amountNum) || amountNum <= 0) { setError('Jumlah pembayaran MoU wajib diisi dan harus lebih dari 0'); return; }
    if (!registrationPaymentFile) { setError('Bukti bayar MoU wajib diupload'); return; }

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
      fd.append('registration_payment_amount', String(amountNum));
      fd.append('registration_payment_file', registrationPaymentFile);
      await ownersApi.register(fd);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const BG = (
    <>
      <div className="blob"        style={{ width:520, height:520, left:'-8%',  top:'-15%', background:'rgba(37,99,235,0.26)' }} />
      <div className="blob blob-b" style={{ width:380, height:380, right:'-4%', bottom:'4%',  background:'rgba(56,189,248,0.18)' }} />
      <div className="blob blob-c" style={{ width:280, height:280, left:'40%',  top:'-8%',  background:'rgba(79,70,229,0.16)' }} />
      <div className="ring"        style={{ width:560, height:560, left:'80%', top:'90%', border:'1px solid rgba(56,189,248,0.11)' }} />
      <div className="ring ring-b" style={{ width:360, height:360, left:'-4%', top:'22%', border:'1px solid rgba(56,189,248,0.11)' }} />
    </>
  );

  const PAGE_STYLE: React.CSSProperties = {
    minHeight:'100vh', width:'100%', display:'flex', alignItems:'center',
    justifyContent:'center', background:DARK, padding:'24px 16px',
    fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",
    position:'relative', overflow:'hidden',
  };

  /* ── Success screen ── */
  if (success) {
    return (
      <div className="grid-bg" style={PAGE_STYLE}>
        {BG}
        <div className="rg-success" style={{ position:'relative', width:'100%', maxWidth:380, zIndex:10 }}>
          <div style={{ position:'absolute', inset:-1, borderRadius:22, pointerEvents:'none',
            background:'linear-gradient(135deg,rgba(56,189,248,0.3) 0%,rgba(37,99,235,0.12) 45%,rgba(79,70,229,0.26) 100%)' }} />
          <div style={{
            position:'relative', borderRadius:21, padding:'36px 32px',
            background:'rgba(8,13,30,0.93)', backdropFilter:'blur(32px)',
            border:'1px solid rgba(56,189,248,0.1)', textAlign:'center',
          }}>
            <div style={{
              width:60, height:60, borderRadius:'50%', margin:'0 auto 16px',
              background:'rgba(34,197,94,0.12)', border:'1.5px solid rgba(34,197,94,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <h2 style={{ fontSize:20, fontWeight:800, color:'white', margin:'0 0 10px' }}>Registrasi Berhasil!</h2>
            <p style={{ fontSize:13, color:MUTED, lineHeight:1.65, margin:'0 0 24px' }}>
              Registrasi dan bukti bayar MoU Anda telah diterima. Admin Pusat akan memverifikasi bukti bayar dan mengaktifkan akun. Setelah akun diaktifkan, Anda dapat login dan mengakses seluruh fitur aplikasi serta akan mendapat surat MoU dan password baru dari sistem.
            </p>
            <button onClick={() => navigate('/login')} className="btn-submit" style={{ fontFamily:'inherit' }}>
              <span className="shine" />
              Ke Halaman Login <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <div className="grid-bg" style={PAGE_STYLE}>
      {BG}

      <div className="rg-card" style={{ position:'relative', width:'100%', maxWidth:680, zIndex:10 }}>
        {/* Glow border */}
        <div style={{
          position:'absolute', inset:-1, borderRadius:22, pointerEvents:'none',
          background:'linear-gradient(135deg,rgba(56,189,248,0.3) 0%,rgba(37,99,235,0.12) 45%,rgba(79,70,229,0.26) 100%)',
        }} />

        {/* Card body */}
        <div style={{
          position:'relative', borderRadius:21,
          background:'rgba(8,13,30,0.93)', backdropFilter:'blur(32px)',
          border:'1px solid rgba(56,189,248,0.1)',
          overflow:'hidden', display:'flex', flexDirection:'column',
          maxHeight:'calc(100vh - 48px)',
        }}>

          {/* ── Header ── */}
          <div className="fu" style={{
            padding:'20px 26px 16px',
            borderBottom:'1px solid rgba(255,255,255,0.06)',
            display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:13 }}>
              <div style={{
                width:40, height:40, borderRadius:12, flexShrink:0,
                background:'linear-gradient(135deg,#38bdf8 0%,#2563eb 60%,#4f46e5 100%)',
                boxShadow:'0 4px 16px rgba(56,189,248,0.4)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                  <path d="M22 16C22 21.523 17.523 26 12 26C9.387 26 7.02 24.98 5.27 23.3C5.78 23.43 6.315 23.5 6.87 23.5C11.843 23.5 15.87 19.473 15.87 14.5C15.87 11.03 13.973 7.997 11.15 6.387C11.756 6.297 12.374 6.25 13 6.25C18.108 6.25 22 10.692 22 16Z" fill="white"/>
                  <circle cx="21" cy="8" r="1.8" fill="white" opacity=".75"/>
                  <circle cx="25" cy="13" r="1.1" fill="white" opacity=".5"/>
                </svg>
              </div>
              <div>
                <h1 style={{ fontSize:16, fontWeight:800, color:'white', margin:0 }}>Daftar Partner Owner</h1>
                <p style={{ fontSize:11, color:MUTED, margin:'2px 0 0' }}>Untuk travel yang belum terdaftar di Bintang Global Group</p>
              </div>
            </div>
            <Link
              to="/login"
              style={{ fontSize:12, color:MUTED, textDecoration:'none', flexShrink:0, transition:'color .2s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = SKY)}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = MUTED)}
            >
              ← Masuk
            </Link>
          </div>

          {/* ── Scrollable form ── */}
          <div className="rg-scroll fu fu-1" style={{ flex:1, overflowY:'auto', padding:'20px 26px 24px' }}>

            {/* Error */}
            {error && (
              <div className="err-msg" style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'10px 12px', borderRadius:10, marginBottom:16,
                background:'rgba(239,68,68,0.09)', border:'1px solid rgba(239,68,68,0.3)',
                color:'#fca5a5', fontSize:12,
              }}>
                <AlertCircle size={13} style={{ flexShrink:0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>

              {/* Section: Akun */}
              <div className="sec-label">Informasi Akun</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'11px 13px', marginBottom:18 }}>
                <Field label="Nama Lengkap" required>
                  <User size={14} color={MUTED} style={{ flexShrink:0 }} />
                  <input name="name" type="text" value={form.name} onChange={handleChange} placeholder="Nama lengkap" />
                </Field>
                <Field label="Email" required>
                  <Mail size={14} color={MUTED} style={{ flexShrink:0 }} />
                  <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="email@travel.com" />
                </Field>
                <Field label="Password" required>
                  <Lock size={14} color={MUTED} style={{ flexShrink:0 }} />
                  <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 6 karakter" />
                </Field>
              </div>

              {/* Section: Kontak */}
              <div className="sec-label">Informasi Kontak</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'11px 13px', marginBottom:18 }}>
                <Field label="Telepon">
                  <Phone size={14} color={MUTED} style={{ flexShrink:0 }} />
                  <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+62 812 ..." />
                </Field>
                <Field label="WhatsApp">
                  <Phone size={14} color={MUTED} style={{ flexShrink:0 }} />
                  <input name="whatsapp" type="tel" value={form.whatsapp} onChange={handleChange} placeholder="Nomor WhatsApp" />
                </Field>
                <Field label="NPWP">
                  <FileText size={14} color={MUTED} style={{ flexShrink:0 }} />
                  <input name="npwp" type="text" value={form.npwp} onChange={handleChange} placeholder="Opsional" />
                </Field>
              </div>

              {/* Section: Perusahaan */}
              <div className="sec-label">Informasi Perusahaan</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'11px 13px', marginBottom:20 }}>
                <Field label="Nama Perusahaan / Travel">
                  <Building2 size={14} color={MUTED} style={{ flexShrink:0 }} />
                  <input name="company_name" type="text" value={form.company_name} onChange={handleChange} placeholder="PT / CV / Nama travel" />
                </Field>
                <Field label="Alamat Kantor">
                  <MapPin size={14} color={MUTED} style={{ flexShrink:0, alignSelf:'flex-start', marginTop:1 }} />
                  <textarea name="address" value={form.address} onChange={handleChange} rows={1} placeholder="Alamat kantor" />
                </Field>

                {/* Custom Dropdown */}
                <div>
                  <span className="rg-label req">Kota Operasional</span>
                  <Dropdown
                    value={form.preferred_branch_id}
                    options={branchOptions}
                    onChange={handleBranchChange}
                    placeholder="Pilih kabupaten..."
                    loading={branchesLoading}
                    icon={<Globe size={14} />}
                  />
                  {selectedBranch && (
                    <div className="branch-info">
                      <span style={{ color:'#64748b' }}>Provinsi: </span>
                      <span style={{ color:'#cbd5e1' }}>{selectedBranch.region}</span>
                      {selectedBranch.koordinator_provinsi && (
                        <>
                          {' · '}
                          <span style={{ color:'#64748b' }}>Koord: </span>
                          <span style={{ color:'#cbd5e1' }}>{selectedBranch.koordinator_provinsi}</span>
                          {selectedBranch.koordinator_provinsi_phone && (
                            <span style={{ color:'#475569' }}> · {selectedBranch.koordinator_provinsi_phone}</span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Pembayaran MoU (di awal daftar) */}
              <div className="sec-label">Pembayaran MoU (wajib di awal pendaftaran)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'11px 13px', marginBottom:20 }}>
                <div>
                  <span className="rg-label req">Jumlah pembayaran (Rp)</span>
                  <div className="rg-field">
                    <FileText size={14} color={MUTED} style={{ flexShrink:0 }} />
                    <input
                      name="registration_payment_amount"
                      type="text"
                      inputMode="numeric"
                      value={form.registration_payment_amount}
                      onChange={handleChange}
                      placeholder="Contoh: 25000000"
                    />
                  </div>
                  <p style={{ fontSize:11, color:MUTED, marginTop:4 }}>Biaya MoU pendaftaran: Rp 25.000.000</p>
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
                    style={{ width:'100%', justifyContent:'flex-start' }}
                  >
                    <Upload size={14} color={MUTED} style={{ flexShrink:0 }} />
                    <span className="dd-value" style={{ color: registrationPaymentFile ? '#e2e8f0' : MUTED }}>
                      {registrationPaymentFile ? registrationPaymentFile.name : 'Pilih file (PDF / gambar)'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="fu fu-2" style={{
                padding:'14px 16px', borderRadius:12, marginBottom:20,
                background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.2)',
              }}>
                <p style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6, margin:0 }}>
                  <strong style={{ color:'#e2e8f0' }}>Alur aktivasi:</strong> Pembayaran MoU dilakukan di awal pendaftaran (upload bukti + isi jumlah). Setelah Anda daftar, Admin Pusat akan memverifikasi bukti bayar dan mengaktifkan akun. Setelah akun aktif, Anda dapat login dan mengakses seluruh fitur aplikasi.
                </p>
              </div>

              {/* Submit */}
              <div className="fu fu-2">
                <button type="submit" disabled={loading} className="btn-submit">
                  <span className="shine" />
                  {loading
                    ? <><span className="spinner" />Memproses...</>
                    : <>Daftar Sekarang<ArrowRight size={14} /></>
                  }
                </button>
                <p style={{ fontSize:11, color:'#1e3a5f', textAlign:'center', marginTop:12 }}>
                  Sudah punya akun?{' '}
                  <Link to="/login" style={{ color:SKY, fontWeight:600, textDecoration:'none' }}>Masuk di sini</Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;