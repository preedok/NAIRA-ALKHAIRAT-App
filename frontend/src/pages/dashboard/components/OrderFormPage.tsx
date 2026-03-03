import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Trash2, ArrowLeft, Hotel, Plane, FileText,
  Bus, Package, Users, Utensils, X, ChevronRight,
  Star, CreditCard, Building2, Loader2, GripVertical
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, ordersApi, invoicesApi, businessRulesApi, branchesApi, ownersApi } from '../../../services/api';
import { formatIDR, formatSAR, formatUSD } from '../../../utils';
import { AUTOCOMPLETE_PILIH } from '../../../utils/constants';
import { fillFromSource } from '../../../utils/currencyConversion';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import { Autocomplete, Input, ContentLoading, CONTENT_LOADING_MESSAGE } from '../../../components/common';

/* ═══════════════════════════════════════════════
   TYPES & CONSTANTS
═══════════════════════════════════════════════ */
const ITEM_TYPES = [
  { id:'hotel',    label:'Hotel',    Icon:Hotel,    color:'#6b7280' },
  { id:'visa',     label:'Visa',     Icon:FileText, color:'#78716c' },
  { id:'ticket',   label:'Tiket',    Icon:Plane,    color:'#57534e' },
  { id:'bus',      label:'Bus',      Icon:Bus,      color:'#6b7280' },
  { id:'handling', label:'Handling', Icon:Star,     color:'#78716c' },
  { id:'package',  label:'Paket',    Icon:Package,  color:'#64748b' },
] as const;

const ROOM_TYPES = [
  { id:'single', label:'Single', cap:1 },
  { id:'double', label:'Double', cap:2 },
  { id:'triple', label:'Triple', cap:3 },
  { id:'quad',   label:'Quad',   cap:4 },
  { id:'quint',  label:'Quint',  cap:5 },
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
  besar: 'Bus Besar (min 35 orang, penalti jika kurang)',
  menengah_hiace: 'Bus Menengah (HIACE)',
  kecil: 'Mobil Kecil',
};

type ItemType   = typeof ITEM_TYPES[number]['id'];
type RoomTypeId = typeof ROOM_TYPES[number]['id'];

type DisplayCurrency = 'SAR' | 'IDR' | 'USD';

interface ProductOption {
  id:string; name:string; code:string; type:string;
  is_package?:boolean; price_general?:number|null;
  price_general_idr?:number|null; price_general_sar?:number|null; price_general_usd?:number|null;
  price_branch?:number|null; price_owner?:number|null;
  currency?:string; meta?:{meal_price?:number;route_prices_by_trip?:Record<string,number>;[k:string]:unknown};
  room_breakdown?:Record<string,{ price: number }>; prices_by_room?:Record<string,{ price: number }>;
  bandara_options?: Array<{ bandara: string; name: string; default: { price_idr: number; seat_quota?: number } }>;
  route_prices?: Partial<Record<BusRouteType, number>>;
}

/** Mata uang tampilan: mengikuti mata uang produk; jika produk tidak punya currency, fallback per tipe. */
function getDisplayCurrency(type: ItemType, product?: ProductOption | null): DisplayCurrency {
  const c = (product?.currency ?? (product?.meta as { currency?: string })?.currency)?.toUpperCase();
  if (c === 'SAR' || c === 'USD' || c === 'IDR') return c as DisplayCurrency;
  if (type === 'hotel' || type === 'handling') return 'SAR';
  if (type === 'bus' || type === 'ticket') return 'IDR';
  if (type === 'visa') return 'USD';
  return 'IDR';
}
interface HotelRoomLine { id:string; room_type:RoomTypeId|''; quantity:number; unit_price:number; meal_unit_price?:number; with_meal?:boolean; }
interface OrderItemRow  { id:string; type:ItemType; product_id:string; product_name:string; quantity:number; room_type?:RoomTypeId; room_breakdown?:HotelRoomLine[]; unit_price:number; check_in?:string; check_out?:string; check_in_time?:string; check_out_time?:string; meta?:Record<string,unknown>; price_currency?:DisplayCurrency; }
interface OwnerListItem { id:string; user_id:string; assigned_branch_id?:string; User?:{id:string;name?:string;company_name?:string}; AssignedBranch?:{id:string;code:string;name:string}; }

