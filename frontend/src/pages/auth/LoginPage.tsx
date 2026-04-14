import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { validateEmail } from '../../utils';
import Input from '../../components/common/Input';
import { checkboxClass } from '../../components/common/formStyles';
import { AuthSplitLayout, AuthBrandLogoRow } from './AuthSplitLayout';

const PRIMARY = '#C9A04B';
const GOOGLE_SCRIPT_ID = 'google-identity-services';

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
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const initializeGoogle = () => {
      if (!window.google || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
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
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: '100%'
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
        } catch {
          /* ignore */
        }
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 900);
      } else setError(result.message || 'Email atau password salah');
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleFallbackClick = () => {
    setError('Login Google belum dikonfigurasi. Silakan hubungi admin untuk mengisi Google Client ID.');
  };

  return (
    <AuthSplitLayout
      panelTitle="Wujudkan perjalanan ibadah umroh yang lebih tenang."
      panelSubtitle="Satu aplikasi untuk pilih paket, kelola pendaftaran, pantau invoice, dan update jadwal keberangkatan jamaah secara mudah."
      panelFooterLink={{ to: '/register', label: 'Daftar sebagai jamaah →' }}
    >
      <AuthBrandLogoRow />

      <h1 className="text-2xl sm:text-[1.65rem] font-bold text-slate-900 tracking-tight">Masuk ke akun</h1>
      <p className="text-sm text-slate-500 mt-1.5 mb-6">Selamat datang kembali. Masuk dengan email dan password Anda.</p>

      {error && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-4 text-sm text-red-700 bg-red-50 border border-red-100"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4 mt-2">
        <Input
          name="email"
          type="email"
          label="Email"
          value={formData.email}
          onChange={handleChange}
          icon={<Mail className="w-4 h-4 shrink-0 text-slate-400" />}
          placeholder="nama@perusahaan.com"
          autoComplete="email"
          error={undefined}
        />
        <Input
          name="password"
          type={showPass ? 'text' : 'password'}
          label="Password"
          value={formData.password}
          onChange={handleChange}
          icon={<Lock className="w-4 h-4 shrink-0 text-slate-400" />}
          placeholder="••••••••"
          autoComplete="current-password"
          error={undefined}
          suffix={
            <button
              type="button"
              onClick={() => setShowPass((p) => !p)}
              aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />

        <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm text-slate-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className={checkboxClass}
          />
          Ingat saya
        </label>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99]"
          style={{ backgroundColor: PRIMARY, boxShadow: '0 8px 24px rgba(183,135,52,0.28)' }}
        >
          {loading ? (
            'Memverifikasi…'
          ) : success ? (
            <span className="inline-flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Berhasil! Mengalihkan…
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              Masuk
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-stone-200" />
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">atau</span>
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      {!googleClientId ? (
        <button
          type="button"
          onClick={handleGoogleFallbackClick}
          className="w-full h-11 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 transition-colors px-4 flex items-center justify-center gap-2.5 text-sm font-semibold text-stone-700"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.195 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.84 1.154 7.955 3.045l5.657-5.657C34.046 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.84 1.154 7.955 3.045l5.657-5.657C34.046 6.053 29.27 4 24 4c-7.682 0-14.41 4.337-17.694 10.691z" />
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.149 35.091 26.715 36 24 36c-5.176 0-9.625-3.327-11.283-7.946l-6.522 5.025C9.438 39.556 16.618 44 24 44z" />
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.084 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
          </svg>
          Masuk dengan Google
        </button>
      ) : (
        <div className={`${googleLoading || loading ? 'opacity-60 pointer-events-none' : ''}`}>
          <div ref={googleButtonRef} className="w-full min-h-[44px]" />
        </div>
      )}

      <p className="text-center text-sm text-slate-600 mt-8">
        Belum punya akun?{' '}
        <Link to="/register" className="font-semibold hover:underline" style={{ color: PRIMARY }}>
          Buat akun
        </Link>
      </p>
    </AuthSplitLayout>
  );
};

export default LoginPage;
