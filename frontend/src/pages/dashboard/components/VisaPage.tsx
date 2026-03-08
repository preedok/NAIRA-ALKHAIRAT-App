import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShoppingCart, Plus, FileText, Pencil, X, Package, Coins, Settings2, BarChart3, Layers, Hotel, Wallet, Calendar, Trash2, Eye } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ActionsMenu from '../../../components/common/ActionsMenu';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { AutoRefreshControl } from '../../../components/common';
import PageHeader from '../../../components/common/PageHeader';
import { StatCard, CardSectionHeader, Input, PriceCurrencyField, Textarea, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ContentLoading } from '../../../components/common';
import Badge from '../../../components/common/Badge';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { businessRulesApi, productsApi, adminPusatApi, type VisaSeason } from '../../../services/api';
import { fillFromSource, getEditPriceDisplay } from '../../../utils/currencyConversion';
import Table from '../../../components/common/Table';
import { getPriceTripleForTable, PRICE_COLUMN_LABEL } from '../../../utils';
import VisaWorkPage from './VisaWorkPage';

const PAGE_SIZE = 25;

export const VISA_KIND_LABELS: Record<string, string> = {
  only: 'Visa Only',
  tasreh: 'Visa + Tasreh',
  premium: 'Visa Premium'
};

/** Deskripsi singkat per jenis visa untuk panduan admin */
export const VISA_KIND_DESCRIPTIONS: Record<string, string> = {
  only: 'Visa umroh standar tanpa layanan tambahan.',
  tasreh: 'Visa umroh dengan layanan tasreh (pembukaan visa di Saudi).',
  premium: 'Visa umroh premium dengan fasilitas prioritas dan layanan lengkap.'
};

export type VisaKind = 'only' | 'tasreh' | 'premium';

interface VisaProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  meta?: { visa_kind?: VisaKind; require_hotel?: boolean; currency?: string } | null;
  quota?: number;
  price_general_idr?: number | null;
  price_general_sar?: number | null;
  price_general_usd?: number | null;
  price_general?: number | null;
  price_branch?: number | null;
  currency?: string;
}

type VisaPageProps = {
  embedInProducts?: boolean;
  refreshTrigger?: number;
  embedFilterOpen?: boolean;
  embedFilterOnToggle?: () => void;
  onFilterActiveChange?: (active: boolean) => void;
};

