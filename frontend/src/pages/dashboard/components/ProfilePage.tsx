import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/common/Input';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    nik: '',
    birth_place: '',
    birth_date: '',
    gender: '',
    marital_status: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);

  const loadUserProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/jamaah-profiles/me');
      const data = res?.data?.data || {};
      setForm((prev) => ({
        ...prev,
        full_name: data.full_name || '',
        nik: data.nik || '',
        birth_place: data.birth_place || '',
        birth_date: data.birth_date ? String(data.birth_date).slice(0, 10) : '',
        gender: data.gender || '',
        marital_status: data.marital_status || '',
        emergency_contact_name: data.emergency_contact_name || '',
        emergency_contact_phone: data.emergency_contact_phone || ''
      }));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat profil jamaah');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingProfiles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/jamaah-profiles/admin/pending');
      setPendingProfiles(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat profil menunggu verifikasi');
      setPendingProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadPendingProfiles();
    else loadUserProfile();
  }, [isAdmin]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.post('/jamaah-profiles/me', form);
      setMessage('Profil jamaah berhasil disimpan');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/jamaah-profiles/me/submit');
      setMessage(res?.data?.message || 'Profil berhasil dikirim untuk verifikasi');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal mengirim profil');
    } finally {
      setSaving(false);
    }
  };

  const finalizeProfile = async (profileId: string, status: 'verified' | 'rejected') => {
    try {
      await api.patch(`/jamaah-profiles/admin/${profileId}/finalize`, { status });
      await loadPendingProfiles();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memproses profil');
    }
  };

  if (isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Verifikasi Profil Jamaah" subtitle="Tinjau profil yang sudah dikirim jamaah dan tetapkan status final." />
        {error && <Card padding="sm"><p className="text-sm text-red-700">{error}</p></Card>}
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3">Nama</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Dokumen</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-500">Memuat...</td></tr>
                ) : pendingProfiles.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-500">Tidak ada profil menunggu verifikasi</td></tr>
                ) : pendingProfiles.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-medium">{p.full_name || '-'}</td>
                    <td className="px-4 py-3">{p.profile_status || '-'}</td>
                    <td className="px-4 py-3">{Array.isArray(p.Documents) ? p.Documents.length : 0} dokumen</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button type="button" onClick={() => finalizeProfile(p.id, 'verified')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white">Verifikasi</button>
                        <button type="button" onClick={() => finalizeProfile(p.id, 'rejected')} className="px-3 py-1.5 rounded-lg bg-red-600 text-white">Tolak</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Profil Jamaah" subtitle="Lengkapi data profil untuk proses verifikasi dan keberangkatan umroh." />
      {error && <Card padding="sm"><p className="text-sm text-red-700">{error}</p></Card>}
      {message && <Card padding="sm"><p className="text-sm text-emerald-700">{message}</p></Card>}
      <Card>
        <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nama Lengkap" name="full_name" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
          <Input label="NIK" name="nik" value={form.nik} onChange={(e) => setForm((p) => ({ ...p, nik: e.target.value }))} />
          <Input label="Tempat Lahir" name="birth_place" value={form.birth_place} onChange={(e) => setForm((p) => ({ ...p, birth_place: e.target.value }))} />
          <Input label="Tanggal Lahir" name="birth_date" type="date" value={form.birth_date} onChange={(e) => setForm((p) => ({ ...p, birth_date: e.target.value }))} />
          <Input label="Jenis Kelamin" name="gender" value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))} />
          <Input label="Status Pernikahan" name="marital_status" value={form.marital_status} onChange={(e) => setForm((p) => ({ ...p, marital_status: e.target.value }))} />
          <Input label="Nama Kontak Darurat" name="emergency_contact_name" value={form.emergency_contact_name} onChange={(e) => setForm((p) => ({ ...p, emergency_contact_name: e.target.value }))} />
          <Input label="Telepon Darurat" name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={(e) => setForm((p) => ({ ...p, emergency_contact_phone: e.target.value }))} />
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-btn text-white hover:bg-btn-hover disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
            <button type="button" onClick={submitForReview} disabled={saving || loading} className="px-4 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-60">
              Kirim untuk Verifikasi
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ProfilePage;
