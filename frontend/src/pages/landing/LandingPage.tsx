import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plane, Hotel, FileCheck, Ticket, Bus, Package,
  Shield, Headphones, Zap, Globe, ChevronRight, ChevronDown,
  Menu, X, ArrowRight, Star, MapPin, Building2, Users,
  CheckCircle, Clock, Award, TrendingUp, MessageCircle,
  Phone, Mail, Instagram, Twitter, Youtube, Sparkles,
  BarChart3, Lock, Layers, Navigation, Search, Calendar,
  UtensilsCrossed, PlaneTakeoff, Eye, Target, HeartHandshake,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { publicApi } from '../../services/api';
import logo from '../../assets/logo.png';

/* ═══════════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════════ */
const T = {
  dark:    '#060b18',
  navy:    '#0a0f1e',
  card:    '#0d1526',
  border:  'rgba(56,189,248,0.1)',
  sky:     '#38bdf8',
  gold:    '#f59e0b',
  purple:  '#8b5cf6',
  muted:   '#475569',
  sub:     '#94a3b8',
  dim:     '#64748b',
};

/* ═══════════════════════════════════════════════════════════════════
   STATIC DATA
═══════════════════════════════════════════════════════════════════ */
const NAV_LINKS = [
  { id: 'layanan', label: 'Layanan' },
  { id: 'paket',   label: 'Paket'  },
  { id: 'proses',  label: 'Proses' },
  { id: 'tentang', label: 'Tentang'},
  { id: 'faq',     label: 'FAQ'    },
  { id: 'kontak',  label: 'Kontak' },
];

const TICKER_ITEMS = [
  '✈ Mekkah',  '🕌 Madinah', '🇹🇷 Istanbul', '🇦🇪 Dubai',
  '🇪🇬 Cairo',  '🇯🇴 Amman', '🇲🇾 Kuala Lumpur', '🇫🇷 Paris',
  '🇬🇧 London', '🇮🇹 Roma', '🇩🇪 Frankfurt', '🇲🇦 Marrakech',
];

const SERVICES = [
  { id: 'hotel',  label: 'Hotel',   desc: 'Ribuan pilihan akomodasi bintang 3–5',      icon: Hotel,     accent: '#f59e0b', glow: 'rgba(245,158,11,0.18)' },
  { id: 'visa',   label: 'Visa',    desc: 'Proses visa cepat & resmi',                  icon: FileCheck, accent: '#10b981', glow: 'rgba(16,185,129,0.18)' },
  { id: 'tiket',  label: 'Tiket',   desc: 'Penerbangan langsung & transit',             icon: Ticket,    accent: '#38bdf8', glow: 'rgba(56,189,248,0.18)' },
  { id: 'bus',    label: 'Bus',     desc: 'Armada AC nyaman untuk jamaah',              icon: Bus,       accent: '#8b5cf6', glow: 'rgba(139,92,246,0.18)' },
  { id: 'paket',  label: 'Paket',   desc: 'All-in-one umrah & wisata halal',            icon: Package,   accent: '#f43f5e', glow: 'rgba(244,63,94,0.18)'  },
  { id: 'report', label: 'Laporan', desc: 'Dashboard real-time & analitik bisnis',      icon: BarChart3, accent: '#06b6d4', glow: 'rgba(6,182,212,0.18)'  },
];

const PACKAGES = [
  {
    badge: '⭐ Terlaris', badgeColor: T.gold,
    title: 'Paket Umrah Reguler', sub: '9 Hari · Makkah & Madinah',
    price: 'Rp 32.500.000', per: '/orang',
    features: ['Hotel Bintang 4 dekat Masjidil Haram', 'Penerbangan PP Garuda Indonesia', 'Visa Umrah & Asuransi', 'Muthawif Berpengalaman', 'City Tour Madinah'],
    gradient: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
    hot: true,
  },
  {
    badge: '🔥 Populer', badgeColor: T.purple,
    title: 'Paket Umrah Plus Turki', sub: '14 Hari · Umrah + Wisata Halal',
    price: 'Rp 28.900.000', per: '/orang',
    features: ['Hotel Bintang 5 Makkah & Istanbul', 'Penerbangan Internasional', 'Visa Schengen & Saudi', 'Tour Istanbul 3 Hari', 'Free City Tour Madinah'],
    gradient: 'linear-gradient(135deg,#6d28d9,#8b5cf6)',
    hot: false,
  },
  {
    badge: '✨ Baru', badgeColor: '#10b981',
    title: 'Wisata Halal Eropa', sub: '12 Hari · 5 Negara',
    price: 'Rp 45.000.000', per: '/orang',
    features: ['Hotel Bintang 4 di 5 Kota', 'Penerbangan Business Class', 'Visa Schengen Multi-Country', 'Muslim-Friendly Guide', 'Halal Food Guaranteed'],
    gradient: 'linear-gradient(135deg,#065f46,#10b981)',
    hot: false,
  },
];

const STEPS = [
  { num: '01', icon: Users,        title: 'Daftar Partner',      desc: 'Buat akun mitra dalam 2 menit. Isi profil bisnis dan dokumen legalitas perusahaan Anda.' },
  { num: '02', icon: CheckCircle,  title: 'Verifikasi Akun',     desc: 'Tim kami memverifikasi dokumen Anda dalam 1×24 jam kerja. Notifikasi via email & WhatsApp.' },
  { num: '03', icon: Layers,       title: 'Akses Dashboard',     desc: 'Dashboard penuh fitur: kelola order, invoice otomatis, manajemen produk & laporan real-time.' },
  { num: '04', icon: TrendingUp,   title: 'Kembangkan Bisnis',   desc: 'Nikmati komisi kompetitif, akses harga khusus mitra, dan support 24/7 dari tim kami.' },
];

const TESTIMONIALS = [
  {
    name: 'H. Ahmad Fauzi', role: 'Owner · PT Cahaya Umrah', city: 'Jakarta',
    rating: 5,
    text: 'Bintang Global mengubah cara saya mengelola bisnis travel. Dashboard-nya intuitif, proses visa 2x lebih cepat, dan tim supportnya luar biasa responsif.',
    avatar: 'AF',
  },
  {
    name: 'Hj. Siti Rahmawati', role: 'Direktur · Madina Tour', city: 'Surabaya',
    rating: 5,
    text: 'Sudah 3 tahun jadi partner dan tidak pernah kecewa. Harga kompetitif, akomodasi selalu sesuai janji. Jamaah kami selalu puas.',
    avatar: 'SR',
  },
  {
    name: 'Bapak Hendra Gunawan', role: 'CEO · Firdaus Travel', city: 'Bandung',
    rating: 5,
    text: 'Fitur laporan otomatis menghemat waktu admin saya 80%. Sekarang saya bisa fokus ke pelayanan jamaah. Platform terbaik yang pernah saya gunakan.',
    avatar: 'HG',
  },
];

const FAQS = [
  { q: 'Bagaimana cara mendaftar sebagai partner?', a: 'Klik tombol "Daftar Partner", isi formulir dengan data perusahaan dan dokumen legalitas (SIUP, NPWP, SK Kemenkumham). Tim kami akan memverifikasi dalam 1×24 jam kerja.' },
  { q: 'Berapa biaya untuk menjadi partner?', a: 'Pendaftaran sepenuhnya GRATIS. Tidak ada biaya bulanan atau tahunan. Anda hanya membayar saat melakukan transaksi dengan harga khusus mitra.' },
  { q: 'Apa saja keuntungan menjadi partner Bintang Global?', a: 'Akses harga grosir untuk semua produk, komisi kompetitif hingga 8%, dashboard manajemen gratis, invoice otomatis, dukungan 24/7, dan materi marketing siap pakai.' },
  { q: 'Berapa lama proses verifikasi akun partner?', a: 'Proses verifikasi berlangsung 1×24 jam di hari kerja. Anda akan mendapat notifikasi via email dan WhatsApp begitu akun diaktifkan.' },
  { q: 'Apakah ada minimum transaksi setiap bulan?', a: 'Tidak ada minimum transaksi. Akun tetap aktif selama tidak ada pelanggaran ketentuan. Partner aktif mendapat keuntungan tambahan berupa bonus komisi kuartalan.' },
  { q: 'Apakah bisa diakses dari perangkat mobile?', a: 'Ya! Dashboard kami fully-responsive dan optimal di semua perangkat. Tersedia juga PWA (Progressive Web App) yang bisa diinstall di smartphone Anda.' },
];

