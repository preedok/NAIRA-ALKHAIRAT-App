import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Trash2, ArrowLeft, Hotel, Plane, FileText,
  Bus, Package, Users, Utensils, X, ChevronRight,
  Star, CreditCard, Building2, Loader2, GripVertical
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, ordersApi, invoicesApi, businessRulesApi, branchesApi, ownersApi, type KabupatenForOwnerItem } from '../../../services/api';
import { AUTOCOMPLETE_PILIH } from '../../../utils/constants';
import { fillFromSource } from '../../../utils/currencyConversion';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import { Autocomplete, Input, ContentLoading, CONTENT_LOADING_MESSAGE, NominalDisplay } from '../../../components/common';
import { inputBaseClass, inputBorderClass } from '../../../components/common/formStyles';

/* ═══════════════════════════════════════════════
   TYPES & CONSTANTS
═══════════════════════════════════════════════ */
const ITEM_TYPES = [
  { id:'hotel',    label:'Hotel',    Icon:Hotel,    color:'#6b7280' },
  { id:'visa',     label:'Visa',     Icon:FileText, color:'#78716c' },
  { id:'ticket',   label:'Tiket',    Icon:Plane,    color:'#57534e' },
  { id:'bus',      label:'Bus',      Icon:Bus,      color:'#6b7280' },
  { id:'siskopatuh', label:'Siskopatuh', Icon:FileText, color:'#57534e' },
  { id:'handling', label:'Handling', Icon:Star,     color:'#78716c' },
  { id:'package',  label:'Paket',    Icon:Package,  color:'#64748b' },
] as const;

const ROOM_TYPES = [
  { id:'double', label:'Double', cap:2 },
  { id:'triple', label:'Triple', cap:3 },
  { id:'quad',   label:'Quad',   cap:4 },
  { id:'quint',  label:'Quint',  cap:5 },
] as const;

/** Pilihan lokasi hotel: Madinah atau Mekkah (value sama dengan product.meta.location di master hotel) */
const HOTEL_LOCATION_OPTIONS = [
  { value: 'madinah', label: 'Madinah' },
  { value: 'makkah', label: 'Mekkah' },
] as const;

type TicketTripType = 'one_way' | 'return_only' | 'round_trip';
const TICKET_TRIP_LABELS: Record<string, string> = { one_way: 'Pergi saja', return_only: 'Pulang saja', round_trip: 'Pulang pergi' };

type BusRouteType = 'full_route' | 'bandara_makkah' | 'bandara_madinah' | 'bandara_madinah_only';
const BUS_ROUTE_LABELS: Record<string, string> = {
  full_route: 'Full rute (Mekkah–Madinah)',
  bandara_makkah: 'Bandara Jeddah–Mekkah',
  bandara_madinah: 'Bandara Jeddah–Madinah',
  bandara_madinah_only: 'Bandara Jeddah–Madinah saja',
};
type BusType = 'besar' | 'menengah_hiace' | 'kecil';
const BUS_KIND_TO_TYPE: Record<string, BusType> = { bus: 'besar', hiace: 'menengah_hiace' };
const BUS_TYPE_LABELS: Record<string, string> = {
  besar: 'Bus besar (include dengan visa)',
  menengah_hiace: 'Bus Menengah (HIACE)',
  kecil: 'Mobil Kecil',
};

/** Opsi bus pada order ber-item visa: Finality (include), Hiace, atau tanpa bus. */
type BusServiceOption = 'finality' | 'hiace' | 'visa_only';

type ItemType   = typeof ITEM_TYPES[number]['id'];
type RoomTypeId = typeof ROOM_TYPES[number]['id'];
type HotelRoomInputMode = 'manual' | 'pax';
type HotelPriceMode = 'mou' | 'non_mou';

type DisplayCurrency = 'SAR' | 'IDR' | 'USD';

/** Label include paket (selaras master paket di PackagesPage). */
const PACKAGE_INCLUDE_LABELS: Record<string, string> = {
  hotel: 'Hotel',
  makan: 'Makan',
  tasreh: 'Tasreh',
  siskopatuh: 'Siskopatuh',
  visa: 'Visa',
  tiket: 'Tiket',
  bis: 'Bis',
  handling: 'Handling'
};

interface ProductOption {
  id:string; name:string; code:string; type:string;
  is_package?:boolean; price_general?:number|null;
  price_general_idr?:number|null; price_general_sar?:number|null; price_general_usd?:number|null;
  price_branch?:number|null; price_owner?:number|null;
  currency?:string; meta?:{meal_price?:number;meal_plan?:'fullboard'|'room_only';room_pricing_mode?:'per_room'|'per_person'|'per_pack';owner_meal_mode?:Partial<Record<HotelPriceMode,'with_meal'|'fullboard'>>;route_prices_by_trip?:Record<string,number>;includes?:string[];hotel_makkah_id?:string;hotel_madinah_id?:string;[k:string]:unknown};
  room_breakdown?:Record<string,{ price: number; quantity?: number }>; prices_by_room?:Record<string,{ price: number; quantity?: number }>;
  /** Backend: nilai suplemen makan dalam mata uang referensi produk (bukan selalu IDR meski namanya _idr). */
  meal_price_idr?: number | null;
  hotel_monthly_display?: { sar_meal_per_person_per_night?: number | null };
  /** Grid 12 bulan per tipe kamar (SAR/malam) — dipakai form order sesuai bulan check-in. */
  hotel_monthly_series_by_room_type?: {
    year: string;
    by_room_type: Record<string, { months: Array<{ year_month: string; sar_room_per_night: number | null }> }>;
  };
  /** Grid bulanan per MOU / Non-MOU (sama struktur by_room_type + meal_months opsional) — dipakai form invoice sesuai sumber harga. */
  hotel_monthly_series_by_owner_type?: {
    year: string;
    by_owner_type: Record<
      HotelPriceMode,
      {
        by_room_type: Record<string, { months: Array<{ year_month: string; sar_room_per_night: number | null }> }>;
        meal_months?: Array<{ year_month: string; sar_meal_per_person_per_night: number | null }>;
      }
    >;
  };
  hotel_monthly_series?: {
    year: string;
    room_type: string;
    months: Array<{ year_month: string; sar_room_per_night: number | null }>;
  };
  hotel_monthly_meal_months?: {
    year: string;
    months: Array<{ year_month: string; sar_meal_per_person_per_night: number | null }>;
  };
  bandara_options?: Array<{ bandara: string; name: string; default: { price_idr: number; seat_quota?: number } }>;
  route_prices?: Partial<Record<BusRouteType, number>>;
}

/** Mata uang tampilan: mengikuti mata uang produk; jika produk tidak punya currency, fallback per tipe. */
function getDisplayCurrency(type: ItemType, product?: ProductOption | null): DisplayCurrency {
  const c = (product?.currency ?? (product?.meta as { currency?: string })?.currency)?.toUpperCase();
  if (c === 'SAR' || c === 'USD' || c === 'IDR') return c as DisplayCurrency;
  if (type === 'hotel' || type === 'handling') return 'SAR';
  if (type === 'bus' || type === 'ticket') return 'IDR';
  if (type === 'siskopatuh') return 'IDR';
  if (type === 'visa') return 'USD';
  return 'IDR';
}
interface HotelRoomLine { id:string; room_type:RoomTypeId|''; quantity:number; unit_price:number; unit_price_currency?:DisplayCurrency; meal_unit_price?:number; meal_unit_price_currency?:DisplayCurrency; with_meal?:boolean; }
interface OrderItemRow  { id:string; type:ItemType; product_id:string; product_name:string; quantity:number; room_type?:RoomTypeId; room_breakdown?:HotelRoomLine[]; unit_price:number; unit_price_currency?:DisplayCurrency; check_in?:string; check_out?:string; check_in_time?:string; check_out_time?:string; meta?:Record<string,unknown>; price_currency?:DisplayCurrency; }
interface OwnerListItem { id:string; user_id:string; assigned_branch_id?:string; is_mou_owner?:boolean; User?:{id:string;name?:string;company_name?:string}; AssignedBranch?:{id:string;code:string;name:string}; }
type OwnerInputMode = 'registered' | 'manual';
type HotelStayDateMode = 'dated' | 'month_year';

const uid  = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const newLine = (): HotelRoomLine => ({ id:`rl-${uid()}`, room_type:'', quantity:0, unit_price:0, with_meal:false });
const newRow  = (): OrderItemRow  => ({ id:`row-${uid()}`, type:'hotel', product_id:'', product_name:'', quantity:0, unit_price:0, room_breakdown:[newLine()] });
/** Baris bus Hiace awal saat opsi Bus Hiace (harga mengikuti busRoutePriceImpl di form). */
function createHiaceBusOrderRow(
  products: ProductOption[],
  busRoutePriceImpl: (p: ProductOption | undefined, route: BusRouteType, trip: TicketTripType) => number,
  visaTravelDate?: string
): OrderItemRow | null {
  const p = products.find((x) => x.type === 'bus' && (x.meta as { bus_kind?: string })?.bus_kind === 'hiace');
  if (!p) return null;
  const rp = p.meta?.route_prices as Record<string, number> | undefined;
  const routeOpt =
    rp && Object.keys(rp).length
      ? (Object.entries(rp).find(([, v]) => (v ?? 0) > 0)?.[0] as BusRouteType | undefined)
      : undefined;
  const route: BusRouteType = (p.meta?.route_type as BusRouteType) || routeOpt || 'full_route';
  const tripType = (p.meta?.trip_type as TicketTripType) || 'round_trip';
  const kind = String((p.meta as { bus_kind?: string })?.bus_kind || '');
  const busType: BusType = BUS_KIND_TO_TYPE[kind] || 'menengah_hiace';
  const unit = busRoutePriceImpl(p, route, tripType);
  const cur = (p.currency ?? (p.meta as { currency?: string })?.currency ?? getDisplayCurrency('bus', p)) as DisplayCurrency;
  const meta: Record<string, unknown> = { route_type: route, trip_type: tripType, bus_type: busType, auto_hiace_waive: true };
  if (visaTravelDate) meta.travel_date = visaTravelDate;
  return {
    id: `row-${uid()}`,
    type: 'bus',
    product_id: p.id,
    product_name: p.name || '',
    quantity: 1,
    unit_price: unit,
    price_currency: cur,
    meta,
  };
}
const rCap = (rt?:RoomTypeId) => rt ? (ROOM_TYPES.find(t=>t.id===rt)?.cap??0) : 0;
const canManage = (role?:string) => role==='owner_mou' || role==='owner_non_mou' || role==='invoice_koordinator' || role==='invoice_saudi';
/** Jumlah malam dari check_in s/d check_out (tanggal saja). Return 0 jika invalid. */
function getNights(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn.slice(0, 10));
  const b = new Date(checkOut.slice(0, 10));
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return 0;
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

const labelClass = 'block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1';

