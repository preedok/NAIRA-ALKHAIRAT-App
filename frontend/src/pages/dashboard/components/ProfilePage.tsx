import React, { useMemo, useState } from 'react';
import { BadgeCheck, KeyRound, Mail, Phone, Save, ShieldCheck, UserCircle2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import { useAuth } from '../../../contexts/AuthContext';
import { ROLE_NAMES } from '../../../types';
import { authApi } from '../../../services/api';

const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    companyName: user?.company_name || '',
    branchName: user?.branch_name || ''
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [savingPassword, setSavingPassword] = useState(false);

  const userInitial = useMemo(() => (user?.name?.[0] || 'U').toUpperCase(), [user?.name]);

  const saveProfile = () => {
    setSavedAt(new Date().toLocaleString('id-ID'));
  };

  const changePassword = async () => {
    setPasswordError('');
    setPasswordMessage('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Semua field password wajib diisi.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password baru minimal 8 karakter.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok.');
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      await refreshUser();
      setPasswordMessage('Password berhasil diperbarui.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordError(err?.response?.data?.message || 'Gagal mengubah password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-600 to-primary-500 text-white flex items-center justify-center text-xl font-bold">
              {userInitial}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{user?.name || 'User'}</h2>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <div className="mt-1">
                <Badge variant="info" size="sm">{user ? ROLE_NAMES[user.role] : 'Role'}</Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Status Akun</p>
            <p className="text-sm font-semibold inline-flex items-center gap-1 text-emerald-700">
              <BadgeCheck className="w-4 h-4" />
              {user?.is_active ? 'Aktif' : 'Nonaktif'}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <p className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
            <UserCircle2 className="w-4 h-4" />
            Informasi Profil
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nama Lengkap" value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} />
            <Input label="Email" type="email" value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} />
            <Input label="Nomor HP" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
            <Input label="Perusahaan" value={profileForm.companyName} onChange={(e) => setProfileForm((p) => ({ ...p, companyName: e.target.value }))} />
            <Input label="Cabang" value={profileForm.branchName} onChange={(e) => setProfileForm((p) => ({ ...p, branchName: e.target.value }))} />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            {savedAt && <span className="text-xs text-emerald-700">Tersimpan {savedAt}</span>}
            <Button icon={<Save className="w-4 h-4" />} onClick={saveProfile}>
              Simpan Profil
            </Button>
          </div>
        </Card>

        <Card>
          <p className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Ringkasan Akun
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-slate-700 inline-flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-500" />
              {user?.email || '-'}
            </p>
            <p className="text-slate-700 inline-flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" />
              {user?.phone || '-'}
            </p>
            <p className="text-slate-700">
              Role: <span className="font-semibold">{user ? ROLE_NAMES[user.role] : '-'}</span>
            </p>
            <p className="text-slate-700">
              Bergabung: <span className="font-semibold">{user?.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : '-'}</span>
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <p className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          Ubah Password
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label="Password Saat Ini"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
          />
          <Input
            label="Password Baru"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
          />
          <Input
            label="Konfirmasi Password Baru"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
          />
        </div>
        {passwordError && <p className="mt-3 text-sm text-red-600">{passwordError}</p>}
        {passwordMessage && <p className="mt-3 text-sm text-emerald-600">{passwordMessage}</p>}
        <div className="mt-4 flex justify-end">
          <Button onClick={changePassword} isLoading={savingPassword}>
            Perbarui Password
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfilePage;
