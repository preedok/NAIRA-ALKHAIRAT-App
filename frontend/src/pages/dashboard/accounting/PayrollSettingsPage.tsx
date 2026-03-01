import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ChevronLeft, Save } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { Input, Autocomplete, Checkbox } from '../../../components/common';
import { accountingApi, branchesApi, type PayrollSettingData } from '../../../services/api';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const PayrollSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [settings, setSettings] = useState<PayrollSettingData | null>(null);
  const [method, setMethod] = useState<string>('manual');
  const [payrollDayOfMonth, setPayrollDayOfMonth] = useState<number>(25);
  const [runTime, setRunTime] = useState<string>('09:00');
  const [isActive, setIsActive] = useState(true);
  const [companyNameSlip, setCompanyNameSlip] = useState('');
  const [companyAddressSlip, setCompanyAddressSlip] = useState('');

  useEffect(() => {
    branchesApi.list({ limit: 500 }).then((r) => { if (r.data.success) setBranches(r.data.data || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    accountingApi.payroll.getSettings({ branch_id: branchId || undefined })
      .then((r) => {
        if (r.data.success && r.data.data) {
          const s = r.data.data;
          setSettings(s);
          setMethod(s.method || 'manual');
          setPayrollDayOfMonth(s.payroll_day_of_month ?? 25);
          setRunTime(s.run_time || '09:00');
          setIsActive(s.is_active !== false);
          setCompanyNameSlip(s.company_name_slip || '');
          setCompanyAddressSlip(s.company_address_slip || '');
        }
      })
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, [branchId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await accountingApi.payroll.updateSettings({
        branch_id: branchId || undefined,
        method,
        payroll_day_of_month: payrollDayOfMonth,
        run_time: runTime,
        is_active: isActive,
        company_name_slip: companyNameSlip || undefined,
        company_address_slip: companyAddressSlip || undefined
      });
      setSettings((prev) => prev ? { ...prev, method, payroll_day_of_month: payrollDayOfMonth, run_time: runTime, is_active: isActive, company_name_slip: companyNameSlip, company_address_slip: companyAddressSlip } : null);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/accounting/payroll/runs')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-8 h-8 text-emerald-600" />
            Pengaturan Payroll
          </h1>
          <p className="text-slate-600 mt-1">Metode payroll (jadwal otomatis atau manual) dan data perusahaan untuk slip gaji</p>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Autocomplete label="Scope (Cabang)" value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))} emptyLabel="Global (semua cabang)" />
          <div>
            <Autocomplete label="Metode Payroll" value={method} onChange={setMethod} options={[{ value: 'manual', label: 'Manual (dijalankan oleh accounting)' }, { value: 'scheduled', label: 'Terjadwal (otomatis per tanggal)' }]} />
            <p className="text-xs text-slate-500 mt-1">Manual: payroll dijalankan saat Anda klik &quot;Buat Payroll&quot; / Finalize. Terjadwal: sistem akan run di tanggal dan jam yang ditentukan.</p>
          </div>
          {method === 'scheduled' && (
            <>
              <Autocomplete label="Tanggal run (tiap bulan)" value={String(payrollDayOfMonth)} onChange={(v) => setPayrollDayOfMonth(Number(v))} options={Array.from({ length: 28 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: `${d} ${d === 1 ? '(awal bulan)' : ''}` }))} />
              <Input label="Jam run" type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} fullWidth />
            </>
          )}
          <div className="md:col-span-2">
            <Input label="Nama perusahaan di slip gaji" type="text" value={companyNameSlip} onChange={(e) => setCompanyNameSlip(e.target.value)} placeholder="BINTANG GLOBAL GROUP" fullWidth />
          </div>
          <div className="md:col-span-2">
            <Input label="Alamat / subjudul di slip gaji" type="text" value={companyAddressSlip} onChange={(e) => setCompanyAddressSlip(e.target.value)} placeholder="Travel & Umroh" fullWidth />
          </div>
          <div className="md:col-span-2">
            <Checkbox id="isActive" label="Aktifkan pengaturan ini" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={handleSave} disabled={loading || saving} icon={saving ? undefined : <Save className="w-4 h-4" />}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </Card>

      {loading && !settings && <div className="text-center py-12 text-slate-500">Memuat...</div>}
    </div>
  );
};

export default PayrollSettingsPage;
