import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ShieldCheck, RefreshCcw, AlertCircle, ArrowRight } from 'lucide-react';
import { authApi } from '../../services/api';
import Input from '../../components/common/Input';
import { AuthSplitLayout, AuthBrandLogoRow } from './AuthSplitLayout';

const PRIMARY = '#C9A04B';

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
      setInfo(res.data?.message || 'OTP berhasil dikirim ulang.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal kirim ulang OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthSplitLayout
      panelTitle="Verifikasi keamanan akun Anda."
      panelSubtitle="Masukkan kode OTP 6 digit yang kami kirim ke email Anda untuk mengaktifkan akun jamaah."
      panelFooterLink={{ to: '/login', label: 'Kembali ke halaman masuk →' }}
    >
      <AuthBrandLogoRow />

      <h1 className="text-2xl sm:text-[1.65rem] font-bold text-slate-900 tracking-tight">Verifikasi OTP</h1>
      <p className="text-sm text-slate-500 mt-1.5 mb-6">Masukkan kode OTP 6 digit yang dikirim ke email Anda.</p>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-4 text-sm text-red-700 bg-red-50 border border-red-100" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="rounded-xl px-3.5 py-2.5 mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-100">
          {info}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4 mt-2">
        <Input
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@email.com"
          icon={<Mail className="w-4 h-4 shrink-0 text-slate-400" />}
          autoComplete="email"
          error={undefined}
        />
        <Input
          label="Kode OTP"
          value={otpCode}
          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6 digit OTP"
          icon={<ShieldCheck className="w-4 h-4 shrink-0 text-slate-400" />}
          autoComplete="one-time-code"
          error={undefined}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99]"
          style={{ backgroundColor: PRIMARY, boxShadow: '0 8px 24px rgba(183,135,52,0.28)' }}
        >
          {loading ? (
            'Memverifikasi...'
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              Verifikasi
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="w-full mt-3 border border-slate-200 rounded-xl py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 hover:bg-slate-50"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <RefreshCcw className="w-4 h-4" />
          {resending ? 'Mengirim ulang...' : 'Kirim ulang OTP'}
        </span>
      </button>

      <p className="text-center text-sm text-slate-600 mt-8">
        Sudah punya akun?{' '}
        <Link to="/login" className="font-semibold hover:underline" style={{ color: PRIMARY }}>
          Masuk
        </Link>
      </p>
    </AuthSplitLayout>
  );
};

export default VerifyOtpPage;
