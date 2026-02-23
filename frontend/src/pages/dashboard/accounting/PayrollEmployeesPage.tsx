import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronLeft, Settings, DollarSign, Plus, Trash2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { accountingApi, branchesApi, type PayrollEmployeeItem, type EmployeeSalaryData } from '../../../services/api';
import { formatIDR } from '../../../utils';

type AllowanceDeduction = { name: string; amount: number };

const PayrollEmployeesPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<PayrollEmployeeItem[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [modalUser, setModalUser] = useState<PayrollEmployeeItem | null>(null);
  const [salary, setSalary] = useState<EmployeeSalaryData | null>(null);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [allowances, setAllowances] = useState<AllowanceDeduction[]>([]);
  const [deductions, setDeductions] = useState<AllowanceDeduction[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingSalary, setLoadingSalary] = useState(false);

  useEffect(() => {
    branchesApi.list({ limit: 500 }).then((r) => { if (r.data.success) setBranches(r.data.data || []); }).catch(() => {});
  }, []);

  const fetchEmployees = () => {
    setLoading(true);
    accountingApi.payroll.listEmployees({ branch_id: branchId || undefined })
      .then((r) => {
        if (r.data.success) setEmployees(r.data.data || []);
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmployees();
  }, [branchId]);

  const openSalaryModal = (emp: PayrollEmployeeItem) => {
    setModalUser(emp);
    setLoadingSalary(true);
    accountingApi.payroll.getEmployeeSalary(emp.id)
      .then((r) => {
        if (r.data.success && r.data.data) {
          const s = r.data.data;
          setSalary(s);
          setBaseSalary(Number(s.base_salary) || 0);
          setAllowances(Array.isArray(s.allowances) ? s.allowances.map((a: any) => ({ name: String(a.name || ''), amount: Number(a.amount ?? a.value ?? 0) })) : []);
          setDeductions(Array.isArray(s.deductions) ? s.deductions.map((d: any) => ({ name: String(d.name || ''), amount: Number(d.amount ?? d.value ?? 0) })) : []);
          setNotes(s.notes || '');
        } else {
          setSalary(null);
          setBaseSalary(0);
          setAllowances([]);
          setDeductions([]);
          setNotes('');
        }
      })
      .catch(() => {
        setSalary(null);
        setBaseSalary(0);
        setAllowances([]);
        setDeductions([]);
        setNotes('');
      })
      .finally(() => setLoadingSalary(false));
  };

  const addRow = (kind: 'allowances' | 'deductions') => {
    if (kind === 'allowances') setAllowances((prev) => [...prev, { name: '', amount: 0 }]);
    else setDeductions((prev) => [...prev, { name: '', amount: 0 }]);
  };

  const updateRow = (kind: 'allowances' | 'deductions', index: number, field: 'name' | 'amount', value: string | number) => {
    if (kind === 'allowances') {
      setAllowances((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    } else {
      setDeductions((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    }
  };

  const removeRow = (kind: 'allowances' | 'deductions', index: number) => {
    if (kind === 'allowances') setAllowances((prev) => prev.filter((_, i) => i !== index));
    else setDeductions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveSalary = async () => {
    if (!modalUser) return;
    setSaving(true);
    try {
      await accountingApi.payroll.upsertEmployeeSalary(modalUser.id, {
        base_salary: baseSalary,
        allowances: allowances.filter((a) => a.name.trim() || a.amount !== 0),
        deductions: deductions.filter((d) => d.name.trim() || d.amount !== 0),
        notes: notes.trim() || undefined
      });
      setModalUser(null);
      fetchEmployees();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (r: string) => {
    const map: Record<string, string> = {
      super_admin: 'Super Admin',
      admin_pusat: 'Admin Pusat',
      role_accounting: 'Accounting',
      role_invoice: 'Invoice (legacy)',
      invoice_koordinator: 'Invoice Koordinator',
      role_invoice_saudi: 'Invoice Saudi',
      role_hotel: 'Hotel',
      role_bus: 'Bus'
    };
    return map[r] || r;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/accounting/payroll/runs')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-emerald-600" />
            Karyawan & Template Gaji
          </h1>
          <p className="text-slate-600 mt-1">Atur template gaji (gaji pokok, tunjangan, potongan) per karyawan untuk payroll</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/accounting/payroll/settings')}>
          <Settings className="w-4 h-4 mr-1" />
          Pengaturan Payroll
        </Button>
      </div>

      <Card>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Filter Cabang</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full max-w-xs border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500 py-8 text-center">Memuat...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="pb-2 pr-4">Nama</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4">Cabang</th>
                  <th className="pb-2 pr-4">Gaji pokok</th>
                  <th className="pb-2 pr-4">Tunjangan / Potongan</th>
                  <th className="pb-2 pr-4 w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const t = emp.salary_template;
                  const base = t ? Number(t.base_salary) : 0;
                  const allowSum = (t?.allowances || []).reduce((s: number, a: any) => s + Number(a.amount ?? a.value ?? 0), 0);
                  const dedSum = (t?.deductions || []).reduce((s: number, d: any) => s + Number(d.amount ?? d.value ?? 0), 0);
                  return (
                    <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pr-4 font-medium text-slate-900">{emp.name}</td>
                      <td className="py-3 pr-4 text-slate-600">{emp.email}</td>
                      <td className="py-3 pr-4">{roleLabel(emp.role)}</td>
                      <td className="py-3 pr-4">{emp.Branch ? `${emp.Branch.code} - ${emp.Branch.name}` : '-'}</td>
                      <td className="py-3 pr-4">{formatIDR(base)}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {t ? `+${formatIDR(allowSum, false)} / -${formatIDR(dedSum, false)}` : '-'}
                      </td>
                      <td className="py-3 pr-4">
                        <Button variant="ghost" size="sm" onClick={() => openSalaryModal(emp)}>
                          <DollarSign className="w-4 h-4" /> Atur
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {employees.length === 0 && <p className="text-slate-500 py-8 text-center">Tidak ada karyawan (non-owner) untuk cabang ini</p>}
          </div>
        )}
      </Card>

      {/* Modal Atur Gaji */}
      {modalUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !saving && setModalUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Template Gaji: {modalUser.name}</h2>
              <p className="text-slate-600 text-sm mt-1">{modalUser.email}</p>
            </div>
            <div className="p-6 space-y-4">
              {loadingSalary ? (
                <p className="text-slate-500">Memuat...</p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gaji pokok (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={baseSalary || ''}
                      onChange={(e) => setBaseSalary(Number(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Tunjangan</label>
                      <Button variant="ghost" size="sm" onClick={() => addRow('allowances')}><Plus className="w-4 h-4" /></Button>
                    </div>
                    {allowances.map((a, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input
                          placeholder="Nama"
                          value={a.name}
                          onChange={(e) => updateRow('allowances', i, 'name', e.target.value)}
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Jumlah"
                          value={a.amount || ''}
                          onChange={(e) => updateRow('allowances', i, 'amount', Number(e.target.value) || 0)}
                          className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeRow('allowances', i)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Potongan</label>
                      <Button variant="ghost" size="sm" onClick={() => addRow('deductions')}><Plus className="w-4 h-4" /></Button>
                    </div>
                    {deductions.map((d, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input
                          placeholder="Nama"
                          value={d.name}
                          onChange={(e) => updateRow('deductions', i, 'name', e.target.value)}
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Jumlah"
                          value={d.amount || ''}
                          onChange={(e) => updateRow('deductions', i, 'amount', Number(e.target.value) || 0)}
                          className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeRow('deductions', i)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalUser(null)} disabled={saving}>Batal</Button>
              <Button onClick={handleSaveSalary} disabled={saving || loadingSalary}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollEmployeesPage;
