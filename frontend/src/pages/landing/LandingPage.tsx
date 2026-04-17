import React, { useState, useEffect } from 'react';
import {
  Menu, X, ArrowRight, Star, Shield, Headphones,
  CheckCircle, Zap, Package, Users, Target,
  MessageCircle, Phone, Mail, Instagram, Twitter, Youtube,
  Search, Calendar, MapPin, ChevronRight, Award, Hotel, Clock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/nail-al-khairat-logo.svg'

/* ─── DESIGN TOKENS ─────────────────────────────────────────────── */
const COLORS = {
  bg: '#0A0A0A',
  bgSecondary: '#141414',
  accent: '#C9A04B', // Your specific Gold color
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
    <div className="min-h-screen font-sans antialiased text-white selection:bg-[#C9A04B] selection:text-black" style={{ backgroundColor: COLORS.bg }}>

      {/* ─── NAVIGATION ─────────────────────────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10 py-3' : 'bg-transparent py-5'}`}>
        <div className="container mx-auto px-6 flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" >
              <img src={logo} alt="" />
            </div>
            <span className="text-xl font-bold tracking-tight uppercase" style={{ color: COLORS.accent }}>Nail Al-Khairat</span>
          </div>

          <div className="hidden md:flex items-center gap-10">
            {['Home', 'Tentang Kami', 'Layanan', 'Paket Umroh & Haji','Testimoni', 'Galeri', 'FAQ'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} className="text-sm font-medium text-zinc-400 hover:text-[#C9A04B] transition-colors">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login" className="hidden md:block text-sm font-medium hover:text-lime-400 transition-colors">Log In</Link>
            <Link style={{ backgroundColor: COLORS.accent }} to="/register" className="bg-lime-400 text-black px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-white transition-all transform hover:scale-105 active:scale-95">
              Daftar <ArrowRight size={16} />
            </Link>
            <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden text-left">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1511652019870-fbd8713560bf?q=80&w=1946&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="Mekkah View"
            className="w-full h-full object-cover object-center"
            loading="eager"
          />
          {/* Overlay hitam agar teks terbaca */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-black/20" />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl">
            <h1 className="text-6xl md:text-8xl font-bold leading-tight tracking-tighter mb-6">
              Haji & <span className="italic" style={{ color: COLORS.accent }}>Umrah</span>  Nyaman dan Terpercaya
            </h1>
            <p className="text-xl text-zinc-300 max-w-xl mb-10 leading-relaxed">
              Wujudkan perjalanan ibadah Anda dengan layanan profesional, bimbingan berpengalaman, dan fasilitas terbaik untuk kenyamanan di Tanah Suci.
            </p>

            {/* Search Widget */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-2 md:p-4 rounded-3xl md:rounded-full flex flex-col md:flex-row items-center gap-4 max-w-5xl">
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full px-4">
                <div className="flex flex-col border-r border-white/10">
                  <span className="text-[10px] uppercase font-bold mb-1" style={{ color: COLORS.accent }}>Tanggal Keberangkatan</span>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Calendar size={14} /> Mar 01 - Apr 04
                  </div>
                </div>
                <div className="flex flex-col border-r border-white/10">
                  <span className="text-[10px] uppercase font-bold mb-1" style={{ color: COLORS.accent }}>Durasi Perjalanan</span>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin size={14} /> 1500km - 2000km
                  </div>
                </div>
                <div className="flex flex-col border-r border-white/10">
                  <span className="text-[10px] uppercase font-bold mb-1" style={{ color: COLORS.accent }}>Jenis Paket</span>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Package size={14} /> Economy
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold mb-1" style={{ color: COLORS.accent }}>Harga (Mulai dari...)</span>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    23 Jt - 35 Jt
                  </div>
                </div>
              </div>
              <button className="text-black w-full md:w-auto px-10 py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-white transition-colors shadow-lg" style={{ backgroundColor: COLORS.accent }}>
                Search <Search size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── VALUE PROP SECTION ──────────────────────────────────────── */}
      <section className="py-24 bg-[#0A0A0A] text-left">
        <div className="container mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-8 text-left">
              Perjalanan <span className="text-zinc-500">ibadah Anda,</span> direncanakan dengan baik dan
              <span className="text-zinc-500 text-3xl italic block">dibimbing oleh tim berpengalaman.</span>
            </h2>

            <button className="bg-white text-black px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:opacity-80 transition-all">
              Konsultasi Sekarang <ArrowRight size={18} />
            </button>

            <div className="mt-16 text-black p-6 rounded-3xl inline-block shadow-2xl" style={{ backgroundColor: COLORS.accent }}>
              <div className="text-4xl font-black mb-1">3k+</div>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-zinc-900 bg-zinc-800" style={{ borderColor: COLORS.accent }} />
                  ))}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Jamaah Telah Dilayani</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-[3/5] rounded-[40px] overflow-hidden">
              <img src="https://images.unsplash.com/photo-1607596797957-74f502d89d1c?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Medina" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-zinc-900 border border-white/5 p-8 rounded-[40px] flex-1 flex flex-col justify-center text-center">
                <div className="text-5xl font-bold mb-2" style={{ color: COLORS.accent }}>95%</div>
                <div className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Jamaah Puas</div>
              </div>
              <div className="bg-zinc-900 border border-white/5 p-8 rounded-[40px] flex-1 flex flex-col justify-center text-center">
                <div className="text-5xl font-bold text-white mb-2">20+</div>
                <div className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Tahun Pengalaman</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SERVICES GRID ────────────────────────────────────────────── */}
      <section id="layanan" className="py-24 bg-zinc-950 text-left">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-5xl font-bold mb-6">Layanan Umroh<span style={{ color: COLORS.accent }}> & Haji Terpadu </span></h2>
              <p className="text-zinc-400 text-lg">Kami menyediakan layanan menyeluruh mulai dari pendaftaran, pengurusan dokumen, hingga pendampingan ibadah di Tanah Suci.</p>
            </div>
            <div className="flex gap-2">
              <button className="p-4 rounded-full border border-white/10 hover:border-[#C9A04B] transition-colors"><X className="rotate-45" /></button>
              <button className="p-4 rounded-full text-black hover:bg-white transition-colors" style={{ backgroundColor: COLORS.accent }}><ArrowRight /></button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              {
                icon: Package,
                title: 'Paket Umroh & Haji',
                desc: 'Pilihan paket reguler hingga VIP dengan fasilitas lengkap dan nyaman.'
              },
              {
                icon: Users,
                title: 'Manajemen Jamaah',
                desc: 'Pendataan jamaah dan pengelolaan dokumen secara aman dan terintegrasi.'
              },
              {
                icon: Zap,
                title: 'Pendaftaran Cepat',
                desc: 'Proses booking mudah, cepat, dan transparan secara online.'
              },
              {
                icon: Target,
                title: 'Koordinasi Perjalanan',
                desc: 'Pengaturan jadwal, grup, dan bimbingan selama ibadah.'
              },
              {
                icon: Award,
                title: 'Legalitas Resmi',
                desc: 'Terdaftar dan diawasi oleh Kementerian Agama RI.'
              },
              {
                icon: Headphones,
                title: 'Pendampingan 24/7',
                desc: 'Tim siap membantu Anda di Makkah & Madinah selama perjalanan.'
              }
            ].map((svc, i) => (
              <div key={i} className="group p-10 rounded-[40px] bg-zinc-900/50 border border-white/5 hover:border-[#C9A04B]/50 transition-all duration-500">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-8 transition-colors group-hover:bg-[#C9A04B]">
                  <svc.icon size={28} className="text-[#C9A04B] group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{svc.title}</h3>
                <p className="text-zinc-500 leading-relaxed mb-8">{svc.desc}</p>
                <button className="flex items-center gap-2 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: COLORS.accent }}>
                  Learn More <ChevronRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PAKET UMROH & HAJI SECTION ──────────────────────────────── */}
      <section id="paket-umroh-&-haji" className="py-24 bg-[#0A0A0A] text-left">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-5xl font-bold mb-6">Pilihan <span style={{ color: COLORS.accent }}>Paket Terbaik</span> Kami</h2>
              <p className="text-zinc-400 text-lg">Pilih paket yang sesuai dengan kebutuhan Anda. Semua paket sudah termasuk perlengkapan, asuransi, dan bimbingan ibadah.</p>
            </div>
            <button className="text-sm font-bold border-b-2 border-[#C9A04B] pb-1 hover:text-[#C9A04B] transition-colors">Lihat Semua Paket</button>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Umroh Reguler (12 Hari)',
                price: '28.5',
                img: 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=2070&auto=format&fit=crop',
                tag: 'Best Seller',
                hotel: 'Bintang 4',
                date: 'Keberangkatan: Okt - Des 2025'
              },
              {
                title: 'Umroh Plus Turki',
                price: '38.9',
                img: 'https://images.unsplash.com/photo-1527838832700-5059252407fa?q=80&w=1962&auto=format&fit=crop',
                tag: 'Favorit',
                hotel: 'Bintang 5',
                date: 'Keberangkatan: Nov 2025'
              },
              {
                title: 'Haji Dakhili Premium',
                price: '250',
                img: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=1974&auto=format&fit=crop',
                tag: 'VIP Access',
                hotel: 'Masyair VIP',
                date: 'Keberangkatan: Zulkaidah 1446H'
              }
            ].map((pkg, i) => (
              <div key={i} className="group bg-zinc-900 border border-white/5 rounded-[40px] overflow-hidden hover:border-[#C9A04B]/50 transition-all duration-500">
                <div className="relative h-64 overflow-hidden">
                  <img src={pkg.img} alt={pkg.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute top-6 left-6 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                    {pkg.tag}
                  </div>
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.accent }}>
                    <Calendar size={14} /> {pkg.date}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{pkg.title}</h3>
                  <div className="flex flex-col gap-3 mb-8">
                    <div className="flex items-center gap-3 text-zinc-400 text-sm">
                      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                        <CheckCircle size={12} style={{ color: COLORS.accent }} />
                      </div>
                      Pesawat Direct Jakarta - Jeddah
                    </div>
                    <div className="flex items-center gap-3 text-zinc-400 text-sm">
                      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                        <CheckCircle size={12} style={{ color: COLORS.accent }} />
                      </div>
                      Hotel {pkg.hotel} (Dekat Masjid)
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div>
                      <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Mulai Dari</div>
                      <div className="text-3xl font-black">Rp {pkg.price}jt</div>
                    </div>
                    <button className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-[#C9A04B] group-hover:text-black transition-all">
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ────────────────────────────────────────────── */}
      <section id="testimoni" className="py-24 bg-[#0A0A0A] text-left">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Testimoni</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4">Testimoni <span style={{ color: COLORS.accent }}>Jamaah Kami</span></h2>
          </div>

          <div className="max-w-5xl mx-auto bg-zinc-900 border border-white/5 rounded-[50px] overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-2/5 h-80 md:h-auto">
              <img src="https://plus.unsplash.com/premium_photo-1661964242329-1d711f99a504?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Pilgrim" className="w-full h-full object-cover" />
            </div>
            <div className="md:w-3/5 p-12 md:p-20 flex flex-col justify-center">
              <div className="flex gap-1 mb-8" style={{ color: COLORS.accent }}>
                {[...Array(5)].map((_, i) => <Star key={i} size={20} fill="currentColor" />)}
              </div>
              <p className="text-2xl md:text-3xl font-medium leading-relaxed mb-10 italic">
                "Alhamdulillah, perjalanan umroh saya sangat lancar. Mulai dari pendaftaran,
                keberangkatan, hingga ibadah di Tanah Suci semuanya dibimbing dengan baik dan profesional."
              </p>
              <div>
                <div className="text-xl font-bold text-white">Bapak Ahmad</div>
                <div className="text-zinc-500">Jamaah Umroh 2025</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── GALLERY SECTION ────────────────────────────────────────────── */}
      <section id="galeri" className="py-24 bg-[#0A0A0A] text-left">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-5xl font-bold mb-6">Momen Suci <span style={{ color: COLORS.accent }}>Jamaah Kami</span></h2>
              <p className="text-zinc-400 text-lg">Dokumentasi perjalanan ibadah dan kegiatan para jamaah Nail Al-Khairat selama di Tanah Suci.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <div className="text-sm font-bold text-white">Ikuti Perjalanan Kami</div>
                <div className="text-xs text-zinc-500 text-zinc-400">@nailalkhairat.id</div>
              </div>
              <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-[#C9A04B]">
                <Instagram size={20} />
              </div>
            </div>
          </div>

          {/* Bento Grid Gallery */}
          <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-4 h-[600 md:h-[800px]">
            {/* Main Large Image */}
            <div className="col-span-2 row-span-2 relative group overflow-hidden rounded-[40px]">
              <img
                src="https://images.unsplash.com/photo-1610448721566-47369c768e70?q=80&w=1000&auto=format&fit=crop"
                alt="Jamaah at Kaaba"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                <div>
                  <p className="text-white font-bold text-xl">Thawaf Wadah</p>
                  <p className="text-zinc-300 text-sm">Masjidil Haram, Makkah</p>
                </div>
              </div>
            </div>

            {/* Grid Item 2 */}
            <div className="col-span-2 row-span-1 relative group overflow-hidden rounded-[40px]">
              <img
                src="https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=1000&auto=format&fit=crop"
                alt="Nabawi Mosque"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500" />
            </div>

            {/* Grid Item 3 */}
            <div className="col-span-1 row-span-1 relative group overflow-hidden rounded-[40px]">
              <img
                src="https://images.unsplash.com/photo-1610448721566-47369c768e70?q=80&w=1000&auto=format&fit=crop"
                alt="Pilgrim Praying"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            </div>

            {/* Grid Item 4 (CTA / Info) */}
            <div className="col-span-1 row-span-1 bg-zinc-900 border border-white/5 rounded-[40px] flex flex-col items-center justify-center text-center p-6 hover:border-[#C9A04B]/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#C9A04B]/10 flex items-center justify-center mb-4">
                <Star className="text-[#C9A04B]" size={24} fill="#C9A04B" />
              </div>
              <h4 className="text-white font-bold text-lg mb-1">500+ Momen</h4>
              <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Telah Terabadikan</p>
            </div>
          </div>
        </div>
      </section>
      {/* ─── CTA SECTION ─────────────────────────────────────────────── */}
      <section className="py-24 text-center">
        <div className="container mx-auto px-6">
          <div className="rounded-[60px] p-12 md:p-24 text-black relative overflow-hidden shadow-2xl" style={{ backgroundColor: COLORS.accent }}>
            <div className="relative z-10">
              <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 leading-none uppercase text-zinc-900">
                Siap Berangkat<br />Ke Tanah Suci?
              </h2>
              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <Link to="/register" className="bg-zinc-900 text-white px-12 py-5 rounded-full text-lg font-bold hover:bg-black transition-all transform hover:scale-105">
                  Daftar Sekarang — Gratis
                </Link>
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-full border-2 border-black/20 flex items-center justify-center">
                    <Phone size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase opacity-60">Hubungi Kami</div>
                    <div className="font-bold">+62 21-XXXX-XXXX</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="py-20 bg-black border-t border-white/5 text-left">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" >
                    <img src={logo} alt="" />
                  </div>
                </div>
                <span className="text-2xl font-bold tracking-tight uppercase" style={{ color: COLORS.accent }}>Nail Al-Khairat</span>
              </div>
              <h3 className="text-6xl font-black mb-10 text-white tracking-tighter"> Konsultasi Sekarang</h3>
              <div className="flex gap-4">
                {[Instagram, Twitter, Youtube].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center transition-all hover:text-black group"
                    style={{ '--hover-accent': COLORS.accent } as React.CSSProperties}
                  >
                    <div className="absolute inset-0 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300" style={{ backgroundColor: COLORS.accent }} />
                    <Icon size={20} className="relative z-10" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold uppercase tracking-widest text-xs mb-8" style={{ color: COLORS.accent }}>Quick Links</h4>
              <ul className="space-y-4 text-zinc-500">
                {['Tentang Kami', 'Layanan', 'Paket Umroh', 'Testimoni', 'FAQ'].map(item => (
                  <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold uppercase tracking-widest text-xs mb-8" style={{ color: COLORS.accent }}>Support</h4>
              <ul className="space-y-4 text-zinc-500">
                <li><a href="#" className="hover:text-white transition-colors underline">Kebijakan Privasi</a></li>
                <li><a href="#" className="hover:text-white transition-colors underline">Syarat & Ketentuan</a></li>
                <li><a href="#" className="hover:text-white transition-colors underline">Kebijakan Cookie</a></li>
                <li className="pt-4 flex items-center gap-2 text-white">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Status Sistem: Online
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-10 border-t border-white/5 text-zinc-600 text-xs">
            <p>© {new Date().getFullYear()} Nail Al-Khairat. Built with excellence.</p>
            <p>Licensed Umroh Platform — Insan Cita Integrasi</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;