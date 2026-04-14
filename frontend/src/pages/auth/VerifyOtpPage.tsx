import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../services/api';

const VerifyOtpPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
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
    try {
      await authApi.resendOtp(email.trim().toLowerCase());
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal kirim ulang OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-2">Verifikasi OTP</h1>
        <p className="text-sm text-gray-600 mb-6">Masukkan kode OTP 6 digit yang dikirim ke WhatsApp Anda.</p>
        {error && <div className="mb-4 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        <form onSubmit={handleVerify} className="space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full border rounded-lg px-3 py-2" />
          <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Kode OTP 6 digit" maxLength={6} className="w-full border rounded-lg px-3 py-2 tracking-widest" />
          <button disabled={loading} className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold disabled:opacity-60">
            {loading ? 'Memverifikasi...' : 'Verifikasi'}
          </button>
        </form>
        <button onClick={handleResend} disabled={resending} className="w-full mt-3 border rounded-lg py-2 text-sm font-semibold disabled:opacity-60">
          {resending ? 'Mengirim ulang...' : 'Kirim ulang OTP'}
        </button>
      </div>
    </div>
  );
};

export default VerifyOtpPage;
