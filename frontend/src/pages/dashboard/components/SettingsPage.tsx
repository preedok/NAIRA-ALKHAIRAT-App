import React, { useState } from 'react';
import { Bell, Building2, Globe, LockKeyhole, Save, ShieldCheck } from 'lucide-react';
import Card from '../../../components/common/Card';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Badge from '../../../components/common/Badge';
import Autocomplete from '../../../components/common/Autocomplete';
import { SelectOption } from '../../../types';

type SettingsForm = {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  locale: 'id' | 'en';
  timezone: string;
  currency: 'IDR' | 'USD';
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  notifyOverdue: boolean;
  autoReminderDays: number;
  require2FA: boolean;
  sessionTimeoutMinutes: number;
};

const initialForm: SettingsForm = {
  companyName: 'Nail Al-Khairat Travel',
  companyEmail: 'support@nailalkhairat.com',
  companyPhone: '021-555-0011',
  companyAddress: 'Jl. K.H. Wahid Hasyim No.88, Jakarta',
  locale: 'id',
  timezone: 'Asia/Jakarta',
  currency: 'IDR',
  notifyEmail: true,
  notifyWhatsapp: true,
  notifyOverdue: true,
  autoReminderDays: 3,
  require2FA: false,
  sessionTimeoutMinutes: 60
};

const localeOptions: SelectOption[] = [
  { value: 'id', label: 'Indonesia' },
  { value: 'en', label: 'English' }
];
const timezoneOptions: SelectOption[] = [
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB)' },
  { value: 'Asia/Makassar', label: 'Asia/Makassar (WITA)' },
  { value: 'Asia/Jayapura', label: 'Asia/Jayapura (WIT)' }
];
const currencyOptions: SelectOption[] = [
  { value: 'IDR', label: 'IDR (Rupiah)' },
  { value: 'USD', label: 'USD (Dollar)' }
];

const SettingsPage: React.FC = () => {
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const saveSettings = () => {
    setSavedAt(new Date().toLocaleString('id-ID'));
  };

  const resetSettings = () => {
    setForm(initialForm);
    setSavedAt(null);
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Pengaturan Sistem</h2>
            <p className="text-sm text-slate-500 mt-1">
              Kelola profil perusahaan, preferensi operasional, notifikasi, dan keamanan dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info" size="sm">Environment: Production</Badge>
            {savedAt && <Badge variant="success" size="sm">Tersimpan {savedAt}</Badge>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <p className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Profil Perusahaan
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nama perusahaan" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
            <Input label="Email resmi" type="email" value={form.companyEmail} onChange={(e) => setForm((p) => ({ ...p, companyEmail: e.target.value }))} />
            <Input label="Nomor telepon" value={form.companyPhone} onChange={(e) => setForm((p) => ({ ...p, companyPhone: e.target.value }))} />
            <Input label="Alamat kantor" value={form.companyAddress} onChange={(e) => setForm((p) => ({ ...p, companyAddress: e.target.value }))} />
          </div>
        </Card>

        <Card>
          <p className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Regional
          </p>
          <div className="mt-4 space-y-3">
            <Autocomplete
              label="Bahasa"
              value={form.locale}
              onChange={(value) => setForm((p) => ({ ...p, locale: value as 'id' | 'en' }))}
              options={localeOptions}
            />
            <Autocomplete
              label="Zona waktu"
              value={form.timezone}
              onChange={(value) => setForm((p) => ({ ...p, timezone: value }))}
              options={timezoneOptions}
            />
            <Autocomplete
              label="Mata uang"
              value={form.currency}
              onChange={(value) => setForm((p) => ({ ...p, currency: value as 'IDR' | 'USD' }))}
              options={currencyOptions}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <p className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifikasi & Reminder
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <span className="text-sm text-slate-700">Notifikasi Email</span>
              <input type="checkbox" checked={form.notifyEmail} onChange={(e) => setForm((p) => ({ ...p, notifyEmail: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <span className="text-sm text-slate-700">Notifikasi WhatsApp</span>
              <input type="checkbox" checked={form.notifyWhatsapp} onChange={(e) => setForm((p) => ({ ...p, notifyWhatsapp: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <span className="text-sm text-slate-700">Reminder Cicilan Terlambat</span>
              <input type="checkbox" checked={form.notifyOverdue} onChange={(e) => setForm((p) => ({ ...p, notifyOverdue: e.target.checked }))} />
            </label>
            <Input
              label="Auto reminder (H-berapa)"
              type="number"
              value={String(form.autoReminderDays)}
              onChange={(e) => setForm((p) => ({ ...p, autoReminderDays: Number(e.target.value) || 0 }))}
            />
          </div>
        </Card>

        <Card>
          <p className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
            <LockKeyhole className="w-4 h-4" />
            Keamanan Akses
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <span className="text-sm text-slate-700 inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Wajibkan 2FA untuk Admin
              </span>
              <input type="checkbox" checked={form.require2FA} onChange={(e) => setForm((p) => ({ ...p, require2FA: e.target.checked }))} />
            </label>
            <Input
              label="Session timeout (menit)"
              type="number"
              value={String(form.sessionTimeoutMinutes)}
              onChange={(e) => setForm((p) => ({ ...p, sessionTimeoutMinutes: Number(e.target.value) || 0 }))}
            />
            <Card className="bg-slate-50 border-slate-200">
              <p className="text-sm text-slate-600">
                Tips: gunakan timeout 30-60 menit untuk perangkat kantor bersama dan aktifkan 2FA untuk semua role admin.
              </p>
            </Card>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={resetSettings}>
            Reset
          </Button>
          <Button icon={<Save className="w-4 h-4" />} onClick={saveSettings}>
            Simpan Pengaturan
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
