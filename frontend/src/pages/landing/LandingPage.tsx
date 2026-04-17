import React, { useState, useEffect } from 'react';
import {
  Menu, X, ArrowRight, Star, Shield, Headphones,
  CheckCircle, Zap, Package, Users, Target,
  MessageCircle, Phone, Mail, Instagram, Twitter, Youtube,
  Search, Calendar, MapPin, ChevronRight, Award, Hotel, Clock, Home, LogIn, UserPlus
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/nail-al-khairat-logo.svg'

/* ─── DESIGN TOKENS ─────────────────────────────────────────────── */
const COLORS = {
  bg: '#0A0A0A',
  bgSecondary: '#141414',
  accent: '#C9A04B', 
  accentHover: '#B38D3E',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  border: '#27272A',
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen font-sans antialiased text-white selection:bg-[#C9A04B] selection:text-black pb-20 md:pb-0" style={{ backgroundColor: COLORS.bg }}>

      {/* ─── TOP NAVIGATION (Cleaned up for Mobile) ──────────────────── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10 py-3' : 'bg-transparent py-5'}`}>
        <div className="container mx-auto px-6 flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" >
              <img src={logo} alt="Logo" />
            </div>
            <span className="text-xl font-bold tracking-tight uppercase" style={{ color: COLORS.accent }}>Nail Al-Khairat</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-10">
            {['Home', 'Tentang Kami', 'Layanan', 'Paket Umroh & Haji', 'Testimoni', 'Galeri', 'FAQ'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} className="text-sm font-medium text-zinc-400 hover:text-[#C9A04B] transition-colors">
                {item}
              </a>
            ))}
          </div>

          {/* Desktop Actions Only */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium hover:text-[#C9A04B] transition-colors">Log In</Link>
            <Link style={{ backgroundColor: COLORS.accent }} to="/register" className="text-black px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-white transition-all transform hover:scale-105 active:scale-95">
              Daftar <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── MOBILE OVERLAY MENU (Triggered by Bottom Nav) ───────────── */}
      <div className={`fixed inset-0 z-[60] bg-black transition-transform duration-500 ${mobileMenuOpen ? 'translate-y-0' : 'translate-y-full'} md:hidden`}>
        <div className="p-8 flex flex-col h-full">
          <div className="flex justify-between items-center mb-12">
            <span className="text-xl font-bold uppercase" style={{ color: COLORS.accent }}>Menu</span>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-white/5 rounded-full"><X /></button>
          </div>
          
          <div className="flex flex-col gap-6 text-2xl font-bold mb-12">
             {['Home', 'Layanan', 'Paket Umroh & Haji', 'Testimoni', 'Galeri'].map((item) => (
              <a key={item} onClick={() => setMobileMenuOpen(false)} href={`#${item.toLowerCase().replace(/ /g, '-')}`} className="hover:text-[#C9A04B]">
                {item}
              </a>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-4">
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full py-4 rounded-2xl bg-zinc-900 flex items-center justify-center gap-3 font-bold border border-white/10">
              <LogIn size={20} /> Masuk Ke Akun
            </Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-black" style={{ backgroundColor: COLORS.accent }}>
              <UserPlus size={20} /> Daftar Sekarang
            </Link>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM NAVIGATION (MOBILE) ─────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 px-8 py-4 flex justify-between items-center text-zinc-400">
        <a href="#" className="flex flex-col items-center gap-1 text-[#C9A04B]">
          <Home size={22} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Home</span>
        </a>
        <a href="#layanan" className="flex flex-col items-center gap-1">
          <Zap size={22} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Layanan</span>
        </a>
        <a href="#paket-umroh-&-haji" className="flex flex-col items-center gap-1">
          <Package size={22} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Paket</span>
        </a>
        <button onClick={() => setMobileMenuOpen(true)} className="flex flex-col items-center gap-1">
          <Menu size={22} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Menu</span>
        </button>
      </div>

      {/* ─── HERO SECTION ────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden text-left px-6">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1511652019870-fbd8713560bf?q=80&w=1946&auto=format&fit=crop"
            alt="Mekkah View"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-black/20" />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl">
            <h1 className="text-4xl md:text-8xl font-bold leading-tight tracking-tighter mb-6">
              Haji & <span className="italic" style={{ color: COLORS.accent }}>Umrah</span> Nyaman dan Terpercaya
            </h1>
            <p className="text-lg md:text-xl text-zinc-300 max-w-xl mb-10 leading-relaxed">
              Wujudkan perjalanan ibadah Anda dengan layanan profesional, bimbingan berpengalaman, dan fasilitas terbaik.
            </p>

            {/* Search Widget */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-[32px] md:rounded-full flex flex-col md:flex-row items-center gap-4 max-w-5xl">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full px-4">
                <div className="flex flex-col border-b md:border-b-0 md:border-r border-white/10 pb-3 md:pb-0">
                  <span className="text-[10px] uppercase font-bold mb-1 text-[#C9A04B]">Tanggal Keberangkatan</span>
                  <div className="flex items-center gap-2 text-sm font-semibold truncate"><Calendar size={14} /> Mar 01 - Apr 04</div>
                </div>
                <div className="flex flex-col border-b md:border-b-0 md:border-r border-white/10 pb-3 md:pb-0">
                  <span className="text-[10px] uppercase font-bold mb-1 text-[#C9A04B]">Durasi Perjalanan</span>
                  <div className="flex items-center gap-2 text-sm font-semibold"><MapPin size={14} /> 12 - 15 Hari</div>
                </div>
                <div className="flex flex-col border-b md:border-b-0 md:border-r border-white/10 pb-3 md:pb-0">
                  <span className="text-[10px] uppercase font-bold mb-1 text-[#C9A04B]">Jenis Paket</span>
                  <div className="flex items-center gap-2 text-sm font-semibold"><Package size={14} /> Economy</div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold mb-1 text-[#C9A04B]">Harga (Mulai dari...)</span>
                  <div className="flex items-center gap-2 text-sm font-semibold font-black">23 Jt - 35 Jt</div>
                </div>
              </div>
              <button className="text-black w-full md:w-auto px-10 py-4 rounded-full font-bold flex items-center justify-center gap-2 transition-all active:scale-95" style={{ backgroundColor: COLORS.accent }}>
                Search <Search size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── VALUE PROP SECTION ──────────────────────────────────────── */}
      <section className="py-24 bg-[#0A0A0A] text-left px-6">
        <div className="container mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-8">
              Perjalanan <span className="text-zinc-500">ibadah Anda,</span> direncanakan dengan baik.
            </h2>
            <button className="bg-white text-black px-8 py-4 rounded-full font-bold flex items-center gap-2 mb-12">
              Konsultasi Sekarang <ArrowRight size={18} />
            </button>

            <div className="text-black p-6 rounded-3xl inline-block shadow-2xl w-full md:w-auto" style={{ backgroundColor: COLORS.accent }}>
              <div className="text-4xl font-black mb-1">3000++</div>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => <div key={i} className="w-10 h-10 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center overflow-hidden"><img src={`https://i.pravatar.cc/150?u=${i}`} alt=""/></div>)}
                </div>
                <span className="text-xs font-bold uppercase">Jamaah Dilayani</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-[3/5] rounded-[40px] overflow-hidden">
              <img src="https://images.unsplash.com/photo-1607596797957-74f502d89d1c?q=80&w=1974&auto=format&fit=crop" className="w-full h-full object-cover" alt="" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-zinc-900 border border-white/5 p-8 rounded-[40px] flex-1 flex flex-col justify-center text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2 text-[#C9A04B]">95%</div>
                <div className="text-[10px] text-zinc-500 uppercase font-bold">Jamaah Puas</div>
              </div>
              <div className="bg-zinc-900 border border-white/5 p-8 rounded-[40px] flex-1 flex flex-col justify-center text-center">
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">20+</div>
                <div className="text-[10px] text-zinc-500 uppercase font-bold">Tahun Pengalaman</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SERVICES GRID ────────────────────────────────────────────── */}
      <section id="layanan" className="py-24 bg-zinc-950 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-12 text-left">Layanan Umroh<span style={{ color: COLORS.accent }}> & Haji </span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[
              { icon: Package, title: 'Paket Terbaik', img: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=600' },
              { icon: Users, title: 'Manajemen Jamaah', img: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=600' },
              { icon: Headphones, title: 'Bimbingan 24/7', img: 'https://images.unsplash.com/photo-1527838832700-5059252407fa?q=80&w=600' }
            ].map((svc, i) => (
              <div key={i} className="group relative p-10 rounded-[40px] bg-zinc-900 overflow-hidden border border-white/5 h-[320px] flex flex-col justify-end">
                <img src={svc.img} className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-30 transition-all duration-700" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-[#C9A04B] rounded-xl flex items-center justify-center mb-6 text-black">
                    <svc.icon size={24} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{svc.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PAKET SECTION ────────────────────────────────────────────── */}
      <section id="paket-umroh-&-haji" className="py-24 bg-[#0A0A0A] px-6">
        <div className="container mx-auto text-left">
          <h2 className="text-3xl md:text-5xl font-bold mb-12">Pilihan <span style={{ color: COLORS.accent }}>Paket Terbaik</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {[
              { title: 'Umroh Reguler', price: '28.5', img: 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=600' },
              { title: 'Umroh Plus Turki', price: '38.9', img: 'https://images.unsplash.com/photo-1527838832700-5059252407fa?q=80&w=600' },
              { title: 'Haji Premium', price: '250', img: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=600' }
            ].map((pkg, i) => (
              <div key={i} className="group bg-zinc-900 border border-white/5 rounded-[40px] overflow-hidden">
                <div className="h-64 overflow-hidden relative">
                   <img src={pkg.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-4">{pkg.title}</h3>
                  <div className="text-3xl font-black mb-8">Rp {pkg.price}jt</div>
                  <button className="w-full py-4 rounded-full border border-white/10 hover:bg-[#C9A04B] hover:text-black transition-all font-bold">Pilih Paket</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GALLERY BENTO ───────────────────────────────────────────── */}
      <section id="galeri" className="py-24 bg-[#0A0A0A] px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-12 text-left">Momen <span style={{ color: COLORS.accent }}>Suci Kami</span></h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:h-[600px]">
            <div className="col-span-2 row-span-2 rounded-[40px] overflow-hidden h-[300px] md:h-auto border border-white/5">
              <img src="https://images.unsplash.com/photo-1610448721566-47369c768e70?q=80&w=800" className="w-full h-full object-cover" alt="" />
            </div>
            <div className="col-span-2 md:col-span-2 rounded-[30px] md:rounded-[40px] overflow-hidden h-[200px] md:h-auto border border-white/5">
              <img src="https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=800" className="w-full h-full object-cover" alt="" />
            </div>
            <div className="rounded-[30px] md:rounded-[40px] overflow-hidden h-[200px] md:h-auto border border-white/5">
              <img src="https://images.unsplash.com/photo-1565019053020-008316682705?q=80&w=800" className="w-full h-full object-cover" alt="" />
            </div>
            <div className="bg-[#C9A04B] rounded-[30px] md:rounded-[40px] flex flex-col items-center justify-center text-center p-6 h-[200px] md:h-auto text-black">
              <Star size={32} fill="black" />
              <div className="text-3xl font-black mt-2">500+</div>
              <div className="text-[10px] font-bold uppercase tracking-widest">Momen Terabadikan</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ────────────────────────────────────────────── */}
      <section id="testimoni" className="py-24 bg-[#0A0A0A] px-6">
        <div className="container mx-auto">
          <div className="max-w-5xl mx-auto bg-zinc-900 border border-white/5 rounded-[40px] md:rounded-[50px] overflow-hidden flex flex-col md:flex-row text-left">
            <div className="md:w-2/5 h-72 md:h-auto">
              <img src="https://plus.unsplash.com/premium_photo-1661964242329-1d711f99a504?q=80&w=1000" className="w-full h-full object-cover" alt="" />
            </div>
            <div className="md:w-3/5 p-8 md:p-20 flex flex-col justify-center">
              <div className="flex gap-1 mb-6 text-[#C9A04B]">
                {[...Array(5)].map((_, i) => <Star key={i} size={20} fill="currentColor" />)}
              </div>
              <p className="text-xl md:text-2xl font-medium italic mb-8">"Perjalanan ibadah yang sangat luar biasa. Semua terorganisir dengan rapi dari keberangkatan sampai pulang."</p>
              <div>
                <div className="text-lg font-bold">Bapak Ahmad</div>
                <div className="text-zinc-500">Jamaah Umroh 2025</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA SECTION ─────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center">
        <div className="container mx-auto">
          <div className="rounded-[40px] md:rounded-[60px] p-12 md:p-24 text-black relative overflow-hidden bg-[#C9A04B] shadow-2xl">
            <h2 className="text-4xl md:text-8xl font-black tracking-tighter mb-8 leading-none uppercase">Siap Ke<br/>Tanah Suci?</h2>
            <Link to="/register" className="bg-zinc-900 text-white px-12 py-5 rounded-full text-lg font-bold inline-block hover:scale-105 transition-all">Daftar Sekarang</Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="py-20 bg-black border-t border-white/5 text-left px-6">
        <div className="container mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <span className="text-2xl font-bold uppercase tracking-tight text-[#C9A04B]">Nail Al-Khairat</span>
            <p className="mt-6 text-zinc-500 max-w-sm">Partner resmi perjalanan ibadah Haji & Umrah dengan standar pelayanan bintang lima.</p>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-[#C9A04B] uppercase tracking-[0.2em] text-xs">Link Cepat</h4>
            <ul className="space-y-4 text-zinc-500 text-sm">
              <li>Tentang Kami</li>
              <li>Layanan</li>
              <li>Paket Umroh</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-[#C9A04B] uppercase tracking-[0.2em] text-xs">Bantuan</h4>
            <ul className="space-y-4 text-zinc-500 text-sm">
              <li>Kebijakan Privasi</li>
              <li>Syarat & Ketentuan</li>
              <li>Hubungi Kami</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;