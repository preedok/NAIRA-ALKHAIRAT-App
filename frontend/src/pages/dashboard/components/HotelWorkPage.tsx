import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, ClipboardList, Building2, Filter, Search, Hotel, CheckCircle, DoorOpen, ListChecks, X, User, MapPin, Calendar, UtensilsCrossed, FileText } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
import { hotelApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { formatInvoiceDisplay } from '../../../utils';

const STATUS_OPTIONS = [
  { value: 'waiting_confirmation', label: 'Progress' },
  { value: 'confirmed', label: 'Penetapan room' },
  { value: 'room_assigned', label: 'Pemberian nomor room' },
  { value: 'completed', label: 'Selesai' }
];

const JAMAAH_STATUS_LABELS: Record<string, string> = {
  belum_masuk: 'Belum masuk room',
  sudah_masuk_room: 'Sudah masuk room',
  keluar_room: 'Keluar room'
};

const MEAL_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Dikonfirmasi' },
  { value: 'completed', label: 'Selesai' }
];

const formatDate = (d: string | null | undefined) => {
  if (!d) return '–';
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '–';
  }
};

const formatDateWithTime = (d: string | null | undefined, time: string | null | undefined) => {
  const dateStr = formatDate(d);
  if (dateStr === '–') return '–';
  const t = (time || '').trim();
  if (!t) return dateStr;
  return `${dateStr}, ${t}`;
};

const HotelWorkPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice');
  const { showToast } = useToast();

  const [dashboard, setDashboard] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<string>('');
  const [filterProgressStatus, setFilterProgressStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await hotelApi.getDashboard();
      if (res.data.success && res.data.data) setDashboard(res.data.data);
      else setDashboard(null);
    } catch (e: any) {
      setDashboard(null);
      const msg = e.response?.data?.message;
      if (e.response?.status === 403 && msg) showToast(msg, 'error');
    }
  }, [showToast]);

  const fetchInvoices = useCallback(async () => {
    try {
      const params = filterInvoiceStatus ? { status: filterInvoiceStatus } : {};
      const res = await hotelApi.listInvoices(params);
      if (res.data.success) setInvoices(res.data.data || []);
      else setInvoices([]);
    } catch (e: any) {
      setInvoices([]);
      const msg = e.response?.data?.message;
      if (e.response?.status === 403 && msg) showToast(msg, 'error');
    }
  }, [showToast, filterInvoiceStatus]);

  const refetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchInvoices()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchInvoices]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (invoiceIdParam) {
      hotelApi.getInvoice(invoiceIdParam)
        .then((res: any) => res.data.success && setDetailInvoice(res.data.data))
        .catch(() => setDetailInvoice(null));
    } else {
      setDetailInvoice(null);
    }
  }, [invoiceIdParam]);

  const handleUpdateProgress = async (orderItemId: string, payload: { status?: string; room_number?: string; meal_status?: string; check_in_date?: string; check_out_date?: string; check_in_time?: string; check_out_time?: string; notes?: string }) => {
    setUpdatingId(orderItemId);
    try {
      await hotelApi.updateItemProgress(orderItemId, payload);
      if (detailInvoice?.id) {
        const res = await hotelApi.getInvoice(detailInvoice.id);
        if (res.data.success) setDetailInvoice(res.data.data);
      }
      refetchAll();
      showToast('Status hotel berhasil diupdate.', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const hotelItems = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'hotel') || [];
  const byStatus = dashboard?.by_status ?? { waiting_confirmation: 0, confirmed: 0, room_assigned: 0, completed: 0 };
  const totalInvoices = dashboard?.total_orders ?? 0;
  const totalItems = dashboard?.total_hotel_items ?? 0;

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    const q = (filterSearch || '').trim().toLowerCase();
    if (q) {
      list = list.filter((inv: any) => {
        const invNum = (inv.invoice_number || '').toLowerCase();
        const orderNum = (inv.Order?.order_number || '').toLowerCase();
        const owner = (inv.User?.name || inv.User?.company_name || inv.Order?.User?.name || '').toLowerCase();
        const branch = (inv.Branch?.name || inv.Branch?.code || '').toLowerCase();
        return invNum.includes(q) || orderNum.includes(q) || owner.includes(q) || branch.includes(q);
      });
    }
    if (filterProgressStatus) {
      list = list.filter((inv: any) => {
        const orderItems = inv.Order?.OrderItems || [];
        return orderItems.some((i: any) => (i.HotelProgress?.status || 'waiting_confirmation') === filterProgressStatus);
      });
    }
    return list;
  }, [invoices, filterSearch, filterProgressStatus]);

  const tableColumns: TableColumn[] = [
    { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
    { id: 'order_number', label: 'No. Order', align: 'left' },
    { id: 'owner', label: 'Yang memesan', align: 'left' },
    { id: 'branch', label: 'Cabang', align: 'left' },
    { id: 'invoice_date', label: 'Tgl Invoice', align: 'left' },
    { id: 'invoice_status', label: 'Status Invoice', align: 'left' },
    { id: 'hotel_count', label: 'Jml Item Hotel', align: 'center' },
    { id: 'check_in', label: 'Check-in', align: 'left' },
    { id: 'check_out', label: 'Check-out', align: 'left' },
    { id: 'progress_summary', label: 'Status Progress', align: 'left' },
    { id: 'actions', label: 'Aksi', align: 'center' }
  ];

  const hasHotelInvoices = filteredInvoices.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Progress Hotel</h1>
          <p className="text-slate-600 text-sm mt-1 max-w-xl">Order hotel: status progress → penetapan room → pemberian nomor room. Status jamaah (sudah masuk / keluar room) otomatis dari tanggal & jam check-in/check-out.</p>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />
      </div>

      {/* Stat cards — modern grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Invoice</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{loading ? '–' : totalInvoices}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Item Hotel</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{loading ? '–' : totalItems}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-2xl border border-amber-200 shadow-sm bg-gradient-to-br from-amber-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Progress</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{loading ? '–' : (byStatus.waiting_confirmation ?? 0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-2xl border border-sky-200 shadow-sm bg-gradient-to-br from-sky-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-600">
              <Hotel className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-sky-700 uppercase tracking-wide">Penetapan room</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{loading ? '–' : (byStatus.confirmed ?? 0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-2xl border border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">No. room</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{loading ? '–' : (byStatus.room_assigned ?? 0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-2xl border border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Selesai</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{loading ? '–' : (byStatus.completed ?? 0)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <Card className="p-4 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filter
        </h3>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Status Invoice</label>
            <select value={filterInvoiceStatus} onChange={(e) => setFilterInvoiceStatus(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white">
              <option value="">Semua status</option>
              {Object.entries(INVOICE_STATUS_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Status Progress</label>
            <select value={filterProgressStatus} onChange={(e) => setFilterProgressStatus(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white">
              <option value="">Semua progress</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Cari (invoice / order / owner / cabang)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Ketik untuk filter..." className="w-full text-sm border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => { setFilterInvoiceStatus(''); setFilterProgressStatus(''); setFilterSearch(''); }}>Reset filter</Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80">
          <h2 className="text-lg font-semibold text-slate-900">Daftar Invoice Hotel</h2>
          <p className="text-sm text-slate-500 mt-0.5">{filteredInvoices.length} invoice · Gunakan filter di atas untuk mempersempit hasil</p>
        </div>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : !hasHotelInvoices ? (
          <div className="py-12 text-center text-slate-500 px-4">Belum ada invoice dengan item hotel di cabang Anda. Buat order & invoice dari menu Order/Invoice terlebih dahulu.</div>
        ) : (
          <Table
            columns={tableColumns}
            data={filteredInvoices}
            emptyMessage="Tidak ada invoice sesuai filter"
            stickyActionsColumn
            renderRow={(inv: any) => {
              const o = inv.Order;
              const orderItems = o?.OrderItems || [];
              const hotelItemsList = orderItems.filter((i: any) => i.type === 'hotel');
              const hotelCount = hotelItemsList.length;
              const statusCounts: Record<string, number> = {};
              hotelItemsList.forEach((i: any) => {
                const st = i.HotelProgress?.status || 'waiting_confirmation';
                statusCounts[st] = (statusCounts[st] || 0) + 1;
              });
              const summaryParts = STATUS_OPTIONS.filter(s => (statusCounts[s.value] || 0) > 0).map(s => `${statusCounts[s.value]} ${s.label}`);
              const progressSummary = summaryParts.length ? summaryParts.join(', ') : '–';
              const invStatusLabel = INVOICE_STATUS_LABELS[inv.status] || inv.status;
              const firstHotel = hotelItemsList[0];
              const checkInDate = firstHotel?.HotelProgress?.check_in_date ?? firstHotel?.meta?.check_in;
              const checkInTime = firstHotel?.HotelProgress?.check_in_time ?? firstHotel?.meta?.check_in_time;
              const checkOutDate = firstHotel?.HotelProgress?.check_out_date ?? firstHotel?.meta?.check_out;
              const checkOutTime = firstHotel?.HotelProgress?.check_out_time ?? firstHotel?.meta?.check_out_time;
              const checkInDisplay = formatDateWithTime(checkInDate, checkInTime);
              const checkOutDisplay = formatDateWithTime(checkOutDate, checkOutTime);
              return (
                <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-800 text-sm">{formatInvoiceDisplay(inv.status, inv.invoice_number ?? '', INVOICE_STATUS_LABELS)}</td>
                  <td className="py-3 px-4 font-mono text-slate-700 text-sm">{o?.order_number ?? '–'}</td>
                  <td className="py-3 px-4 text-slate-700 text-sm">{inv.User?.name ?? inv.User?.company_name ?? o?.User?.name ?? '–'}</td>
                  <td className="py-3 px-4 text-slate-700 text-sm">{inv.Branch?.name ?? inv.Branch?.code ?? '–'}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm whitespace-nowrap">{formatDate(inv.issued_at || inv.created_at)}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">{invStatusLabel}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-900 tabular-nums">{hotelCount}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm whitespace-nowrap">{checkInDisplay}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm whitespace-nowrap">{checkOutDisplay}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm">{progressSummary}</td>
                  <td className="py-3 px-4 sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                    <Button size="sm" variant="outline" onClick={() => setSearchParams({ invoice: inv.id })}>
                      <Eye className="w-4 h-4 mr-1" /> Detail
                    </Button>
                  </td>
                </tr>
              );
            }}
          />
        )}
      </Card>

      <Modal open={!!detailInvoice} onClose={() => setSearchParams({})}>
        {detailInvoice && (
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-5 pb-4 border-b border-slate-200 bg-white rounded-t-2xl">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-900 truncate">
                  {formatInvoiceDisplay(detailInvoice.status, detailInvoice.invoice_number ?? '', INVOICE_STATUS_LABELS)}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name ?? '–'}
                  </span>
                  {(detailInvoice.Branch?.name || detailInvoice.Branch?.code) && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      {detailInvoice.Branch?.name ?? detailInvoice.Branch?.code}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setSearchParams({})} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors shrink-0" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
              <p className="text-sm text-slate-500">
                {hotelItems.length} item hotel · Perbarui status, nomor kamar, dan jadwal di bawah.
              </p>

              {hotelItems.map((item: any, idx: number) => {
                const prog = item.HotelProgress;
                const status = prog?.status || 'waiting_confirmation';
                const mealStatus = prog?.meal_status || 'pending';
                const jamaahStatus = item.jamaah_status || prog?.jamaah_status;
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/40 shadow-sm overflow-hidden">
                    {/* Item card header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-600 text-sm font-semibold">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900">Item Hotel · Qty: {item.quantity}</span>
                      </div>
                      {jamaahStatus && (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${jamaahStatus === 'keluar_room' ? 'bg-slate-100 text-slate-700' : jamaahStatus === 'sudah_masuk_room' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {JAMAAH_STATUS_LABELS[jamaahStatus] ?? jamaahStatus}
                        </span>
                      )}
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Status Pekerjaan & Nomor Kamar — satu baris di desktop */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">
                            <ListChecks className="w-3.5 h-3.5 text-slate-400" /> Status Pekerjaan
                          </label>
                          <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" value={status} onChange={(e) => handleUpdateProgress(item.id, { status: e.target.value })} disabled={updatingId === item.id}>
                            {STATUS_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">
                            <DoorOpen className="w-3.5 h-3.5 text-slate-400" /> Nomor Kamar
                          </label>
                          <input type="text" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-slate-400" placeholder="Contoh: 101" defaultValue={prog?.room_number ?? ''} onBlur={(e) => { const v = e.target.value?.trim(); if (v !== (prog?.room_number ?? '')) handleUpdateProgress(item.id, { room_number: v || undefined }); }} disabled={updatingId === item.id} />
                        </div>
                      </div>

                      {/* Status Makan */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-slate-400" /> Status Makan
                        </label>
                        <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" value={mealStatus} onChange={(e) => handleUpdateProgress(item.id, { meal_status: e.target.value })} disabled={updatingId === item.id}>
                          {MEAL_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                        </select>
                      </div>

                      {/* Check-in / Check-out — tanggal dari order (tampil saja), jam bisa diatur role hotel */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> Check-in & Check-out
                        </label>
                        <p className="text-xs text-slate-500 mb-3">Tanggal sudah ditetapkan di form order; di sini hanya tampil. Jam check-in/check-out dapat diatur di bawah.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500 font-medium">Check-in</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex-1 min-w-[120px] rounded-xl bg-slate-100 border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                                {formatDate(prog?.check_in_date ?? item.meta?.check_in)}
                              </span>
                              <input type="time" className="w-[100px] border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" defaultValue={prog?.check_in_time ?? '14:00'} onBlur={(e) => { const v = e.target.value?.trim() || undefined; if (v !== (prog?.check_in_time ?? '14:00')) handleUpdateProgress(item.id, { check_in_time: v }); }} disabled={updatingId === item.id} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500 font-medium">Check-out</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex-1 min-w-[120px] rounded-xl bg-slate-100 border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                                {formatDate(prog?.check_out_date ?? item.meta?.check_out)}
                              </span>
                              <input type="time" className="w-[100px] border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" defaultValue={prog?.check_out_time ?? '12:00'} onBlur={(e) => { const v = e.target.value?.trim() || undefined; if (v !== (prog?.check_out_time ?? '12:00')) handleUpdateProgress(item.id, { check_out_time: v }); }} disabled={updatingId === item.id} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Catatan */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400" /> Catatan
                        </label>
                        <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-slate-400 resize-none" rows={2} placeholder="Catatan (opsional)" defaultValue={prog?.notes ?? ''} onBlur={(e) => { const v = e.target.value?.trim() || undefined; if (v !== (prog?.notes ?? '')) handleUpdateProgress(item.id, { notes: v }); }} disabled={updatingId === item.id} />
                      </div>

                      {updatingId === item.id && (
                        <p className="flex items-center gap-2 text-sm text-slate-500">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HotelWorkPage;