const OrderFormPage: React.FC = () => {
  const { id: orderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user }  = useAuth();
  const { showToast } = useToast();
  const orderDraft = useOrderDraft();
  const isEdit = Boolean(orderId);

  // Owner tidak bisa mengubah harga (dapat harga khusus); invoice_koordinator boleh mengubah harga yang sudah ada.
  const canEditPrice = ['invoice_koordinator','invoice_saudi','super_admin','admin_pusat'].includes(user?.role ?? '');

  useEffect(() => {
    if (user && !canManage(user.role)) navigate('/dashboard/orders-invoices', { replace:true });
  }, [user, navigate]);

  const [products,    setProducts]   = useState<ProductOption[]>([]);
  const [loadingProd, setLoadingProd]= useState(true);
  const [order,       setOrder]      = useState<any>(null);
  const [loadingOrd,  setLoadingOrd] = useState(isEdit);
  const [items,       setItems]      = useState<OrderItemRow[]>([newRow()]);
  const [saving,      setSaving]     = useState(false);
  const [rates,       setRates]      = useState<{SAR_TO_IDR?:number;USD_TO_IDR?:number}>({});
  const [orderRatesOverride, setOrderRatesOverride] = useState<{SAR_TO_IDR?:number;USD_TO_IDR?:number}|null>(null);
  const [branches,    setBranches]   = useState<{id:string;code:string;name:string}[]>([]);
  const [branchSel,   setBranchSel]  = useState('');
  const [owners,      setOwners]     = useState<OwnerListItem[]>([]);
  const [ownerSel,    setOwnerSel]   = useState('');
  const [ownerInputMode, setOwnerInputMode] = useState<OwnerInputMode>('registered');
  const [manualOwnerName, setManualOwnerName] = useState('');
  const [manualOwnerPhone, setManualOwnerPhone] = useState('');
  /** Owner manual: pilih kabupaten saja → provinsi & wilayah master terisi otomatis → kota dari kode kabupaten */
  const [kabupatenMaster, setKabupatenMaster] = useState<KabupatenForOwnerItem[]>([]);
  const [kabupatenLoading, setKabupatenLoading] = useState(false);
  const [kabupatenFetchError, setKabupatenFetchError] = useState(false);
  const [manualWilayahId, setManualWilayahId] = useState('');
  const [manualKabupatenId, setManualKabupatenId] = useState('');
  const prevOwnerInputModeRef = useRef<OwnerInputMode>('registered');
  const [hotelAvailability, setHotelAvailability] = useState<Record<string, { byRoomType: Record<string, number> } | 'loading' | null>>({});
  const [busPenaltyRule, setBusPenaltyRule] = useState<{ bus_min_pack: number; bus_penalty_idr: number }>({ bus_min_pack: 35, bus_penalty_idr: 500000 });
  const [busServiceOption, setBusServiceOption] = useState<BusServiceOption>('finality');
  const [orderPicName, setOrderPicName] = useState('');
  /** Keterangan invoice (textarea); hanya role yang boleh edit harga yang mengirim ke API. */
  const [invoiceKeterangan, setInvoiceKeterangan] = useState('');
  const initialOrderItemKeysRef = useRef<Set<string>>(new Set());
  const lastHiaceBusRowRef = useRef<OrderItemRow | null>(null);

  /** Tahun grid hotel terbesar dari tanggal di form (agar April 2027 memuat series 2027 dari API). */
  const hotelMonthlyListYear = useMemo(() => {
    let maxY = new Date().getFullYear();
    const bump = (s?: string) => {
      if (!s || s.length < 4) return;
      const y = parseInt(s.slice(0, 4), 10);
      if (!Number.isNaN(y) && y > maxY) maxY = y;
    };
    items.forEach((r) => {
      if (r.type !== 'hotel') return;
      bump(r.check_in);
      bump(r.check_out);
    });
    return String(maxY);
  }, [items]);

  const isOwner      = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';
  const canPickOwner = !isEdit && ['invoice_koordinator','invoice_saudi'].includes(user?.role ?? '');
  const ownerProf    = canPickOwner && ownerInputMode === 'registered' && ownerSel ? owners.find(o=>(o.User?.id??o.user_id)===ownerSel) : null;
  const [ownerMeProfile, setOwnerMeProfile] = useState<{ is_mou_owner?: boolean } | null>(null);
  const bFromOwner   = ownerProf?.AssignedBranch?.id ?? ownerProf?.assigned_branch_id ?? null;
  const manualBranchId = canPickOwner && ownerInputMode === 'manual' ? (branchSel || null) : null;
  const branchId     = order?.branch_id || (canPickOwner ? (ownerInputMode === 'registered' ? bFromOwner : manualBranchId) : null) || (!canPickOwner ? (branchSel || user?.branch_id || undefined) : undefined);
  const ownerId      = isOwner ? user?.id : (isEdit ? order?.owner_id : canPickOwner ? (ownerInputMode === 'registered' ? ownerSel : undefined) : undefined) ?? order?.owner_id ?? undefined;

  /** Daftar dari API sudah difilter per wilayah (backend) untuk role invoice + wilayah_id — jangan filter ulang di sini (UUID wilayah bisa beda baris, nama sama). */
  const kabupatenOptions = useMemo(
    () =>
      kabupatenMaster
        .filter((k) => k != null && k.id != null && String(k.id) !== '')
        .sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id')),
    [kabupatenMaster]
  );

  const selectedManualKab = useMemo(
    () => kabupatenMaster.find((k) => String(k.id) === String(manualKabupatenId)) ?? null,
    [kabupatenMaster, manualKabupatenId]
  );

  /* loaders */
  useEffect(() => {
    if (!isEdit && !isOwner) {
      branchesApi.list({ limit:500 }).then(r => {
        const list:any[] = (r.data as any)?.data ?? [];
        setBranches(Array.isArray(list)?list:[]);
        setBranchSel(p => {
          if (p) return p;
          if (['invoice_koordinator', 'invoice_saudi'].includes(user?.role ?? '')) return '';
          if (user?.branch_id && list.some((b:any)=>b.id===user.branch_id)) return user.branch_id;
          return list[0]?.id||'';
        });
      }).catch(()=>{});
    }
  },[isEdit,isOwner,user?.branch_id,user?.role]);

  useEffect(()=>{ if(isEdit&&order?.branch_id) setBranchSel(order.branch_id); },[isEdit,order?.branch_id]);

  useEffect(() => {
    if (order?.pic_name != null && String(order.pic_name).trim()) {
      setOrderPicName(String(order.pic_name).trim());
    }
  }, [order?.id, order?.pic_name]);

  useEffect(() => {
    if (!order?.currency_rates_override || typeof order.currency_rates_override !== 'object') return;
    const o = order.currency_rates_override as { SAR_TO_IDR?: number; USD_TO_IDR?: number };
    setOrderRatesOverride({
      SAR_TO_IDR: typeof o.SAR_TO_IDR === 'number' ? o.SAR_TO_IDR : undefined,
      USD_TO_IDR: typeof o.USD_TO_IDR === 'number' ? o.USD_TO_IDR : undefined
    });
  }, [order?.id, order?.currency_rates_override]);

  useEffect(() => {
    if (!order?.id) return;
    const fromOrder = order.invoice_keterangan != null ? String(order.invoice_keterangan).trim() : '';
    const fromInv = order.Invoice?.notes != null ? String(order.Invoice.notes).trim() : '';
    setInvoiceKeterangan(fromOrder || fromInv || '');
  }, [order?.id, order?.invoice_keterangan, order?.Invoice?.notes]);

  useEffect(()=>{
    if(!canPickOwner){ setOwners([]); return; }
    ownersApi.list({}).then(r=>{
      const data:OwnerListItem[]=(r.data as any)?.data??[];
      setOwners(data);
      setOwnerSel(p=>{ const f=data[0]; const fid=f?.User?.id??f?.user_id; return fid&&!p?fid:p; });
    }).catch(()=>{});
  },[canPickOwner]);

  /** Muat master kabupaten saat halaman order invoice (API mem-scope wilayah di server). */
  useEffect(() => {
    if (!canPickOwner) {
      setKabupatenMaster([]);
      setKabupatenLoading(false);
      setKabupatenFetchError(false);
      return;
    }
    let cancelled = false;
    setKabupatenLoading(true);
    setKabupatenFetchError(false);
    branchesApi
      .listKabupatenForOwner()
      .then((kRes) => {
        if (cancelled) return;
        const body = kRes.data as { data?: unknown };
        const k = body?.data;
        const arr = Array.isArray(k) ? (k as KabupatenForOwnerItem[]) : [];
        setKabupatenMaster(arr);
        if (arr.length === 0) setKabupatenFetchError(true);
      })
      .catch(() => {
        if (!cancelled) {
          setKabupatenMaster([]);
          setKabupatenFetchError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setKabupatenLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canPickOwner]);

  useEffect(() => {
    const prev = prevOwnerInputModeRef.current;
    if (prev === 'registered' && ownerInputMode === 'manual') {
      setManualWilayahId('');
      setManualKabupatenId('');
      setBranchSel('');
    }
    prevOwnerInputModeRef.current = ownerInputMode;
  }, [ownerInputMode]);

  const applyBranchFromKabupaten = useCallback(
    (kabId: string, list: typeof branches, master: KabupatenForOwnerItem[]) => {
      const kab = master.find((k) => String(k.id) === String(kabId));
      if (!kab) {
        setBranchSel('');
        return;
      }
      const br = list.find((b) => String(b.code).trim() === String(kab.kode).trim());
      setBranchSel(br?.id ?? '');
    },
    []
  );

  useEffect(() => {
    if (ownerInputMode !== 'manual' || !manualKabupatenId) return;
    applyBranchFromKabupaten(manualKabupatenId, branches, kabupatenMaster);
  }, [ownerInputMode, manualKabupatenId, branches, kabupatenMaster, applyBranchFromKabupaten]);

  useEffect(() => {
    if (!isOwner || !user?.id) return;
    ownersApi.getMe().then(r => {
      const data = (r.data as { data?: { is_mou_owner?: boolean } })?.data;
      setOwnerMeProfile(data ? { is_mou_owner: !!data.is_mou_owner } : null);
    }).catch(() => setOwnerMeProfile(null));
  }, [isOwner, user?.id]);

  // Kurs SAR & USD + aturan bus (penalti flat jika visa < 35 pack) dari business rules.
  useEffect(()=>{
    const params = branchId ? { branch_id: branchId } : undefined;
    businessRulesApi.get(params).then(r=>{
      const d=(r.data as any)?.data;
      let cr=d?.currency_rates;
      if(typeof cr==='string'){ try{ cr=JSON.parse(cr); }catch{ cr=null; } }
      const s=typeof cr?.SAR_TO_IDR==='number'?cr.SAR_TO_IDR:4200;
      const u=typeof cr?.USD_TO_IDR==='number'?cr.USD_TO_IDR:15500;
      setRates({SAR_TO_IDR:s, USD_TO_IDR:u});
      const minPack=typeof d?.bus_min_pack==='number'?d.bus_min_pack:parseInt(String(d?.bus_min_pack),10)||35;
      const penaltyIdr=typeof d?.bus_penalty_idr==='number'?d.bus_penalty_idr:parseFloat(String(d?.bus_penalty_idr))||500000;
      setBusPenaltyRule({ bus_min_pack: minPack, bus_penalty_idr: penaltyIdr });
    }).catch(()=>{ setRates({SAR_TO_IDR:4200,USD_TO_IDR:15500}); });
  },[branchId]);

  const fetchProducts = useCallback(()=>{
    setLoadingProd(true);
    const p:Record<string,any>={with_prices:'true',include_inactive:'false',limit:500,hotel_monthly_year:hotelMonthlyListYear};
    if(branchId) p.branch_id=branchId;
    if(ownerId)  p.owner_id=ownerId;
    productsApi.list(p)
      .then(r=>{ const d=(r.data as any)?.data??[]; setProducts(Array.isArray(d)?d:[]); })
      .catch(()=>showToast('Gagal memuat produk','error'))
      .finally(()=>setLoadingProd(false));
  },[branchId,ownerId,showToast,hotelMonthlyListYear]);
  useEffect(()=>{ fetchProducts(); },[fetchProducts]);

  useEffect(()=>{
    if(!orderId) return;
    setLoadingOrd(true);
    ordersApi.getById(orderId)
      .then(r=>setOrder((r.data as any)?.data||null))
      .catch(()=>{ showToast('Invoice tidak ditemukan','error'); navigate('/dashboard/orders-invoices?tab=invoices'); })
      .finally(()=>setLoadingOrd(false));
  },[orderId,navigate,showToast]);

  /* Prefill dari draft (owner/invoice pilih produk di halaman Produk → Buat order) */
  const appliedDraftRef = useRef(false);
  useEffect(()=>{
    if(orderId||loadingOrd||orderDraft.items.length===0||appliedDraftRef.current) return;
    const draftNeedsHotelProducts = orderDraft.items.some((d) => d.type === 'hotel' && !!d.product_id);
    if (draftNeedsHotelProducts && loadingProd) return;
    appliedDraftRef.current=true;
    const rows:OrderItemRow[]=orderDraft.items.map(d=>{
      const draftCur = ((d as any).price_currency as DisplayCurrency | undefined) || undefined;
      const draftUnit = ((d as any).unit_price != null ? Number((d as any).unit_price) : NaN);
      const fallbackUnit = Number.isFinite(draftUnit) ? draftUnit : d.unit_price_idr;
      const room_breakdown=d.room_breakdown?.map(l=>{ const line=(l as { meal_unit_price?: number }); const rtLine=((l.room_type||'quad') as RoomTypeId); return { id:l.id||`rl-${uid()}`, room_type:rtLine, quantity:l.quantity||1, unit_price:l.unit_price||fallbackUnit, with_meal:!!l.with_meal, ...(typeof line.meal_unit_price==='number'?{ meal_unit_price: line.meal_unit_price }:{}) }; });
      return {
        id:d.id,
        type:d.type as ItemType,
        product_id:d.product_id,
        product_name:d.product_name,
        quantity:d.quantity||1,
        unit_price:fallbackUnit,
        price_currency: draftCur,
        room_breakdown: d.type==='hotel'?room_breakdown:undefined,
        check_in:d.check_in,
        check_out:d.check_out,
        meta:(d as { meta?: Record<string,unknown> }).meta
      };
    });
    setItems(rows.length?rows:[newRow()]);
    orderDraft.clear();
  },[orderId,loadingOrd,loadingProd,orderDraft.items.length,orderDraft.clear,rates.SAR_TO_IDR,products]);

  useEffect(()=>{
    if(!orderId||!order||!products.length) return;
    const rawItems=order.OrderItems??order.order_items;
    const ois:any[]=Array.isArray(rawItems)?rawItems:[];
    if(ois.length===0){ initialOrderItemKeysRef.current=new Set(); setItems([newRow()]); return; }
    const ov = order.currency_rates_override && typeof order.currency_rates_override === 'object' ? order.currency_rates_override as { SAR_TO_IDR?: number; USD_TO_IDR?: number } : null;
    const s2i = (ov?.SAR_TO_IDR != null ? ov.SAR_TO_IDR : rates.SAR_TO_IDR) || 4200;
    const u2i = (ov?.USD_TO_IDR != null ? ov.USD_TO_IDR : rates.USD_TO_IDR) || 15500;
    const getVal=(o:any,k:string)=>o[k]??o[k.replace(/([A-Z])/g,'_$1').toLowerCase().replace(/^_/,'')];
    const qty=(o:any)=>Math.max(0,Number(getVal(o,'quantity'))||0);
    /** Jika backend mengembalikan unit_price_currency, pakai unit_price as-is (sudah dalam mata uang tersebut). Else konversi dari IDR ke mata uang tampilan (legacy). */
    const disp=(idr:number,pid:string,itemType:ItemType,itemCurrency?:string)=>{ if(itemCurrency&&(itemCurrency==='SAR'||itemCurrency==='USD'||itemCurrency==='IDR')) return idr||0; const pr=products.find(x=>x.id===pid); const cur=getDisplayCurrency(itemType,pr); if(cur==='SAR') return (idr||0)/s2i; if(cur==='USD') return (idr||0)/u2i; return idr||0; };
    const itemCur=(o:any)=>{ const c=getVal(o,'unit_price_currency'); return (c==='SAR'||c==='USD'||c==='IDR')?c:undefined; };
    const seen=new Set<string>(); const rows:OrderItemRow[]=[];
    for(const oi of ois){
      const meta=typeof oi.meta==='object'?oi.meta:{};
      const typeVal=getVal(oi,'type');
      const t=(typeVal||'hotel') as ItemType;
      const productRefId=getVal(oi,'product_ref_id')||'';
      const currencyFromBackend=itemCur(oi);
      const unitPrice=disp(parseFloat(getVal(oi,'unit_price'))||0,productRefId,t,currencyFromBackend);
      const productName=oi.Product?.name??getVal(oi,'Product')?.name??'';
      if(t==='hotel'&&productRefId){
        if(!seen.has(productRefId)){
          seen.add(productRefId);
          const grp=ois.filter((o:any)=>(getVal(o,'type')==='hotel')&&(getVal(o,'product_ref_id')===productRefId));
          const firstMeta=typeof grp[0]?.meta==='object'?grp[0].meta:{};
          const checkIn=(firstMeta.check_in??getVal(grp[0],'check_in')) as string|undefined;
          const checkOut=(firstMeta.check_out??getVal(grp[0],'check_out')) as string|undefined;
          const hotelCur=currencyFromBackend||itemCur(grp[0]);
          const hotelProd = products.find((p) => p.id === productRefId);
          const hotelMeta: Record<string, unknown> = {};
          if (firstMeta.hotel_location) hotelMeta.hotel_location = firstMeta.hotel_location;
          if (firstMeta.hotel_stay_date_mode) hotelMeta.hotel_stay_date_mode = firstMeta.hotel_stay_date_mode;
          if (firstMeta.hotel_stay_check_in_month != null) hotelMeta.hotel_stay_check_in_month = firstMeta.hotel_stay_check_in_month;
          if (firstMeta.hotel_stay_check_in_year != null) hotelMeta.hotel_stay_check_in_year = firstMeta.hotel_stay_check_in_year;
          if (firstMeta.hotel_stay_check_out_month != null) hotelMeta.hotel_stay_check_out_month = firstMeta.hotel_stay_check_out_month;
          if (firstMeta.hotel_stay_check_out_year != null) hotelMeta.hotel_stay_check_out_year = firstMeta.hotel_stay_check_out_year;
          if (firstMeta.hotel_stay_nights != null) hotelMeta.hotel_stay_nights = firstMeta.hotel_stay_nights;
          if (firstMeta.hotel_stay_month != null) hotelMeta.hotel_stay_month = firstMeta.hotel_stay_month;
          if (firstMeta.hotel_stay_year != null) hotelMeta.hotel_stay_year = firstMeta.hotel_stay_year;
          rows.push({ id:oi.id||`row-${uid()}`, type:'hotel', product_id:productRefId, product_name:productName,
            quantity:grp.reduce((s:number,o:any)=>s+qty(o),0),
            unit_price:unitPrice,
            price_currency:hotelCur as DisplayCurrency|undefined,
            check_in:checkIn||undefined,
            check_out:checkOut||undefined,
            meta: Object.keys(hotelMeta).length ? hotelMeta : undefined,
            room_breakdown:grp.map((o:any)=>{ const m=typeof o.meta==='object'?o.meta:{}; const rt=((m.room_type??getVal(o,'room_type'))||'quad') as RoomTypeId; const lineCur=itemCur(o); const withMeal=!!(m.with_meal??m.meal); const roomUp=parseFloat(m.room_unit_price??getVal(o,'unit_price'))||0; const mealUp=m.meal_unit_price!=null?Number(m.meal_unit_price):undefined; return{ id:o.id||`rl-${uid()}`, room_type:rt, quantity:qty(o), unit_price:disp(roomUp,productRefId,'hotel',lineCur), meal_unit_price:mealUp!=null?disp(mealUp,productRefId,'hotel',lineCur):undefined, with_meal:withMeal }; })
          });
        }
      } else {
        rows.push({ id:oi.id||`row-${uid()}`, type:t, product_id:productRefId, product_name:productName, quantity:Math.max(0,qty(oi)), room_type:(meta.room_type??getVal(oi,'room_type')) as RoomTypeId|undefined, unit_price:unitPrice, price_currency:currencyFromBackend as DisplayCurrency|undefined, meta:Object.keys(meta).length?meta:undefined });
      }
    }
    const keys = new Set<string>();
    for (const oi of ois) {
      const t = (getVal(oi,'type')||'hotel') as string;
      const pid = getVal(oi,'product_ref_id')||'';
      const m = typeof oi.meta==='object'?oi.meta:{};
      if (t==='hotel') {
        const stayMode = String((m as { hotel_stay_date_mode?: string }).hotel_stay_date_mode || 'dated');
        const inMonth = (m as { hotel_stay_check_in_month?: number; hotel_stay_month?: number }).hotel_stay_check_in_month ?? (m as { hotel_stay_month?: number }).hotel_stay_month;
        const inYear = (m as { hotel_stay_check_in_year?: number; hotel_stay_year?: number }).hotel_stay_check_in_year ?? (m as { hotel_stay_year?: number }).hotel_stay_year;
        const outMonth = (m as { hotel_stay_check_out_month?: number }).hotel_stay_check_out_month;
        const outYear = (m as { hotel_stay_check_out_year?: number }).hotel_stay_check_out_year;
        const nights = (m as { hotel_stay_nights?: number }).hotel_stay_nights;
        const stayPart = stayMode === 'month_year'
          ? `month_year:${inYear || ''}-${inMonth || ''}:${outYear || ''}-${outMonth || ''}:${nights || ''}`
          : `dated:${m.check_in || ''}:${m.check_out || ''}`;
        keys.add(`hotel:${pid}:${m.room_type||''}:${stayPart}`);
      }
      else keys.add(`${t}:${pid}:${JSON.stringify(m)}`);
    }
    initialOrderItemKeysRef.current = keys;
    setItems(rows.length?rows:[newRow()]);
    const oOpt = (order as { bus_service_option?: string }).bus_service_option;
    if (oOpt === 'hiace' || oOpt === 'visa_only' || oOpt === 'finality') {
      setBusServiceOption(oOpt as BusServiceOption);
    } else if (order.waive_bus_penalty) {
      setBusServiceOption('hiace');
    } else {
      setBusServiceOption('finality');
    }
  },[orderId,order,products,rates.SAR_TO_IDR,rates.USD_TO_IDR]);

  /* fetch availability for hotel rows that have product_id + check_in + check_out */
  const hotelAvailabilityKeys = items.filter(r => r.type === 'hotel' && r.product_id && r.check_in && r.check_out).map(r => `${r.id}\t${r.product_id}\t${r.check_in}\t${r.check_out}`).sort().join('|');
  useEffect(() => {
    const hotelRows = items.filter(r => r.type === 'hotel' && r.product_id && r.check_in && r.check_out);
    setHotelAvailability(prev => {
      const next: Record<string, { byRoomType: Record<string, number> } | 'loading' | null> = {};
      Object.keys(prev).forEach(id => { if (items.some(r => r.id === id)) next[id] = prev[id]; });
      hotelRows.forEach(r => { next[r.id] = 'loading'; });
      return next;
    });
    hotelRows.forEach(row => {
      productsApi.getAvailability(row.product_id, { from: row.check_in!, to: row.check_out! })
        .then(res => {
          const data = (res.data as { data?: { byRoomType?: Record<string, number> } })?.data;
          setHotelAvailability(prev => ({ ...prev, [row.id]: data?.byRoomType ? { byRoomType: data.byRoomType } : null }));
        })
        .catch(() => setHotelAvailability(prev => ({ ...prev, [row.id]: null })));
    });
  }, [hotelAvailabilityKeys]);

  /* helpers */
  const byType=(type:ItemType)=> type==='package'?products.filter(p=>p.is_package):products.filter(p=>!p.is_package&&p.type===type);
  /** Bus yang bisa dipesan: hanya Hiace. Bus besar sudah include dengan visa. */
  const busProductsOrderable=()=>byType('bus').filter((p:ProductOption)=>(p.meta as { bus_kind?: string })?.bus_kind==='hiace');
  /** Daftar produk untuk baris: hotel by location, bus hanya Hiace, lain byType. */
  const productListForRow=(row:OrderItemRow)=>{
    if(row.type==='hotel') return hotelProductsByLocation(row.meta?.hotel_location as string);
    if(row.type==='bus') return busProductsOrderable();
    return byType(row.type);
  };
  /** Untuk hotel: produk yang lokasinya cocok dengan filter (meta.location = madinah | makkah). Jika lokasi kosong, tampilkan semua hotel. */
  const hotelProductsByLocation=(location?:string)=>{
    const hotels=byType('hotel');
    if(!location) return hotels;
    return hotels.filter(p=>(p.meta as { location?: string })?.location===location);
  };
  /** Hanya tipe yang punya produk di data — agar dropdown Tipe hanya tampil pilihan yang tersedia. Bus: hanya tampil jika ada produk Hiace. */
  const availableItemTypes = ITEM_TYPES.filter((t) => t.id === 'bus' ? busProductsOrderable().length > 0 : byType(t.id).length > 0);
  /** Mata uang dari data produk (tanpa hardcode); fallback IDR jika belum ada produk */
  const currencyOptionsFromProducts = React.useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const c = (p.currency ?? (p.meta as { currency?: string })?.currency);
      if (c) set.add(String(c).toUpperCase());
    });
    const list = Array.from(set).sort();
    return list.length ? list.map((c) => ({ value: c, label: c })) : [{ value: 'IDR', label: 'IDR' }];
  }, [products]);
  const s2i=rates.SAR_TO_IDR||4200;
  const u2iR=rates.USD_TO_IDR||15500;
  const effP=(p:ProductOption,type?:ItemType)=>{ const cur=type?getDisplayCurrency(type,p):'IDR'; const n=p.price_owner??p.price_branch??p.price_general; const raw=typeof n==='number'&&!isNaN(n)?n:0; if(cur==='SAR') return (p.price_general_sar ?? (raw&&p.currency==='IDR'?raw/s2i:raw))??0; if(cur==='USD') return (p.price_general_usd ?? (raw&&p.currency==='USD'?raw:raw/u2iR))??0; return (p.price_general_idr ?? raw)??0; };
  /** Harga paket per unit dalam IDR: jika ada diskon pakai harga setelah diskon, jika tidak pakai harga normal. */
  const packageUnitPriceIdr=(p:ProductOption):number=>{
    const rawIdr=Number(p.price_general_idr ?? (p.currency==='IDR'||!p.currency?p.price_general??p.price_branch:null)??0)||0;
    const meta=p.meta as { price_total_idr?: number; days?: number; discount_percent?: number } | undefined;
    const days=Number(meta?.days??1);
    const baseIdr=meta?.price_total_idr ?? (days>=1 ? rawIdr/days : rawIdr);
    const discountPercent=Number(meta?.discount_percent??0);
    if(baseIdr<=0) return 0;
    if(discountPercent>0) return Math.round(baseIdr*(1-discountPercent/100));
    return baseIdr;
  };
  const ticketPrice=(p:ProductOption|undefined,bandara:string)=>{ if(!p?.bandara_options) return 0; const opt=p.bandara_options.find(b=>b.bandara===bandara); return (opt?.default?.price_idr != null && !isNaN(opt.default.price_idr)) ? Number(opt.default.price_idr) : 0; };
  /** Harga satuan bus dalam IDR (dari route_prices, route_prices_by_trip per trip_type, price_per_vehicle_idr, atau price_general_idr/SAR). */
  const busRoutePrice=(p:ProductOption|undefined,route:BusRouteType,tripType:TicketTripType='round_trip'):number=>{
    if(!p) return 0;
    const rp=p.meta?.route_prices as Record<string,number>|undefined;
    const byTrip=p.meta?.route_prices_by_trip as Record<string,number>|undefined;
    const priceVehicle=p.meta?.price_per_vehicle_idr; const pv=typeof priceVehicle==='number'&&!Number.isNaN(priceVehicle)?Number(priceVehicle):0;
    const fromRoute=rp?.[route];
    const tripPrice=byTrip && typeof byTrip[tripType]==='number' ? byTrip[tripType] : (byTrip?.round_trip ?? byTrip?.one_way ?? byTrip?.return_only);
    const fromTrip=tripPrice;
    const raw=typeof fromRoute==='number'&&fromRoute>0?fromRoute:(typeof fromTrip==='number'&&fromTrip>=0?fromTrip:(p.price_general_idr ?? p.price_general ?? pv));
    if(typeof raw==='number'&&raw>0) return raw;
    if(p.price_general_sar != null && p.price_general_sar > 0) return Math.round(p.price_general_sar*s2i);
    if(pv>0) return pv;
    return typeof p.price_general_idr==='number'?p.price_general_idr:0;
  };
  /** Grid kamar SAR/malam: prioritas MOU/Non-MOU bila dipilih, lalu grid gabungan API. */
  const hotelMonthlyRoomByRt = (
    p: ProductOption | undefined,
    ownerScope?: HotelPriceMode | null
  ): Record<string, { months: Array<{ year_month: string; sar_room_per_night: number | null }> }> | undefined => {
    if (!p) return undefined;
    if (ownerScope === 'mou' || ownerScope === 'non_mou') {
      const scoped = p.hotel_monthly_series_by_owner_type?.by_owner_type?.[ownerScope]?.by_room_type;
      if (scoped && Object.keys(scoped).length) return scoped;
    }
    return p.hotel_monthly_series_by_room_type?.by_room_type;
  };
  const hrp=(p:ProductOption|undefined,rt:RoomTypeId|'',meal:boolean,checkIn?:string,ownerScope?:HotelPriceMode|null)=>{
    if(!p || !rt) return 0;
    const rb=p.room_breakdown??p.prices_by_room??{};
    const rtEntry=rb[rt];
    const rtPrice=typeof rtEntry==='object'&&rtEntry!==null&&'price' in rtEntry?Number(rtEntry.price):typeof rtEntry==='number'?rtEntry:0;
    const cur=((p.currency ?? (p.meta as { currency?: string } | undefined)?.currency) || 'IDR').toUpperCase();
    const toSar=(x:number)=>cur==='SAR'?x:cur==='USD'?x*u2iR/s2i:x/s2i;
    /**
     * Hotel: harga dari grid produk untuk bulan check-in (YYYY-MM), bukan snapshot “bulan berjalan” saja.
     * Nilai serial API sudah SAR/malam (fullboard = paket jika ada di grid).
     */
    if (p.type === 'hotel') {
      const ym = checkIn && String(checkIn).length >= 7 ? String(checkIn).slice(0, 7) : null;
      if (ym) {
        const byRt = hotelMonthlyRoomByRt(p, ownerScope);
        let sar: number | null = null;
        if (byRt?.[rt]?.months?.length) {
          const cell = byRt[rt].months.find((m) => m.year_month === ym);
          if (cell?.sar_room_per_night != null && Number(cell.sar_room_per_night) > 0) sar = Number(cell.sar_room_per_night);
        }
        if (sar == null && p.hotel_monthly_series?.months?.length && String(p.hotel_monthly_series.room_type) === String(rt)) {
          const cell = p.hotel_monthly_series.months.find((m) => m.year_month === ym);
          if (cell?.sar_room_per_night != null && Number(cell.sar_room_per_night) > 0) sar = Number(cell.sar_room_per_night);
        }
        if (sar != null && sar > 0) return sar;
        return 0;
      }
      return rtPrice > 0 ? toSar(rtPrice) : 0;
    }
    const fallbackGeneral=p.price_general_sar ?? (p.price_general_idr ?? 0)/s2i;
    const fallbackAnyRoom=Object.values(rb).find((v:unknown)=>typeof v==='object'&&v!==null&&'price' in (v as object)&&Number((v as {price?:unknown}).price)>0);
    const anyRoomPrice=fallbackAnyRoom?Number((fallbackAnyRoom as {price:number}).price):0;
    const rawRoom = rtPrice>0 ? rtPrice : (anyRoomPrice>0 ? anyRoomPrice : 0);
    const roomSar = rawRoom > 0 ? toSar(rawRoom) : fallbackGeneral;
    return meal ? roomSar + toSar((p.meta?.meal_price as number|undefined)??0) : roomSar;
  };
  const hasDpPayment = isEdit && order?.dp_payment_status === 'pembayaran_dp';
  const effectiveRates = (orderRatesOverride && (orderRatesOverride.SAR_TO_IDR != null || orderRatesOverride.USD_TO_IDR != null))
    ? { SAR_TO_IDR: orderRatesOverride.SAR_TO_IDR ?? rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: orderRatesOverride.USD_TO_IDR ?? rates.USD_TO_IDR ?? 15500 }
    : rates;
  /** Ada input kurs khusus order → total & subtotal hotel (IDR dari master SAR) dihitung ulang pakai kurs ini, bukan nilai IDR tersimpan dari kurs admin. */
  const hasCustomOrderKurs = !!(orderRatesOverride && (orderRatesOverride.SAR_TO_IDR != null || orderRatesOverride.USD_TO_IDR != null));
  const rowCur=(row:OrderItemRow):DisplayCurrency=> row.price_currency ?? getDisplayCurrency(row.type, products.find(x=>x.id===row.product_id));
  const isMouOwnerResolved = (() => {
    // Owner login: role menentukan.
    if (user?.role === 'owner_mou') return true;
    if (user?.role === 'owner_non_mou') return false;
    // Admin pilih owner: ambil dari profile owner yang terpilih (atau endpoint owner/me jika tersedia).
    if (ownerProf?.is_mou_owner != null) return !!ownerProf.is_mou_owner;
    if (ownerMeProfile?.is_mou_owner != null) return !!ownerMeProfile.is_mou_owner;
    return false;
  })();
  const hotelPriceMode = (_row: OrderItemRow): HotelPriceMode => (isMouOwnerResolved ? 'mou' : 'non_mou');
  const hotelOwnerTypeScopeParam = (row: OrderItemRow): 'mou' | 'non_mou' | undefined => {
    return hotelPriceMode(row);
  };
  /** Fullboard: meta global atau per sumber harga (MOU/Non-MOU) sesuai master hotel. */
  const isFullboardHotelForRow = (p: ProductOption | undefined, row: OrderItemRow): boolean => {
    if (!p) return false;
    if (p.meta?.meal_plan === 'fullboard') return true;
    const scope = hotelPriceMode(row);
    const omm = p.meta?.owner_meal_mode as Partial<Record<HotelPriceMode, string>> | undefined;
    return omm?.[scope] === 'fullboard';
  };
  /** Tipe kamar acuan dari grid/produk (default baris baru / pack). Ikuti MOU/Non-MOU jika baris punya sumber harga. */
  const defaultRoomTypeForHotelGrid = (p: ProductOption | undefined, row?: OrderItemRow): RoomTypeId => {
    if (!p) return 'quad';
    const byRt = hotelMonthlyRoomByRt(p, row ? hotelPriceMode(row) : undefined);
    if (byRt) {
      for (const rt of ROOM_TYPES) {
        const id = rt.id as RoomTypeId;
        const months = byRt[id]?.months;
        if (months?.some((m: { sar_room_per_night: number | null }) => m.sar_room_per_night != null && Number(m.sar_room_per_night) > 0)) return id;
      }
    }
    if (p.hotel_monthly_series?.months?.length && p.hotel_monthly_series.room_type) {
      const rt = String(p.hotel_monthly_series.room_type) as RoomTypeId;
      if (ROOM_TYPES.some((t) => t.id === rt)) return rt;
    }
    const rb = p.room_breakdown ?? p.prices_by_room ?? {};
    const keys = Object.keys(rb).filter(Boolean);
    if (keys.length) return keys[0] as RoomTypeId;
    return 'quad';
  };
  const s2iEff=effectiveRates.SAR_TO_IDR||4200; const u2iEff=effectiveRates.USD_TO_IDR||15500;
  /** Konversi nilai dari satu mata uang ke mata uang lain (satu sumber kebenaran: kurs effectiveRates). */
  const convertAmount=(value:number,fromCur:DisplayCurrency,toCur:DisplayCurrency):number=>{
    if(fromCur===toCur) return value;
    const idr=fromCur==='IDR'?value:fromCur==='SAR'?value*s2iEff:value*u2iEff;
    return toCur==='IDR'?idr:toCur==='SAR'?idr/s2iEff:idr/u2iEff;
  };
  /** Nilai price dianggap dalam currency row (row.unit_price_currency ?? rowCur); kembalikan dalam IDR. */
  const toIDR=(price:number,row:OrderItemRow)=>{ const c=row.unit_price_currency??rowCur(row); if(c==='SAR') return price*s2iEff; if(c==='USD') return price*u2iEff; return price; };
  const toIDRWithRates=(price:number,row:OrderItemRow,rateSet:{SAR_TO_IDR?:number;USD_TO_IDR?:number})=>{ const c=row.unit_price_currency??rowCur(row); const s=rateSet.SAR_TO_IDR||4200; const u=rateSet.USD_TO_IDR||15500; if(c==='SAR') return price*s; if(c==='USD') return price*u; return price; };
  /** Untuk baris: nilai price dalam rowCur(row); kembalikan nilai dalam cur. Untuk konsistensi dengan product: selalu konversi via IDR. */
  const getInC=(priceInRow:number,row:OrderItemRow,cur:'IDR'|'SAR'|'USD')=>{ const idr=toIDR(priceInRow,row); const t=fillFromSource('IDR',idr,effectiveRates); return cur==='IDR'?t.idr:cur==='SAR'?t.sar:t.usd; };
  const toRowCurrency=(idr:number,row:OrderItemRow)=>{ const c=rowCur(row); if(c==='SAR') return idr/s2iEff; if(c==='USD') return idr/u2iEff; return idr; };
  const toCurrencyFromSAR=(sar:number,cur:DisplayCurrency)=> cur==='SAR'?sar: cur==='IDR'?sar*s2iEff: sar*s2iEff/u2iEff;
  const setRP=(rowId:string,cur:'IDR'|'SAR'|'USD',val:number)=>{ const row=items.find(r=>r.id===rowId); if(!row) return; const idr=cur==='IDR'?val:cur==='SAR'?val*s2iEff:val*u2iEff; updateRow(rowId,{unit_price:toRowCurrency(idr,row),unit_price_currency:rowCur(row)}); };
  const setLP=(rowId:string,lineId:string,cur:'IDR'|'SAR'|'USD',val:number)=>{ const row=items.find(r=>r.id===rowId); if(!row) return; const idr=cur==='IDR'?val:cur==='SAR'?val*s2iEff:val*u2iEff; updLine(rowId,lineId,{unit_price:toRowCurrency(idr,row),unit_price_currency:rowCur(row)}); };
  const setMealLP=(rowId:string,lineId:string,cur:'IDR'|'SAR'|'USD',val:number)=>{ const row=items.find(r=>r.id===rowId); if(!row) return; const idr=cur==='IDR'?val:cur==='SAR'?val*s2iEff:val*u2iEff; updLine(rowId,lineId,{meal_unit_price:toRowCurrency(idr,row),meal_unit_price_currency:rowCur(row)}); };
  const hotelStayDateModeForRow = (row: OrderItemRow): HotelStayDateMode =>
    String((row.meta as { hotel_stay_date_mode?: string } | undefined)?.hotel_stay_date_mode || 'dated') === 'month_year'
      ? 'month_year'
      : 'dated';
  const hotelStayMonthYearForRow = (row: OrderItemRow): {
    checkInMonth?: number; checkInYear?: number; checkOutMonth?: number; checkOutYear?: number; nights?: number;
  } => {
    const checkInMonthRaw = Number((row.meta as { hotel_stay_check_in_month?: number; hotel_stay_month?: number } | undefined)?.hotel_stay_check_in_month ?? (row.meta as { hotel_stay_month?: number } | undefined)?.hotel_stay_month ?? 0);
    const checkInYearRaw = Number((row.meta as { hotel_stay_check_in_year?: number; hotel_stay_year?: number } | undefined)?.hotel_stay_check_in_year ?? (row.meta as { hotel_stay_year?: number } | undefined)?.hotel_stay_year ?? 0);
    const checkOutMonthRaw = Number((row.meta as { hotel_stay_check_out_month?: number } | undefined)?.hotel_stay_check_out_month ?? 0);
    const checkOutYearRaw = Number((row.meta as { hotel_stay_check_out_year?: number } | undefined)?.hotel_stay_check_out_year ?? 0);
    const nightsRaw = Number((row.meta as { hotel_stay_nights?: number } | undefined)?.hotel_stay_nights ?? 0);
    const checkInMonth = Number.isFinite(checkInMonthRaw) && checkInMonthRaw >= 1 && checkInMonthRaw <= 12 ? Math.floor(checkInMonthRaw) : undefined;
    const checkInYear = Number.isFinite(checkInYearRaw) && checkInYearRaw >= 1900 ? Math.floor(checkInYearRaw) : undefined;
    const checkOutMonth = Number.isFinite(checkOutMonthRaw) && checkOutMonthRaw >= 1 && checkOutMonthRaw <= 12 ? Math.floor(checkOutMonthRaw) : undefined;
    const checkOutYear = Number.isFinite(checkOutYearRaw) && checkOutYearRaw >= 1900 ? Math.floor(checkOutYearRaw) : undefined;
    const nights = Number.isFinite(nightsRaw) && nightsRaw > 0 ? Math.floor(nightsRaw) : undefined;
    return { checkInMonth, checkInYear, checkOutMonth, checkOutYear, nights };
  };
  const hotelPricingCheckInForRow = (row: OrderItemRow): string | undefined => {
    const mode = hotelStayDateModeForRow(row);
    if (mode === 'dated') return row.check_in;
    const { checkInMonth, checkInYear } = hotelStayMonthYearForRow(row);
    if (!checkInMonth || !checkInYear) return undefined;
    return `${String(checkInYear)}-${String(checkInMonth).padStart(2, '0')}-01`;
  };
  const hotelStayNightsForRow = (row: OrderItemRow): number => {
    const mode = hotelStayDateModeForRow(row);
    if (mode === 'dated') return getNights(row.check_in, row.check_out);
    const { nights } = hotelStayMonthYearForRow(row);
    return nights || 0;
  };
  const hasValidHotelStayInput = (row: OrderItemRow): boolean => {
    const mode = hotelStayDateModeForRow(row);
    if (mode === 'dated') return !!(row.check_in && row.check_out);
    const { checkInMonth, checkInYear, checkOutMonth, checkOutYear, nights } = hotelStayMonthYearForRow(row);
    return !!(checkInMonth && checkInYear && checkOutMonth && checkOutYear && nights);
  };
  const hotelStayKeyPart = (row: OrderItemRow): string => {
    const mode = hotelStayDateModeForRow(row);
    if (mode === 'month_year') {
      const { checkInMonth, checkInYear, checkOutMonth, checkOutYear, nights } = hotelStayMonthYearForRow(row);
      return `month_year:${checkInYear || ''}-${checkInMonth || ''}:${checkOutYear || ''}-${checkOutMonth || ''}:${nights || ''}`;
    }
    return `dated:${row.check_in || ''}:${row.check_out || ''}`;
  };
  const getMealPriceSar=(p:ProductOption|undefined,checkIn?:string,row?:OrderItemRow):number=>{
    if(!p) return 0;
    if (row ? isFullboardHotelForRow(p, row) : p.meta?.meal_plan === 'fullboard') return 0;
    if (p.type === 'hotel') {
      const effectiveCheckIn = checkIn || (row ? hotelPricingCheckInForRow(row) : undefined);
      const ym = effectiveCheckIn && String(effectiveCheckIn).length >= 7 ? String(effectiveCheckIn).slice(0, 7) : null;
      if (ym) {
        const scope = row ? hotelPriceMode(row) : null;
        if (scope === 'mou' || scope === 'non_mou') {
          const scopedMeals = p.hotel_monthly_series_by_owner_type?.by_owner_type?.[scope]?.meal_months;
          if (Array.isArray(scopedMeals) && scopedMeals.length) {
            const cell = scopedMeals.find((m) => m.year_month === ym);
            const v = cell?.sar_meal_per_person_per_night;
            if (v != null && Number(v) > 0) return Number(v);
          }
        }
        if (p.hotel_monthly_meal_months?.months?.length) {
          const cell = p.hotel_monthly_meal_months.months.find((m) => m.year_month === ym);
          const v = cell?.sar_meal_per_person_per_night;
          if (v != null && Number(v) > 0) return Number(v);
          return 0;
        }
      }
      const sarGrid = p.hotel_monthly_display?.sar_meal_per_person_per_night;
      if (sarGrid != null && Number(sarGrid) > 0) return Number(sarGrid);
      const mp = p.meal_price_idr;
      if (mp != null && Number(mp) > 0) {
        const cur = (p.currency || 'IDR').toUpperCase();
        const raw = Number(mp);
        return cur === 'SAR' ? raw : cur === 'USD' ? raw * u2iR / s2i : raw / s2i;
      }
      return 0;
    }
    const raw=(p.meta?.meal_price as number)??0; const cur=(p.currency||'IDR').toUpperCase(); return cur==='SAR'?raw:cur==='USD'?raw*u2iR/s2i:raw/s2i;
  };
  const roomCap = (rt: RoomTypeId) => ROOM_TYPES.find((t) => t.id === rt)?.cap ?? 0;
  const hotelRoomPricingMode = (p: ProductOption | undefined): 'per_room' | 'per_pack' => {
    const mode = String(p?.meta?.room_pricing_mode || '').toLowerCase();
    return mode === 'per_person' || mode === 'per_pack' ? 'per_pack' : 'per_room';
  };
  const hotelRoomPricingLabel = (p: ProductOption | undefined): string =>
    hotelRoomPricingMode(p) === 'per_pack' ? 'Per pack' : 'Per room';
  /** Lookup harga / quote: tipe baris; per pack saja fallback ke acuan grid jika kosong (sinkron quote sebelum user ubah). */
  const effectiveHotelLineRoomType = (r: OrderItemRow, l: HotelRoomLine): RoomTypeId | '' => {
    if (l.room_type) return l.room_type as RoomTypeId;
    const prod = byType('hotel').find((p) => p.id === r.product_id);
    if (prod && hotelRoomPricingMode(prod) === 'per_pack') return defaultRoomTypeForHotelGrid(prod, r);
    return '';
  };
  const hotelLineQuantityValid = (r: OrderItemRow, l: HotelRoomLine): boolean => {
    if (l.quantity <= 0) return false;
    return !!l.room_type;
  };
  // Catatan: grid bulanan backend untuk mode per_person sudah bernilai "per pack", jadi jangan dikali kapasitas kamar.
  const hotelRoomUnitMultiplier = (_p: ProductOption | undefined, _rt: RoomTypeId | ''): number => 1;
  const hotelRoomUnitSar = (p: ProductOption | undefined, rt: RoomTypeId | '', checkIn?: string, row?: OrderItemRow): number => {
    const effectiveCheckIn = checkIn || (row ? hotelPricingCheckInForRow(row) : undefined);
    return hrp(p, rt, false, effectiveCheckIn, row ? hotelPriceMode(row) : undefined) * hotelRoomUnitMultiplier(p, rt);
  };

  /** Generate kombinasi tipe kamar terbaik (min kamar, lalu prefer kamar besar) dengan batas ketersediaan jika tersedia. */
  const bestRoomCombo = useCallback((pax: number, roomTypes: RoomTypeId[], availability?: Record<string, number>) => {
    const target = Math.max(0, Math.floor(pax || 0));
    if (!target) return {} as Record<RoomTypeId, number>;
    const types = [...roomTypes].sort((a, b) => roomCap(b) - roomCap(a)); // besar dulu untuk tie-break

    type State = { rooms: number; score: number; combo: Record<RoomTypeId, number> };
    const dp: Array<State | null> = Array(target + 1).fill(null);
    dp[0] = { rooms: 0, score: 0, combo: {} as Record<RoomTypeId, number> };

    for (const rt of types) {
      const cap = roomCap(rt);
      if (!cap) continue;
      const maxAvailRaw = availability && typeof availability[rt] === 'number' ? Math.max(0, Math.floor(availability[rt])) : undefined;
      const maxNeeded = Math.ceil(target / cap);
      const maxK = Math.min(maxNeeded, maxAvailRaw ?? maxNeeded);

      // bounded knapsack update (copy dp each type)
      const next = dp.slice();
      for (let s = 0; s <= target; s++) {
        const cur = dp[s];
        if (!cur) continue;
        for (let k = 1; k <= maxK; k++) {
          const ns = s + k * cap;
          if (ns > target) break;
          const candRooms = cur.rooms + k;
          const candScore = cur.score + k * cap * cap; // prefer room besar jika rooms sama
          const prev = next[ns];
          if (!prev || candRooms < prev.rooms || (candRooms === prev.rooms && candScore > prev.score)) {
            next[ns] = {
              rooms: candRooms,
              score: candScore,
              combo: { ...(cur.combo || {}), [rt]: (cur.combo?.[rt] || 0) + k }
            };
          }
        }
      }
      for (let i = 0; i <= target; i++) dp[i] = next[i];
    }

    // fallback defensif jika kombinasi exact target tidak ketemu.
    if (!dp[target]) {
      const fallbackType = types[types.length - 1] || 'double';
      const fallbackCap = Math.max(1, roomCap(fallbackType));
      return { [fallbackType]: Math.max(1, Math.ceil(target / fallbackCap)) } as Record<RoomTypeId, number>;
    }
    return dp[target]!.combo;
  }, []);

  const applyAutoHotelRooms = useCallback((rowId: string, pax: number) => {
    setItems((prev) => prev.map((r) => {
      if (r.id !== rowId || r.type !== 'hotel') return r;
      const prod = products.find((p) => p.type === 'hotel' && p.id === r.product_id);
      if (!prod) return r;
      if (hotelRoomPricingMode(prod) === 'per_pack') return r;

      const rb = (prod.room_breakdown ?? prod.prices_by_room ?? {}) as Record<string, any>;
      const productRoomTypes = Object.keys(rb).filter(Boolean) as RoomTypeId[];
      const avail = (hotelAvailability[rowId] && typeof hotelAvailability[rowId] === 'object')
        ? (hotelAvailability[rowId] as { byRoomType: Record<string, number> }).byRoomType
        : undefined;
      const allowed = productRoomTypes.filter((rt) => !avail || (avail[rt] ?? 0) > 0);
      const usedTypes = allowed.length ? allowed : productRoomTypes;

      const combo = bestRoomCombo(pax, usedTypes, avail);
      const rowCurrency = rowCur(r);
      const fullboard = isFullboardHotelForRow(prod, r);
      const withMealDefault = fullboard ? true : !!(r.room_breakdown || []).find((l) => l.with_meal)?.with_meal;
      const mealPSar = getMealPriceSar(prod, r.check_in, r);

      const lines: HotelRoomLine[] = Object.entries(combo)
        .filter(([, qty]) => (qty || 0) > 0)
        .sort(([a], [b]) => roomCap(b as RoomTypeId) - roomCap(a as RoomTypeId))
        .map(([rtRaw, qty]) => {
          const rt = rtRaw as RoomTypeId;
          const withMeal = fullboard ? true : withMealDefault;
          const roomOnlySar = hotelRoomUnitSar(prod, rt, r.check_in, r);
          const withMealSar = roomOnlySar + (withMeal ? mealPSar : 0);
          const roomP = toCurrencyFromSAR(roomOnlySar, rowCurrency);
          const mealP = toCurrencyFromSAR(mealPSar, rowCurrency);
          const unitP = fullboard ? toCurrencyFromSAR(withMealSar, rowCurrency) : (withMeal ? toCurrencyFromSAR(withMealSar, rowCurrency) : roomP);
          const mealUnit = withMeal && !fullboard ? mealP : 0;
          return { id: `rl-${uid()}`, room_type: rt, quantity: qty as number, unit_price: unitP, meal_unit_price: mealUnit, with_meal: withMeal };
        });

      const meta = { ...(r.meta || {}), hotel_room_input_mode: 'pax' as HotelRoomInputMode, hotel_pax: Math.max(0, Math.floor(pax || 0)) };
      return { ...r, meta, room_breakdown: lines.length ? lines : (r.room_breakdown || []) };
    }));
  }, [products, hotelAvailability, bestRoomCombo, getMealPriceSar]);

  /** Sinkron harga baris hotel dengan grid bulanan backend (check-in/out + tipe + qty). */
  const hotelStayQuoteKey = useMemo(() => {
    return items
      .filter((r) => r.type === 'hotel' && r.product_id && r.check_in && r.check_out)
      .map((r) => {
        const prod = products.find((p) => p.id === r.product_id);
        const cur = (r.price_currency ?? getDisplayCurrency('hotel', prod)) as string;
        const lines = (r.room_breakdown || [])
          .map((l) => {
            const effRt = effectiveHotelLineRoomType(r, l);
            return effRt ? `${l.id}:${effRt}:${l.quantity}:${l.with_meal ? 1 : 0}` : '';
          })
          .filter(Boolean)
          .join('|');
        return `${r.id}|${r.product_id}|${r.check_in}|${r.check_out}|${cur}|${lines}|${hotelPriceMode(r)}|${branchId ?? ''}|${ownerId ?? ''}|${s2iEff}|${u2iEff}`;
      })
      .sort()
      .join('##');
  }, [items, products, branchId, ownerId, s2iEff, u2iEff]);

  useEffect(() => {
    if (loadingProd) return;
    const handle = window.setTimeout(() => {
      const hotelRows = items.filter((r) => r.type === 'hotel' && r.product_id && r.check_in && r.check_out);
      hotelRows.forEach((row) => {
        const prod = products.find((p) => p.id === row.product_id);
        const cur = (row.price_currency ?? getDisplayCurrency('hotel', prod)) as 'SAR' | 'IDR' | 'USD';
        (row.room_breakdown || []).forEach((line) => {
          const quoteRt = effectiveHotelLineRoomType(row, line);
          if (!quoteRt) return;
          const q = Math.max(1, line.quantity || 1);
          productsApi
            .getHotelStayQuote(row.product_id, {
              check_in: row.check_in!,
              check_out: row.check_out!,
              room_type: quoteRt,
              with_meal: !!line.with_meal,
              quantity: q,
              currency: cur,
              branch_id: branchId,
              owner_id: ownerId,
              owner_type_scope: hotelOwnerTypeScopeParam(row)
            })
            .then((res) => {
              const d = (res.data as { data?: { nights?: number; room_unit_per_night?: number; meal_unit_per_person_per_night?: number } })?.data;
              if (!d || !d.nights || d.nights <= 0) return;
              const ru = Number(d.room_unit_per_night) || 0;
              const mu = Number(d.meal_unit_per_person_per_night) || 0;
              setItems((prev) =>
                prev.map((r) => {
                  if (r.id !== row.id || !r.room_breakdown) return r;
                  return {
                    ...r,
                    room_breakdown: r.room_breakdown.map((l) =>
                      l.id === line.id
                        ? {
                            ...l,
                            unit_price: ru,
                            meal_unit_price: l.with_meal ? mu : 0,
                            unit_price_currency: cur,
                            meal_unit_price_currency: cur
                          }
                        : l
                    )
                  };
                })
              );
            })
            .catch(() => {
              setItems((prev) =>
                prev.map((r) => {
                  if (r.id !== row.id || !r.room_breakdown) return r;
                  return {
                    ...r,
                    room_breakdown: r.room_breakdown.map((l) =>
                      l.id === line.id
                        ? { ...l, unit_price: 0, meal_unit_price: 0, unit_price_currency: cur, meal_unit_price_currency: cur }
                        : l
                    )
                  };
                })
              );
            });
        });
      });
    }, 450);
    return () => window.clearTimeout(handle);
  }, [hotelStayQuoteKey, loadingProd, products, branchId, ownerId]);

  /* mutations */
  const addRow   =()=>setItems(p=>[...p,newRow()]);
  const removeRow=(id:string)=>setItems(p=>{ const n=p.filter(r=>r.id!==id); return n.length?n:[newRow()]; });
  const moveItem =(fromIndex:number, toIndex:number)=>{
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setItems(p=>{
      const next=[...p];
      const [removed]=next.splice(fromIndex,1);
      next.splice(toIndex,0,removed);
      return next;
    });
  };
  const addLine  =(rowId:string)=>{ const row=items.find(r=>r.id===rowId); if(!row||row.type!=='hotel') return; const hProd=byType('hotel').find(p=>p.id===row.product_id); const withMealDefault=hProd?isFullboardHotelForRow(hProd,row):false; const defRt=hProd?defaultRoomTypeForHotelGrid(hProd,row):('' as RoomTypeId|''); const line:HotelRoomLine={id:`rl-${uid()}`,room_type:(defRt||'') as RoomTypeId|'',quantity:0,unit_price:0,with_meal:withMealDefault}; setItems(p=>p.map(r=>r.id!==rowId?r:{...r,room_breakdown:[...(r.room_breakdown||[]),line]})); };
  const removeLine=(rowId:string,lineId:string)=>setItems(p=>p.map(r=>r.id!==rowId?r:{...r,room_breakdown:(r.room_breakdown||[]).filter(l=>l.id!==lineId)}));
  const updLine=(rowId:string,lineId:string,upd:Partial<HotelRoomLine>)=>setItems(p=>p.map(r=>{ if(r.id!==rowId||!r.room_breakdown) return r; return{...r,room_breakdown:r.room_breakdown.map(l=>l.id!==lineId?l:{...l,...upd})}; }));
  const updateRow=(rowId:string,upd:Partial<OrderItemRow>)=>setItems(p=>p.map(r=>{
    if(r.id!==rowId) return r;
    const next={...r,...upd};
    if(upd.product_id!=null){
      const prod=byType(next.type).find(x=>x.id===upd.product_id);
      if(prod){
        next.product_name=prod.name;
        next.price_currency=(prod.currency ?? (prod.meta as { currency?: string })?.currency ?? getDisplayCurrency(next.type, prod)) as DisplayCurrency;
        if(next.type==='ticket'){
          const bandara=(next.meta?.bandara as string)||(prod.bandara_options?.[0]?.bandara)||'';
          const tripFromProduct=(prod.meta?.trip_type as TicketTripType)||'round_trip';
          next.meta={ ...(next.meta||{}), bandara, trip_type: upd.product_id!==r.product_id ? tripFromProduct : ((next.meta?.trip_type as TicketTripType)||tripFromProduct) };
          next.unit_price=next.unit_price===0||upd.product_id!==r.product_id?ticketPrice(prod,bandara):next.unit_price;
        } else if(next.type==='bus'){
          const rp=prod.meta?.route_prices as Record<string,number>|undefined;
          const routeOpt=rp&&Object.keys(rp).length?Object.entries(rp).find(([,v])=>(v??0)>0)?.[0] as BusRouteType|undefined:undefined;
          const route:BusRouteType=(next.meta?.route_type as BusRouteType)||routeOpt||'full_route';
          const tripType=(next.meta?.trip_type as TicketTripType)||(prod.meta?.trip_type as TicketTripType)||'round_trip';
          const kind=String((prod.meta as { bus_kind?: string })?.bus_kind||'');
          const busDefault:BusType=(kind&&BUS_KIND_TO_TYPE[kind])?BUS_KIND_TO_TYPE[kind]:'besar';
          const busTypeResolved=upd.product_id!==r.product_id?busDefault:((next.meta?.bus_type as BusType)||busDefault);
          next.meta={ ...(next.meta||{}), route_type:route, trip_type:tripType, bus_type:busTypeResolved };
          next.unit_price=next.unit_price===0||upd.product_id!==r.product_id?busRoutePrice(prod,route,tripType):next.unit_price;
        } else if(next.type==='package'){
          if(next.unit_price===0||upd.product_id!==r.product_id) next.unit_price=toRowCurrency(packageUnitPriceIdr(prod),next);
          if (upd.product_id !== r.product_id) {
            const pkgMeta = (prod.meta ?? {}) as {
              includes?: string[];
              hotel_makkah_id?: string;
              hotel_madinah_id?: string;
            };
            const includes = Array.isArray(pkgMeta.includes) ? pkgMeta.includes : [];
            const package_include_flags: Record<string, boolean> = {};
            includes.forEach((k) => {
              package_include_flags[k] = true;
            });
            next.meta = {
              ...(next.meta || {}),
              package_include_flags,
              package_hotel_makkah_id: pkgMeta.hotel_makkah_id || undefined,
              package_hotel_madinah_id: pkgMeta.hotel_madinah_id || undefined
            };
          }
        } else {
          if(next.unit_price===0||upd.product_id!==r.product_id) next.unit_price=effP(prod,next.type);
        }
        if (next.type === 'hotel' && prod && upd.product_id !== r.product_id) {
          const defRt = defaultRoomTypeForHotelGrid(prod, next);
          if (hotelRoomPricingMode(prod) === 'per_pack') {
            const fb = isFullboardHotelForRow(prod, next);
            next.meta = { ...(next.meta || {}), hotel_room_input_mode: undefined, hotel_pax: undefined };
            next.room_breakdown = [{ id: `rl-${uid()}`, room_type: defRt, quantity: 0, unit_price: 0, with_meal: fb, meal_unit_price: 0 }];
          } else {
            const withMealDefault = isFullboardHotelForRow(prod, next);
            next.meta = { ...(next.meta || {}), hotel_room_input_mode: 'manual', hotel_pax: undefined };
            next.room_breakdown = [{ id: `rl-${uid()}`, room_type: defRt, quantity: 0, unit_price: 0, with_meal: withMealDefault }];
          }
        } else if (next.type === 'hotel' && !(next.room_breakdown?.length)) {
          const defRt = defaultRoomTypeForHotelGrid(prod, next);
          if (hotelRoomPricingMode(prod) === 'per_pack') {
            const fb = isFullboardHotelForRow(prod, next);
            next.room_breakdown = [{ id: `rl-${uid()}`, room_type: defRt, quantity: 0, unit_price: 0, with_meal: fb, meal_unit_price: 0 }];
          } else {
            const withMealDefault = isFullboardHotelForRow(prod, next);
            next.room_breakdown = [{ id: `rl-${uid()}`, room_type: defRt, quantity: 0, unit_price: 0, with_meal: withMealDefault }];
          }
        }
        if (next.type === 'hotel' && next.room_breakdown?.length) {
          const rowCurHotel = next.price_currency ?? getDisplayCurrency(next.type, prod);
          const fullboard = isFullboardHotelForRow(prod, next);
          next.room_breakdown = next.room_breakdown.map((l) => {
            const effRt = effectiveHotelLineRoomType(next, l);
            if (!effRt) return l;
            const withMeal = fullboard ? true : (l.with_meal ?? false);
            const roomPSar = hotelRoomUnitSar(prod, effRt, next.check_in, next);
            const mealPSar = getMealPriceSar(prod, next.check_in, next);
            const roomP = toCurrencyFromSAR(roomPSar, rowCurHotel);
            const mealP = toCurrencyFromSAR(mealPSar, rowCurHotel);
            const combinedP = fullboard ? roomP : (roomP + (withMeal ? mealP : 0));
            return { ...l, with_meal: withMeal, unit_price: l.unit_price || (fullboard ? combinedP : roomP), meal_unit_price: withMeal && !fullboard ? (l.meal_unit_price ?? mealP) : 0 };
          });
        }
      }
    }
    if(upd.meta!=null&&next.type==='ticket'){
      const prodTicket=byType('ticket').find(x=>x.id===next.product_id);
      const bandara=(upd.meta.bandara as string)||(next.meta?.bandara as string);
      if(prodTicket&&bandara) next.unit_price=ticketPrice(prodTicket,bandara);
    }
    if(upd.meta!=null&&next.type==='bus'){
      const prodBus=byType('bus').find(x=>x.id===next.product_id);
      const route:BusRouteType=(upd.meta.route_type as BusRouteType)||(next.meta?.route_type as BusRouteType)||'full_route';
      const tripType:TicketTripType=(upd.meta.trip_type as TicketTripType)||(next.meta?.trip_type as TicketTripType)||'round_trip';
      if(prodBus) next.unit_price=busRoutePrice(prodBus,route,tripType);
    }
    if(upd.type!=null&&upd.type!==r.type){
      next.product_id=''; next.product_name=''; next.unit_price=0; next.meta=undefined;
      if(upd.type!=='hotel'){ next.room_type=undefined; next.room_breakdown=undefined; } else next.room_breakdown=next.room_breakdown??[];
    }
    return next;
  }));

  /* totals — hotel: harga per malam × jumlah malam × qty; non-hotel: unit_price × qty. Semua dalam mata uang baris (product); konversi pakai kurs sistem. */
  const getEffectiveLinePrice=(r:OrderItemRow,l:HotelRoomLine):number=>{
    if(r.type!=='hotel') return l.unit_price||0;
    const effRt = effectiveHotelLineRoomType(r, l);
    if(!effRt) return l.unit_price||0;
    const prod=byType('hotel').find(p=>p.id===r.product_id);
    const cur=rowCur(r);
    const effectiveCheckIn = hotelPricingCheckInForRow(r);
    if (prod?.type === 'hotel') {
      const hasSplitMeal = typeof l.meal_unit_price === 'number';
      if (l.with_meal && !hasSplitMeal) return l.unit_price || 0;
      const roomPart = l.unit_price || toCurrencyFromSAR(hotelRoomUnitSar(prod, effRt, effectiveCheckIn, r), cur);
      const mealPart = l.with_meal ? (hasSplitMeal ? (l.meal_unit_price as number) : toCurrencyFromSAR(getMealPriceSar(prod, effectiveCheckIn, r), cur)) : 0;
      return roomPart + mealPart;
    }
    const hasSplitMeal=typeof l.meal_unit_price==='number';
    if(l.with_meal&&!hasSplitMeal) return l.unit_price||toCurrencyFromSAR(hotelRoomUnitSar(prod,effRt,effectiveCheckIn,r),cur);
    const roomPart=l.unit_price||toCurrencyFromSAR(hotelRoomUnitSar(prod,effRt,effectiveCheckIn,r),cur);
    const mealPart=l.with_meal?(l.meal_unit_price??toCurrencyFromSAR(getMealPriceSar(prod,effectiveCheckIn,r),cur)):0;
    return roomPart+mealPart;
  };
  const getEffectiveRoomPrice=(r:OrderItemRow,l:HotelRoomLine):number=>{
    if(r.type!=='hotel') return l.unit_price||0;
    const effRt = effectiveHotelLineRoomType(r, l);
    if(!effRt) return l.unit_price||0;
    const prod=byType('hotel').find(p=>p.id===r.product_id);
    const cur=rowCur(r);
    const effectiveCheckIn = hotelPricingCheckInForRow(r);
    if (prod?.type === 'hotel') {
      if (l.with_meal && typeof l.meal_unit_price !== 'number') {
        const combined = l.unit_price || 0;
        const meal = toCurrencyFromSAR(getMealPriceSar(prod, effectiveCheckIn, r), cur);
        return Math.max(0, combined - meal);
      }
      return l.unit_price || toCurrencyFromSAR(hotelRoomUnitSar(prod, effRt, effectiveCheckIn, r), cur);
    }
    const hasSplitMeal=typeof l.meal_unit_price==='number';
    if(l.with_meal&&!hasSplitMeal){ const combined=l.unit_price||toCurrencyFromSAR(hotelRoomUnitSar(prod,effRt,effectiveCheckIn,r),cur); const meal=toCurrencyFromSAR(getMealPriceSar(prod,effectiveCheckIn,r),cur); return Math.max(0,combined-meal); }
    return l.unit_price||toCurrencyFromSAR(hotelRoomUnitSar(prod,effRt,effectiveCheckIn,r),cur);
  };
  const getEffectiveMealPrice=(r:OrderItemRow,l:HotelRoomLine):number=>{
    if(r.type!=='hotel'||!l.with_meal) return 0;
    const effRt = effectiveHotelLineRoomType(r, l);
    const prod=byType('hotel').find(p=>p.id===r.product_id);
    const cur=rowCur(r);
    const effectiveCheckIn = hotelPricingCheckInForRow(r);
    if (prod?.type === 'hotel') {
      if (typeof l.meal_unit_price === 'number') return l.meal_unit_price;
      const combined = l.unit_price || 0;
      const room = effRt ? toCurrencyFromSAR(hotelRoomUnitSar(prod, effRt, effectiveCheckIn, r), cur) : 0;
      return Math.max(0, combined - room);
    }
    const hasSplitMeal=typeof l.meal_unit_price==='number';
    if(!hasSplitMeal){ const combined=l.unit_price||toCurrencyFromSAR(hotelRoomUnitSar(prod,(effRt||'quad') as RoomTypeId,effectiveCheckIn,r),cur); const room=getEffectiveRoomPrice(r,l); return Math.max(0,combined-room); }
    return l.meal_unit_price??toCurrencyFromSAR(getMealPriceSar(prod,effectiveCheckIn,r),cur);
  };
  /** Untuk ringkasan total & header: jika kurs order diisi, harga kamar dihitung lagi dari master SAR × kurs order (bukan IDR tersimpan dari kurs settings). */
  const getEffectiveLinePriceForTotals=(r:OrderItemRow,l:HotelRoomLine):number=>{
    if(r.type!=='hotel') return l.unit_price||0;
    const effRt = effectiveHotelLineRoomType(r, l);
    if(!effRt) return l.unit_price||0;
    if (!hasCustomOrderKurs) return getEffectiveLinePrice(r,l);
    const prod=byType('hotel').find(p=>p.id===r.product_id);
    const cur=rowCur(r);
    if (prod?.type === 'hotel') {
      const hasSplitMeal = typeof l.meal_unit_price === 'number';
      if (l.with_meal && !hasSplitMeal) return l.unit_price || 0;
      const effectiveCheckIn = hotelPricingCheckInForRow(r);
      const roomPart = toCurrencyFromSAR(hotelRoomUnitSar(prod, effRt, effectiveCheckIn, r), cur);
      const mealPart = l.with_meal ? (hasSplitMeal ? (l.meal_unit_price as number) : toCurrencyFromSAR(getMealPriceSar(prod, effectiveCheckIn, r), cur)) : 0;
      return roomPart + mealPart;
    }
    const hasSplitMeal=typeof l.meal_unit_price==='number';
    const effectiveCheckIn = hotelPricingCheckInForRow(r);
    if(l.with_meal&&!hasSplitMeal) return toCurrencyFromSAR(hotelRoomUnitSar(prod,effRt,effectiveCheckIn,r),cur);
    const roomPart=toCurrencyFromSAR(hotelRoomUnitSar(prod,effRt,effectiveCheckIn,r),cur);
    const mealPart=l.with_meal?(l.meal_unit_price??toCurrencyFromSAR(getMealPriceSar(prod,effectiveCheckIn,r),cur)):0;
    return roomPart+mealPart;
  };
  const nightsFor=(r:OrderItemRow)=> r.type==='hotel' ? hotelStayNightsForRow(r) : 0;
  const rowSub=(r:OrderItemRow)=>{
    if(r.type==='hotel'&&r.room_breakdown?.length){
      const hasDates = !!(r.check_in && r.check_out);
      if(!hasDates) return 0;
      const nights = nightsFor(r)||0;
      const multiplier = nights>0 ? nights : 1;
      return r.room_breakdown.reduce((s,l)=>s+Math.max(0,l.quantity)*getEffectiveLinePriceForTotals(r,l)*multiplier,0);
    }
    if(r.type==='hotel'&&r.room_type){
      const hasDates = !!(r.check_in && r.check_out);
      if(!hasDates) return 0;
      const nights = nightsFor(r)||0;
      const multiplier = nights>0 ? nights : 1;
      const prod=byType('hotel').find(p=>p.id===r.product_id);
      const cur=rowCur(r);
      const fullboard=!!(prod && isFullboardHotelForRow(prod, r));
      const unit=hasCustomOrderKurs&&prod&&r.room_type
        ? toCurrencyFromSAR(hotelRoomUnitSar(prod,r.room_type as RoomTypeId,r.check_in,r),cur)
        :(r.unit_price||0);
      return Math.max(0,r.quantity)*unit*multiplier;
    }
    return Math.max(0,r.quantity)*(r.unit_price||0);
  };
  const rowPax=(r:OrderItemRow)=>{
    if(r.type==='hotel'&&r.room_breakdown?.length){
      const prod=byType('hotel').find(p=>p.id===r.product_id);
      const perPack=prod&&hotelRoomPricingMode(prod)==='per_pack';
      return r.room_breakdown.reduce((s,l)=>{
        const q=Math.max(0,l.quantity);
        if(perPack) return s+q;
        return s+q*rCap(l.room_type||undefined);
      },0);
    }
    if(r.type==='hotel'&&r.room_type) return Math.max(0,r.quantity)*rCap(r.room_type);
    return 0;
  };
  const hotelMonthBreakdown=(r:OrderItemRow)=>{
    if(r.type!=='hotel'||!r.check_in||!r.check_out) return [] as Array<{ yearMonth:string; nights:number; est:number }>;
    const a=new Date(`${r.check_in}T00:00:00`);
    const b=new Date(`${r.check_out}T00:00:00`);
    if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||b<=a) return [];
    const byMonth:Record<string,number>={};
    const cur=new Date(a.getTime());
    while(cur<b){
      const k=`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
      byMonth[k]=(byMonth[k]||0)+1;
      cur.setDate(cur.getDate()+1);
    }
    const nightsTotal=Object.values(byMonth).reduce((s,n)=>s+n,0);
    if(!nightsTotal) return [];
    const perNight=r.type==='hotel'?(rowSub(r)/nightsTotal):0;
    return Object.entries(byMonth).map(([yearMonth,nights])=>({ yearMonth, nights, est: perNight*nights }));
  };
  const totalVisaPacks=items.filter(r=>r.type==='visa').reduce((s,r)=>s+Math.max(0,r.quantity),0);
  const busFinalityDeficitPacks = Math.max(0, busPenaltyRule.bus_min_pack - totalVisaPacks);
  const busFinalityPerPackIDR =
    busServiceOption === 'finality' && totalVisaPacks > 0 ? busFinalityDeficitPacks * busPenaltyRule.bus_penalty_idr : 0;

  const applyBusServiceOption = useCallback((opt: BusServiceOption) => {
    setBusServiceOption(opt);
    setItems((prev)=>{
      const existingBus = prev.find((r) => r.type === 'bus');
      const withoutBus = prev.filter((r) => r.type !== 'bus');
      if (existingBus) {
        // Keep the latest user-edited bus row so switching option does not lose manual price input.
        lastHiaceBusRowRef.current = existingBus;
      }
      if (opt !== 'hiace') return withoutBus;
      const visaMeta = withoutBus.find((r) => r.type === 'visa')?.meta as { travel_date?: string } | undefined;
      if (existingBus) {
        const prod =
          products.find((p) => p.id === existingBus.product_id) ??
          products.find((p) => p.type === 'bus' && (p.meta as { bus_kind?: string })?.bus_kind === 'hiace');
        const route = (existingBus.meta?.route_type as BusRouteType) || 'full_route';
        const tripType = (existingBus.meta?.trip_type as TicketTripType) || 'round_trip';
        const refreshed: OrderItemRow = {
          ...existingBus,
          quantity: Math.max(1, existingBus.quantity || 1),
          unit_price: busRoutePrice(prod, route, tripType),
          meta: {
            ...(existingBus.meta || {}),
            route_type: route,
            trip_type: tripType,
            auto_hiace_waive: true,
            ...(visaMeta?.travel_date ? { travel_date: visaMeta.travel_date } : {})
          }
        };
        return [...withoutBus, refreshed];
      }
      const cached = lastHiaceBusRowRef.current;
      if (cached) {
        return [
          ...withoutBus,
          {
            ...cached,
            meta: {
              ...(cached.meta || {}),
              auto_hiace_waive: true,
              ...(visaMeta?.travel_date ? { travel_date: visaMeta.travel_date } : {})
            }
          }
        ];
      }
      const row = createHiaceBusOrderRow(products, busRoutePrice, visaMeta?.travel_date);
      return row ? [...withoutBus, row] : withoutBus;
    });
  }, [products, busRoutePrice]);

  /** Jika Hiace dipilih sebelum master produk selesai dimuat, sisipkan baris bus setelah produk ada. */
  useEffect(()=>{
    if(busServiceOption!=='hiace'||loadingProd||products.length===0) return;
    setItems((prev)=>{
      if(prev.some(r=>r.type==='bus')) return prev;
      const visaMeta=prev.find(r=>r.type==='visa')?.meta as { travel_date?: string }|undefined;
      const cached = lastHiaceBusRowRef.current;
      if (cached) {
        return [
          ...prev,
          {
            ...cached,
            meta: {
              ...(cached.meta || {}),
              auto_hiace_waive: true,
              ...(visaMeta?.travel_date ? { travel_date: visaMeta.travel_date } : {})
            }
          }
        ];
      }
      const row=createHiaceBusOrderRow(products,busRoutePrice,visaMeta?.travel_date);
      return row?[...prev,row]:prev;
    });
  // busRoutePrice identitas berubah tiap render; yang memicu sync cukup master produk + opsi + loading
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sengaja tanpa busRoutePrice di deps
  }, [busServiceOption, loadingProd, products]);

  const busOrderApiFields = useMemo(() => {
    if (!items.some((r) => r.type === 'visa')) return {};
    return {
      bus_service_option: busServiceOption,
      ...(busServiceOption === 'hiace' ? { waive_bus_penalty: true as const } : {})
    };
  }, [items, busServiceOption]);

  /* submit */
  const latestRates = { SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 };
  /** Subtotal IDR dengan logika sama persis seperti payload (agar Ringkasan = total yang akan disimpan). */
  const payloadSubtotalIDR=(valid:OrderItemRow[]):number=>{
    let sum=0;
    for(const r of valid){
      if(r.type==='hotel'&&r.room_breakdown?.length){
        for(const l of r.room_breakdown){
          if(!hotelLineQuantityValid(r,l)) continue;
          const effRt = effectiveHotelLineRoomType(r,l);
          if(!effRt) continue;
          const key=`hotel:${r.product_id}:${effRt}:${hotelStayKeyPart(r)}`;
          const isNew=!initialOrderItemKeysRef.current.has(key);
          const useLatestRates=hasDpPayment&&isNew;
          const lineRowCur=getEffectiveLinePriceForTotals(r,l);
          const unitPriceIdr=useLatestRates?toIDRWithRates(lineRowCur,r,latestRates):toIDR(lineRowCur,r);
          const nights=nightsFor(r)||1;
          sum+=l.quantity*unitPriceIdr*nights;
        }
      } else if(r.type==='hotel'&&r.room_type){
        const key=`hotel:${r.product_id}:${r.room_type}:${hotelStayKeyPart(r)}`;
        const isNew=!initialOrderItemKeysRef.current.has(key);
        const useLatestRates=hasDpPayment&&isNew;
        const prod=byType('hotel').find(p=>p.id===r.product_id);
        const cur=rowCur(r);
        const lineRowCur=hasCustomOrderKurs&&prod&&r.room_type
          ? toCurrencyFromSAR(hotelRoomUnitSar(prod,r.room_type as RoomTypeId,hotelPricingCheckInForRow(r),r),cur)
          :(r.unit_price||0);
        const unitPriceIdr=useLatestRates?toIDRWithRates(lineRowCur,r,latestRates):toIDR(lineRowCur,r);
        const nights=nightsFor(r)||1;
        sum+=Math.max(1,r.quantity)*unitPriceIdr*nights;
      } else{
        const metaKey=JSON.stringify(r.meta||{});
        const key=`${r.type}:${r.product_id}:${metaKey}`;
        const isNew=!initialOrderItemKeysRef.current.has(key);
        const useLatestRates=hasDpPayment&&isNew;
        const unitPriceIdr=useLatestRates?toIDRWithRates(r.unit_price,r,latestRates):toIDR(r.unit_price,r);
        sum+=Math.max(1,r.quantity)*unitPriceIdr;
      }
    }
    return sum;
  };
  const validForTotal=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some((l)=>hotelLineQuantityValid(r,l))||(r.room_type&&r.quantity>0); return r.quantity>0; });
  const subtotalIDR=payloadSubtotalIDR(validForTotal);
  const totalIDR=subtotalIDR+busFinalityPerPackIDR;
  const totalSAR=totalIDR/(effectiveRates.SAR_TO_IDR||4200);
  const totalPax=items.reduce((s,r)=>s+rowPax(r),0);
  /** Nilai dalam mata uang baris untuk ditampilkan pakai NominalDisplay */
  const nominalInRowCur=(row:OrderItemRow,n:number)=>({ amount: getInC(n,row,rowCur(row)), currency: rowCur(row) as 'IDR'|'SAR'|'USD' });
  const fmt=(n:number)=>new Intl.NumberFormat('id-ID').format(Math.round(n));

  /** Kirim unit_price dalam mata uang yang dipilih (currency). Backend menyimpan as-is dan konversi ke IDR hanya untuk total. */
  const buildPayloadWithRates=(valid:OrderItemRow[])=>{
    const out:Record<string,any>[]=[];
    for(const r of valid){
      const cur=rowCur(r);
      if(r.type==='hotel'&&r.room_breakdown?.length){
        for(const l of r.room_breakdown){
          if(!hotelLineQuantityValid(r,l)) continue;
          const effRt = effectiveHotelLineRoomType(r,l);
          if(!effRt) continue;
          const meal=l.with_meal??false;
          const meta:Record<string,unknown>={room_type:effRt,with_meal:meal,room_unit_price:l.unit_price??0,meal_unit_price:meal?(l.meal_unit_price??0):0}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; if(r.meta?.hotel_location) meta.hotel_location=r.meta.hotel_location;
          if ((r.meta as { hotel_pack_input_mode?: string } | undefined)?.hotel_pack_input_mode) meta.hotel_pack_input_mode = (r.meta as { hotel_pack_input_mode?: string }).hotel_pack_input_mode;
          if ((r.meta as { hotel_pack_pax?: number } | undefined)?.hotel_pack_pax != null) meta.hotel_pack_pax = (r.meta as { hotel_pack_pax?: number }).hotel_pack_pax;
          if ((r.meta as { hotel_pack_total?: number } | undefined)?.hotel_pack_total != null) meta.hotel_pack_total = (r.meta as { hotel_pack_total?: number }).hotel_pack_total;
          const key=`hotel:${r.product_id}:${effRt}:${hotelStayKeyPart(r)}`;
          const isNew=!initialOrderItemKeysRef.current.has(key);
          const useLatestRates=hasDpPayment&&isNew;
          if ((r.meta as { hotel_stay_date_mode?: string } | undefined)?.hotel_stay_date_mode) meta.hotel_stay_date_mode = (r.meta as { hotel_stay_date_mode?: string }).hotel_stay_date_mode;
          if ((r.meta as { hotel_stay_check_in_month?: number } | undefined)?.hotel_stay_check_in_month != null) meta.hotel_stay_check_in_month = (r.meta as { hotel_stay_check_in_month?: number }).hotel_stay_check_in_month;
          if ((r.meta as { hotel_stay_check_in_year?: number } | undefined)?.hotel_stay_check_in_year != null) meta.hotel_stay_check_in_year = (r.meta as { hotel_stay_check_in_year?: number }).hotel_stay_check_in_year;
          if ((r.meta as { hotel_stay_check_out_month?: number } | undefined)?.hotel_stay_check_out_month != null) meta.hotel_stay_check_out_month = (r.meta as { hotel_stay_check_out_month?: number }).hotel_stay_check_out_month;
          if ((r.meta as { hotel_stay_check_out_year?: number } | undefined)?.hotel_stay_check_out_year != null) meta.hotel_stay_check_out_year = (r.meta as { hotel_stay_check_out_year?: number }).hotel_stay_check_out_year;
          if ((r.meta as { hotel_stay_nights?: number } | undefined)?.hotel_stay_nights != null) meta.hotel_stay_nights = (r.meta as { hotel_stay_nights?: number }).hotel_stay_nights;
          if ((r.meta as { hotel_stay_month?: number } | undefined)?.hotel_stay_month != null) meta.hotel_stay_month = (r.meta as { hotel_stay_month?: number }).hotel_stay_month;
          if ((r.meta as { hotel_stay_year?: number } | undefined)?.hotel_stay_year != null) meta.hotel_stay_year = (r.meta as { hotel_stay_year?: number }).hotel_stay_year;
          const item:Record<string,any>={product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:l.quantity,unit_price:l.unit_price??0,currency:cur,room_type:effRt,meal,check_in:r.check_in,check_out:r.check_out,meta};
          if(useLatestRates) item.currency_rates_override=latestRates;
          out.push(item);
        }
      } else if(r.type==='hotel'&&r.room_type){
        const meta:Record<string,unknown>={room_type:r.room_type,room_unit_price:r.unit_price??0,meal_unit_price:0}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; if(r.meta?.hotel_location) meta.hotel_location=r.meta.hotel_location;
        if ((r.meta as { hotel_pack_input_mode?: string } | undefined)?.hotel_pack_input_mode) meta.hotel_pack_input_mode = (r.meta as { hotel_pack_input_mode?: string }).hotel_pack_input_mode;
        if ((r.meta as { hotel_pack_pax?: number } | undefined)?.hotel_pack_pax != null) meta.hotel_pack_pax = (r.meta as { hotel_pack_pax?: number }).hotel_pack_pax;
        if ((r.meta as { hotel_pack_total?: number } | undefined)?.hotel_pack_total != null) meta.hotel_pack_total = (r.meta as { hotel_pack_total?: number }).hotel_pack_total;
        const key=`hotel:${r.product_id}:${r.room_type}:${hotelStayKeyPart(r)}`;
        const isNew=!initialOrderItemKeysRef.current.has(key);
        const useLatestRates=hasDpPayment&&isNew;
        if ((r.meta as { hotel_stay_date_mode?: string } | undefined)?.hotel_stay_date_mode) meta.hotel_stay_date_mode = (r.meta as { hotel_stay_date_mode?: string }).hotel_stay_date_mode;
        if ((r.meta as { hotel_stay_check_in_month?: number } | undefined)?.hotel_stay_check_in_month != null) meta.hotel_stay_check_in_month = (r.meta as { hotel_stay_check_in_month?: number }).hotel_stay_check_in_month;
        if ((r.meta as { hotel_stay_check_in_year?: number } | undefined)?.hotel_stay_check_in_year != null) meta.hotel_stay_check_in_year = (r.meta as { hotel_stay_check_in_year?: number }).hotel_stay_check_in_year;
        if ((r.meta as { hotel_stay_check_out_month?: number } | undefined)?.hotel_stay_check_out_month != null) meta.hotel_stay_check_out_month = (r.meta as { hotel_stay_check_out_month?: number }).hotel_stay_check_out_month;
        if ((r.meta as { hotel_stay_check_out_year?: number } | undefined)?.hotel_stay_check_out_year != null) meta.hotel_stay_check_out_year = (r.meta as { hotel_stay_check_out_year?: number }).hotel_stay_check_out_year;
        if ((r.meta as { hotel_stay_nights?: number } | undefined)?.hotel_stay_nights != null) meta.hotel_stay_nights = (r.meta as { hotel_stay_nights?: number }).hotel_stay_nights;
        if ((r.meta as { hotel_stay_month?: number } | undefined)?.hotel_stay_month != null) meta.hotel_stay_month = (r.meta as { hotel_stay_month?: number }).hotel_stay_month;
        if ((r.meta as { hotel_stay_year?: number } | undefined)?.hotel_stay_year != null) meta.hotel_stay_year = (r.meta as { hotel_stay_year?: number }).hotel_stay_year;
        const item:Record<string,any>={product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:Math.max(1,r.quantity),unit_price:r.unit_price??0,currency:cur,room_type:r.room_type,check_in:r.check_in,check_out:r.check_out,meta};
        if(useLatestRates) item.currency_rates_override=latestRates;
        out.push(item);
      } else{
        const metaKey=JSON.stringify(r.meta||{});
        const key=`${r.type}:${r.product_id}:${metaKey}`;
        const isNew=!initialOrderItemKeysRef.current.has(key);
        const useLatestRates=hasDpPayment&&isNew;
        const item:Record<string,any>={product_id:r.product_id,type:r.type,product_ref_type:r.type==='package'?'package':'product',quantity:Math.max(1,r.quantity),unit_price:r.unit_price??0,currency:cur};
        if(r.meta&&Object.keys(r.meta).length) item.meta=r.meta;
        if(useLatestRates) item.currency_rates_override=latestRates;
        out.push(item);
      }
    }
    return out;
  };
  /** Hanya kirim kurs override jika ada permintaan khusus (invoice koordinator mengisi kurs). Tanpa override = pakai kurs sistem. */
  const getRatesPayload=()=>{
    if(isEdit&&hasDpPayment) return {};
    const hasCustomRates=canEditPrice&&orderRatesOverride&&(orderRatesOverride.SAR_TO_IDR!=null||orderRatesOverride.USD_TO_IDR!=null);
    return hasCustomRates ? { currency_rates_override: { SAR_TO_IDR: orderRatesOverride!.SAR_TO_IDR, USD_TO_IDR: orderRatesOverride!.USD_TO_IDR } } : {};
  };
  const getInvoiceKeteranganPayload = () =>
    canEditPrice ? { invoice_keterangan: invoiceKeterangan.trim() ? invoiceKeterangan.trim() : null } : {};
  const validForRates=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some((l)=>hotelLineQuantityValid(r,l))||(r.room_type&&r.quantity>0); return r.quantity>0; });
  const hasNewItemsAfterDp=hasDpPayment&&validForRates.some(r=>{
    if(r.type==='hotel'&&r.room_breakdown?.length){ for(const l of r.room_breakdown){ if(!hotelLineQuantityValid(r,l)) continue; const effRt=effectiveHotelLineRoomType(r,l); if(!effRt) continue; const key=`hotel:${r.product_id}:${effRt}:${hotelStayKeyPart(r)}`; if(!initialOrderItemKeysRef.current.has(key)) return true; } return false; }
    if(r.type==='hotel'&&r.room_type){ const key=`hotel:${r.product_id}:${r.room_type}:${hotelStayKeyPart(r)}`; return !initialOrderItemKeysRef.current.has(key); }
    const key=`${r.type}:${r.product_id}:${JSON.stringify(r.meta||{})}`;
    return !initialOrderItemKeysRef.current.has(key);
  });
  const handleSubmit=(e:React.FormEvent)=>{
    e.preventDefault();
    const valid=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some((l)=>hotelLineQuantityValid(r,l))||(r.room_type&&r.quantity>0); return r.quantity>0; });
    if(!valid.length){ showToast('Minimal satu item dengan produk dan qty > 0','warning'); return; }
    if (!orderPicName.trim()) { showToast('Nama PIC invoice wajib diisi', 'warning'); return; }
    const visaWithoutTravel = valid.filter((r) => r.type === 'visa' && !(r.meta?.travel_date && String(r.meta.travel_date).trim()));
    if (visaWithoutTravel.length) { showToast('Item visa wajib isi tanggal keberangkatan', 'warning'); return; }
    const busWithoutTravel = valid.filter((r) => r.type === 'bus' && !(r.meta?.travel_date && String(r.meta.travel_date).trim()));
    if (busWithoutTravel.length) { showToast('Item bus wajib isi tanggal keberangkatan', 'warning'); return; }
    const hotelWithoutDates=valid.filter(r=>r.type==='hotel'&&!hasValidHotelStayInput(r));
    if(hotelWithoutDates.length){ showToast('Item hotel wajib isi tanggal Check-in/Check-out atau pilih bulan & tahun','warning'); return; }
    const ticketWithoutBandara=valid.filter(r=>r.type==='ticket'&&!r.meta?.bandara);
    if(ticketWithoutBandara.length){ showToast('Item tiket wajib pilih bandara','warning'); return; }
    const ticketWithoutDates=valid.filter(r=>{
      if(r.type!=='ticket') return false;
      const tt=(r.meta?.trip_type as TicketTripType)||'round_trip';
      if(tt==='round_trip') return !r.meta?.departure_date||!r.meta?.return_date;
      if(tt==='one_way') return !r.meta?.departure_date;
      return !r.meta?.return_date;
    });
    if(ticketWithoutDates.length){ showToast('Item tiket wajib isi tanggal sesuai jenis perjalanan (pulang pergi: keberangkatan & kepulangan; pergi saja: tanggal keberangkatan; pulang saja: tanggal kepulangan)','warning'); return; }
    const siskopatuhWithoutDate=valid.filter(r=>r.type==='siskopatuh'&&!(r.meta?.service_date&&String(r.meta.service_date).trim()));
    if(siskopatuhWithoutDate.length){ showToast('Item siskopatuh wajib isi tanggal layanan','warning'); return; }
    if(!isEdit&&!isOwner&&!canPickOwner&&!branchId){ showToast('Pilih kota terlebih dahulu','warning'); return; }
    if(canPickOwner&&ownerInputMode==='registered'&&!ownerSel){ showToast('Pilih owner untuk order ini','warning'); return; }
    if(canPickOwner&&ownerInputMode==='registered'&&ownerSel&&!bFromOwner){ showToast('Owner belum memiliki kota','warning'); return; }
    if(canPickOwner&&ownerInputMode==='manual'&&!manualOwnerName.trim()){ showToast('Isi nama owner tanpa akun','warning'); return; }
    if(canPickOwner&&ownerInputMode==='manual'&&!manualKabupatenId){ showToast('Pilih kota/kabupaten','warning'); return; }
    if(canPickOwner&&ownerInputMode==='manual'&&manualKabupatenId&&!selectedManualKab?.wilayah_id){ showToast('Kabupaten ini belum dipetakan ke wilayah di master. Hubungi admin pusat.','warning'); return; }
    if(canPickOwner&&ownerInputMode==='manual'&&!branchSel){ showToast('Tidak ada kota sistem untuk kabupaten terpilih (pastikan master kota punya kode sama dengan kode kabupaten).','warning'); return; }
    const payload=buildPayloadWithRates(valid);
    const ratesPayload=getRatesPayload();
    const ketPayload = getInvoiceKeteranganPayload();
    setSaving(true);
    if(isEdit&&orderId){
      ordersApi.update(orderId,{items:payload,pic_name:orderPicName.trim(),...ratesPayload,...ketPayload,...busOrderApiFields})
        .then(()=>{ showToast('Invoice diperbarui. Tagihan ikut diperbarui.','success'); navigate('/dashboard/orders-invoices', { state: { refreshList: true } }); })
        .catch((err:any)=>showToast(err.response?.data?.message||'Gagal memperbarui','error'))
        .finally(()=>setSaving(false));
    } else {
      const body:Record<string,any>={items:payload,pic_name:orderPicName.trim(),...ratesPayload,...ketPayload};
      if((!isOwner&&!canPickOwner&&branchId) || (canPickOwner&&ownerInputMode==='manual'&&branchSel)) body.branch_id=(canPickOwner&&ownerInputMode==='manual')?branchSel:branchId;
      if(ownerId&&user?.role!=='owner_mou'&&user?.role!=='owner_non_mou') body.owner_id=ownerId;
      if(canPickOwner&&ownerInputMode==='manual'){
        body.owner_input_mode='manual';
        body.owner_name_manual=manualOwnerName.trim();
        if(manualOwnerPhone.trim()) body.owner_phone_manual=manualOwnerPhone.trim();
      } else if (canPickOwner) {
        body.owner_input_mode='registered';
      }
      Object.assign(body, busOrderApiFields);
      ordersApi.create(body)
        .then(()=>{ orderDraft.clear(); showToast('Invoice dibuat.','success'); navigate('/dashboard/orders-invoices',{state:{refreshList:true}}); })
        .catch((err:any)=>showToast(err.response?.data?.message||'Gagal membuat invoice','error'))
        .finally(()=>setSaving(false));
    }
  };

  const handleSaveDraft=(e?: React.MouseEvent)=>{
    e?.preventDefault();
    const valid=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some((l)=>hotelLineQuantityValid(r,l))||(r.room_type&&r.quantity>0); return r.quantity>0; });
    if(!valid.length){ showToast('Minimal satu item dengan produk dan qty > 0','warning'); return; }
    if (!orderPicName.trim()) { showToast('Nama PIC invoice wajib diisi', 'warning'); return; }
    const visaWithoutTravelDraft = valid.filter((r) => r.type === 'visa' && !(r.meta?.travel_date && String(r.meta.travel_date).trim()));
    if (visaWithoutTravelDraft.length) { showToast('Item visa wajib isi tanggal keberangkatan', 'warning'); return; }
    const busWithoutTravelDraft = valid.filter((r) => r.type === 'bus' && !(r.meta?.travel_date && String(r.meta.travel_date).trim()));
    if (busWithoutTravelDraft.length) { showToast('Item bus wajib isi tanggal keberangkatan', 'warning'); return; }
    const hotelWithoutDates=valid.filter(r=>r.type==='hotel'&&!hasValidHotelStayInput(r));
    if(hotelWithoutDates.length){ showToast('Item hotel wajib isi tanggal Check-in/Check-out atau pilih bulan & tahun','warning'); return; }
    const ticketWithoutBandara=valid.filter(r=>r.type==='ticket'&&!r.meta?.bandara);
    if(ticketWithoutBandara.length){ showToast('Item tiket wajib pilih bandara','warning'); return; }
    const ticketWithoutDates=valid.filter(r=>{
      if(r.type!=='ticket') return false;
      const tt=(r.meta?.trip_type as TicketTripType)||'round_trip';
      if(tt==='round_trip') return !r.meta?.departure_date||!r.meta?.return_date;
      if(tt==='one_way') return !r.meta?.departure_date;
      return !r.meta?.return_date;
    });
    if(ticketWithoutDates.length){ showToast('Item tiket wajib isi tanggal sesuai jenis perjalanan','warning'); return; }
    const siskopatuhWithoutDateDraft=valid.filter(r=>r.type==='siskopatuh'&&!(r.meta?.service_date&&String(r.meta.service_date).trim()));
    if(siskopatuhWithoutDateDraft.length){ showToast('Item siskopatuh wajib isi tanggal layanan','warning'); return; }
    if(!isEdit&&!isOwner&&!canPickOwner&&!branchId){ showToast('Pilih kota terlebih dahulu','warning'); return; }
    if(canPickOwner&&ownerInputMode==='registered'&&!ownerSel){ showToast('Pilih owner untuk invoice ini','warning'); return; }
    if(canPickOwner&&ownerInputMode==='registered'&&ownerSel&&!bFromOwner){ showToast('Owner belum memiliki kota','warning'); return; }
    if(canPickOwner&&ownerInputMode==='manual'&&!manualOwnerName.trim()){ showToast('Isi nama owner tanpa akun','warning'); return; }
    if(canPickOwner&&ownerInputMode==='manual'&&!manualKabupatenId){ showToast('Pilih kota/kabupaten','warning'); return; }
    if(canPickOwner&&ownerInputMode==='manual'&&manualKabupatenId&&!selectedManualKab?.wilayah_id){ showToast('Kabupaten ini belum dipetakan ke wilayah di master. Hubungi admin pusat.','warning'); return; }
    if(canPickOwner&&ownerInputMode==='manual'&&!branchSel){ showToast('Tidak ada kota sistem untuk kabupaten terpilih (pastikan master kota punya kode sama dengan kode kabupaten).','warning'); return; }
    const payload=buildPayloadWithRates(valid);
    const ratesPayload=getRatesPayload();
    const ketPayloadDraft = getInvoiceKeteranganPayload();
    setSaving(true);
    if(isEdit&&orderId){
      ordersApi.update(orderId,{items:payload,pic_name:orderPicName.trim(),...ratesPayload,...ketPayloadDraft,...busOrderApiFields})
        .then(()=>{ showToast('Draft disimpan. Invoice belum diterbitkan.','success'); setSaving(false); })
        .catch((err:any)=>showToast(err.response?.data?.message||'Gagal menyimpan draft','error'))
        .finally(()=>setSaving(false));
    } else {
      const body:Record<string,any>={items:payload,save_as_draft:true,pic_name:orderPicName.trim(),...ratesPayload,...ketPayloadDraft};
      if((!isOwner&&!canPickOwner&&branchId) || (canPickOwner&&ownerInputMode==='manual'&&branchSel)) body.branch_id=(canPickOwner&&ownerInputMode==='manual')?branchSel:branchId;
      if(ownerId&&user?.role!=='owner_mou'&&user?.role!=='owner_non_mou') body.owner_id=ownerId;
      if(canPickOwner&&ownerInputMode==='manual'){
        body.owner_input_mode='manual';
        body.owner_name_manual=manualOwnerName.trim();
        if(manualOwnerPhone.trim()) body.owner_phone_manual=manualOwnerPhone.trim();
      } else if (canPickOwner) {
        body.owner_input_mode='registered';
      }
      Object.assign(body, busOrderApiFields);
      ordersApi.create(body)
        .then((res:any)=>{
          orderDraft.clear();
          showToast('Draft disimpan. Invoice belum diterbitkan. Produk belum berkurang.','success');
          const id=res.data?.data?.id;
          if(id) navigate(`/dashboard/orders/${id}/edit`,{state:{refreshList:true}});
          else navigate('/dashboard/orders-invoices',{state:{refreshList:true}});
        })
        .catch((err:any)=>showToast(err.response?.data?.message||'Gagal menyimpan draft','error'))
        .finally(()=>setSaving(false));
    }
  };

  const handleTerbitkanInvoice=(e?: React.MouseEvent)=>{
    e?.preventDefault();
    if(!orderId) return;
    if (!orderPicName.trim()) {
      showToast('Isi nama PIC invoice sebelum menerbitkan.', 'warning');
      return;
    }
    setSaving(true);
    invoicesApi.create({ order_id: orderId, pic_name: orderPicName.trim(), ...getInvoiceKeteranganPayload() })
      .then(()=>{ showToast('Invoice diterbitkan.','success'); navigate('/dashboard/orders-invoices',{state:{refreshList:true}}); })
      .catch((err:any)=>showToast(err.response?.data?.message||'Gagal menerbitkan invoice','error'))
      .finally(()=>setSaving(false));
  };

  const isDraftNoInvoice=isEdit&&order?.status==='draft'&&!order?.Invoice;

  const typeOf=(id:string)=>ITEM_TYPES.find(t=>t.id===id)??ITEM_TYPES[0];

  if(loadingOrd&&isEdit) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <ContentLoading minHeight={300} />
    </div>
  );

  return (
    <div className="min-h-full w-full bg-slate-50/60">
      <div className="w-full px-1 sm:px-2 pt-0 pb-4 -mt-4">
        <PageHeader
          title={isEdit ? 'Perbarui invoice' : 'Buat invoice baru'}
          subtitle={isEdit ? 'Edit item dan simpan' : 'Isi item pemesanan lalu simpan'}
          leftAddon={
            <button
              type="button"
              onClick={()=>navigate('/dashboard/orders-invoices?tab=invoices')}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-[#0D1A63]/50 hover:text-[#0D1A63] shadow-sm transition-all shrink-0"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          }
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D1A63] text-white text-sm">
                <span className="text-xs opacity-90">Total</span>
                <NominalDisplay amount={totalSAR} currency="SAR" className="font-bold tabular-nums" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm">
                <span className="text-xs text-slate-500">IDR</span>
                <NominalDisplay amount={totalIDR} currency="IDR" className="font-semibold tabular-nums" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm">
                <span className="text-xs text-slate-500">USD</span>
                <NominalDisplay amount={totalIDR/(effectiveRates.USD_TO_IDR||15500)} currency="USD" className="font-semibold tabular-nums" />
              </div>
              {totalPax>0&&(
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold tabular-nums">{totalPax}</span>
                  <span className="text-xs text-slate-500">Jamaah</span>
                </div>
              )}
            </div>
          }
          className="mb-4"
        />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Kota */}
        {!isEdit&&!isOwner&&!canPickOwner&&branches.length>0&&(
          <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#0D1A63]/10 text-[#0D1A63]">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Kota</h2>
                <p className="text-xs text-slate-500">Pilih kota untuk order ini</p>
              </div>
            </div>
            <div className="p-4">
              <Autocomplete label="Kota" value={branchSel} onChange={v=>{setBranchSel(v);setOwnerSel('');}} options={branches.map(b=>({ value: b.id, label: `${b.name} (${b.code})` }))} placeholder={AUTOCOMPLETE_PILIH.PILIH_CABANG} emptyLabel={AUTOCOMPLETE_PILIH.PILIH_CABANG} />
            </div>
          </section>
        )}

        {/* Tipe Owner (saat login sebagai owner) */}
        {isOwner && ownerMeProfile && (
          <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#0D1A63]/10 text-[#0D1A63]">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900 text-sm">Tipe Owner</h2>
                <p className="text-xs text-slate-500">Harga produk mengikuti tipe akun Anda</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-medium ${ownerMeProfile.is_mou_owner ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                {ownerMeProfile.is_mou_owner ? 'Owner MOU' : 'Non-MOU'}
              </span>
            </div>
          </section>
        )}

        {/* Owner */}
        {canPickOwner&&(
          <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#0D1A63]/10 text-[#0D1A63]">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Owner</h2>
                <p className="text-xs text-slate-500">Order & kota mengikuti owner yang dipilih</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <Autocomplete
                label="Sumber owner"
                value={ownerInputMode}
                onChange={(v)=>setOwnerInputMode((v as OwnerInputMode) || 'registered')}
                options={[
                  { value: 'registered', label: 'Owner terdaftar (punya akun)' },
                  { value: 'manual', label: 'Owner tanpa akun (input manual)' }
                ]}
                emptyLabel="Pilih sumber owner"
              />
              {ownerInputMode === 'registered' ? (
                <>
                  <Autocomplete label="Owner" value={ownerSel} onChange={setOwnerSel} options={owners.map(o=>{ const uid2=o.User?.id??o.user_id; const lbl=o.User?.company_name||o.User?.name||uid2; return { value: uid2, label: lbl }; })} placeholder={AUTOCOMPLETE_PILIH.PILIH_OWNER} emptyLabel={AUTOCOMPLETE_PILIH.PILIH_OWNER} />
                  {ownerProf && (
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium ${ownerProf.is_mou_owner ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {ownerProf.is_mou_owner ? 'Owner MOU' : 'Non-MOU'}
                      </span>
                      {ownerProf.is_mou_owner && <span className="text-slate-500">Harga produk diskon sesuai setting</span>}
                    </p>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Nama owner (tanpa akun)" type="text" value={manualOwnerName} onChange={(e)=>setManualOwnerName(e.target.value)} placeholder="Contoh: PT ABC Travel" />
                  <Input label="No HP owner (opsional)" type="text" value={manualOwnerPhone} onChange={(e)=>setManualOwnerPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
                  <div className="sm:col-span-2">
                    <Autocomplete
                      label="Kota / kabupaten (wajib)"
                      value={manualKabupatenId}
                      onChange={(v) => {
                        setManualKabupatenId(v);
                        const kab = kabupatenMaster.find((k) => String(k.id) === String(v));
                        setManualWilayahId(kab?.wilayah_id ? String(kab.wilayah_id) : '');
                        if (!v) setBranchSel('');
                      }}
                      options={kabupatenOptions.map((k) => ({ value: String(k.id), label: `${k.nama} (${k.kode})` }))}
                      placeholder={kabupatenLoading ? 'Memuat daftar kabupaten…' : 'Cari & pilih kabupaten/kota'}
                      emptyLabel="Pilih kota/kabupaten"
                      disabled={kabupatenLoading}
                    />
                    {kabupatenLoading && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        Memuat daftar kabupaten dari server…
                      </p>
                    )}
                    {!kabupatenLoading && kabupatenFetchError && kabupatenOptions.length === 0 && (
                      <p className="text-xs text-amber-700 mt-1">
                        Daftar kabupaten kosong atau gagal dimuat. Periksa koneksi, refresh halaman, atau pastikan master kabupaten sudah diisi di server (npm run seed:kabupaten).
                      </p>
                    )}
                    {!kabupatenLoading && !kabupatenFetchError && (
                      <p className="text-xs text-slate-500 mt-1">
                        {user?.wilayah_id && ['invoice_koordinator', 'invoice_saudi'].includes(user?.role ?? '')
                          ? 'Daftar kabupaten sesuai wilayah Anda (dari server). Provinsi & wilayah terisi otomatis setelah memilih kabupaten.'
                          : 'Provinsi & wilayah (master) terisi otomatis setelah memilih kabupaten.'}
                      </p>
                    )}
                  </div>
                  <Input
                    label="Provinsi (otomatis dari kota)"
                    type="text"
                    value={selectedManualKab?.provinsi_nama ?? ''}
                    onChange={() => {}}
                    readOnly
                    placeholder="—"
                  />
                  <Input
                    label="Wilayah — master (otomatis dari kota)"
                    type="text"
                    value={selectedManualKab?.wilayah_nama ?? ''}
                    onChange={() => {}}
                    readOnly
                    placeholder="—"
                  />
                  <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Kota owner (otomatis)</p>
                    {branchSel && branches.find((b) => b.id === branchSel) ? (
                      <p className="text-sm text-slate-800">
                        {(branches.find((b) => b.id === branchSel)?.name ?? '')}{' '}
                        <span className="text-slate-500">({branches.find((b) => b.id === branchSel)?.code})</span>
                      </p>
                    ) : manualKabupatenId ? (
                      <p className="text-sm text-amber-700">Belum ada kota dengan kode sama kode kabupaten ini. Hubungi admin pusat untuk master kota.</p>
                    ) : (
                      <p className="text-sm text-slate-500">Pilih kota/kabupaten — kota operasional mengikuti kode kabupaten di master.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* PIC invoice */}
        <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#0D1A63]/10 text-[#0D1A63]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">PIC invoice</h2>
              <p className="text-xs text-slate-500">Nama penanggung jawab invoice (wajib)</p>
            </div>
          </div>
          <div className="p-4">
            <Input
              label="Nama PIC *"
              type="text"
              value={orderPicName}
              onChange={(e) => setOrderPicName(e.target.value)}
              placeholder="Nama lengkap PIC"
              required
            />
          </div>
        </section>

        {/* Item Pemesanan */}
        <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#0D1A63]/10 text-[#0D1A63]">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Item Pemesanan</h2>
                <p className="text-xs text-slate-500">Tarik ikon ⋮⋮ untuk ubah urutan</p>
              </div>
            </div>
            {canEditPrice&&(
              <p className="text-xs text-slate-500">Mata uang & kurs di bagian Kurs bawah.</p>
            )}
          </div>
          <div className="p-4 space-y-4">
              {loadingProd ? (
                <div className="flex items-center gap-2 py-3 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0D1A63]" /> {CONTENT_LOADING_MESSAGE}
                </div>
              ) : (
                <>
                  {items.map((row, index)=>{
                    const tc=typeOf(row.type);
                    const hProd=row.type==='hotel'?byType('hotel').find(p=>p.id===row.product_id):undefined;
                    const isPerPackHotel = !!(hProd && hotelRoomPricingMode(hProd) === 'per_pack');
                    const fullboardRow = !!(hProd && isFullboardHotelForRow(hProd, row));
                    return (
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
                        onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
                        onDrop={(e)=>{
                          e.preventDefault();
                          const from=parseInt(e.dataTransfer.getData('text/plain'),10);
                          if (!Number.isNaN(from)) moveItem(from, index);
                        }}
                      >
                        {/* Baris item: header Tipe & Produk — warna sama dengan button (biru dongker) */}
                        <div className="flex flex-wrap items-end gap-2 p-3 bg-[#0D1A63] border-b border-white/20 [&_label]:text-white [&_p]:text-white">
                          <div
                            draggable
                            onDragStart={(e)=>{ e.dataTransfer.setData('text/plain', String(index)); e.dataTransfer.effectAllowed='move'; }}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 border border-white/30 text-white cursor-grab active:cursor-grabbing hover:bg-white/30 shrink-0"
                            title="Tarik untuk pindah urutan"
                          >
                            <GripVertical size={16}/>
                          </div>
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 border border-white/30 text-white shrink-0">
                            <tc.Icon size={16}/>
                          </div>
                          <div className="min-w-[90px] flex-1 sm:flex-initial sm:w-[120px]">
                            <Autocomplete label="Tipe" value={row.type} onChange={v=>updateRow(row.id,{type:v as ItemType})} options={(availableItemTypes.some(t=>t.id===row.type) ? availableItemTypes : [...availableItemTypes, ITEM_TYPES.find(t=>t.id===row.type)!].filter(Boolean)).map(t=>({value:t.id,label:t.label}))} emptyLabel="— Pilih tipe —" />
                          </div>
                          {row.type==='hotel' && (
                            <div className="min-w-[100px] flex-1 sm:flex-initial sm:w-[120px]">
                              <Autocomplete
                                label="Lokasi"
                                value={(row.meta?.hotel_location as string) ?? ''}
                                onChange={v=>{
                                  const loc = v || undefined;
                                  const nextMeta = { ...row.meta, hotel_location: loc };
                                  const currentProd = row.product_id ? products.find(x=>x.id===row.product_id) : null;
                                  const prodLocation = currentProd ? (currentProd.meta as { location?: string })?.location : null;
                                  const clearProduct = loc && prodLocation && prodLocation !== loc;
                                  updateRow(row.id, { meta: nextMeta, ...(clearProduct ? { product_id: '', product_name: '', unit_price: 0 } : {}) });
                                }}
                                options={HOTEL_LOCATION_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                                emptyLabel=""
                              />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 basis-40">
                            <Autocomplete
                              label="Produk"
                              value={row.product_id}
                              onChange={v=>{ const list = productListForRow(row); const p=list.find(x=>x.id===v); updateRow(row.id,{product_id:v,product_name:p?.name??'',unit_price:p?effP(p):0}); }}
                              options={productListForRow(row).map(p=>({value:p.id,label:`${p.name} (${p.code})`}))}
                              emptyLabel={row.type==='hotel' && !row.meta?.hotel_location ? "— Pilih lokasi dulu —" : row.type==='bus' ? "— Hanya Hiace —" : "— Pilih produk —"}
                            />
                          </div>
                          {canEditPrice && (
                            <div className="min-w-[80px] flex-1 sm:flex-initial sm:w-[100px]">
                              <Autocomplete label="Mata uang" value={row.price_currency ?? getDisplayCurrency(row.type, products.find(x=>x.id===row.product_id))} onChange={v=>updateRow(row.id,{ price_currency: (v==='' ? undefined : v) as DisplayCurrency })} options={currencyOptionsFromProducts} />
                            </div>
                          )}
                          <div className="text-right min-w-[80px] shrink-0 text-white">
                            <p className="text-xs font-medium uppercase tracking-wide opacity-90">Subtotal</p>
                            <p className="text-sm font-bold tabular-nums"><NominalDisplay {...nominalInRowCur(row,rowSub(row))} /></p>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={()=>removeRow(row.id)} aria-label="Hapus item" className="text-white/90 hover:text-white hover:bg-white/20 w-8 h-8 min-w-[32px] min-h-[32px] p-0 rounded-lg shrink-0 self-end inline-flex items-center justify-center">
                            <Trash2 size={16} className="shrink-0"/>
                          </Button>
                        </div>
                        {/* Body: hotel (tanggal + room lines) atau non-hotel */}
                        <div className="p-3 space-y-3">
                          {row.type==='hotel' ? (
                            <>
                              <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tanggal menginap</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {(() => {
                                    const stayMode = hotelStayDateModeForRow(row);
                                    const stayMonthYear = hotelStayMonthYearForRow(row);
                                    const monthOptions = [
                                      { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' }, { value: '3', label: 'Maret' },
                                      { value: '4', label: 'April' }, { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
                                      { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' }, { value: '9', label: 'September' },
                                      { value: '10', label: 'Oktober' }, { value: '11', label: 'November' }, { value: '12', label: 'Desember' }
                                    ];
                                    const thisYear = new Date().getFullYear();
                                    const yearOptions = Array.from({ length: 8 }, (_, i) => String(thisYear + i - 1));
                                    return (
                                      <>
                                        <div className="min-w-0 sm:col-span-2">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <button
                                              type="button"
                                              onClick={() => updateRow(row.id, { meta: { ...(row.meta || {}), hotel_stay_date_mode: 'dated' } })}
                                              className={`text-left rounded-xl p-3 border text-sm transition-all ${stayMode === 'dated' ? 'border-[#0D1A63]/40 ring-2 ring-[#0D1A63]/20 bg-[#0D1A63]/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                            >
                                              Sudah ada tanggal
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => updateRow(row.id, { check_in: undefined, check_out: undefined, meta: { ...(row.meta || {}), hotel_stay_date_mode: 'month_year' } })}
                                              className={`text-left rounded-xl p-3 border text-sm transition-all ${stayMode === 'month_year' ? 'border-[#0D1A63]/40 ring-2 ring-[#0D1A63]/20 bg-[#0D1A63]/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                            >
                                              Belum ada tanggal (bulan & tahun)
                                            </button>
                                          </div>
                                        </div>
                                        {stayMode === 'dated' ? (
                                          <>
                                            <div className="min-w-0">
                                              <Input label="Check-in" type="date" value={row.check_in ?? ''} onChange={e => updateRow(row.id, { check_in: e.target.value || undefined })} />
                                              <p className="text-xs text-slate-400 mt-1">Jam 16:00</p>
                                            </div>
                                            <div className="min-w-0">
                                              <Input label="Check-out" type="date" value={row.check_out ?? ''} onChange={e => updateRow(row.id, { check_out: e.target.value || undefined })} />
                                              <p className="text-xs text-slate-400 mt-1">Jam 12:00</p>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="min-w-0">
                                              <Autocomplete
                                                label="Check-in (bulan)"
                                                value={stayMonthYear.checkInMonth ? String(stayMonthYear.checkInMonth) : ''}
                                                onChange={(v) => {
                                                  const nextMonth = Number(v || 0);
                                                  updateRow(row.id, { meta: { ...(row.meta || {}), hotel_stay_date_mode: 'month_year', hotel_stay_check_in_month: nextMonth || undefined } });
                                                }}
                                                options={monthOptions}
                                                emptyLabel="— Pilih bulan —"
                                              />
                                            </div>
                                            <div className="min-w-0">
                                              <Autocomplete
                                                label="Check-in (tahun)"
                                                value={stayMonthYear.checkInYear ? String(stayMonthYear.checkInYear) : ''}
                                                onChange={(v) => {
                                                  const nextYear = Number(v || 0);
                                                  updateRow(row.id, { meta: { ...(row.meta || {}), hotel_stay_date_mode: 'month_year', hotel_stay_check_in_year: nextYear || undefined } });
                                                }}
                                                options={yearOptions.map((y) => ({ value: y, label: y }))}
                                                emptyLabel="— Pilih tahun —"
                                              />
                                            </div>
                                            <div className="min-w-0">
                                              <Autocomplete
                                                label="Check-out (bulan)"
                                                value={stayMonthYear.checkOutMonth ? String(stayMonthYear.checkOutMonth) : ''}
                                                onChange={(v) => {
                                                  const nextMonth = Number(v || 0);
                                                  updateRow(row.id, { meta: { ...(row.meta || {}), hotel_stay_date_mode: 'month_year', hotel_stay_check_out_month: nextMonth || undefined } });
                                                }}
                                                options={monthOptions}
                                                emptyLabel="— Pilih bulan —"
                                              />
                                            </div>
                                            <div className="min-w-0">
                                              <Autocomplete
                                                label="Check-out (tahun)"
                                                value={stayMonthYear.checkOutYear ? String(stayMonthYear.checkOutYear) : ''}
                                                onChange={(v) => {
                                                  const nextYear = Number(v || 0);
                                                  updateRow(row.id, { meta: { ...(row.meta || {}), hotel_stay_date_mode: 'month_year', hotel_stay_check_out_year: nextYear || undefined } });
                                                }}
                                                options={yearOptions.map((y) => ({ value: y, label: y }))}
                                                emptyLabel="— Pilih tahun —"
                                              />
                                            </div>
                                            <div className="min-w-0 sm:col-span-2">
                                              <Autocomplete
                                                label="Malam"
                                                value={stayMonthYear.nights ? String(stayMonthYear.nights) : ''}
                                                onChange={(v) => {
                                                  const nextNights = Number(v || 0);
                                                  updateRow(row.id, { meta: { ...(row.meta || {}), hotel_stay_date_mode: 'month_year', hotel_stay_nights: nextNights || undefined } });
                                                }}
                                                options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} malam` }))}
                                                emptyLabel="— Pilih malam —"
                                              />
                                            </div>
                                          </>
                                        )}
                                      </>
                                    );
                                  })()}
                                  <div className="min-w-0 sm:col-span-2">
                                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
                                      Sumber harga hotel: <span className="font-semibold text-slate-900">{hotelPriceMode(row) === 'mou' ? 'MOU' : 'Non-MOU'}</span>
                                      <span className="block text-xs text-slate-500 mt-1">Otomatis mengikuti owner yang dipilih / owner yang login.</span>
                                    </div>
                                  </div>
                                  {hotelStayDateModeForRow(row) === 'dated' && row.check_in && row.check_out && (
                                    <div className="flex items-center gap-2 py-2.5 px-4 rounded-lg bg-slate-100 border border-slate-200/80 text-sm font-medium text-slate-700 col-span-full">
                                      <span>Malam:</span>
                                      <span className="tabular-nums font-semibold text-slate-900">{getNights(row.check_in, row.check_out)}</span>
                                      {getNights(row.check_in, row.check_out) === 0 && <span className="text-amber-600 text-xs">(Check-out &gt; Check-in)</span>}
                                    </div>
                                  )}
                                  {hotelStayDateModeForRow(row) === 'month_year' && !!hotelStayMonthYearForRow(row).nights && (
                                    <div className="flex items-center gap-2 py-2.5 px-4 rounded-lg bg-slate-100 border border-slate-200/80 text-sm font-medium text-slate-700 col-span-full">
                                      <span>Malam:</span>
                                      <span className="tabular-nums font-semibold text-slate-900">{hotelStayMonthYearForRow(row).nights}</span>
                                    </div>
                                  )}
                                  {row.product_id && row.check_in && row.check_out && (
                                    <div className="col-span-full text-left">
                                      {hotelAvailability[row.id] === 'loading' && (
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                          <Loader2 className="w-4 h-4 animate-spin shrink-0"/>
                                          <span>{CONTENT_LOADING_MESSAGE}</span>
                                        </div>
                                      )}
                                      {hotelAvailability[row.id] && typeof hotelAvailability[row.id] === 'object' && (
                                        <div>
                                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tersedia</p>
                                          <div className="flex flex-wrap gap-2">
                                            {Object.entries((hotelAvailability[row.id] as { byRoomType: Record<string, number> }).byRoomType)
                                              .filter(([, n]) => n > 0)
                                              .map(([rt, n]) => (
                                                <span key={rt} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200/80 text-sm font-medium text-slate-700 capitalize">
                                                  {rt}{isPerPackHotel ? ' (pack)' : ''} <span className="ml-1.5 font-semibold tabular-nums text-slate-900">{n.toLocaleString('id-ID')}</span>
                                                </span>
                                              ))}
                                            {Object.entries((hotelAvailability[row.id] as { byRoomType: Record<string, number> }).byRoomType).filter(([, n]) => n > 0).length === 0 && (
                                              <span className="text-sm text-slate-500">—</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {!isPerPackHotel && (() => {
                                const mode = ((row.meta?.hotel_room_input_mode as HotelRoomInputMode) || 'manual') as HotelRoomInputMode;
                                const pax = Number(row.meta?.hotel_pax ?? 0) || 0;
                                const paxVal = Math.max(0, Math.floor(pax || 0));
                                return (
                                  <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">Input kamar</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Pilih cara input kamar: manual atau otomatis berdasarkan jumlah orang.</p>
                                      </div>
                                      {mode === 'pax' && paxVal > 0 && (
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                                          Auto aktif
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <button
                                        type="button"
                                        onClick={() => updateRow(row.id, { meta: { ...(row.meta || {}), hotel_room_input_mode: 'manual', hotel_pax: undefined } })}
                                        className={`text-left rounded-2xl p-4 border transition-all ${
                                          mode === 'manual'
                                            ? 'border-[#0D1A63]/40 ring-2 ring-[#0D1A63]/20 bg-[#0D1A63]/5'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        <p className="text-sm font-semibold text-slate-900">Pilih tipe kamar</p>
                                        <p className="text-xs text-slate-500 mt-1">Anda tentukan sendiri tipe kamar & jumlahnya.</p>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextPax = Math.max(0, Math.floor(rowPax(row) || paxVal || 0));
                                          updateRow(row.id, { meta: { ...(row.meta || {}), hotel_room_input_mode: 'pax', hotel_pax: nextPax } });
                                          if (nextPax > 0) applyAutoHotelRooms(row.id, nextPax);
                                        }}
                                        className={`text-left rounded-2xl p-4 border transition-all ${
                                          mode === 'pax'
                                            ? 'border-[#0D1A63]/40 ring-2 ring-[#0D1A63]/20 bg-[#0D1A63]/5'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        <p className="text-sm font-semibold text-slate-900">Masukkan jumlah orang</p>
                                        <p className="text-xs text-slate-500 mt-1">Sistem otomatis memilih kombinasi kamar terbaik.</p>
                                      </button>
                                    </div>

                                    {mode === 'pax' && (
                                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                        <div className="sm:col-span-1">
                                          <Input
                                            label="Jumlah orang"
                                            type="number"
                                            min={0}
                                            value={String(paxVal)}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              const n = v === '' ? 0 : Math.max(0, Math.floor(parseInt(v, 10) || 0));
                                              updateRow(row.id, { meta: { ...(row.meta || {}), hotel_room_input_mode: 'pax', hotel_pax: n } });
                                              if (n > 0) applyAutoHotelRooms(row.id, n);
                                            }}
                                          />
                                        </div>
                                        <div className="sm:col-span-2">
                                          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
                                            Sistem akan otomatis memilih kombinasi kamar terbaik
                                            {hotelAvailability[row.id] && typeof hotelAvailability[row.id] === 'object' ? ' (sesuai ketersediaan)' : ''}.
                                            {paxVal === 0 && <span className="block text-xs text-slate-500 mt-1">Isi jumlah orang untuk menampilkan rekomendasi tipe kamar.</span>}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              {(() => {
                                const mode = ((row.meta?.hotel_room_input_mode as HotelRoomInputMode) || 'manual') as HotelRoomInputMode;
                                const paxVal = Math.max(0, Math.floor(Number(row.meta?.hotel_pax ?? 0) || 0));
                                const showRoomLines = isPerPackHotel
                                  ? !!(row.product_id && (row.room_breakdown?.length ?? 0) > 0)
                                  : (mode === 'manual' || (mode === 'pax' && paxVal > 0));
                                if (!showRoomLines) return null;
                                return (
                                  <>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                      {`Tipe kamar, jumlah & harga (${hotelRoomPricingLabel(hProd)})`}
                                    </p>
                                    {(row.room_breakdown||[]).map(line=>(
                                      <div key={line.id} className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
                                        {(() => {
                                          const locked = !isPerPackHotel && mode === 'pax';
                                          const rowPaxTotal = rowPax(row);
                                          return (
                                            <>
                                  <>
                                  <div className="min-w-[100px] flex-1 sm:max-w-[140px]">
                                    <Autocomplete label="Tipe Kamar" value={line.room_type ?? ''} onChange={v=>{ if(locked) return; const rt=v as RoomTypeId|''; const cur=rowCur(row); const fullboard=fullboardRow; const withMeal=fullboard?true:(line.with_meal??false); const roomOnlySar=hotelRoomUnitSar(hProd,rt,row.check_in,row); const unitP=rt?toCurrencyFromSAR(roomOnlySar,cur):0; const mealP=withMeal&&!fullboard&&rt?toCurrencyFromSAR(getMealPriceSar(hProd,row.check_in,row),cur):0; updLine(row.id,line.id,{room_type:rt,unit_price:unitP,meal_unit_price:mealP,with_meal:withMeal}); }} options={(()=>{ const rb=hProd?.room_breakdown??hProd?.prices_by_room??{}; const ids=Object.keys(rb); return ids.map(id=>({ value: id, label: `${ROOM_TYPES.find(rt=>rt.id===id)?.label ?? id} · ${ROOM_TYPES.find(rt=>rt.id===id)?.cap ?? 0}` })); })()} emptyLabel="— Pilih —" />
                                  </div>
                                  <div className="w-24 min-w-[72px]">
                                    <Input label={isPerPackHotel ? 'Jumlah pack' : 'Jumlah'} type="number" min={0} value={line.quantity === undefined || line.quantity === null ? '' : String(line.quantity)} onChange={e=>{ if(locked) return; const v=e.target.value; if(v===''){updLine(row.id,line.id,{quantity:0});return;} const n=parseInt(v,10); if(!isNaN(n)&&n>=0) updLine(row.id,line.id,{quantity:n}); }} />
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-500 text-sm pb-2.5">
                                    {isPerPackHotel ? (
                                      <>
                                        <Package size={14} className="text-slate-400 shrink-0" />
                                        <span>Per pack</span>
                                      </>
                                    ) : (
                                      <>
                                        <Users size={14} className="text-slate-400 shrink-0" />
                                        <span>{Math.max(0,line.quantity)*rCap(line.room_type||undefined)} jamaah</span>
                                      </>
                                    )}
                                  </div>
                                  {fullboardRow ? (
                                    <span
                                      className="inline-flex items-center justify-center shrink-0 h-12 box-border px-3 rounded-xl border-2 border-slate-200 bg-slate-100 text-xs font-medium text-slate-600 text-center leading-tight max-w-[11rem]"
                                      title="Fullboard"
                                    >
                                      Fullboard 
                                    </span>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant={line.with_meal ? 'primary' : 'outline'}
                                      size="sm"
                                      className="rounded-xl !py-0 h-12 shrink-0 box-border px-4 text-sm font-semibold leading-none"
                                      onClick={() => {
                                        const nextWithMeal = !(line.with_meal ?? false);
                                        updLine(row.id, line.id, {
                                          with_meal: nextWithMeal,
                                          meal_unit_price: nextWithMeal ? toCurrencyFromSAR(getMealPriceSar(hProd, row.check_in, row), rowCur(row)) : 0
                                        });
                                      }}
                                    >
                                      <Utensils size={14} className="mr-1.5 shrink-0" />
                                      Makan
                                    </Button>
                                  )}
                                  </>
                                  <div className="flex-1 min-w-[100px]">
                                    {canEditPrice ? (
                                      <Input label={`${isPerPackHotel ? 'Harga per pack / malam' : 'Harga kamar / malam'} (${rowCur(row)})`} type="number" min={0}
                                        value={(()=>{
                                          // Pakai nilai tersimpan hanya jika > 0; 0 berarti belum terisi dari quote/grid — tampilkan harga efektif agar konsisten dengan hitungan.
                                          const roomRaw = typeof line.unit_price === 'number' && line.unit_price > 0 ? line.unit_price : getEffectiveRoomPrice(row,line);
                                          const val=getInC(roomRaw,row,rowCur(row));
                                          return String(Math.round(val*100)/100||'');
                                        })()}
                                        placeholder="0"
                                        onChange={e=>setLP(row.id,line.id,rowCur(row),parseFloat(e.target.value)||0)}/>
                                    ) : (
                                      <>
                                        <label className={labelClass}>{isPerPackHotel ? 'Harga per pack / malam' : 'Harga kamar / malam'}</label>
                                        <p className="text-sm font-bold text-slate-900 tabular-nums"><NominalDisplay {...nominalInRowCur(row,getEffectiveRoomPrice(row,line))} /></p>
                                      </>
                                    )}
                                  </div>
                                  {!fullboardRow && (
                                  <div className="flex-1 min-w-[120px]">
                                    {canEditPrice ? (
                                      line.with_meal ? (
                                        <Input label={`Harga makan / malam (${rowCur(row)})`} type="number" min={0}
                                          value={(()=>{
                                            const mealRaw = typeof line.meal_unit_price === 'number' && line.meal_unit_price > 0 ? line.meal_unit_price : getEffectiveMealPrice(row,line);
                                            const val=getInC(mealRaw,row,rowCur(row));
                                            return String(Math.round(val*100)/100||'');
                                          })()}
                                          placeholder="0"
                                          onChange={e=>setMealLP(row.id,line.id,rowCur(row),parseFloat(e.target.value)||0)}/>
                                      ) : (
                                        <>
                                          <span className={labelClass}>Harga makan / malam ({rowCur(row)})</span>
                                          <p className="text-sm text-slate-500 py-2">— Aktifkan Makan</p>
                                        </>
                                      )
                                    ) : (
                                      <>
                                        <label className={labelClass}>Harga makan / malam</label>
                                        <p className="text-sm font-bold text-slate-900 tabular-nums">{line.with_meal ? <NominalDisplay {...nominalInRowCur(row,getEffectiveMealPrice(row,line))} /> : '—'}</p>
                                      </>
                                    )}
                                  </div>
                                  )}
                                  <div className="text-right min-w-[90px] shrink-0">
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Subtotal</p>
                                    {(()=>{
                                      const nights=nightsFor(row)||0;
                                      const pricePerNight=getEffectiveLinePrice(row,line);
                                      const qty=Math.max(0,line.quantity);
                                      const total=qty*pricePerNight*nights;
                                      if(nights>0){
                                        return <p className="text-sm font-bold text-slate-900 tabular-nums"><NominalDisplay {...nominalInRowCur(row,total)} /></p>;
                                      }
                                      const perNightLabel=<><NominalDisplay {...nominalInRowCur(row,qty*pricePerNight)} suffix="/malam" /></>;
                                      return <><p className="text-sm font-bold text-slate-900 tabular-nums">{perNightLabel}</p><p className="text-xs text-slate-500 mt-0.5">Isi check-in & check-out untuk total</p></>;
                                    })()}
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" onClick={()=>{ if(locked) return; removeLine(row.id,line.id); }} className="text-slate-500 hover:text-red-600">
                                    <Trash2 size={14}/>
                                  </Button>
                                  {locked && rowPaxTotal > 0 && (
                                    <span className="text-xs text-slate-400 pb-2.5">Auto</span>
                                  )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    ))}
                                  </>
                                );
                              })()}
                              {(() => {
                                const mode = ((row.meta?.hotel_room_input_mode as HotelRoomInputMode) || 'manual') as HotelRoomInputMode;
                                const paxVal = Math.max(0, Math.floor(Number(row.meta?.hotel_pax ?? 0) || 0));
                                const showHitung = isPerPackHotel
                                  ? !!(row.product_id && (row.room_breakdown?.length ?? 0) > 0)
                                  : (mode === 'manual' || (mode === 'pax' && paxVal > 0));
                                if (!showHitung) return null;
                                if ((row.room_breakdown?.length ?? 0) === 0 || nightsFor(row) <= 0) return null;
                                return (
                                <div className="rounded-lg bg-slate-100/80 border border-slate-200 p-3 text-sm text-slate-700 space-y-1">
                                  <p className="font-semibold text-slate-800 text-xs">
                                    {isPerPackHotel ? 'Hitungan (harga/malam × malam × pack)' : 'Hitungan (harga/malam × malam × kamar)'}
                                  </p>
                                  {(row.room_breakdown||[]).filter((l) => hotelLineQuantityValid(row, l)).map(line=>{
                                    const nights = nightsFor(row);
                                    const roomPerNight = getEffectiveRoomPrice(row, line);
                                    const mealPerNight = getEffectiveMealPrice(row, line);
                                    const lineTotalRoom = roomPerNight * line.quantity * nights;
                                    const lineTotalMeal = mealPerNight * line.quantity * nights;
                                    const effLineRt = effectiveHotelLineRoomType(row, line);
                                    const roomLabel = ROOM_TYPES.find(t=>t.id===effLineRt)?.label ?? effLineRt;
                                    return (
                                      <div key={line.id} className="pl-2 border-l-2 border-slate-300">
                                        <p className="tabular-nums">
                                          {isPerPackHotel ? (
                                            <>Per pack: <NominalDisplay {...nominalInRowCur(row,roomPerNight)} suffix="/malam" /> × {nights} malam × {line.quantity} pack = <NominalDisplay {...nominalInRowCur(row,lineTotalRoom)} /></>
                                          ) : (
                                            <>Kamar {roomLabel}: <NominalDisplay {...nominalInRowCur(row,roomPerNight)} suffix="/malam" /> × {nights} malam × {line.quantity} kamar = <NominalDisplay {...nominalInRowCur(row,lineTotalRoom)} /></>
                                          )}
                                        </p>
                                        {!fullboardRow && line.with_meal && <p className="tabular-nums text-slate-600">Makan: <NominalDisplay {...nominalInRowCur(row,mealPerNight)} suffix="/malam" /> × {nights} malam × {line.quantity} {isPerPackHotel ? 'pack' : 'kamar'} = <NominalDisplay {...nominalInRowCur(row,lineTotalMeal)} /></p>}
                                      </div>
                                    );
                                  })}
                                </div>
                                );
                              })()}
                              {((!isPerPackHotel && (((row.meta?.hotel_room_input_mode as HotelRoomInputMode) || 'manual') as HotelRoomInputMode) === 'manual')
                                || isPerPackHotel) && (
                                <Button type="button" variant="outline" size="sm" onClick={()=>addLine(row.id)} className="w-full border-2 border-dashed border-slate-200 rounded-lg text-slate-600 hover:border-[#0D1A63]/50 hover:bg-[#0D1A63]/5 text-sm py-2">
                                  <Plus size={14} className="mr-1"/> Tambah tipe kamar
                                </Button>
                              )}
                            </>
                          ) : (
                            <div className="rounded-lg bg-slate-50/60 border border-slate-100 p-3 space-y-4">
                              {row.type === 'ticket' && (() => {
                                const ticketProduct = products.find((p: ProductOption) => p.type === 'ticket' && p.id === row.product_id);
                                const tripType: TicketTripType =
                                  (ticketProduct?.meta?.trip_type as TicketTripType) || (row.meta?.trip_type as TicketTripType) || 'round_trip';
                                const priceCol = canEditPrice ? (
                                  <div className="min-w-0 xl:col-span-3">
                                    <Input
                                      label={`Harga Satuan (${rowCur(row)})`}
                                      type="number"
                                      min={0}
                                      value={(() => {
                                        const val = getInC(row.unit_price || 0, row, rowCur(row));
                                        return String(Math.round(val * 100) / 100 || '');
                                      })()}
                                      placeholder="0"
                                      onChange={(e) => setRP(row.id, rowCur(row), parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                ) : (
                                  <div className="min-w-0 xl:col-span-3">
                                    <label className={labelClass}>{`Harga Satuan (${rowCur(row)})`}</label>
                                    <p className="text-sm font-bold text-slate-900 tabular-nums">
                                      <NominalDisplay {...nominalInRowCur(row, row.unit_price || 0)} />
                                    </p>
                                  </div>
                                );
                                const qtyCol = (
                                  <div className="min-w-0 xl:col-span-2">
                                    <Input
                                      label="Qty"
                                      type="number"
                                      min={0}
                                      value={row.quantity === undefined || row.quantity === null ? '' : String(row.quantity)}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '') {
                                          updateRow(row.id, { quantity: 0 });
                                          return;
                                        }
                                        const n = parseInt(v, 10);
                                        if (!isNaN(n) && n >= 0) updateRow(row.id, { quantity: n });
                                      }}
                                    />
                                  </div>
                                );
                                return (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3">
                                    <div className="min-w-0 xl:col-span-2">
                                      <Autocomplete
                                        label="Bandara"
                                        value={(row.meta?.bandara as string) || ''}
                                        onChange={(v) => {
                                          updateRow(row.id, { meta: { ...(row.meta || {}), bandara: v } });
                                        }}
                                        options={(ticketProduct?.bandara_options ?? []).map((b) => ({
                                          value: b.bandara,
                                          label: `${b.name} (${b.bandara})`
                                        }))}
                                        emptyLabel="— Pilih bandara —"
                                      />
                                    </div>
                                    {tripType === 'round_trip' && (
                                      <>
                                        <div className="min-w-0 xl:col-span-2">
                                          <Input
                                            label="Tanggal pergi"
                                            type="date"
                                            value={(row.meta?.departure_date as string) ?? ''}
                                            onChange={(e) =>
                                              updateRow(row.id, { meta: { ...(row.meta || {}), departure_date: e.target.value || undefined } })
                                            }
                                          />
                                        </div>
                                        <div className="min-w-0 xl:col-span-2">
                                          <Input
                                            label="Tanggal pulang"
                                            type="date"
                                            value={(row.meta?.return_date as string) ?? ''}
                                            onChange={(e) =>
                                              updateRow(row.id, { meta: { ...(row.meta || {}), return_date: e.target.value || undefined } })
                                            }
                                          />
                                        </div>
                                      </>
                                    )}
                                    {tripType === 'one_way' && (
                                      <div className="min-w-0 xl:col-span-3">
                                        <Input
                                          label="Tanggal pergi"
                                          type="date"
                                          value={(row.meta?.departure_date as string) ?? ''}
                                          onChange={(e) =>
                                            updateRow(row.id, {
                                              meta: { ...(row.meta || {}), departure_date: e.target.value || undefined, return_date: undefined }
                                            })
                                          }
                                        />
                                      </div>
                                    )}
                                    {tripType === 'return_only' && (
                                      <div className="min-w-0 xl:col-span-3">
                                        <Input
                                          label="Tanggal pulang"
                                          type="date"
                                          value={(row.meta?.return_date as string) ?? ''}
                                          onChange={(e) =>
                                            updateRow(row.id, {
                                              meta: { ...(row.meta || {}), return_date: e.target.value || undefined, departure_date: undefined }
                                            })
                                          }
                                        />
                                      </div>
                                    )}
                                    {qtyCol}
                                    {priceCol}
                                  </div>
                                );
                              })()}
                              {row.type === 'visa' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3">
                                  <div className="min-w-0 xl:col-span-4">
                                    <Input
                                      label="Tanggal keberangkatan"
                                      type="date"
                                      value={(row.meta?.travel_date as string) ?? ''}
                                      onChange={(e) =>
                                        updateRow(row.id, { meta: { ...(row.meta || {}), travel_date: e.target.value || undefined } })
                                      }
                                      title="Untuk kuota kalender visa"
                                    />
                                  </div>
                                  <div className="min-w-0 xl:col-span-2">
                                    <Input
                                      label="Qty"
                                      type="number"
                                      min={0}
                                      value={row.quantity === undefined || row.quantity === null ? '' : String(row.quantity)}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '') {
                                          updateRow(row.id, { quantity: 0 });
                                          return;
                                        }
                                        const n = parseInt(v, 10);
                                        if (!isNaN(n) && n >= 0) updateRow(row.id, { quantity: n });
                                      }}
                                    />
                                  </div>
                                  {canEditPrice ? (
                                    <div className="min-w-0 xl:col-span-6">
                                      <Input
                                        label={`Harga Satuan (${rowCur(row)})`}
                                        type="number"
                                        min={0}
                                        value={(() => {
                                          const val = getInC(row.unit_price || 0, row, rowCur(row));
                                          return String(Math.round(val * 100) / 100 || '');
                                        })()}
                                        placeholder="0"
                                        onChange={(e) => setRP(row.id, rowCur(row), parseFloat(e.target.value) || 0)}
                                      />
                                    </div>
                                  ) : (
                                    <div className="min-w-0 xl:col-span-6">
                                      <label className={labelClass}>{`Harga Satuan (${rowCur(row)})`}</label>
                                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                                        <NominalDisplay {...nominalInRowCur(row, row.unit_price || 0)} />
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {row.type === 'siskopatuh' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3">
                                  <div className="min-w-0 xl:col-span-4">
                                    <Input
                                      label="Tanggal layanan"
                                      type="date"
                                      value={(row.meta?.service_date as string) ?? ''}
                                      onChange={(e) =>
                                        updateRow(row.id, {
                                          meta: { ...(row.meta || {}), service_date: e.target.value || undefined }
                                        })
                                      }
                                      title="Untuk filter progress & referensi jadwal siskopatuh"
                                    />
                                  </div>
                                  <div className="min-w-0 xl:col-span-2">
                                    <Input
                                      label="Qty"
                                      type="number"
                                      min={0}
                                      value={row.quantity === undefined || row.quantity === null ? '' : String(row.quantity)}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '') {
                                          updateRow(row.id, { quantity: 0 });
                                          return;
                                        }
                                        const n = parseInt(v, 10);
                                        if (!isNaN(n) && n >= 0) updateRow(row.id, { quantity: n });
                                      }}
                                    />
                                  </div>
                                  {canEditPrice ? (
                                    <div className="min-w-0 xl:col-span-6">
                                      <Input
                                        label={`Harga Satuan (${rowCur(row)})`}
                                        type="number"
                                        min={0}
                                        value={(() => {
                                          const val = getInC(row.unit_price || 0, row, rowCur(row));
                                          return String(Math.round(val * 100) / 100 || '');
                                        })()}
                                        placeholder="0"
                                        onChange={(e) => setRP(row.id, rowCur(row), parseFloat(e.target.value) || 0)}
                                      />
                                    </div>
                                  ) : (
                                    <div className="min-w-0 xl:col-span-6">
                                      <label className={labelClass}>{`Harga Satuan (${rowCur(row)})`}</label>
                                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                                        <NominalDisplay {...nominalInRowCur(row, row.unit_price || 0)} />
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {row.type === 'bus' && (() => {
                                const busProduct = products.find((p: ProductOption) => p.type === 'bus' && p.id === row.product_id);
                                const productTripType = busProduct?.meta?.trip_type as TicketTripType | undefined;
                                const tripType =
                                  (row.meta?.trip_type as TicketTripType) || productTripType || 'round_trip';
                                return (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3">
                                    <div className="min-w-0 xl:col-span-3">
                                      <Input
                                        label="Tanggal keberangkatan"
                                        type="date"
                                        value={(row.meta?.travel_date as string) ?? ''}
                                        onChange={(e) =>
                                          updateRow(row.id, { meta: { ...(row.meta || {}), travel_date: e.target.value || undefined } })
                                        }
                                        title="Untuk kuota kalender bus"
                                      />
                                    </div>
                                    <div className="min-w-0 xl:col-span-3">
                                      <Autocomplete
                                        label="Jenis bus"
                                        value={(row.meta?.bus_type as BusType) || 'besar'}
                                        onChange={(v) => {
                                          const bus_type = v as BusType;
                                          updateRow(row.id, {
                                            meta: {
                                              ...(row.meta || {}),
                                              bus_type,
                                              route_type: (row.meta?.route_type as BusRouteType) || 'full_route',
                                              trip_type: tripType
                                            }
                                          });
                                        }}
                                        options={(() => {
                                          const kind = busProduct?.meta?.bus_kind as string | undefined;
                                          const t = kind ? BUS_KIND_TO_TYPE[kind] : undefined;
                                          if (!t) return [];
                                          const lbl = BUS_TYPE_LABELS[t];
                                          return [{ value: t, label: lbl ?? t }];
                                        })()}
                                      />
                                    </div>
                                    <div className="min-w-0 xl:col-span-2">
                                      <Autocomplete
                                        label="Rute"
                                        value={(row.meta?.route_type as BusRouteType) || 'full_route'}
                                        onChange={(v) => {
                                          const route_type = v as BusRouteType;
                                          updateRow(row.id, {
                                            meta: {
                                              ...(row.meta || {}),
                                              route_type,
                                              trip_type: tripType,
                                              bus_type: (row.meta?.bus_type as BusType) || 'besar'
                                            }
                                          });
                                        }}
                                        options={(() => {
                                          const rp = busProduct?.meta?.route_prices as Record<string, number> | undefined;
                                          if (!rp) return [];
                                          return Object.entries(rp)
                                            .filter(([, val]) => (val ?? 0) > 0)
                                            .map(([k]) => ({ value: k, label: BUS_ROUTE_LABELS[k] ?? k }));
                                        })()}
                                      />
                                    </div>
                                    <div className="min-w-0 xl:col-span-2">
                                      <Input
                                        label="Qty"
                                        type="number"
                                        min={0}
                                        value={row.quantity === undefined || row.quantity === null ? '' : String(row.quantity)}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          if (v === '') {
                                            updateRow(row.id, { quantity: 0 });
                                            return;
                                          }
                                          const n = parseInt(v, 10);
                                          if (!isNaN(n) && n >= 0) updateRow(row.id, { quantity: n });
                                        }}
                                      />
                                    </div>
                                    {canEditPrice ? (
                                      <div className="min-w-0 xl:col-span-2">
                                        <Input
                                          label={`Harga Satuan (${rowCur(row)})`}
                                          type="number"
                                          min={0}
                                          value={(() => {
                                            const val = getInC(row.unit_price || 0, row, rowCur(row));
                                            return String(Math.round(val * 100) / 100 || '');
                                          })()}
                                          placeholder="0"
                                          onChange={(e) => setRP(row.id, rowCur(row), parseFloat(e.target.value) || 0)}
                                        />
                                      </div>
                                    ) : (
                                      <div className="min-w-0 xl:col-span-2">
                                        <label className={labelClass}>{`Harga Satuan (${rowCur(row)})`}</label>
                                        <p className="text-sm font-bold text-slate-900 tabular-nums">
                                          <NominalDisplay {...nominalInRowCur(row, row.unit_price || 0)} />
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              {(row.type === 'handling' || row.type === 'package') && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3">
                                  <div className="min-w-0 xl:col-span-3">
                                    <Input
                                      label="Qty"
                                      type="number"
                                      min={0}
                                      value={row.quantity === undefined || row.quantity === null ? '' : String(row.quantity)}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '') {
                                          updateRow(row.id, { quantity: 0 });
                                          return;
                                        }
                                        const n = parseInt(v, 10);
                                        if (!isNaN(n) && n >= 0) updateRow(row.id, { quantity: n });
                                      }}
                                    />
                                  </div>
                                  {canEditPrice ? (
                                    <div className="min-w-0 xl:col-span-9">
                                      <Input
                                        label={`Harga Satuan (${rowCur(row)})`}
                                        type="number"
                                        min={0}
                                        value={(() => {
                                          const val = getInC(row.unit_price || 0, row, rowCur(row));
                                          return String(Math.round(val * 100) / 100 || '');
                                        })()}
                                        placeholder="0"
                                        onChange={(e) => setRP(row.id, rowCur(row), parseFloat(e.target.value) || 0)}
                                      />
                                    </div>
                                  ) : (
                                    <div className="min-w-0 xl:col-span-9">
                                      <label className={labelClass}>{`Harga Satuan (${rowCur(row)})`}</label>
                                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                                        <NominalDisplay {...nominalInRowCur(row, row.unit_price || 0)} />
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {row.type === 'package' &&
                                row.product_id &&
                                (() => {
                                  const pkg = byType('package').find((p) => p.id === row.product_id);
                                  const pkgMeta = (pkg?.meta ?? {}) as {
                                    includes?: string[];
                                    hotel_makkah_id?: string;
                                    hotel_madinah_id?: string;
                                  };
                                  const includes = Array.isArray(pkgMeta.includes) ? pkgMeta.includes : [];
                                  if (includes.length === 0) return null;
                                  const flags = (row.meta?.package_include_flags as Record<string, boolean> | undefined) ?? {};
                                  const setInclude = (key: string, on: boolean) => {
                                    updateRow(row.id, {
                                      meta: { ...(row.meta || {}), package_include_flags: { ...flags, [key]: on } }
                                    });
                                  };
                                  const hotelOpts = products
                                    .filter((p) => p.type === 'hotel' && !p.is_package)
                                    .map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }));
                                  const hotelLabel = (id?: string) =>
                                    products.find((p) => p.id === id)?.name ?? (id ? `Produk ${id.slice(0, 8)}…` : '—');
                                  const makId =
                                    (row.meta?.package_hotel_makkah_id as string) || pkgMeta.hotel_makkah_id || '';
                                  const madId =
                                    (row.meta?.package_hotel_madinah_id as string) || pkgMeta.hotel_madinah_id || '';
                                  return (
                                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Include paket</p>
                                      <p className="text-xs text-slate-500">
                                        Centang include yang dipakai untuk order ini. Penggantian hotel tersimpan di item order (meta).
                                      </p>
                                      <ul className="space-y-2">
                                        {includes.map((inc) => (
                                          <li
                                            key={inc}
                                            className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                                          >
                                            <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                                              <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-[#0D1A63] focus:ring-[#0D1A63] shrink-0"
                                                checked={flags[inc] !== false}
                                                onChange={(e) => setInclude(inc, e.target.checked)}
                                              />
                                              <span className="text-sm font-medium text-slate-800">
                                                {PACKAGE_INCLUDE_LABELS[inc] ?? inc}
                                              </span>
                                            </label>
                                          </li>
                                        ))}
                                      </ul>
                                      {includes.includes('hotel') && flags.hotel !== false && (
                                        <div className="space-y-3 pt-2 border-t border-slate-100">
                                          <p className="text-xs font-semibold text-slate-600">Hotel paket (boleh diganti)</p>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="min-w-0">
                                              <p className="text-xs text-slate-500 mb-1">
                                                Default Makkah: <span className="font-medium text-slate-800">{hotelLabel(pkgMeta.hotel_makkah_id)}</span>
                                              </p>
                                              <Autocomplete
                                                label="Hotel Makkah untuk order ini"
                                                value={makId}
                                                onChange={(v) =>
                                                  updateRow(row.id, {
                                                    meta: { ...(row.meta || {}), package_hotel_makkah_id: v || undefined }
                                                  })
                                                }
                                                options={hotelOpts}
                                                emptyLabel="— Pilih hotel —"
                                              />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-xs text-slate-500 mb-1">
                                                Default Madinah:{' '}
                                                <span className="font-medium text-slate-800">{hotelLabel(pkgMeta.hotel_madinah_id)}</span>
                                              </p>
                                              <Autocomplete
                                                label="Hotel Madinah untuk order ini"
                                                value={madId}
                                                onChange={(v) =>
                                                  updateRow(row.id, {
                                                    meta: { ...(row.meta || {}), package_hotel_madinah_id: v || undefined }
                                                  })
                                                }
                                                options={hotelOpts}
                                                emptyLabel="— Pilih hotel —"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {items.some(r=>r.type==='visa')&&(
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
                      <span className="font-medium text-amber-900">Total visa: {totalVisaPacks} pack.</span>
                      {busServiceOption === 'finality' && totalVisaPacks > 0 ? (
                        <span className="text-amber-800">
                          {' '}
                          Biaya Bus Finality: visa {totalVisaPacks} pack (min. {busPenaltyRule.bus_min_pack} pack).
                          {busFinalityDeficitPacks > 0 ? (
                            <> Kekurangan {busFinalityDeficitPacks} pack × <NominalDisplay amount={busPenaltyRule.bus_penalty_idr} currency="IDR" /> = <NominalDisplay amount={busFinalityPerPackIDR} currency="IDR" />.</>
                          ) : (
                            <> Tidak ada penalti (sudah ≥ {busPenaltyRule.bus_min_pack} pack).</>
                          )}{' '}
                          (masuk Ringkasan Total.)
                        </span>
                      ) : busServiceOption === 'finality' ? (
                        <span className="text-slate-600"> Belum ada pack visa — biaya Bus Finality belum dihitung.</span>
                      ) : busServiceOption === 'hiace' ? (
                        <span className="text-slate-600"> Opsi Bus Hiace: tanpa penalti; isi baris Bus di atas (produk Hiace, tanggal, qty) — subtotal mengikuti harga master.</span>
                      ) : (
                        <span className="text-slate-600"> Tanpa layanan bus — hanya visa (tidak ada bus include / Hiace otomatis).</span>
                      )}
                      <p className="text-xs text-slate-600 mt-1">Pilih opsi bus di bagian Ringkasan.</p>
                    </div>
                  )}
                  <Button type="button" variant="outline" onClick={addRow} className="w-full py-4 rounded-xl border-2 border-dashed border-[#0D1A63]/40 bg-[#0D1A63]/5 text-[#0D1A63] hover:border-[#0D1A63] hover:bg-[#0D1A63]/10 transition-colors text-base font-semibold shadow-sm">
                    <Plus size={20} className="mr-2 inline shrink-0"/> Tambah item pemesanan
                  </Button>
                </>
              )}
          </div>
        </section>

        {/* Keterangan invoice + kurs (hanya role yang mengatur kurs) */}
        {canEditPrice && (
          <>
        <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#0D1A63]/10 text-[#0D1A63]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">Keterangan</h2>
              <p className="text-xs text-slate-500">Teks tambahan untuk invoice (tampil sebagai catatan di PDF / detail invoice).</p>
            </div>
          </div>
          <div className="p-4">
            <label htmlFor="invoice_keterangan" className={labelClass}>Keterangan invoice</label>
            <textarea
              id="invoice_keterangan"
              name="invoice_keterangan"
              rows={4}
              value={invoiceKeterangan}
              onChange={(e) => setInvoiceKeterangan(e.target.value)}
              placeholder="Contoh: kurs negosiasi, penjelasan tagihan, atau catatan untuk keuangan…"
              className={`${inputBaseClass} ${inputBorderClass} w-full min-h-[96px] resize-y`}
            />
          </div>
        </section>
          <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Kurs untuk order ini</h2>
                <p className="text-xs text-slate-500">{hasDpPayment ? 'Sudah ada DP: kurs order dipakai untuk item lama; kurs terbaru untuk item tambahan.' : 'Jika diisi: Total SAR / IDR / USD di atas dan ringkasan memakai kurs ini (bukan kurs Settings). Hotel dalam IDR ikut dihitung ulang dari master. Kosong = kurs dari Settings.'}</p>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                {hasDpPayment && <p className="text-xs font-medium text-slate-600 mb-2">Kurs order (item yang sudah ada)</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="1 SAR = (IDR)" type="number" min={0} step={1} placeholder={String(rates.SAR_TO_IDR ?? 4200)} value={orderRatesOverride?.SAR_TO_IDR != null ? String(orderRatesOverride.SAR_TO_IDR) : ''} onChange={e=>{ const v=e.target.value; setOrderRatesOverride(prev=>({ ...(prev||{}), SAR_TO_IDR: v===''?undefined:Math.max(0,parseFloat(v)||0) })); }} disabled={!!hasDpPayment} />
                  <Input label="1 USD = (IDR)" type="number" min={0} step={1} placeholder={String(rates.USD_TO_IDR ?? 15500)} value={orderRatesOverride?.USD_TO_IDR != null ? String(orderRatesOverride.USD_TO_IDR) : ''} onChange={e=>{ const v=e.target.value; setOrderRatesOverride(prev=>({ ...(prev||{}), USD_TO_IDR: v===''?undefined:Math.max(0,parseFloat(v)||0) })); }} disabled={!!hasDpPayment} />
                </div>
              </div>
              {hasNewItemsAfterDp && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200/80 p-3">
                  <p className="text-xs font-semibold text-emerald-800 mb-2">Kurs terbaru (untuk item tambahan)</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span>1 SAR = <b className="text-slate-900"><NominalDisplay amount={latestRates.SAR_TO_IDR} currency="IDR" /></b></span>
                    <span>1 USD = <b className="text-slate-900"><NominalDisplay amount={latestRates.USD_TO_IDR} currency="IDR" /></b></span>
                  </div>
                </div>
              )}
            </div>
          </section>
          </>
        )}

        {/* Ringkasan */}
        <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#0D1A63]/10 text-[#0D1A63]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">Ringkasan</h2>
              <p className="text-xs text-slate-500">Total & kurs yang dipakai</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {hasCustomOrderKurs && (
              <p className="text-xs text-slate-600 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                Kurs dipakai untuk total: 1 SAR = <NominalDisplay amount={effectiveRates.SAR_TO_IDR ?? 0} currency="IDR" />
                {' · '}
                1 USD = <NominalDisplay amount={effectiveRates.USD_TO_IDR ?? 0} currency="IDR" />
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-primary-500/5 border border-primary-200/80 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total SAR</p>
                <p className="text-lg font-bold text-[#0D1A63] tabular-nums mt-0.5"><NominalDisplay amount={totalSAR} currency="SAR" /></p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total IDR</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5"><NominalDisplay amount={totalIDR} currency="IDR" /></p>
                <p className="text-xs text-slate-500">Tagihan Rupiah</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total USD</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5"><NominalDisplay amount={totalIDR/(effectiveRates.USD_TO_IDR||15500)} currency="USD" /></p>
                <p className="text-xs text-slate-500">Pembayaran USD</p>
              </div>
            </div>
            {items.some(r=>r.type==='visa')&&(
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm space-y-3">
                <div>
                  <p className="text-amber-800 font-medium">Total visa: {totalVisaPacks} pack</p>
                  <p className="text-slate-600 text-xs mt-0.5">
                    {busServiceOption === 'finality' && totalVisaPacks > 0 ? (
                      <>
                        Biaya Bus Finality: visa {totalVisaPacks} pack, min {busPenaltyRule.bus_min_pack} pack.
                        {busFinalityDeficitPacks > 0 ? (
                          <> Kekurangan {busFinalityDeficitPacks} × <NominalDisplay amount={busPenaltyRule.bus_penalty_idr} currency="IDR" /> = <NominalDisplay amount={busFinalityPerPackIDR} currency="IDR" />.</>
                        ) : (
                          <> Tanpa penalti (≥ min pack).</>
                        )}{' '}
                        Otomatis digabung ke Total SAR/IDR/USD.
                      </>
                    ) : busServiceOption === 'finality' ? (
                      <>Belum ada pack visa, jadi biaya Bus Finality belum terbentuk.</>
                    ) : busServiceOption === 'hiace' ? (
                      <>Tanpa penalti; tambah/ubah baris Bus Hiace di item pemesanan — harga &amp; subtotal mengikuti produk yang dipilih.</>
                    ) : (
                      <>Tidak ada penalti bus — trip hanya visa tanpa layanan bus.</>
                    )}
                  </p>
                </div>
                <fieldset className="space-y-2.5 border-0 p-0 m-0">
                  <legend className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Opsi layanan bus</legend>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="bus_service_option"
                      className="mt-1 border-slate-300 text-[#0D1A63] focus:ring-[#0D1A63]"
                      checked={busServiceOption === 'finality'}
                      onChange={() => applyBusServiceOption('finality')}
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Bus Finality</span>
                      {' — '}Penalti hanya jika visa di bawah minimum pack (pengaturan bisnis, default 35): dihitung dari pack kekurangan × tarif per pack. Di atas minimum: tanpa penalti.
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="bus_service_option"
                      className="mt-1 border-slate-300 text-[#0D1A63] focus:ring-[#0D1A63]"
                      checked={busServiceOption === 'hiace'}
                      onChange={() => applyBusServiceOption('hiace')}
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Bus Hiace</span>
                      {' — '}Tanpa penalti; baris Bus (produk Hiace) di item bisa dipilih — tanggal, qty, dan harga mengikuti master.
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="bus_service_option"
                      className="mt-1 border-slate-300 text-[#0D1A63] focus:ring-[#0D1A63]"
                      checked={busServiceOption === 'visa_only'}
                      onChange={() => applyBusServiceOption('visa_only')}
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Tidak pakai bus</span>
                      {' — '}Hanya visa; tanpa bus include dan tanpa Hiace otomatis.
                    </span>
                  </label>
                </fieldset>
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span>1 SAR = <b className="text-slate-900"><NominalDisplay amount={rates.SAR_TO_IDR??4200} currency="IDR" /></b></span>
              <span>1 USD = <b className="text-slate-900"><NominalDisplay amount={rates.USD_TO_IDR??15500} currency="IDR" /></b></span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="sticky bottom-0 left-0 right-0 z-10 mt-6 py-3 -mx-1 sm:-mx-2 px-1 sm:px-2 bg-white/98 backdrop-blur-sm border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] flex flex-wrap items-center justify-between gap-3 rounded-t-xl">
          <Button type="button" variant="ghost" onClick={()=>navigate('/dashboard/orders-invoices?tab=invoices')} className="text-slate-600 hover:bg-slate-100 rounded-xl">Batal</Button>
          <div className="flex flex-wrap items-center gap-3">
            {isDraftNoInvoice && (
              <>
                <Button type="button" variant="outline" onClick={()=>handleSaveDraft()} disabled={saving}>
                  {saving ? 'Menyimpan…' : 'Simpan Draft'}
                </Button>
                <Button type="button" variant="primary" onClick={()=>handleTerbitkanInvoice()} disabled={saving}>
                  {saving ? 'Menerbitkan…' : 'Terbitkan Invoice'}
                  {!saving && <ChevronRight size={16} className="ml-1"/>}
                </Button>
              </>
            )}
            {!isEdit && (
              <>
                <Button type="button" variant="outline" onClick={()=>handleSaveDraft()} disabled={saving}>
                  {saving ? 'Menyimpan…' : 'Simpan Draft'}
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Menyimpan…' : 'Buat Invoice'}
                  {!saving && <ChevronRight size={16} className="ml-1"/>}
                </Button>
              </>
            )}
            {isEdit && !isDraftNoInvoice && (
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
                {!saving && <ChevronRight size={16} className="ml-1"/>}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
    </div>
  );
};

export default OrderFormPage;