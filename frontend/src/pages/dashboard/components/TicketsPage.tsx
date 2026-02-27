import React, { useState, useEffect, useCallback } from 'react';
import { Plane, ShoppingCart, Plus, Pencil, X, Package, MapPin, ArrowRight, ArrowLeft, ArrowLeftRight } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { businessRulesApi, productsApi } from '../../../services/api';
import { fillFromSource } from '../../../utils/currencyConversion';
import TicketWorkPage from './TicketWorkPage';

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

const formatRp = (n: number) => (n > 0 ? `Rp ${Number(n).toLocaleString('id-ID')}` : '—');

type PeriodType = 'default' | 'month' | 'week' | 'day';

type TicketsPageProps = { embedInProducts?: boolean };

const TicketsPage: React.FC<TicketsPageProps> = ({ embedInProducts }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [ticketProducts, setTicketProducts] = useState<TicketProduct[]>([]);
  const [loadingTicketProducts, setLoadingTicketProducts] = useState(false);
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
  const { addItem: addDraftItem } = useOrderDraft();

  const isPusat = user?.role === 'super_admin' || user?.role === 'admin_pusat';
  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'role_invoice_saudi';

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
    setLoadingTicketProducts(true);
    const params = { type: 'ticket', with_prices: 'true', include_inactive: 'false', limit: 50, ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
    productsApi.list(params)
      .then((res) => {
        const data = (res.data as { data?: TicketProduct[] })?.data;
        setTicketProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => setTicketProducts([]))
      .finally(() => setLoadingTicketProducts(false));
  }, [canAddToOrder, embedInProducts, user?.role]);

  useEffect(() => { fetchTicketProducts(); }, [fetchTicketProducts]);
  const refetchAll = useCallback(() => fetchTicketProducts(), [fetchTicketProducts]);

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tiket</h2>
          <p className="text-slate-600 text-sm mt-0.5">
            Harga dan kuota seat per bandara: default, per bulan, per minggu, per hari. Pekerjaan tiket di menu Tiket.
          </p>
        </div>
        <AutoRefreshControl onRefresh={refetchAll} disabled={loadingTicketProducts} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsTiket.map((stat, i) => (
          <Card key={i} padding="md" className="border border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white shrink-0 shadow-sm`}>
                <Plane className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {(canAddToOrder || embedInProducts) && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <h3 className="text-base font-semibold text-slate-900">Produk tiket</h3>
            {isPusat && (
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4" /> Tambah produk tiket
              </Button>
            )}
          </div>

          {loadingTicketProducts ? (
            <p className="text-slate-500 text-sm py-4">Memuat produk...</p>
          ) : ticketProducts.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">Belum ada produk tiket. {isPusat ? 'Klik "Tambah produk tiket".' : 'Tambah di master produk (admin pusat).'}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Kode</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Nama Produk</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Workflow</th>
                    {BANDARA_TIKET.map((b) => (
                      <th key={b.code} className="text-left py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">{b.name} ({b.code})</th>
                    ))}
                    <th className="text-right py-3 px-4 font-semibold text-slate-700 sticky right-0 z-10 bg-slate-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketProducts.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2 px-4 font-medium text-slate-900">{p.code}</td>
                      <td className="py-2 px-4 text-slate-800">{p.name}</td>
                      <td className="py-2 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-700">
                          {TICKET_TRIP_LABELS[(p.meta?.trip_type as TicketTripType) || 'round_trip']}
                        </span>
                      </td>
                      {BANDARA_TIKET.map((b) => {
                        const s = getSchedule(p, b.code);
                        const def = s?.default ?? { price_idr: 0, seat_quota: 0 };
                        const priceIdr = def.price_idr ?? 0;
                        return (
                          <td key={b.code} className="py-2 px-4 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-600">{formatRp(priceIdr)}</span>
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
                      <td className="py-2 px-4 text-right sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                        {isPusat && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditProductModal({
                              product: p,
                              name: p.name,
                              description: p.description ?? '',
                              trip_type: (p.meta?.trip_type as TicketTripType) || 'round_trip'
                            })}
                          >
                            <Pencil className="w-4 h-4 mr-1" /> Edit produk
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal Edit / Tambah periode */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !editSaving && setEditModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              {editModal.period_type === 'default' ? 'Default' : editModal.period_type === 'month' ? 'Per bulan' : editModal.period_type === 'week' ? 'Per minggu' : 'Per hari'} — {editModal.bandaraName} ({editModal.bandaraCode})
            </h3>
            <p className="text-sm text-slate-500 mb-4">{editModal.product.name}</p>

            {editModal.period_type !== 'default' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editModal.period_type === 'month' ? 'Bulan (YYYY-MM)' : editModal.period_type === 'week' ? 'Tanggal (otomatis pakai Senin minggu itu)' : 'Tanggal (YYYY-MM-DD)'}
                </label>
                <input
                  type={editModal.period_type === 'month' ? 'month' : 'date'}
                  value={editModal.period_type === 'month' ? (editModal.period_key || '') : (editModal.period_key || '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (editModal.period_type === 'month') setEditModal((m) => m ? { ...m, period_key: v ? `${v}` : undefined } : null);
                    else if (editModal.period_type === 'week') setEditModal((m) => m ? { ...m, period_key: v ? getWeekStart(v) : undefined } : null);
                    else setEditModal((m) => m ? { ...m, period_key: v || undefined } : null);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Harga (IDR)</label>
                <select
                  value={editModal.price_currency}
                  onChange={(e) => setEditModal((m) => m ? { ...m, price_currency: e.target.value as 'IDR' | 'SAR' | 'USD' } : null)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2"
                >
                  <option value="IDR">IDR</option>
                  <option value="SAR">SAR</option>
                  <option value="USD">USD</option>
                </select>
                <div className="flex flex-wrap gap-2">
                  {(['IDR', 'SAR', 'USD'] as const).map((curKey) => {
                    const triple = fillFromSource('IDR', editModal.price_idr || 0, currencyRates);
                    const val = curKey === 'IDR' ? triple.idr : curKey === 'SAR' ? triple.sar : triple.usd;
                    const isEditable = editModal.price_currency === curKey;
                    return (
                      <div key={curKey}>
                        <span className="text-xs text-slate-500 block mb-0.5">{curKey}{!isEditable && ' (konversi)'}</span>
                        <input
                          type="number"
                          min={0}
                          step={curKey === 'IDR' ? 1 : 0.01}
                          value={val || ''}
                          readOnly={!isEditable}
                          onChange={isEditable ? (e) => {
                            const v = parseFloat(e.target.value) || 0;
                            const next = fillFromSource(curKey, v, currencyRates);
                            setEditModal((m) => m ? { ...m, price_idr: Math.round(next.idr) } : null);
                          } : undefined}
                          className={`w-full max-w-[120px] border rounded-lg px-3 py-2 text-sm ${isEditable ? 'bg-white' : 'bg-slate-100'}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kuota seat</label>
                <input
                  type="number"
                  min={0}
                  value={editModal.seat_quota || ''}
                  onChange={(e) => setEditModal((m) => m ? { ...m, seat_quota: Math.max(0, parseInt(e.target.value, 10) || 0) } : null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" onClick={() => setEditModal(null)} disabled={editSaving}>Batal</Button>
              <Button variant="primary" onClick={saveEdit} disabled={editSaving || (editModal.period_type !== 'default' && !editModal.period_key)}>
                {editSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah produk tiket — layout modern */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !addSaving && setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Tambah produk tiket</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Nama, deskripsi, dan harga & kuota default per bandara</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !addSaving && setShowAddModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Info produk */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Info produk</span>
                </div>
                <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama produk <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Contoh: Tiket pesawat umroh"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-400 bg-white placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Deskripsi <span className="text-slate-400 font-normal">(opsional)</span></label>
                    <textarea
                      value={addForm.description}
                      onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Deskripsi singkat produk tiket"
                      rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-400 bg-white placeholder:text-slate-400 resize-none"
                    />
                  </div>
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
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Harga (IDR)</label>
                          <input
                            type="number"
                            min={0}
                            value={addForm.bandara_defaults?.[b.code]?.price_idr ?? ''}
                            onChange={(e) => setAddForm((f) => ({
                              ...f,
                              bandara_defaults: {
                                ...f.bandara_defaults,
                                [b.code]: { ...(f.bandara_defaults?.[b.code] || {}), price_idr: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) }
                              }
                            }))}
                            placeholder="0"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Kuota seat</label>
                          <input
                            type="number"
                            min={0}
                            value={addForm.bandara_defaults?.[b.code]?.seat_quota ?? ''}
                            onChange={(e) => setAddForm((f) => ({
                              ...f,
                              bandara_defaults: {
                                ...f.bandara_defaults,
                                [b.code]: { ...(f.bandara_defaults?.[b.code] || {}), seat_quota: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0) }
                              }
                            }))}
                            placeholder="0"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={addSaving}>Batal</Button>
              <Button variant="primary" onClick={handleCreateTicket} disabled={addSaving}>
                {addSaving ? 'Menyimpan...' : 'Tambah produk'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit produk tiket (nama, deskripsi, workflow) */}
      {editProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !editProductSaving && setEditProductModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <h3 className="text-lg font-bold text-slate-900">Edit produk tiket</h3>
              <button type="button" onClick={() => !editProductSaving && setEditProductModal(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama produk <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editProductModal.name}
                  onChange={(e) => setEditProductModal((m) => m ? { ...m, name: e.target.value } : null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  value={editProductModal.description}
                  onChange={(e) => setEditProductModal((m) => m ? { ...m, description: e.target.value } : null)}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Workflow perjalanan</label>
                <div className="flex flex-wrap gap-2">
                  {(['one_way', 'return_only', 'round_trip'] as const).map((tripType) => (
                    <button
                      key={tripType}
                      type="button"
                      onClick={() => setEditProductModal((m) => m ? { ...m, trip_type: tripType } : null)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        editProductModal.trip_type === tripType
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {tripType === 'one_way' && <ArrowRight className="w-4 h-4" />}
                      {tripType === 'return_only' && <ArrowLeft className="w-4 h-4" />}
                      {tripType === 'round_trip' && <ArrowLeftRight className="w-4 h-4" />}
                      {TICKET_TRIP_LABELS[tripType]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <Button variant="outline" onClick={() => setEditProductModal(null)} disabled={editProductSaving}>Batal</Button>
              <Button variant="primary" onClick={saveEditProduct} disabled={editProductSaving}>
                {editProductSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
