import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Settings as SettingsIcon, DollarSign, Bell, Save, Percent } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import ContentLoading from '../../../components/common/ContentLoading';
import Input from '../../../components/common/Input';
import Textarea from '../../../components/common/Textarea';
import Checkbox from '../../../components/common/Checkbox';
import { AutoRefreshControl } from '../../../components/common';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { businessRulesApi } from '../../../services/api';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setRules] = useState<Record<string, any>>({});
  const [form, setForm] = useState<{
    company_name: string;
    company_address: string;
    SAR_TO_IDR: string | number;
    USD_TO_IDR: string | number;
    mou_discount_percent: string | number;
    notification_order: boolean;
    notification_payment: boolean;
    notification_invoice: boolean;
  }>({
    company_name: '',
    company_address: '',
    SAR_TO_IDR: 4200,
    USD_TO_IDR: 15500,
    mou_discount_percent: 10,
    notification_order: true,
    notification_payment: true,
    notification_invoice: true
  });

  const canEdit = user?.role === 'super_admin' || user?.role === 'admin_pusat' || user?.role === 'role_accounting';

  const fetchSettings = useCallback(() => {
    setLoading(true);
    businessRulesApi
      .get({})
      .then((res) => {
        if (res.data?.data) {
          const data = res.data.data as Record<string, any>;
          setRules(data);
          let currency: Record<string, number> = {};
          try {
            currency = typeof data.currency_rates === 'string' ? JSON.parse(data.currency_rates) : (data.currency_rates || {});
          } catch {}
          setForm((f) => ({
            ...f,
            company_name: data.company_name ?? f.company_name,
            company_address: data.company_address ?? f.company_address,
            SAR_TO_IDR: currency.SAR_TO_IDR ?? f.SAR_TO_IDR,
            USD_TO_IDR: currency.USD_TO_IDR ?? f.USD_TO_IDR,
            mou_discount_percent: data.mou_discount_percent ?? f.mou_discount_percent,
            notification_order: data.notification_order === 'true' || data.notification_order === true,
            notification_payment: data.notification_payment === 'true' || data.notification_payment === true,
            notification_invoice: data.notification_invoice === 'true' || data.notification_invoice === true
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings, user?.role, user?.branch_id]);

  if (user?.role === 'owner') return <Navigate to="/dashboard" replace />;

  const tabs = [
    { id: 'general', label: 'General', icon: <SettingsIcon className="w-5 h-5" /> },
    { id: 'currency', label: 'Currency & Kurs', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'mou_discount', label: 'Diskon MOU', icon: <Percent className="w-5 h-5" /> },
    { id: 'notifications', label: 'Notifikasi', icon: <Bell className="w-5 h-5" /> }
  ];

  const handleSaveGeneral = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await businessRulesApi.set({
        rules: {
          company_name: form.company_name,
          company_address: form.company_address
        }
      });
      showToast('Pengaturan general disimpan', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCurrency = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await businessRulesApi.set({
        rules: {
          currency_rates: {
            SAR_TO_IDR: form.SAR_TO_IDR === '' ? 0 : Number(form.SAR_TO_IDR),
            USD_TO_IDR: form.USD_TO_IDR === '' ? 0 : Number(form.USD_TO_IDR)
          }
        }
      });
      const data = res.data as { success?: boolean; pricesUpdated?: { updated: number; created: number } };
      if (data?.pricesUpdated) {
        showToast('Kurs disimpan. Semua harga produk (IDR, SAR, USD) telah disesuaikan dengan kurs baru.', 'success');
      } else {
        showToast('Kurs disimpan', 'success');
      }
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMouDiscount = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const pct = Math.min(100, Math.max(0, Number(form.mou_discount_percent) || 0));
      await businessRulesApi.set({
        rules: { mou_discount_percent: pct }
      });
      setForm((f) => ({ ...f, mou_discount_percent: pct }));
      showToast('Diskon MOU disimpan. Harga produk untuk owner MOU akan ' + (pct > 0 ? pct + '% lebih murah.' : 'sama dengan non-MOU.'), 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await businessRulesApi.set({
        rules: {
          notification_order: form.notification_order ? 'true' : 'false',
          notification_payment: form.notification_payment ? 'true' : 'false',
          notification_invoice: form.notification_invoice ? 'true' : 'false'
        }
      });
      showToast('Pengaturan notifikasi disimpan', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Konfigurasi umum, kurs, dan notifikasi"
        right={<AutoRefreshControl onRefresh={fetchSettings} disabled={loading} size="sm" />}
      />

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card className="travel-card">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-[#0D1A63] text-white shadow-lg'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="travel-card">
            {loading ? (
              <ContentLoading />
            ) : (
            <>
              {activeTab === 'general' && (
                <Card className="travel-card">
                  <CardSectionHeader title="General" subtitle="Nama perusahaan dan alamat." className="mb-6" />
                  <div className="space-y-6">
                    <Input
                      label="Nama Perusahaan"
                      type="text"
                      value={form.company_name}
                      onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                      disabled={!canEdit}
                    />
                    <Textarea
                      label="Alamat Perusahaan"
                      value={form.company_address}
                      onChange={(e) => setForm((f) => ({ ...f, company_address: e.target.value }))}
                      disabled={!canEdit}
                      rows={3}
                    />
                    {canEdit && (
                      <Button variant="primary" onClick={handleSaveGeneral} disabled={saving}>
                        <Save className="w-5 h-5 mr-2" />
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {activeTab === 'currency' && (
            <Card className="travel-card">
              <CardSectionHeader title="Currency & Kurs" subtitle="Nilai tukar ke IDR untuk konversi tagihan." className="mb-6" />
              <div className="space-y-6">
                <p className="text-sm text-slate-600">Nilai tukar ke IDR (untuk konversi tagihan). Admin Pusat, Super Admin, dan Accounting dapat mengubah kurs global.</p>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <Input
                      label="SAR → IDR (1 SAR = ? IDR)"
                      type="number"
                      value={form.SAR_TO_IDR === '' ? '' : String(form.SAR_TO_IDR)}
                      onChange={(e) => setForm((f) => ({ ...f, SAR_TO_IDR: e.target.value === '' ? '' : Number(e.target.value) || 0 }))}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <Input
                      label="USD → IDR (1 USD = ? IDR)"
                      type="number"
                      value={form.USD_TO_IDR === '' ? '' : String(form.USD_TO_IDR)}
                      onChange={(e) => setForm((f) => ({ ...f, USD_TO_IDR: e.target.value === '' ? '' : Number(e.target.value) || 0 }))}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                {canEdit && (
                  <Button variant="primary" onClick={handleSaveCurrency} disabled={saving}>
                    <Save className="w-5 h-5 mr-2" />
                    {saving ? 'Menyimpan...' : 'Simpan Kurs'}
                  </Button>
                )}
              </div>
            </Card>
          )}

              {activeTab === 'mou_discount' && (
                <Card className="travel-card">
                  <CardSectionHeader title="Diskon MOU" subtitle="Persentase diskon harga produk untuk owner MOU (lebih murah dari harga non-MOU)." className="mb-6" />
                  <div className="space-y-6">
                    <p className="text-sm text-slate-600">Owner dengan status MOU akan melihat harga produk lebih murah. Nilai 10 = harga 10% lebih murah dari harga normal. Diatur oleh Admin Pusat.</p>
                    <div className="p-4 bg-slate-50 rounded-lg max-w-xs">
                      <Input
                        label="Diskon MOU (%)"
                        type="number"
                        min={0}
                        max={100}
                        value={form.mou_discount_percent === '' ? '' : String(form.mou_discount_percent)}
                        onChange={(e) => setForm((f) => ({ ...f, mou_discount_percent: e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                        disabled={!canEdit}
                      />
                    </div>
                    {canEdit && (
                      <Button variant="primary" onClick={handleSaveMouDiscount} disabled={saving}>
                        <Save className="w-5 h-5 mr-2" />
                        {saving ? 'Menyimpan...' : 'Simpan Diskon MOU'}
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {activeTab === 'notifications' && (
                <Card className="travel-card">
                  <CardSectionHeader title="Notifikasi" subtitle="Aktifkan atau nonaktifkan notifikasi per jenis." className="mb-6" />
                  <div className="space-y-4">
                    {[
                      { key: 'notification_order' as const, label: 'Notifikasi Order', description: 'Notifikasi saat ada order baru' },
                      { key: 'notification_payment' as const, label: 'Notifikasi Pembayaran', description: 'Notifikasi saat pembayaran diverifikasi' },
                      { key: 'notification_invoice' as const, label: 'Notifikasi Invoice', description: 'Notifikasi saat invoice diterbitkan atau diupdate' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-slate-900">{item.label}</p>
                          <p className="text-sm text-slate-600">{item.description}</p>
                        </div>
                        <Checkbox
                          checked={form[item.key]}
                          onChange={(e) => setForm((f) => ({ ...f, [item.key]: e.target.checked }))}
                          disabled={!canEdit}
                        />
                      </div>
                    ))}
                  </div>
                  {canEdit && (
                    <div className="mt-6">
                      <Button variant="primary" onClick={handleSaveNotifications} disabled={saving}>
                        <Save className="w-5 h-5 mr-2" />
                        {saving ? 'Menyimpan...' : 'Simpan Notifikasi'}
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
