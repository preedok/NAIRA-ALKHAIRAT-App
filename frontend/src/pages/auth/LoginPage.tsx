import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff, AlertCircle,
  ArrowRight, CheckCircle, ChevronLeft, Sparkles,
  ShieldCheck, Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { validateEmail } from '../../utils';
import logo from '../../assets/nail-al-khairat-logo.svg'
/* ─── TYPES FOR GOOGLE IDENTITY SERVICES ────────────────────────── */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              width?: number | string;
            }
          ) => void;
        };
      };
    };
  }
}

/* ─── DESIGN TOKENS ─────────────────────────────────────────────── */
const C = {
  bg: '#0A0A0A',
  accent: '#C9A04B',
  accentHover: '#B38D3E',
  border: '#27272A',
};

const GOOGLE_SCRIPT_ID = 'google-identity-services';
const COLORS = {
  bg: '#0A0A0A',
  bgSecondary: '#141414',
  accent: '#C9A04B', // Your specific Gold color
  accentHover: '#B38D3E',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  border: '#27272A',
};
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, googleLogin } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleLoginRef = useRef(googleLogin);
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

  useEffect(() => {
    googleLoginRef.current = googleLogin;
  }, [googleLogin]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bgg_login_remember_email');
      if (saved) {
        setFormData((p) => ({ ...p, email: saved }));
        setRemember(true);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const initializeGoogle = () => {
      if (!window.google || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            setError('Gagal mengambil kredensial Google');
            return;
          }
          setError('');
          setGoogleLoading(true);
          const result = await googleLoginRef.current(response.credential);
          setGoogleLoading(false);
          if (result.success) {
            setSuccess(true);
            setTimeout(() => navigate('/dashboard'), 900);
          } else {
            setError(result.message || 'Login Google gagal');
          }
        }
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: googleButtonRef.current.offsetWidth
      });
    };

    if (window.google) {
      initializeGoogle();
      return;
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = GOOGLE_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.onload = initializeGoogle;
  }, [googleClientId, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.email || !formData.password) {
      setError('Email dan password harus diisi');
      return;
    }
    const emailErr = validateEmail(formData.email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    setLoading(true);
    try {
      const result = await login(formData);
      if (result.success) {
        try {
          if (remember) localStorage.setItem('bgg_login_remember_email', formData.email.trim().toLowerCase());
          else localStorage.removeItem('bgg_login_remember_email');
        } catch { /* ignore */ }
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 900);
      } else setError(result.message || 'Email atau password salah');
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-white font-sans antialiased" style={{ backgroundColor: C.bg }}>

      {/* ─── LEFT SIDE ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-zinc-900">
        <div className="absolute inset-0 z-0 text-left">
          <img
            src="https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=1000"
            alt="Kaaba"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black via-black/80 to-transparent" />
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
              Ibadah Umroh <span style={{ color: C.accent }}>Lebih Tenang</span> & Terorganisir.
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed mb-10">
              Kelola pendaftaran, pantau pembayaran, dan update jadwal keberangkatan dalam satu platform terpadu.
            </p>

            <div className="space-y-5">
              {[
                { icon: ShieldCheck, text: "Data jamaah terenkripsi & aman" },
                { icon: Globe, text: "Update Keberangkatan secara real-time" }
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
            <div className="w-8 h-1 rounded-full" style={{ backgroundColor: C.accent }} />
            <div className="w-4 h-1 rounded-full bg-zinc-800" />
            <div className="w-4 h-1 rounded-full bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* ─── RIGHT SIDE ─── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md text-left">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">
              <img src={logo} alt="" />
            </div>
            <span className="text-xl font-bold tracking-tight uppercase">Nail Al-Khairat</span>
          </div>
          <div className="mb-10">
            <h2 className="text-4xl font-bold tracking-tight mb-3">Masuk ke akun</h2>
            <p className="text-zinc-500">Selamat datang kembali. Masuk dengan email Anda.</p>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-500 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-[#C9A04B] transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="nama@perusahaan.com"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 outline-none focus:border-[#C9A04B] transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end px-1">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-500">Password</label>
                <Link to="/forgot-password" style={{ color: C.accent }} className="text-xs font-bold hover:underline transition-all">Lupa Password?</Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-[#C9A04B] transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-zinc-700 outline-none focus:border-[#C9A04B] transition-all"
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

            <label className="flex items-center gap-3 cursor-pointer group w-fit select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <div className="h-5 w-5 rounded-md border border-zinc-800 bg-zinc-900 transition-all peer-checked:bg-[#C9A04B] peer-checked:border-[#C9A04B]" />
                <CheckCircle className="absolute left-1 top-1 h-3 w-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">Ingat saya</span>
            </label>

            <button
              type="submit"
              disabled={loading || success}
              style={{ backgroundColor: C.accent }}
              className="w-full py-4 rounded-2xl font-bold text-black flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 shadow-[0_8px_30px_rgba(201,160,75,0.2)]"
            >
              {loading ? "Memverifikasi..." : success ? (
                <><CheckCircle size={18} /> Berhasil! Mengalihkan...</>
              ) : (
                <><span className="mt-0.5">Masuk Sekarang</span> <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-bold">
              <span className="bg-[#0A0A0A] px-4 text-zinc-600">Atau masuk dengan</span>
            </div>
          </div>

          <div className="w-full min-h-[44px]">
            {!googleClientId ? (
              <button className="w-full py-4 border border-zinc-800 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-900 transition-colors">
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                Masuk dengan Google
              </button>
            ) : (
              <div ref={googleButtonRef} className={`w-full ${googleLoading ? 'opacity-50 pointer-events-none' : ''}`} />
            )}
          </div>

          <p className="text-center text-sm text-zinc-500 mt-10">
            Belum punya akun?{' '}
            <Link to="/register" style={{ color: C.accent }} className="font-bold hover:underline transition-all">
              Daftar Jamaah Gratis →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;