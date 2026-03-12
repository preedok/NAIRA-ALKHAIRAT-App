import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Search,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBoxLg } from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Table from '../../../components/common/Table';
import { Input, Textarea, ContentLoading } from '../../../components/common';
import type { TableColumn } from '../../../types';
import { rekapHotelApi, type RekapHotelRecord } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';

const SOURCE_TYPES = [
  { value: 'order_list', label: 'Order List (MADINAH/MAKKAH/HAJI)' },
  { value: 'allotment', label: 'Allotment (1447)' },
  { value: 'period_list', label: 'Period List (RAMADHAN)' }
];

const RekapHotelPage: React.FC = () => {
  const { showToast } = useToast();
  const [list, setList] = useState<RekapHotelRecord[]>([]);
  const [options, setOptions] = useState<{ period_names: string[]; season_years: string[]; locations: string[]; statuses: string[]; paket_types: string[]; bandaras: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number }>({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState<{
    source_type: string;
    period_name: string;
    season_year: string;
    client: string;
    location: string;
    status: string;
    paket_type: string;
    bandara: string;
    search: string;
    sort_by: string;
    sort_order: 'ASC' | 'DESC';
  }>({
    source_type: '',
    period_name: '',
    season_year: '',
    client: '',
    location: '',
    status: '',
    paket_type: '',
    bandara: '',
    search: '',
    sort_by: 'sort_order',
    sort_order: 'ASC'
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<RekapHotelRecord>>({ source_type: 'order_list' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    try {
      const res = await rekapHotelApi.getOptions();
      if (res.data.success && res.data.data) setOptions(res.data.data);
    } catch {
      setOptions(null);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order
      };
      if (filters.source_type) params.source_type = filters.source_type;
      if (filters.period_name) params.period_name = filters.period_name;
      if (filters.season_year) params.season_year = filters.season_year;
      if (filters.client) params.client = filters.client;
      if (filters.location) params.location = filters.location;
      if (filters.status) params.status = filters.status;
      if (filters.paket_type) params.paket_type = filters.paket_type;
      if (filters.bandara) params.bandara = filters.bandara;
      if (filters.search) params.search = filters.search;
      const res = await rekapHotelApi.list(params);
      if (res.data.success) {
        setList(res.data.data || []);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal memuat data', 'error');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, showToast]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ source_type: 'order_list', sort_order: 0 });
    setModalOpen(true);
  };

  const openEdit = (row: RekapHotelRecord) => {
    setEditingId(row.id);
    setForm({ ...row });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.source_type) {
      showToast('Pilih tipe sumber', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await rekapHotelApi.update(editingId, form);
        showToast('Data berhasil diupdate', 'success');
      } else {
        await rekapHotelApi.create(form);
        showToast('Data berhasil ditambah', 'success');
      }
      setModalOpen(false);
      fetchList();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus data ini?')) return;
    setDeletingId(id);
    try {
      await rekapHotelApi.remove(id);
      showToast('Data dihapus', 'success');
      fetchList();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menghapus', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Urutan kolom sama dengan spreadsheet HOTEL: No, TNTV, DFNT, CLIENT, HOTEL MEKKAH, IN, OUT, TOTAL HARI, D, T, Q, Qn, Hx, Room, Pax, Meal Plan (BB/FB), Status (Available/Booked/Amend/LUNAS), Voucher, Keterangan, Invoice Clerk, Aksi
  const colDefs: TableColumn[] = [
    { id: 'no', label: 'No' },
    { id: 'tntv', label: 'TNTV' },
    { id: 'dfnt', label: 'DFNT' },
    { id: 'client', label: 'CLIENT' },
    { id: 'hotel_makkah', label: 'HOTEL MEKKAH' },
    { id: 'check_in', label: 'IN' },
    { id: 'check_out', label: 'OUT' },
    { id: 'total_hari', label: 'TOTAL HARI' },
    { id: 'room_d', label: 'D' },
    { id: 'room_t', label: 'T' },
    { id: 'room_q', label: 'Q' },
    { id: 'room_qn', label: 'Qn' },
    { id: 'room_hx', label: 'Hx' },
    { id: 'room', label: 'Room' },
    { id: 'pax', label: 'Pax' },
    { id: 'meal_bb', label: 'BB' },
    { id: 'meal_fb', label: 'FB' },
    { id: 'status_available', label: 'Available' },
    { id: 'status_booked', label: 'Booked' },
    { id: 'status_amend', label: 'Amend' },
    { id: 'status_lunas', label: 'LUNAS' },
    { id: 'voucher', label: 'Voucher' },
    { id: 'keterangan', label: 'Keterangan' },
    { id: 'invoice_clerk', label: 'Invoice Clerk' },
    { id: 'actions', label: 'Aksi' }
  ];

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '–';
    try {
      const x = new Date(d);
      if (isNaN(x.getTime())) return d;
      return x.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const getCell = (r: RekapHotelRecord, colId: string, rowIndex: number) => {
    switch (colId) {
      case 'no': return (pagination.page - 1) * pagination.limit + rowIndex + 1;
      case 'tntv': return r.tentative || '–';
      case 'dfnt': return r.definite || '–';
      case 'client': return r.client || '–';
      case 'hotel_makkah': return r.hotel_makkah || r.hotel_combo || '–';
      case 'check_in': return formatDate(r.check_in);
      case 'check_out': return formatDate(r.check_out);
      case 'total_hari': return r.total_hari != null ? String(r.total_hari) : '–';
      case 'room_d': return r.room_d != null ? String(r.room_d) : '–';
      case 'room_t': return r.room_t != null ? String(r.room_t) : '–';
      case 'room_q': return r.room_q != null ? String(r.room_q) : '–';
      case 'room_qn': return r.room_qn != null ? String(r.room_qn) : '–';
      case 'room_hx': return r.room_hx != null ? String(r.room_hx) : '–';
      case 'room': return r.room != null ? String(r.room) : '–';
      case 'pax': return r.pax != null ? String(r.pax) : '–';
      case 'meal_bb': return r.meal_bb ? '✓' : '–';
      case 'meal_fb': return r.meal_fb ? '✓' : '–';
      case 'status_available': return r.status_available ? '✓' : '–';
      case 'status_booked': return r.status_booked ? '✓' : '–';
      case 'status_amend': return r.status_amend ? '✓' : '–';
      case 'status_lunas': return r.status_lunas ? '✓' : '–';
      case 'voucher': return r.voucher || '–';
      case 'keterangan': return r.keterangan || r.notes || '–';
      case 'invoice_clerk': return r.invoice_clerk || '–';
      case 'actions':
        return (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Edit">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id} title="Hapus" className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      default: return '–';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Hotel"
        subtitle="Input dan rekap data orderan hotel (MADINAH, MAKKAH, HAJI, ALLOTMENT, RAMADHAN). Modul standalone."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-1" />
              Filter {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </Button>
            <Button onClick={fetchList} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Tambah Data
            </Button>
          </div>
          <div className="text-sm text-slate-600">
            Total: <span className="font-semibold">{pagination.total}</span> baris
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipe Sumber</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={filters.source_type}
                onChange={(e) => setFilters((f) => ({ ...f, source_type: e.target.value }))}
              >
                <option value="">Semua</option>
                {SOURCE_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Periode</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={filters.period_name}
                onChange={(e) => setFilters((f) => ({ ...f, period_name: e.target.value }))}
              >
                <option value="">Semua</option>
                {(options?.period_names || []).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tahun</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={filters.season_year}
                onChange={(e) => setFilters((f) => ({ ...f, season_year: e.target.value }))}
              >
                <option value="">Semua</option>
                {(options?.season_years || []).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Lokasi</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={filters.location}
                onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
              >
                <option value="">Semua</option>
                {(options?.locations || []).map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">Semua</option>
                {(options?.statuses || []).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cari (client/hotel/ref)</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && fetchList()}
              />
            </div>
            <div className="col-span-2 md:col-span-4 lg:col-span-6 flex gap-2">
              <Button size="sm" onClick={fetchList}>Terapkan Filter</Button>
              <Button size="sm" variant="outline" onClick={() => setFilters({ ...filters, source_type: '', period_name: '', season_year: '', client: '', location: '', status: '', paket_type: '', bandara: '', search: '', sort_by: 'sort_order', sort_order: 'ASC' })}>
                Reset
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <ContentLoading />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table
                columns={colDefs}
                data={list}
                renderRow={(item, rowIndex) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    {colDefs.map((col) => (
                      <td key={col.id} className="py-2 px-3 whitespace-nowrap text-slate-700 border-b border-slate-100">
                        {getCell(item, col.id, rowIndex)}
                      </td>
                    ))}
                  </tr>
                )}
                emptyMessage="Belum ada data rekap hotel"
                stickyActionsColumn
              />
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                <span className="text-sm text-slate-600">
                  Halaman {pagination.page} dari {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>
                    Sebelumnya
                  </Button>
                  <Button size="sm" variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <ModalBoxLg>
          <ModalHeader title={editingId ? 'Edit Rekap Hotel' : 'Tambah Rekap Hotel'} onClose={() => setModalOpen(false)} />
          <ModalBody className="max-h-[70vh] overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Sumber *</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  value={form.source_type || 'order_list'}
                  onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value as any }))}
                >
                  {SOURCE_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="TNTV" value={form.tentative || '' || ''} onChange={(e) => setForm((f) => ({ ...f, tentative: e.target.value }))} placeholder="6675" />
                <Input label="DFNT" value={form.definite || ''} onChange={(e) => setForm((f) => ({ ...f, definite: e.target.value }))} placeholder="4746" />
                <Input label="CLIENT" value={form.client || ''} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} placeholder="Nama client" />
                <Input label="HOTEL MEKKAH" value={form.hotel_makkah || ''} onChange={(e) => setForm((f) => ({ ...f, hotel_makkah: e.target.value }))} placeholder="hilton, taiba suite" />
                <Input label="IN (Check-in)" type="date" value={form.check_in || ''} onChange={(e) => setForm((f) => ({ ...f, check_in: e.target.value || undefined }))} />
                <Input label="OUT (Check-out)" type="date" value={form.check_out || ''} onChange={(e) => setForm((f) => ({ ...f, check_out: e.target.value || undefined }))} />
                <Input label="TOTAL HARI" type="number" value={form.total_hari != null ? String(form.total_hari) : ''} onChange={(e) => setForm((f) => ({ ...f, total_hari: e.target.value ? parseInt(e.target.value, 10) : undefined }))} placeholder="3" />
                <Input label="D" type="number" value={form.room_d != null ? String(form.room_d) : ''} onChange={(e) => setForm((f) => ({ ...f, room_d: e.target.value ? parseInt(e.target.value, 10) : undefined }))} />
                <Input label="T" type="number" value={form.room_t != null ? String(form.room_t) : ''} onChange={(e) => setForm((f) => ({ ...f, room_t: e.target.value ? parseInt(e.target.value, 10) : undefined }))} />
                <Input label="Q" type="number" value={form.room_q != null ? String(form.room_q) : ''} onChange={(e) => setForm((f) => ({ ...f, room_q: e.target.value ? parseInt(e.target.value, 10) : undefined }))} />
                <Input label="Qn" type="number" value={form.room_qn != null ? String(form.room_qn) : ''} onChange={(e) => setForm((f) => ({ ...f, room_qn: e.target.value ? parseInt(e.target.value, 10) : undefined }))} />
                <Input label="Hx" type="number" value={form.room_hx != null ? String(form.room_hx) : ''} onChange={(e) => setForm((f) => ({ ...f, room_hx: e.target.value ? parseInt(e.target.value, 10) : undefined }))} />
                <Input label="Room" type="number" value={form.room != null ? String(form.room) : ''} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value ? parseInt(e.target.value, 10) : undefined }))} placeholder="Jumlah kamar" />
                <Input label="Hotel Madinah" value={form.hotel_madinah || ''} onChange={(e) => setForm((f) => ({ ...f, hotel_madinah: e.target.value }))} placeholder="Nama hotel Madinah" />
                <Input label="Hotel Combo" value={form.hotel_combo || ''} onChange={(e) => setForm((f) => ({ ...f, hotel_combo: e.target.value }))} placeholder="Villa Hilton/taiba suite" />
                <Input label="Nama Hotel (Allotment)" value={form.hotel_name || ''} onChange={(e) => setForm((f) => ({ ...f, hotel_name: e.target.value }))} placeholder="Snood, Nada Deafa" />
                <Input label="Lokasi" value={form.location || ''} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="mekkah, madinah" />
                <Input label="Pax" type="number" value={form.pax != null ? String(form.pax) : ''} onChange={(e) => setForm((f) => ({ ...f, pax: e.target.value ? parseInt(e.target.value, 10) : undefined }))} placeholder="10" />
                <Input label="Total Room" value={form.total_room || ''} onChange={(e) => setForm((f) => ({ ...f, total_room: e.target.value }))} placeholder="60" />
                <Input label="Paket / Paket Type" value={form.paket_type || form.paket_label || form.paket || ''} onChange={(e) => setForm((f) => ({ ...f, paket_type: e.target.value, paket_label: e.target.value, paket: e.target.value }))} placeholder="arofah, safa" />
                <Input label="Bandara" value={form.bandara || ''} onChange={(e) => setForm((f) => ({ ...f, bandara: e.target.value }))} placeholder="CGK, BTH" />
                <Input label="KET" value={form.ket || ''} onChange={(e) => setForm((f) => ({ ...f, ket: e.target.value }))} placeholder="dakhili" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.meal_bb} onChange={(e) => setForm((f) => ({ ...f, meal_bb: e.target.checked }))} className="rounded border-slate-300" />
                  <span className="text-sm font-medium text-slate-700">BB</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.meal_fb} onChange={(e) => setForm((f) => ({ ...f, meal_fb: e.target.checked }))} className="rounded border-slate-300" />
                  <span className="text-sm font-medium text-slate-700">FB</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.status_available} onChange={(e) => setForm((f) => ({ ...f, status_available: e.target.checked }))} className="rounded border-slate-300" />
                  <span className="text-sm font-medium text-slate-700">Available</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.status_booked} onChange={(e) => setForm((f) => ({ ...f, status_booked: e.target.checked }))} className="rounded border-slate-300" />
                  <span className="text-sm font-medium text-slate-700">Booked</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.status_amend} onChange={(e) => setForm((f) => ({ ...f, status_amend: e.target.checked }))} className="rounded border-slate-300" />
                  <span className="text-sm font-medium text-slate-700">Amend</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.status_lunas} onChange={(e) => setForm((f) => ({ ...f, status_lunas: e.target.checked }))} className="rounded border-slate-300" />
                  <span className="text-sm font-medium text-slate-700">LUNAS</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Voucher" value={form.voucher || ''} onChange={(e) => setForm((f) => ({ ...f, voucher: e.target.value }))} />
                <Input label="Invoice Clerk" value={form.invoice_clerk || ''} onChange={(e) => setForm((f) => ({ ...f, invoice_clerk: e.target.value }))} />
              </div>
              <Input label="Keterangan" value={form.keterangan || form.notes || ''} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value, notes: e.target.value }))} placeholder="Remarks" />
              <div className="border-t border-slate-200 pt-4 mt-4 grid grid-cols-2 gap-3">
                <Input label="Periode" value={form.period_name || ''} onChange={(e) => setForm((f) => ({ ...f, period_name: e.target.value }))} placeholder="HAJI 2026" />
                <Input label="Tahun" value={form.season_year || ''} onChange={(e) => setForm((f) => ({ ...f, season_year: e.target.value }))} />
                <Input label="Ref Number" value={form.ref_number || ''} onChange={(e) => setForm((f) => ({ ...f, ref_number: e.target.value }))} />
                <Input label="Status (teks)" value={form.status || ''} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} />
                <Input label="Paket Type" value={form.paket_type || ''} onChange={(e) => setForm((f) => ({ ...f, paket_type: e.target.value }))} />
                <Input label="Bandara" value={form.bandara || ''} onChange={(e) => setForm((f) => ({ ...f, bandara: e.target.value }))} />
                <Input label="KET" value={form.ket || ''} onChange={(e) => setForm((f) => ({ ...f, ket: e.target.value }))} />
                <Input label="Total Room (Allotment)" value={form.total_room || ''} onChange={(e) => setForm((f) => ({ ...f, total_room: e.target.value }))} />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </ModalFooter>
        </ModalBoxLg>
      </Modal>
    </div>
  );
};

export default RekapHotelPage;
