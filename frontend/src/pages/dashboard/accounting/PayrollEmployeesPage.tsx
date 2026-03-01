import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronLeft, Settings, DollarSign, Plus, Trash2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import Textarea from '../../../components/common/Textarea';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBox } from '../../../components/common/Modal';
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
      invoice_koordinator: 'Invoice Koordinator',
      role_invoice_saudi: 'Invoice Saudi',
      role_hotel: 'Hotel',
      role_bus: 'Bus'
    };
    return map[r] || r;
  };

  return (
    <div className="flex flex-col min-h-0 w-full max-w-full space-y-4">
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/accounting/payroll/runs')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600 shrink-0" />
            Karyawan & Template Gaji
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">Atur template gaji (gaji pokok, tunjangan, potongan) per karyawan</p>
        </div>
        <div className="flex items-center gap-2">
          <Autocomplete label="Cabang" value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))} emptyLabel="Semua cabang" className="w-48 sm:w-56" />
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/accounting/payroll/settings')}>
            <Settings className="w-4 h-4 mr-1" />
            Pengaturan
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-w-0 w-full overflow-hidden flex flex-col">
        {loading ? (
          <p className="text-slate-500 py-8 text-center">Memuat...</p>
        ) : (
          <div className="overflow-x-auto overflow-y-auto min-h-0 flex-1">
            <table className="w-full text-sm min-w-[640px]">
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
        <Modal open onClose={() => !saving && setModalUser(null)}>
          <ModalBox>
            <ModalHeader title={`Template Gaji: ${modalUser.name}`} subtitle={modalUser.email} icon={<DollarSign className="w-5 h-5" />} onClose={() => !saving && setModalUser(null)} />
            <ModalBody className="space-y-4">
              {loadingSalary ? (
                <p className="text-slate-500">Memuat...</p>
              ) : (
                <>
                  <Input label="Gaji pokok (Rp)" type="number" min={0} value={baseSalary ? String(baseSalary) : ''} onChange={(e) => setBaseSalary(Number(e.target.value) || 0)} />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Tunjangan</label>
                      <Button variant="ghost" size="sm" onClick={() => addRow('allowances')}><Plus className="w-4 h-4" /></Button>
                    </div>
                    {allowances.map((a, i) => (
                      <div key={i} className="flex gap-2 mb-2 items-end">
                        <Input placeholder="Nama" value={a.name} onChange={(e) => updateRow('allowances', i, 'name', e.target.value)} className="flex-1 min-w-0" />
                        <Input type="number" placeholder="Jumlah" value={a.amount ? String(a.amount) : ''} onChange={(e) => updateRow('allowances', i, 'amount', Number(e.target.value) || 0)} className="w-28" fullWidth={false} />
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
                      <div key={i} className="flex gap-2 mb-2 items-end">
                        <Input placeholder="Nama" value={d.name} onChange={(e) => updateRow('deductions', i, 'name', e.target.value)} className="flex-1 min-w-0" />
                        <Input type="number" placeholder="Jumlah" value={d.amount ? String(d.amount) : ''} onChange={(e) => updateRow('deductions', i, 'amount', Number(e.target.value) || 0)} className="w-28" fullWidth={false} />
                        <Button variant="ghost" size="sm" onClick={() => removeRow('deductions', i)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    ))}
                  </div>
                  <Textarea label="Catatan" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setModalUser(null)} disabled={saving}>Batal</Button>
              <Button onClick={handleSaveSalary} disabled={saving || loadingSalary}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default PayrollEmployeesPage;
