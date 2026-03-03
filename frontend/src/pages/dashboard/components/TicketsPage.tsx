import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plane, ShoppingCart, Plus, Pencil, X, Package, MapPin, ArrowRight, ArrowLeft, ArrowLeftRight, Calendar, Trash2 } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import PageHeader from '../../../components/common/PageHeader';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { StatCard, CardSectionHeader, Input, PriceInput, Textarea, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ContentLoading } from '../../../components/common';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { businessRulesApi, productsApi, adminPusatApi, type TicketSeason } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import Table from '../../../components/common/Table';
import { getPriceTripleForTable } from '../../../utils';
import TicketWorkPage from './TicketWorkPage';

const PAGE_SIZE = 25;

const BANDARA_TIKET = [
  { code: 'BTH', name: 'Batam' },
  { code: 'CGK', name: 'Jakarta' },
  { code: 'SBY', name: 'Surabaya' },
  { code: 'UPG', name: 'Makassar' }
];

type PeriodSlot = { price_idr: number; seat_quota: number };
type PeriodMap = Record<string, PeriodSlot>;

export type BandaraSchedule = {
  bandara: string;
  name: string;
  default: PeriodSlot;
  month: PeriodMap;
  week: PeriodMap;
  day: PeriodMap;
};

export type TicketTripType = 'one_way' | 'return_only' | 'round_trip';

const TICKET_TRIP_LABELS: Record<TicketTripType, string> = {
  one_way: 'Pergi saja',
  return_only: 'Pulang saja',
  round_trip: 'Pulang pergi'
};

interface TicketProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  meta?: { trip_type?: TicketTripType };
  bandara_options?: BandaraSchedule[];
}

/** Senin dari minggu yang berisi dateStr */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10));
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}


type PeriodType = 'default' | 'month' | 'week' | 'day';

type TicketsPageProps = {
  embedInProducts?: boolean;
  refreshTrigger?: number;
  embedFilterOpen?: boolean;
  embedFilterOnToggle?: () => void;
  onFilterActiveChange?: (active: boolean) => void;
};

