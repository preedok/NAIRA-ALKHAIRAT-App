import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff, User, Phone,
  MessageCircle, AlertCircle, ArrowRight,
  ChevronLeft, Sparkles, MapPin, Building2
} from 'lucide-react';
import { authApi, publicApi } from '../../services/api';
import logo from '../../assets/nail-al-khairat-logo.svg'
/* ─── DESIGN TOKENS ─────────────────────────────────────────────── */
const C = {
  bg: '#0A0A0A',
  accent: '#C9A04B',
  accentHover: '#B38D3E',
  border: '#27272A',
  inputBg: 'rgba(24, 24, 27, 0.5)', // zinc-900/50
};

const COLORS = {
  bg: '#0A0A0A',
  bgSecondary: '#141414',
  accent: '#C9A04B', // Your specific Gold color
  accentHover: '#B38D3E',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  border: '#27272A',
};
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', whatsapp: '', password: '', branch_id: '' });
  const [branches, setBranches] = useState<
    Array<{
      id: string;
      name: string;
      Province?: { id: string; name: string } | null;
      Wilayah?: { id: string; name: string } | null;
    }>
  >([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    publicApi.getBranches()
      .then((res) => {
        const data = Array.isArray(res?.data?.data) ? res.data.data : [];
        setBranches(data);
      })
      .catch(() => setBranches([]));
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const selectedBranch = branches.find((b) => b.id === form.branch_id);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.whatsapp || !form.password || !form.branch_id) {
      setError('Mohon lengkapi semua field yang wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      await authApi.register(form);
      navigate(`/verify-otp?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registrasi gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-white font-sans antialiased" style={{ backgroundColor: C.bg }}>

      {/* ─── LEFT SIDE: VISUAL PANEL ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-zinc-900">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=1000"
            alt="Kaaba"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black via-black/90 to-transparent" />
        </div>

        <div className="relative z-10 w-full p-16 flex flex-col justify-between text-left">

          <div className="max-w-md">
            <div className="flex items-center gap-2 mb-9 mt-8">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" >
                <img src={logo} alt="" />
              </div>
              <span className="text-xl font-bold tracking-tight uppercase" style={{ color: COLORS.accent }}>Nail Al-Khairat</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tighter mb-6">
              Mulai Langkah <span style={{ color: C.accent }}>Ibadah Anda</span> dengan Teratur.
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed mb-10">
              Lengkapi data Anda untuk mengakses dashboard jamaah: kelola dokumen, pantau invoice, dan cek status keberangkatan secara real-time.
            </p>

            <div className="space-y-6">
              {[
                { icon: Building2, text: "Terhubung dengan 50+ cabang di Indonesia" },
                { icon: MapPin, text: "Sistem verifikasi dokumen instan" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 text-sm font-medium text-zinc-300">
                  <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
                    <item.icon size={16} style={{ color: C.accent }} />
                  </div>
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="w-4 h-1 rounded-full bg-zinc-800" />
            <div className="w-8 h-1 rounded-full" style={{ backgroundColor: C.accent }} />
            <div className="w-4 h-1 rounded-full bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* ─── RIGHT SIDE: REGISTRATION FORM ─── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 lg:p-20 overflow-y-auto">
        <div className="w-full max-w-xl text-left">
          {/* Mobile Logo Only */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">
              <img src={logo} alt="" />
            </div>
            <span className="text-xl font-bold tracking-tight uppercase">Nail Al-Khairat</span>
          </div>
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Daftar Akun Jamaah</h2>
            <p className="text-zinc-500">Silakan lengkapi data diri Anda untuk memulai proses umroh.</p>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in duration-300">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Grid for Name & Email */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">Nama Lengkap</label>
                <div className="relative group">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#C9A04B] transition-colors" />
                  <input
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    placeholder="Sesuai Identitas"
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-[#C9A04B] transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">Email</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#C9A04B] transition-colors" />
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder="nama@email.com"
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-[#C9A04B] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Branch Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">Pilih Cabang</label>
              <select
                name="branch_id"
                value={form.branch_id}
                onChange={onChange}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 px-4 outline-none focus:border-[#C9A04B] transition-all appearance-none cursor-pointer text-sm"
              >
                <option value="" className="bg-zinc-900">Pilih Cabang Terdekat</option>
                {branches.map((b) => <option key={b.id} value={b.id} className="bg-zinc-900">{b.name}</option>)}
              </select>
            </div>

            {/* Dynamic Province/Wilayah */}
            {form.branch_id && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4">
                  <div className="text-[9px] uppercase font-bold text-zinc-600 mb-1">Provinsi</div>
                  <div className="text-sm font-semibold text-zinc-400">{selectedBranch?.Province?.name || '—'}</div>
                </div>
                <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4">
                  <div className="text-[9px] uppercase font-bold text-zinc-600 mb-1">Wilayah</div>
                  <div className="text-sm font-semibold text-zinc-400">{selectedBranch?.Wilayah?.name || '—'}</div>
                </div>
              </div>
            )}

            {/* Grid for Phones */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">No HP</label>
                <div className="relative group">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#C9A04B] transition-colors" />
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={onChange}
                    placeholder="08xxxxxxxxxx"
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-[#C9A04B] transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">No WhatsApp</label>
                <div className="relative group">
                  <MessageCircle size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#C9A04B] transition-colors" />
                  <input
                    name="whatsapp"
                    value={form.whatsapp}
                    onChange={onChange}
                    placeholder="08xxxxxxxxxx"
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-[#C9A04B] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">Buat Password</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#C9A04B] transition-colors" />
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={onChange}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-12 outline-none focus:border-[#C9A04B] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-600 hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-4 rounded-2xl font-bold text-black flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(201,160,75,0.2)]"
              style={{ backgroundColor: C.accent }}
            >
              {loading ? "Memproses Data..." : (
                <>Daftar Akun Sekarang <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <p className="text-center mt-8 text-zinc-500 text-sm">
            Sudah memiliki akun? {' '}
            <Link to="/login" style={{ color: C.accent }} className="font-bold hover:underline">
              Masuk di sini →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;