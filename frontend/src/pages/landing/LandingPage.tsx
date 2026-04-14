import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package, BarChart3,
  Shield, Headphones, Zap, ChevronRight, ChevronDown,
  Menu, X, ArrowRight, Star, Building2, Users,
  CheckCircle, Award, TrendingUp, MessageCircle,
  Phone, Mail, Instagram, Twitter, Youtube, Sparkles,
  Lock, Layers, Search, Target,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/logo.png';

/* ─── DESIGN TOKENS ─────────────────────────────────────────────── */
const C = {
  navy:       '#0B1D51',
  navyMed:    '#1a3280',
  navyLt:     '#2d4fa6',
  navyGhost:  '#EEF1FA',
  navyFaint:  '#F5F7FE',
  white:      '#FFFFFF',
  offWhite:   '#F8F9FC',
  border:     '#E2E6F0',
  borderMd:   '#C8D0E8',
  text:       '#0B1120',
  textMd:     '#2D3748',
  muted:      '#64748B',
  dim:        '#94A3B8',
  accent:     '#1645C8',
  accentLt:   '#EBF0FF',
  gold:       '#C9A84C',
  goldLt:     '#FDF6E3',
  shadow:     'rgba(11,29,81,0.10)',
  shadowMd:   'rgba(11,29,81,0.18)',
};

