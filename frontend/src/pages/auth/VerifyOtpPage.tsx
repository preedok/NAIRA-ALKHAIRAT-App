import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Mail, ShieldCheck, RefreshCcw, AlertCircle, 
  ArrowRight, ChevronLeft, Sparkles, Lock, 
  CheckCircle 
} from 'lucide-react';
import { authApi } from '../../services/api';

/* ─── DESIGN TOKENS ─────────────────────────────────────────────── */
const C = {
  bg: '#0A0A0A',
  accent: '#C9A04B',
  accentHover: '#B38D3E',
  border: '#27272A',
};

const VerifyOtpPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [info, setInfo] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await authApi.verifyOtp(email.trim().toLowerCase(), otpCode.trim());
      const token = res.data?.data?.token;
      if (token) {
        localStorage.setItem('bintang_global_token', token);
        navigate('/dashboard');
        return;
      }
      setError('Verifikasi OTP gagal');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verifikasi OTP gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setInfo('');
    try {
      const res = await authApi.resendOtp(email.trim().toLowerCase());
      setInfo(res.data?.message || 'OTP berhasil dikirim ulang ke email Anda.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal kirim ulang OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex text-white font-sans antialiased" style={{ backgroundColor: C.bg }}>
      
      {/* ─── LEFT SIDE: VISUAL PANEL ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-zinc-900">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1542661960-264639999052?auto=format&fit=crop&q=80&w=1920" 
            alt="Security Visualization" 
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black via-black/80 to-transparent" />
        </div>

        <div className="relative z-10 w-full p-16 flex flex-col justify-between text-left">
          <Link to="/" className="flex items-center gap-2 group text-white/60 hover:text-white transition-colors w-fit">
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium tracking-wide">Kembali ke Beranda</span>
          </Link>

          <div className="max-w-md">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-8 shadow-lg" style={{ backgroundColor: C.accent }}>
              <Lock className="text-black" size={24} />
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tighter mb-6">
              Verifikasi <span style={{ color: C.accent }}>Keamanan</span> Akun Anda.
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed mb-10">
              Satu langkah lagi untuk mengaktifkan akses penuh ke dashboard jamaah Nail Al-Khairat. Masukkan kode 6-digit yang kami kirimkan.
            </p>

            <div className="space-y-5">
              {[
                { icon: ShieldCheck, text: "Aktivasi akun instan & aman" },
                { icon: Sparkles, text: "Akses langsung ke katalog paket umroh" }
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
            <div className="w-4 h-1 rounded-full bg-zinc-800" />
            <div className="w-8 h-1 rounded-full" style={{ backgroundColor: C.accent }} />
          </div>
        </div>
      </div>

      {/* ─── RIGHT SIDE: VERIFICATION FORM ─── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md text-left">
          {/* Mobile Logo Only */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: C.accent }}>
              <span className="text-black font-black text-xl">N</span>
            </div>
            <span className="text-xl font-bold tracking-tight uppercase">Nail Al-Khairat</span>
          </div>

          <div className="mb-10">
            <h2 className="text-4xl font-bold tracking-tight mb-3">Verifikasi OTP</h2>
            <p className="text-zinc-500">Masukkan 6 digit kode unik yang telah dikirimkan ke alamat email Anda.</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info/Success Banner */}
          {info && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm animate-in fade-in slide-in-from-top-2">
              <CheckCircle size={18} className="shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-500 ml-1">Konfirmasi Email</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#C9A04B] transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 outline-none focus:border-[#C9A04B] transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-500 ml-1">Kode OTP 6-Digit</label>
              <div className="relative group">
                <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#C9A04B] transition-colors" />
                <input 
                  type="text" 
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="0 0 0 0 0 0"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 outline-none focus:border-[#C9A04B] transition-all text-center text-xl font-mono tracking-[0.5em]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-black flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(201,160,75,0.2)]"
              style={{ backgroundColor: C.accent }}
            >
              {loading ? "Memverifikasi..." : (
                <>Verifikasi Akun Sekarang <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          {/* Resend Action */}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full mt-4 border border-zinc-800 rounded-2xl py-4 text-sm font-bold flex items-center justify-center gap-3 hover:bg-zinc-900 transition-colors disabled:opacity-50"
          >
            <RefreshCcw size={18} className={`${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Mengirim Ulang...' : 'Kirim Ulang Kode OTP'}
          </button>

          <p className="text-center text-sm text-zinc-500 mt-10">
            Sudah memiliki akun terverifikasi?{' '}
            <Link to="/login" style={{ color: C.accent }} className="font-bold hover:underline transition-all">
              Masuk di sini →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtpPage;