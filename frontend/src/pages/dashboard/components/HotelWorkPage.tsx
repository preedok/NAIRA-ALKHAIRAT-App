import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Eye, ClipboardList, Building2, Search, Hotel, CheckCircle, DoorOpen, ListChecks, User, MapPin, Calendar, UtensilsCrossed, FileText, Play, FileSpreadsheet } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalBoxLg } from '../../../components/common/Modal';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import Table from '../../../components/common/Table';
import { Input, Autocomplete, Textarea, ContentLoading, NominalDisplay } from '../../../components/common';
import type { TableColumn } from '../../../types';
import { hotelApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { INVOICE_STATUS_LABELS, AUTOCOMPLETE_FILTER } from '../../../utils/constants';
import { formatInvoiceNumberDisplay } from '../../../utils';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant } from '../../../components/common/InvoiceStatusRefundCell';
import Badge from '../../../components/common/Badge';
import { PROGRESS_STATUS_OPTIONS_HOTEL, PROGRESS_STATUS_OPTIONS_MEAL, ROOM_TYPE_LABELS as ROOM_TYPE_LABELS_SHARED } from '../../../components/common/InvoiceProgressStatusCell';
import { DivisionStatCardsWithModal, type DivisionStatItem } from '../../../components/common';
import { getProgressDateRange, filterInvoicesByDateRange, PROGRESS_DATE_RANGE_OPTIONS, type ProgressDateRangeKey } from '../../../utils/progressDateFilter';

/** Satu sumber kebenaran dengan tabel Invoice (InvoiceProgressStatusCell) */
const STATUS_OPTIONS = PROGRESS_STATUS_OPTIONS_HOTEL;

const JAMAAH_STATUS_LABELS: Record<string, string> = {
  belum_masuk: 'Belum masuk room',
  sudah_masuk_room: 'Sudah masuk room',
  keluar_room: 'Keluar room'
};

/** Satu sumber kebenaran dengan InvoiceProgressStatusCell */
const MEAL_OPTIONS = PROGRESS_STATUS_OPTIONS_MEAL;

const ROOM_TYPE_LABELS = ROOM_TYPE_LABELS_SHARED;