/* ─── DATA ───────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { id: 'layanan',  label: 'Layanan' },
  { id: 'proses',   label: 'Proses' },
  { id: 'tentang',  label: 'Tentang' },
  { id: 'faq',      label: 'FAQ' },
  { id: 'kontak',   label: 'Kontak' },
];

const SERVICES = [
  { id: 'paket',   label: 'Paket Umroh', desc: 'Pilih paket umroh yang sesuai kebutuhan: itinerary jelas, fasilitas transparan, dan kuota real-time.', icon: Package, num: '01' },
  { id: 'profil',  label: 'Profil & Dokumen', desc: 'Lengkapi profil jamaah, upload dokumen wajib, lalu kirim verifikasi ke admin travel.', icon: Users, num: '02' },
  { id: 'order',   label: 'Pemesanan Online', desc: 'Pesan paket langsung dari dashboard user setelah profil terverifikasi.', icon: Zap, num: '03' },
  { id: 'invoice', label: 'Invoice & Pembayaran', desc: 'Terima invoice otomatis, bayar via transfer/manual, dan pantau status pembayaran.', icon: CheckCircle, num: '04' },
  { id: 'kloter',  label: 'Kloter Keberangkatan', desc: 'Lihat informasi kloter, status proses, hingga jadwal keberangkatan secara terpusat.', icon: Target, num: '05' },
  { id: 'report',  label: 'Dashboard Admin',   desc: 'Admin travel memantau jamaah, pesanan, cicilan, dan performa operasional harian.', icon: BarChart3, num: '06' },
];

const STEPS = [
  { num: '01', icon: Users,       title: 'Daftar Akun Jamaah',   desc: 'Buat akun dengan nomor WhatsApp dan email aktif, lalu verifikasi OTP.' },
  { num: '02', icon: CheckCircle, title: 'Lengkapi Profil',      desc: 'Isi data diri dan unggah dokumen jamaah untuk proses verifikasi admin.' },
  { num: '03', icon: Layers,      title: 'Pilih Paket Umroh',    desc: 'Bandingkan paket, fasilitas, harga kamar, dan kuota yang tersedia.' },
  { num: '04', icon: TrendingUp,  title: 'Bayar & Pantau',       desc: 'Lakukan pembayaran, pantau invoice/cicilan, dan ikuti status keberangkatan.' },
];

const TESTIMONIAL_HENDRA = {
  name: 'Ibu Siti A.',
  role: 'Jamaah Umroh',
  city: 'Bandung',
  rating: 5 as const,
  text: 'Proses dari daftar sampai pembayaran sangat jelas. Status dokumen, invoice, dan jadwal keberangkatan semuanya bisa dipantau dari satu aplikasi.',
  avatar: 'SA',
};

const DESTINATIONS_TICKER = [
  '🕋 Umroh', '✈ Makkah', '🕌 Madinah', '🛫 Jeddah', '📍 Miqat', '🕓 Jadwal Keberangkatan', '🧾 Invoice',
];

const FAQS = [
  { q: 'Apakah saya bisa memesan sebelum profil diverifikasi?', a: 'Belum. Anda tetap bisa melihat katalog paket, tetapi pemesanan aktif setelah profil dan dokumen disetujui admin.' },
  { q: 'Bagaimana cara daftar akun?', a: 'Klik "Daftar", isi data dasar, lalu verifikasi OTP yang dikirim ke WhatsApp Anda.' },
  { q: 'Dokumen apa saja yang wajib diunggah?', a: 'Dokumen utama meliputi paspor, KTP, KK, pas foto, dan vaksin meningitis. Dokumen tambahan mengikuti kondisi jamaah.' },
  { q: 'Apakah tersedia pembayaran cicilan?', a: 'Ya. Jika paket mengaktifkan cicilan, Anda bisa memilih tenor dan melihat jadwal jatuh tempo di dashboard.' },
  { q: 'Bagaimana jika bukti transfer ditolak?', a: 'Admin akan memberikan alasan penolakan, lalu Anda dapat unggah ulang bukti pembayaran tanpa mengulang dari awal.' },
  { q: 'Apakah bisa diakses dari HP?', a: 'Ya. Platform dapat diakses dengan nyaman melalui ponsel maupun desktop.' },
];

/* ─── GLOBAL STYLES ──────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html { scroll-behavior:smooth; }
  body { -webkit-font-smoothing:antialiased; }

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(24px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes ticker {
    from { transform:translateX(0); }
    to   { transform:translateX(-50%); }
  }
  @keyframes pulse-ring {
    0%   { box-shadow:0 0 0 0 rgba(37,211,102,0.4); }
    70%  { box-shadow:0 0 0 14px rgba(37,211,102,0); }
    100% { box-shadow:0 0 0 0 rgba(37,211,102,0); }
  }
  @keyframes navIn {
    from { opacity:0; transform:translateY(-12px); }
    to   { opacity:1; transform:translateY(0); }
  }

  .l-fu   { animation:fadeUp .65s cubic-bezier(.22,1,.36,1) both; }
  .l-d0   { animation-delay:.05s; }
  .l-d1   { animation-delay:.15s; }
  .l-d2   { animation-delay:.25s; }
  .l-d3   { animation-delay:.38s; }
  .l-d4   { animation-delay:.52s; }

  .l-reveal { opacity:0; }
  .l-revealed { animation:fadeUp .7s cubic-bezier(.22,1,.36,1) both; }

  .l-nav-anim { animation:navIn .45s cubic-bezier(.22,1,.36,1) both; }

  .ticker-wrap { overflow:hidden; white-space:nowrap; }
  .ticker-track { display:inline-flex; animation:ticker 36s linear infinite; }
  .ticker-track:hover { animation-play-state:paused; }

  /* NAV */
  .l-nav-link {
    font-family:'DM Sans',system-ui,sans-serif;
    font-size:14px; font-weight:500; color:#2D3748;
    background:none; border:none; cursor:pointer;
    text-decoration:none; padding:4px 0; position:relative;
    transition:color .2s;
  }
  .l-nav-link::after {
    content:''; position:absolute; bottom:-2px; left:0;
    width:0; height:1.5px; background:#0B1D51;
    transition:width .25s ease;
  }
  .l-nav-link:hover { color:#0B1D51; }
  .l-nav-link:hover::after { width:100%; }

  /* BUTTONS */
  .btn-primary {
    display:inline-flex; align-items:center; gap:8px;
    padding:13px 26px; border-radius:8px; border:none; cursor:pointer;
    background:#0B1D51; color:white;
    font-family:'DM Sans',system-ui,sans-serif;
    font-size:14px; font-weight:600; letter-spacing:.01em;
    text-decoration:none;
    box-shadow:0 4px 16px rgba(11,29,81,0.28);
    transition:all .2s; position:relative; overflow:hidden;
  }
  .btn-primary::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent);
    transform:translateX(-100%); transition:transform .5s;
  }
  .btn-primary:hover { background:#1a3280; transform:translateY(-1px); box-shadow:0 8px 28px rgba(11,29,81,0.36); }
  .btn-primary:hover::after { transform:translateX(100%); }

  .btn-outline {
    display:inline-flex; align-items:center; gap:8px;
    padding:12px 24px; border-radius:8px; cursor:pointer;
    background:transparent; color:#0B1D51;
    border:1.5px solid #0B1D51;
    font-family:'DM Sans',system-ui,sans-serif;
    font-size:14px; font-weight:600; text-decoration:none;
    transition:all .2s;
  }
  .btn-outline:hover { background:#EEF1FA; }

  .btn-ghost {
    display:inline-flex; align-items:center; gap:7px;
    padding:11px 22px; border-radius:8px; cursor:pointer;
    background:rgba(255,255,255,0.12); color:white;
    border:1px solid rgba(255,255,255,0.25);
    font-family:'DM Sans',system-ui,sans-serif;
    font-size:14px; font-weight:500; text-decoration:none;
    transition:all .2s;
  }
  .btn-ghost:hover { background:rgba(255,255,255,0.2); }

  /* CARDS */
  .l-card {
    background:white; border:1px solid #E2E6F0; border-radius:14px;
    transition:border-color .25s, transform .25s, box-shadow .25s;
  }
  .l-card:hover {
    border-color:#C8D0E8; transform:translateY(-4px);
    box-shadow:0 20px 50px rgba(11,29,81,0.10);
  }

  /* FAQ */
  .l-faq-item { border-bottom:1px solid #EEF1FA; }
  .l-faq-q {
    display:flex; align-items:center; justify-content:space-between;
    padding:20px 0; cursor:pointer; width:100%;
    background:none; border:none; text-align:left; gap:16px;
    font-family:'DM Sans',system-ui,sans-serif;
    font-size:15px; font-weight:600; color:#0B1120;
    transition:color .2s; line-height:1.5;
  }
  .l-faq-q:hover { color:#0B1D51; }
  .l-faq-a {
    overflow:hidden; transition:max-height .35s ease, opacity .3s;
    font-size:14px; color:#64748B; line-height:1.8;
    font-family:'DM Sans',system-ui,sans-serif;
  }

  /* SEARCH */
  .search-box { background:white; border:1px solid #E2E6F0; border-radius:16px; overflow:hidden; box-shadow:0 24px 64px rgba(11,29,81,0.12); }
  .hero-search-wrap .search-box { border-radius:20px; box-shadow:0 32px 80px rgba(11,29,81,0.16); min-height:420px; display:flex; flex-direction:column; }
  .hero-search-wrap .search-box > form { flex:1; display:flex; flex-direction:column; }
  .hero-search-wrap .search-tab { padding:12px 18px; font-size:14px; gap:8px; }
  .hero-search-wrap .search-input { height:48px; font-size:15px; }
  .hero-search-wrap .search-box > div:first-child { padding:16px 20px 0; }
  .hero-search-wrap .search-box form { padding:24px 24px 28px; }
  .search-tab { display:flex; align-items:center; gap:6px; padding:10px 16px; border:none; background:transparent; cursor:pointer; font-family:'DM Sans',system-ui,sans-serif; font-size:13px; font-weight:500; color:#64748B; border-bottom:2px solid transparent; margin-bottom:-1px; transition:all .2s; border-radius:0; }
  .search-tab:hover { color:#0B1D51; }
  .search-tab.active { color:#0B1D51; border-bottom-color:#0B1D51; font-weight:600; }
  .search-input { width:100%; height:42px; padding:0 12px; border-radius:8px; border:1.5px solid #E2E6F0; background:#F8F9FC; color:#0B1120; font-size:14px; font-family:'DM Sans',system-ui,sans-serif; outline:none; transition:border-color .2s, box-shadow .2s; }
  .search-input::placeholder { color:#94A3B8; }
  .search-input:focus { border-color:#0B1D51; box-shadow:0 0 0 3px rgba(11,29,81,0.08); background:white; }
  select.search-input { cursor:pointer; }

  /* PKG TAB */
  .pkg-tab { padding:9px 20px; border-radius:999px; font-size:13px; font-weight:500; cursor:pointer; border:1.5px solid #E2E6F0; background:white; color:#64748B; font-family:'DM Sans',system-ui,sans-serif; transition:all .2s; }
  .pkg-tab:hover { border-color:#0B1D51; color:#0B1D51; }
  .pkg-tab.active { background:#0B1D51; border-color:#0B1D51; color:white; }

  /* MISC */
  .l-section { padding:96px 24px; }
  .l-section-sm { padding:72px 24px; }
  .l-hr { height:1px; background:linear-gradient(90deg,transparent,#E2E6F0,transparent); }

  .display-font { font-family:'Playfair Display',Georgia,serif; }
  .body-font    { font-family:'DM Sans',system-ui,sans-serif; }

  .l-grid-2  { display:grid; grid-template-columns:1fr 1fr; gap:48px; align-items:center; }
  .l-hero-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(340px,1.22fr); gap:clamp(32px,4vw,64px); align-items:start; }
  .l-footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:40px; }

  .l-dot { width:8px; height:8px; border-radius:50%; cursor:pointer; border:none; transition:all .25s; }

  .l-hide-mob { }
  .l-show-mob { display:none !important; }

  @media (max-width:1024px) {
    .l-grid-2 { grid-template-columns:1fr; gap:40px; }
    .l-hero-grid { grid-template-columns:1fr; gap:36px; }
  }
  @media (max-width:768px) {
    .l-section { padding:60px 16px; }
    .l-section-sm { padding:48px 16px; }
    .l-footer-grid { grid-template-columns:1fr; gap:28px; }
    .l-hide-mob { display:none !important; }
    .l-show-mob { display:flex !important; }
    .search-tab { padding:8px 10px; font-size:12px; }
  }

  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:#F8F9FC; }
  ::-webkit-scrollbar-thumb { background:#C8D0E8; border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:#0B1D51; }
`;

/* ─── SUB-COMPONENTS ─────────────────────────────────────────────── */
const FaqItem: React.FC<{ q: string; a: string; open?: boolean }> = ({ q, a, open: defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="l-faq-item">
      <button className="l-faq-q" onClick={() => setOpen(v => !v)}>
        <span>{q}</span>
        <span style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: open ? '#EEF1FA' : '#F8F9FC', border: `1.5px solid ${open ? C.navy : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .25s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <ChevronDown size={13} color={open ? C.navy : C.muted} />
        </span>
      </button>
      <div className="l-faq-a" style={{ maxHeight: open ? 200 : 0, opacity: open ? 1 : 0, paddingBottom: open ? 20 : 0 }}>{a}</div>
    </div>
  );
};

const SectionLabel: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
    <span style={{ display: 'block', width: 24, height: 2, background: C.navy, borderRadius: 2 }} />
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: C.navyMed, fontFamily: "'DM Sans',system-ui,sans-serif" }}>{text}</span>
  </div>
);

/* ─── SEARCH WIDGET ──────────────────────────────────────────────── */
const TABS = [
  { id: 'paket',  label: 'Paket',  icon: Package },
] as const;
type TabId = typeof TABS[number]['id'];

const SearchWidget: React.FC<{
  onSearch: (p: Record<string, string>) => void;
}> = ({ onSearch }) => {
  const [tab, setTab] = useState<TabId>('paket');
  const [pkg, setPkg] = useState({ dest: '', date: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p: Record<string, string> = { product: tab };
    if (tab === 'paket') { if (pkg.dest) p.destination = pkg.dest; if (pkg.date) p.date = pkg.date; }
    onSearch(p);
  };

  const Label = ({ text }: { text: string }) => (
    <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontFamily: "'DM Sans',system-ui,sans-serif" }}>{text}</span>
  );

  return (
    <div className="search-box">
      <div style={{ display: 'flex', gap: 0, padding: '14px 18px 0', background: '#F8F9FC', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`search-tab ${tab === id ? 'active' : ''}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '20px 20px 24px' }}>
        {tab === 'paket' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Label text="Paket Umroh" /><input className="search-input" type="text" placeholder="Contoh: Umroh Reguler 12 Hari" value={pkg.dest} onChange={e => setPkg(p => ({ ...p, dest: e.target.value }))} /></div>
            <div><Label text="Perkiraan Berangkat" /><input className="search-input" type="date" value={pkg.date} onChange={e => setPkg(p => ({ ...p, date: e.target.value }))} /></div>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px 24px', fontSize: 14 }}>
            <Search size={15} /> Cari Sekarang
          </button>
        </div>
      </form>
    </div>
  );
};

/* ─── MAIN PAGE ──────────────────────────────────────────────────── */
const LandingPage: React.FC = () => {
  const navigate  = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [scrolled, setScrolled]   = useState(false);
  const [mobile, setMobile]       = useState(false);
  const [form, setForm]           = useState({ nama: '', email: '', telepon: '', pesan: '' });
  const [sent, setSent]           = useState(false);
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const s = document.createElement('style');
    s.innerHTML = STYLES;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.l-reveal');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add('l-revealed');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobile(false);
  };

  const W = { maxWidth: 1200, margin: '0 auto' };

  if (!isLoading && isAuthenticated) return null;

  return (
    <div style={{ minHeight: '100vh', background: C.offWhite, color: C.text, overflowX: 'hidden', fontFamily: "'DM Sans',system-ui,sans-serif" }}>

      {/* ══ NAV ══ */}
      <nav className="l-nav-anim" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
        boxShadow: scrolled ? `0 1px 24px ${C.shadow}` : 'none',
        transition: 'all .3s',
      }}>
        <div style={{ ...W, display: 'flex', alignItems: 'center', gap: 20, minHeight: 68, padding: '10px 24px' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <img src={logo} alt="Bintang Global" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.navy, lineHeight: 1.1, fontFamily: "'DM Sans',sans-serif" }}>Bintang Global</div>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '.18em', color: C.muted, textTransform: 'uppercase' }}>Platform Umroh</div>
            </div>
          </div>

          {/* Links */}
          <div className="l-hide-mob" style={{ display: 'flex', alignItems: 'center', gap: 26, flex: 1, justifyContent: 'center' }}>
            {NAV_LINKS.map(l => <button key={l.id} className="l-nav-link" onClick={() => scrollTo(l.id)}>{l.label}</button>)}
          </div>

          {/* Auth */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <Link to="/login" className="l-hide-mob l-nav-link" style={{ fontSize: 13, textDecoration: 'none' }}>Masuk</Link>
            <Link to="/register" className="btn-primary l-hide-mob" style={{ padding: '9px 18px', fontSize: 13 }}>
              Daftar Akun <ArrowRight size={13} />
            </Link>
            <button type="button" className="l-show-mob" onClick={() => setMobile(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, alignItems: 'center' }}>
              {mobile ? <X size={22} color={C.text} /> : <Menu size={22} color={C.text} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobile && (
          <div style={{ background: 'white', borderTop: `1px solid ${C.border}`, padding: '12px 24px 20px' }}>
            {NAV_LINKS.map(l => (
              <button key={l.id} className="l-nav-link" onClick={() => scrollTo(l.id)} style={{ display: 'block', padding: '12px 0', borderBottom: `1px solid ${C.border}`, width: '100%', textAlign: 'left' }}>{l.label}</button>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Link to="/login" className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMobile(false)}>Masuk</Link>
              <Link to="/register" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMobile(false)}>Daftar</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══ HERO ══ */}
      <section style={{ background: 'white', paddingTop: 68, position: 'relative', overflow: 'hidden' }}>
        {/* Geometric accent — wider behind search card */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: 'min(58%, 920px)', height: '100%', minHeight: 560, background: `linear-gradient(135deg, ${C.navyFaint} 0%, #e8eeff 100%)`, clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -100, right: '6%', width: 420, height: 420, borderRadius: '50%', background: `radial-gradient(circle, rgba(11,29,81,0.07) 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ ...W, width: '100%', padding: 'clamp(48px,6vw,88px) 24px 28px', position: 'relative', zIndex: 1 }}>
          <div className="l-hero-grid">
            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
              <div className="l-fu l-d0" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px 6px 8px', borderRadius: 100, background: C.navyFaint, border: `1px solid ${C.borderMd}`, width: 'fit-content', marginBottom: 24 }}>
                <span style={{ background: C.navy, borderRadius: 100, padding: '2px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '.12em', color: 'white', textTransform: 'uppercase' }}>BARU</span>
                <span style={{ fontSize: 12, color: C.navyMed, fontWeight: 500 }}>Dashboard jamaah · invoice & status real-time</span>
              </div>

              <h1
                className="l-fu l-d1 display-font"
                style={{
                  fontSize: 'clamp(28px,3.6vw,48px)',
                  fontWeight: 700,
                  lineHeight: 1.15,
                  letterSpacing: '-.02em',
                  margin: '0 0 18px',
                  color: C.text,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  columnGap: '0.35em',
                  rowGap: '0.12em',
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>Platform Terpercaya</span>
                <span style={{ color: C.navyMed, whiteSpace: 'nowrap' }}>Umroh B2C</span>
                <span style={{ fontSize: 'clamp(22px,2.8vw,38px)', fontWeight: 600, color: C.muted }}>untuk Seluruh Indonesia</span>
              </h1>

              <p className="l-fu l-d2" style={{ fontSize: 'clamp(15px,1.35vw,17px)', color: C.muted, lineHeight: 1.8, margin: '0 0 26px', maxWidth: 540 }}>
                Platform manajemen perjalanan <strong style={{ color: C.textMd, fontWeight: 600 }}>umroh untuk jamaah</strong>, mulai dari profil, dokumen, pemesanan paket, invoice, pembayaran, sampai kloter keberangkatan.
              </p>

              <div className="l-fu l-d2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
                {[
                  { icon: Package,      label: 'Paket Umroh' },
                  { icon: Users,        label: 'Profil Jamaah' },
                  { icon: CheckCircle,  label: 'Invoice' },
                  { icon: Target,       label: 'Kloter' },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 500, background: C.navyFaint, border: `1px solid ${C.borderMd}`, color: C.navyMed }}>
                    <Icon size={12} /> {label}
                  </span>
                ))}
              </div>

              <div className="l-fu l-d3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn-primary" onClick={() => scrollTo('layanan')} style={{ fontSize: 14, padding: '14px 28px' }}>
                  Mulai Daftar Jamaah <Sparkles size={14} />
                </button>
                <Link to="/login" className="btn-outline" style={{ fontSize: 14, padding: '13px 24px' }}>Sudah Punya Akun</Link>
              </div>

              <div className="l-fu l-d4" style={{ display: 'flex', gap: 22, marginTop: 28, flexWrap: 'wrap' }}>
                {[
                  { icon: Shield,   label: 'Berlisensi resmi' },
                  { icon: Headphones, label: 'Dukungan jamaah' },
                  { icon: Lock,     label: 'Data aman' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, fontWeight: 500 }}>
                    <Icon size={14} color={C.navyLt} /> {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: larger search card */}
            <div className="l-fu l-d2 hero-search-wrap" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
              <SearchWidget onSearch={p => navigate(`/register?${new URLSearchParams(p)}`)} />
              <p style={{ fontSize: 12, color: C.dim, textAlign: 'center', marginTop: 14 }}>Pilih paket lalu lanjutkan ke pendaftaran jamaah</p>
            </div>
          </div>
        </div>

        {/* Full-width destination marquee (edge to edge) */}
        <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', background: C.navy, padding: '14px 0', overflow: 'hidden', marginTop: 8 }}>
          <div className="ticker-wrap">
            <div className="ticker-track">
              {[...DESTINATIONS_TICKER, ...DESTINATIONS_TICKER].map((item, i) => (
                <span key={i} style={{ padding: '0 26px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', borderRight: '1px solid rgba(255,255,255,0.12)', display: 'inline-flex', alignItems: 'center', letterSpacing: '.02em' }}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ SERVICES ══ */}
      <section id="layanan" className="l-section" style={{ background: 'white' }}>
        <div style={W}>
          <div className="l-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <SectionLabel text="Layanan Lengkap" />
            <h2 className="display-font" style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700, lineHeight: 1.1, margin: '0 0 14px', color: C.text }}>
              Semua yang Anda Butuhkan,<br />
              <em style={{ color: C.navyMed }}>Dalam Satu Platform</em>
            </h2>
            <p style={{ fontSize: 15, color: C.muted, maxWidth: 480, margin: '0 auto', lineHeight: 1.8 }}>Ekosistem digital terintegrasi untuk kebutuhan proses perjalanan umroh end-to-end.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
            {SERVICES.map((svc, i) => {
              const Icon = svc.icon;
              return (
                <div key={svc.id} className="l-card l-reveal" style={{ padding: '28px 28px 24px', cursor: 'pointer', animationDelay: `${i * 0.07}s` }} onClick={() => navigate('/register')}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: C.navyFaint, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={22} color={C.navy} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: '.08em' }}>{svc.num}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: C.text }}>{svc.label}</h3>
                  <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: '0 0 18px' }}>{svc.desc}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.navyMed, fontWeight: 600 }}>
                    Selengkapnya <ChevronRight size={13} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin: '0 24px' }} />

      {/* ══ HOW IT WORKS ══ */}
      <section id="proses" className="l-section" style={{ background: 'white' }}>
        <div style={W}>
          <div className="l-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
            <SectionLabel text="Cara Bergabung" />
            <h2 className="display-font" style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700, lineHeight: 1.1, margin: '0 0 14px', color: C.text }}>
              Mulai dalam <em style={{ color: C.navyMed }}>4 Langkah</em> Mudah
            </h2>
            <p style={{ fontSize: 15, color: C.muted, maxWidth: 420, margin: '0 auto', lineHeight: 1.8 }}>Proses bergabung yang sederhana, cepat, dan sepenuhnya gratis.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 28, position: 'relative' }}>
            <div className="l-hide-mob" style={{ position: 'absolute', top: 33, left: '12.5%', right: '12.5%', height: 1, background: `linear-gradient(90deg, ${C.border}, ${C.borderMd}, ${C.border})`, zIndex: 0 }} />
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="l-reveal" style={{ textAlign: 'center', animationDelay: `${i * 0.12}s`, position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 66, height: 66, borderRadius: 18, background: 'white', border: `2px solid ${C.border}`, boxShadow: `0 4px 20px ${C.shadow}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', position: 'relative' }}>
                    <Icon size={26} color={C.navy} />
                    <div style={{ position: 'absolute', top: -10, right: -10, width: 26, height: 26, borderRadius: 8, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white' }}>
                      {step.num}
                    </div>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: C.text }}>{step.title}</h3>
                  <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="l-reveal" style={{ textAlign: 'center', marginTop: 52 }}>
            <Link to="/register" className="btn-primary" style={{ fontSize: 15, padding: '14px 36px' }}>
              <Zap size={16} /> Daftar Sekarang — Gratis
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FEATURE STRIP ══ */}
      <div style={{ background: C.navy, padding: '48px 24px' }}>
        <div style={{ ...W, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 32 }}>
          {[
            { icon: Shield,     title: 'Berlisensi Resmi',        desc: 'Kemenag, IATA & POJK' },
            { icon: Headphones, title: 'Support 24/7',            desc: 'Tim siap membantu kapan saja' },
            { icon: Lock,       title: 'Data Aman & Enkripsi',    desc: 'Keamanan tingkat enterprise' },
            { icon: Zap,        title: 'Proses Instan',           desc: 'Verifikasi & aktivasi cepat' },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="l-reveal" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', animationDelay: `${i * 0.1}s` }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} color="rgba(255,255,255,0.85)" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ TENTANG ══ */}
      <section id="tentang" className="l-section" style={{ background: C.offWhite }}>
        <div style={W}>
          <div className="l-grid-2">
            <div className="l-reveal">
              <SectionLabel text="Mengapa Kami" />
              <h2 className="display-font" style={{ fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 700, lineHeight: 1.12, margin: '0 0 16px', color: C.text }}>
                15 Tahun Membangun<br /><em style={{ color: C.navyMed }}>Kepercayaan</em>
              </h2>
              <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.8, margin: '0 0 32px', maxWidth: 440 }}>
                Bintang Global membantu jamaah dan admin travel menjalankan proses umroh secara lebih mudah, terstruktur, dan transparan.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { icon: Target,        title: 'Fokus pada Kemudahan',    desc: 'Setiap fitur dirancang agar proses jamaah lebih cepat dan minim kendala.' },
                  { icon: MessageCircle, title: 'Komunikasi Transparan',   desc: 'Notifikasi real-time dan laporan lengkap untuk setiap transaksi.' },
                  { icon: Award,         title: 'Penghargaan Industri',    desc: 'Diakui sebagai platform travel umroh terbaik selama 5 tahun berturut-turut.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} style={{ display: 'flex', gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 11, background: C.navyFaint, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color={C.navy} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: C.text }}>{title}</div>
                      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity feed */}
            <div className="l-reveal">
              <div style={{ background: 'white', border: `1px solid ${C.border}`, borderRadius: 20, padding: 26, boxShadow: `0 20px 60px ${C.shadow}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.textMd }}>Aktivitas Jamaah — Minggu Ini</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '3px 10px', borderRadius: 100, border: '1px solid #bbf7d0' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> LIVE
                  </span>
                </div>
                {[
                  { name: 'PT Cahaya Umroh',  status: 'Order Baru',    amount: '+Rp 12.5jt', time: '5m lalu' },
                  { name: 'Madina Tour',       status: 'Visa Disetujui', amount: '3 Jamaah',  time: '18m lalu' },
                  { name: 'Firdaus Travel',    status: 'Pembayaran',    amount: '+Rp 8.2jt',  time: '1j lalu' },
                  { name: 'Al-Madinah Tour',   status: 'Order Baru',    amount: '+Rp 22.1jt', time: '2j lalu' },
                  { name: 'Berkah Umroh',      status: 'Invoice Lunas', amount: '✓ Selesai',  time: '3j lalu' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < 4 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: C.navyFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.navyMed, flexShrink: 0 }}>
                      {item.name.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{item.status}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{item.amount}</div>
                      <div style={{ fontSize: 10, color: C.dim }}>{item.time}</div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 14, padding: '12px 14px', background: C.navyFaint, borderRadius: 10, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TrendingUp size={15} color={C.navyMed} />
                  <span style={{ fontSize: 12, color: C.textMd }}>Total revenue minggu ini</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginLeft: 'auto' }}>+Rp 42.8jt</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin: '0 24px' }} />

      {/* ══ TESTIMONIALS ══ */}
      <section className="l-section" style={{ background: 'white' }}>
        <div style={W}>
          <div className="l-reveal" style={{ textAlign: 'center', marginBottom: 40 }}>
            <SectionLabel text="Testimoni Jamaah" />
            <h2 className="display-font" style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700, lineHeight: 1.1, margin: 0, color: C.text }}>
              Apa Kata <em style={{ color: C.navyMed }}>Jamaah Kami</em>
            </h2>
          </div>

          <div
            className="l-reveal"
            style={{
              maxWidth: 880,
              margin: '0 auto',
              textAlign: 'center',
              background: `linear-gradient(180deg, ${C.navyFaint} 0%, white 45%)`,
              border: `1px solid ${C.border}`,
              borderRadius: 22,
              padding: 'clamp(36px,5vw,56px) clamp(24px,4vw,48px)',
              boxShadow: `0 24px 60px ${C.shadow}`,
            }}
          >
            <div style={{ fontSize: 52, color: C.navy, lineHeight: 0.65, marginBottom: 20, fontFamily: 'Georgia,serif', opacity: 0.15 }}>&ldquo;</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 22 }}>
              {[...Array(TESTIMONIAL_HENDRA.rating)].map((_, j) => <Star key={j} size={18} fill={C.gold} color={C.gold} />)}
            </div>
            <p style={{ fontSize: 'clamp(17px,2.2vw,20px)', color: C.textMd, lineHeight: 1.85, margin: '0 0 36px', fontStyle: 'italic', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
              &ldquo;{TESTIMONIAL_HENDRA.text}&rdquo;
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {TESTIMONIAL_HENDRA.avatar}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{TESTIMONIAL_HENDRA.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{TESTIMONIAL_HENDRA.role} · 📍 {TESTIMONIAL_HENDRA.city}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin: '0 24px' }} />

      {/* ══ FAQ ══ */}
      <section id="faq" className="l-section" style={{ background: C.offWhite }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="l-reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
            <SectionLabel text="FAQ" />
            <h2 className="display-font" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, lineHeight: 1.1, margin: '0 0 14px', color: C.text }}>
              Pertanyaan yang Sering <em style={{ color: C.navyMed }}>Ditanyakan</em>
            </h2>
          </div>
          <div className="l-reveal">
            {FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} open={i === 0} />)}
          </div>
        </div>
      </section>

      {/* ══ CONTACT ══ */}
      <section id="kontak" className="l-section" style={{ background: 'white' }}>
        <div style={W}>
          <div className="l-reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
            <SectionLabel text="Hubungi Kami" />
            <h2 className="display-font" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, lineHeight: 1.1, margin: '0 0 14px', color: C.text }}>
              Tim Kami Siap <em style={{ color: C.navyMed }}>Membantu</em>
            </h2>
            <p style={{ fontSize: 15, color: C.muted, maxWidth: 440, margin: '0 auto', lineHeight: 1.8 }}>Butuh bantuan atau ingin diskusi kerja sama? Kami siap merespons dalam 1×24 jam.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 48 }}>
            {[
              { icon: Phone,         label: 'Telepon',  value: '021-XXXX-XXXX',           desc: 'Senin–Sabtu, 08:00–17:00 WIB' },
              { icon: Mail,          label: 'Email',    value: 'support@bintangglobal.id', desc: 'Balasan dalam 1×24 jam' },
              { icon: MessageCircle, label: 'WhatsApp', value: '08xx-xxxx-xxxx',           desc: 'Support cepat via chat' },
              { icon: Building2,     label: 'Kantor',   value: '50+ Kota',                 desc: 'Jaringan seluruh Indonesia' },
            ].map(({ icon: Icon, label, value, desc }) => (
              <div key={label} style={{ padding: 22, borderRadius: 14, border: `1px solid ${C.border}`, background: C.offWhite, transition: 'all .2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.navyMed; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${C.shadow}`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: C.navyFaint, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon size={18} color={C.navy} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: C.navyMed, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{value}</div>
                <div style={{ fontSize: 12, color: C.dim }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* Form — full width within container */}
          <div className="l-reveal" style={{ width: '100%' }}>
            <div style={{ background: C.offWhite, borderRadius: 20, border: `1px solid ${C.border}`, padding: 'clamp(28px,4vw,46px)', boxShadow: `0 20px 56px ${C.shadow}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.navyMed, marginBottom: 8, letterSpacing: '.14em', textTransform: 'uppercase' }}>Form Hubungi Kami</div>
              <p style={{ fontSize: 14, color: C.muted, marginBottom: 28, maxWidth: 560 }}>Isi nama, email, dan pesan — tim kami akan merespons dalam 1×24 jam kerja.</p>
              {sent ? (
                <div style={{ padding: 32, textAlign: 'center', color: C.navy, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <CheckCircle size={48} />
                  <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.75, maxWidth: 420 }}>Pesan Anda telah terkirim. Tim kami akan menghubungi dalam 1×24 jam.</p>
                  <button type="button" className="btn-outline" style={{ marginTop: 4 }} onClick={() => setSent(false)}>Kirim Pesan Lagi</button>
                </div>
              ) : (
                <form onSubmit={e => { e.preventDefault(); if (form.nama && form.email && form.pesan) { setSent(true); setForm({ nama: '', email: '', telepon: '', pesan: '' }); } }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 18 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Nama *</label>
                      <input type="text" required placeholder="Nama atau perusahaan Anda" value={form.nama} onChange={e => setForm(v => ({ ...v, nama: e.target.value }))}
                        style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'white', fontSize: 15, outline: 'none', fontFamily: "'DM Sans',system-ui,sans-serif", color: C.text, transition: 'border-color .2s' }}
                        onFocus={e => (e.currentTarget.style.borderColor = C.navy)} onBlur={e => (e.currentTarget.style.borderColor = C.border)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Email *</label>
                      <input type="email" required placeholder="email@contoh.com" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))}
                        style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'white', fontSize: 15, outline: 'none', fontFamily: "'DM Sans',system-ui,sans-serif", color: C.text, transition: 'border-color .2s' }}
                        onFocus={e => (e.currentTarget.style.borderColor = C.navy)} onBlur={e => (e.currentTarget.style.borderColor = C.border)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Telepon</label>
                      <input type="tel" placeholder="08xx-xxxx-xxxx" value={form.telepon} onChange={e => setForm(v => ({ ...v, telepon: e.target.value }))}
                        style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'white', fontSize: 15, outline: 'none', fontFamily: "'DM Sans',system-ui,sans-serif", color: C.text, transition: 'border-color .2s' }}
                        onFocus={e => (e.currentTarget.style.borderColor = C.navy)} onBlur={e => (e.currentTarget.style.borderColor = C.border)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Pesan *</label>
                    <textarea required rows={5} placeholder="Tulis pesan atau pertanyaan Anda..." value={form.pesan} onChange={e => setForm(v => ({ ...v, pesan: e.target.value }))}
                      style={{ width: '100%', minHeight: 140, padding: '14px 16px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'white', fontSize: 15, outline: 'none', fontFamily: "'DM Sans',system-ui,sans-serif", resize: 'vertical', color: C.text, transition: 'border-color .2s', lineHeight: 1.65 }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.navy)} onBlur={e => (e.currentTarget.style.borderColor = C.border)}
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px 28px', fontSize: 15 }}>
                    Kirim Pesan <ArrowRight size={14} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMed} 50%, #0a1438 100%)`, padding: '96px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 40%)`, pointerEvents: 'none' }} />
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="l-reveal">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 100, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', marginBottom: 24 }}>
              <Sparkles size={12} color="rgba(255,255,255,0.8)" />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase' }}>Bergabung Sekarang</span>
            </div>
            <h2 className="display-font" style={{ fontSize: 'clamp(28px,5vw,54px)', fontWeight: 700, lineHeight: 1.1, color: 'white', margin: '0 0 18px' }}>
              Siap Tingkatkan Bisnis<br />
              <em style={{ color: '#A5B4FC' }}>Travel Anda?</em>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, margin: '0 auto 40px', lineHeight: 1.75, maxWidth: 440 }}>
              Daftar gratis dalam 2 menit. Verifikasi instan. Akses penuh ke semua fitur platform.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 34px', borderRadius: 9, background: 'white', color: C.navy, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', transition: 'all .2s', fontFamily: "'DM Sans',system-ui,sans-serif" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
                <Zap size={16} /> Daftar Akun — GRATIS
              </Link>
              <Link to="/login" className="btn-ghost" style={{ fontSize: 15, padding: '13px 28px' }}>Sudah Punya Akun</Link>
            </div>
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap' }}>
              {['Tanpa biaya pendaftaran', 'Verifikasi 24 jam', 'Komisi hingga 8%'].map(b => (
                <span key={b} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>✓ {b}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ background: '#05091a', padding: '56px 24px 32px', borderTop: `3px solid ${C.navyMed}` }}>
        <div style={W}>
          <div className="l-footer-grid" style={{ marginBottom: 44 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <img src={logo} alt="Bintang Global" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'white', fontFamily: "'DM Sans',sans-serif" }}>Bintang Global</div>
                  <div style={{ fontSize: 9, color: '#6B7FCC', letterSpacing: '.18em', textTransform: 'uppercase' }}>Platform Umroh</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.75, margin: '0 0 20px', maxWidth: 220 }}>Platform travel umroh terintegrasi untuk admin travel dan jamaah di seluruh Indonesia.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[Instagram, Twitter, Youtube].map((Icon, i) => (
                  <button key={i} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)'; }}>
                    <Icon size={14} color="rgba(255,255,255,0.5)" />
                  </button>
                ))}
              </div>
            </div>
            {[
              { title: 'Platform', links: [['Layanan', '#layanan'], ['Cara Kerja', '#proses'], ['Tentang Kami', '#tentang'], ['FAQ', '#faq']] },
              { title: 'Jamaah',  links: [['Daftar Jamaah', '/register'], ['Masuk Dashboard', '/login'], ['Kebijakan Privasi', '#'], ['Syarat & Ketentuan', '#']] },
              { title: 'Kontak',   links: [['021-XXXX-XXXX', '#'], ['support@bintangglobal.id', '#'], ['Senin–Sabtu 08–17', '#'], ['Support 24/7', '#']] },
            ].map(({ title, links }) => (
              <div key={title}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', color: '#6B7FCC', textTransform: 'uppercase', marginBottom: 16 }}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(([label, href]) => (
                    <a key={label} href={href} style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', transition: 'color .2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 22 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Bintang Global. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Privasi', 'Syarat & Ketentuan', 'Cookie'].map(l => (
                <a key={l} href="#" style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp FAB */}
      <button title="Chat WhatsApp" onClick={() => window.open('https://wa.me/62', '_blank')} style={{ position: 'fixed', bottom: 26, right: 26, zIndex: 999, width: 54, height: 54, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#25d366,#128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse-ring 3s ease-in-out infinite', transition: 'transform .2s' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </button>
    </div>
  );
};

export default LandingPage;