import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/common/Input';

interface PackageItem {
  id: string;
  name: string;
  sku?: string;
  base_price?: number;
  duration_days?: number;
  is_active?: boolean;
}

const PackagesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ name: '', sku: '', base_price: '', duration_days: '' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/products');
      setItems(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat data paket');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((x) => `${x.name || ''} ${x.sku || ''}`.toLowerCase().includes(keyword));
  }, [items, q]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Nama paket wajib diisi');
    setSaving(true);
    setError('');
    try {
      await api.post('/products', {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        base_price: Number(form.base_price || 0),
        duration_days: Number(form.duration_days || 0),
        is_active: true
      });
      setForm({ name: '', sku: '', base_price: '', duration_days: '' });
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal membuat paket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Paket Umroh" subtitle="Kelola katalog paket dan tampilkan pilihan paket terbaik untuk jamaah." />

      <Card padding="sm">
        <Input name="q" placeholder="Cari nama / kode paket" value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>

      {isAdmin && (
        <Card>
          <h3 className="font-semibold text-stone-900 mb-3">Tambah Paket</h3>
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input name="name" label="Nama Paket" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <Input name="sku" label="Kode Paket" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
            <Input name="base_price" label="Harga Dasar (IDR)" value={form.base_price} onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))} />
            <Input name="duration_days" label="Durasi (hari)" value={form.duration_days} onChange={(e) => setForm((p) => ({ ...p, duration_days: e.target.value }))} />
            <div className="md:col-span-4">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-btn text-white hover:bg-btn-hover disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Simpan Paket'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <Card padding="sm">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3">Nama Paket</th>
                <th className="text-left px-4 py-3">Kode</th>
                <th className="text-right px-4 py-3">Harga</th>
                <th className="text-right px-4 py-3">Durasi</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-500">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-500">Belum ada paket</td></tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="border-b border-stone-100">
                  <td className="px-4 py-3 font-medium text-stone-900">{item.name}</td>
                  <td className="px-4 py-3 text-stone-600">{item.sku || '-'}</td>
                  <td className="px-4 py-3 text-right text-stone-700">Rp {Number(item.base_price || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-right text-stone-700">{item.duration_days || 0} hari</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
                      {item.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default PackagesPage;
