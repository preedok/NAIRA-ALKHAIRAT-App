import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, RefreshCw, Warehouse, BarChart3 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBox } from '../../../components/common/Modal';
import Input from '../../../components/common/Input';
import Autocomplete from '../../../components/common/Autocomplete';
import { accountingApi, branchesApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';

const AccuratePersediaanPage: React.FC = () => {
  const { showToast } = useToast();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', branch_id: '' });

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.accurate.listWarehouses();
      if (res.data.success && Array.isArray(res.data.data)) setWarehouses(res.data.data);
      else setWarehouses([]);
    } catch {
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  useEffect(() => {
    branchesApi.list({ limit: 500 }).then((r) => {
      if (r.data.success) setBranches(r.data.data || []);
    }).catch(() => setBranches([]));
  }, []);

  const handleCreate = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      showToast('Kode dan nama gudang wajib', 'error');
      return;
    }
    setSaving(true);
    try {
      await accountingApi.accurate.createWarehouse({
        code: form.code.trim(),
        name: form.name.trim(),
        branch_id: form.branch_id || undefined
      });
      showToast('Gudang berhasil ditambah', 'success');
      setModalOpen(false);
      setForm({ code: '', name: '', branch_id: '' });
      fetchWarehouses();
    } catch (e: any) {
      showToast(e.response && e.response.data && e.response.data.message ? e.response.data.message : 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Persediaan / Inventory</h2>
          <p className="text-sm text-slate-600 mt-0.5">Stok masuk–keluar, Multi gudang, Penilaian (FIFO/Average), Minimum stok & laporan mutasi.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Gudang
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100 text-violet-600">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Gudang</p>
              <p className="text-lg font-bold text-slate-900">{warehouses.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 opacity-75">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-500 inline-block">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase mt-2">Stok & Mutasi</p>
          <p className="text-sm text-slate-500">Segera hadir</p>
        </Card>
        <Card className="p-4 border border-slate-200 opacity-75">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-500 inline-block">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase mt-2">Laporan Minimum Stok</p>
          <p className="text-sm text-slate-500">Segera hadir</p>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Daftar Gudang</h3>
          <Button variant="outline" size="sm" onClick={fetchWarehouses} disabled={loading}>
            <RefreshCw className={loading ? 'w-4 h-4 mr-2 animate-spin' : 'w-4 h-4 mr-2'} />
            Refresh
          </Button>
        </div>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : warehouses.length === 0 ? (
          <div className="py-12 text-center text-slate-500">Belum ada gudang. Klik Tambah Gudang untuk menambah.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Kode</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Nama</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Cabang</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-medium">{w.code}</td>
                    <td className="py-3 px-4">{w.name}</td>
                    <td className="py-3 px-4">{w.Branch && w.Branch.name ? w.Branch.name : (w.branch_id || '–')}</td>
                    <td className="py-3 px-4">{w.is_active !== false ? 'Aktif' : 'Nonaktif'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <ModalBox>
          <ModalHeader title="Tambah Gudang" subtitle="Kode, nama gudang, dan cabang (opsional)" icon={<Warehouse className="w-5 h-5" />} onClose={() => setModalOpen(false)} />
          <ModalBody className="space-y-4">
            <Input label="Kode Gudang *" type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="WH-01" />
            <Input label="Nama Gudang *" type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Gudang Utama" />
            <Autocomplete label="Cabang" value={form.branch_id} onChange={(v) => setForm((f) => ({ ...f, branch_id: v }))} options={branches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))} emptyLabel="-- Pilih cabang (opsional) --" />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </ModalFooter>
        </ModalBox>
      </Modal>
    </div>
  );
};

export default AccuratePersediaanPage;