const STATS = [
  { value: 50,   suffix: '+', label: 'Cabang Aktif',       icon: MapPin    },
  { value: 10,   suffix: 'rb+', label: 'Jamaah / Tahun',   icon: Users     },
  { value: 15,   suffix: '+', label: 'Tahun Pengalaman',   icon: Award     },
  { value: 98,   suffix: '%', label: 'Tingkat Kepuasan',   icon: Star      },
  { value: 500,  suffix: '+', label: 'Partner Aktif',      icon: Building2 },
  { value: 24,   suffix: '/7', label: 'Tim Dukungan',      icon: Headphones},
];

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════════════════════════════ */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Manrope:wght@400;500;600;700;800&display=swap');

  :root {
    --sky:#38bdf8; --gold:#f59e0b; --purple:#8b5cf6;
    --dark:#060b18; --navy:#0a0f1e; --card:#0d1526;
  }

  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

  html { scroll-behavior:smooth; }

  body, * {
    -webkit-font-smoothing:antialiased;
    -moz-osx-font-smoothing:grayscale;
    text-rendering:optimizeLegibility;
  }

  /* ─ Animations ─────────────────────────────────── */
  @keyframes blobDrift {
    0%,100% { transform:translate(0,0) scale(1);    opacity:.4; }
    33%      { transform:translate(30px,-20px) scale(1.08); opacity:.55; }
    66%      { transform:translate(-20px,15px) scale(.95); opacity:.35; }
  }
  @keyframes ringPulse {
    0%,100% { transform:translate(-50%,-50%) scale(1);    opacity:.18; }
    50%      { transform:translate(-50%,-50%) scale(1.1);  opacity:.4;  }
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(24px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes fadeIn {
    from { opacity:0; } to { opacity:1; }
  }
  @keyframes floatCard {
    0%,100% { transform:translateY(0)    rotate(0deg); }
    50%      { transform:translateY(-8px) rotate(.8deg); }
  }
  @keyframes ticker {
    from { transform:translateX(0); }
    to   { transform:translateX(-50%); }
  }
  @keyframes countUp {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position:200% center; }
    100% { background-position:-200% center; }
  }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes glowPulse {
    0%,100% { box-shadow:0 0 20px rgba(56,189,248,0.3); }
    50%      { box-shadow:0 0 50px rgba(56,189,248,0.6); }
  }
  @keyframes dotPop {
    0%   { transform:scale(0); opacity:0; }
    60%  { transform:scale(1.3); }
    100% { transform:scale(1); opacity:1; }
  }
  @keyframes navSlide {
    from { opacity:0; transform:translateY(-20px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes gradientShift {
    0%,100% { background-position:0% 50%; }
    50%      { background-position:100% 50%; }
  }

  /* ─ Utility ─────────────────────────────────────── */
  .l-blob   { animation:blobDrift 12s ease-in-out infinite; filter:blur(80px); will-change:transform; }
  .l-blob-2 { animation-duration:15s; animation-delay:3s; }
  .l-blob-3 { animation-duration:10s; animation-delay:6s; }
  .l-blob-4 { animation-duration:18s; animation-delay:1s; }

  .l-ring   { animation:ringPulse 8s ease-in-out infinite; }
  .l-ring-2 { animation-delay:2.5s; }
  .l-ring-3 { animation-delay:5s; }

  .l-fu     { animation:fadeUp .7s cubic-bezier(.22,1,.36,1) both; }
  .l-fu-0   { animation-delay:.05s; }
  .l-fu-1   { animation-delay:.15s; }
  .l-fu-2   { animation-delay:.25s; }
  .l-fu-3   { animation-delay:.35s; }
  .l-fu-4   { animation-delay:.45s; }
  .l-fu-5   { animation-delay:.55s; }

  .l-visible { animation:fadeUp .6s cubic-bezier(.22,1,.36,1) both; }

  .l-float  { animation:floatCard 6s ease-in-out infinite; }
  .l-float-2{ animation-duration:7.5s; animation-delay:1s; }

  /* ─ Grid bg ──────────────────────────────────────── */
  .l-grid {
    background-image:
      linear-gradient(rgba(56,189,248,0.035) 1px, transparent 1px),
      linear-gradient(90deg,rgba(56,189,248,0.035) 1px,transparent 1px);
    background-size:52px 52px;
  }

  /* ─ Ticker ───────────────────────────────────────── */
  .ticker-track { animation:ticker 30s linear infinite; display:flex; gap:0; white-space:nowrap; }
  .ticker-track:hover { animation-play-state:paused; }

  /* ─ Shimmer text ─────────────────────────────────── */
  .l-shimmer {
    background:linear-gradient(90deg,#38bdf8 0%,#60a5fa 25%,#f59e0b 50%,#38bdf8 75%,#60a5fa 100%);
    background-size:200% auto;
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    animation:shimmer 5s linear infinite;
  }

  /* ─ Gradient text ────────────────────────────────── */
  .l-sky-text {
    background:linear-gradient(135deg,#38bdf8,#2563eb);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  }
  .l-gold-text {
    background:linear-gradient(135deg,#f59e0b,#fbbf24);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  }

  /* ─ Buttons ──────────────────────────────────────── */
  .l-btn-p {
    position:relative; overflow:hidden;
    display:inline-flex; align-items:center; gap:8px;
    padding:14px 28px; border-radius:14px; border:none; cursor:pointer;
    background:linear-gradient(135deg,#38bdf8 0%,#2563eb 55%,#4f46e5 100%);
    box-shadow:0 4px 24px rgba(56,189,248,0.38), inset 0 1px 0 rgba(255,255,255,0.15);
    color:white; font-weight:700; font-size:14px; letter-spacing:.02em;
    text-decoration:none; font-family:'Manrope',system-ui,sans-serif;
    transition:transform .15s, box-shadow .2s;
  }
  .l-btn-p:hover { transform:scale(1.025); box-shadow:0 10px 42px rgba(56,189,248,0.55); }
  .l-btn-p:active { transform:scale(.975); }
  .l-btn-p .shine {
    position:absolute; inset:0;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent);
    transform:translateX(-120%); transition:transform .6s ease;
  }
  .l-btn-p:hover .shine { transform:translateX(120%); }

  .l-btn-g {
    display:inline-flex; align-items:center; gap:8px;
    padding:14px 28px; border-radius:14px; text-decoration:none; cursor:pointer;
    font-weight:600; font-size:14px; letter-spacing:.01em; font-family:'Manrope',system-ui,sans-serif;
    color:#38bdf8; background:rgba(56,189,248,0.07);
    border:1.5px solid rgba(56,189,248,0.25);
    transition:all .2s; white-space:nowrap;
  }
  .l-btn-g:hover { background:rgba(56,189,248,0.14); border-color:rgba(56,189,248,0.5); transform:scale(1.015); }

  .l-btn-gold {
    position:relative; overflow:hidden;
    display:inline-flex; align-items:center; gap:8px;
    padding:14px 28px; border-radius:14px; border:none; cursor:pointer;
    background:linear-gradient(135deg,#f59e0b,#d97706);
    box-shadow:0 4px 24px rgba(245,158,11,0.38);
    color:white; font-weight:700; font-size:14px; letter-spacing:.02em;
    text-decoration:none; font-family:'Manrope',system-ui,sans-serif;
    transition:transform .15s, box-shadow .2s;
  }
  .l-btn-gold:hover { transform:scale(1.025); box-shadow:0 10px 40px rgba(245,158,11,0.55); }
  .l-btn-gold .shine { position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent);transform:translateX(-120%);transition:transform .6s; }
  .l-btn-gold:hover .shine { transform:translateX(120%); }

  /* ─ Cards ────────────────────────────────────────── */
  .l-card {
    background:rgba(13,21,38,0.8);
    border:1px solid rgba(56,189,248,0.1);
    border-radius:20px; backdrop-filter:blur(20px);
    transition:border-color .25s, transform .25s, box-shadow .25s;
  }
  .l-card:hover {
    border-color:rgba(56,189,248,0.28);
    transform:translateY(-5px);
    box-shadow:0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.1);
  }

  /* ─ Tag/Badge ────────────────────────────────────── */
  .l-tag {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 14px; border-radius:100px; font-size:10px;
    font-weight:700; letter-spacing:.16em; text-transform:uppercase;
    background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.22);
    color:#38bdf8;
  }

  /* ─ Divider ──────────────────────────────────────── */
  .l-hr { height:1px; background:linear-gradient(90deg,transparent,rgba(56,189,248,0.15),transparent); }

  /* ─ Nav ──────────────────────────────────────────── */
  .l-nav { animation:navSlide .5s cubic-bezier(.22,1,.36,1) both; }
  .l-nav-link {
    font-size:14px; font-weight:600; color:#94a3b8; text-decoration:none;
    background:none; border:none; cursor:pointer; font-family:'Manrope',system-ui,sans-serif;
    transition:color .2s; padding:4px 0;
    position:relative; letter-spacing:.01em;
  }
  .l-nav-link::after {
    content:''; position:absolute; bottom:-2px; left:0; width:0; height:1.5px;
    background:#38bdf8; transition:width .25s ease;
  }
  .l-nav-link:hover { color:#38bdf8; }
  .l-nav-link:hover::after { width:100%; }

  /* ─ FAQ ──────────────────────────────────────────── */
  .l-faq-item { border-bottom:1px solid rgba(56,189,248,0.08); }
  .l-faq-q {
    display:flex; align-items:center; justify-content:space-between;
    padding:20px 0; cursor:pointer;
    font-size:15px; font-weight:600; color:white; gap:16px;
    background:none; border:none; width:100%; text-align:left;
    font-family:'Manrope',system-ui,sans-serif;
    transition:color .2s; line-height:1.5;
  }
  .l-faq-q:hover { color:#38bdf8; }
  .l-faq-a {
    overflow:hidden; transition:max-height .35s ease, opacity .3s;
    font-size:14px; color:#64748b; line-height:1.75;
  }

  /* ─ Testimonial ──────────────────────────────────── */
  .l-testi-track { display:flex; gap:20px; transition:transform .5s cubic-bezier(.22,1,.36,1); }

  /* ─ Step connector ───────────────────────────────── */
  .l-step-line {
    position:absolute; top:36px; left:calc(50% + 36px);
    width:calc(100% - 72px); height:1px;
    background:linear-gradient(90deg,rgba(56,189,248,0.4),rgba(56,189,248,0.1));
  }

  /* ─ Gradient animated bg (CTA) ───────────────────── */
  .l-cta-bg {
    background:linear-gradient(135deg,#0a2540,#0f172a,#1a0a2e,#071a2e);
    background-size:300% 300%;
    animation:gradientShift 10s ease infinite;
  }

  /* ─ Scrollbar ────────────────────────────────────── */
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:#060b18; }
  ::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.3); border-radius:2px; }

  /* ─ WhatsApp FAB ─────────────────────────────────── */
  .l-fab {
    position:fixed; bottom:28px; right:28px; z-index:999;
    width:56px; height:56px; border-radius:50%; border:none; cursor:pointer;
    background:linear-gradient(135deg,#25d366,#128c7e);
    box-shadow:0 4px 24px rgba(37,211,102,0.45);
    display:flex; align-items:center; justify-content:center;
    animation:glowPulse 3s ease-in-out infinite;
    transition:transform .2s;
  }
  .l-fab:hover { transform:scale(1.1); }

  /* ─ Package highlight ────────────────────────────── */
  .l-pkg-hot {
    border-color:rgba(245,158,11,0.4) !important;
    box-shadow:0 0 40px rgba(245,158,11,0.12), inset 0 0 40px rgba(245,158,11,0.03);
  }
  .l-pkg-hot:hover {
    border-color:rgba(245,158,11,0.65) !important;
    box-shadow:0 24px 60px rgba(245,158,11,0.2) !important;
  }

  /* ─ Avatar ───────────────────────────────────────── */
  .l-avatar {
    width:44px; height:44px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:14px; font-weight:800; letter-spacing:.02em;
    background:linear-gradient(135deg,#38bdf8,#2563eb);
    color:white;
  }

  /* ─ Dot indicator ────────────────────────────────── */
  .l-dot {
    width:8px; height:8px; border-radius:50%; cursor:pointer; border:none;
    transition:all .2s;
  }

  /* Form grid: stack on mobile */
  .l-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:520px) {
    .l-form-grid { grid-template-columns:1fr; }
  }

  /* ─ Search widget (landing header) ────────────────── */
  @keyframes l-search-float {
    0%, 100% { transform:translateY(0); }
    50% { transform:translateY(-10px); }
  }
  .l-search-box-wrap {
    animation:l-search-float 4s ease-in-out infinite;
    transition:transform .3s ease-out;
  }
  .l-search-box-wrap.paused {
    animation-play-state:paused;
  }
  .l-search-box {
    background:linear-gradient(180deg,rgba(13,21,38,0.98),rgba(10,15,28,0.97));
    border:1px solid rgba(56,189,248,0.18);
    border-radius:20px;
    overflow:hidden;
    box-shadow:0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03);
    backdrop-filter:blur(24px);
  }
  .l-search-tabs {
    display:flex; gap:4px; padding:16px 20px 0; flex-wrap:wrap;
  }
  .l-search-tab {
    display:flex; align-items:center; gap:8px;
    padding:10px 18px; border-radius:12px; border:none; cursor:pointer;
    font-size:13px; font-weight:600; font-family:'Manrope',system-ui,sans-serif;
    background:rgba(255,255,255,0.04); color:#94a3b8;
    transition:background .2s, color .2s, transform .15s;
  }
  .l-search-tab:hover { background:rgba(56,189,248,0.1); color:#e2e8f0; }
  .l-search-tab.active { background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.35); }
  .l-search-form { padding:24px 24px 28px; }
  .l-search-row {
    display:grid; gap:16px; align-items:end;
    grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));
  }
  .l-search-row.span-all { grid-column:1 / -1; }
  .l-search-field { display:flex; flex-direction:column; gap:6px; }
  .l-search-label {
    font-size:11px; font-weight:600; letter-spacing:.04em; text-transform:uppercase;
    color:#64748b;
  }
  .l-search-input {
    width:100%; height:44px; padding:0 14px 0 40px; border-radius:12px;
    border:1px solid rgba(56,189,248,0.2); background:rgba(255,255,255,0.05);
    color:#fff; font-size:14px; outline:none; transition:border-color .2s, box-shadow .2s;
  }
  .l-search-input::placeholder { color:#64748b; }
  .l-search-input:focus { border-color:rgba(56,189,248,0.5); box-shadow:0 0 0 3px rgba(56,189,248,0.15); }
  .l-search-input.with-icon { padding-left:40px; }
  .l-search-input.no-icon { padding-left:14px; }
  select.l-search-input { cursor:pointer; appearance:auto; }
  .l-search-field-wrap { position:relative; }
  .l-search-field-wrap .l-search-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#64748b; pointer-events:none; }
  .l-search-chips { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .l-search-chip {
    display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px;
    font-size:12px; font-weight:500; cursor:pointer; border:1px solid transparent;
    background:rgba(255,255,255,0.06); color:#94a3b8;
    transition:background .2s, border-color .2s, color .2s;
  }
  .l-search-chip:hover { background:rgba(56,189,248,0.1); color:#e2e8f0; }
  .l-search-chip.active { background:rgba(56,189,248,0.15); border-color:rgba(56,189,248,0.3); color:#38bdf8; }
  .l-search-submit {
    margin-top:20px; display:flex; justify-content:stretch;
  }
  .l-search-submit .l-btn-p { width:100%; min-width:0; padding:14px 32px; font-size:15px; justify-content:center; }
  @media (max-width:768px) {
    .l-search-tabs { padding:12px 16px 0; }
    .l-search-tab { padding:8px 14px; font-size:12px; }
    .l-search-form { padding:20px 16px 24px; }
    .l-search-row { grid-template-columns:1fr; }
  }

  /* Mobile responsive */
  @media (max-width:768px) {
    .l-hide-mob { display:none !important; }
    .l-show-mob { display:flex !important; }
    .l-col-mob  { flex-direction:column !important; }
    .l-center-mob { text-align:center !important; align-items:center !important; }
    .l-step-line { display:none; }
  }
  @media (min-width:769px) {
    .l-show-mob { display:none !important; }
  }

  /* ─ Responsive: hero, sections, footer ─────────────── */
  .l-hero-grid {
    display:grid; grid-template-columns:1fr 1.15fr; gap:36px; align-items:center;
  }
  .l-section { padding:100px 24px; }
  .l-section-sm { padding:80px 24px; }
  .l-tentang-grid { display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; }
  .l-footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:40px; }
  .l-packages-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:22px; }
  .l-stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:16px; }
  .l-services-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:18px; }

  @media (max-width:992px) {
    .l-hero-grid { grid-template-columns:1fr; gap:28px; }
    .l-hero-left { align-items:center; text-align:center; }
    .l-tentang-grid { grid-template-columns:1fr; gap:40px; }
  }
  @media (max-width:768px) {
    .l-section { padding:60px 16px; }
    section.l-section { padding-top:80px; padding-bottom:48px; }
    .l-section-sm { padding:48px 16px; }
    .l-footer-grid { grid-template-columns:1fr; gap:28px; }
    .l-packages-grid { grid-template-columns:1fr; gap:18px; }
    .l-stats-grid { grid-template-columns:repeat(2, 1fr); gap:12px; }
    .l-services-grid { grid-template-columns:1fr; }
  }
  @media (max-width:480px) {
    .l-section { padding:48px 12px; }
    .l-section-sm { padding:40px 12px; }
    .l-stats-grid { grid-template-columns:1fr; }
  }

  /* Container: responsive horizontal padding */
  .l-container { padding-left:16px; padding-right:16px; }
  @media (max-width:480px) {
    .l-container { padding-left:12px; padding-right:12px; }
  }

  /* CTA & footer inner responsive */
  .l-cta-inner { padding:72px 48px; }
  @media (max-width:768px) { .l-cta-inner { padding:48px 24px; } }
  @media (max-width:480px) { .l-cta-inner { padding:40px 16px; } }

  .l-footer { padding:30px 24px 32px; }
  @media (max-width:768px) { .l-footer { padding:24px 16px 28px; } }
  @media (max-width:480px) { .l-footer { padding:20px 12px 24px; } }
`;

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════════ */

// Animated counter
const Counter: React.FC<{ value: number; suffix: string; duration?: number }> = ({ value, suffix, duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const step = value / (duration / 16);
        let cur = 0;
        const timer = setInterval(() => {
          cur = Math.min(cur + step, value);
          setCount(Math.floor(cur));
          if (cur >= value) clearInterval(timer);
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
};

// FAQ Item
const FaqItem: React.FC<{ q: string; a: string; defaultOpen?: boolean }> = ({ q, a, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="l-faq-item">
      <button className="l-faq-q" onClick={() => setOpen(v => !v)}>
        <span>{q}</span>
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: open ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .25s', transform: open ? 'rotate(180deg)' : 'none',
        }}>
          <ChevronDown size={14} color={open ? T.sky : T.dim} />
        </span>
      </button>
      <div className="l-faq-a" style={{ maxHeight: open ? 200 : 0, opacity: open ? 1 : 0, paddingBottom: open ? 20 : 0 }}>
        {a}
      </div>
    </div>
  );
};

// Section header
const SectionHeader: React.FC<{ tag: string; tagIcon?: React.ReactNode; title: React.ReactNode; sub?: string; center?: boolean }> = ({ tag, tagIcon, title, sub, center = true }) => (
  <div style={{ textAlign: center ? 'center' : 'left', marginBottom: 52 }}>
    <div className="l-tag" style={{ marginBottom: 16, display: 'inline-flex' }}>
      {tagIcon}{tag}
    </div>
    <h2 style={{
      fontFamily: "'Urbanist',sans-serif",
      fontSize: 'clamp(30px,4vw,48px)', fontWeight: 800,
      letterSpacing: '-0.02em', lineHeight: 1.1,
      margin: '0 0 16px', color: 'white',
    }}>
      {title}
    </h2>
    {sub && <p style={{ fontFamily:"'Manrope',sans-serif", color: T.sub, fontSize: 16, margin: '0 auto', maxWidth: 520, lineHeight: 1.8, fontWeight:400 }}>{sub}</p>}
  </div>
);

/* ─── Landing search widget (Agoda-style) ───────────────────────── */
const PRODUCT_TABS = [
  { id: 'hotel', label: 'Hotel', icon: Hotel },
  { id: 'ticket', label: 'Tiket', icon: PlaneTakeoff },
  { id: 'visa', label: 'Visa', icon: FileCheck },
  { id: 'bus', label: 'Bus', icon: Bus },
  { id: 'package', label: 'Paket', icon: Package },
] as const;

type ProductTabId = typeof PRODUCT_TABS[number]['id'];

const BANDARA_FALLBACK = [
  { code: 'CGK', name: 'Jakarta' },
  { code: 'SBY', name: 'Surabaya' },
  { code: 'BTH', name: 'Batam' },
  { code: 'UPG', name: 'Makassar' },
];

interface SearchWidgetProps {
  searchData: {
    products: { id: string; name: string; type: string; meta?: Record<string, unknown> }[];
    byType: Record<string, { id: string; name: string; type: string }[]>;
    bandara: { code: string; name: string }[];
  } | null;
  onSearch: (params: Record<string, string>) => void;
}

const LandingSearchWidget: React.FC<SearchWidgetProps> = ({ searchData, onSearch }) => {
  const [activeTab, setActiveTab] = useState<ProductTabId>('hotel');
  const [floatPaused, setFloatPaused] = useState(false);
  const [hotel, setHotel] = useState({ destination: '', checkIn: '', checkOut: '', guests: '2', rooms: '1', freeBreakfast: false, freeCancel: false, star4: false, score8: false });
  const [ticket, setTicket] = useState({ from: '', to: '', date: '' });
  const [visa, setVisa] = useState({ destination: 'Visa Saudi', date: '' });
  const [bus, setBus] = useState({ route: '', date: '' });
  const [pkg, setPkg] = useState({ destination: '', date: '' });

  const bandara = searchData?.bandara?.length ? searchData.bandara : BANDARA_FALLBACK;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = { product: activeTab };
    if (activeTab === 'hotel') {
      if (hotel.destination) params.destination = hotel.destination;
      if (hotel.checkIn) params.checkin = hotel.checkIn;
      if (hotel.checkOut) params.checkout = hotel.checkOut;
      if (hotel.guests) params.guests = hotel.guests;
      if (hotel.rooms) params.rooms = hotel.rooms;
    } else if (activeTab === 'ticket') {
      if (ticket.from) params.from = ticket.from;
      if (ticket.to) params.to = ticket.to;
      if (ticket.date) params.date = ticket.date;
    } else if (activeTab === 'visa') {
      if (visa.destination) params.destination = visa.destination;
      if (visa.date) params.date = visa.date;
    } else if (activeTab === 'bus') {
      if (bus.route) params.route = bus.route;
      if (bus.date) params.date = bus.date;
    } else if (activeTab === 'package') {
      if (pkg.destination) params.destination = pkg.destination;
      if (pkg.date) params.date = pkg.date;
    }
    onSearch(params);
  };

  const Field = ({ label, children, fullWidth }: { label: string; children: React.ReactNode; fullWidth?: boolean }) => (
    <div className="l-search-field" style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <span className="l-search-label">{label}</span>
      {children}
    </div>
  );

  const InputWithIcon = ({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ComponentType<Record<string, unknown>> }) => (
    <div className="l-search-field-wrap">
      {Icon && <Icon size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.dim, pointerEvents: 'none' }} />}
      <input className={`l-search-input ${Icon ? 'with-icon' : 'no-icon'}`} style={{ height: 44 }} {...props} />
    </div>
  );

  return (
    <div
      className={`l-search-box-wrap ${floatPaused ? 'paused' : ''}`}
      onTouchStart={() => setFloatPaused(true)}
      onMouseEnter={() => setFloatPaused(true)}
    >
      <div className="l-search-box">
      <div className="l-search-tabs">
        {PRODUCT_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`l-search-tab ${activeTab === id ? 'active' : ''}`}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="l-search-form">
        {activeTab === 'hotel' && (
          <>
            <div className="l-search-row" style={{ marginBottom: 16 }}>
              <Field label="Destinasi" fullWidth>
                <InputWithIcon
                  icon={Search}
                  type="text"
                  placeholder="Kota, landmark, atau nama properti — Mekkah, Madinah..."
                  value={hotel.destination}
                  onChange={(e) => setHotel((h) => ({ ...h, destination: e.target.value }))}
                />
              </Field>
            </div>
            <div className="l-search-row" style={{ marginBottom: 16 }}>
              <Field label="Check-in">
                <InputWithIcon icon={Calendar} type="date" value={hotel.checkIn} onChange={(e) => setHotel((h) => ({ ...h, checkIn: e.target.value }))} />
              </Field>
              <Field label="Check-out">
                <input className="l-search-input no-icon" type="date" value={hotel.checkOut} onChange={(e) => setHotel((h) => ({ ...h, checkOut: e.target.value }))} style={{ height: 44 }} />
              </Field>
              <Field label="Tamu & kamar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <input className="l-search-input no-icon" type="number" min={1} max={20} value={hotel.guests} onChange={(e) => setHotel((h) => ({ ...h, guests: e.target.value }))} style={{ height: 44, flex: 1, minWidth: 0 }} />
                    <span style={{ fontSize: 13, color: T.dim, flexShrink: 0 }}>dewasa</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <input className="l-search-input no-icon" type="number" min={1} max={10} value={hotel.rooms} onChange={(e) => setHotel((h) => ({ ...h, rooms: e.target.value }))} style={{ height: 44, flex: 1, minWidth: 0 }} />
                    <span style={{ fontSize: 13, color: T.dim, flexShrink: 0 }}>kamar</span>
                  </div>
                </div>
              </Field>
            </div>
            <div className="l-search-chips" style={{ marginBottom: 4 }}>
              {[
                { key: 'freeBreakfast', label: 'Sarapan gratis', icon: UtensilsCrossed },
                { key: 'freeCancel', label: 'Bebas pembatalan' },
                { key: 'star4', label: 'Bintang 4+', icon: Star },
                { key: 'score8', label: 'Skor 8+' },
              ].map(({ key, label, icon: ChipIcon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHotel((h) => ({ ...h, [key]: !(h as Record<string, unknown>)[key] }))}
                  className={`l-search-chip ${(hotel as Record<string, unknown>)[key] ? 'active' : ''}`}
                >
                  {ChipIcon && <ChipIcon size={14} />}
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {activeTab === 'ticket' && (
          <div className="l-search-row">
            <Field label="Bandara asal">
              <select className="l-search-input no-icon" value={ticket.from} onChange={(e) => setTicket((t) => ({ ...t, from: e.target.value }))} style={{ height: 44, paddingLeft: 14 }}>
                <option value="">Pilih bandara</option>
                {bandara.map((b) => (
                  <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                ))}
              </select>
            </Field>
            <Field label="Bandara tujuan">
              <select className="l-search-input no-icon" value={ticket.to} onChange={(e) => setTicket((t) => ({ ...t, to: e.target.value }))} style={{ height: 44, paddingLeft: 14 }}>
                <option value="">Pilih bandara</option>
                {bandara.map((b) => (
                  <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal">
              <input className="l-search-input no-icon" type="date" value={ticket.date} onChange={(e) => setTicket((t) => ({ ...t, date: e.target.value }))} style={{ height: 44 }} />
            </Field>
          </div>
        )}

        {activeTab === 'visa' && (
          <div className="l-search-row">
            <Field label="Tujuan / jenis visa">
              <input className="l-search-input no-icon" type="text" placeholder="Visa Saudi, Visa Schengen..." value={visa.destination} onChange={(e) => setVisa((v) => ({ ...v, destination: e.target.value }))} style={{ height: 44 }} />
            </Field>
            <Field label="Tanggal perjalanan">
              <input className="l-search-input no-icon" type="date" value={visa.date} onChange={(e) => setVisa((v) => ({ ...v, date: e.target.value }))} style={{ height: 44 }} />
            </Field>
          </div>
        )}

        {activeTab === 'bus' && (
          <div className="l-search-row">
            <Field label="Rute" fullWidth>
              <input className="l-search-input no-icon" type="text" placeholder="Contoh: Jeddah – Mekkah, Bandara – Hotel..." value={bus.route} onChange={(e) => setBus((b) => ({ ...b, route: e.target.value }))} style={{ height: 44 }} />
            </Field>
            <Field label="Tanggal">
              <input className="l-search-input no-icon" type="date" value={bus.date} onChange={(e) => setBus((b) => ({ ...b, date: e.target.value }))} style={{ height: 44 }} />
            </Field>
          </div>
        )}

        {activeTab === 'package' && (
          <div className="l-search-row">
            <Field label="Paket / destinasi">
              <input className="l-search-input no-icon" type="text" placeholder="Paket Umrah, Wisata Halal..." value={pkg.destination} onChange={(e) => setPkg((p) => ({ ...p, destination: e.target.value }))} style={{ height: 44 }} />
            </Field>
            <Field label="Tanggal">
              <input className="l-search-input no-icon" type="date" value={pkg.date} onChange={(e) => setPkg((p) => ({ ...p, date: e.target.value }))} style={{ height: 44 }} />
            </Field>
          </div>
        )}

        <div className="l-search-submit">
          <button type="submit" className="l-btn-p">
            <span className="shine" />
            <Search size={18} style={{ marginRight: 8 }} /> Cari
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [scrolled, setScrolled]       = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [testiIdx, setTestiIdx]       = useState(0);
  const [contactForm, setContactForm] = useState({ nama: '', email: '', telepon: '', pesan: '' });
  const [contactSent, setContactSent]  = useState(false);
  const [searchData, setSearchData]   = useState<SearchWidgetProps['searchData']>(null);
  const injected = useRef(false);

  // Fetch products/bandara for landing search widget (public API)
  useEffect(() => {
    publicApi.getProductsForSearch()
      .then((res) => res.data?.data && setSearchData({
        products: res.data.data.products,
        byType: res.data.data.byType || {},
        bandara: res.data.data.bandara || [],
      }))
      .catch(() => setSearchData({ products: [], byType: {}, bandara: BANDARA_FALLBACK }));
  }, []);

  // Inject styles once
  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const s = document.createElement('style');
    s.innerHTML = STYLES;
    document.head.appendChild(s);
  }, []);

  // Auth redirect
  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isLoading, isAuthenticated, navigate]);

  // Scroll
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  // Intersection observer for scroll reveals
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('l-visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.15 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Auto-advance testimonials
  useEffect(() => {
    const t = setInterval(() => setTestiIdx(i => (i + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileOpen(false);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.nama.trim() || !contactForm.email.trim() || !contactForm.pesan.trim()) return;
    setContactSent(true);
    setContactForm({ nama: '', email: '', telepon: '', pesan: '' });
  };

  const handleSearchSubmit = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    navigate(`/register?${qs}`);
  };

  if (!isLoading && isAuthenticated) return null;

  const S = { maxWidth: 1280, margin: '0 auto' };

  return (
    <div className="sidebar-login-bg" style={{
      minHeight: '100vh', color: 'white', overflowX: 'hidden',
      fontFamily: "'Manrope',system-ui,sans-serif",
    }}>

      {/* ── Background orbs (fixed) ── */}
      {[
        { cls:'l-blob',   w:700, h:700, l:'-12%', t:'-10%', c:'rgba(37,99,235,0.18)' },
        { cls:'l-blob l-blob-2', w:500, h:500, r:'-8%', t:'20%', c:'rgba(56,189,248,0.14)' },
        { cls:'l-blob l-blob-3', w:350, h:350, l:'38%', t:'55%', c:'rgba(79,70,229,0.12)' },
        { cls:'l-blob l-blob-4', w:400, h:400, l:'10%', b:'-8%', c:'rgba(245,158,11,0.07)' },
      ].map((b,i) => (
        <div key={i} className={b.cls} style={{
          position:'fixed', width:b.w, height:b.h, borderRadius:'50%', background:b.c,
          zIndex:0, pointerEvents:'none',
          ...(b.l?{left:b.l}:{}), ...(b.r?{right:b.r}:{}),
          ...(b.t?{top:b.t}:{}),  ...(b.b?{bottom:b.b}:{}),
        }} />
      ))}
      {[
        { cls:'l-ring',   s:700, x:'82%', y:'12%' },
        { cls:'l-ring l-ring-2', s:480, x:'-3%',y:'60%' },
        { cls:'l-ring l-ring-3', s:250, x:'95%', y:'82%' },
      ].map((r,i) => (
        <div key={i} className={r.cls} style={{
          position:'fixed', width:r.s, height:r.s, left:r.x, top:r.y,
          borderRadius:'50%', border:'1px solid rgba(56,189,248,0.08)',
          transform:'translate(-50%,-50%)', zIndex:0, pointerEvents:'none',
        }} />
      ))}

      {/* ══════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════ */}
      <nav className="l-nav" style={{
        position:'fixed', top:0, left:0, right:0, zIndex:200,
        borderBottom: scrolled ? '1px solid rgba(56,189,248,0.09)' : '1px solid transparent',
        background: scrolled ? 'rgba(6,11,24,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(28px)' : 'none',
        transition:'all .3s ease',
      }}>
        <div className="l-container" style={{ ...S, display:'flex', alignItems:'center', justifyContent:'space-between', height:68 }}>

          {/* Brand */}
          <div style={{ display:'flex', alignItems:'center', gap:11, flexShrink:0 }}>
            <img src={logo} alt="Bintang Global" style={{ width:40, height:40, borderRadius:12, objectFit:'contain', display:'block', flexShrink:0 }} />
            <div>
              <div style={{ fontSize:14, fontWeight:900, letterSpacing:'0.06em', textTransform:'uppercase', lineHeight:1.1, fontFamily:"'Urbanist',sans-serif" }}>Bintang Global</div>
              <div style={{ fontSize:9, fontWeight:600, letterSpacing:'0.28em', color:T.sky, textTransform:'uppercase', lineHeight:1.5 }}>Umroh & Travel</div>
            </div>
          </div>

          {/* Desktop links */}
          <div className="l-hide-mob" style={{ display:'flex', alignItems:'center', gap:30 }}>
            {NAV_LINKS.map(l => (
              <button key={l.id} className="l-nav-link" onClick={() => scrollTo(l.id)}>{l.label}</button>
            ))}
          </div>

          {/* Auth */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Link to="/login" className="l-btn-g l-hide-mob" style={{ padding:'9px 20px', fontSize:13 }}>Masuk</Link>
            <Link to="/register" className="l-btn-p" style={{ padding:'9px 20px', fontSize:13 }}>
              <span className="shine"/>
              <span className="l-hide-mob">Daftar Partner</span>
              <span className="l-show-mob">Daftar</span>
              <ArrowRight size={13}/>
            </Link>
            <button type="button" onClick={() => setMobileOpen(v=>!v)} className="l-show-mob" style={{ background:'none', border:'none', cursor:'pointer', color:'white', padding:4, alignItems:'center', justifyContent:'center' }} aria-label="Menu">
              {mobileOpen ? <X size={22}/> : <Menu size={22}/>}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ background:'rgba(6,11,24,0.98)', backdropFilter:'blur(28px)', borderTop:'1px solid rgba(56,189,248,0.09)', padding:'16px 24px 24px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {NAV_LINKS.map(l => (
                <button key={l.id} className="l-nav-link" onClick={() => scrollTo(l.id)} style={{ padding:'12px 0', textAlign:'left', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{l.label}</button>
              ))}
              <div style={{ display:'flex', gap:10, marginTop:12 }}>
                <Link to="/login" className="l-btn-g" style={{ flex:1, justifyContent:'center', padding:'11px' }} onClick={() => setMobileOpen(false)}>Masuk</Link>
                <Link to="/register" className="l-btn-p" style={{ flex:1, justifyContent:'center', padding:'11px' }} onClick={() => setMobileOpen(false)}>
                  <span className="shine"/>Daftar Partner
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════
          HERO  —  Split Layout (Left text + search | Right dashboard)
      ══════════════════════════════════════ */}
      <section className="l-section" style={{ position:'relative', zIndex:1, paddingTop:100, paddingBottom:60, minHeight:0 }}>
        <div className="l-container l-hero-grid" style={{ ...S, minHeight:'calc(100vh - 100px)' }}>

          {/* ─── LEFT: Text ─────────────────────────── */}
          <div className="l-hero-left" style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>

            {/* Announcement pill */}
            <div className="l-fu l-fu-0" style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'6px 14px 6px 7px', borderRadius:100, marginBottom:26,
              background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.28)',
              cursor:'default',
            }}>
              <span style={{
                background:'linear-gradient(135deg,#f59e0b,#d97706)',
                borderRadius:100, padding:'2px 9px', fontSize:9,
                fontWeight:700, letterSpacing:'.1em', color:'white', flexShrink:0,
              }}>BARU</span>
              <span style={{ fontSize:11, color:'#fcd34d', fontWeight:500, lineHeight:1.4 }}>
                Dashboard v3.0 — Analitik Real-time &amp; Invoice Otomatis
              </span>
              <ArrowRight size={11} color="#fcd34d" style={{ flexShrink:0 }}/>
            </div>

            {/* Headline */}
            <h1 className="l-fu l-fu-1" style={{
              fontFamily:"'Urbanist',sans-serif",
              fontSize:'clamp(34px,4.2vw,64px)', fontWeight:900,
              lineHeight:1.05, letterSpacing:'-0.025em',
              margin:'0 0 20px',
            }}>
              Satu Platform untuk{' '}
              <span className="l-shimmer">Semua Perjalanan</span>
            </h1>

            {/* Sub */}
            <p className="l-fu l-fu-2" style={{
              fontSize:'clamp(14px,1.2vw,16px)', color:T.sub,
              lineHeight:1.8, margin:'0 0 16px',
            }}>
              Hotel · Visa · Tiket · Bus · Paket Umrah dan Haji. Satu ekosistem terintegrasi
              untuk partner travel dan agen umrah terpercaya di seluruh Indonesia.
            </p>

            {/* Feature pills */}
            <div className="l-fu l-fu-2" style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:24 }}>
              {[
                { icon:Hotel,     label:'Hotel',  color:'#f59e0b' },
                { icon:FileCheck, label:'Visa',   color:'#10b981' },
                { icon:Ticket,    label:'Tiket',  color:T.sky     },
                { icon:Bus,       label:'Bus',    color:T.purple  },
                { icon:Package,   label:'Paket',  color:'#f43f5e' },
              ].map(({ icon:Icon, label, color }) => (
                <span key={label} style={{
                  display:'inline-flex', alignItems:'center', gap:5,
                  padding:'5px 12px', borderRadius:100, fontSize:11, fontWeight:600,
                  background:`${color}12`, border:`1px solid ${color}28`, color,
                }}>
                  <Icon size={11}/> {label}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="l-fu l-fu-3" style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:38 }}>
              <Link to="/register" className="l-btn-p" style={{ fontSize:14, padding:'14px 28px' }}>
                <span className="shine"/>
                <Sparkles size={15}/> Daftar Gratis Sekarang
              </Link>
              <Link to="/login" className="l-btn-g" style={{ fontSize:14, padding:'14px 24px' }}>
                Masuk ke Dashboard
              </Link>
            </div>

            {/* Social proof */}
            <div className="l-fu l-fu-4" style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <div style={{ display:'flex' }}>
                  {['AF','SR','HG','MR','DK'].map((a,i) => (
                    <div key={a} style={{
                      width:28, height:28, borderRadius:'50%',
                      background:`hsl(${210+i*30},70%,45%)`,
                      border:'2px solid #060b18', marginLeft:i?-7:0,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:8, fontWeight:700, color:'white', flexShrink:0,
                    }}>{a}</div>
                  ))}
                </div>
                <div>
                  <div style={{ display:'flex', gap:1 }}>
                    {[...Array(5)].map((_,i) => <Star key={i} size={10} fill={T.gold} color={T.gold}/>)}
                  </div>
                  <div style={{ fontSize:10, color:T.dim, marginTop:1 }}>500+ partner aktif</div>
                </div>
              </div>
              <div style={{ width:1, height:28, background:'rgba(255,255,255,0.07)' }}/>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {['🔒 SSL','✓ POJK','⚡ ISO 27001'].map(b => (
                  <span key={b} style={{ fontSize:10, color:'#334155', fontWeight:600 }}>{b}</span>
                ))}
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Filter form ─────────────────── */}
          <div className="l-fu l-fu-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
            <div style={{ width: '100%', maxWidth: 520 }}>
              <LandingSearchWidget searchData={searchData} onSearch={handleSearchSubmit} />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TICKER
      ══════════════════════════════════════ */}
      <div style={{
        position:'relative', zIndex:1, borderTop:'1px solid rgba(56,189,248,0.08)',
        borderBottom:'1px solid rgba(56,189,248,0.08)',
        background:'rgba(6,11,24,0.6)', backdropFilter:'blur(10px)',
        padding:'14px 0', overflow:'hidden',
      }}>
        <div style={{ overflow:'hidden', whiteSpace:'nowrap' }}>
          <div className="ticker-track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} style={{
                padding:'0 28px', fontSize:13, fontWeight:600, color:T.sub,
                borderRight:'1px solid rgba(56,189,248,0.1)',
                display:'inline-flex', alignItems:'center', gap:0,
              }}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          SERVICES
      ══════════════════════════════════════ */}
      <section id="layanan" className="l-section" style={{ position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div data-reveal style={{ opacity:0 }}>
            <SectionHeader
              tag="Layanan Lengkap" tagIcon={<Layers size={11}/>}
              title={<>Semua yang Anda Butuhkan,<br/><span className="l-sky-text">Dalam Satu Tempat</span></>}
              sub="Ekosistem travel terintegrasi untuk memenuhi seluruh kebutuhan perjalanan umrah dan wisata halal."
            />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:18 }}>
            {SERVICES.map((svc,i) => {
              const Icon = svc.icon;
              return (
                <div key={svc.id} data-reveal className="l-card" style={{ padding:'28px', opacity:0, animationDelay:`${i*0.08}s`, cursor:'pointer' }}
                  onClick={() => navigate('/register')}>
                  <div style={{
                    width:52, height:52, borderRadius:16, marginBottom:20,
                    background:svc.glow, border:`1px solid ${svc.accent}30`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'transform .2s',
                  }}>
                    <Icon size={24} color={svc.accent}/>
                  </div>
                  <h3 style={{ fontSize:17, fontWeight:700, margin:'0 0 8px' }}>{svc.label}</h3>
                  <p style={{ fontSize:13, color:T.dim, margin:'0 0 18px', lineHeight:1.65 }}>{svc.desc}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:svc.accent, fontWeight:600 }}>
                    Lihat detail <ChevronRight size={13}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin:'0 24px' }}/>

      {/* ══════════════════════════════════════
          PACKAGES
      ══════════════════════════════════════ */}
      <section id="paket" className="l-section" style={{ position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div data-reveal style={{ opacity:0, display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:20, marginBottom:52 }}>
            <div style={{ textAlign:'left' }}>
              <div className="l-tag" style={{ marginBottom:14, display:'inline-flex' }}>
                <Star size={11}/> Paket Unggulan
              </div>
              <h2 style={{ fontFamily:"'Urbanist',sans-serif", fontSize:'clamp(28px,4vw,44px)', fontWeight:800, letterSpacing:'-0.025em', margin:0 }}>
                Pilihan Paket <span className="l-gold-text">Terbaik</span>
              </h2>
            </div>
            <button className="l-btn-g" style={{ padding:'10px 20px', fontSize:13 }}>
              Lihat Semua Paket <ArrowRight size={13}/>
            </button>
          </div>

          <div className="l-packages-grid">
            {PACKAGES.map((pkg,i) => (
              <div key={i} data-reveal className={`l-card ${pkg.hot ? 'l-pkg-hot' : ''}`}
                style={{ opacity:0, animationDelay:`${i*0.1}s`, overflow:'hidden' }}>

                {/* Visual */}
                <div style={{ height:170, background:pkg.gradient, position:'relative', borderRadius:'20px 20px 0 0', overflow:'hidden' }}>
                  <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.14) 0%,transparent 55%)' }}/>
                  {/* Decorative plane icon */}
                  <Plane size={60} color="rgba(255,255,255,0.08)" style={{ position:'absolute', right:20, bottom:10, transform:'rotate(45deg)' }}/>
                  <span style={{
                    position:'absolute', top:16, left:16,
                    padding:'4px 12px', borderRadius:100, fontSize:10, fontWeight:700,
                    background:'rgba(0,0,0,0.4)', color:pkg.badgeColor, letterSpacing:'.08em',
                    backdropFilter:'blur(10px)', border:`1px solid ${pkg.badgeColor}40`,
                  }}>
                    {pkg.badge}
                  </span>
                  {pkg.hot && (
                    <span style={{
                      position:'absolute', top:16, right:16,
                      padding:'4px 10px', borderRadius:100, fontSize:9, fontWeight:700,
                      background:'rgba(245,158,11,0.2)', color:T.gold, letterSpacing:'.1em',
                      backdropFilter:'blur(10px)', border:'1px solid rgba(245,158,11,0.35)',
                    }}>
                      BEST VALUE
                    </span>
                  )}
                </div>

                <div style={{ padding:'24px 26px 28px' }}>
                  <h3 style={{ fontSize:18, fontWeight:700, margin:'0 0 4px' }}>{pkg.title}</h3>
                  <p style={{ fontSize:12, color:T.dim, margin:'0 0 18px' }}>{pkg.sub}</p>

                  <ul style={{ listStyle:'none', margin:'0 0 22px', display:'flex', flexDirection:'column', gap:8 }}>
                    {pkg.features.map((f,j) => (
                      <li key={j} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.sub }}>
                        <CheckCircle size={13} color="#34d399" style={{ flexShrink:0 }}/> {f}
                      </li>
                    ))}
                  </ul>

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:18, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:800, color:pkg.hot ? T.gold : T.sky, letterSpacing:'-0.02em' }}>{pkg.price}</div>
                      <div style={{ fontSize:11, color:T.dim }}>{pkg.per}</div>
                    </div>
                    <button
                      className={pkg.hot ? 'l-btn-gold' : 'l-btn-p'}
                      style={{ padding:'10px 18px', fontSize:13 }}
                      onClick={() => navigate('/register')}
                    >
                      <span className="shine"/>
                      Pesan <ArrowRight size={13}/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin:'0 24px' }}/>

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <section id="proses" className="l-section" style={{ position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div data-reveal style={{ opacity:0 }}>
            <SectionHeader
              tag="Cara Kerja" tagIcon={<Navigation size={11}/>}
              title={<>Mulai dalam <span className="l-sky-text">4 Langkah</span> Mudah</>}
              sub="Proses bergabung yang simple, cepat, dan tanpa biaya apapun."
            />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:24, position:'relative' }}>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} data-reveal style={{ position:'relative', opacity:0, animationDelay:`${i*0.12}s` }}>
                  {i < STEPS.length - 1 && <div className="l-step-line"/>}
                  <div style={{
                    width:72, height:72, borderRadius:20, marginBottom:20,
                    background:'rgba(13,21,38,0.9)',
                    border:'1px solid rgba(56,189,248,0.18)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    position:'relative',
                  }}>
                    <Icon size={28} color={T.sky}/>
                    <div style={{
                      position:'absolute', top:-10, right:-10,
                      width:26, height:26, borderRadius:8,
                      background:'linear-gradient(135deg,#38bdf8,#2563eb)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:800, color:'white',
                    }}>
                      {step.num}
                    </div>
                  </div>
                  <h3 style={{ fontSize:17, fontWeight:700, margin:'0 0 10px' }}>{step.title}</h3>
                  <p style={{ fontSize:13, color:T.dim, lineHeight:1.7, margin:0 }}>{step.desc}</p>
                </div>
              );
            })}
          </div>
          <div data-reveal style={{ opacity:0, textAlign:'center', marginTop:56 }}>
            <Link to="/register" className="l-btn-p" style={{ fontSize:15, padding:'15px 36px' }}>
              <span className="shine"/>
              <Zap size={16}/> Mulai Daftar Sekarang — Gratis!
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          STATS
      ══════════════════════════════════════ */}
      <section className="l-section-sm" style={{ position:'relative', zIndex:1, background:'rgba(6,11,24,0.5)', backdropFilter:'blur(10px)' }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div className="l-stats-grid">
            {STATS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} style={{
                  textAlign:'center', padding:'28px 16px',
                  background:'rgba(13,21,38,0.7)',
                  border:'1px solid rgba(56,189,248,0.1)',
                  borderRadius:18, backdropFilter:'blur(16px)',
                  transition:'border-color .2s, transform .2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(56,189,248,0.3)'; (e.currentTarget as HTMLElement).style.transform='translateY(-4px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(56,189,248,0.1)'; (e.currentTarget as HTMLElement).style.transform=''; }}
                >
                  <Icon size={20} color={T.sky} style={{ marginBottom:10 }}/>
                  <div style={{
                    fontFamily:"'Urbanist',sans-serif",
                    fontSize:34, fontWeight:800, letterSpacing:'-0.03em', lineHeight:1,
                    background:'linear-gradient(135deg,#38bdf8,#60a5fa)',
                    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                    marginBottom:8,
                  }}>
                    <Counter value={stat.value} suffix={stat.suffix}/>
                  </div>
                  <div style={{ fontSize:12, color:T.dim, fontWeight:600, letterSpacing:'0.06em' }}>{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TENTANG / WHY
      ══════════════════════════════════════ */}
      <section id="tentang" className="l-section" style={{ position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div className="l-tentang-grid">
            {/* Left */}
            <div data-reveal style={{ opacity:0 }}>
              <div className="l-tag" style={{ marginBottom:18, display:'inline-flex' }}>
                <Shield size={11}/> Kenapa Kami
              </div>
              <h2 style={{
                fontFamily:"'Urbanist',sans-serif",
                fontSize:'clamp(28px,3.5vw,44px)', fontWeight:800,
                letterSpacing:'-0.025em', lineHeight:1.1, margin:'0 0 18px',
              }}>
                15 Tahun Membangun<br/><span className="l-sky-text">Kepercayaan</span>
              </h2>
              <p style={{ color:T.sub, fontSize:15, lineHeight:1.8, margin:'0 0 32px' }}>
                Bintang Global bukan sekadar platform teknologi — kami adalah mitra bisnis jangka panjang
                yang memahami kebutuhan agen travel dan umrah di setiap penjuru Indonesia.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {[
                  { icon:Shield,     color:'#34d399', title:'Terpercaya & Legal',         desc:'Lisensi resmi Kemenag, IATA, dan POJK' },
                  { icon:Headphones, color:T.sky,     title:'Support 24 Jam / 7 Hari',    desc:'Tim dedicated siap membantu kapan saja' },
                  { icon:Zap,        color:T.gold,    title:'Teknologi Terdepan',          desc:'Dashboard AI-powered dengan analitik cerdas' },
                  { icon:Globe,      color:T.purple,  title:'Jaringan Global',             desc:'Partner di 50+ kota & destinasi internasional' },
                ].map(({ icon:Icon, color, title, desc }, i) => (
                  <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                    <div style={{
                      width:42, height:42, borderRadius:12, flexShrink:0,
                      background:`${color}18`, border:`1px solid ${color}30`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <Icon size={18} color={color}/>
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, marginBottom:3 }}>{title}</div>
                      <div style={{ fontSize:13, color:T.dim }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — visual */}
            <div data-reveal style={{ opacity:0, position:'relative' }}>
              <div style={{
                background:'rgba(13,21,38,0.85)',
                border:'1px solid rgba(56,189,248,0.15)',
                borderRadius:24, padding:'28px',
                backdropFilter:'blur(20px)',
                boxShadow:'0 40px 100px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:18, color:T.sub }}>Aktivitas Partner — Minggu Ini</div>
                {[
                  { name:'PT Cahaya Umrah',   status:'Order Baru', amount:'+Rp 12.5jt', color:'#34d399', time:'5m lalu' },
                  { name:'Madina Tour',        status:'Visa Approved', amount:'3 Jamaah', color:T.sky,   time:'18m lalu' },
                  { name:'Firdaus Travel',     status:'Pembayaran',    amount:'+Rp 8.2jt', color:T.gold, time:'1j lalu' },
                  { name:'Al-Madinah Tour',    status:'Order Baru',    amount:'+Rp 22.1jt',color:'#34d399',time:'2j lalu'},
                  { name:'Berkah Umrah',       status:'Invoice Sent',  amount:'✓ Lunas',  color:T.purple,time:'3j lalu' },
                ].map((item, i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 0',
                    borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <div style={{
                      width:36, height:36, borderRadius:10, flexShrink:0,
                      background:`${item.color}18`, border:`1px solid ${item.color}30`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:12, fontWeight:800, color:item.color,
                    }}>
                      {item.name.slice(0,2)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
                      <div style={{ fontSize:11, color:T.dim }}>{item.status}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:item.color }}>{item.amount}</div>
                      <div style={{ fontSize:10, color:'#1e3a5f' }}>{item.time}</div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(56,189,248,0.06)', borderRadius:12, border:'1px solid rgba(56,189,248,0.1)', display:'flex', alignItems:'center', gap:10 }}>
                  <TrendingUp size={16} color="#34d399"/>
                  <span style={{ fontSize:12, color:'#94a3b8' }}>Total revenue minggu ini: </span>
                  <span style={{ fontSize:13, fontWeight:800, color:'#34d399', marginLeft:'auto' }}>+Rp 42.8jt</span>
                </div>
              </div>
              {/* Decoration dot */}
              <div style={{ position:'absolute', top:-20, right:-20, width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,#38bdf8,#2563eb)', opacity:0.15, filter:'blur(20px)' }}/>
            </div>
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin:'0 24px' }}/>

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section className="l-section" style={{ position:'relative', zIndex:1, overflow:'hidden' }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div data-reveal style={{ opacity:0 }}>
            <SectionHeader
              tag="Testimoni" tagIcon={<Star size={11}/>}
              title={<>Apa Kata <span className="l-gold-text">Partner Kami</span></>}
              sub="Bergabung bersama ratusan agen travel dan umrah yang telah merasakan manfaatnya."
            />
          </div>

          <div style={{ overflow:'hidden' }}>
            <div className="l-testi-track" style={{ transform:`translateX(calc(-${testiIdx * (100/3)}%))` }}>
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="l-card" style={{
                  minWidth:'calc(33.33% - 14px)', padding:'28px 30px', flexShrink:0,
                }}>
                  <div style={{ display:'flex', gap:2, marginBottom:16 }}>
                    {[...Array(t.rating)].map((_,j) => <Star key={j} size={14} fill={T.gold} color={T.gold}/>)}
                  </div>
                  <p style={{ fontSize:14, color:T.sub, lineHeight:1.8, margin:'0 0 22px', fontStyle:'italic' }}>
                    "{t.text}"
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:12, paddingTop:18, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                    <div className="l-avatar">{t.avatar}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700 }}>{t.name}</div>
                      <div style={{ fontSize:11, color:T.dim }}>{t.role}</div>
                      <div style={{ fontSize:11, color:T.sky, marginTop:2 }}>📍 {t.city}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dots */}
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:28 }}>
            {TESTIMONIALS.map((_, i) => (
              <button key={i} className="l-dot" onClick={() => setTestiIdx(i)}
                style={{ background: i===testiIdx ? T.sky : 'rgba(56,189,248,0.2)', width: i===testiIdx ? 24 : 8 }}/>
            ))}
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin:'0 24px' }}/>

      {/* ══════════════════════════════════════
          FAQ
      ══════════════════════════════════════ */}
      <section id="faq" className="l-section" style={{ position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          <div data-reveal style={{ opacity:0 }}>
            <SectionHeader
              tag="FAQ" tagIcon={<MessageCircle size={11}/>}
              title={<>Pertanyaan yang <span className="l-sky-text">Sering Ditanya</span></>}
              sub="Temukan jawaban atas pertanyaan umum seputar bergabung sebagai partner Bintang Global."
            />
          </div>
          <div data-reveal style={{ opacity:0 }}>
            {FAQS.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} defaultOpen={i===0}/>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HUBUNGI KAMI
      ══════════════════════════════════════ */}
      <section id="kontak" className="l-section" style={{ position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:940, margin:'0 auto' }}>
          <div data-reveal style={{ opacity:0 }}>
            <SectionHeader
              tag="Kontak" tagIcon={<Phone size={11}/>}
              title={<>Hubungi <span className="l-sky-text">Tim Kami</span></>}
              sub="Butuh bantuan atau ingin diskusi kerja sama? Isi form atau hubungi melalui channel berikut."
            />
          </div>
          <div data-reveal style={{ opacity:0, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:20, marginBottom:48 }}>
            {[
              { icon: Phone, label: 'Telepon', value: '021-XXXX-XXXX', desc: 'Senin–Sabtu, 08:00–17:00 WIB' },
              { icon: Mail, label: 'Email', value: 'partner@bintangglobal.id', desc: 'Balasan dalam 1×24 jam' },
              { icon: MessageCircle, label: 'WhatsApp', value: '08xx-xxxx-xxxx', desc: 'Support cepat via chat' },
              { icon: Building2, label: 'Cabang', value: '50+ cabang', desc: 'Seluruh Indonesia' },
            ].map(({ icon: Icon, label, value, desc }) => (
              <div key={label} style={{
                padding:24, borderRadius:16, border:'1px solid rgba(56,189,248,0.12)', background:'rgba(56,189,248,0.04)',
                transition:'border-color .2s, background .2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(56,189,248,0.25)'; (e.currentTarget as HTMLElement).style.background='rgba(56,189,248,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(56,189,248,0.12)'; (e.currentTarget as HTMLElement).style.background='rgba(56,189,248,0.04)'; }}
              >
                <div style={{ width:40, height:40, borderRadius:12, background:'rgba(56,189,248,0.12)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <Icon size={18} color={T.sky}/>
                </div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', color:T.sky, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
                <div style={{ fontSize:15, fontWeight:700, color:'white', marginBottom:4 }}>{value}</div>
                <div style={{ fontSize:12, color:T.dim }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* Form Hubungi Kami */}
          <div data-reveal style={{ opacity:0, maxWidth:560, margin:'0 auto' }}>
            <div style={{
              padding:32, borderRadius:20, border:'1px solid rgba(56,189,248,0.15)', background:'rgba(13,21,38,0.6)',
              backdropFilter:'blur(16px)', boxShadow:'0 24px 60px rgba(0,0,0,0.3)',
            }}>
              <div style={{ fontSize:14, fontWeight:700, color:T.sky, marginBottom:20, letterSpacing:'0.06em', textTransform:'uppercase' }}>Form Hubungi Kami</div>
              {contactSent ? (
                <div style={{ padding:24, textAlign:'center', color:'#34d399', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', gap:10, flexDirection:'column' }}>
                  <CheckCircle size={40}/>
                  <span>Pesan Anda telah terkirim. Tim kami akan menghubungi dalam 1×24 jam.</span>
                  <button type="button" className="l-btn-g" style={{ marginTop:12 }} onClick={() => setContactSent(false)}>Kirim pesan lagi</button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:T.sub, marginBottom:6 }}>Nama *</label>
                    <input type="text" required value={contactForm.nama} onChange={e => setContactForm(f => ({ ...f, nama: e.target.value }))}
                      placeholder="Nama lengkap atau perusahaan"
                      style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid rgba(56,189,248,0.2)', background:'rgba(255,255,255,0.04)', color:'white', fontSize:14, outline:'none' }}
                    />
                  </div>
                  <div className="l-form-grid">
                    <div>
                      <label style={{ display:'block', fontSize:12, fontWeight:600, color:T.sub, marginBottom:6 }}>Email *</label>
                      <input type="email" required value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="email@contoh.com"
                        style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid rgba(56,189,248,0.2)', background:'rgba(255,255,255,0.04)', color:'white', fontSize:14, outline:'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:12, fontWeight:600, color:T.sub, marginBottom:6 }}>Telepon</label>
                      <input type="tel" value={contactForm.telepon} onChange={e => setContactForm(f => ({ ...f, telepon: e.target.value }))}
                        placeholder="08xx-xxxx-xxxx"
                        style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid rgba(56,189,248,0.2)', background:'rgba(255,255,255,0.04)', color:'white', fontSize:14, outline:'none' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:T.sub, marginBottom:6 }}>Pesan *</label>
                    <textarea required rows={4} value={contactForm.pesan} onChange={e => setContactForm(f => ({ ...f, pesan: e.target.value }))}
                      placeholder="Tulis pesan atau pertanyaan Anda..."
                      style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid rgba(56,189,248,0.2)', background:'rgba(255,255,255,0.04)', color:'white', fontSize:14, outline:'none', resize:'vertical', fontFamily:'inherit' }}
                    />
                  </div>
                  <button type="submit" className="l-btn-p" style={{ alignSelf:'flex-start', padding:'14px 28px' }}>
                    <span className="shine"/> Kirim Pesan
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          DIPERCAYA OLEH
      ══════════════════════════════════════ */}
      <section style={{ position:'relative', zIndex:1, padding:'0 16px 60px' }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div data-reveal style={{ opacity:0, padding:'24px 20px', borderRadius:20, border:'1px solid rgba(56,189,248,0.1)', background:'rgba(56,189,248,0.03)', display:'flex', flexWrap:'wrap', justifyContent:'center', gap:24, alignItems:'center' }}>
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.15em', color:T.dim, textTransform:'uppercase' }}>Dipercaya oleh</div>
            {[
              { num: '50+', text: 'Cabang' },
              { num: '10rb+', text: 'Jamaah/Tahun' },
              { num: '500+', text: 'Partner' },
              { num: '98%', text: 'Kepuasan' },
            ].map(({ num, text }) => (
              <div key={text} style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                <span className="l-sky-text" style={{ fontSize:28, fontWeight:800 }}>{num}</span>
                <span style={{ fontSize:14, color:T.dim, fontWeight:600 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA
      ══════════════════════════════════════ */}
      <section className="l-section" style={{ position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:940, margin:'0 auto' }}>
          <div data-reveal className="l-cta-bg l-cta-inner" style={{
            opacity:0, borderRadius:28, textAlign:'center',
            border:'1px solid rgba(56,189,248,0.15)',
            boxShadow:'0 0 80px rgba(37,99,235,0.2), inset 0 0 80px rgba(37,99,235,0.05)',
            position:'relative', overflow:'hidden',
          }}>
            {/* Inner glow */}
            <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:500, height:300, background:'rgba(56,189,248,0.05)', borderRadius:'50%', filter:'blur(60px)', pointerEvents:'none' }}/>

            <div className="l-tag" style={{ marginBottom:20, display:'inline-flex' }}>
              <Sparkles size={11}/> Bergabung Sekarang
            </div>
            <h2 style={{
              fontFamily:"'Urbanist',sans-serif",
              fontSize:'clamp(30px,5vw,54px)', fontWeight:800,
              letterSpacing:'-0.03em', lineHeight:1.1, margin:'0 0 16px',
            }}>
              Siap Tingkatkan Bisnis<br/><span className="l-shimmer">Travel Anda?</span>
            </h2>
            <p style={{ color:T.sub, fontSize:16, margin:'0 0 40px', lineHeight:1.7, maxWidth:500, marginLeft:'auto', marginRight:'auto' }}>
              Daftar gratis dalam 2 menit. Verifikasi instan. Akses penuh ke semua fitur platform.
            </p>
            <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
              <Link to="/register" className="l-btn-p" style={{ fontSize:15, padding:'16px 36px' }}>
                <span className="shine"/>
                <Zap size={16}/> Daftar Partner — GRATIS
              </Link>
              <Link to="/login" className="l-btn-g" style={{ fontSize:15, padding:'16px 32px' }}>
                Sudah punya akun?
              </Link>
            </div>
            <div style={{ marginTop:28, display:'flex', justifyContent:'center', gap:24, flexWrap:'wrap' }}>
              {['✓ Tanpa biaya pendaftaran','✓ Verifikasi 24 jam','✓ Komisi hingga 8%'].map(b => (
                <span key={b} style={{ fontSize:12, color:T.dim, fontWeight:600 }}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className="l-footer" style={{
        position:'relative', zIndex:1,
        borderTop:'1px solid rgba(56,189,248,0.08)',
        background:'rgba(6,11,24,0.8)', backdropFilter:'blur(20px)',
      }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div className="l-footer-grid" style={{ marginBottom:52 }}>

            {/* Brand */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <img src={logo} alt="Bintang Global" style={{ width:36, height:36, borderRadius:10, objectFit:'contain', display:'block', flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:14, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:"'Urbanist',sans-serif" }}>Bintang Global</div>
                  <div style={{ fontSize:9, color:T.sky, letterSpacing:'0.24em', textTransform:'uppercase' }}>Umroh & Travel</div>
                </div>
              </div>
              <p style={{ fontSize:13, color:T.dim, lineHeight:1.75, margin:'0 0 20px', maxWidth:240 }}>
                Platform travel dan umrah terintegrasi untuk partner dan jamaah di seluruh Indonesia.
              </p>
              {/* Socials */}
              <div style={{ display:'flex', gap:10 }}>
                {[Instagram, Twitter, Youtube].map((Icon, i) => (
                  <button key={i} style={{
                    width:36, height:36, borderRadius:10, border:'1px solid rgba(56,189,248,0.15)',
                    background:'rgba(56,189,248,0.06)', display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:'pointer', transition:'all .2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(56,189,248,0.4)'; (e.currentTarget as HTMLElement).style.background='rgba(56,189,248,0.12)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(56,189,248,0.15)'; (e.currentTarget as HTMLElement).style.background='rgba(56,189,248,0.06)'; }}
                  >
                    <Icon size={14} color={T.sky}/>
                  </button>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              { title:'Platform', links:[['Layanan','#layanan'],['Paket Umrah','#paket'],['Cara Kerja','#proses'],['Tentang Kami','#tentang']] },
              { title:'Partner',  links:[['Daftar Partner','/register'],['Masuk Dashboard','/login'],['Kebijakan Privasi','#'],['Syarat & Ketentuan','#']] },
              { title:'Kontak',   links:[['📞 021-XXXX-XXXX','#'],['✉ partner@bintangglobal.id','#'],['🕒 Senin–Sabtu 08–17','#'],['🌐 Support 24/7','#']] },
            ].map(({ title, links }) => (
              <div key={title}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.18em', color:'#1e3a5f', textTransform:'uppercase', marginBottom:18 }}>{title}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {links.map(([label, href]) => (
                    <a key={label} href={href} style={{ fontSize:13, color:T.dim, textDecoration:'none', transition:'color .2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = T.sky)}
                      onMouseLeave={e => (e.currentTarget.style.color = T.dim)}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="l-hr" style={{ marginBottom:24 }}/>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <span style={{ fontSize:11, color:'#1e3a5f' }}>
              © {new Date().getFullYear()} Bintang Global. All rights reserved.
            </span>
            <div style={{ display:'flex', gap:20 }}>
              {['Kebijakan Privasi','Syarat & Ketentuan','Cookie'].map(l => (
                <a key={l} href="#" style={{ fontSize:11, color:'#1e3a5f', textDecoration:'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp FAB ── */}
      <button className="l-fab" title="Chat WhatsApp" onClick={() => window.open('https://wa.me/62','_blank')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>

    </div>
  );
};

export default LandingPage;