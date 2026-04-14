import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { validateEmail } from '../../utils';
import Input from '../../components/common/Input';
import { checkboxClass } from '../../components/common/formStyles';
import { AuthSplitLayout, AuthBrandLogoRow } from './AuthSplitLayout';

const PRIMARY = '#0D1A63';

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

  return (
    <AuthSplitLayout
      panelTitle="Terhubung dengan layanan mitra Anda."
      panelSubtitle="Satu dasbor untuk order, invoice, visa, tiket, hotel, dan paket umroh — mudah disesuaikan kebutuhan travel Anda."
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
        <Link to="/register" className="font-semibold hover:underline" style={{ color: PRIMARY }}>
          Buat akun
        </Link>
      </p>
    </AuthSplitLayout>
  );
};

export default LoginPage;
