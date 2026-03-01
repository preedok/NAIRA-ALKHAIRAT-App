import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, ClipboardList, Building2, Filter, Search, Hotel, CheckCircle, DoorOpen, ListChecks, User, MapPin, Calendar, UtensilsCrossed, FileText } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal, { ModalHeader, ModalBody, ModalBoxLg } from '../../../components/common/Modal';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import Table from '../../../components/common/Table';
import { Input, Autocomplete, Textarea } from '../../../components/common';
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

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: 'Single',
  double: 'Double',
  triple: 'Triple',
  quad: 'Quad'
};

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
  const qParam = searchParams.get('q');
  const { showToast } = useToast();

  const [dashboard, setDashboard] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<string>('');
  const [filterProgressStatus, setFilterProgressStatus] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>(() => qParam || '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);

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
      const params: { status?: string; page?: number; limit?: number } = { page, limit };
      if (filterInvoiceStatus) params.status = filterInvoiceStatus;
      const res = await hotelApi.listInvoices(params);
      if (res.data.success) {
        setInvoices(res.data.data || []);
        const pag = (res.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(pag || null);
      } else {
        setInvoices([]);
        setPagination(null);
      }
    } catch (e: any) {
      setInvoices([]);
      setPagination(null);
      const msg = e.response?.data?.message;
      if (e.response?.status === 403 && msg) showToast(msg, 'error');
    }
  }, [showToast, filterInvoiceStatus, page, limit]);

  const refetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchInvoices()]).finally(() => setLoading(false));
  }, [fetchDashboard, fetchInvoices]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  useEffect(() => {
    setPage(1);
  }, [filterInvoiceStatus]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Saat dibuka dari dashboard (Kerjakan) dengan ?invoice=...&q=..., filter langsung pakai nomor invoice
  useEffect(() => {
    if (qParam && qParam.trim()) setFilterSearch(qParam.trim());
  }, [qParam]);

  useEffect(() => {
    if (invoiceIdParam) {
      hotelApi.getInvoice(invoiceIdParam)
        .then((res: any) => {
          if (res.data.success && res.data.data) {
            setDetailInvoice(res.data.data);
            const invNum = res.data.data.invoice_number;
            if (invNum) setFilterSearch(invNum);
          }
        })
        .catch(() => setDetailInvoice(null));
    } else {
      setDetailInvoice(null);
    }
  }, [invoiceIdParam]);

  const handleUpdateProgress = async (orderItemId: string, payload: { status?: string; room_number?: string; meal_status?: string; check_in_date?: string; check_out_date?: string; notes?: string }) => {
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
  type HotelGroup = { key: string; productName: string; items: any[] };
  const hotelByProduct = useMemo<HotelGroup[]>(() => {
    return hotelItems.reduce((acc: HotelGroup[], item: any) => {
      const pid = String(item.product_ref_id || item.product_id || '');
      const name = (item as any).product_name || item.Product?.name || item.Product?.code || 'Hotel';
      const existing = acc.find((g) => g.key === pid);
      if (existing) existing.items.push(item);
      else acc.push({ key: pid || item.id, productName: name, items: [item] });
      return acc;
    }, []);
  }, [hotelItems]);
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
      <PageHeader
        title="Progress Hotel"
        subtitle="Kelola invoice berisi item hotel: status progress, penetapan room, nomor kamar. Check-in 16:00 & check-out 12:00 otomatis."
        right={<AutoRefreshControl onRefresh={refetchAll} disabled={loading} size="sm" />}
      />

      {/* Stat cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Invoice" value={loading ? '–' : totalInvoices} iconClassName="bg-slate-100 text-slate-600" />
          <StatCard icon={<Building2 className="w-5 h-5" />} label="Total Item Hotel" value={loading ? '–' : totalItems} iconClassName="bg-amber-100 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Per Status Progress</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATUS_OPTIONS.map((opt) => (
              <StatCard
                key={opt.value}
                icon={opt.value === 'waiting_confirmation' ? <ListChecks className="w-5 h-5" /> : opt.value === 'confirmed' ? <Hotel className="w-5 h-5" /> : opt.value === 'room_assigned' ? <DoorOpen className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                label={opt.label}
                value={loading ? '–' : (byStatus[opt.value] ?? 0)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Filter */}
      <Card className="p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end flex-wrap">
          <div className="flex-1 min-w-0 sm:min-w-[200px]">
            <Input label="Cari (invoice / order / owner / cabang)" type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Ketik untuk filter..." icon={<Search className="w-4 h-4" />} fullWidth />
          </div>
          <div className="sm:w-44">
            <Autocomplete label="Status Invoice" value={filterInvoiceStatus} onChange={setFilterInvoiceStatus} options={Object.entries(INVOICE_STATUS_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))} emptyLabel="Semua status" />
          </div>
          <div className="sm:w-44">
            <Autocomplete label="Status Progress" value={filterProgressStatus} onChange={setFilterProgressStatus} options={STATUS_OPTIONS} emptyLabel="Semua progress" />
          </div>
          <Button variant="outline" size="sm" onClick={() => { setFilterInvoiceStatus(''); setFilterProgressStatus(''); setFilterSearch(''); }} className="rounded-xl">Reset</Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <CardSectionHeader
            icon={<Building2 className="w-6 h-6" />}
            title="Daftar Invoice Hotel"
            subtitle={`${filteredInvoices.length} invoice`}
            className="mb-0"
          />
        </div>
        {loading ? (
          <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Memuat...
          </div>
        ) : !hasHotelInvoices ? (
          <div className="py-16 text-center">
            <div className="p-5 rounded-2xl bg-slate-100 w-fit mx-auto mb-4">
              <Hotel className="w-14 h-14 text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold">Belum ada invoice dengan item hotel</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Buat order & invoice dari menu Invoice terlebih dahulu.</p>
          </div>
        ) : (
          <Table
            columns={tableColumns}
            data={filteredInvoices}
            emptyMessage="Tidak ada invoice sesuai filter"
            stickyActionsColumn
            pagination={pagination ? {
              total: pagination.total,
              page: pagination.page,
              limit: pagination.limit,
              totalPages: pagination.totalPages,
              onPageChange: (p) => setPage(p),
              onLimitChange: (l) => { setLimit(l); setPage(1); }
            } : undefined}
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
              const checkOutDate = firstHotel?.HotelProgress?.check_out_date ?? firstHotel?.meta?.check_out;
              const checkInTime = firstHotel?.HotelProgress?.check_in_time ?? firstHotel?.meta?.check_in_time ?? '16:00';
              const checkOutTime = firstHotel?.HotelProgress?.check_out_time ?? firstHotel?.meta?.check_out_time ?? '12:00';
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
                    <Button size="sm" variant="outline" onClick={() => setSearchParams({ invoice: inv.id })} className="rounded-xl">
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
          <ModalBoxLg>
            <ModalHeader
              title={formatInvoiceDisplay(detailInvoice.status, detailInvoice.invoice_number ?? '', INVOICE_STATUS_LABELS)}
              subtitle={
                <>
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 opacity-90" />
                    {detailInvoice.User?.name ?? detailInvoice.Order?.User?.name ?? '–'}
                  </span>
                  {(detailInvoice.Branch?.name || detailInvoice.Branch?.code) && (
                    <span className="flex items-center gap-1.5 ml-3">
                      <MapPin className="w-3.5 h-3.5 opacity-90" />
                      {detailInvoice.Branch?.name ?? detailInvoice.Branch?.code}
                    </span>
                  )}
                </>
              }
              icon={<Hotel className="w-5 h-5" />}
              onClose={() => setSearchParams({})}
            />
            <ModalBody className="space-y-6 bg-slate-50/30">
              {(() => {
                type HotelGroup = { key: string; productName: string; items: any[] };
                const hotelByProduct: HotelGroup[] = hotelItems.reduce((acc: HotelGroup[], item: any) => {
                  const pid = String(item.product_ref_id || item.product_id || '');
                  const name = (item as any).product_name || item.Product?.name || item.Product?.code || 'Hotel';
                  const existing = acc.find((g) => g.key === pid);
                  if (existing) existing.items.push(item);
                  else acc.push({ key: pid || item.id, productName: name, items: [item] });
                  return acc;
                }, []);

                return hotelByProduct.map((group) => (
                  <div key={group.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Card header: Nama Hotel */}
                    <div className="px-5 py-4 bg-amber-50/50 border-b border-slate-100">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-100 text-amber-600 shrink-0">
                          <Hotel className="w-6 h-6" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hotel</p>
                          <p className="font-bold text-slate-900 text-lg">{group.productName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{group.items.length} tipe kamar</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-5">
                      {group.items.map((item: any) => {
                        const prog = item.HotelProgress;
                        const status = prog?.status || 'waiting_confirmation';
                        const mealStatus = prog?.meal_status || 'pending';
                        const jamaahStatus = item.jamaah_status || prog?.jamaah_status;
                        const qty = Math.max(1, Number(item.quantity) || 1);
                        const roomType = (item.meta?.room_type || '').toString() || '–';
                        const roomTypeLabel = ROOM_TYPE_LABELS[roomType] || roomType;
                        const roomNumbersRaw = (prog?.room_number || '').trim();
                        const roomNumbersArr = roomNumbersRaw ? roomNumbersRaw.split(',').map((s: string) => s.trim()) : [];
                        const roomNumbersPadded = Array.from({ length: qty }, (_, i) => roomNumbersArr[i] ?? '');

                        const handleRoomNumbersBlur = () => {
                          const inputs = document.querySelectorAll<HTMLInputElement>(`input[name^="room-${item.id}-"]`);
                          const values = Array.from(inputs).map(inp => (inp.value ?? '').trim());
                          const joined = values.join(', ');
                          const normalizedSaved = roomNumbersRaw.split(',').map((s: string) => s.trim()).join(', ');
                          if (joined !== normalizedSaved) handleUpdateProgress(item.id, { room_number: joined || undefined });
                        };

                        return (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                            {/* Sub-header: Tipe kamar × qty */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                              <span className="font-semibold text-slate-900">{roomTypeLabel} × {qty} kamar</span>
                              {jamaahStatus && (
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${jamaahStatus === 'keluar_room' ? 'bg-slate-200 text-slate-700' : jamaahStatus === 'sudah_masuk_room' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {JAMAAH_STATUS_LABELS[jamaahStatus] ?? jamaahStatus}
                                </span>
                              )}
                            </div>

                            <div className="space-y-4">
                              {/* Status Pekerjaan */}
                              <div className="rounded-lg bg-white p-4 border border-slate-100">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                  <ListChecks className="w-3.5 h-3.5 text-amber-500" /> Status Pekerjaan
                                </label>
                                <Autocomplete value={status} onChange={(v) => handleUpdateProgress(item.id, { status: v })} options={STATUS_OPTIONS} disabled={updatingId === item.id} fullWidth />
                              </div>

                              {/* Nomor Kamar — hanya saat status Pemberian nomor room */}
                              {status === 'room_assigned' && (
                                <div className="rounded-lg bg-white p-4 border border-slate-100">
                                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <DoorOpen className="w-3.5 h-3.5 text-amber-500" /> Nomor Kamar (per unit)
                                  </label>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {roomNumbersPadded.map((val, i) => (
                                      <div key={i}>
                                        <label className="block text-xs text-slate-500 mb-1">Kamar {i + 1}</label>
                                        <input
                                          type="text"
                                          name={`room-${item.id}-${i}`}
                                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 placeholder:text-slate-400"
                                          placeholder="No. kamar"
                                          defaultValue={val}
                                          onBlur={handleRoomNumbersBlur}
                                          disabled={updatingId === item.id}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Status Makan */}
                              <div className="rounded-lg bg-white p-4 border border-slate-100">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" /> Status Makan
                                </label>
                                <Autocomplete value={mealStatus} onChange={(v) => handleUpdateProgress(item.id, { meal_status: v })} options={MEAL_OPTIONS} disabled={updatingId === item.id} fullWidth />
                              </div>

                              {/* Check-in & Check-out — tanggal dari order, jam otomatis 16:00 / 12:00 */}
                              <div className="rounded-lg bg-white p-4 border border-slate-100">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-amber-500" /> Check-in & Check-out
                                </label>
                                <p className="text-xs text-slate-500 mb-3">Jam otomatis: CI 16:00, CO 12:00</p>
                                <div className="flex flex-wrap gap-3">
                                  <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-2 text-sm font-medium text-slate-700">
                                    CI: {formatDate(prog?.check_in_date ?? item.meta?.check_in)} <span className="text-amber-600">16:00</span>
                                  </span>
                                  <span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                                    CO: {formatDate(prog?.check_out_date ?? item.meta?.check_out)} <span className="text-slate-600">12:00</span>
                                  </span>
                                </div>
                              </div>

                              {/* Catatan */}
                              <div className="rounded-lg bg-white p-4 border border-slate-100">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-amber-500" /> Catatan
                                </label>
                                <Textarea label="Catatan (opsional)" rows={2} placeholder="Catatan (opsional)" defaultValue={prog?.notes ?? ''} onBlur={(e) => { const v = e.target.value?.trim() || undefined; if (v !== (prog?.notes ?? '')) handleUpdateProgress(item.id, { notes: v }); }} disabled={updatingId === item.id} />
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
                ));
              })()}
            </ModalBody>
          </ModalBoxLg>
        )}
      </Modal>
    </div>
  );
};

export default HotelWorkPage;
