import React, { useEffect, useState, useRef } from 'react';
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
   DESIGN TOKENS — Warm White / Islamic Green / Gold
═══════════════════════════════════════════════════════════════════ */
const T = {
  bg:       '#FAFAF7',
  bgSoft:   '#F4EFE5',
  bgCream:  '#F9F5ED',
  white:    '#FFFFFF',
  green:    '#1B4D3E',
  greenMd:  '#2D6A58',
  greenLt:  '#EAF4F0',
  greenPale:'#F0F7F5',
  gold:     '#B8832A',
  goldWarm: '#C9922A',
  goldLt:   '#FEF5E7',
  goldPale: '#FDF8F0',
  text:     '#1A1A1A',
  textMd:   '#374151',
  muted:    '#6B7280',
  dim:      '#9CA3AF',
  border:   '#E5E7EB',
  borderMd: '#D1D5DB',
  shadow:   'rgba(27,77,62,0.08)',
  shadowMd: 'rgba(27,77,62,0.14)',
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
  { id: 'hotel',  label: 'Hotel',   desc: 'Ribuan pilihan akomodasi bintang 3–5',      icon: Hotel,     accent: T.gold,    bg: T.goldPale  },
  { id: 'visa',   label: 'Visa',    desc: 'Proses visa cepat & resmi',                  icon: FileCheck, accent: '#2D6A58',  bg: T.greenPale },
  { id: 'tiket',  label: 'Tiket',   desc: 'Penerbangan langsung & transit',             icon: Ticket,    accent: '#1B4D3E',  bg: T.greenLt   },
  { id: 'bus',    label: 'Bus',     desc: 'Armada AC nyaman untuk jamaah',              icon: Bus,       accent: '#7C5A1E',  bg: '#FDF4E7'   },
  { id: 'paket',  label: 'Paket',   desc: 'All-in-one umrah & wisata halal',            icon: Package,   accent: '#C4882F',  bg: T.goldLt    },
  { id: 'report', label: 'Laporan', desc: 'Dashboard real-time & analitik bisnis',      icon: BarChart3, accent: '#2D6A58',  bg: T.greenPale },
];

