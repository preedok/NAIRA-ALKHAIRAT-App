import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, RefreshCw, ChevronRight, Calculator, Trash2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import { accountingApi, branchesApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { formatIDR } from '../../../utils';

const formatDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–');

const AccurateAsetTetapPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [depreciationAssetId, setDepreciationAssetId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [form, setForm] = useState({
    asset_code: '',
    asset_name: '',
    category: '',
    purchase_date: '',
    acquisition_cost: '',
    residual_value: '',
    useful_life_years: '1',
    depreciation_method: 'straight_line'
  });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.accurate.listFixedAssets();
      if (res.data.success && res.data.data) setList(res.data.data);
      else setList([]);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => {
    branchesApi.list({ limit: 500 }).then((r) => { if (r.data.success) setBranches(r.data.data || []); }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.asset_code.trim() || !form.asset_name.trim()) {
      showToast('Kode dan nama aset wajib', 'error');
      return;
    }
    setSaving(true);
    try {
      await accountingApi.accurate.createFixedAsset({
        asset_code: form.asset_code.trim(),
        asset_name: form.asset_name.trim(),
        category: form.category || undefined,
        purchase_date: form.purchase_date || undefined,
        acquisition_cost: parseFloat(form.acquisition_cost) || 0,
        residual_value: parseFloat(form.residual_value) || 0,
        useful_life_years: parseInt(form.useful_life_years, 10) || 1,
        depreciation_method: form.depreciation_method
      });
      showToast('Aset tetap berhasil ditambah', 'success');
      setModalOpen(false);
      setForm({ asset_code: '', asset_name: '', category: '', purchase_date: '', acquisition_cost: '', residual_value: '', useful_life_years: '1', depreciation_method: 'straight_line' });
      fetchList();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCalculateDepreciation = async (id: string) => {
    setDepreciationAssetId(id);
    setSchedule([]);
    try {
      const res = await accountingApi.accurate.calculateDepreciation(id);
      if (res.data.success && res.data.data?.schedule) {
        setSchedule(res.data.data.schedule);
        showToast(res.data.data.message || 'Penyusutan dihitung', 'success');
      }
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menghitung', 'error');
      setDepreciationAssetId(null);
    }
  };

  const openSchedule = (id: string) => {
    setDepreciationAssetId(id);
    setSchedule([]);
    accountingApi.accurate.getDepreciationSchedule(id).then((r) => {
      if (r.data.success && r.data.data) setSchedule(r.data.data);
    }).catch(() => setSchedule([])).finally(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button type="button" onClick={() => navigate('/dashboard')} className="hover:text-slate-700">Dashboard</button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-700 font-medium">Aset Tetap</span>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Aset
        </Button>
      </div>

      <Card className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80">
          <h2 className="text-lg font-semibold text-slate-900">Daftar Aset Tetap</h2>
          <p className="text-sm text-slate-500 mt-0.5">Pencatatan aset dan penyusutan otomatis (straight line)</p>
        </div>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center text-slate-500">Belum ada aset. Klik Tambah Aset untuk menambah.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Kode</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Nama</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Tgl Beli</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Nilai Beli</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Residu</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Umur (th)</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-medium">{a.asset_code}</td>
                    <td className="py-3 px-4">{a.asset_name}</td>
                    <td className="py-3 px-4 text-slate-600">{formatDate(a.purchase_date)}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatIDR(Number(a.acquisition_cost))}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatIDR(Number(a.residual_value))}</td>
                    <td className="py-3 px-4 text-center">{a.useful_life_years}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openSchedule(a.id)} title="Lihat jadwal penyusutan">
                          Lihat Jadwal
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCalculateDepreciation(a.id)} disabled={depreciationAssetId === a.id} title="Hitung penyusutan">
                          {depreciationAssetId === a.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                          Hitung
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Tambah Aset Tetap</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kode Aset *</label>
              <input type="text" value={form.asset_code} onChange={(e) => setForm((f) => ({ ...f, asset_code: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="AT-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama Aset *</label>
              <input type="text" value={form.asset_name} onChange={(e) => setForm((f) => ({ ...f, asset_name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Komputer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kategori</label>
              <input type="text" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Elektronik" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Beli</label>
              <input type="date" value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nilai Perolehan (IDR)</label>
                <input type="number" min={0} value={form.acquisition_cost} onChange={(e) => setForm((f) => ({ ...f, acquisition_cost: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nilai Residu (IDR)</label>
                <input type="number" min={0} value={form.residual_value} onChange={(e) => setForm((f) => ({ ...f, residual_value: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Umur Ekonomis (tahun)</label>
                <input type="number" min={1} value={form.useful_life_years} onChange={(e) => setForm((f) => ({ ...f, useful_life_years: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Metode</label>
                <select value={form.depreciation_method} onChange={(e) => setForm((f) => ({ ...f, depreciation_method: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="straight_line">Straight Line</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={depreciationAssetId !== null} onClose={() => { setDepreciationAssetId(null); setSchedule([]); }}>
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Jadwal Penyusutan</h2>
          {schedule.length === 0 ? (
            <p className="text-slate-500 text-sm">Belum ada jadwal. Klik &quot;Hitung&quot; di baris aset untuk menghasilkan jadwal.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-2 px-3">Periode</th>
                    <th className="text-right py-2 px-3">Penyusutan</th>
                    <th className="text-right py-2 px-3">Akumulasi</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row: any) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="py-2 px-3">{row.period_label}</td>
                      <td className="py-2 px-3 text-right">{formatIDR(Number(row.depreciation_amount))}</td>
                      <td className="py-2 px-3 text-right">{formatIDR(Number(row.accumulated_depreciation))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => { setDepreciationAssetId(null); setSchedule([]); }}>Tutup</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AccurateAsetTetapPage;
