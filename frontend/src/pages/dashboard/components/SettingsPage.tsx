import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/common/Input';

const DEFAULT_FORM = {
  company_name: '',
  company_phone: '',
  company_email: '',
  office_address: ''
};

const SettingsPage: React.FC = () => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await api.get('/settings/settings');
      const data = res?.data?.data || {};
      setForm({
        company_name: String(data.company_name || ''),
        company_phone: String(data.company_phone || ''),
        company_email: String(data.company_email || ''),
        office_address: String(data.office_address || '')
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await api.put('/settings/settings', form);
      setMessage(res?.data?.message || 'Pengaturan berhasil diperbarui');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pengaturan Sistem"
        subtitle="Kelola identitas travel dan konfigurasi umum platform B2C."
        right={(
          <button type="button" onClick={loadData} className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-50">
            Refresh
          </button>
        )}
      />

      {error && <Card padding="sm"><p className="text-sm text-red-700">{error}</p></Card>}
      {message && <Card padding="sm"><p className="text-sm text-emerald-700">{message}</p></Card>}

      <Card>
        <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nama Travel" name="company_name" value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} />
          <Input label="Telepon Travel" name="company_phone" value={form.company_phone} onChange={(e) => setForm((p) => ({ ...p, company_phone: e.target.value }))} />
          <Input label="Email Travel" name="company_email" value={form.company_email} onChange={(e) => setForm((p) => ({ ...p, company_email: e.target.value }))} />
          <Input label="Alamat Kantor" name="office_address" value={form.office_address} onChange={(e) => setForm((p) => ({ ...p, office_address: e.target.value }))} />
          <div className="md:col-span-2">
            <button type="submit" disabled={saving || loading} className="px-4 py-2 rounded-lg bg-btn text-white hover:bg-btn-hover disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default SettingsPage;
