import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Phone, MessageCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { authApi } from '../../services/api';
import Input from '../../components/common/Input';
import { AuthSplitLayout, AuthBrandLogoRow } from './AuthSplitLayout';

const PRIMARY = '#C9A04B';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', whatsapp: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.whatsapp || !form.password) {
      setError('Nama, email, WhatsApp, dan password wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      await authApi.register(form);
      navigate(`/verify-otp?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      panelTitle="Mulai proses umroh lebih teratur."
      panelSubtitle="Lengkapi data akun Anda untuk mengakses dashboard jamaah: profil, dokumen, pemesanan paket, invoice, cicilan, dan status kloter."
      panelFooterLink={{ to: '/login', label: 'Sudah punya akun? Masuk →' }}
    >
      <AuthBrandLogoRow />

      <h1 className="text-2xl sm:text-[1.65rem] font-bold text-slate-900 tracking-tight">Daftar Jamaah</h1>
      <p className="text-sm text-slate-500 mt-1.5 mb-6">Buat akun untuk mulai proses pendaftaran umroh.</p>

      {error && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-4 text-sm text-red-700 bg-red-50 border border-red-100"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 mt-2">
        <Input
          name="name"
          label="Nama lengkap"
          value={form.name}
          onChange={onChange}
          icon={<User className="w-4 h-4 shrink-0 text-slate-400" />}
          placeholder="Nama sesuai identitas"
          autoComplete="name"
          error={undefined}
        />
        <Input
          name="email"
          type="email"
          label="Email"
          value={form.email}
          onChange={onChange}
          icon={<Mail className="w-4 h-4 shrink-0 text-slate-400" />}
          placeholder="nama@email.com"
          autoComplete="email"
          error={undefined}
        />
        <Input
          name="phone"
          label="No HP"
          value={form.phone}
          onChange={onChange}
          icon={<Phone className="w-4 h-4 shrink-0 text-slate-400" />}
          placeholder="08xxxxxxxxxx"
          autoComplete="tel"
          error={undefined}
        />
        <Input
          name="whatsapp"
          label="No WhatsApp"
          value={form.whatsapp}
          onChange={onChange}
          icon={<MessageCircle className="w-4 h-4 shrink-0 text-slate-400" />}
          placeholder="08xxxxxxxxxx"
          autoComplete="tel"
          error={undefined}
        />
        <Input
          name="password"
          type={showPass ? 'text' : 'password'}
          label="Password"
          value={form.password}
          onChange={onChange}
          icon={<Lock className="w-4 h-4 shrink-0 text-slate-400" />}
          placeholder="••••••••"
          autoComplete="new-password"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99]"
          style={{ backgroundColor: PRIMARY, boxShadow: '0 8px 24px rgba(183,135,52,0.28)' }}
        >
          {loading ? (
            'Memproses...'
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              Daftar
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600 mt-8">
        Sudah punya akun?{' '}
        <Link to="/login" className="font-semibold hover:underline" style={{ color: PRIMARY }}>
          Masuk
        </Link>
      </p>
    </AuthSplitLayout>
  );
};

export default RegisterPage;