const uid  = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const newLine = (): HotelRoomLine => ({ id:`rl-${uid()}`, room_type:'', quantity:0, unit_price:0, with_meal:false });
const newRow  = (): OrderItemRow  => ({ id:`row-${uid()}`, type:'hotel', product_id:'', product_name:'', quantity:0, unit_price:0, room_breakdown:[newLine()] });
const rCap = (rt?:RoomTypeId) => rt ? (ROOM_TYPES.find(t=>t.id===rt)?.cap??0) : 0;
const canManage = (role?:string) => role==='owner' || role==='invoice_koordinator' || role==='invoice_saudi';
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
  const [hotelAvailability, setHotelAvailability] = useState<Record<string, { byRoomType: Record<string, number> } | 'loading' | null>>({});
  const [busPenaltyRule, setBusPenaltyRule] = useState<{ bus_min_pack: number; bus_penalty_idr: number }>({ bus_min_pack: 35, bus_penalty_idr: 500000 });
  const initialOrderItemKeysRef = useRef<Set<string>>(new Set());

  const isOwner      = user?.role === 'owner';
  const canPickOwner = !isEdit && ['invoice_koordinator','invoice_saudi'].includes(user?.role ?? '');
  const ownerProf    = canPickOwner && ownerSel ? owners.find(o=>(o.User?.id??o.user_id)===ownerSel) : null;
  const bFromOwner   = ownerProf?.AssignedBranch?.id ?? ownerProf?.assigned_branch_id ?? null;
  const branchId     = order?.branch_id || (canPickOwner ? bFromOwner : null) || branchSel || user?.branch_id || undefined;
  const ownerId      = isOwner ? user?.id : (isEdit ? order?.owner_id : canPickOwner ? ownerSel : undefined) ?? order?.owner_id ?? user?.id;

  /* loaders */
  useEffect(() => {
    if (!isEdit && !isOwner && !canPickOwner) {
      branchesApi.list({ limit:500 }).then(r => {
        const list:any[] = (r.data as any)?.data ?? [];
        setBranches(Array.isArray(list)?list:[]);
        setBranchSel(p => { if(p) return p; if(user?.branch_id && list.some((b:any)=>b.id===user.branch_id)) return user.branch_id; return list[0]?.id||''; });
      }).catch(()=>{});
    }
  },[isEdit,isOwner,canPickOwner,user?.branch_id]);

  useEffect(()=>{ if(isEdit&&order?.branch_id) setBranchSel(order.branch_id); },[isEdit,order?.branch_id]);

  useEffect(() => {
    if (!order?.currency_rates_override || typeof order.currency_rates_override !== 'object') return;
    const o = order.currency_rates_override as { SAR_TO_IDR?: number; USD_TO_IDR?: number };
    setOrderRatesOverride({
      SAR_TO_IDR: typeof o.SAR_TO_IDR === 'number' ? o.SAR_TO_IDR : undefined,
      USD_TO_IDR: typeof o.USD_TO_IDR === 'number' ? o.USD_TO_IDR : undefined
    });
  }, [order?.id, order?.currency_rates_override]);

  useEffect(()=>{
    if(!canPickOwner){ setOwners([]); return; }
    ownersApi.list({}).then(r=>{
      const data:OwnerListItem[]=(r.data as any)?.data??[];
      setOwners(data);
      setOwnerSel(p=>{ const f=data[0]; const fid=f?.User?.id??f?.user_id; return fid&&!p?fid:p; });
    }).catch(()=>{});
  },[canPickOwner]);

  // Kurs SAR & USD + aturan bus (min pack, penalty per pack) dari business rules.
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
    const p:Record<string,any>={with_prices:'true',include_inactive:'false',limit:500};
    if(branchId) p.branch_id=branchId;
    if(ownerId)  p.owner_id=ownerId;
    productsApi.list(p)
      .then(r=>{ const d=(r.data as any)?.data??[]; setProducts(Array.isArray(d)?d:[]); })
      .catch(()=>showToast('Gagal memuat produk','error'))
      .finally(()=>setLoadingProd(false));
  },[branchId,ownerId,showToast]);
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
    appliedDraftRef.current=true;
    const rows:OrderItemRow[]=orderDraft.items.map(d=>{
      const room_breakdown=d.room_breakdown?.map(l=>({ id:l.id||`rl-${uid()}`, room_type:(l.room_type||'quad') as RoomTypeId, quantity:l.quantity||1, unit_price:l.unit_price||d.unit_price_idr, with_meal:!!l.with_meal }));
      return {
        id:d.id,
        type:d.type as ItemType,
        product_id:d.product_id,
        product_name:d.product_name,
        quantity:d.quantity||1,
        unit_price:d.unit_price_idr,
        room_breakdown: d.type==='hotel'?room_breakdown:undefined,
        check_in:d.check_in,
        check_out:d.check_out,
        meta:(d as { meta?: Record<string,unknown> }).meta
      };
    });
    setItems(rows.length?rows:[newRow()]);
    orderDraft.clear();
  },[orderId,loadingOrd,orderDraft.items.length,orderDraft.clear,rates.SAR_TO_IDR]);

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
    /** Konversi unit_price dari backend (IDR) ke mata uang tampilan produk */
    const disp=(idr:number,pid:string,itemType:ItemType)=>{ const pr=products.find(x=>x.id===pid); const cur=getDisplayCurrency(itemType,pr); if(cur==='SAR') return (idr||0)/s2i; if(cur==='USD') return (idr||0)/u2i; return idr||0; };
    const seen=new Set<string>(); const rows:OrderItemRow[]=[];
    for(const oi of ois){
      const meta=typeof oi.meta==='object'?oi.meta:{};
      const typeVal=getVal(oi,'type');
      const t=(typeVal||'hotel') as ItemType;
      const productRefId=getVal(oi,'product_ref_id')||'';
      const unitPrice=disp(parseFloat(getVal(oi,'unit_price'))||0,productRefId,t);
      const productName=oi.Product?.name??getVal(oi,'Product')?.name??'';
      if(t==='hotel'&&productRefId){
        if(!seen.has(productRefId)){
          seen.add(productRefId);
          const grp=ois.filter((o:any)=>(getVal(o,'type')==='hotel')&&(getVal(o,'product_ref_id')===productRefId));
          const firstMeta=typeof grp[0]?.meta==='object'?grp[0].meta:{};
          const checkIn=(firstMeta.check_in??getVal(grp[0],'check_in')) as string|undefined;
          const checkOut=(firstMeta.check_out??getVal(grp[0],'check_out')) as string|undefined;
          // Jam check-in/check-out otomatis sistem (16:00 / 12:00), tidak perlu pilih di form
          rows.push({ id:oi.id||`row-${uid()}`, type:'hotel', product_id:productRefId, product_name:productName,
            quantity:grp.reduce((s:number,o:any)=>s+qty(o),0),
            unit_price:unitPrice,
            check_in:checkIn||undefined,
            check_out:checkOut||undefined,
            room_breakdown:grp.map((o:any)=>{ const m=typeof o.meta==='object'?o.meta:{}; const rt=((m.room_type??getVal(o,'room_type'))||'quad') as RoomTypeId; return{ id:o.id||`rl-${uid()}`, room_type:rt, quantity:qty(o), unit_price:disp(parseFloat(getVal(o,'unit_price'))||0,productRefId,'hotel'), with_meal:!!(m.with_meal??m.meal) }; })
          });
        }
      } else {
        rows.push({ id:oi.id||`row-${uid()}`, type:t, product_id:productRefId, product_name:productName, quantity:Math.max(0,qty(oi)), room_type:(meta.room_type??getVal(oi,'room_type')) as RoomTypeId|undefined, unit_price:unitPrice, meta:Object.keys(meta).length?meta:undefined });
      }
    }
    const keys = new Set<string>();
    for (const oi of ois) {
      const t = (getVal(oi,'type')||'hotel') as string;
      const pid = getVal(oi,'product_ref_id')||'';
      const m = typeof oi.meta==='object'?oi.meta:{};
      if (t==='hotel') keys.add(`hotel:${pid}:${m.room_type||''}:${m.check_in||''}:${m.check_out||''}`);
      else keys.add(`${t}:${pid}:${JSON.stringify(m)}`);
    }
    initialOrderItemKeysRef.current = keys;
    setItems(rows.length?rows:[newRow()]);
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
  /** Hanya tipe yang punya produk di data — agar dropdown Tipe hanya tampil pilihan yang tersedia */
  const availableItemTypes = ITEM_TYPES.filter((t) => byType(t.id).length > 0);
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
  const hrp=(p:ProductOption|undefined,rt:RoomTypeId|'',meal:boolean)=>{
    if(!p || !rt) return 0;
    const rb=p.room_breakdown??p.prices_by_room??{};
    const rtEntry=rb[rt];
    const rtPrice=typeof rtEntry==='object'&&rtEntry!==null&&'price' in rtEntry?Number(rtEntry.price):typeof rtEntry==='number'?rtEntry:0;
    const fallbackGeneral=p.price_general_sar ?? (p.price_general_idr ?? 0)/s2i;
    const fallbackAnyRoom=Object.values(rb).find((v:unknown)=>typeof v==='object'&&v!==null&&'price' in (v as object)&&Number((v as {price?:unknown}).price)>0);
    const anyRoomPrice=fallbackAnyRoom?Number((fallbackAnyRoom as {price:number}).price):0;
    const cur=(p.currency||'IDR').toUpperCase();
    const toSar=(x:number)=>cur==='SAR'?x:cur==='USD'?x*u2iR/s2i:x/s2i;
    /* Harga dari room_breakdown/prices_by_room: jika sangat besar (>= 50k) dianggap IDR dan dikonversi ke SAR; selain itu ikuti product.currency */
    const rawRoom = rtPrice>0 ? rtPrice : (anyRoomPrice>0 ? anyRoomPrice : 0);
    const roomSar = rawRoom > 0
      ? (rawRoom >= 50000 ? rawRoom / s2i : toSar(rawRoom))
      : fallbackGeneral;
    return meal ? roomSar + toSar((p.meta?.meal_price as number|undefined)??0) : roomSar;
  };
  const hasDpPayment = isEdit && order?.dp_payment_status === 'pembayaran_dp';
  const effectiveRates = (orderRatesOverride && (orderRatesOverride.SAR_TO_IDR != null || orderRatesOverride.USD_TO_IDR != null))
    ? { SAR_TO_IDR: orderRatesOverride.SAR_TO_IDR ?? rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: orderRatesOverride.USD_TO_IDR ?? rates.USD_TO_IDR ?? 15500 }
    : rates;
  const rowCur=(row:OrderItemRow):DisplayCurrency=> row.price_currency ?? getDisplayCurrency(row.type, products.find(x=>x.id===row.product_id));
  const toIDR=(price:number,row:OrderItemRow)=>{ const c=rowCur(row); if(c==='SAR') return price*(effectiveRates.SAR_TO_IDR||4200); if(c==='USD') return price*(effectiveRates.USD_TO_IDR||15500); return price; };
  const toIDRWithRates=(price:number,row:OrderItemRow,rateSet:{SAR_TO_IDR?:number;USD_TO_IDR?:number})=>{ const c=rowCur(row); const s=rateSet.SAR_TO_IDR||4200; const u=rateSet.USD_TO_IDR||15500; if(c==='SAR') return price*s; if(c==='USD') return price*u; return price; };
  const getInC=(priceInRow:number,row:OrderItemRow,cur:'IDR'|'SAR'|'USD')=>{ const idr=toIDR(priceInRow,row); const t=fillFromSource('IDR',idr,effectiveRates); return cur==='IDR'?t.idr:cur==='SAR'?t.sar:t.usd; };
  const toRowCurrency=(idr:number,row:OrderItemRow)=>{ const c=rowCur(row); const s2i=effectiveRates.SAR_TO_IDR||4200; const u2i=effectiveRates.USD_TO_IDR||15500; if(c==='SAR') return idr/s2i; if(c==='USD') return idr/u2i; return idr; };
  const s2iEff=effectiveRates.SAR_TO_IDR||4200; const u2iEff=effectiveRates.USD_TO_IDR||15500;
  const toCurrencyFromSAR=(sar:number,cur:DisplayCurrency)=> cur==='SAR'?sar: cur==='IDR'?sar*s2iEff: sar*s2iEff/u2iEff;
  const setRP=(rowId:string,cur:'IDR'|'SAR'|'USD',val:number)=>{ const row=items.find(r=>r.id===rowId); if(!row) return; const idr=cur==='IDR'?val:cur==='SAR'?val*(effectiveRates.SAR_TO_IDR||4200):val*(effectiveRates.USD_TO_IDR||15500); updateRow(rowId,{unit_price:toRowCurrency(idr,row)}); };
  const setLP=(rowId:string,lineId:string,cur:'IDR'|'SAR'|'USD',val:number)=>{ const row=items.find(r=>r.id===rowId); if(!row) return; const idr=cur==='IDR'?val:cur==='SAR'?val*(effectiveRates.SAR_TO_IDR||4200):val*(effectiveRates.USD_TO_IDR||15500); updLine(rowId,lineId,{unit_price:toRowCurrency(idr,row)}); };
  const setMealLP=(rowId:string,lineId:string,cur:'IDR'|'SAR'|'USD',val:number)=>{ const row=items.find(r=>r.id===rowId); if(!row) return; const idr=cur==='IDR'?val:cur==='SAR'?val*(effectiveRates.SAR_TO_IDR||4200):val*(effectiveRates.USD_TO_IDR||15500); updLine(rowId,lineId,{meal_unit_price:toRowCurrency(idr,row)}); };
  const getMealPriceSar=(p:ProductOption|undefined):number=>{ if(!p) return 0; const raw=(p.meta?.meal_price as number)??0; const cur=(p.currency||'IDR').toUpperCase(); return cur==='SAR'?raw:cur==='USD'?raw*u2iR/s2i:raw/s2i; };

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
  const addLine  =(rowId:string)=>{ const row=items.find(r=>r.id===rowId); if(!row||row.type!=='hotel') return; const line:HotelRoomLine={id:`rl-${uid()}`,room_type:'',quantity:0,unit_price:0,with_meal:false}; setItems(p=>p.map(r=>r.id!==rowId?r:{...r,room_breakdown:[...(r.room_breakdown||[]),line]})); };
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
          next.meta={ ...(next.meta||{}), route_type:route, trip_type:tripType, bus_type:(next.meta?.bus_type as BusType)||'besar' };
          next.unit_price=next.unit_price===0||upd.product_id!==r.product_id?busRoutePrice(prod,route,tripType):next.unit_price;
        } else if(next.type==='package'){
          if(next.unit_price===0||upd.product_id!==r.product_id) next.unit_price=toRowCurrency(packageUnitPriceIdr(prod),next);
        } else {
          if(next.unit_price===0||upd.product_id!==r.product_id) next.unit_price=effP(prod,next.type);
        }
        if(next.type==='hotel'&&!(next.room_breakdown?.length)){
          next.room_breakdown=[{id:`rl-${uid()}`,room_type:'',quantity:0,unit_price:0,with_meal:false}];
        }
        if(next.type==='hotel'&&next.room_breakdown?.length){
          const rowCurHotel=next.price_currency??getDisplayCurrency(next.type,prod);
          next.room_breakdown=next.room_breakdown.map(l=>{
            if(!l.room_type) return l;
            const roomPSar=hrp(prod,l.room_type as RoomTypeId,false);
            const mealPSar=getMealPriceSar(prod);
            const roomP=toCurrencyFromSAR(roomPSar,rowCurHotel);
            const mealP=toCurrencyFromSAR(mealPSar,rowCurHotel);
            return { ...l, unit_price: l.unit_price||roomP, meal_unit_price: l.with_meal?(l.meal_unit_price??mealP):0 };
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
    if(r.type!=='hotel'||!l.room_type) return l.unit_price||0;
    const prod=byType('hotel').find(p=>p.id===r.product_id);
    const cur=rowCur(r);
    const hasSplitMeal=typeof l.meal_unit_price==='number';
    if(l.with_meal&&!hasSplitMeal) return l.unit_price||toCurrencyFromSAR(hrp(prod,l.room_type as RoomTypeId,true),cur);
    const roomPart=l.unit_price||toCurrencyFromSAR(hrp(prod,l.room_type as RoomTypeId,false),cur);
    const mealPart=l.with_meal?(l.meal_unit_price??toCurrencyFromSAR(getMealPriceSar(prod),cur)):0;
    return roomPart+mealPart;
  };
  const getEffectiveRoomPrice=(r:OrderItemRow,l:HotelRoomLine):number=>{
    if(r.type!=='hotel'||!l.room_type) return l.unit_price||0;
    const prod=byType('hotel').find(p=>p.id===r.product_id);
    const cur=rowCur(r);
    const hasSplitMeal=typeof l.meal_unit_price==='number';
    if(l.with_meal&&!hasSplitMeal){ const combined=l.unit_price||toCurrencyFromSAR(hrp(prod,l.room_type as RoomTypeId,true),cur); const meal=toCurrencyFromSAR(getMealPriceSar(prod),cur); return Math.max(0,combined-meal); }
    return l.unit_price||toCurrencyFromSAR(hrp(prod,l.room_type as RoomTypeId,false),cur);
  };
  const getEffectiveMealPrice=(r:OrderItemRow,l:HotelRoomLine):number=>{
    if(r.type!=='hotel'||!l.with_meal) return 0;
    const prod=byType('hotel').find(p=>p.id===r.product_id);
    const cur=rowCur(r);
    const hasSplitMeal=typeof l.meal_unit_price==='number';
    if(!hasSplitMeal){ const combined=l.unit_price||toCurrencyFromSAR(hrp(prod,l.room_type as RoomTypeId,true),cur); const room=getEffectiveRoomPrice(r,l); return Math.max(0,combined-room); }
    return l.meal_unit_price??toCurrencyFromSAR(getMealPriceSar(prod),cur);
  };
  const nightsFor=(r:OrderItemRow)=> r.type==='hotel' ? getNights(r.check_in,r.check_out) : 0;
  const rowSub=(r:OrderItemRow)=>{
    if(r.type==='hotel'&&r.room_breakdown?.length){
      const hasDates = !!(r.check_in && r.check_out);
      if(!hasDates) return 0;
      const nights = nightsFor(r)||0;
      const multiplier = nights>0 ? nights : 1;
      return r.room_breakdown.reduce((s,l)=>s+Math.max(0,l.quantity)*getEffectiveLinePrice(r,l)*multiplier,0);
    }
    if(r.type==='hotel'&&r.room_type){
      const hasDates = !!(r.check_in && r.check_out);
      if(!hasDates) return 0;
      const nights = nightsFor(r)||0;
      const multiplier = nights>0 ? nights : 1;
      return Math.max(0,r.quantity)*(r.unit_price||0)*multiplier;
    }
    return Math.max(0,r.quantity)*(r.unit_price||0);
  };
  const rowPax=(r:OrderItemRow)=>{ if(r.type==='hotel'&&r.room_breakdown?.length) return r.room_breakdown.reduce((s,l)=>s+Math.max(0,l.quantity)*rCap(l.room_type||undefined),0); if(r.type==='hotel'&&r.room_type) return Math.max(0,r.quantity)*rCap(r.room_type); return 0; };
  const subtotalIDR=items.reduce((s,r)=>s+toIDR(rowSub(r),r),0);
  const totalBusPacks=items.filter(r=>r.type==='bus').reduce((s,r)=>s+Math.max(0,r.quantity),0);
  const busPenaltyIDR=totalBusPacks>0&&totalBusPacks<busPenaltyRule.bus_min_pack
    ?(busPenaltyRule.bus_min_pack-totalBusPacks)*busPenaltyRule.bus_penalty_idr
    :0;
  const totalIDR=subtotalIDR+busPenaltyIDR;
  const totalSAR=totalIDR/(effectiveRates.SAR_TO_IDR||4200);
  const totalPax=items.reduce((s,r)=>s+rowPax(r),0);
  const fmt=(n:number)=>new Intl.NumberFormat('id-ID').format(Math.round(n));

  /* submit */
  const latestRates = { SAR_TO_IDR: rates.SAR_TO_IDR ?? 4200, USD_TO_IDR: rates.USD_TO_IDR ?? 15500 };
  const buildPayloadWithRates=(valid:OrderItemRow[])=>{
    const out:Record<string,any>[]=[];
    for(const r of valid){
      if(r.type==='hotel'&&r.room_breakdown?.length){
        for(const l of r.room_breakdown){
          if(l.quantity<=0||!l.room_type) continue;
          const meal=l.with_meal??false;
          const meta:Record<string,unknown>={room_type:l.room_type,with_meal:meal}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out;
          const key=`hotel:${r.product_id}:${l.room_type}:${r.check_in||''}:${r.check_out||''}`;
          const isNew=!initialOrderItemKeysRef.current.has(key);
          const useLatestRates=hasDpPayment&&isNew;
          const unitPriceIdr=useLatestRates?toIDRWithRates(l.unit_price,r,latestRates):toIDR(l.unit_price,r);
          const item:Record<string,any>={product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:l.quantity,unit_price:unitPriceIdr,room_type:l.room_type,meal,check_in:r.check_in,check_out:r.check_out,meta};
          if(useLatestRates) item.currency_rates_override=latestRates;
          out.push(item);
        }
      } else if(r.type==='hotel'&&r.room_type){
        const meta:Record<string,unknown>={room_type:r.room_type}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out;
        const key=`hotel:${r.product_id}:${r.room_type}:${r.check_in||''}:${r.check_out||''}`;
        const isNew=!initialOrderItemKeysRef.current.has(key);
        const useLatestRates=hasDpPayment&&isNew;
        const unitPriceIdr=useLatestRates?toIDRWithRates(r.unit_price,r,latestRates):toIDR(r.unit_price,r);
        const item:Record<string,any>={product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:Math.max(1,r.quantity),unit_price:unitPriceIdr,room_type:r.room_type,check_in:r.check_in,check_out:r.check_out,meta};
        if(useLatestRates) item.currency_rates_override=latestRates;
        out.push(item);
      } else{
        const metaKey=JSON.stringify(r.meta||{});
        const key=`${r.type}:${r.product_id}:${metaKey}`;
        const isNew=!initialOrderItemKeysRef.current.has(key);
        const useLatestRates=hasDpPayment&&isNew;
        const unitPriceIdr=useLatestRates?toIDRWithRates(r.unit_price,r,latestRates):toIDR(r.unit_price,r);
        const item:Record<string,any>={product_id:r.product_id,type:r.type,product_ref_type:r.type==='package'?'package':'product',quantity:Math.max(1,r.quantity),unit_price:unitPriceIdr};
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
  const validForRates=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some(l=>l.room_type&&l.quantity>0)||(r.room_type&&r.quantity>0); return r.quantity>0; });
  const hasNewItemsAfterDp=hasDpPayment&&validForRates.some(r=>{
    if(r.type==='hotel'&&r.room_breakdown?.length){ for(const l of r.room_breakdown){ if(l.quantity<=0||!l.room_type) continue; const key=`hotel:${r.product_id}:${l.room_type}:${r.check_in||''}:${r.check_out||''}`; if(!initialOrderItemKeysRef.current.has(key)) return true; } return false; }
    if(r.type==='hotel'&&r.room_type){ const key=`hotel:${r.product_id}:${r.room_type}:${r.check_in||''}:${r.check_out||''}`; return !initialOrderItemKeysRef.current.has(key); }
    const key=`${r.type}:${r.product_id}:${JSON.stringify(r.meta||{})}`;
    return !initialOrderItemKeysRef.current.has(key);
  });
  const handleSubmit=(e:React.FormEvent)=>{
    e.preventDefault();
    const valid=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some(l=>l.room_type&&l.quantity>0)||(r.room_type&&r.quantity>0); return r.quantity>0; });
    if(!valid.length){ showToast('Minimal satu item dengan produk dan qty > 0','warning'); return; }
    const hotelWithoutDates=valid.filter(r=>r.type==='hotel'&&(!r.check_in||!r.check_out));
    if(hotelWithoutDates.length){ showToast('Item hotel wajib isi tanggal Check-in dan Check-out','warning'); return; }
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
    if(!isEdit&&!isOwner&&!canPickOwner&&!branchId){ showToast('Pilih cabang terlebih dahulu','warning'); return; }
    if(canPickOwner&&!ownerSel){ showToast('Pilih owner untuk order ini','warning'); return; }
    if(canPickOwner&&ownerSel&&!bFromOwner){ showToast('Owner belum memiliki cabang','warning'); return; }
    const payload=buildPayloadWithRates(valid);
    const ratesPayload=getRatesPayload();
    setSaving(true);
    if(isEdit&&orderId){
      ordersApi.update(orderId,{items:payload,...ratesPayload})
        .then(()=>{ showToast('Invoice diperbarui. Tagihan ikut diperbarui.','success'); navigate('/dashboard/orders-invoices', { state: { refreshList: true } }); })
        .catch((err:any)=>showToast(err.response?.data?.message||'Gagal memperbarui','error'))
        .finally(()=>setSaving(false));
    } else {
      const body:Record<string,any>={items:payload,...ratesPayload};
      if(!isOwner&&!canPickOwner&&branchId) body.branch_id=branchId;
      if(ownerId&&user?.role!=='owner') body.owner_id=ownerId;
      ordersApi.create(body)
        .then(()=>{ orderDraft.clear(); showToast('Invoice dibuat.','success'); navigate('/dashboard/orders-invoices',{state:{refreshList:true}}); })
        .catch((err:any)=>showToast(err.response?.data?.message||'Gagal membuat invoice','error'))
        .finally(()=>setSaving(false));
    }
  };

  const handleSaveDraft=(e?: React.MouseEvent)=>{
    e?.preventDefault();
    const valid=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some(l=>l.room_type&&l.quantity>0)||(r.room_type&&r.quantity>0); return r.quantity>0; });
    if(!valid.length){ showToast('Minimal satu item dengan produk dan qty > 0','warning'); return; }
    const hotelWithoutDates=valid.filter(r=>r.type==='hotel'&&(!r.check_in||!r.check_out));
    if(hotelWithoutDates.length){ showToast('Item hotel wajib isi tanggal Check-in dan Check-out','warning'); return; }
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
    if(!isEdit&&!isOwner&&!canPickOwner&&!branchId){ showToast('Pilih cabang terlebih dahulu','warning'); return; }
    if(canPickOwner&&!ownerSel){ showToast('Pilih owner untuk invoice ini','warning'); return; }
    if(canPickOwner&&ownerSel&&!bFromOwner){ showToast('Owner belum memiliki cabang','warning'); return; }
    const payload=buildPayloadWithRates(valid);
    const ratesPayload=getRatesPayload();
    setSaving(true);
    if(isEdit&&orderId){
      ordersApi.update(orderId,{items:payload,...ratesPayload})
        .then(()=>{ showToast('Draft disimpan. Invoice belum diterbitkan.','success'); setSaving(false); })
        .catch((err:any)=>showToast(err.response?.data?.message||'Gagal menyimpan draft','error'))
        .finally(()=>setSaving(false));
    } else {
      const body:Record<string,any>={items:payload,save_as_draft:true,...ratesPayload};
      if(!isOwner&&!canPickOwner&&branchId) body.branch_id=branchId;
      if(ownerId&&user?.role!=='owner') body.owner_id=ownerId;
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
    setSaving(true);
    invoicesApi.create({order_id:orderId})
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
                <span className="font-bold tabular-nums">{formatSAR(totalSAR)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm">
                <span className="text-xs text-slate-500">IDR</span>
                <span className="font-semibold tabular-nums">{formatIDR(totalIDR)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm">
                <span className="text-xs text-slate-500">USD</span>
                <span className="font-semibold tabular-nums">{formatUSD(totalIDR/(effectiveRates.USD_TO_IDR||15500))}</span>
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
        {/* Cabang */}
        {!isEdit&&!isOwner&&!canPickOwner&&branches.length>0&&(
          <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#0D1A63]/10 text-[#0D1A63]">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Cabang</h2>
                <p className="text-xs text-slate-500">Pilih cabang untuk order ini</p>
              </div>
            </div>
            <div className="p-4">
              <Autocomplete label="Cabang" value={branchSel} onChange={v=>{setBranchSel(v);setOwnerSel('');}} options={branches.map(b=>({ value: b.id, label: `${b.name} (${b.code})` }))} placeholder={AUTOCOMPLETE_PILIH.PILIH_CABANG} emptyLabel={AUTOCOMPLETE_PILIH.PILIH_CABANG} />
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
                <p className="text-xs text-slate-500">Order & cabang mengikuti owner yang dipilih</p>
              </div>
            </div>
            <div className="p-4">
              <Autocomplete label="Owner" value={ownerSel} onChange={setOwnerSel} options={owners.map(o=>{ const uid2=o.User?.id??o.user_id; const lbl=o.User?.company_name||o.User?.name||uid2; return { value: uid2, label: lbl }; })} placeholder={AUTOCOMPLETE_PILIH.PILIH_OWNER} emptyLabel={AUTOCOMPLETE_PILIH.PILIH_OWNER} />
            </div>
          </section>
        )}

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
                          <div className="min-w-0 flex-1 basis-40">
                            <Autocomplete label="Produk" value={row.product_id} onChange={v=>{ const p=byType(row.type).find(x=>x.id===v); updateRow(row.id,{product_id:v,product_name:p?.name??'',unit_price:p?effP(p):0}); }} options={byType(row.type).map(p=>({value:p.id,label:`${p.name} (${p.code})`}))} emptyLabel="— Pilih produk —" />
                          </div>
                          {canEditPrice && (
                            <div className="min-w-[80px] flex-1 sm:flex-initial sm:w-[100px]">
                              <Autocomplete label="Mata uang" value={row.price_currency ?? getDisplayCurrency(row.type, products.find(x=>x.id===row.product_id))} onChange={v=>updateRow(row.id,{ price_currency: (v==='' ? undefined : v) as DisplayCurrency })} options={currencyOptionsFromProducts} />
                            </div>
                          )}
                          <div className="text-right min-w-[80px] shrink-0 text-white">
                            <p className="text-xs font-medium uppercase tracking-wide opacity-90">Subtotal</p>
                            <p className="text-sm font-bold tabular-nums">{rowCur(row)==='SAR'?`${fmt(rowSub(row))} SAR`:rowCur(row)==='USD'?formatUSD(rowSub(row)):formatIDR(rowSub(row))}</p>
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
                                  <div className="min-w-0">
                                    <Input label="Check-in" type="date" value={row.check_in ?? ''} onChange={e => updateRow(row.id, { check_in: e.target.value || undefined })} />
                                    <p className="text-xs text-slate-400 mt-1">Jam 16:00</p>
                                  </div>
                                  <div className="min-w-0">
                                    <Input label="Check-out" type="date" value={row.check_out ?? ''} onChange={e => updateRow(row.id, { check_out: e.target.value || undefined })} />
                                    <p className="text-xs text-slate-400 mt-1">Jam 12:00</p>
                                  </div>
                                  {row.check_in && row.check_out && (
                                    <div className="flex items-center gap-2 py-2.5 px-4 rounded-lg bg-slate-100 border border-slate-200/80 text-sm font-medium text-slate-700 col-span-full">
                                      <span>Malam:</span>
                                      <span className="tabular-nums font-semibold text-slate-900">{getNights(row.check_in, row.check_out)}</span>
                                      {getNights(row.check_in, row.check_out) === 0 && <span className="text-amber-600 text-xs">(Check-out &gt; Check-in)</span>}
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
                                                  {rt} <span className="ml-1.5 font-semibold tabular-nums text-slate-900">{n.toLocaleString('id-ID')}</span>
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
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipe kamar & harga</p>
                              {(row.room_breakdown||[]).map(line=>(
                                <div key={line.id} className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-slate-50/60 border border-slate-100">
                                  <div className="min-w-[100px] flex-1 sm:max-w-[140px]">
                                    <Autocomplete label="Tipe Kamar" value={line.room_type ?? ''} onChange={v=>{ const rt=v as RoomTypeId|''; const cur=rowCur(row); updLine(row.id,line.id,{room_type:rt,unit_price:rt?toCurrencyFromSAR(hrp(hProd,rt,false),cur):0,meal_unit_price:line.with_meal&&rt?toCurrencyFromSAR(getMealPriceSar(hProd),cur):(line.meal_unit_price??0)}); }} options={(()=>{ const rb=hProd?.room_breakdown??hProd?.prices_by_room??{}; const ids=Object.keys(rb); return ids.map(id=>({ value: id, label: `${ROOM_TYPES.find(rt=>rt.id===id)?.label ?? id} · ${ROOM_TYPES.find(rt=>rt.id===id)?.cap ?? 0}px` })); })()} emptyLabel="— Pilih —" />
                                  </div>
                                  <div className="w-16 min-w-[60px]">
                                    <Input label="Jumlah" type="number" min={0} value={line.quantity === undefined || line.quantity === null ? '' : String(line.quantity)} onChange={e=>{ const v=e.target.value; if(v===''){updLine(row.id,line.id,{quantity:0});return;} const n=parseInt(v,10); if(!isNaN(n)&&n>=0) updLine(row.id,line.id,{quantity:n}); }} />
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-500 text-sm pb-2.5"><Users size={14} className="text-slate-400"/>{Math.max(0,line.quantity)*rCap(line.room_type||undefined)} jamaah</div>
                                  <Button type="button" variant={line.with_meal?'primary':'outline'} size="sm" className="rounded-xl"
                                    onClick={()=>updLine(row.id,line.id,{with_meal:!(line.with_meal??false),meal_unit_price:(!(line.with_meal??false))?toCurrencyFromSAR(getMealPriceSar(hProd),rowCur(row)):0})}>
                                    <Utensils size={14} className="mr-1.5"/> Makan
                                  </Button>
                                  <div className="flex-1 min-w-[100px]">
                                    {canEditPrice ? (
                                      <Input label={`Harga kamar / malam (${rowCur(row)})`} type="number" min={0}
                                        value={(()=>{ const roomPrice=getEffectiveRoomPrice(row,line); const val=getInC(roomPrice,row,rowCur(row)); return String(Math.round(val*100)/100||''); })()}
                                        placeholder="0"
                                        onChange={e=>setLP(row.id,line.id,rowCur(row),parseFloat(e.target.value)||0)}/>
                                    ) : (
                                      <>
                                        <label className={labelClass}>Harga kamar / malam</label>
                                        <p className="text-sm font-bold text-slate-900 tabular-nums">{rowCur(row)==='SAR'?`${fmt(getEffectiveRoomPrice(row,line))} SAR`:rowCur(row)==='USD'?formatUSD(getEffectiveRoomPrice(row,line)):formatIDR(getEffectiveRoomPrice(row,line))}</p>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-[120px]">
                                    {canEditPrice ? (
                                      line.with_meal ? (
                                        <Input label={`Harga makan / malam (${rowCur(row)})`} type="number" min={0}
                                          value={(()=>{ const mealPrice=getEffectiveMealPrice(row,line); const val=getInC(mealPrice,row,rowCur(row)); return String(Math.round(val*100)/100||''); })()}
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
                                        <p className="text-sm font-bold text-slate-900 tabular-nums">{line.with_meal?(rowCur(row)==='SAR'?`${fmt(getEffectiveMealPrice(row,line))} SAR`:rowCur(row)==='USD'?formatUSD(getEffectiveMealPrice(row,line)):formatIDR(getEffectiveMealPrice(row,line))):'—'}</p>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-right min-w-[90px] shrink-0">
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Subtotal</p>
                                    {(()=>{
                                      const nights=nightsFor(row)||0;
                                      const pricePerNight=getEffectiveLinePrice(row,line);
                                      const qty=Math.max(0,line.quantity);
                                      const total=qty*pricePerNight*nights;
                                      if(nights>0){
                                        return <p className="text-sm font-bold text-slate-900 tabular-nums">{rowCur(row)==='SAR'?`${fmt(total)} SAR`:rowCur(row)==='USD'?formatUSD(total):formatIDR(total)}</p>;
                                      }
                                      const perNightLabel=rowCur(row)==='SAR'?`${fmt(qty*pricePerNight)} SAR/malam`:rowCur(row)==='USD'?formatUSD(qty*pricePerNight)+' USD/malam':formatIDR(qty*pricePerNight)+' IDR/malam';
                                      return <><p className="text-sm font-bold text-slate-900 tabular-nums">{perNightLabel}</p><p className="text-xs text-slate-500 mt-0.5">Isi check-in & check-out untuk total</p></>;
                                    })()}
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" onClick={()=>removeLine(row.id,line.id)} className="text-slate-500 hover:text-red-600">
                                    <Trash2 size={14}/>
                                  </Button>
                                </div>
                              ))}
                              {row.check_in && row.check_out && (row.room_breakdown?.length ?? 0) > 0 && getNights(row.check_in, row.check_out) > 0 && (
                                <div className="rounded-lg bg-slate-100/80 border border-slate-200 p-3 text-sm text-slate-700 space-y-1">
                                  <p className="font-semibold text-slate-800 text-xs">Hitungan (harga/malam × malam × kamar)</p>
                                  {(row.room_breakdown||[]).filter(l=>l.quantity>0&&l.room_type).map(line=>{
                                    const nights = getNights(row.check_in!, row.check_out!);
                                    const roomSar = getEffectiveRoomPrice(row, line);
                                    const mealSar = getEffectiveMealPrice(row, line);
                                    const lineTotalRoom = roomSar * line.quantity * nights;
                                    const lineTotalMeal = mealSar * line.quantity * nights;
                                    const roomLabel = ROOM_TYPES.find(t=>t.id===line.room_type)?.label ?? line.room_type;
                                    return (
                                      <div key={line.id} className="pl-2 border-l-2 border-slate-300">
                                        <p className="tabular-nums">Kamar {roomLabel}: {fmt(roomSar)} SAR/malam × {nights} malam × {line.quantity} kamar = {fmt(lineTotalRoom)} SAR</p>
                                        {line.with_meal && <p className="tabular-nums text-slate-600">Makan: {fmt(mealSar)} SAR/malam × {nights} malam × {line.quantity} kamar = {fmt(lineTotalMeal)} SAR</p>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <Button type="button" variant="outline" size="sm" onClick={()=>addLine(row.id)} className="w-full border-2 border-dashed border-slate-200 rounded-lg text-slate-600 hover:border-[#0D1A63]/50 hover:bg-[#0D1A63]/5 text-sm py-2">
                                <Plus size={14} className="mr-1"/> Tambah tipe kamar
                              </Button>
                            </>
                          ) : (
                            <div className="rounded-lg bg-slate-50/60 border border-slate-100 p-3">
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 items-end">
                              {row.type==='ticket' && (()=>{
                                const ticketProduct = products.find((p:ProductOption)=>p.type==='ticket'&&p.id===row.product_id);
                                const tripType:TicketTripType=(ticketProduct?.meta?.trip_type as TicketTripType)||(row.meta?.trip_type as TicketTripType)||'round_trip';
                                return (
                                <>
                                  <div className="min-w-0">
                                    <Autocomplete label="Bandara" value={(row.meta?.bandara as string)||''} onChange={v=>{ updateRow(row.id,{ meta: { ...(row.meta||{}), bandara:v } }); }} options={(ticketProduct?.bandara_options ?? []).map(b=>({value:b.bandara,label:`${b.name} (${b.bandara})`}))} emptyLabel="— Pilih bandara —" />
                                  </div>
                                  {tripType==='round_trip' && (
                                    <>
                                      <div className="min-w-0"><Input label="Tanggal pergi" type="date" value={(row.meta?.departure_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), departure_date: e.target.value || undefined } })} /></div>
                                      <div className="min-w-0"><Input label="Tanggal pulang" type="date" value={(row.meta?.return_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), return_date: e.target.value || undefined } })} /></div>
                                    </>
                                  )}
                                  {tripType==='one_way' && (
                                    <div className="min-w-0"><Input label="Tanggal pergi" type="date" value={(row.meta?.departure_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), departure_date: e.target.value || undefined, return_date: undefined } })} /></div>
                                  )}
                                  {tripType==='return_only' && (
                                    <div className="min-w-0"><Input label="Tanggal pulang" type="date" value={(row.meta?.return_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), return_date: e.target.value || undefined, departure_date: undefined } })} /></div>
                                  )}
                                </>
                                );
                              })()}
                              {row.type==='visa' && (
                                <div className="min-w-0"><Input label="Tanggal keberangkatan" type="date" value={(row.meta?.travel_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), travel_date: e.target.value || undefined } })} title="Untuk kuota kalender visa" /></div>
                              )}
                              {row.type==='bus' && (()=>{
                                const busProduct = products.find((p:ProductOption)=>p.type==='bus'&&p.id===row.product_id);
                                const productTripType = busProduct?.meta?.trip_type as TicketTripType | undefined;
                                const tripType = (row.meta?.trip_type as TicketTripType)||productTripType||'round_trip';
                                return (
                                <>
                                  <div className="min-w-0"><Input label="Tanggal keberangkatan" type="date" value={(row.meta?.travel_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), travel_date: e.target.value || undefined } })} title="Untuk kuota kalender bus" /></div>
                                  <div className="min-w-0"><Autocomplete label="Jenis bus" value={(row.meta?.bus_type as BusType)||'besar'} onChange={v=>{ const bus_type=v as BusType; updateRow(row.id,{ meta: { ...(row.meta||{}), bus_type, route_type:(row.meta?.route_type as BusRouteType)||'full_route', trip_type: tripType } }); }} options={(()=>{ const kind=busProduct?.meta?.bus_kind as string|undefined; const t=kind?BUS_KIND_TO_TYPE[kind]:undefined; if(!t) return []; const lbl=BUS_TYPE_LABELS[t]; return [{ value: t, label: lbl ?? t }]; })()} /></div>
                                  <div className="min-w-0"><Autocomplete label="Rute" value={(row.meta?.route_type as BusRouteType)||'full_route'} onChange={v=>{ const route_type=v as BusRouteType; updateRow(row.id,{ meta: { ...(row.meta||{}), route_type, trip_type: tripType, bus_type:(row.meta?.bus_type as BusType)||'besar' } }); }} options={(()=>{ const rp=busProduct?.meta?.route_prices as Record<string,number>|undefined; if(!rp) return []; return Object.entries(rp).filter(([,v])=>(v??0)>0).map(([k])=>({ value: k, label: BUS_ROUTE_LABELS[k] ?? k })); })()} /></div>
                                  {productTripType ? (
                                    <div className="min-w-0"><p className="text-sm font-medium text-slate-700 mb-0.5">Perjalanan</p><p className="text-sm text-slate-600">{TICKET_TRIP_LABELS[productTripType] ?? productTripType}</p></div>
                                  ) : (
                                    <div className="min-w-0"><Autocomplete label="Perjalanan" value={tripType} onChange={v=>{ const tt=v as TicketTripType; updateRow(row.id,{ meta: { ...(row.meta||{}), trip_type: tt, route_type:(row.meta?.route_type as BusRouteType)||'full_route', bus_type:(row.meta?.bus_type as BusType)||'besar' } }); }} options={(()=>{ const byTrip=busProduct?.meta?.route_prices_by_trip as Record<string,number>|undefined; const keys=byTrip?Object.keys(byTrip).filter(k=>['one_way','return_only','round_trip'].includes(k)):[]; return keys.map(k=>({ value: k, label: TICKET_TRIP_LABELS[k] ?? k })); })()} /></div>
                                  )}
                                </>
                                );
                              })()}
                              <div className="min-w-0 w-20">
                                <Input label="Qty" type="number" min={0} value={row.quantity === undefined || row.quantity === null ? '' : String(row.quantity)} onChange={e=>{ const v=e.target.value; if(v===''){updateRow(row.id,{quantity:0});return;} const n=parseInt(v,10); if(!isNaN(n)&&n>=0) updateRow(row.id,{quantity:n}); }} />
                              </div>
                              {canEditPrice ? (
                                <div className="min-w-0 col-span-2 sm:col-span-1 flex flex-col justify-end">
                                  <div className="flex items-center gap-2">
                                    <label className={`${labelClass} shrink-0 mb-0`}>Harga Satuan ({rowCur(row)})</label>
                                    <div className="flex-1 min-w-0">
                                      <Input fullWidth label="" type="number" min={0} value={(()=>{ const val=getInC(row.unit_price||0,row,rowCur(row)); return String(Math.round(val*100)/100||''); })()} placeholder="0" onChange={e=>setRP(row.id,rowCur(row),parseFloat(e.target.value)||0)} />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="min-w-0 flex flex-col justify-end">
                                  <div className="flex items-center gap-2">
                                    <label className={`${labelClass} mb-0 shrink-0`}>Harga Satuan ({rowCur(row)})</label>
                                    <p className="text-sm font-bold text-slate-900 tabular-nums">{rowCur(row)==='SAR'?`${fmt(row.unit_price||0)} SAR`:rowCur(row)==='USD'?formatUSD(row.unit_price||0):formatIDR(row.unit_price||0)}</p>
                                  </div>
                                </div>
                              )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <Button type="button" variant="outline" onClick={addRow} className="w-full py-4 rounded-xl border-2 border-dashed border-[#0D1A63]/40 bg-[#0D1A63]/5 text-[#0D1A63] hover:border-[#0D1A63] hover:bg-[#0D1A63]/10 transition-colors text-base font-semibold shadow-sm">
                    <Plus size={20} className="mr-2 inline shrink-0"/> Tambah item pemesanan
                  </Button>
                </>
              )}
          </div>
        </section>

        {/* Kurs untuk order ini */}
        {canEditPrice && (
          <section className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Kurs untuk order ini</h2>
                <p className="text-xs text-slate-500">{hasDpPayment ? 'Sudah ada DP: kurs order dipakai untuk item lama; kurs terbaru untuk item tambahan.' : 'Isi hanya jika ada permintaan khusus; kosong = pakai kurs dari sistem (Settings).'}</p>
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
                    <span>1 SAR = <b className="text-slate-900">{formatIDR(latestRates.SAR_TO_IDR)}</b></span>
                    <span>1 USD = <b className="text-slate-900">{formatIDR(latestRates.USD_TO_IDR)}</b></span>
                  </div>
                </div>
              )}
            </div>
          </section>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-primary-500/5 border border-primary-200/80 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total SAR</p>
                <p className="text-lg font-bold text-[#0D1A63] tabular-nums mt-0.5">{formatSAR(totalSAR)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total IDR</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">{formatIDR(totalIDR)}</p>
                <p className="text-xs text-slate-500">Tagihan Rupiah</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total USD</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">{formatUSD(totalIDR/(rates.USD_TO_IDR||15500))}</p>
                <p className="text-xs text-slate-500">Pembayaran USD</p>
              </div>
            </div>
            {busPenaltyIDR>0&&(
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
                <p className="text-amber-800 font-medium">Penalti bus: {totalBusPacks} pack (min {busPenaltyRule.bus_min_pack} pack)</p>
                <p className="text-slate-600 text-xs mt-0.5">{busPenaltyRule.bus_min_pack - totalBusPacks} pack × {formatIDR(busPenaltyRule.bus_penalty_idr)} = {formatIDR(busPenaltyIDR)}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span>1 SAR = <b className="text-slate-900">{formatIDR(rates.SAR_TO_IDR??4200)}</b></span>
              <span>1 USD = <b className="text-slate-900">{formatIDR(rates.USD_TO_IDR??15500)}</b></span>
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