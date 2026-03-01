import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import ActionsMenu from '../../../components/common/ActionsMenu';
import { Input, Checkbox } from '../../../components/common';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { superAdminApi } from '../../../services/api';

interface Notice {
  id: string;
  title: string;
  message: string;
  type: string;
  is_active: boolean;
  block_app: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  CreatedBy?: { name: string; email: string };
}

export const SuperAdminMaintenancePage: React.FC = () => {
  const [list, setList] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState({ title: '', message: '', block_app: false, starts_at: '', ends_at: '' });
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.listMaintenance();
      if (res.data.success) setList(res.data.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', message: '', block_app: false, starts_at: '', ends_at: '' });
    setModalOpen(true);
  };

  const openEdit = (n: Notice) => {
    setEditing(n);
    const blockApp = !!(n.block_app ?? (n as any).blockApp);
    setForm({
      title: n.title,
      message: n.message,
      block_app: blockApp,
      starts_at: n.starts_at ? n.starts_at.slice(0, 16) : '',
      ends_at: n.ends_at ? n.ends_at.slice(0, 16) : ''
    });
    setModalOpen(true);
  };

  const getNoticeStatus = (n: Notice) => {
    const blockApp = !!(n.block_app ?? (n as any).blockApp);
    const now = new Date();
    const startsAt = n.starts_at ? new Date(n.starts_at) : null;
    const endsAt = n.ends_at ? new Date(n.ends_at) : null;
    if (blockApp) return 'blocking';
    if (startsAt && now >= startsAt && (!endsAt || now <= endsAt)) return 'blocking';
    if (endsAt && now > endsAt) return 'ended';
    if (startsAt && now < startsAt) return 'upcoming';
    return 'upcoming';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.block_app && !form.starts_at.trim()) {
      alert('Jika tidak centang Blokir akses, wajib isi tanggal/jam mulai.');
      return;
    }
    setSubmitLoading(true);
    try {
      if (editing) {
        await superAdminApi.updateMaintenance(editing.id, {
          title: form.title,
          message: form.message,
          block_app: form.block_app,
          starts_at: form.block_app ? null : (form.starts_at || null),
          ends_at: form.block_app ? null : (form.ends_at || null)
        });
      } else {
        await superAdminApi.createMaintenance({
          title: form.title,
          message: form.message,
          block_app: form.block_app,
          starts_at: form.block_app ? undefined : (form.starts_at || undefined),
          ends_at: form.block_app ? undefined : (form.ends_at || undefined)
        });
      }
      setModalOpen(false);
      fetchList();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan pemberitahuan.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus pemberitahuan ini?')) return;
    try {
      await superAdminApi.deleteMaintenance(id);
      fetchList();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Maintenance & Notices</h1>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Notice
        </Button>
      </div>

      <Card>
        <p className="text-sm text-slate-600 mb-4">Pemberitahuan pemeliharaan atau bug akan ditampilkan ke semua pengguna aplikasi.</p>
        {loading ? (
          <div className="py-8 text-center text-slate-500"><RefreshCw className="w-6 h-6 animate-spin inline" /></div>
        ) : list.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Belum ada pemberitahuan.</div>
        ) : (
          <div className="space-y-3">
            {list.map((n) => {
              const status = getNoticeStatus(n);
              const actionItems: ActionsMenuItem[] = [
                { id: 'edit', label: 'Ubah', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(n) },
                { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDelete(n.id), danger: true }
              ];
              return (
                <div key={n.id} className="p-4 border border-slate-200 rounded-xl flex flex-wrap justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900">{n.title}</h3>
                      {!!(n.block_app ?? (n as any).blockApp) && (
                        <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">Blokir akses (langsung)</span>
                      )}
                      {status === 'upcoming' && n.starts_at && (
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">Jadwal: {new Date(n.starts_at).toLocaleString('id-ID')}</span>
                      )}
                      {status === 'blocking' && (
                        <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">Pemeliharaan sedang berlangsung</span>
                      )}
                      {status === 'ended' && (
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800">Pemeliharaan selesai</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {n.starts_at && `Mulai: ${new Date(n.starts_at).toLocaleString('id-ID')}`}
                      {n.ends_at && ` — Selesai: ${new Date(n.ends_at).toLocaleString('id-ID')}`}
                      {n.CreatedBy && ` · Oleh: ${n.CreatedBy.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ActionsMenu items={actionItems} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">{editing ? 'Edit Notice' : 'New Notice'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Title" type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} fullWidth required />
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Pesan</label>
                <textarea
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[100px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#0D1A63] focus:border-[#0D1A63] disabled:bg-slate-100"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  required
                />
              </div>
              <Checkbox label="Blokir akses aplikasi" checked={form.block_app} onChange={(e) => setForm((f) => ({ ...f, block_app: e.target.checked, ...(e.target.checked ? { starts_at: '', ends_at: '' } : {}) }))} />
              <p className="text-xs text-slate-500 -mt-2">Jika dicentang: seluruh role (kecuali Super Admin) langsung melihat halaman maintenance. Tanggal tidak dipakai.</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Tanggal/jam mulai" type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} disabled={form.block_app} fullWidth />
                <Input label="Tanggal/jam selesai (opsional)" type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} disabled={form.block_app} fullWidth />
              </div>
              {!form.block_app && (
                <p className="text-xs text-slate-500">Wajib isi tanggal mulai. Sebelum tanggal tiba: alert pemberitahuan di setiap halaman. Saat tanggal tiba: halaman maintenance full otomatis untuk semua role.</p>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitLoading}>{submitLoading ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </div>
      </Modal>
    </div>
  );
};

export default SuperAdminMaintenancePage;
