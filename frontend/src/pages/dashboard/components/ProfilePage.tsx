import React, { useState } from 'react';
import { Lock, Save } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { authApi } from '../../../services/api';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Password baru minimal 6 karakter', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi password tidak cocok', 'error');
      return;
    }
    if (!currentPassword.trim()) {
      showToast('Masukkan password saat ini', 'error');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      showToast('Password berhasil diubah', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Gagal mengubah password', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Profil</h1>
        <p className="text-slate-600 mt-1">Data akun dan ubah password</p>
      </div>

      <Card className="travel-card max-w-xl">
        <div className="flex items-center gap-4 p-4 border-b border-slate-200">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xl font-bold">
            {user?.name?.charAt(0) || '?'}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{user?.name || '-'}</p>
            <p className="text-sm text-slate-500">{user?.email || '-'}</p>
            {user?.company_name && <p className="text-sm text-slate-600">{user.company_name}</p>}
          </div>
        </div>
      </Card>

      <Card className="travel-card max-w-xl">
        <div className="flex items-center gap-3 p-4 border-b border-slate-200">
          <Lock className="w-6 h-6 text-primary-600" />
          <h2 className="text-xl font-bold text-slate-900">Ubah Password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="p-4 space-y-4">
          <p className="text-sm text-slate-600">Ganti password yang diberikan sistem dengan password pilihan Anda.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password saat ini</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Masukkan password saat ini"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password baru</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Min. 6 karakter"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi password baru</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Ulangi password baru"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="w-5 h-5 mr-2" />
            {saving ? 'Menyimpan...' : 'Simpan Password'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ProfilePage;
