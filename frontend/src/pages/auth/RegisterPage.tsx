import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../services/api';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', whatsapp: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-2">Daftar Jamaah</h1>
        <p className="text-sm text-gray-600 mb-6">Buat akun untuk mulai proses pendaftaran umroh.</p>
        {error && <div className="mb-4 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-3">
          <input name="name" value={form.name} onChange={onChange} placeholder="Nama lengkap" className="w-full border rounded-lg px-3 py-2" />
          <input name="email" type="email" value={form.email} onChange={onChange} placeholder="Email" className="w-full border rounded-lg px-3 py-2" />
          <input name="phone" value={form.phone} onChange={onChange} placeholder="No HP" className="w-full border rounded-lg px-3 py-2" />
          <input name="whatsapp" value={form.whatsapp} onChange={onChange} placeholder="No WhatsApp" className="w-full border rounded-lg px-3 py-2" />
          <input name="password" type="password" value={form.password} onChange={onChange} placeholder="Password" className="w-full border rounded-lg px-3 py-2" />
          <button disabled={loading} className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold disabled:opacity-60">
            {loading ? 'Memproses...' : 'Daftar'}
          </button>
        </form>
        <p className="text-sm text-gray-600 mt-4">
          Sudah punya akun? <Link to="/login" className="text-blue-700 font-semibold">Masuk</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