const PACKAGES = [
  {
    badge: '⭐ Terlaris', badgeColor: T.gold,
    title: 'Paket Umrah Reguler', sub: '9 Hari · Makkah & Madinah',
    price: 'Rp 32.500.000', per: '/orang',
    features: ['Hotel Bintang 4 dekat Masjidil Haram', 'Penerbangan PP Garuda Indonesia', 'Visa Umrah & Asuransi', 'Muthawif Berpengalaman', 'City Tour Madinah'],
    accentColor: T.green,
    stripBg: '#1B4D3E',
    hot: true,
  },
  {
    badge: '🔥 Populer', badgeColor: T.goldWarm,
    title: 'Paket Umrah Plus Turki', sub: '14 Hari · Umrah + Wisata Halal',
    price: 'Rp 28.900.000', per: '/orang',
    features: ['Hotel Bintang 5 Makkah & Istanbul', 'Penerbangan Internasional', 'Visa Schengen & Saudi', 'Tour Istanbul 3 Hari', 'Free City Tour Madinah'],
    accentColor: T.goldWarm,
    stripBg: '#7C5A1E',
    hot: false,
  },
  {
    badge: '✨ Baru', badgeColor: '#2D6A58',
    title: 'Wisata Halal Eropa', sub: '12 Hari · 5 Negara',
    price: 'Rp 45.000.000', per: '/orang',
    features: ['Hotel Bintang 4 di 5 Kota', 'Penerbangan Business Class', 'Visa Schengen Multi-Country', 'Muslim-Friendly Guide', 'Halal Food Guaranteed'],
    accentColor: '#2D6A58',
    stripBg: '#2D6A58',
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
  { value: 50,   suffix: '+',   label: 'Kota Aktif',         icon: MapPin     },
  { value: 10,   suffix: 'rb+', label: 'Jamaah / Tahun',     icon: Users      },
  { value: 15,   suffix: '+',   label: 'Tahun Pengalaman',   icon: Award      },
  { value: 98,   suffix: '%',   label: 'Tingkat Kepuasan',   icon: Star       },
  { value: 500,  suffix: '+',   label: 'Partner Aktif',      icon: Building2  },
  { value: 24,   suffix: '/7',  label: 'Tim Dukungan',       icon: Headphones },
];

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════════════════════════════ */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  :root {
    --green:#1B4D3E; --gold:#B8832A; --bg:#FAFAF7; --cream:#F4EFE5;
    --text:#1A1A1A; --muted:#6B7280; --border:#E5E7EB;
  }

  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html { scroll-behavior:smooth; }
  body, * { -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }

  /* ─ Animations ─────────────────────────────────── */
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(20px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes ticker {
    from { transform:translateX(0); }
    to   { transform:translateX(-50%); }
  }
  @keyframes floatUp {
    0%,100% { transform:translateY(0); }
    50%      { transform:translateY(-8px); }
  }
  @keyframes shimmerGold {
    0%,100% { background-position:0% center; }
    50%      { background-position:100% center; }
  }
  @keyframes navSlide {
    from { opacity:0; transform:translateY(-16px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes patternDrift {
    from { background-position:0 0; }
    to   { background-position:60px 60px; }
  }
  @keyframes glowPulse {
    0%,100% { box-shadow:0 4px 20px rgba(37,211,102,0.35); }
    50%      { box-shadow:0 4px 40px rgba(37,211,102,0.55); }
  }
  @keyframes dotPop {
    0%   { transform:scale(0); opacity:0; }
    60%  { transform:scale(1.3); }
    100% { transform:scale(1); opacity:1; }
  }

  /* ─ Reveal / Animate ────────────────────────────── */
  .l-fu   { animation:fadeUp .7s cubic-bezier(.22,1,.36,1) both; }
  .l-fu-0 { animation-delay:.05s; }
  .l-fu-1 { animation-delay:.15s; }
  .l-fu-2 { animation-delay:.25s; }
  .l-fu-3 { animation-delay:.35s; }
  .l-fu-4 { animation-delay:.45s; }
  .l-visible { animation:fadeUp .65s cubic-bezier(.22,1,.36,1) both; }
  .l-float  { animation:floatUp 5s ease-in-out infinite; }

  /* ─ Ticker ───────────────────────────────────────── */
  .ticker-track { animation:ticker 32s linear infinite; display:flex; gap:0; white-space:nowrap; }
  .ticker-track:hover { animation-play-state:paused; }

  /* ─ Gold shimmer text ─────────────────────────────── */
  .l-gold-text {
    background:linear-gradient(90deg,#B8832A 0%,#DCA84A 40%,#B8832A 80%);
    background-size:200% auto;
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    animation:shimmerGold 4s ease infinite;
  }
  .l-green-text {
    background:linear-gradient(135deg,#1B4D3E,#2D6A58);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  }

  /* ─ Islamic geometric bg pattern ────────────────── */
  .l-pattern-bg {
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231B4D3E' fill-opacity='0.04'%3E%3Cpath d='M30 0 L37.5 10.5 L49.5 7.5 L46.5 19.5 L57 27 L46.5 34.5 L49.5 46.5 L37.5 43.5 L30 54 L22.5 43.5 L10.5 46.5 L13.5 34.5 L3 27 L13.5 19.5 L10.5 7.5 L22.5 10.5 Z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .l-pattern-gold {
    background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23B8832A' fill-opacity='0.06'%3E%3Crect x='0' y='0' width='1' height='40'/%3E%3Crect x='0' y='0' width='40' height='1'/%3E%3C/g%3E%3C/svg%3E");
  }

  /* ─ Buttons ──────────────────────────────────────── */
  .l-btn-primary {
    position:relative; overflow:hidden;
    display:inline-flex; align-items:center; gap:8px;
    padding:13px 26px; border-radius:10px; border:none; cursor:pointer;
    background:linear-gradient(135deg,#1B4D3E 0%,#2D6A58 100%);
    box-shadow:0 4px 20px rgba(27,77,62,0.3);
    color:white; font-weight:700; font-size:14px; letter-spacing:.01em;
    text-decoration:none; font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    transition:transform .15s, box-shadow .2s;
  }
  .l-btn-primary:hover { transform:translateY(-1px); box-shadow:0 8px 28px rgba(27,77,62,0.4); }
  .l-btn-primary:active { transform:translateY(0); }
  .l-btn-primary .shine {
    position:absolute; inset:0;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
    transform:translateX(-120%); transition:transform .55s ease;
  }
  .l-btn-primary:hover .shine { transform:translateX(120%); }

  .l-btn-gold {
    position:relative; overflow:hidden;
    display:inline-flex; align-items:center; gap:8px;
    padding:13px 26px; border-radius:10px; border:none; cursor:pointer;
    background:linear-gradient(135deg,#B8832A 0%,#DCA84A 100%);
    box-shadow:0 4px 20px rgba(184,131,42,0.3);
    color:white; font-weight:700; font-size:14px; letter-spacing:.01em;
    text-decoration:none; font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    transition:transform .15s, box-shadow .2s;
  }
  .l-btn-gold:hover { transform:translateY(-1px); box-shadow:0 8px 28px rgba(184,131,42,0.4); }
  .l-btn-gold .shine { position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent);transform:translateX(-120%);transition:transform .55s; }
  .l-btn-gold:hover .shine { transform:translateX(120%); }

  .l-btn-outline {
    display:inline-flex; align-items:center; gap:8px;
    padding:12px 24px; border-radius:10px; text-decoration:none; cursor:pointer;
    font-weight:600; font-size:14px; letter-spacing:.01em;
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    color:#1B4D3E; background:white;
    border:1.5px solid #D1D5DB;
    transition:all .2s; white-space:nowrap;
  }
  .l-btn-outline:hover { border-color:#1B4D3E; background:#F0F7F5; color:#1B4D3E; }

  .l-btn-outline-gold {
    display:inline-flex; align-items:center; gap:8px;
    padding:12px 24px; border-radius:10px; text-decoration:none; cursor:pointer;
    font-weight:600; font-size:14px;
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    color:#B8832A; background:white;
    border:1.5px solid #E8C87A;
    transition:all .2s;
  }
  .l-btn-outline-gold:hover { background:#FEF5E7; border-color:#B8832A; }

  /* ─ Cards ────────────────────────────────────────── */
  .l-card {
    background:white;
    border:1px solid #E5E7EB;
    border-radius:16px;
    transition:border-color .25s, transform .25s, box-shadow .25s;
  }
  .l-card:hover {
    border-color:#C8D8D4;
    transform:translateY(-4px);
    box-shadow:0 16px 48px rgba(27,77,62,0.1);
  }

  /* ─ Tag/Badge ────────────────────────────────────── */
  .l-tag {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 14px; border-radius:100px; font-size:10px;
    font-weight:700; letter-spacing:.14em; text-transform:uppercase;
    background:#EAF4F0; border:1px solid #C8D8D4;
    color:#1B4D3E;
  }
  .l-tag-gold {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 14px; border-radius:100px; font-size:10px;
    font-weight:700; letter-spacing:.14em; text-transform:uppercase;
    background:#FEF5E7; border:1px solid #E8C87A;
    color:#B8832A;
  }

  /* ─ Divider ──────────────────────────────────────── */
  .l-hr { height:1px; background:linear-gradient(90deg,transparent,#E5E7EB,transparent); }

  /* ─ Nav ──────────────────────────────────────────── */
  .l-nav { animation:navSlide .5s cubic-bezier(.22,1,.36,1) both; }
  .l-nav-link {
    font-size:14px; font-weight:600; color:#374151; text-decoration:none;
    background:none; border:none; cursor:pointer;
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    transition:color .2s; padding:4px 0; position:relative;
  }
  .l-nav-link::after {
    content:''; position:absolute; bottom:-3px; left:0; width:0; height:2px;
    background:#B8832A; border-radius:1px; transition:width .25s ease;
  }
  .l-nav-link:hover { color:#1B4D3E; }
  .l-nav-link:hover::after { width:100%; }

  /* ─ FAQ ──────────────────────────────────────────── */
  .l-faq-item { border-bottom:1px solid #F3F4F6; }
  .l-faq-q {
    display:flex; align-items:center; justify-content:space-between;
    padding:20px 0; cursor:pointer;
    font-size:15px; font-weight:600; color:#1A1A1A; gap:16px;
    background:none; border:none; width:100%; text-align:left;
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    transition:color .2s; line-height:1.5;
  }
  .l-faq-q:hover { color:#1B4D3E; }
  .l-faq-a {
    overflow:hidden; transition:max-height .35s ease, opacity .3s;
    font-size:14px; color:#6B7280; line-height:1.8;
  }

  /* ─ Testimonial ──────────────────────────────────── */
  .l-testi-track { display:flex; gap:20px; transition:transform .5s cubic-bezier(.22,1,.36,1); }

  /* ─ WhatsApp FAB ─────────────────────────────────── */
  .l-fab {
    position:fixed; bottom:28px; right:28px; z-index:999;
    width:56px; height:56px; border-radius:50%; border:none; cursor:pointer;
    background:linear-gradient(135deg,#25d366,#128c7e);
    display:flex; align-items:center; justify-content:center;
    animation:glowPulse 3s ease-in-out infinite;
    transition:transform .2s;
  }
  .l-fab:hover { transform:scale(1.1); }

  /* ─ Search widget ────────────────────────────────── */
  .l-search-box {
    background:white;
    border:1px solid #E5E7EB;
    border-radius:20px;
    overflow:hidden;
    box-shadow:0 20px 60px rgba(27,77,62,0.12), 0 1px 0 rgba(255,255,255,0.9) inset;
  }
  .l-search-tabs { display:flex; gap:4px; padding:16px 20px 0; flex-wrap:wrap; background:#FAFAF7; border-bottom:1px solid #F3F4F6; }
  .l-search-tab {
    display:flex; align-items:center; gap:7px;
    padding:10px 16px; border-radius:10px 10px 0 0; border:none; cursor:pointer;
    font-size:13px; font-weight:600; font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    background:transparent; color:#6B7280;
    border-bottom:2px solid transparent; margin-bottom:-1px;
    transition:all .2s;
  }
  .l-search-tab:hover { color:#1B4D3E; background:rgba(27,77,62,0.04); }
  .l-search-tab.active { color:#1B4D3E; border-bottom-color:#B8832A; background:white; }
  .l-search-form { padding:22px 22px 26px; }
  .l-search-row { display:grid; gap:14px; align-items:end; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); }
  .l-search-field { display:flex; flex-direction:column; gap:5px; }
  .l-search-label { font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#9CA3AF; }
  .l-search-input {
    width:100%; height:42px; padding:0 12px 0 38px; border-radius:10px;
    border:1.5px solid #E5E7EB; background:#FAFAF7;
    color:#1A1A1A; font-size:14px; outline:none;
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    transition:border-color .2s, box-shadow .2s, background .2s;
  }
  .l-search-input::placeholder { color:#B0B7BF; }
  .l-search-input:focus { border-color:#1B4D3E; box-shadow:0 0 0 3px rgba(27,77,62,0.1); background:white; }
  .l-search-input.no-icon { padding-left:12px; }
  select.l-search-input { cursor:pointer; }
  .l-search-field-wrap { position:relative; }
  .l-search-field-wrap .l-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9CA3AF; pointer-events:none; }
  .l-search-chips { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .l-search-chip {
    display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:8px;
    font-size:12px; font-weight:500; cursor:pointer;
    border:1.5px solid #E5E7EB; background:white; color:#6B7280;
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    transition:all .2s;
  }
  .l-search-chip:hover { border-color:#C8D8D4; color:#1B4D3E; }
  .l-search-chip.active { background:#EAF4F0; border-color:#1B4D3E; color:#1B4D3E; }
  .l-search-submit { margin-top:18px; }
  .l-search-submit .l-btn-primary { width:100%; justify-content:center; padding:13px 24px; font-size:15px; }

  /* ─ Stats card hover ─────────────────────────────── */
  .l-stat-card { transition:transform .2s, box-shadow .2s; }
  .l-stat-card:hover { transform:translateY(-3px); box-shadow:0 12px 32px rgba(27,77,62,0.1); }

  /* ─ Package card hot ─────────────────────────────── */
  .l-pkg-featured { border-color:#1B4D3E !important; box-shadow:0 0 0 2px rgba(27,77,62,0.15); }
  .l-pkg-featured:hover { border-color:#1B4D3E !important; box-shadow:0 16px 48px rgba(27,77,62,0.18) !important; }

  /* ─ Dot ──────────────────────────────────────────── */
  .l-dot { width:8px; height:8px; border-radius:50%; cursor:pointer; border:none; transition:all .2s; }

  /* ─ Form ──────────────────────────────────────────── */
  .l-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:520px) { .l-form-grid { grid-template-columns:1fr; } }

  /* ─ Hero section bg ─────────────────────────────── */
  .l-hero-section {
    background:#FAFAF7;
    position:relative;
  }
  .l-hero-section::before {
    content:''; position:absolute; inset:0;
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%231B4D3E' fill-opacity='0.028'%3E%3Cpath d='M30 5 L35 20 L50 20 L38 29 L42 44 L30 36 L18 44 L22 29 L10 20 L25 20 Z'/%3E%3C/g%3E%3C/svg%3E");
    pointer-events:none;
  }

  /* ─ CTA section ─────────────────────────────────── */
  .l-cta-section {
    background:linear-gradient(135deg,#1B4D3E 0%,#163C2E 50%,#0F2A20 100%);
    position:relative; overflow:hidden;
  }
  .l-cta-section::before {
    content:''; position:absolute; inset:0;
    background-image: url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23B8832A' fill-opacity='0.07'%3E%3Cpath d='M40 0 L50 28 L80 28 L56 45 L65 73 L40 57 L15 73 L24 45 L0 28 L30 28 Z'/%3E%3C/g%3E%3C/svg%3E");
    animation:patternDrift 20s linear infinite;
    pointer-events:none;
  }

  /* ─ Responsive ───────────────────────────────────── */
  .l-hide-mob { }
  .l-show-mob { display:none !important; }
  @media (max-width:768px) {
    .l-hide-mob { display:none !important; }
    .l-show-mob { display:flex !important; }
    .l-step-line { display:none; }
    .l-search-tabs { padding:12px 14px 0; }
    .l-search-form { padding:18px 14px 22px; }
    .l-search-row { grid-template-columns:1fr; }
  }

  .l-hero-grid { display:grid; grid-template-columns:1fr 1.1fr; gap:40px; align-items:center; }
  .l-tentang-grid { display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; }
  .l-footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:40px; }
  .l-packages-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:22px; }
  .l-stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:16px; }

  @media (max-width:992px) {
    .l-hero-grid { grid-template-columns:1fr; }
    .l-hero-left { align-items:center !important; text-align:center !important; }
    .l-hero-left .l-hero-pills { justify-content:center; }
    .l-hero-left .l-hero-cta { justify-content:center; }
    .l-hero-left .l-hero-social { justify-content:center; }
    .l-tentang-grid { grid-template-columns:1fr; gap:36px; }
  }
  @media (max-width:768px) {
    .l-footer-grid { grid-template-columns:1fr; gap:28px; }
    .l-packages-grid { grid-template-columns:1fr; }
    .l-stats-grid { grid-template-columns:repeat(2,1fr); gap:12px; }
  }
  @media (max-width:480px) {
    .l-stats-grid { grid-template-columns:1fr 1fr; }
  }

  .l-section { padding:90px 24px; }
  .l-section-sm { padding:70px 24px; }
  @media (max-width:768px) {
    .l-section { padding:60px 16px; }
    .l-section-sm { padding:48px 16px; }
  }
  @media (max-width:480px) {
    .l-section { padding:48px 12px; }
  }

  .l-container { padding-left:16px; padding-right:16px; }
  @media (max-width:480px) { .l-container { padding-left:12px; padding-right:12px; } }

  /* Scrollbar */
  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:#F4EFE5; }
  ::-webkit-scrollbar-thumb { background:#C8D8D4; border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:#1B4D3E; }
`;

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════════ */

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

const FaqItem: React.FC<{ q: string; a: string; defaultOpen?: boolean }> = ({ q, a, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="l-faq-item">
      <button className="l-faq-q" onClick={() => setOpen(v => !v)}>
        <span>{q}</span>
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: open ? '#EAF4F0' : '#F9FAFB',
          border: `1.5px solid ${open ? '#1B4D3E' : '#E5E7EB'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .25s', transform: open ? 'rotate(180deg)' : 'none',
        }}>
          <ChevronDown size={14} color={open ? T.green : T.muted} />
        </span>
      </button>
      <div className="l-faq-a" style={{ maxHeight: open ? 200 : 0, opacity: open ? 1 : 0, paddingBottom: open ? 20 : 0 }}>
        {a}
      </div>
    </div>
  );
};

const SectionHeader: React.FC<{ tag: string; tagIcon?: React.ReactNode; tagGold?: boolean; title: React.ReactNode; sub?: string; center?: boolean }> = ({ tag, tagIcon, tagGold, title, sub, center = true }) => (
  <div style={{ textAlign: center ? 'center' : 'left', marginBottom: 52 }}>
    <div className={tagGold ? 'l-tag-gold' : 'l-tag'} style={{ marginBottom: 16, display: 'inline-flex' }}>
      {tagIcon}{tag}
    </div>
    <h2 style={{
      fontFamily: "'Cormorant Garamond',Georgia,serif",
      fontSize: 'clamp(30px,4vw,50px)', fontWeight: 700,
      letterSpacing: '-0.01em', lineHeight: 1.1,
      margin: '0 0 16px', color: T.text,
    }}>
      {title}
    </h2>
    {sub && <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: T.muted, fontSize: 16, margin: '0 auto', maxWidth: 500, lineHeight: 1.8, fontWeight: 400 }}>{sub}</p>}
  </div>
);

/* ─── Search widget ───────────────────────────────── */
const PRODUCT_TABS = [
  { id: 'hotel',   label: 'Hotel',  icon: Hotel },
  { id: 'ticket',  label: 'Tiket',  icon: PlaneTakeoff },
  { id: 'visa',    label: 'Visa',   icon: FileCheck },
  { id: 'bus',     label: 'Bus',    icon: Bus },
  { id: 'package', label: 'Paket',  icon: Package },
] as const;
type ProductTabId = typeof PRODUCT_TABS[number]['id'];
const BANDARA_FALLBACK = [
  { code: 'CGK', name: 'Jakarta' }, { code: 'SBY', name: 'Surabaya' },
  { code: 'BTH', name: 'Batam' },  { code: 'UPG', name: 'Makassar' },
];
interface SearchWidgetProps {
  searchData: { products: { id: string; name: string; type: string; meta?: Record<string, unknown> }[]; byType: Record<string, { id: string; name: string; type: string }[]>; bandara: { code: string; name: string }[]; } | null;
  onSearch: (params: Record<string, string>) => void;
}
const LandingSearchWidget: React.FC<SearchWidgetProps> = ({ searchData, onSearch }) => {
  const [activeTab, setActiveTab] = useState<ProductTabId>('hotel');
  const [hotel, setHotel] = useState({ destination: '', checkIn: '', checkOut: '', guests: '2', rooms: '1', freeBreakfast: false, freeCancel: false, star4: false, score8: false });
  const [ticket, setTicket] = useState({ from: '', to: '', date: '' });
  const [visa, setVisa] = useState({ destination: 'Visa Saudi', date: '' });
  const [bus, setBus] = useState({ route: '', date: '' });
  const [pkg, setPkg] = useState({ destination: '', date: '' });
  const bandara = searchData?.bandara?.length ? searchData.bandara : BANDARA_FALLBACK;
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = { product: activeTab };
    if (activeTab === 'hotel') { if (hotel.destination) params.destination = hotel.destination; if (hotel.checkIn) params.checkin = hotel.checkIn; if (hotel.checkOut) params.checkout = hotel.checkOut; if (hotel.guests) params.guests = hotel.guests; if (hotel.rooms) params.rooms = hotel.rooms; }
    else if (activeTab === 'ticket') { if (ticket.from) params.from = ticket.from; if (ticket.to) params.to = ticket.to; if (ticket.date) params.date = ticket.date; }
    else if (activeTab === 'visa') { if (visa.destination) params.destination = visa.destination; if (visa.date) params.date = visa.date; }
    else if (activeTab === 'bus') { if (bus.route) params.route = bus.route; if (bus.date) params.date = bus.date; }
    else if (activeTab === 'package') { if (pkg.destination) params.destination = pkg.destination; if (pkg.date) params.date = pkg.date; }
    onSearch(params);
  };
  const Field = ({ label, children, fullWidth }: { label: string; children: React.ReactNode; fullWidth?: boolean }) => (
    <div className="l-search-field" style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <span className="l-search-label">{label}</span>
      {children}
    </div>
  );
  const InputIcon = ({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ComponentType<Record<string, unknown>> }) => (
    <div className="l-search-field-wrap">
      {Icon && <Icon size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.dim, pointerEvents: 'none' }} />}
      <input className={`l-search-input ${Icon ? '' : 'no-icon'}`} style={{ height: 42 }} {...props} />
    </div>
  );
  return (
    <div className="l-search-box l-float">
      <div className="l-search-tabs">
        {PRODUCT_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)} className={`l-search-tab ${activeTab === id ? 'active' : ''}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="l-search-form">
        {activeTab === 'hotel' && (
          <>
            <div className="l-search-row" style={{ marginBottom: 14 }}>
              <Field label="Destinasi" fullWidth>
                <InputIcon icon={Search} type="text" placeholder="Kota, Mekkah, Madinah, atau nama hotel..." value={hotel.destination} onChange={e => setHotel(h => ({ ...h, destination: e.target.value }))} />
              </Field>
            </div>
            <div className="l-search-row" style={{ marginBottom: 14 }}>
              <Field label="Check-in"><InputIcon icon={Calendar} type="date" value={hotel.checkIn} onChange={e => setHotel(h => ({ ...h, checkIn: e.target.value }))} /></Field>
              <Field label="Check-out"><input className="l-search-input no-icon" type="date" value={hotel.checkOut} onChange={e => setHotel(h => ({ ...h, checkOut: e.target.value }))} style={{ height: 42 }} /></Field>
              <Field label="Tamu & Kamar">
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <input className="l-search-input no-icon" type="number" min={1} max={20} value={hotel.guests} onChange={e => setHotel(h => ({ ...h, guests: e.target.value }))} style={{ height: 42, flex: 1 }} />
                    <span style={{ fontSize: 12, color: T.dim, flexShrink: 0 }}>tamu</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <input className="l-search-input no-icon" type="number" min={1} max={10} value={hotel.rooms} onChange={e => setHotel(h => ({ ...h, rooms: e.target.value }))} style={{ height: 42, flex: 1 }} />
                    <span style={{ fontSize: 12, color: T.dim, flexShrink: 0 }}>kamar</span>
                  </div>
                </div>
              </Field>
            </div>
            <div className="l-search-chips">
              {[{ key: 'freeBreakfast', label: 'Sarapan gratis', icon: UtensilsCrossed }, { key: 'freeCancel', label: 'Bebas batal' }, { key: 'star4', label: 'Bintang 4+', icon: Star }, { key: 'score8', label: 'Skor 8+' }].map(({ key, label, icon: C }) => (
                <button key={key} type="button" onClick={() => setHotel(h => ({ ...h, [key]: !(h as Record<string, unknown>)[key] }))} className={`l-search-chip ${(hotel as Record<string, unknown>)[key] ? 'active' : ''}`}>
                  {C && <C size={13} />}{label}
                </button>
              ))}
            </div>
          </>
        )}
        {activeTab === 'ticket' && (
          <div className="l-search-row">
            <Field label="Bandara Asal">
              <select className="l-search-input no-icon" value={ticket.from} onChange={e => setTicket(t => ({ ...t, from: e.target.value }))} style={{ height: 42 }}>
                <option value="">Pilih bandara</option>
                {bandara.map(b => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
              </select>
            </Field>
            <Field label="Bandara Tujuan">
              <select className="l-search-input no-icon" value={ticket.to} onChange={e => setTicket(t => ({ ...t, to: e.target.value }))} style={{ height: 42 }}>
                <option value="">Pilih bandara</option>
                {bandara.map(b => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
              </select>
            </Field>
            <Field label="Tanggal"><input className="l-search-input no-icon" type="date" value={ticket.date} onChange={e => setTicket(t => ({ ...t, date: e.target.value }))} style={{ height: 42 }} /></Field>
          </div>
        )}
        {activeTab === 'visa' && (
          <div className="l-search-row">
            <Field label="Tujuan / Jenis Visa"><input className="l-search-input no-icon" type="text" placeholder="Visa Saudi, Visa Schengen..." value={visa.destination} onChange={e => setVisa(v => ({ ...v, destination: e.target.value }))} style={{ height: 42 }} /></Field>
            <Field label="Tanggal Perjalanan"><input className="l-search-input no-icon" type="date" value={visa.date} onChange={e => setVisa(v => ({ ...v, date: e.target.value }))} style={{ height: 42 }} /></Field>
          </div>
        )}
        {activeTab === 'bus' && (
          <div className="l-search-row">
            <Field label="Rute" fullWidth><input className="l-search-input no-icon" type="text" placeholder="Jeddah – Mekkah, Bandara – Hotel..." value={bus.route} onChange={e => setBus(b => ({ ...b, route: e.target.value }))} style={{ height: 42 }} /></Field>
            <Field label="Tanggal"><input className="l-search-input no-icon" type="date" value={bus.date} onChange={e => setBus(b => ({ ...b, date: e.target.value }))} style={{ height: 42 }} /></Field>
          </div>
        )}
        {activeTab === 'package' && (
          <div className="l-search-row">
            <Field label="Paket / Destinasi"><input className="l-search-input no-icon" type="text" placeholder="Paket Umrah Reguler, Wisata Halal..." value={pkg.destination} onChange={e => setPkg(p => ({ ...p, destination: e.target.value }))} style={{ height: 42 }} /></Field>
            <Field label="Tanggal"><input className="l-search-input no-icon" type="date" value={pkg.date} onChange={e => setPkg(p => ({ ...p, date: e.target.value }))} style={{ height: 42 }} /></Field>
          </div>
        )}
        <div className="l-search-submit">
          <button type="submit" className="l-btn-primary"><span className="shine" /><Search size={16} /> Cari Sekarang</button>
        </div>
      </form>
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
  const [contactSent, setContactSent] = useState(false);
  const [searchData, setSearchData]   = useState<SearchWidgetProps['searchData']>(null);
  const injected = useRef(false);

  useEffect(() => {
    publicApi.getProductsForSearch()
      .then(res => res.data?.data && setSearchData({ products: res.data.data.products, byType: res.data.data.byType || {}, bandara: res.data.data.bandara || [] }))
      .catch(() => setSearchData({ products: [], byType: {}, bandara: BANDARA_FALLBACK }));
  }, []);

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
    const h = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('l-visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

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
    navigate(`/register?${new URLSearchParams(params).toString()}`);
  };

  if (!isLoading && isAuthenticated) return null;

  const S = { maxWidth: 1260, margin: '0 auto' };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, overflowX: 'hidden', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>

      {/* ══════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════ */}
      <nav className="l-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: scrolled ? 'rgba(250,250,247,0.97)' : 'rgba(250,250,247,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: scrolled ? `1px solid ${T.border}` : '1px solid transparent',
        boxShadow: scrolled ? '0 2px 20px rgba(27,77,62,0.06)' : 'none',
        transition: 'all .3s ease',
      }}>
        <div className="l-container" style={{ ...S, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <img src={logo} alt="Bintang Global" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.1, color: T.green, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Bintang Global</div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: T.gold, textTransform: 'uppercase', lineHeight: 1.5 }}>Umroh & Travel</div>
            </div>
          </div>

          {/* Desktop links */}
          <div className="l-hide-mob" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {NAV_LINKS.map(l => <button key={l.id} className="l-nav-link" onClick={() => scrollTo(l.id)}>{l.label}</button>)}
          </div>

          {/* Auth */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/login" className="l-btn-outline l-hide-mob" style={{ padding: '8px 18px', fontSize: 13 }}>Masuk</Link>
            <Link to="/register" className="l-btn-primary" style={{ padding: '9px 18px', fontSize: 13 }}>
              <span className="shine" />
              <span className="l-hide-mob">Daftar Partner</span>
              <span className="l-show-mob">Daftar</span>
              <ArrowRight size={13} />
            </Link>
            <button type="button" onClick={() => setMobileOpen(v => !v)} className="l-show-mob" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text, padding: 4, alignItems: 'center', justifyContent: 'center' }}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ background: 'rgba(250,250,247,0.99)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${T.border}`, padding: '12px 20px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {NAV_LINKS.map(l => (
                <button key={l.id} className="l-nav-link" onClick={() => scrollTo(l.id)} style={{ padding: '11px 0', textAlign: 'left', borderBottom: `1px solid ${T.border}` }}>{l.label}</button>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <Link to="/login" className="l-btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMobileOpen(false)}>Masuk</Link>
                <Link to="/register" className="l-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMobileOpen(false)}>
                  <span className="shine" />Daftar Partner
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="l-hero-section l-section" style={{ paddingTop: 110, paddingBottom: 70, minHeight: '92vh', display: 'flex', alignItems: 'center' }}>
        <div className="l-container l-hero-grid" style={{ ...S, width: '100%' }}>

          {/* LEFT: Text */}
          <div className="l-hero-left" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>

            {/* Announcement pill */}
            <div className="l-fu l-fu-0" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 12px 5px 6px', borderRadius: 100, marginBottom: 24,
              background: T.goldPale, border: `1px solid #E8C87A`,
            }}>
              <span style={{ background: T.gold, borderRadius: 100, padding: '2px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: 'white' }}>BARU</span>
              <span style={{ fontSize: 11, color: T.gold, fontWeight: 600 }}>Dashboard v3.0 — Analitik Real-time & Invoice Otomatis</span>
              <ArrowRight size={11} color={T.gold} style={{ flexShrink: 0 }} />
            </div>

            {/* Headline */}
            <h1 className="l-fu l-fu-1" style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontSize: 'clamp(36px,4.5vw,68px)', fontWeight: 700,
              lineHeight: 1.05, letterSpacing: '-0.015em',
              margin: '0 0 20px', color: T.text,
            }}>
              Satu Platform untuk{' '}
              <span className="l-gold-text">Semua Perjalanan</span>
              <br />
              <span style={{ color: T.green }}>Umroh & Haji</span>
            </h1>

            {/* Sub */}
            <p className="l-fu l-fu-2" style={{ fontSize: 'clamp(14px,1.1vw,16px)', color: T.muted, lineHeight: 1.8, margin: '0 0 20px', maxWidth: 480 }}>
              Hotel · Visa · Tiket · Bus · Paket Umrah dan Haji. Satu ekosistem terintegrasi untuk partner travel dan agen umrah terpercaya di seluruh Indonesia.
            </p>

            {/* Feature pills */}
            <div className="l-fu l-fu-2 l-hero-pills" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 26 }}>
              {[
                { icon: Hotel,     label: 'Hotel',  bg: T.goldPale,   color: T.gold },
                { icon: FileCheck, label: 'Visa',   bg: T.greenPale,  color: T.green },
                { icon: Ticket,    label: 'Tiket',  bg: T.greenLt,    color: '#2D6A58' },
                { icon: Bus,       label: 'Bus',    bg: '#FDF4E7',    color: '#7C5A1E' },
                { icon: Package,   label: 'Paket',  bg: T.goldPale,   color: T.goldWarm },
              ].map(({ icon: Icon, label, bg, color }) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: bg, border: `1px solid ${color}30`, color }}>
                  <Icon size={11} /> {label}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="l-fu l-fu-3 l-hero-cta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
              <Link to="/register" className="l-btn-primary" style={{ fontSize: 14 }}>
                <span className="shine" />
                <Sparkles size={15} /> Daftar Gratis Sekarang
              </Link>
              <Link to="/login" className="l-btn-outline" style={{ fontSize: 14 }}>
                Masuk ke Dashboard
              </Link>
            </div>

            {/* Social proof */}
            <div className="l-fu l-fu-4 l-hero-social" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex' }}>
                  {['AF', 'SR', 'HG', 'MR', 'DK'].map((a, i) => (
                    <div key={a} style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${150 + i * 20},45%,42%)`, border: '2px solid white', marginLeft: i ? -7 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'white', flexShrink: 0 }}>{a}</div>
                  ))}
                </div>
                <div>
                  <div style={{ display: 'flex', gap: 1 }}>
                    {[...Array(5)].map((_, i) => <Star key={i} size={10} fill={T.gold} color={T.gold} />)}
                  </div>
                  <div style={{ fontSize: 10, color: T.dim, marginTop: 1 }}>500+ partner aktif</div>
                </div>
              </div>
              <div style={{ width: 1, height: 28, background: T.border }} />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {['🔒 SSL', '✓ POJK', '⚡ ISO 27001'].map(b => (
                  <span key={b} style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>{b}</span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Search widget */}
          <div className="l-fu l-fu-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 500 }}>
              <LandingSearchWidget searchData={searchData} onSearch={handleSearchSubmit} />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TICKER
      ══════════════════════════════════════ */}
      <div style={{ background: T.green, padding: '13px 0', overflow: 'hidden', borderTop: `3px solid ${T.gold}` }}>
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div className="ticker-track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} style={{ padding: '0 24px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', borderRight: '1px solid rgba(255,255,255,0.18)', display: 'inline-flex', alignItems: 'center' }}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          SERVICES
      ══════════════════════════════════════ */}
      <section id="layanan" className="l-section" style={{ background: 'white' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div data-reveal style={{ opacity: 0 }}>
            <SectionHeader
              tag="Layanan Lengkap" tagIcon={<Layers size={11} />}
              title={<>Semua yang Anda Butuhkan,<br /><span className="l-green-text">Dalam Satu Tempat</span></>}
              sub="Ekosistem travel terintegrasi untuk memenuhi seluruh kebutuhan perjalanan umrah dan wisata halal."
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
            {SERVICES.map((svc, i) => {
              const Icon = svc.icon;
              return (
                <div key={svc.id} data-reveal className="l-card" style={{ padding: 26, opacity: 0, animationDelay: `${i * 0.08}s`, cursor: 'pointer' }} onClick={() => navigate('/register')}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, marginBottom: 18, background: svc.bg, border: `1px solid ${svc.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color={svc.accent} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 7px', color: T.text }}>{svc.label}</h3>
                  <p style={{ fontSize: 13, color: T.muted, margin: '0 0 16px', lineHeight: 1.65 }}>{svc.desc}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: svc.accent, fontWeight: 600 }}>
                    Lihat detail <ChevronRight size={13} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin: '0 24px' }} />

      {/* ══════════════════════════════════════
          PACKAGES
      ══════════════════════════════════════ */}
      <section id="paket" className="l-section" style={{ background: T.bg }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div data-reveal style={{ opacity: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 48 }}>
            <div style={{ textAlign: 'left' }}>
              <div className="l-tag-gold" style={{ marginBottom: 14, display: 'inline-flex' }}>
                <Star size={11} /> Paket Unggulan
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700, letterSpacing: '-0.01em', margin: 0, color: T.text }}>
                Pilihan Paket <span className="l-gold-text">Terbaik</span>
              </h2>
            </div>
            <button className="l-btn-outline" style={{ padding: '10px 20px', fontSize: 13 }}>
              Lihat Semua Paket <ArrowRight size={13} />
            </button>
          </div>

          <div className="l-packages-grid">
            {PACKAGES.map((pkg, i) => (
              <div key={i} data-reveal className={`l-card ${pkg.hot ? 'l-pkg-featured' : ''}`} style={{ opacity: 0, animationDelay: `${i * 0.1}s`, overflow: 'hidden' }}>
                {/* Color strip header */}
                <div style={{ height: 8, background: pkg.stripBg, width: '100%' }} />
                <div style={{ padding: '22px 24px 26px' }}>
                  {/* Badge row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: `${pkg.accentColor}12`, color: pkg.accentColor, border: `1px solid ${pkg.accentColor}30`, letterSpacing: '.06em' }}>
                      {pkg.badge}
                    </span>
                    {pkg.hot && (
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 9, fontWeight: 700, background: T.goldPale, color: T.gold, border: `1px solid ${T.gold}40`, letterSpacing: '.1em' }}>
                        BEST VALUE
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: T.text, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{pkg.title}</h3>
                  <p style={{ fontSize: 12, color: T.dim, margin: '0 0 18px' }}>{pkg.sub}</p>
                  <ul style={{ listStyle: 'none', margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pkg.features.map((f, j) => (
                      <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.textMd }}>
                        <CheckCircle size={13} color="#2D6A58" style={{ flexShrink: 0 }} /> {f}
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: pkg.hot ? T.gold : T.green, letterSpacing: '-0.02em' }}>{pkg.price}</div>
                      <div style={{ fontSize: 11, color: T.dim }}>{pkg.per}</div>
                    </div>
                    <button
                      className={pkg.hot ? 'l-btn-gold' : 'l-btn-primary'}
                      style={{ padding: '9px 18px', fontSize: 13 }}
                      onClick={() => navigate('/register')}
                    >
                      <span className="shine" />
                      Pesan <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin: '0 24px' }} />

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <section id="proses" className="l-section" style={{ background: T.bgCream }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div data-reveal style={{ opacity: 0 }}>
            <SectionHeader
              tag="Cara Kerja" tagIcon={<Navigation size={11} />}
              title={<>Mulai dalam <span className="l-green-text">4 Langkah</span> Mudah</>}
              sub="Proses bergabung yang sederhana, cepat, dan tanpa biaya apapun."
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 24, position: 'relative' }}>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} data-reveal style={{ opacity: 0, animationDelay: `${i * 0.12}s` }}>
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
                    <div style={{
                      width: 68, height: 68, borderRadius: 18,
                      background: 'white', border: `1px solid ${T.border}`,
                      boxShadow: `0 4px 16px ${T.shadow}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={26} color={T.green} />
                    </div>
                    <div style={{
                      position: 'absolute', top: -10, right: -10,
                      width: 26, height: 26, borderRadius: 8,
                      background: T.gold, boxShadow: `0 2px 8px rgba(184,131,42,0.4)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, color: 'white',
                    }}>
                      {step.num}
                    </div>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: T.text }}>{step.title}</h3>
                  <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                </div>
              );
            })}
          </div>
          <div data-reveal style={{ opacity: 0, textAlign: 'center', marginTop: 52 }}>
            <Link to="/register" className="l-btn-primary" style={{ fontSize: 15, padding: '14px 34px' }}>
              <span className="shine" />
              <Zap size={16} /> Mulai Daftar Sekarang — Gratis!
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          STATS
      ══════════════════════════════════════ */}
      <section className="l-section-sm" style={{ background: T.green }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="l-stats-grid">
            {STATS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="l-stat-card" style={{
                  textAlign: 'center', padding: '28px 16px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 16,
                }}>
                  <Icon size={18} color={T.goldWarm} style={{ marginBottom: 10 }} />
                  <div style={{
                    fontFamily: "'Cormorant Garamond',Georgia,serif",
                    fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em',
                    color: 'white', marginBottom: 8,
                  }}>
                    <Counter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: '.04em' }}>{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TENTANG / WHY US
      ══════════════════════════════════════ */}
      <section id="tentang" className="l-section" style={{ background: 'white' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="l-tentang-grid">
            {/* Left */}
            <div data-reveal style={{ opacity: 0 }}>
              <div className="l-tag" style={{ marginBottom: 18, display: 'inline-flex' }}><Shield size={11} /> Kenapa Kami</div>
              <h2 style={{
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700,
                letterSpacing: '-0.01em', lineHeight: 1.1, margin: '0 0 16px', color: T.text,
              }}>
                15 Tahun Membangun<br /><span className="l-green-text">Kepercayaan</span>
              </h2>
              <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.8, margin: '0 0 30px' }}>
                Bintang Global bukan sekadar platform teknologi — kami adalah mitra bisnis jangka panjang yang memahami kebutuhan agen travel dan umrah di seluruh Indonesia.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { icon: Shield,     color: T.green,    title: 'Terpercaya & Legal',       desc: 'Lisensi resmi Kemenag, IATA, dan POJK' },
                  { icon: Headphones, color: T.goldWarm, title: 'Support 24 Jam / 7 Hari',  desc: 'Tim dedicated siap membantu kapan saja' },
                  { icon: Zap,        color: T.green,    title: 'Teknologi Terdepan',        desc: 'Dashboard AI-powered dengan analitik cerdas' },
                  { icon: Globe,      color: T.gold,     title: 'Jaringan Global',           desc: 'Partner di 50+ kota & destinasi internasional' },
                ].map(({ icon: Icon, color, title, desc }, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: color === T.green ? T.greenLt : T.goldPale, border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={17} color={color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, color: T.text }}>{title}</div>
                      <div style={{ fontSize: 13, color: T.muted }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — activity feed */}
            <div data-reveal style={{ opacity: 0 }}>
              <div style={{
                background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: 22, padding: 26,
                boxShadow: `0 20px 60px ${T.shadow}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.textMd }}>Aktivitas Partner — Minggu Ini</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: T.green, background: T.greenLt, padding: '3px 10px', borderRadius: 100, border: `1px solid ${T.green}25` }}>● Live</span>
                </div>
                {[
                  { name: 'PT Cahaya Umrah',    status: 'Order Baru',      amount: '+Rp 12.5jt', color: T.green,    time: '5m lalu' },
                  { name: 'Madina Tour',         status: 'Visa Approved',   amount: '3 Jamaah',   color: '#2D6A58',  time: '18m lalu' },
                  { name: 'Firdaus Travel',      status: 'Pembayaran',      amount: '+Rp 8.2jt',  color: T.gold,     time: '1j lalu' },
                  { name: 'Al-Madinah Tour',     status: 'Order Baru',      amount: '+Rp 22.1jt', color: T.green,    time: '2j lalu' },
                  { name: 'Berkah Umrah',        status: 'Invoice Sent',    amount: '✓ Lunas',    color: T.goldWarm, time: '3j lalu' },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 0',
                    borderBottom: i < 4 ? `1px solid ${T.border}` : 'none',
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: item.color === T.green ? T.greenLt : T.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: item.color }}>
                      {item.name.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: T.dim }}>{item.status}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.amount}</div>
                      <div style={{ fontSize: 10, color: T.dim }}>{item.time}</div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 14, padding: '11px 14px', background: T.greenLt, borderRadius: 11, border: `1px solid ${T.green}20`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TrendingUp size={15} color={T.green} />
                  <span style={{ fontSize: 12, color: T.textMd }}>Total revenue minggu ini: </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.green, marginLeft: 'auto' }}>+Rp 42.8jt</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin: '0 24px' }} />

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section className="l-section" style={{ background: T.bgCream, overflow: 'hidden' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div data-reveal style={{ opacity: 0 }}>
            <SectionHeader
              tag="Testimoni" tagIcon={<Star size={11} />} tagGold
              title={<>Apa Kata <span className="l-gold-text">Partner Kami</span></>}
              sub="Bergabung bersama ratusan agen travel dan umrah yang telah merasakan manfaatnya."
            />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div className="l-testi-track" style={{ transform: `translateX(calc(-${testiIdx * (100 / 3)}%))` }}>
              {TESTIMONIALS.map((t, i) => (
                <div key={i} style={{
                  minWidth: 'calc(33.33% - 14px)', flexShrink: 0,
                  background: 'white', border: `1px solid ${T.border}`,
                  borderRadius: 16, padding: '26px 28px',
                  boxShadow: `0 4px 20px ${T.shadow}`,
                }}>
                  {/* Quote icon */}
                  <div style={{ fontSize: 36, color: T.gold, lineHeight: 1, marginBottom: 12, fontFamily: 'Georgia,serif', opacity: 0.6 }}>"</div>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                    {[...Array(t.rating)].map((_, j) => <Star key={j} size={13} fill={T.gold} color={T.gold} />)}
                  </div>
                  <p style={{ fontSize: 14, color: T.textMd, lineHeight: 1.8, margin: '0 0 20px' }}>{t.text}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'white', flexShrink: 0 }}>{t.avatar}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: T.dim }}>{t.role}</div>
                      <div style={{ fontSize: 11, color: T.green, marginTop: 1 }}>📍 {t.city}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 }}>
            {TESTIMONIALS.map((_, i) => (
              <button key={i} className="l-dot" onClick={() => setTestiIdx(i)}
                style={{ background: i === testiIdx ? T.green : T.border, width: i === testiIdx ? 24 : 8 }} />
            ))}
          </div>
        </div>
      </section>

      <div className="l-hr" style={{ margin: '0 24px' }} />

      {/* ══════════════════════════════════════
          FAQ
      ══════════════════════════════════════ */}
      <section id="faq" className="l-section" style={{ background: 'white' }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          <div data-reveal style={{ opacity: 0 }}>
            <SectionHeader
              tag="FAQ" tagIcon={<MessageCircle size={11} />}
              title={<>Pertanyaan yang <span className="l-green-text">Sering Ditanya</span></>}
              sub="Temukan jawaban atas pertanyaan umum seputar bergabung sebagai partner Bintang Global."
            />
          </div>
          <div data-reveal style={{ opacity: 0 }}>
            {FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} defaultOpen={i === 0} />)}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          KONTAK
      ══════════════════════════════════════ */}
      <section id="kontak" className="l-section" style={{ background: T.bg }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div data-reveal style={{ opacity: 0 }}>
            <SectionHeader
              tag="Kontak" tagIcon={<Phone size={11} />}
              title={<>Hubungi <span className="l-green-text">Tim Kami</span></>}
              sub="Butuh bantuan atau ingin diskusi kerja sama? Isi form atau hubungi melalui channel berikut."
            />
          </div>
          <div data-reveal style={{ opacity: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16, marginBottom: 44 }}>
            {[
              { icon: Phone,       label: 'Telepon',   value: '021-XXXX-XXXX',          desc: 'Senin–Sabtu, 08:00–17:00 WIB' },
              { icon: Mail,        label: 'Email',     value: 'partner@bintangglobal.id', desc: 'Balasan dalam 1×24 jam' },
              { icon: MessageCircle, label: 'WhatsApp', value: '08xx-xxxx-xxxx',         desc: 'Support cepat via chat' },
              { icon: Building2,   label: 'Kota',      value: '50+ kota',               desc: 'Seluruh Indonesia' },
            ].map(({ icon: Icon, label, value, desc }) => (
              <div key={label} style={{
                padding: 22, borderRadius: 14, border: `1px solid ${T.border}`, background: 'white',
                transition: 'border-color .2s, box-shadow .2s', cursor: 'default',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#C8D8D4'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${T.shadow}`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: T.greenLt, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon size={17} color={T.green} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: T.green, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 3 }}>{value}</div>
                <div style={{ fontSize: 12, color: T.dim }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* Contact Form */}
          <div data-reveal style={{ opacity: 0, maxWidth: 540, margin: '0 auto' }}>
            <div style={{ padding: 32, borderRadius: 20, border: `1px solid ${T.border}`, background: 'white', boxShadow: `0 16px 48px ${T.shadow}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 22, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Form Hubungi Kami</div>
              {contactSent ? (
                <div style={{ padding: 24, textAlign: 'center', color: T.green, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexDirection: 'column' }}>
                  <CheckCircle size={40} />
                  <span>Pesan Anda telah terkirim. Tim kami akan menghubungi dalam 1×24 jam.</span>
                  <button type="button" className="l-btn-outline" style={{ marginTop: 12 }} onClick={() => setContactSent(false)}>Kirim pesan lagi</button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 5 }}>Nama *</label>
                    <input type="text" required value={contactForm.nama} onChange={e => setContactForm(f => ({ ...f, nama: e.target.value }))} placeholder="Nama lengkap atau perusahaan"
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s' }}
                      onFocus={e => (e.currentTarget.style.borderColor = T.green)} onBlur={e => (e.currentTarget.style.borderColor = T.border)}
                    />
                  </div>
                  <div className="l-form-grid">
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 5 }}>Email *</label>
                      <input type="email" required value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="email@contoh.com"
                        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                        onFocus={e => (e.currentTarget.style.borderColor = T.green)} onBlur={e => (e.currentTarget.style.borderColor = T.border)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 5 }}>Telepon</label>
                      <input type="tel" value={contactForm.telepon} onChange={e => setContactForm(f => ({ ...f, telepon: e.target.value }))} placeholder="08xx-xxxx-xxxx"
                        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                        onFocus={e => (e.currentTarget.style.borderColor = T.green)} onBlur={e => (e.currentTarget.style.borderColor = T.border)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 5 }}>Pesan *</label>
                    <textarea required rows={4} value={contactForm.pesan} onChange={e => setContactForm(f => ({ ...f, pesan: e.target.value }))} placeholder="Tulis pesan atau pertanyaan Anda..."
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                      onFocus={e => (e.currentTarget.style.borderColor = T.green)} onBlur={e => (e.currentTarget.style.borderColor = T.border)}
                    />
                  </div>
                  <button type="submit" className="l-btn-primary" style={{ alignSelf: 'flex-start' }}>
                    <span className="shine" /> Kirim Pesan
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA SECTION
      ══════════════════════════════════════ */}
      <section className="l-cta-section l-section">
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div data-reveal style={{ opacity: 0 }}>
            <div className="l-tag-gold" style={{ marginBottom: 20, display: 'inline-flex', background: 'rgba(184,131,42,0.18)', borderColor: 'rgba(184,131,42,0.4)', color: '#DCA84A' }}>
              <Sparkles size={11} /> Bergabung Sekarang
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontSize: 'clamp(30px,5vw,56px)', fontWeight: 700,
              letterSpacing: '-0.015em', lineHeight: 1.1,
              color: 'white', margin: '0 0 16px',
            }}>
              Siap Tingkatkan Bisnis<br />
              <span style={{ color: '#DCA84A' }}>Travel Anda?</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, margin: '0 auto 40px', lineHeight: 1.7, maxWidth: 480 }}>
              Daftar gratis dalam 2 menit. Verifikasi instan. Akses penuh ke semua fitur platform.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register" className="l-btn-gold" style={{ fontSize: 15, padding: '15px 34px' }}>
                <span className="shine" />
                <Zap size={16} /> Daftar Partner — GRATIS
              </Link>
              <Link to="/login" className="l-btn-outline-gold" style={{ fontSize: 15, padding: '15px 30px', background: 'transparent', color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.25)' }}>
                Sudah punya akun?
              </Link>
            </div>
            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
              {['✓ Tanpa biaya pendaftaran', '✓ Verifikasi 24 jam', '✓ Komisi hingga 8%'].map(b => (
                <span key={b} style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer style={{ background: '#0F2A20', borderTop: `3px solid ${T.gold}`, padding: '56px 24px 32px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="l-footer-grid" style={{ marginBottom: 48 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <img src={logo} alt="Bintang Global" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'white', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Bintang Global</div>
                  <div style={{ fontSize: 9, color: T.gold, letterSpacing: '0.22em', textTransform: 'uppercase' }}>Umroh & Travel</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.75, margin: '0 0 20px', maxWidth: 240 }}>
                Platform travel dan umrah terintegrasi untuk partner dan jamaah di seluruh Indonesia.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                {[Instagram, Twitter, Youtube].map((Icon, i) => (
                  <button key={i} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.gold; (e.currentTarget as HTMLElement).style.background = 'rgba(184,131,42,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}>
                    <Icon size={14} color={T.gold} />
                  </button>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              { title: 'Platform', links: [['Layanan', '#layanan'], ['Paket Umrah', '#paket'], ['Cara Kerja', '#proses'], ['Tentang Kami', '#tentang']] },
              { title: 'Partner',  links: [['Daftar Partner', '/register'], ['Masuk Dashboard', '/login'], ['Kebijakan Privasi', '#'], ['Syarat & Ketentuan', '#']] },
              { title: 'Kontak',   links: [['021-XXXX-XXXX', '#'], ['partner@bintangglobal.id', '#'], ['Senin–Sabtu 08–17', '#'], ['Support 24/7', '#']] },
            ].map(({ title, links }) => (
              <div key={title}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: T.gold, textTransform: 'uppercase', marginBottom: 16 }}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(([label, href]) => (
                    <a key={label} href={href} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'color .2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 24 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
              © {new Date().getFullYear()} Bintang Global. All rights reserved.
            </span>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Kebijakan Privasi', 'Syarat & Ketentuan', 'Cookie'].map(l => (
                <a key={l} href="#" style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp FAB */}
      <button className="l-fab" title="Chat WhatsApp" onClick={() => window.open('https://wa.me/62', '_blank')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </button>

    </div>
  );
};

export default LandingPage;