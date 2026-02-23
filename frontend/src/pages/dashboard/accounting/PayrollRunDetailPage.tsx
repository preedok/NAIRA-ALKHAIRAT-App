/* eslint-disable no-restricted-globals */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ChevronLeft, Check, Save, ExternalLink, DollarSign } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { accountingApi, type PayrollRunData, type PayrollItemData } from '../../../services/api';
import { formatIDR } from '../../../utils';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

type AllowanceDeduction = { name?: string; amount?: number };

const PayrollRunDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<PayrollRunData | null>(null);
  const [items, setItems] = useState<PayrollItemData[]>([]);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editBase, setEditBase] = useState(0);
  const [editAllowances, setEditAllowances] = useState<AllowanceDeduction[]>([]);
  const [editDeductions, setEditDeductions] = useState<AllowanceDeduction[]>([]);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  const fetchRun = () => {
    if (!id) return;
    setLoading(true);
    accountingApi.payroll.getRun(id)
      .then((r) => {
        if (r.data.success && r.data.data) {
          const data = r.data.data;
          setRun(data);
          setItems(data.PayrollItems || []);
        }
      })
      .catch(() => setRun(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRun();
  }, [id]);

  const isDraft = run?.status === 'draft';

  const openEditItem = (item: PayrollItemData) => {
    setEditItemId(item.id);
    setEditBase(Number(item.base_salary) || 0);
    setEditAllowances(Array.isArray(item.allowances) ? item.allowances.map((a: any) => ({ name: a.name, amount: Number(a.amount ?? a.value ?? 0) })) : []);
    setEditDeductions(Array.isArray(item.deductions) ? item.deductions.map((d: any) => ({ name: d.name, amount: Number(d.amount ?? d.value ?? 0) })) : []);
  };

  const applyEditToLocal = () => {
    if (!editItemId) return;
    const allowSum = editAllowances.reduce((s, a) => s + Number(a.amount ?? 0), 0);
    const dedSum = editDeductions.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const gross = editBase + allowSum;
    const net = gross - dedSum;
    setItems((prev) => prev.map((i) => i.id === editItemId
      ? { ...i, base_salary: editBase, allowances: editAllowances, deductions: editDeductions, gross, total_deductions: dedSum, net }
      : i));
    setEditItemId(null);
  };

  const handleSaveRun = async () => {
    if (!id || !isDraft) return;
    setSaving(true);
    try {
      await accountingApi.payroll.updateRun(id, {
        items: items.map((i) => ({
          id: i.id,
          base_salary: i.base_salary,
          allowances: (i.allowances || []).map((a: any) => ({ name: String(a.name ?? ''), amount: Number(a.amount ?? a.value ?? 0) })),
          deductions: (i.deductions || []).map((d: any) => ({ name: String(d.name ?? ''), amount: Number(d.amount ?? d.value ?? 0) })),
          notes: i.notes
        }))
      });
      fetchRun();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const openFinalizeModal = () => {
    if (id && isDraft) setShowFinalizeModal(true);
  };

  const handleFinalize = async () => {
    if (!id || !isDraft) return;
    setShowFinalizeModal(false);
    setFinalizing(true);
    try {
      await accountingApi.payroll.finalizeRun(id);
      fetchRun();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal finalisasi');
    } finally {
      setFinalizing(false);
    }
  };

  const openSlipPdf = async (itemId: string) => {
    if (!id) return;
    try {
      const res = await accountingApi.payroll.getSlipPdf(id, itemId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      alert('Slip tidak tersedia atau belum digenerate.');
    }
  };

  if (!id) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/accounting/payroll/runs')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-emerald-600" />
            Detail Payroll
            {run && (
              <span className="text-lg font-normal text-slate-600">
                — {MONTH_NAMES[run.period_month - 1]} {run.period_year}
                {run.Branch && ` · ${run.Branch.code} - ${run.Branch.name}`}
              </span>
            )}
          </h1>
          <p className="text-slate-600 mt-1">
            {run?.status === 'draft' ? 'Edit item lalu simpan. Klik Finalisasi untuk generate slip dan kirim notifikasi.' : 'Slip gaji telah digenerate.'}
          </p>
        </div>
        {isDraft && (
          <>
            <Button variant="outline" size="sm" onClick={handleSaveRun} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan perubahan'}</Button>
            <Button size="sm" onClick={openFinalizeModal} disabled={finalizing}>{finalizing ? 'Memproses...' : 'Finalisasi Payroll'}</Button>
          </>
        )}
      </div>

      {run && (
        <Card padding="sm" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="font-medium">{run.status === 'draft' ? 'Draft' : run.status === 'finalized' ? 'Final' : run.status}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p className="font-medium">{formatIDR(run.total_amount || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dibuat oleh</p>
            <p className="font-medium">{run.CreatedBy?.name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Finalized</p>
            <p className="font-medium">{run.finalized_at ? new Date(run.finalized_at).toLocaleString('id-ID') : '-'}</p>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-500 py-8 text-center">Memuat...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="pb-2 pr-4">Karyawan</th>
                  <th className="pb-2 pr-4">Gaji pokok</th>
                  <th className="pb-2 pr-4">Tunjangan</th>
                  <th className="pb-2 pr-4">Potongan</th>
                  <th className="pb-2 pr-4">Gross</th>
                  <th className="pb-2 pr-4">Net</th>
                  {isDraft && <th className="pb-2 pr-4 w-24">Edit</th>}
                  {run?.status === 'finalized' && <th className="pb-2 pr-4 w-24">Slip</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium">{item.User?.name || item.user_id}</td>
                    <td className="py-3 pr-4">{formatIDR(Number(item.base_salary) || 0)}</td>
                    <td className="py-3 pr-4">
                      {formatIDR((item.allowances || []).reduce((s: number, a: any) => s + Number(a.amount ?? a.value ?? 0), 0))}
                    </td>
                    <td className="py-3 pr-4">
                      {formatIDR((item.deductions || []).reduce((s: number, d: any) => s + Number(d.amount ?? d.value ?? 0), 0))}
                    </td>
                    <td className="py-3 pr-4">{formatIDR(item.gross || 0)}</td>
                    <td className="py-3 pr-4 font-medium">{formatIDR(item.net || 0)}</td>
                    {isDraft && (
                      <td className="py-3 pr-4">
                        <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>Edit</Button>
                      </td>
                    )}
                    {run?.status === 'finalized' && (
                      <td className="py-3 pr-4">
                        <Button variant="ghost" size="sm" onClick={() => openSlipPdf(item.id)}>
                          <ExternalLink className="w-4 h-4 mr-1" /> Lihat slip
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="text-slate-500 py-8 text-center">Tidak ada item</p>}
          </div>
        )}
      </Card>

      {/* Modal edit item (draft) */}
      {editItemId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditItemId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Edit item payroll</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gaji pokok</label>
                <input type="number" min={0} value={editBase || ''} onChange={(e) => setEditBase(Number(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tunjangan (nama, jumlah)</label>
                {editAllowances.map((a, i) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <input placeholder="Nama" value={a.name || ''} onChange={(e) => setEditAllowances((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="flex-1 border rounded px-2 py-1 text-sm" />
                    <input type="number" placeholder="Jumlah" value={a.amount ?? ''} onChange={(e) => setEditAllowances((p) => p.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} className="w-24 border rounded px-2 py-1 text-sm" />
                  </div>
                ))}
                <button type="button" onClick={() => setEditAllowances((p) => [...p, { name: '', amount: 0 }])} className="text-xs text-emerald-600 mt-1">+ Tunjangan</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Potongan (nama, jumlah)</label>
                {editDeductions.map((d, i) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <input placeholder="Nama" value={d.name || ''} onChange={(e) => setEditDeductions((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="flex-1 border rounded px-2 py-1 text-sm" />
                    <input type="number" placeholder="Jumlah" value={d.amount ?? ''} onChange={(e) => setEditDeductions((p) => p.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} className="w-24 border rounded px-2 py-1 text-sm" />
                  </div>
                ))}
                <button type="button" onClick={() => setEditDeductions((p) => [...p, { name: '', amount: 0 }])} className="text-xs text-emerald-600 mt-1">+ Potongan</button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditItemId(null)}>Batal</Button>
              <Button onClick={applyEditToLocal}>Terapkan</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal konfirmasi finalisasi */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFinalizeModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Finalisasi Payroll</h3>
            <p className="text-slate-600 text-sm mb-6">
              Finalisasi payroll akan generate slip PDF dan mengirim notifikasi ke setiap karyawan. Lanjutkan?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFinalizeModal(false)}>Batal</Button>
              <Button onClick={handleFinalize}>Ya, finalisasi</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollRunDetailPage;