const VisaPage: React.FC<VisaPageProps> = ({
  embedInProducts,
  refreshTrigger,
  embedFilterOpen,
  embedFilterOnToggle,
  onFilterActiveChange
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});

  const isPusat = user?.role === 'super_admin' || user?.role === 'admin_pusat' || user?.role === 'role_accounting';
  const canAddToOrder = user?.role === 'owner_mou' || user?.role === 'owner_non_mou' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  /** Kolom Aksi hanya untuk owner, invoice, admin pusat, accounting */
  const canShowProductActions = ['owner_mou', 'owner_non_mou', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'role_accounting', 'super_admin'].includes(user?.role || '');
  const [visaProducts, setVisaProducts] = useState<VisaProduct[]>([]);
  const [loadingVisaProducts, setLoadingVisaProducts] = useState(false);
  const [visaPage, setVisaPage] = useState(1);
  const [visaLimit, setVisaLimit] = useState(PAGE_SIZE);
  const [visaTotal, setVisaTotal] = useState(0);
  const [visaTotalPages, setVisaTotalPages] = useState(1);
  const [showAddVisaModal, setShowAddVisaModal] = useState(false);
  const [addVisaForm, setAddVisaForm] = useState({
    name: '',
    description: '',
    visa_kind: 'only' as VisaKind,
    quota: 0,
    require_hotel: false,
    price_value: 0,
    price_currency: 'IDR' as 'IDR' | 'SAR' | 'USD'
  });
  const [addVisaSaving, setAddVisaSaving] = useState(false);
  const [editingVisa, setEditingVisa] = useState<VisaProduct | null>(null);
  const [editVisaForm, setEditVisaForm] = useState({
    name: '',
    description: '',
    visa_kind: 'only' as VisaKind,
    quota: 0,
    require_hotel: false,
    price_value: 0,
    price_currency: 'IDR' as 'IDR' | 'SAR' | 'USD'
  });
  const [editVisaSaving, setEditVisaSaving] = useState(false);
  const [visaSeasonsProduct, setVisaSeasonsProduct] = useState<VisaProduct | null>(null);
  const [visaSeasons, setVisaSeasons] = useState<VisaSeason[]>([]);
  const [visaSeasonsLoading, setVisaSeasonsLoading] = useState(false);
  const [newSeasonForm, setNewSeasonForm] = useState({ name: '', start_date: '', end_date: '', quota: 0 });
  const [addSeasonSaving, setAddSeasonSaving] = useState(false);
  const [quotaEdit, setQuotaEdit] = useState<{ seasonId: string; value: string } | null>(null);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [filterIncludeInactive, setFilterIncludeInactive] = useState<'false' | 'true'>('false');
  const [searchName, setSearchName] = useState('');
  const [debouncedSearchName, setDebouncedSearchName] = useState('');
  const lastFilterKeyRef = useRef<string>('');
  const tableSectionRef = useRef<HTMLDivElement>(null);
  const { addItem: addDraftItem } = useOrderDraft();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchName(searchName), 350);
    return () => clearTimeout(t);
  }, [searchName]);

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

  const fetchVisaProducts = useCallback(() => {
    if (!canAddToOrder && !embedInProducts) return;
    const filterKey = `${debouncedSearchName}|${filterIncludeInactive}`;
    let pageToUse = visaPage;
    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      setVisaPage(1);
      pageToUse = 1;
    }
    setLoadingVisaProducts(true);
    const params = { type: 'visa', with_prices: 'true', include_inactive: filterIncludeInactive, limit: visaLimit, page: pageToUse, ...(debouncedSearchName.trim() ? { name: debouncedSearchName.trim() } : {}), ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}) };
    productsApi.list(params)
      .then((res) => {
        const body = res.data as { data?: VisaProduct[]; pagination?: { total: number; page: number; limit: number; totalPages: number } };
        setVisaProducts(Array.isArray(body.data) ? body.data : []);
        const p = body.pagination;
        if (p) {
          setVisaTotal(p.total);
          setVisaPage(p.page);
          setVisaLimit(p.limit);
          setVisaTotalPages(p.totalPages || 1);
        }
      })
      .catch(() => setVisaProducts([]))
      .finally(() => setLoadingVisaProducts(false));
  }, [canAddToOrder, embedInProducts, user?.role, filterIncludeInactive, visaLimit, visaPage, debouncedSearchName]);

  useEffect(() => {
    fetchVisaProducts();
  }, [fetchVisaProducts]);

  useEffect(() => {
    if (embedInProducts && refreshTrigger != null && refreshTrigger > 0) fetchVisaProducts();
  }, [embedInProducts, refreshTrigger, fetchVisaProducts]);

  useEffect(() => {
    if (!visaSeasonsProduct?.id) return;
    setVisaSeasonsLoading(true);
    adminPusatApi.listVisaSeasons(visaSeasonsProduct.id)
      .then((res) => setVisaSeasons((res.data as { data?: VisaSeason[] })?.data ?? []))
      .catch(() => setVisaSeasons([]))
      .finally(() => setVisaSeasonsLoading(false));
  }, [visaSeasonsProduct?.id]);

  const refetchAll = useCallback(() => {
    fetchVisaProducts();
  }, [fetchVisaProducts]);

  const handleDeleteVisa = async (p: VisaProduct) => {
    if (!window.confirm(`Hapus produk visa "${p.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await productsApi.delete(p.id);
      showToast('Produk visa dihapus', 'success');
      fetchVisaProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menghapus produk visa', 'error');
    }
  };

  const handleOpenEdit = (p: VisaProduct) => {
    const { currency, value } = getEditPriceDisplay(p, currencyRates);
    setEditingVisa(p);
    setEditVisaForm({
      name: p.name || '',
      description: p.description || '',
      visa_kind: (p.meta?.visa_kind || 'only') as VisaKind,
      quota: p.quota ?? (p as { meta?: { default_quota?: number } }).meta?.default_quota ?? 0,
      require_hotel: p.meta?.require_hotel === true,
      price_value: value > 0 ? value : 0,
      price_currency: currency
    });
  };

  const handleSaveEdit = async () => {
    if (!editingVisa?.id || !editVisaForm.name.trim()) {
      showToast('Nama produk visa wajib', 'error');
      return;
    }
    setEditVisaSaving(true);
    try {
      await productsApi.update(editingVisa.id, {
        name: editVisaForm.name.trim(),
        description: editVisaForm.description.trim() || null,
        meta: { visa_kind: editVisaForm.visa_kind, require_hotel: editVisaForm.require_hotel, default_quota: editVisaForm.quota >= 0 ? editVisaForm.quota : null }
      });
      await adminPusatApi.setProductAvailability(editingVisa.id, {
        quantity: Math.max(0, Math.floor(Number(editVisaForm.quota) || 0))
      });
      const pricesRes = await productsApi.listPrices({ product_id: editingVisa.id });
      const prices = (pricesRes.data as { data?: Array<{ id: string; branch_id: string | null; owner_id: string | null }> })?.data ?? [];
      const generalPrices = prices.filter((p) => !p.branch_id && !p.owner_id);
      for (const gp of generalPrices) {
        await productsApi.deletePrice(gp.id);
      }
      if (editVisaForm.price_value > 0) {
        const triple = fillFromSource(editVisaForm.price_currency, editVisaForm.price_value, currencyRates);
        await productsApi.createPrice({
          product_id: editingVisa.id,
          branch_id: null,
          owner_id: null,
          amount_idr: Math.round(triple.idr || 0),
          amount_sar: triple.sar,
          amount_usd: triple.usd,
          reference_currency: editVisaForm.price_currency
        });
      }
      showToast('Produk visa berhasil diperbarui', 'success');
      setEditingVisa(null);
      fetchVisaProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menyimpan', 'error');
    } finally {
      setEditVisaSaving(false);
    }
  };

  const handleCreateVisa = async () => {
    if (!addVisaForm.name.trim()) {
      showToast('Nama produk visa wajib', 'error');
      return;
    }
    setAddVisaSaving(true);
    try {
      const createRes = await productsApi.createVisa({
        name: addVisaForm.name.trim(),
        description: addVisaForm.description.trim() || undefined,
        visa_kind: addVisaForm.visa_kind,
        require_hotel: addVisaForm.require_hotel,
        default_quota: addVisaForm.quota > 0 || addVisaForm.quota === 0 ? addVisaForm.quota : undefined,
        currency: addVisaForm.price_currency
      });
      const product = (createRes.data as { data?: { id: string } })?.data;
      const productId = product?.id;

      if (productId && addVisaForm.price_value > 0) {
        const triple = fillFromSource(addVisaForm.price_currency, addVisaForm.price_value, currencyRates);
        await productsApi.createPrice({
          product_id: productId,
          branch_id: null,
          owner_id: null,
          amount_idr: Math.round(triple.idr || 0),
          amount_sar: triple.sar,
          amount_usd: triple.usd,
          reference_currency: addVisaForm.price_currency
        });
      }

      if (productId) {
        await adminPusatApi.setProductAvailability(productId, {
          quantity: Math.max(0, Math.floor(Number(addVisaForm.quota) || 0))
        });
      }

      const hasPrice = productId && addVisaForm.price_value > 0;
      const hasQuota = productId && (addVisaForm.quota > 0 || addVisaForm.quota === 0);
      const msg = hasPrice && hasQuota ? 'Produk visa, harga default, dan kuota berhasil ditambahkan' : hasPrice ? 'Produk visa dan harga default berhasil ditambahkan' : hasQuota ? 'Produk visa dan kuota berhasil ditambahkan' : 'Produk visa berhasil ditambahkan';
      showToast(msg, 'success');
      setShowAddVisaModal(false);
      setAddVisaForm({ name: '', description: '', visa_kind: 'only', quota: 0, require_hotel: false, price_value: 0, price_currency: 'IDR' });
    fetchVisaProducts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err.response?.data?.message || 'Gagal menambah produk visa', 'error');
    } finally {
      setAddVisaSaving(false);
    }
  };

  /** Statistik dari visaProducts */
  const visaStats = React.useMemo(() => {
    const list = visaProducts;
    const byKind = { only: 0, tasreh: 0, premium: 0 };
    let totalQuota = 0;
    let withQuotaLimit = 0;
    let requireHotelCount = 0;
    let withPriceCount = 0;
    let totalValueIdr = 0;
    let minPriceIdr: number | null = null;
    let maxPriceIdr: number | null = null;

    list.forEach((p) => {
      const kind = (p.meta?.visa_kind || 'only') as VisaKind;
      if (kind in byKind) byKind[kind]++;
      const q = p.quota ?? 0;
      if (q > 0) {
        withQuotaLimit++;
        totalQuota += q;
      }
      if (p.meta?.require_hotel === true) requireHotelCount++;
      const priceIdr = p.price_general_idr ?? (p.currency === 'IDR' || !p.currency ? p.price_general ?? p.price_branch : null) ?? 0;
      const numPrice = Number(priceIdr) || 0;
      if (numPrice > 0) {
        withPriceCount++;
        totalValueIdr += numPrice;
        if (minPriceIdr == null || numPrice < minPriceIdr) minPriceIdr = numPrice;
        if (maxPriceIdr == null || numPrice > maxPriceIdr) maxPriceIdr = numPrice;
      }
    });

    const avgPriceIdr = withPriceCount > 0 ? Math.round(totalValueIdr / withPriceCount) : 0;
    return {
      total: list.length,
      byKind,
      totalQuota,
      withQuotaLimit,
      requireHotelCount,
      withPriceCount,
      avgPriceIdr,
      minPriceIdr: minPriceIdr ?? 0,
      maxPriceIdr: maxPriceIdr ?? 0
    };
  }, [visaProducts]);

  if (user?.role === 'visa_koordinator' && !embedInProducts) {
    return <VisaWorkPage />;
  }

  return (
    <div className="space-y-6">
      {!embedInProducts && (
        <PageHeader
          title="Visa"
          subtitle="Produk visa umroh: kelola harga, kuota, dan periode. Admin pusat dapat edit dan hapus."
          right={
            <AutoRefreshControl onRefresh={refetchAll} disabled={loadingVisaProducts} />
          }
        />
      )}

      {/* Stats — selalu tampil (data bisa stale saat loading) */}
      {(canAddToOrder || embedInProducts) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <StatCard icon={<Package className="w-5 h-5" />} label="Total produk" value={visaStats.total} subtitle="produk visa aktif" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Layers className="w-5 h-5" />} label="Visa Only" value={visaStats.byKind.only} subtitle="produk" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Layers className="w-5 h-5" />} label="Visa + Tasreh" value={visaStats.byKind.tasreh} subtitle="produk" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Layers className="w-5 h-5" />} label="Visa Premium" value={visaStats.byKind.premium} subtitle="produk" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Total kuota" value={visaStats.totalQuota > 0 ? visaStats.totalQuota.toLocaleString('id-ID') : '—'} subtitle={visaStats.withQuotaLimit > 0 ? `${visaStats.withQuotaLimit} produk berkuota` : 'Tanpa batas'} onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Hotel className="w-5 h-5" />} label="Wajib hotel" value={visaStats.requireHotelCount} subtitle={`dari ${visaStats.total} produk`} onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Wallet className="w-5 h-5" />} label="Dengan harga" value={visaStats.withPriceCount} subtitle="produk punya harga" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Coins className="w-5 h-5" />} label="Rata-rata harga" value={visaStats.avgPriceIdr > 0 ? `Rp ${visaStats.avgPriceIdr.toLocaleString('id-ID')}` : '—'} subtitle="IDR" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Coins className="w-5 h-5" />} label="Harga terendah" value={visaStats.minPriceIdr > 0 ? `Rp ${visaStats.minPriceIdr.toLocaleString('id-ID')}` : '—'} onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
          <StatCard icon={<Coins className="w-5 h-5" />} label="Harga tertinggi" value={visaStats.maxPriceIdr > 0 ? `Rp ${visaStats.maxPriceIdr.toLocaleString('id-ID')}` : '—'} onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => tableSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><Eye className="w-4 h-4" /> Lihat</Button></div>} />
        </div>
      )}

      {/* 2. Produk visa (harga dari admin pusat) — tabel */}
      {(canAddToOrder || embedInProducts) && (
        <div ref={tableSectionRef}>
        <Card className="overflow-hidden border-0 shadow-lg shadow-slate-200/50 bg-gradient-to-br from-white to-slate-50/50">
          <CardSectionHeader
            icon={<FileText className="w-6 h-6" />}
            title={`Produk visa ${canAddToOrder ? 'untuk order' : '(harga dari admin pusat)'}`}
            subtitle={canAddToOrder ? 'Pilih produk visa lalu tambah ke keranjang order.' : 'Lihat saja. Pekerjaan visa di menu Visa.'}
            right={isPusat ? (
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setShowAddVisaModal(true)}>
                <Plus className="w-4 h-4" /> Tambah produk visa
              </Button>
            ) : undefined}
          />
          <div className="pb-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)] gap-4 items-end">
            <Input label="Cari nama" type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Nama produk visa..." fullWidth />
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
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 relative min-h-[120px]">
            {loadingVisaProducts ? (
              <ContentLoading />
            ) : (
            <Table<VisaProduct>
              columns={[
                { id: 'code', label: 'Kode', align: 'left' },
                { id: 'kind', label: 'Jenis', align: 'left' },
                { id: 'name', label: 'Nama', align: 'left' },
                { id: 'description', label: 'Deskripsi', align: 'left' },
                { id: 'quota', label: 'Kuota', align: 'right' },
                { id: 'require_hotel', label: 'Wajib hotel', align: 'center' },
                { id: 'currency', label: 'Mata Uang', align: 'center' },
                { id: 'price', label: PRICE_COLUMN_LABEL, align: 'right' },
                ...(canShowProductActions ? [{ id: 'actions', label: 'Aksi', align: 'center' as const }] : [])
              ]}
              data={visaProducts}
              renderRow={(p) => {
                const priceIdr = p.price_general_idr ?? (p.currency === 'IDR' || !p.currency ? p.price_general ?? p.price_branch : null) ?? 0;
                const triple = fillFromSource('IDR', Number(priceIdr), currencyRates);
                const visaKind = (p.meta?.visa_kind || 'only') as VisaKind;
                const kindLabel = VISA_KIND_LABELS[visaKind] || visaKind;
                const requireHotel = p.meta?.require_hotel === true;
                const quota = p.quota ?? 0;
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-[#0D1A63]/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">{p.code || '-'}</td>
                    <td className="py-3 px-4"><Badge variant="info" className="font-medium">{kindLabel}</Badge></td>
                    <td className="py-3 px-4 font-medium text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={p.description || undefined}>{p.description || '—'}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800">{quota === 0 ? '—' : quota}</td>
                    <td className="py-3 px-4 text-center">{requireHotel ? <Badge variant="info">Ya</Badge> : <span className="text-slate-500">Tidak</span>}</td>
                    <td className="py-3 px-4 text-center text-sm text-slate-700">{p.meta?.currency || p.currency || 'IDR'}</td>
                    <td className="py-3 px-4 text-right text-slate-800 align-top">
                      {(() => {
                        const idr = Number(priceIdr) || 0;
                        const sar = triple.sar;
                        const usd = triple.usd;
                        const t = getPriceTripleForTable(idr, sar, usd);
                        if (!t.hasPrice) return '–';
                        return (
                          <>
                            <div className="tabular-nums font-medium">{t.idrText}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              <span className="text-slate-400">SAR:</span> {t.sarText}
                              <span className="text-slate-400 ml-1">USD:</span> {t.usdText}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">per orang</div>
                          </>
                        );
                      })()}
                    </td>
                    {canShowProductActions ? (
                      <td className="py-3 px-4 sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {canAddToOrder && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="p-2"
                              onClick={() => {
                                addDraftItem({ type: 'visa', product_id: p.id, product_name: p.name, unit_price_idr: Number(priceIdr) || 0, quantity: 1 });
                                showToast('Visa ditambahkan ke order.', 'success');
                              }}
                              title="Tambah ke order"
                              aria-label="Tambah ke order"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          )}
                          {isPusat && (
                            <ActionsMenu
                              align="right"
                              items={[
                                { id: 'periode', label: 'Periode & Kuota', icon: <Calendar className="w-4 h-4" />, onClick: () => { setVisaSeasonsProduct(p); setNewSeasonForm({ name: '', start_date: '', end_date: '', quota: 0 }); setQuotaEdit(null); } },
                                { id: 'edit', label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => handleOpenEdit(p) },
                                { id: 'delete', label: 'Hapus', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteVisa(p), danger: true },
                              ]}
                            />
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              }}
              emptyMessage="Belum ada produk visa."
              emptyDescription={isPusat ? 'Klik "Tambah produk visa" untuk menambah.' : 'Tambah produk visa di master produk (admin pusat).'}
              pagination={{
                total: visaTotal,
                page: visaPage,
                limit: visaLimit,
                totalPages: visaTotalPages,
                onPageChange: setVisaPage,
                onLimitChange: (l) => { setVisaLimit(l); setVisaPage(1); }
              }}
              stickyActionsColumn
            />
            )}
          </div>
        </Card>
        </div>
      )}

      {/* Modal: Tambah produk visa */}
      <Modal open={showAddVisaModal} onClose={() => !addVisaSaving && setShowAddVisaModal(false)}>
        {showAddVisaModal && (
          <ModalBox>
            <ModalHeader
              title="Tambah produk visa"
              subtitle="Lengkapi jenis visa, nama, kuota, dan harga (opsional)"
              icon={<Plus className="w-5 h-5" />}
              onClose={() => !addVisaSaving && setShowAddVisaModal(false)}
            />
            <ModalBody className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Kolom kiri: Info produk */}
                <div className="space-y-5">
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Info produk</span>
                    </div>
                    <div className="space-y-4 rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Jenis visa</label>
                        <div className="grid grid-cols-1 gap-2">
                          {(['only', 'tasreh', 'premium'] as const).map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => setAddVisaForm((f) => ({ ...f, visa_kind: kind }))}
                              className={`text-left rounded-xl border-2 p-3 transition-all duration-200 ${
                                addVisaForm.visa_kind === kind
                                  ? 'border-[#0D1A63] bg-[#0D1A63]/5 text-[#0D1A63] shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 text-slate-700'
                              }`}
                            >
                              <span className="font-medium block">{VISA_KIND_LABELS[kind]}</span>
                              <span className="text-xs text-slate-500 mt-0.5 block">{VISA_KIND_DESCRIPTIONS[kind]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <Input
                        label="Nama produk"
                        type="text"
                        value={addVisaForm.name}
                        onChange={(e) => setAddVisaForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Contoh: Visa Umroh Reguler"
                        required
                        fullWidth
                      />
                      <Textarea
                        label="Deskripsi (opsional)"
                        value={addVisaForm.description}
                        onChange={(e) => setAddVisaForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Deskripsi singkat produk"
                        rows={2}
                        fullWidth
                      />
                    </div>
                  </section>
                </div>

                {/* Kolom kanan: Kuota, aturan, harga */}
                <div className="space-y-5">
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Settings2 className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Kuota & aturan</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4 space-y-4">
                      <div>
                        <Input
                          label="Kuota tersedia"
                          type="number"
                          min={0}
                          step={1}
                          value={addVisaForm.quota != null ? String(addVisaForm.quota) : ''}
                          onChange={(e) => setAddVisaForm((f) => ({ ...f, quota: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                          placeholder="0"
                          fullWidth
                        />
                        <p className="text-xs text-slate-500 mt-1">Jumlah yang bisa dipesan. Isi 0 = tidak dibatasi.</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200/80">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={addVisaForm.require_hotel}
                            onChange={(e) => setAddVisaForm((f) => ({ ...f, require_hotel: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-[#0D1A63] focus:ring-[#0D1A63]"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Visa wajib dibarengi hotel</span>
                        </label>
                        <p className="text-xs text-slate-500 mt-1 ml-7">Order yang memesan produk ini harus punya item hotel.</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Coins className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Harga default</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                      <PriceCurrencyField
                        label="Harga (opsional)"
                        value={addVisaForm.price_value}
                        currency={addVisaForm.price_currency}
                        onChange={(value, currency) => setAddVisaForm((f) => ({ ...f, price_value: value, price_currency: currency }))}
                        rates={currencyRates}
                        showConversions
                      />
                    </div>
                  </section>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowAddVisaModal(false)} disabled={addVisaSaving}>Batal</Button>
              <Button variant="primary" onClick={handleCreateVisa} disabled={addVisaSaving}>
                {addVisaSaving ? 'Menyimpan...' : 'Tambah produk'}
              </Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal: Edit produk visa */}
      <Modal open={!!editingVisa} onClose={() => !editVisaSaving && setEditingVisa(null)}>
        {editingVisa && (
          <ModalBox>
            <ModalHeader
              title="Edit produk visa"
              subtitle="Ubah data produk, kuota, dan harga"
              icon={<Pencil className="w-5 h-5" />}
              onClose={() => !editVisaSaving && setEditingVisa(null)}
            />
            <ModalBody className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Kolom kiri: Info produk */}
                <div className="space-y-5">
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Info produk</span>
                    </div>
                    <div className="space-y-4 rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Jenis visa</label>
                        <div className="grid grid-cols-1 gap-2">
                          {(['only', 'tasreh', 'premium'] as const).map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => setEditVisaForm((f) => ({ ...f, visa_kind: kind }))}
                              className={`text-left rounded-xl border-2 p-3 transition-all duration-200 ${
                                editVisaForm.visa_kind === kind
                                  ? 'border-[#0D1A63] bg-[#0D1A63]/5 text-[#0D1A63] shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 text-slate-700'
                              }`}
                            >
                              <span className="font-medium block">{VISA_KIND_LABELS[kind]}</span>
                              <span className="text-xs text-slate-500 mt-0.5 block">{VISA_KIND_DESCRIPTIONS[kind]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama produk <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={editVisaForm.name}
                          onChange={(e) => setEditVisaForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Contoh: Visa Umroh Reguler"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D1A63] focus:border-[#0D1A63] bg-white placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Deskripsi <span className="text-slate-400 font-normal">(opsional)</span></label>
                        <textarea
                          value={editVisaForm.description}
                          onChange={(e) => setEditVisaForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Deskripsi singkat produk"
                          rows={2}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D1A63] focus:border-[#0D1A63] bg-white placeholder:text-slate-400 resize-none"
                        />
                      </div>
                    </div>
                  </section>
                </div>

                {/* Kolom kanan: Kuota, aturan, harga */}
                <div className="space-y-5">
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Settings2 className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Kuota & aturan</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Kuota tersedia</label>
                        <p className="text-xs text-slate-500 mb-2">Jumlah yang bisa dipesan. Isi 0 = tidak dibatasi.</p>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={editVisaForm.quota || ''}
                          onChange={(e) => setEditVisaForm((f) => ({ ...f, quota: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D1A63] focus:border-[#0D1A63] bg-white"
                          placeholder="0"
                        />
                      </div>
                      <div className="pt-2 border-t border-slate-200/80">
                        <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                            checked={editVisaForm.require_hotel}
                            onChange={(e) => setEditVisaForm((f) => ({ ...f, require_hotel: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-[#0D1A63] focus:ring-[#0D1A63]"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Visa wajib dibarengi hotel</span>
              </label>
                        <p className="text-xs text-slate-500 mt-1 ml-7">Order yang memesan produk ini harus punya item hotel.</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Coins className="w-4 h-4 text-[#0D1A63]" />
                      <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Harga</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4">
                      <PriceCurrencyField
                        label="Harga default"
                        value={editVisaForm.price_value}
                        currency={editVisaForm.price_currency}
                        onChange={(value, currency) => setEditVisaForm((f) => ({ ...f, price_value: value, price_currency: currency }))}
                        rates={currencyRates}
                        showConversions
                      />
                    </div>
                  </section>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditingVisa(null)} disabled={editVisaSaving}>Batal</Button>
              <Button variant="primary" onClick={handleSaveEdit} disabled={editVisaSaving}>
                {editVisaSaving ? 'Menyimpan...' : 'Simpan perubahan'}
              </Button>
            </ModalFooter>
          </ModalBox>
        )}
      </Modal>

      {/* Modal: Periode & Kuota */}
      <Modal open={!!visaSeasonsProduct} onClose={() => !addSeasonSaving && !quotaSaving && setVisaSeasonsProduct(null)}>
        {visaSeasonsProduct && (
          <ModalBox>
            <ModalHeader
              title="Periode & Kuota"
              subtitle={visaSeasonsProduct.name}
              icon={<Calendar className="w-5 h-5" />}
              onClose={() => !addSeasonSaving && !quotaSaving && setVisaSeasonsProduct(null)}
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
                  if (!visaSeasonsProduct?.id) return;
                  setAddSeasonSaving(true);
                  try {
                    await adminPusatApi.createVisaSeason(visaSeasonsProduct.id, { name: newSeasonForm.name.trim(), start_date: newSeasonForm.start_date, end_date: newSeasonForm.end_date, quota: newSeasonForm.quota });
                    showToast('Periode ditambahkan', 'success');
                    setNewSeasonForm({ name: '', start_date: '', end_date: '', quota: 0 });
                    const res = await adminPusatApi.listVisaSeasons(visaSeasonsProduct.id);
                    setVisaSeasons((res.data as { data?: VisaSeason[] })?.data ?? []);
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
                {visaSeasonsLoading ? (
                  <ContentLoading inline />
                ) : visaSeasons.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada periode. Tambah periode di atas untuk kalender visa.</p>
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
                        {visaSeasons.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 px-3 font-medium text-slate-800">{s.name}</td>
                            <td className="py-2 px-3 text-slate-600">{s.start_date}</td>
                            <td className="py-2 px-3 text-slate-600">{s.end_date}</td>
                            <td className="py-2 px-3 text-right">
                              {quotaEdit?.seasonId === s.id ? (
                                <span className="flex items-center justify-end gap-1">
                                  <Input type="number" min={0} value={quotaEdit.value} onChange={(e) => setQuotaEdit((q) => q ? { ...q, value: e.target.value } : null)} className="w-20" fullWidth={false} />
                                  <Button size="sm" variant="primary" disabled={quotaSaving} onClick={async () => {
                                    if (!visaSeasonsProduct?.id || !quotaEdit) return;
                                    setQuotaSaving(true);
                                    try {
                                      await adminPusatApi.setVisaSeasonQuota(visaSeasonsProduct.id, s.id, { quota: Math.max(0, parseInt(quotaEdit.value, 10) || 0) });
                                      showToast('Kuota disimpan', 'success');
                                      setQuotaEdit(null);
                                      const res = await adminPusatApi.listVisaSeasons(visaSeasonsProduct.id);
                                      setVisaSeasons((res.data as { data?: VisaSeason[] })?.data ?? []);
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
                                  <button type="button" className="text-[#0D1A63] hover:underline text-xs mr-2" onClick={() => setQuotaEdit({ seasonId: s.id, value: String(s.Quota?.quota ?? 0) })}>Set kuota</button>
                                  <button type="button" className="text-red-600 hover:underline text-xs" onClick={async () => {
                                    if (!visaSeasonsProduct?.id || !window.confirm('Hapus periode ini?')) return;
                                    try {
                                      await adminPusatApi.deleteVisaSeason(visaSeasonsProduct.id, s.id);
                                      showToast('Periode dihapus', 'success');
                                      setVisaSeasons((prev) => prev.filter((x) => x.id !== s.id));
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
    </div>
  );
};

export default VisaPage;