const TicketsPage: React.FC<TicketsPageProps> = ({
  embedInProducts,
  refreshTrigger,
  embedFilterOpen,
  embedFilterOnToggle,
  onFilterActiveChange
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [ticketProducts, setTicketProducts] = useState<TicketProduct[]>([]);
  const [loadingTicketProducts, setLoadingTicketProducts] = useState(false);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketLimit, setTicketLimit] = useState(PAGE_SIZE);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [ticketTotalPages, setTicketTotalPages] = useState(1);
  const [editModal, setEditModal] = useState<{
    product: TicketProduct;
    bandaraCode: string;
    bandaraName: string;
    period_type: PeriodType;
    period_key?: string;
    price_idr: number;
    seat_quota: number;
    price_currency: 'IDR' | 'SAR' | 'USD';
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    description: '',
    trip_type: 'round_trip' as TicketTripType,
    bandara_defaults: BANDARA_TIKET.reduce((acc, b) => {
      acc[b.code] = {};
      return acc;
    }, {} as Record<string, { price_idr?: number; seat_quota?: number }>)
  });
  const [addSaving, setAddSaving] = useState(false);

  const [editProductModal, setEditProductModal] = useState<{
    product: TicketProduct;
    name: string;
    description: string;
    trip_type: TicketTripType;
  } | null>(null);
  const [editProductSaving, setEditProductSaving] = useState(false);
  const [ticketQuotaProduct, setTicketQuotaProduct] = useState<TicketProduct | null>(null);
  const [ticketSeasons, setTicketSeasons] = useState<TicketSeason[]>([]);
  const [ticketSeasonsLoading, setTicketSeasonsLoading] = useState(false);
  const [newSeasonForm, setNewSeasonForm] = useState({ name: '', start_date: '', end_date: '', quota: 0 });
  const [addSeasonSaving, setAddSeasonSaving] = useState(false);
  const [quotaEdit, setQuotaEdit] = useState<{ seasonId: string; value: string } | null>(null);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [filterIncludeInactive, setFilterIncludeInactive] = useState<'false' | 'true'>('false');
  const [searchName, setSearchName] = useState('');
  const [debouncedSearchName, setDebouncedSearchName] = useState('');
  const lastFilterKeyRef = useRef<string>('');
  const { addItem: addDraftItem } = useOrderDraft();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchName(searchName), 350);
    return () => clearTimeout(t);
  }, [searchName]);

  const isPusat = user?.role === 'super_admin' || user?.role === 'admin_pusat';
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const canShowProductActions = ['owner', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(user?.role || '');

  useEffect(() => {
    businessRulesApi.get().then((res) => {
      const data = (res.data as { data?: { currency_rates?: unknown } })?.data;
      let cr = data?.currency_rates;
      if (typeof cr === 'string') {
        try { cr = JSON.parse(cr) as { SAR_TO_IDR?: number; USD_TO_IDR?: number }; } catch { cr = null; }
      }
      const rates = cr as { SAR_TO_IDR?: number; USD_TO_IDR?: number } | null;
      if (rates && typeof rates === 'object') setCurrencyRates({ SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 });
    }).catch(() => {});
  }, []);

  const fetchTicketProducts = useCallback(() => {
    if (!canAddToOrder && !embedInProducts) return;
    const filterKey = `${debouncedSearchName}|${filterIncludeInactive}`;
    let pageToUse = ticketPage;
    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      setTicketPage(1);
      pageToUse = 1;
    }
    setLoadingTicketProducts(true);
    const params = { type: 'ticket', with_prices: 'true', include_inactive: filterIncludeInactive, limit: ticketLimit, page: pageToUse, ...(debouncedSearchName.trim() ? { name: debouncedSearchName.trim() } : {}), ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
    productsApi.list(params)
      .then((res) => {
        const body = res.data as { data?: TicketProduct[]; pagination?: { total: number; page: number; limit: number; totalPages: number } };
        setTicketProducts(Array.isArray(body.data) ? body.data : []);
        const p = body.pagination;
        if (p) {
          setTicketTotal(p.total);
          setTicketPage(p.page);
          setTicketLimit(p.limit);
          setTicketTotalPages(p.totalPages || 1);
        }
      })
      .catch(() => setTicketProducts([]))
      .finally(() => setLoadingTicketProducts(false));
  }, [canAddToOrder, embedInProducts, user?.role, filterIncludeInactive, ticketLimit, ticketPage, debouncedSearchName]);

  useEffect(() => { fetchTicketProducts(); }, [fetchTicketProducts]);

  useEffect(() => {
    if (embedInProducts && refreshTrigger != null && refreshTrigger > 0) fetchTicketProducts();
  }, [embedInProducts, refreshTrigger, fetchTicketProducts]);

  useEffect(() => {
    if (!ticketQuotaProduct?.id) return;
    setTicketSeasonsLoading(true);
    adminPusatApi.listTicketSeasons(ticketQuotaProduct.id)
      .then((res) => setTicketSeasons((res.data as { data?: TicketSeason[] })?.data ?? []))
      .catch(() => setTicketSeasons([]))
      .finally(() => setTicketSeasonsLoading(false));
  }, [ticketQuotaProduct?.id]);

  const refetchAll = useCallback(() => fetchTicketProducts(), [fetchTicketProducts]);

  const handleDeleteTicket = async (p: TicketProduct) => {
    if (!window.confirm(`Hapus produk tiket "${p.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await productsApi.delete(p.id);
      showToast('Produk tiket dihapus', 'success');
      fetchTicketProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menghapus produk tiket', 'error');
    }
  };

  const getSchedule = (p: TicketProduct, bandaraCode: string): BandaraSchedule | undefined =>
    p.bandara_options?.find((b) => b.bandara === bandaraCode);

  const openEdit = (product: TicketProduct, bandaraCode: string, bandaraName: string, period_type: PeriodType, slot: PeriodSlot, period_key?: string) => {
    setEditModal({
      product,
      bandaraCode,
      bandaraName,
      period_type,
      period_key,
      price_idr: slot?.price_idr ?? 0,
      seat_quota: slot?.seat_quota ?? 0,
      price_currency: 'IDR'
    });
  };

  const saveEdit = async () => {
    if (!editModal) return;
    setEditSaving(true);
    try {
      await productsApi.setTicketBandara(editModal.product.id, {
        bandara: editModal.bandaraCode,
        period_type: editModal.period_type === 'default' ? undefined : editModal.period_type,
        period_key: editModal.period_key,
        price_idr: Math.round(editModal.price_idr) || 0,
        seat_quota: Math.max(0, Math.floor(editModal.seat_quota) || 0)
      });
      showToast('Harga dan kuota disimpan', 'success');
      setEditModal(null);
      fetchTicketProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!addForm.name.trim()) { showToast('Nama produk tiket wajib', 'error'); return; }
    setAddSaving(true);
    try {
      const createRes = await productsApi.createTicket({
        name: addForm.name.trim(),
        description: addForm.description.trim() || undefined,
        trip_type: addForm.trip_type
      });
      const product = (createRes.data as { data?: { id: string } })?.data;
      const productId = product?.id;
      if (productId) {
        const bandara_defaults = BANDARA_TIKET.reduce((acc, b) => {
          const def = addForm.bandara_defaults?.[b.code];
          acc[b.code] = {
            price_idr: def?.price_idr ?? 0,
            seat_quota: def?.seat_quota ?? 0
          };
          return acc;
        }, {} as Record<string, { price_idr: number; seat_quota: number }>);
        await productsApi.setTicketBandaraBulk(productId, { bandara_defaults });
      }
      showToast('Produk tiket dan harga/kuota bandara (BTH, CGK, SBY, UPG) berhasil ditambahkan', 'success');
      setShowAddModal(false);
      setAddForm({
        name: '',
        description: '',
        trip_type: 'round_trip',
        bandara_defaults: BANDARA_TIKET.reduce((acc, b) => { acc[b.code] = {}; return acc; }, {} as Record<string, { price_idr?: number; seat_quota?: number }>)
      });
      fetchTicketProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menambah produk tiket', 'error');
    } finally {
      setAddSaving(false);
    }
  };

  const saveEditProduct = async () => {
    if (!editProductModal) return;
    if (!editProductModal.name.trim()) { showToast('Nama produk wajib', 'error'); return; }
    setEditProductSaving(true);
    try {
      await productsApi.update(editProductModal.product.id, {
        name: editProductModal.name.trim(),
        description: editProductModal.description.trim() || null,
        meta: { trip_type: editProductModal.trip_type }
      });
      showToast('Produk tiket diperbarui', 'success');
      setEditProductModal(null);
      fetchTicketProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal memperbarui', 'error');
    } finally {
      setEditProductSaving(false);
    }
  };

  const handleAddToOrder = (p: TicketProduct, bandaraCode: string, bandaraName: string) => {
    const s = getSchedule(p, bandaraCode);
    const priceIdr = s?.default?.price_idr ?? 0;
    addDraftItem({
      type: 'ticket',
      product_id: p.id,
      product_name: `${p.name} (${bandaraName})`,
      unit_price_idr: priceIdr,
      quantity: 1,
      meta: { bandara: bandaraCode, trip_type: 'round_trip' }
    });
    showToast('Tiket ditambahkan ke order.', 'success');
  };

  if (user?.role === 'tiket_koordinator' && !embedInProducts) {
    return <TicketWorkPage />;
  }

  const statsTiket = [
    { label: 'Total Produk Tiket', value: ticketProducts.length, color: 'from-blue-500 to-cyan-500' },
    { label: 'Dengan Harga', value: ticketProducts.filter((p) => (p.bandara_options ?? []).some((b) => (b.default?.price_idr ?? 0) > 0)).length, color: 'from-emerald-500 to-teal-500' },
    { label: 'Bandara', value: BANDARA_TIKET.length, color: 'from-purple-500 to-pink-500' }
  ];

  return (
    <div className="space-y-5">
      {!embedInProducts && (
        <PageHeader
          title="Tiket"
          subtitle="Harga dan kuota seat per bandara: default, per bulan, per minggu, per hari. Pekerjaan tiket di menu Tiket."
          right={
            <AutoRefreshControl onRefresh={refetchAll} disabled={loadingTicketProducts} />
          }
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsTiket.map((stat, i) => (
          <StatCard key={i} icon={<Plane className="w-5 h-5" />} label={stat.label} value={stat.value} />
        ))}
      </div>

      {(canAddToOrder || embedInProducts) && (
        <Card>
          <CardSectionHeader
            icon={<Plane className="w-6 h-6" />}
            title="Produk tiket"
            subtitle="Harga dan kuota seat per bandara: default, per bulan, per minggu, per hari. Pekerjaan tiket di menu Tiket."
            right={isPusat ? (
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4" /> Tambah produk tiket
              </Button>
            ) : undefined}
          />
          <div className="pb-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)] gap-4 items-end">
            <Input label="Cari nama" type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Nama produk tiket..." fullWidth />
            <Autocomplete
              label="Tampilkan"
              value={filterIncludeInactive}
              onChange={(v) => setFilterIncludeInactive(v as 'false' | 'true')}
              options={[
                { value: 'false', label: 'Aktif saja' },
                { value: 'true', label: 'Semua (termasuk nonaktif)' }
              ]}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[120px]">
            {loadingTicketProducts ? (
              <ContentLoading />
            ) : (
            <Table<TicketProduct>
              columns={[
                { id: 'code', label: 'Kode', align: 'left' },
                { id: 'name', label: 'Nama Produk', align: 'left' },
                { id: 'workflow', label: 'Workflow', align: 'left' },
                { id: 'currency', label: 'Mata Uang', align: 'center' },
                ...BANDARA_TIKET.map((b) => ({ id: `bandara_${b.code}`, label: `${b.name} (${b.code})`, align: 'left' as const })),
                ...(canShowProductActions ? [{ id: 'actions', label: 'Aksi', align: 'right' as const }] : [])
              ]}
              data={ticketProducts}
              renderRow={(p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-2 px-4 font-medium text-slate-900">{p.code}</td>
                  <td className="py-2 px-4 text-slate-800">{p.name}</td>
                  <td className="py-2 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-700">
                      {TICKET_TRIP_LABELS[(p.meta?.trip_type as TicketTripType) || 'round_trip']}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-center text-sm text-slate-700">{((p as any).meta?.price_currency || (p as any).currency || 'IDR') as string}</td>
                  {BANDARA_TIKET.map((b) => {
                    const s = getSchedule(p, b.code);
                    const def = s?.default ?? { price_idr: 0, seat_quota: 0 };
                    const priceIdr = def.price_idr ?? 0;
                    const triple = fillFromSource('IDR', priceIdr, currencyRates);
                    const t = getPriceTripleForTable(priceIdr, triple.sar, triple.usd);
                    return (
                      <td key={b.code} className="py-2 px-4 align-top">
                        <div className="flex flex-col gap-1">
                          {t.hasPrice ? (
                            <>
                              <span className="text-slate-700 font-medium tabular-nums">{t.idrText}</span>
                              <span className="text-xs text-slate-500"><span className="text-slate-400">SAR:</span> {t.sarText} <span className="text-slate-400">USD:</span> {t.usdText}</span>
                              <span className="text-xs text-slate-400">per orang</span>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          <span className="text-xs text-slate-500">Kuota: {def.seat_quota ?? '—'}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {isPusat && (
                              <Button variant="outline" size="sm" className="p-1 min-w-0 h-7" onClick={() => openEdit(p, b.code, b.name, 'default', def)} title="Edit default">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canAddToOrder && priceIdr > 0 && (
                              <Button variant="outline" size="sm" className="p-1 min-w-0 h-7" onClick={() => handleAddToOrder(p, b.code, b.name)} title={`Tambah ke order (${b.name})`}>
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  {canShowProductActions && (
                  <td className="py-2 px-4 text-right sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                    {isPusat && (
                      <div className="flex items-center justify-end">
                        <ActionsMenu
                          align="right"
                          items={[
                            { id: 'periode', label: 'Kuota per periode', icon: <Calendar className="w-4 h-4" />, onClick: () => { setTicketQuotaProduct(p); setNewSeasonForm({ name: '', start_date: '', end_date: '', quota: 0 }); setQuotaEdit(null); } },
                            { id: 'edit', label: 'Edit produk', icon: <Pencil className="w-4 h-4" />, onClick: () => setEditProductModal({ product: p, name: p.name, description: p.description ?? '', trip_type: (p.meta?.trip_type as TicketTripType) || 'round_trip' }) },
                            { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteTicket(p), danger: true },
                          ]}
                        />
                      </div>
                    )}
                  </td>
                  )}
                </tr>
              )}
              emptyMessage="Belum ada produk tiket."
              emptyDescription={isPusat ? 'Klik "Tambah produk tiket".' : 'Tambah di master produk (admin pusat).'}
              pagination={{
                total: ticketTotal,
                page: ticketPage,
                limit: ticketLimit,
                totalPages: ticketTotalPages,
                onPageChange: setTicketPage,
                onLimitChange: (l) => { setTicketLimit(l); setTicketPage(1); }
              }}
              stickyActionsColumn
            />
            )}
          </div>
        </Card>
      )}

      {/* Modal Edit / Tambah periode */}
      <Modal open={!!editModal} onClose={() => !editSaving && setEditModal(null)}>
        {editModal && (
          <ModalBox>
            <ModalHeader
              title={`${editModal.period_type === 'default' ? 'Default' : editModal.period_type === 'month' ? 'Per bulan' : editModal.period_type === 'week' ? 'Per minggu' : 'Per hari'} — ${editModal.bandaraName} (${editModal.bandaraCode})`}
              subtitle={editModal.product.name}
              icon={<Calendar className="w-5 h-5" />}
              onClose={() => !editSaving && setEditModal(null)}
            />
            <ModalBody className="space-y-4">

            {editModal.period_type !== 'default' && (
              <div className="mb-4">
                <Input
                  label={editModal.period_type === 'month' ? 'Bulan (YYYY-MM)' : editModal.period_type === 'week' ? 'Tanggal (otomatis pakai Senin minggu itu)' : 'Tanggal (YYYY-MM-DD)'}
                  type={editModal.period_type === 'month' ? 'month' : 'date'}
                  value={editModal.period_type === 'month' ? (editModal.period_key || '') : (editModal.period_key || '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (editModal.period_type === 'month') setEditModal((m) => m ? { ...m, period_key: v ? `${v}` : undefined } : null);
                    else if (editModal.period_type === 'week') setEditModal((m) => m ? { ...m, period_key: v ? getWeekStart(v) : undefined } : null);
                    else setEditModal((m) => m ? { ...m, period_key: v || undefined } : null);
                  }}
                  fullWidth
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Harga — pilih mata uang input</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(['IDR', 'SAR', 'USD'] as const).map((curKey) => (
                    <Button
                      key={curKey}
                      type="button"
                      variant={editModal.price_currency === curKey ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setEditModal((m) => m ? { ...m, price_currency: curKey } : null)}
                    >
                      {curKey}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['IDR', 'SAR', 'USD'] as const).map((curKey) => {
                    const triple = fillFromSource('IDR', editModal.price_idr || 0, currencyRates);
                    const val = curKey === 'IDR' ? triple.idr : curKey === 'SAR' ? triple.sar : triple.usd;
                    return (
                      <PriceInput
                        key={curKey}
                        label={`${curKey}${editModal.price_currency !== curKey ? ' (konversi)' : ''}`}
                        value={val ?? 0}
                        currency={curKey}
                        onChange={(n) => {
                          const next = fillFromSource(curKey, n, currencyRates);
                          setEditModal((m) => m ? { ...m, price_idr: Math.round(next.idr) } : null);
                        }}
                        disabled={editModal.price_currency !== curKey}
                        fullWidth
                      />
                    );
                  })}
                </div>
              </div>
              <Input
                label="Kuota seat"
                type="number"
                min={0}
                value={editModal.seat_quota != null ? String(editModal.seat_quota) : ''}
                onChange={(e) => setEditModal((m) => m ? { ...m, seat_quota: Math.max(0, parseInt(e.target.value, 10) || 0) } : null)}
                fullWidth
              />
            </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditModal(null)} disabled={editSaving}>Batal</Button>
              <Button variant="primary" onClick={saveEdit} disabled={editSaving || (editModal.period_type !== 'default' && !editModal.period_key)}>
                {editSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal Tambah produk tiket */}
      <Modal open={showAddModal} onClose={() => !addSaving && setShowAddModal(false)}>
        {showAddModal && (
          <ModalBox>
            <ModalHeader
              title="Tambah produk tiket"
              subtitle="Bandara keberangkatan & periode harga"
              icon={<Plus className="w-5 h-5" />}
              onClose={() => !addSaving && setShowAddModal(false)}
            />
            <ModalBody className="flex-1 overflow-y-auto space-y-6">
              {/* Info produk */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Info produk</span>
                </div>
                <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4 space-y-4">
                  <Input
                    label="Nama produk"
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Contoh: Tiket pesawat umroh"
                    required
                    fullWidth
                  />
                  <Textarea
                    label="Deskripsi (opsional)"
                    value={addForm.description ?? ''}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Deskripsi singkat produk tiket"
                    rows={2}
                    fullWidth
                  />
                </div>
              </section>

              {/* Workflow perjalanan: pergi saja / pulang saja / pulang pergi */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Plane className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Workflow perjalanan</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Pilih jenis perjalanan untuk produk tiket ini.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['one_way', 'return_only', 'round_trip'] as const).map((tripType) => (
                    <button
                      key={tripType}
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, trip_type: tripType }))}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        addForm.trip_type === tripType
                          ? 'border-primary-500 bg-primary-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center justify-center w-10 h-10 rounded-lg mb-2 text-slate-600"
                        style={{ backgroundColor: addForm.trip_type === tripType ? 'var(--color-primary-100, #e0e7ff)' : undefined }}
                      >
                        {tripType === 'one_way' && <ArrowRight className="w-5 h-5" />}
                        {tripType === 'return_only' && <ArrowLeft className="w-5 h-5" />}
                        {tripType === 'round_trip' && <ArrowLeftRight className="w-5 h-5" />}
                      </span>
                      <span className="block font-medium text-slate-800 text-sm">{TICKET_TRIP_LABELS[tripType]}</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {tripType === 'one_way' && 'Keberangkatan saja'}
                        {tripType === 'return_only' && 'Kepulangan saja'}
                        {tripType === 'round_trip' && 'Keberangkatan + kepulangan'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Harga & kuota per bandara */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Harga & kuota default per bandara</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Opsional. Isi untuk langsung mengisi harga dan kuota dasar. Periode per bulan/minggu/hari bisa diatur setelah produk dibuat.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {BANDARA_TIKET.map((b) => (
                    <div key={b.code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-600 font-bold text-sm">{b.code}</span>
                        <span className="font-medium text-slate-800">{b.name}</span>
                      </div>
                      <div className="space-y-3">
                        <Input
                          label="Harga (IDR)"
                          type="number"
                          min={0}
                          value={addForm.bandara_defaults?.[b.code]?.price_idr != null ? String(addForm.bandara_defaults[b.code].price_idr) : ''}
                          onChange={(e) => setAddForm((f) => ({
                            ...f,
                            bandara_defaults: {
                              ...f.bandara_defaults,
                              [b.code]: { ...(f.bandara_defaults?.[b.code] || {}), price_idr: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) }
                            }
                          }))}
                          placeholder="0"
                          fullWidth
                        />
                        <Input
                          label="Kuota seat"
                          type="number"
                          min={0}
                          value={addForm.bandara_defaults?.[b.code]?.seat_quota != null ? String(addForm.bandara_defaults[b.code].seat_quota) : ''}
                          onChange={(e) => setAddForm((f) => ({
                            ...f,
                            bandara_defaults: {
                              ...f.bandara_defaults,
                              [b.code]: { ...(f.bandara_defaults?.[b.code] || {}), seat_quota: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0) }
                            }
                          }))}
                          placeholder="0"
                          fullWidth
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={addSaving}>Batal</Button>
              <Button variant="primary" onClick={handleCreateTicket} disabled={addSaving}>
                {addSaving ? 'Menyimpan...' : 'Tambah produk'}
              </Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal Edit produk tiket */}
      <Modal open={!!editProductModal} onClose={() => !editProductSaving && setEditProductModal(null)}>
        {editProductModal && (
          <ModalBox>
            <ModalHeader title="Edit produk tiket" subtitle="Ubah nama dan pengaturan produk tiket" icon={<Pencil className="w-5 h-5" />} onClose={() => !editProductSaving && setEditProductModal(null)} />
            <ModalBody className="space-y-4">
              <Input
                label="Nama produk"
                type="text"
                value={editProductModal.name ?? ''}
                onChange={(e) => setEditProductModal((m) => m ? { ...m, name: e.target.value } : null)}
                required
                fullWidth
              />
              <Textarea
                label="Deskripsi"
                value={editProductModal.description ?? ''}
                onChange={(e) => setEditProductModal((m) => m ? { ...m, description: e.target.value } : null)}
                rows={2}
                fullWidth
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Workflow perjalanan</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['one_way', 'return_only', 'round_trip'] as const).map((tripType) => (
                    <Button
                      key={tripType}
                      type="button"
                      variant={editProductModal.trip_type === tripType ? 'primary' : 'outline'}
                      size="sm"
                      className="w-full justify-center gap-1.5"
                      onClick={() => setEditProductModal((m) => m ? { ...m, trip_type: tripType } : null)}
                    >
                      {tripType === 'one_way' && <ArrowRight className="w-4 h-4" />}
                      {tripType === 'return_only' && <ArrowLeft className="w-4 h-4" />}
                      {tripType === 'round_trip' && <ArrowLeftRight className="w-4 h-4" />}
                      {TICKET_TRIP_LABELS[tripType]}
                    </Button>
                  ))}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditProductModal(null)} disabled={editProductSaving}>Batal</Button>
              <Button variant="primary" onClick={saveEditProduct} disabled={editProductSaving}>
                {editProductSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal: Kuota per periode (Admin Pusat) */}
      <Modal open={!!ticketQuotaProduct} onClose={() => !addSeasonSaving && !quotaSaving && setTicketQuotaProduct(null)}>
        {ticketQuotaProduct && (
          <ModalBox>
            <ModalHeader
              title="Kuota per periode"
              subtitle={ticketQuotaProduct.name}
              icon={<Calendar className="w-5 h-5" />}
              onClose={() => !addSeasonSaving && !quotaSaving && setTicketQuotaProduct(null)}
            />
            <ModalBody className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Tambah periode</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Nama periode" type="text" placeholder="Nama periode" value={newSeasonForm.name} onChange={(e) => setNewSeasonForm((f) => ({ ...f, name: e.target.value }))} />
                  <Input label="Mulai" type="date" value={newSeasonForm.start_date} onChange={(e) => setNewSeasonForm((f) => ({ ...f, start_date: e.target.value }))} />
                  <Input label="Selesai" type="date" value={newSeasonForm.end_date} onChange={(e) => setNewSeasonForm((f) => ({ ...f, end_date: e.target.value }))} />
                  <Input label="Kuota" type="number" min={0} placeholder="Kuota" value={newSeasonForm.quota ? String(newSeasonForm.quota) : ''} onChange={(e) => setNewSeasonForm((f) => ({ ...f, quota: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
                </div>
                <Button size="sm" className="mt-3" disabled={addSeasonSaving || !newSeasonForm.name.trim() || !newSeasonForm.start_date || !newSeasonForm.end_date} onClick={async () => {
                  if (!ticketQuotaProduct?.id) return;
                  setAddSeasonSaving(true);
                  try {
                    await adminPusatApi.createTicketSeason(ticketQuotaProduct.id, { name: newSeasonForm.name.trim(), start_date: newSeasonForm.start_date, end_date: newSeasonForm.end_date, quota: newSeasonForm.quota });
                    showToast('Periode ditambahkan', 'success');
                    setNewSeasonForm({ name: '', start_date: '', end_date: '', quota: 0 });
                    const res = await adminPusatApi.listTicketSeasons(ticketQuotaProduct.id);
                    setTicketSeasons((res.data as { data?: TicketSeason[] })?.data ?? []);
                  } catch (e: unknown) {
                    const err = e as { response?: { data?: { message?: string } } };
                    showToast(err.response?.data?.message || 'Gagal menambah periode', 'error');
                  } finally { setAddSeasonSaving(false); }
                }}>
                  {addSeasonSaving ? 'Menyimpan...' : 'Tambah periode'}
                </Button>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Daftar periode</h4>
                {ticketSeasonsLoading ? (
                  <ContentLoading inline />
                ) : ticketSeasons.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada periode. Tambah periode di atas untuk mengatur kuota tiket per periode.</p>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold text-slate-600">Nama</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-600">Mulai</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-600">Selesai</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600">Kuota</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600 sticky right-0 z-10 bg-slate-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ticketSeasons.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 px-3 font-medium text-slate-800">{s.name}</td>
                            <td className="py-2 px-3 text-slate-600">{s.start_date}</td>
                            <td className="py-2 px-3 text-slate-600">{s.end_date}</td>
                            <td className="py-2 px-3 text-right">
                              {quotaEdit?.seasonId === s.id ? (
                                <span className="flex items-center justify-end gap-1">
                                  <Input type="number" min={0} value={quotaEdit.value} onChange={(e) => setQuotaEdit((q) => q ? { ...q, value: e.target.value } : null)} className="w-20" fullWidth={false} />
                                  <Button size="sm" variant="primary" disabled={quotaSaving} onClick={async () => {
                                    if (!ticketQuotaProduct?.id || !quotaEdit) return;
                                    setQuotaSaving(true);
                                    try {
                                      await adminPusatApi.setTicketSeasonQuota(ticketQuotaProduct.id, s.id, { quota: Math.max(0, parseInt(quotaEdit.value, 10) || 0) });
                                      showToast('Kuota disimpan', 'success');
                                      setQuotaEdit(null);
                                      const res = await adminPusatApi.listTicketSeasons(ticketQuotaProduct.id);
                                      setTicketSeasons((res.data as { data?: TicketSeason[] })?.data ?? []);
                                    } catch (e: unknown) {
                                      const err = e as { response?: { data?: { message?: string } } };
                                      showToast(err.response?.data?.message || 'Gagal', 'error');
                                    } finally { setQuotaSaving(false); }
                                  }}>Simpan</Button>
                                </span>
                              ) : (
                                <span className="tabular-nums">{s.Quota?.quota ?? 0}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                              {quotaEdit?.seasonId === s.id ? (
                                <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setQuotaEdit(null)}>Batal</button>
                              ) : (
                                <>
                                  <button type="button" className="text-primary-600 hover:underline text-xs mr-2" onClick={() => setQuotaEdit({ seasonId: s.id, value: String(s.Quota?.quota ?? 0) })}>Set kuota</button>
                                  <button type="button" className="text-red-600 hover:underline text-xs" onClick={async () => {
                                    if (!ticketQuotaProduct?.id || !window.confirm('Hapus periode ini?')) return;
                                    try {
                                      await adminPusatApi.deleteTicketSeason(ticketQuotaProduct.id, s.id);
                                      showToast('Periode dihapus', 'success');
                                      setTicketSeasons((prev) => prev.filter((x) => x.id !== s.id));
                                    } catch (e: unknown) {
                                      const err = e as { response?: { data?: { message?: string } } };
                                      showToast(err.response?.data?.message || 'Gagal menghapus', 'error');
                                    }
                                  }}>Hapus</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </ModalBody>
          </ModalBox>
        )}
      </Modal>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
        <Plane className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-slate-900 text-sm">Penerbitan tiket</h3>
          <p className="text-sm text-slate-600 mt-0.5">Order dan penerbitan tiket jamaah dikelola dengan akun role Tiket cabang.</p>
        </div>
      </div>
    </div>
  );
};

export default TicketsPage;
