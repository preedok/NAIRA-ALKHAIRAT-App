import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { validateEmail } from '../../utils';
import Input from '../../components/common/Input';
import { checkboxClass } from '../../components/common/formStyles';
import { AuthSplitLayout, AuthBrandLogoRow } from './AuthSplitLayout';

const PRIMARY = '#0D1A63';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="w-5 h-5 shrink-0 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

  const socialBtnClass =
    'flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-white';

  return (
    <AuthSplitLayout
      panelTitle="Terhubung dengan layanan mitra Anda."
      panelSubtitle="Satu dasbor untuk order, invoice, visa, tiket, hotel, dan paket umroh — mudah disesuaikan kebutuhan travel Anda."
      panelFooterLink={{ to: '/register-owner-type', label: 'Daftar sebagai partner →' }}
    >
      <AuthBrandLogoRow />

      <h1 className="text-2xl sm:text-[1.65rem] font-bold text-slate-900 tracking-tight">Masuk ke akun</h1>
      <p className="text-sm text-slate-500 mt-1.5">Selamat datang kembali! Pilih metode masuk:</p>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <button type="button" className={socialBtnClass} disabled title="Segera hadir">
          <GoogleIcon />
          Google
        </button>
        <button type="button" className={socialBtnClass} disabled title="Segera hadir">
          <FacebookIcon />
          Facebook
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Login mitra saat ini hanya melalui email & password.</p>

      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-slate-500 font-medium">atau lanjutkan dengan email</span>
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-4 text-sm text-red-700 bg-red-50 border border-red-100"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          name="email"
          type="email"
          label="Email"
          value={formData.email}
          onChange={handleChange}
          icon={<Mail className="w-4 h-4 text-slate-400" />}
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
          icon={<Lock className="w-4 h-4 text-slate-400" />}
          placeholder="••••••••"
          autoComplete="current-password"
          error={undefined}
          rightLabel={
            <Link to="/forgot-password" className="text-xs font-semibold hover:underline" style={{ color: PRIMARY }}>
              Lupa password?
            </Link>
          }
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
          style={{ backgroundColor: PRIMARY, boxShadow: '0 8px 24px rgba(13,26,99,0.25)' }}
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

      <p className="text-center text-sm text-slate-600 mt-8">
        Belum punya akun?{' '}
        <Link to="/register-owner-type" className="font-semibold hover:underline" style={{ color: PRIMARY }}>
          Buat akun
        </Link>
      </p>
    </AuthSplitLayout>
  );
};

export default LoginPage;