/** Kapasitas orang per tipe kamar (untuk tampilan jumlah orang) */
const ROOM_CAPACITY: Record<string, number> = { single: 1, double: 2, triple: 3, quad: 4, quint: 5 };

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

  const [filterDateRange, setFilterDateRange] = useState<ProgressDateRangeKey>('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<string>('');
  const [filterProgressStatus, setFilterProgressStatus] = useState<string>('');
  /** Tab filter lokasi hotel: '' = Semua, 'makkah' = Hotel Mekkah, 'madinah' = Hotel Madinah */
  const [filterHotelLocation, setFilterHotelLocation] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>(() => qParam || '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  type HotelItemDraft = { status?: string; room_number?: string; meal_status?: string; notes?: string };
  const [detailDraft, setDetailDraft] = useState<Record<string, HotelItemDraft>>({});
  const [detailTab, setDetailTab] = useState<'detail' | 'slip'>('detail');

  useEffect(() => {
    setDetailTab('detail');
  }, [detailInvoice?.id]);

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
  }, [filterInvoiceStatus, filterHotelLocation]);

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
      setDetailDraft({});
    }
  }, [invoiceIdParam]);

  const hotelItemsAll = detailInvoice?.Order?.OrderItems?.filter((i: any) => i.type === 'hotel') || [];
  useEffect(() => {
    if (hotelItemsAll.length) {
      const next: Record<string, HotelItemDraft> = {};
      hotelItemsAll.forEach((item: any) => {
        const prog = item.HotelProgress;
        next[item.id] = {
          status: prog?.status || 'waiting_confirmation',
          room_number: (prog?.room_number || '').trim(),
          meal_status: prog?.meal_status || 'pending',
          notes: prog?.notes ?? ''
        };
      });
      setDetailDraft(prev => ({ ...prev, ...next }));
    }
  }, [detailInvoice?.id, hotelItemsAll.map((i: any) => i.id).join(',')]);

  const handleProsesHotelItem = (itemId: string) => {
    const d = detailDraft[itemId];
    if (!d) return;
    handleUpdateProgress(itemId, {
      status: d.status,
      room_number: d.room_number?.trim() || undefined,
      meal_status: d.meal_status,
      notes: d.notes?.trim() || undefined
    });
  };

  const handleProsesSemua = async () => {
    for (const item of hotelItems) {
      const d = detailDraft[item.id];
      if (!d) continue;
      await handleUpdateProgress(item.id, {
        status: d.status,
        room_number: d.room_number?.trim() || undefined,
        meal_status: d.meal_status,
        notes: d.notes?.trim() || undefined
      });
    }
  };

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

  /** Lokasi hotel: backend hotel_location, atau Product.meta.location / item.meta, atau infer dari nama product */
  const getHotelItemLocation = useCallback((item: any) => {
    const fromBackend = item?.hotel_location;
    if (fromBackend && String(fromBackend).trim()) return String(fromBackend).toLowerCase().trim();
    const loc = item?.Product?.meta?.location ?? item?.meta?.location;
    if (loc && String(loc).trim()) return String(loc).toLowerCase().trim();
    const name = (item?.Product?.name ?? item?.product_name ?? item?.meta?.product_name ?? '').toString();
    if (/madinah/i.test(name)) return 'madinah';
    if (/mekkah|makkah/i.test(name)) return 'makkah';
    return '';
  }, []);

  /** Di modal detail: jika tab Mekkah/Madinah dipilih, hanya tampilkan item hotel yang lokasinya sesuai */
  const hotelItems = useMemo(() => {
    if (!filterHotelLocation) return hotelItemsAll;
    return hotelItemsAll.filter((item: any) => getHotelItemLocation(item) === filterHotelLocation);
  }, [hotelItemsAll, filterHotelLocation, getHotelItemLocation]);
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
  const dateRange = getProgressDateRange(filterDateRange);
  const dateFilteredInvoices = useMemo(() => {
    if (!dateRange) return invoices;
    const from = dateRange.date_from;
    const to = dateRange.date_to;
    return invoices.filter((inv: any) => {
      // Prioritas: tanggal layanan hotel = check-in
      const items = (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'hotel');
      const checkIns = items
        .map((it: any) => {
          const meta = it?.meta && typeof it.meta === 'object' ? it.meta : {};
          const raw = (meta.check_in || it?.check_in_date || it?.HotelProgress?.check_in_date || '').toString();
          const d = raw.slice(0, 10);
          return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
        })
        .filter(Boolean) as string[];

      const serviceDate = checkIns.length
        ? checkIns.sort()[0]
        : (inv.issued_at || inv.created_at || '').toString().slice(0, 10);

      return serviceDate >= from && serviceDate <= to;
    });
  }, [invoices, dateRange]);

  const byStatus = useMemo(() => {
    const out: Record<string, number> = {};
    dateFilteredInvoices.forEach((inv: any) => {
      (inv.Order?.OrderItems || [])
        .filter((i: any) => i.type === 'hotel')
        .forEach((i: any) => {
          const s = i.HotelProgress?.status || 'waiting_confirmation';
          out[s] = (out[s] || 0) + 1;
        });
    });
    return out;
  }, [dateFilteredInvoices]);

  const totalInvoices = dateFilteredInvoices.length;
  const totalItems = dateFilteredInvoices.reduce((sum, inv: any) => sum + (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'hotel').length, 0);

  const filteredInvoices = useMemo(() => {
    let list = dateFilteredInvoices;
    const q = (filterSearch || '').trim().toLowerCase();
    if (q) {
      list = list.filter((inv: any) => {
        const invNum = (inv.invoice_number || '').toLowerCase();
        const owner = (inv.User?.name || inv.User?.company_name || inv.Order?.User?.name || '').toLowerCase();
        const branch = (inv.Branch?.name || inv.Branch?.code || '').toLowerCase();
        return invNum.includes(q) || owner.includes(q) || branch.includes(q);
      });
    }
    if (filterHotelLocation) {
      list = list.filter((inv: any) => {
        const hotelItems = (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'hotel');
        return hotelItems.some((i: any) => getHotelItemLocation(i) === filterHotelLocation);
      });
    }
    if (filterProgressStatus) {
      list = list.filter((inv: any) => {
        const orderItems = inv.Order?.OrderItems || [];
        return orderItems.some((i: any) => (i.HotelProgress?.status || 'waiting_confirmation') === filterProgressStatus);
      });
    }
    return list;
  }, [dateFilteredInvoices, filterSearch, filterProgressStatus, filterHotelLocation]);

  const divisionStats = useMemo((): DivisionStatItem[] => {
    const firstRow: DivisionStatItem[] = [
      { id: 'total', label: 'Total Invoice', value: totalInvoices, icon: <ClipboardList className="w-5 h-5" />, iconClassName: 'bg-slate-100 text-slate-600', modalTitle: 'Daftar Invoice – Total Invoice' },
      { id: 'item_hotel', label: 'Total Item Hotel', value: totalItems, icon: <Building2 className="w-5 h-5" />, iconClassName: 'bg-amber-100 text-amber-600', modalTitle: 'Daftar Invoice – Item Hotel' }
    ];
    const rest = STATUS_OPTIONS.map((opt) => ({
      id: opt.value,
      label: opt.label,
      value: byStatus[opt.value] ?? 0,
      icon: opt.value === 'waiting_confirmation' ? <ListChecks className="w-5 h-5" /> : opt.value === 'confirmed' ? <Hotel className="w-5 h-5" /> : opt.value === 'room_assigned' ? <DoorOpen className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />,
      iconClassName: 'bg-slate-100 text-slate-600',
      modalTitle: `Daftar Invoice – ${opt.label}`
    }));
    return [...firstRow, ...rest];
  }, [totalInvoices, totalItems, byStatus]);

  const getFilteredInvoicesForStat = useCallback((statId: string) => {
    if (statId === 'total' || statId === 'item_hotel') return dateFilteredInvoices;
    return dateFilteredInvoices.filter((inv: any) =>
      (inv.Order?.OrderItems || []).filter((i: any) => i.type === 'hotel').some((i: any) => (i.HotelProgress?.status || 'waiting_confirmation') === statId)
    );
  }, [dateFilteredInvoices]);


  const tableColumns: TableColumn[] = [
    { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'company', label: 'Perusahaan', align: 'left' },
    { id: 'total', label: 'Total', align: 'right' },
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

      <DivisionStatCardsWithModal
        stats={divisionStats}
        invoices={dateFilteredInvoices}
        getFilteredInvoices={getFilteredInvoicesForStat}
        loading={loading}
        perStatusLabel="Per Status Progress"
        getStatusLabel={getEffectiveInvoiceStatusLabel}
        getStatusBadgeVariant={getEffectiveInvoiceStatusBadgeVariant}
      />

      {/* Filter + Table card — layout konsisten dengan halaman lain */}
      <Card className="travel-card overflow-visible">
        <CardSectionHeader
          icon={<Building2 className="w-6 h-6" />}
          title="Daftar Invoice Hotel"
          subtitle={`${filteredInvoices.length} invoice. Filter menurut lokasi hotel, status invoice & progress.`}
          className="mb-4"
        />
        <div className="mb-6 rounded-xl bg-slate-50/80 border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Pengaturan Filter</p>
          <p className="text-xs text-slate-500 mb-3">Filter data menurut tanggal check-in hotel (hari ini, 2/3/4/5 hari, 1/2/3 minggu, 1 bulan kedepan)</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {PROGRESS_DATE_RANGE_OPTIONS.map((opt) => (
              <button key={opt.value || 'all'} type="button" onClick={() => setFilterDateRange(opt.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterDateRange === opt.value ? 'bg-[#0D1A63] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterHotelLocation('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterHotelLocation === '' ? 'bg-[#0D1A63] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterHotelLocation('makkah')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterHotelLocation === 'makkah' ? 'bg-[#0D1A63] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Hotel Mekkah
            </button>
            <button
              type="button"
              onClick={() => setFilterHotelLocation('madinah')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterHotelLocation === 'madinah' ? 'bg-[#0D1A63] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Hotel Madinah
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end flex-wrap">
            <div className="flex-1 min-w-0 sm:min-w-[220px]">
              <Input label="Cari (invoice / order / owner / cabang)" type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Ketik untuk filter..." icon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <div className="w-full sm:w-52 min-w-0">
              <Autocomplete label="Status Invoice" value={filterInvoiceStatus} onChange={setFilterInvoiceStatus} options={[{ value: '', label: AUTOCOMPLETE_FILTER.SEMUA_STATUS }, ...Object.entries(INVOICE_STATUS_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))]} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_STATUS} />
            </div>
            <div className="w-full sm:w-52 min-w-0">
              <Autocomplete label="Status Progress" value={filterProgressStatus} onChange={setFilterProgressStatus} options={[{ value: '', label: AUTOCOMPLETE_FILTER.SEMUA_PROGRESS }, ...STATUS_OPTIONS]} emptyLabel={AUTOCOMPLETE_FILTER.SEMUA_PROGRESS} />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          {loading ? (
            <ContentLoading />
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
              const allHotelItems = orderItems.filter((i: any) => i.type === 'hotel');
              /** Sesuai tab: hanya item Mekkah, hanya Madinah, atau semuanya */
              const hotelItemsList = filterHotelLocation
                ? allHotelItems.filter((i: any) => getHotelItemLocation(i) === filterHotelLocation)
                : allHotelItems;
              const hotelCount = hotelItemsList.length;
              const statusCounts: Record<string, number> = {};
              hotelItemsList.forEach((i: any) => {
                const st = i.HotelProgress?.status || 'waiting_confirmation';
                statusCounts[st] = (statusCounts[st] || 0) + 1;
              });
              const summaryParts = STATUS_OPTIONS.filter(s => (statusCounts[s.value] || 0) > 0).map(s => `${statusCounts[s.value]} ${s.label}`);
              const progressSummary = summaryParts.length ? summaryParts.join(', ') : '–';
              const invStatusLabel = getEffectiveInvoiceStatusLabel(inv);
              const statusBadgeVariant = getEffectiveInvoiceStatusBadgeVariant(inv);
              const firstHotel = hotelItemsList[0];
              const checkInDate = firstHotel?.HotelProgress?.check_in_date ?? firstHotel?.meta?.check_in;
              const checkOutDate = firstHotel?.HotelProgress?.check_out_date ?? firstHotel?.meta?.check_out;
              const checkInTime = firstHotel?.HotelProgress?.check_in_time ?? firstHotel?.meta?.check_in_time ?? '16:00';
              const checkOutTime = firstHotel?.HotelProgress?.check_out_time ?? firstHotel?.meta?.check_out_time ?? '12:00';
              const checkInDisplay = formatDateWithTime(checkInDate, checkInTime);
              const checkOutDisplay = formatDateWithTime(checkOutDate, checkOutTime);
              const totalIdr = inv?.total_amount_idr != null ? parseFloat(inv.total_amount_idr) : parseFloat(inv?.total_amount || 0);
              return (
                <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 align-top">
                    <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan showDpPayment order={inv.Order} />
                  </td>
                  <td className="px-6 py-4 text-slate-700 text-sm align-top">{inv.User?.name ?? inv.User?.company_name ?? o?.User?.name ?? '–'}</td>
                  <td className="px-6 py-4 text-slate-700 align-top text-sm">
                    <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900 align-top"><NominalDisplay amount={totalIdr} currency="IDR" /></td>
                  <td className="px-6 py-4 align-top">
                    <Badge variant={statusBadgeVariant}>
                      {invStatusLabel}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="text-center min-w-[120px]">
                      <p className="font-semibold text-slate-900 tabular-nums">{hotelCount} item</p>
                      <div className="text-xs text-slate-600 mt-1 space-y-0.5 text-left">
                        {hotelItemsList.map((item: any) => {
                          const rt = item.room_type || item.meta?.room_type || '';
                          const qty = Math.max(0, parseInt(String(item.quantity || 0), 10) || 0);
                          const cap = rt ? (ROOM_CAPACITY[rt] ?? 0) : 0;
                          const orang = qty * cap;
                          const label = ROOM_TYPE_LABELS[rt] || rt || '–';
                          return (
                            <p key={item.id} className="leading-tight">
                              {qty} {label}{cap > 0 ? ` (${orang} org)` : ''}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm whitespace-nowrap align-top">{checkInDisplay}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm whitespace-nowrap align-top">{checkOutDisplay}</td>
                  <td className="px-6 py-4 text-slate-600 text-sm align-top">{progressSummary}</td>
                  <td className="px-6 py-4 sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] align-top">
                    <Button size="sm" variant="outline" onClick={() => setSearchParams({ invoice: inv.id })} className="rounded-xl">
                      <Eye className="w-4 h-4 mr-1" /> Detail
                    </Button>
                  </td>
                </tr>
              );
            }}
          />
          )}
        </div>
      </Card>

      <Modal open={!!detailInvoice} onClose={() => setSearchParams({})}>
        {detailInvoice && (
          <ModalBoxLg>
            <ModalHeader
              title={formatInvoiceNumberDisplay(detailInvoice, INVOICE_STATUS_LABELS, getEffectiveInvoiceStatusLabel(detailInvoice))}
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
            {(() => {
              const hasSlipEligible = hotelItems.some((item: any) => {
                const prog = item.HotelProgress;
                const status = detailDraft[item.id]?.status ?? prog?.status ?? '';
                const room = (detailDraft[item.id]?.room_number ?? prog?.room_number ?? '').trim();
                const meal = (detailDraft[item.id]?.meal_status ?? prog?.meal_status ?? '') || '';
                return (status === 'completed' || status === 'room_assigned') && !!room && meal === 'completed';
              });
              return (
                <div className="border-b border-slate-200 bg-slate-50/60 px-6 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailTab('detail')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${detailTab === 'detail' ? 'border-amber-500 text-amber-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    Detail
                  </button>
                  {hasSlipEligible && (
                    <button
                      type="button"
                      onClick={() => setDetailTab('slip')}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${detailTab === 'slip' ? 'border-amber-500 text-amber-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Slip
                    </button>
                  )}
                </div>
              );
            })()}
            <ModalBody className="space-y-6 bg-slate-50/30">
              {detailTab === 'slip' ? (
                <div className="space-y-4">
                  {hotelItems
                    .filter((item: any) => {
                      const prog = item.HotelProgress;
                      const status = detailDraft[item.id]?.status ?? prog?.status ?? '';
                      const room = (detailDraft[item.id]?.room_number ?? prog?.room_number ?? '').trim();
                      const meal = (detailDraft[item.id]?.meal_status ?? prog?.meal_status ?? '') || '';
                      return (status === 'completed' || status === 'room_assigned') && !!room && meal === 'completed';
                    })
                    .map((item: any) => {
                      const prog = item.HotelProgress;
                      const order = detailInvoice?.Order;
                      const invoiceNumber = detailInvoice?.invoice_number ?? '–';
                      const productName = (item as any).product_name || item.Product?.name || item.Product?.code || 'Hotel';
                      const ownerName = order?.User?.name || order?.User?.company_name || '–';
                      const roomType = ROOM_TYPE_LABELS[(item.meta?.room_type || '').toString()] || (item.meta?.room_type || '–');
                      const qty = Math.max(1, Number(item.quantity) || 1);
                      const roomNumber = (detailDraft[item.id]?.room_number ?? prog?.room_number ?? '').trim() || '–';
                      const statusLabel = STATUS_OPTIONS.find((o: { value: string }) => o.value === (prog?.status || ''))?.label ?? prog?.status ?? '–';
                      const mealLabel = MEAL_OPTIONS.find((o: { value: string }) => o.value === (prog?.meal_status || ''))?.label ?? prog?.meal_status ?? '–';
                      const checkIn = formatDate(prog?.check_in_date ?? item.meta?.check_in);
                      const checkOut = formatDate(prog?.check_out_date ?? item.meta?.check_out);
                      const notes = (prog?.notes ?? '').trim() || '–';
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Slip Informasi Hotel</p>
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><dt className="text-slate-500">No. Invoice</dt><dd className="font-medium text-slate-900">{invoiceNumber}</dd></div>
                            <div><dt className="text-slate-500">Produk / Paket Hotel</dt><dd className="font-medium text-slate-900">{productName}</dd></div>
                            <div><dt className="text-slate-500">Pemesan (Owner)</dt><dd className="font-medium text-slate-900">{ownerName}</dd></div>
                            <div><dt className="text-slate-500">Tipe Kamar</dt><dd className="font-medium text-slate-900">{roomType}</dd></div>
                            <div><dt className="text-slate-500">Jumlah Kamar</dt><dd className="font-medium text-slate-900">{qty}</dd></div>
                            <div><dt className="text-slate-500">Nomor Kamar</dt><dd className="font-medium text-slate-900">{roomNumber}</dd></div>
                            <div><dt className="text-slate-500">Status Progress</dt><dd className="font-medium text-slate-900">{statusLabel}</dd></div>
                            <div><dt className="text-slate-500">Status Makan</dt><dd className="font-medium text-slate-900">{mealLabel}</dd></div>
                            <div><dt className="text-slate-500">Check-in</dt><dd className="font-medium text-slate-900">{checkIn} 16:00</dd></div>
                            <div><dt className="text-slate-500">Check-out</dt><dd className="font-medium text-slate-900">{checkOut} 12:00</dd></div>
                            <div className="sm:col-span-2"><dt className="text-slate-500">Catatan</dt><dd className="font-medium text-slate-900">{notes}</dd></div>
                          </dl>
                          <p className="text-xs text-slate-400 mt-3">Slip ini digenerate otomatis. Digabungkan ke arsip invoice (Unduh ZIP).</p>
                        </div>
                      );
                    })}
                </div>
              ) : (() => {
                if (filterHotelLocation && hotelItems.length === 0) {
                  const label = filterHotelLocation === 'makkah' ? 'Hotel Mekkah' : 'Hotel Madinah';
                  return (
                    <div className="rounded-xl border border-slate-200 bg-amber-50/50 p-6 text-center">
                      <p className="text-slate-700 font-medium">Tidak ada item {label} pada invoice ini.</p>
                      <p className="text-sm text-slate-500 mt-1">Pilih tab &quot;Semua&quot; untuk melihat semua item hotel.</p>
                    </div>
                  );
                }
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
                        const d = detailDraft[item.id] ?? {
                          status: prog?.status || 'waiting_confirmation',
                          room_number: (prog?.room_number || '').trim(),
                          meal_status: prog?.meal_status || 'pending',
                          notes: prog?.notes ?? ''
                        };
                        const status = d.status ?? prog?.status ?? 'waiting_confirmation';
                        const mealStatus = d.meal_status ?? prog?.meal_status ?? 'pending';
                        const jamaahStatus = item.jamaah_status || prog?.jamaah_status;
                        const qty = Math.max(1, Number(item.quantity) || 1);
                        const roomType = (item.meta?.room_type || '').toString() || '–';
                        const roomTypeLabel = ROOM_TYPE_LABELS[roomType] || roomType;
                        const roomNumbersArr = (d.room_number ?? prog?.room_number ?? '').trim().split(',').map((s: string) => s.trim());
                        const roomNumbersPadded = Array.from({ length: qty }, (_, i) => roomNumbersArr[i] ?? '');

                        const setRoomNumberAt = (index: number, value: string) => {
                          const next = [...roomNumbersPadded];
                          next[index] = value;
                          setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), room_number: next.map(s => s.trim()).join(', ').trim() } }));
                        };

                        return (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                            {/* Sub-header: Tipe kamar × qty + Proses */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900">{roomTypeLabel} × {qty} kamar</span>
                                {jamaahStatus && (
                                  <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${jamaahStatus === 'keluar_room' ? 'bg-slate-200 text-slate-700' : jamaahStatus === 'sudah_masuk_room' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {JAMAAH_STATUS_LABELS[jamaahStatus] ?? jamaahStatus}
                                  </span>
                                )}
                              </div>
                              <Button size="sm" variant="primary" onClick={() => handleProsesHotelItem(item.id)} disabled={updatingId === item.id}>
                                {updatingId === item.id ? (
                                  <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</>
                                ) : (
                                  <><Play className="w-4 h-4 mr-1.5" /> Proses</>
                                )}
                              </Button>
                            </div>

                            <div className="space-y-4">
                              {/* Status Pekerjaan */}
                              <div className="rounded-lg bg-white p-4 border border-slate-100">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                  <ListChecks className="w-3.5 h-3.5 text-amber-500" /> Status Pekerjaan
                                </label>
                                <Autocomplete value={status} onChange={(v) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), status: v ?? 'waiting_confirmation' } }))} options={STATUS_OPTIONS} disabled={updatingId === item.id} fullWidth />
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
                                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 placeholder:text-slate-400"
                                          placeholder="No. kamar"
                                          value={val}
                                          onChange={(e) => setRoomNumberAt(i, e.target.value)}
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
                                <Autocomplete value={mealStatus} onChange={(v) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), meal_status: v ?? 'pending' } }))} options={MEAL_OPTIONS} disabled={updatingId === item.id} fullWidth />
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
                                <Textarea label="Catatan (opsional)" rows={2} placeholder="Catatan (opsional)" value={d.notes ?? ''} onChange={(e) => setDetailDraft(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), notes: e.target.value } }))} disabled={updatingId === item.id} />
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
            {detailTab === 'detail' && (!filterHotelLocation || hotelItems.length > 0) ? (
              <ModalFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80">
                <p className="text-sm text-slate-600">Perubahan input hanya tersimpan setelah Anda klik <strong>Proses</strong> (per item) atau <strong>Proses semua</strong> di bawah.</p>
                <Button variant="primary" onClick={handleProsesSemua} disabled={!!updatingId || hotelItems.length === 0}>
                  {updatingId ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : <><Play className="w-4 h-4 mr-2" /> Proses semua</>}
                </Button>
              </ModalFooter>
            ) : null}
          </ModalBoxLg>
        )}
      </Modal>
    </div>
  );
};

export default HotelWorkPage;
