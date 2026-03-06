import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff,
  AlertCircle, ArrowRight, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { validateEmail } from '../../utils';
import Input from '../../components/common/Input';
import logoImg from '../../assets/logo.png';

/* ─── Styles ─────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  @keyframes blobFloat {
    0%,100% { transform: scale(1);    opacity:.35; }
    50%      { transform: scale(1.14); opacity:.58; }
  }
  @keyframes ringPulse {
    0%,100% { transform:translate(-50%,-50%) scale(1);    opacity:.22; }
    50%      { transform:translate(-50%,-50%) scale(1.08); opacity:.5;  }
  }
  @keyframes cardIn {
    from { opacity:0; transform:translateY(32px) scale(.97); }
    to   { opacity:1; transform:translateY(0)    scale(1);   }
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes errorIn {
    from { opacity:0; transform:translateY(-6px); max-height:0; }
    to   { opacity:1; transform:translateY(0);    max-height:60px; }
  }

  .lg-card  { animation: cardIn .65s cubic-bezier(.22,1,.36,1) both; }
  .fu       { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) both; }
  .fu-1     { animation-delay:.1s; }
  .fu-2     { animation-delay:.2s; }
  .fu-3     { animation-delay:.28s; }
  .fu-4     { animation-delay:.36s; }

  .blob     { animation:blobFloat 9s ease-in-out infinite;  filter:blur(80px); }
  .blob-b   { animation-duration:11s; animation-delay:2s; }
  .blob-c   { animation-duration:8s;  animation-delay:4s; }
  .ring     { animation:ringPulse 6s ease-in-out infinite; }
  .ring-b   { animation-delay:1.5s; }
  .ring-c   { animation-delay:3s; }

  .err-banner { animation:errorIn .25s ease-out both; overflow:hidden; }

  .lg-input {
    background: rgba(255,255,255,0.03);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    display: flex; align-items: center; gap: 10px;
    padding: 11px 14px;
    transition: border-color .2s, background .2s, box-shadow .2s;
  }
  .lg-input:focus-within {
    background: rgba(56,189,248,0.06);
    border-color: #38bdf8;
    box-shadow: 0 0 0 3px rgba(56,189,248,0.14);
  }
  .lg-input.err {
    border-color: rgba(239,68,68,0.65);
    box-shadow: 0 0 0 3px rgba(239,68,68,0.09);
  }

  .grid-bg {
    background-image:
      linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
  }

  .btn-main {
    position:relative; overflow:hidden; border:none; cursor:pointer;
    background: linear-gradient(135deg,#38bdf8 0%,#2563eb 55%,#4f46e5 100%);
    box-shadow: 0 4px 28px rgba(56,189,248,0.38), inset 0 1px 0 rgba(255,255,255,0.12);
    border-radius: 12px;
    color: white; font-weight:700; font-size:14px; letter-spacing:.04em;
    width:100%; padding:13px;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition: transform .15s, box-shadow .2s, opacity .2s;
  }
  .btn-main:hover:not(:disabled) {
    transform:scale(1.013);
    box-shadow: 0 8px 40px rgba(56,189,248,0.55);
  }
  .btn-main:active:not(:disabled) { transform:scale(.978); }
  .btn-main:disabled { opacity:.8; cursor:not-allowed; }
  .btn-main.ok { background:linear-gradient(135deg,#22c55e,#16a34a); box-shadow:0 4px 20px rgba(34,197,94,0.4); }
  .btn-main .shine {
    position:absolute; inset:0;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent);
    transform:translateX(-110%); transition:transform .65s ease;
  }
  .btn-main:hover:not(:disabled) .shine { transform:translateX(110%); }

  .btn-sec {
    display:flex; align-items:center; justify-content:center; gap:8px;
    padding:11px; width:100%; border-radius:12px; text-decoration:none;
    font-weight:600; font-size:13px; color:#38bdf8;
    background:rgba(56,189,248,0.07); border:1.5px solid rgba(56,189,248,0.22);
    transition:background .2s, border-color .2s, transform .15s;
  }
  .btn-sec:hover { background:rgba(56,189,248,0.13); border-color:rgba(56,189,248,0.45); transform:scale(1.01); }

  .spinner {
    width:15px; height:15px; border-radius:50%;
    border:2px solid rgba(255,255,255,0.3); border-top-color:white;
    animation:spin .75s linear infinite;
  }

  /* Dark form inputs (sama dengan Register) */
  .lg-form-dark label {
    color:#64748b !important; font-size:11px !important; font-weight:700 !important;
    letter-spacing:.08em !important; text-transform:uppercase !important;
  }
  .lg-form-dark input:not([type=file]):not([type=submit]):not([type=button]):not([type=checkbox]) {
    background:rgba(255,255,255,0.04) !important; border:1.5px solid rgba(255,255,255,0.1) !important;
    color:#fff !important; border-radius:12px !important; caret-color:#38bdf8 !important;
  }
  .lg-form-dark input::placeholder { color:#475569 !important; }
  .lg-form-dark input:focus {
    border-color:#38bdf8 !important; box-shadow:0 0 0 3px rgba(56,189,248,0.15) !important;
    background:rgba(56,189,248,0.06) !important;
  }
  .lg-form-dark .relative input { padding-left:42px !important; padding-right:14px !important; }
  .lg-form-dark .absolute.left-4 { color:#64748b !important; }
`;

const SKY  = '#38bdf8';
const MUTED = '#475569';
const DARK  = '#0a0f1e';

/* ─── LoginPage ──────────────────────────────────────────────────── */
const LoginPage: React.FC = () => {
  const navigate  = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email:'', password:'' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const s = document.createElement('style');
    s.innerHTML = STYLES;
    document.head.appendChild(s);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.email || !formData.password) { setError('Email dan password harus diisi'); return; }
    const emailErr = validateEmail(formData.email);
    if (emailErr) { setError(emailErr); return; }
    setLoading(true);
    try {
      const result = await login(formData);
      if (result.success) { setSuccess(true); setTimeout(() => navigate('/dashboard'), 900); }
      else setError(result.message || 'Email atau password salah');
    } catch { setError('Terjadi kesalahan. Silakan coba lagi.'); }
    finally  { setLoading(false); }
  };

  return (
    <div className="grid-bg" style={{
      minHeight:'100vh', width:'100%',
      display:'flex', alignItems:'center', justifyContent:'center',
      background: DARK, padding:'24px 16px',
      fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",
      position:'relative', overflow:'hidden',
    }}>

      {/* Blobs */}
      {[
        { cls:'blob',   w:500, h:500, l:'-8%',  t:'-15%', c:'rgba(37,99,235,0.26)' },
        { cls:'blob blob-b', w:380, h:380, r:'-4%', b:'4%',   c:'rgba(56,189,248,0.18)' },
        { cls:'blob blob-c', w:280, h:280, l:'40%', t:'-8%',  c:'rgba(79,70,229,0.16)' },
      ].map((b, i) => (
        <div key={i} className={b.cls} style={{
          position:'absolute', width:b.w, height:b.h, borderRadius:'50%',
          background:b.c, pointerEvents:'none',
          ...(b.l ? { left:b.l } : {}), ...(b.r ? { right:b.r } : {}),
          ...(b.t ? { top:b.t }  : {}), ...(b.b ? { bottom:b.b } : {}),
        }} />
      ))}

      {/* Rings */}
      {[
        { cls:'ring',       s:560, x:'80%', y:'90%' },
        { cls:'ring ring-b', s:360, x:'-4%', y:'22%' },
        { cls:'ring ring-c', s:200, x:'93%', y:'8%'  },
      ].map((r, i) => (
        <div key={i} className={r.cls} style={{
          position:'absolute', width:r.s, height:r.s, left:r.x, top:r.y,
          borderRadius:'50%', border:'1px solid rgba(56,189,248,0.11)',
          transform:'translate(-50%,-50%)', pointerEvents:'none',
        }} />
      ))}

      {/* ═══ CARD ═══ */}
      <div className="lg-card" style={{ position:'relative', width:'100%', maxWidth:400, zIndex:10 }}>

        {/* Glow border */}
        <div style={{
          position:'absolute', inset:-1, borderRadius:22, pointerEvents:'none',
          background:'linear-gradient(135deg,rgba(56,189,248,0.3) 0%,rgba(37,99,235,0.12) 45%,rgba(79,70,229,0.26) 100%)',
        }} />

        {/* Body */}
        <div style={{
          position:'relative', borderRadius:21,
          padding:'28px 30px 24px',
          background:'rgba(8,13,30,0.93)',
          backdropFilter:'blur(32px)',
          border:'1px solid rgba(56,189,248,0.1)',
        }}>

          {/* ── Logo ── */}
          <div className="fu" style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:20 }}>
            <div style={{
              marginBottom:10,
              transition:'transform .2s, box-shadow .2s', cursor:'default',
            }}
              onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform='scale(1.07)'; }}
              onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform=''; }}
            >
              <img 
                src={logoImg} 
                alt="Bintang Global Group" 
                style={{ 
                  width: 120, 
                  height: 'auto',
                  filter: 'drop-shadow(0 6px 24px rgba(56,189,248,0.42))'
                }} 
              />
            </div>
            <h1 style={{ fontSize:16, fontWeight:800, letterSpacing:'0.18em', color:'white', textTransform:'uppercase', margin:0 }}>
              Bintang Global
            </h1>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
              <div style={{ height:1, width:28, background:`linear-gradient(to right,transparent,${SKY})` }} />
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.3em', color:SKY, textTransform:'uppercase' }}>
                Umroh & Travel
              </span>
              <div style={{ height:1, width:28, background:`linear-gradient(to left,transparent,${SKY})` }} />
            </div>
          </div>

          {/* ── Heading ── */}
          <div className="fu fu-1" style={{ marginBottom:20 }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:'white', margin:'0 0 3px' }}>Masuk ke Akun</h2>
            <p  style={{ fontSize:12, color:MUTED, margin:0 }}>Gunakan kredensial mitra yang terdaftar</p>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="err-banner" style={{
              display:'flex', alignItems:'center', gap:9,
              padding:'10px 12px', borderRadius:10, marginBottom:16,
              background:'rgba(239,68,68,0.09)', border:'1px solid rgba(239,68,68,0.3)',
              color:'#fca5a5', fontSize:13,
            }}>
              <AlertCircle size={14} style={{ flexShrink:0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} noValidate className="lg-form-dark">
            <div className="fu fu-2" style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:14 }}>
              <Input
                name="email"
                type="email"
                label="Alamat Email"
                value={formData.email}
                onChange={handleChange}
                icon={<Mail size={16} style={{ color:'#64748b' }} />}
                placeholder="nama@perusahaan.com"
                autoComplete="email"
                error={error || undefined}
              />
              <Input
                name="password"
                type={showPass ? 'text' : 'password'}
                label="Kata Sandi"
                value={formData.password}
                onChange={handleChange}
                icon={<Lock size={16} style={{ color:'#64748b' }} />}
                placeholder="Minimal 8 karakter"
                autoComplete="current-password"
                error={error || undefined}
                rightLabel={
                  <Link to="/forgot-password" style={{ fontSize:12, fontWeight:600, color:SKY, textDecoration:'none' }}>
                    Lupa kata sandi?
                  </Link>
                }
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? 'Sembunyikan' : 'Tampilkan'}
                    style={{ padding:0, border:'none', background:'transparent', cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center' }}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
            </div>

            {/* Submit */}
            <div className="fu fu-3">
              <button type="submit" disabled={loading || success} className={`btn-main${success ? ' ok' : ''}`}>
                <span className="shine" />
                {loading  ? <><span className="spinner" />Memverifikasi...</>
                : success ? <><CheckCircle size={15} />Berhasil! Mengalihkan...</>
                :           <>Masuk ke Dashboard<ArrowRight size={14} /></>}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0' }}>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize:10, color:'#1e3a5f' }}>belum punya akun?</span>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Register */}
          <div className="fu fu-4">
            <Link to="/register" className="btn-sec">
              Daftar sebagai Partner Owner <ArrowRight size={13} />
            </Link>
          </div>

          {/* Trust */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:18, marginTop:18 }}>
            {['🔒 SSL Aman','✓ ISO 27001','⚡ POJK'].map(b => (
              <span key={b} style={{ fontSize:9, color:'#1e3a5f' }}>{b}</span>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;