import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Trash2, ArrowLeft, Hotel, Plane, FileText,
  Bus, Package, Users, Utensils, X, ChevronRight,
  Star, CreditCard, Building2, Loader2
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, ordersApi, invoicesApi, businessRulesApi, branchesApi, ownersApi } from '../../../services/api';
import { formatIDR, formatSAR, formatUSD } from '../../../utils';
import { fillFromSource } from '../../../utils/currencyConversion';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';

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

const BANDARA_TIKET = [
  { code: 'BTH', name: 'Batam' },
  { code: 'CGK', name: 'Jakarta' },
  { code: 'SBY', name: 'Surabaya' },
  { code: 'UPG', name: 'Makassar' },
] as const;

type TicketTripType = 'one_way' | 'return_only' | 'round_trip';
const TICKET_TRIP_OPTIONS: { value: TicketTripType; label: string }[] = [
  { value: 'one_way', label: 'Pergi saja' },
  { value: 'return_only', label: 'Pulang saja' },
  { value: 'round_trip', label: 'Pulang pergi' },
];

type BusRouteType = 'full_route' | 'bandara_makkah' | 'bandara_madinah' | 'bandara_madinah_only';
const BUS_ROUTE_OPTIONS: { value: BusRouteType; label: string }[] = [
  { value: 'full_route', label: 'Full rute (Mekkah–Madinah)' },
  { value: 'bandara_makkah', label: 'Bandara–Mekkah' },
  { value: 'bandara_madinah', label: 'Bandara–Madinah' },
  { value: 'bandara_madinah_only', label: 'Bandara–Madinah saja' },
];

type ItemType   = typeof ITEM_TYPES[number]['id'];
type RoomTypeId = typeof ROOM_TYPES[number]['id'];

interface ProductOption {
  id:string; name:string; code:string; type:string;
  is_package?:boolean; price_general?:number|null;
  price_branch?:number|null; price_owner?:number|null;
  currency?:string; meta?:{meal_price?:number;[k:string]:unknown};
  room_breakdown?:Record<string,any>; prices_by_room?:Record<string,any>;
  bandara_options?: Array<{ bandara: string; name: string; default: { price_idr: number; seat_quota?: number } }>;
  route_prices?: Partial<Record<BusRouteType, number>>;
}
interface HotelRoomLine { id:string; room_type:RoomTypeId; quantity:number; unit_price:number; with_meal?:boolean; }
interface OrderItemRow  { id:string; type:ItemType; product_id:string; product_name:string; quantity:number; room_type?:RoomTypeId; room_breakdown?:HotelRoomLine[]; unit_price:number; check_in?:string; check_out?:string; meta?:Record<string,unknown>; }
interface OwnerListItem { id:string; user_id:string; assigned_branch_id?:string; User?:{id:string;name?:string;company_name?:string}; AssignedBranch?:{id:string;code:string;name:string}; }

const uid  = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const newLine = (): HotelRoomLine => ({ id:`rl-${uid()}`, room_type:'quad', quantity:1, unit_price:0, with_meal:false });
const newRow  = (): OrderItemRow  => ({ id:`row-${uid()}`, type:'hotel', product_id:'', product_name:'', quantity:1, unit_price:0, room_breakdown:[newLine()] });
const rCap = (rt?:RoomTypeId) => rt ? (ROOM_TYPES.find(t=>t.id===rt)?.cap??0) : 0;
const canManage = (role?:string) => role==='owner' || role==='invoice_koordinator' || role==='role_invoice_saudi';
/** Jumlah malam dari check_in s/d check_out (tanggal saja). Return 0 jika invalid. */
function getNights(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn.slice(0, 10));
  const b = new Date(checkOut.slice(0, 10));
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return 0;
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow';
const selectClass = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow';
const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5';

const OrderFormPage: React.FC = () => {
  const { id: orderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user }  = useAuth();
  const { showToast } = useToast();
  const orderDraft = useOrderDraft();
  const isEdit = Boolean(orderId);

  // Owner tidak bisa mengubah harga (dapat harga khusus); invoice_koordinator boleh mengubah harga yang sudah ada.
  const canEditPrice = ['invoice_koordinator','role_invoice_saudi','super_admin','admin_pusat','admin_koordinator'].includes(user?.role ?? '');

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
  const [priceCur,    setPriceCur]   = useState<'IDR'|'SAR'|'USD'>('IDR');
  const [branches,    setBranches]   = useState<{id:string;code:string;name:string}[]>([]);
  const [branchSel,   setBranchSel]  = useState('');
  const [owners,      setOwners]     = useState<OwnerListItem[]>([]);
  const [ownerSel,    setOwnerSel]   = useState('');
  const [hotelAvailability, setHotelAvailability] = useState<Record<string, { byRoomType: Record<string, number> } | 'loading' | null>>({});

  const isOwner      = user?.role === 'owner';
  const canPickOwner = !isEdit && ['invoice_koordinator','role_invoice_saudi'].includes(user?.role ?? '');
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

  useEffect(()=>{
    if(!canPickOwner){ setOwners([]); return; }
    ownersApi.list({}).then(r=>{
      const data:OwnerListItem[]=(r.data as any)?.data??[];
      setOwners(data);
      setOwnerSel(p=>{ const f=data[0]; const fid=f?.User?.id??f?.user_id; return fid&&!p?fid:p; });
    }).catch(()=>{});
  },[canPickOwner]);

  // Kurs SAR & USD dari Menu Settings (global business rules); mata uang lain mengikuti.
  useEffect(()=>{
    businessRulesApi.get().then(r=>{
      let cr=(r.data as any)?.data?.currency_rates;
      if(typeof cr==='string'){ try{ cr=JSON.parse(cr); }catch{ cr=null; } }
      const s=typeof cr?.SAR_TO_IDR==='number'?cr.SAR_TO_IDR:4200;
      const u=typeof cr?.USD_TO_IDR==='number'?cr.USD_TO_IDR:15500;
      setRates({SAR_TO_IDR:s, USD_TO_IDR:u});
    }).catch(()=>setRates({SAR_TO_IDR:4200,USD_TO_IDR:15500}));
  },[]);

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
    if(ois.length===0){ setItems([newRow()]); return; }
    const s2i=rates.SAR_TO_IDR||4200;
    const getVal=(o:any,k:string)=>o[k]??o[k.replace(/([A-Z])/g,'_$1').toLowerCase().replace(/^_/,'')];
    const qty=(o:any)=>Math.max(0,Number(getVal(o,'quantity'))||0);
    const disp=(p:number,pid:string)=>{ const pr=products.find(x=>x.id===pid); return pr?.currency==='SAR'?(p||0)/s2i:(p||0); };
    const seen=new Set<string>(); const rows:OrderItemRow[]=[];
    for(const oi of ois){
      const meta=typeof oi.meta==='object'?oi.meta:{};
      const typeVal=getVal(oi,'type');
      const t=(typeVal||'hotel') as ItemType;
      const productRefId=getVal(oi,'product_ref_id')||'';
      const unitPrice=disp(parseFloat(getVal(oi,'unit_price'))||0,productRefId);
      const productName=oi.Product?.name??getVal(oi,'Product')?.name??'';
      if(t==='hotel'&&productRefId){
        if(!seen.has(productRefId)){
          seen.add(productRefId);
          const grp=ois.filter((o:any)=>(getVal(o,'type')==='hotel')&&(getVal(o,'product_ref_id')===productRefId));
          const firstMeta=typeof grp[0]?.meta==='object'?grp[0].meta:{};
          const checkIn=(firstMeta.check_in??getVal(grp[0],'check_in')) as string|undefined;
          const checkOut=(firstMeta.check_out??getVal(grp[0],'check_out')) as string|undefined;
          rows.push({ id:oi.id||`row-${uid()}`, type:'hotel', product_id:productRefId, product_name:productName,
            quantity:grp.reduce((s:number,o:any)=>s+qty(o),0),
            unit_price:unitPrice,
            check_in:checkIn||undefined,
            check_out:checkOut||undefined,
            room_breakdown:grp.map((o:any)=>{ const m=typeof o.meta==='object'?o.meta:{}; const rt=((m.room_type??getVal(o,'room_type'))||'quad') as RoomTypeId; return{ id:o.id||`rl-${uid()}`, room_type:rt, quantity:qty(o), unit_price:disp(parseFloat(getVal(o,'unit_price'))||0,productRefId), with_meal:!!(m.with_meal??m.meal) }; })
          });
        }
      } else {
        rows.push({ id:oi.id||`row-${uid()}`, type:t, product_id:productRefId, product_name:productName, quantity:Math.max(0,qty(oi)), room_type:(meta.room_type??getVal(oi,'room_type')) as RoomTypeId|undefined, unit_price:unitPrice, meta:Object.keys(meta).length?meta:undefined });
      }
    }
    setItems(rows.length?rows:[newRow()]);
  },[orderId,order,products,rates.SAR_TO_IDR]);

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
  const effP=(p:ProductOption)=>{ const n=p.price_owner??p.price_branch??p.price_general; return typeof n==='number'&&!isNaN(n)?n:0; };
  const ticketPrice=(p:ProductOption|undefined,bandara:string)=>{ if(!p?.bandara_options) return 0; const opt=p.bandara_options.find(b=>b.bandara===bandara); return (opt?.default?.price_idr != null && !isNaN(opt.default.price_idr)) ? Number(opt.default.price_idr) : 0; };
  const busRoutePrice=(p:ProductOption|undefined,route:BusRouteType)=>{ if(!p) return 0; const rp=p.meta?.route_prices as Record<string,number>|undefined; if(rp&&typeof rp[route]==='number') return rp[route]; return effP(p); };
  const hrp=(p:ProductOption|undefined,rt:RoomTypeId,meal:boolean)=>{ if(!p) return 0; const rb=p.room_breakdown??p.prices_by_room??{}; const base=rb[rt]?.price??effP(p); return meal?base+((p.meta?.meal_price as number|undefined)??0):base; };
  const rowCur=(row:OrderItemRow):'SAR'|'IDR'=> products.find(x=>x.id===row.product_id)?.currency==='SAR'?'SAR':'IDR';
  const toIDR=(price:number,row:OrderItemRow)=> rowCur(row)==='SAR'?price*(rates.SAR_TO_IDR||4200):price;
  const getInC=(priceInRow:number,row:OrderItemRow,cur:'IDR'|'SAR'|'USD')=>{ const idr=toIDR(priceInRow,row); const t=fillFromSource('IDR',idr,rates); return cur==='IDR'?t.idr:cur==='SAR'?t.sar:t.usd; };
  const setRP=(rowId:string,cur:'IDR'|'SAR'|'USD',val:number)=>{ const row=items.find(r=>r.id===rowId); if(!row) return; const idr=cur==='IDR'?val:cur==='SAR'?val*(rates.SAR_TO_IDR||4200):val*(rates.USD_TO_IDR||15500); updateRow(rowId,{unit_price:rowCur(row)==='SAR'?idr/(rates.SAR_TO_IDR||4200):idr}); };
  const setLP=(rowId:string,lineId:string,cur:'IDR'|'SAR'|'USD',val:number)=>{ const row=items.find(r=>r.id===rowId); if(!row) return; const idr=cur==='IDR'?val:cur==='SAR'?val*(rates.SAR_TO_IDR||4200):val*(rates.USD_TO_IDR||15500); updLine(rowId,lineId,{unit_price:rowCur(row)==='SAR'?idr/(rates.SAR_TO_IDR||4200):idr}); };

  /* mutations */
  const addRow   =()=>setItems(p=>[...p,newRow()]);
  const removeRow=(id:string)=>setItems(p=>{ const n=p.filter(r=>r.id!==id); return n.length?n:[newRow()]; });
  const addLine  =(rowId:string)=>{ const row=items.find(r=>r.id===rowId); if(!row||row.type!=='hotel') return; const prod=byType('hotel').find(p=>p.id===row.product_id); const line:HotelRoomLine={id:`rl-${uid()}`,room_type:'quad',quantity:1,unit_price:hrp(prod,'quad',false),with_meal:false}; setItems(p=>p.map(r=>r.id!==rowId?r:{...r,room_breakdown:[...(r.room_breakdown||[]),line]})); };
  const removeLine=(rowId:string,lineId:string)=>setItems(p=>p.map(r=>r.id!==rowId?r:{...r,room_breakdown:(r.room_breakdown||[]).filter(l=>l.id!==lineId)}));
  const updLine=(rowId:string,lineId:string,upd:Partial<HotelRoomLine>)=>setItems(p=>p.map(r=>{ if(r.id!==rowId||!r.room_breakdown) return r; return{...r,room_breakdown:r.room_breakdown.map(l=>l.id!==lineId?l:{...l,...upd})}; }));
  const updateRow=(rowId:string,upd:Partial<OrderItemRow>)=>setItems(p=>p.map(r=>{
    if(r.id!==rowId) return r;
    const next={...r,...upd};
    if(upd.product_id!=null){
      const prod=byType(next.type).find(x=>x.id===upd.product_id);
      if(prod){
        next.product_name=prod.name;
        if(next.type==='ticket'){
          const bandara=(next.meta?.bandara as string)||(prod.bandara_options?.[0]?.bandara)||'BTH';
          next.meta={ ...(next.meta||{}), bandara, trip_type:(next.meta?.trip_type as TicketTripType)||'round_trip' };
          next.unit_price=next.unit_price===0||upd.product_id!==r.product_id?ticketPrice(prod,bandara):next.unit_price;
        } else if(next.type==='bus'){
          const rp=prod.meta?.route_prices as Record<string,number>|undefined;
          const routeOption=BUS_ROUTE_OPTIONS.find(o=>(rp?.[o.value] ?? 0)>0);
          const routeOpt=routeOption?.value;
          const route:BusRouteType=(next.meta?.route_type as BusRouteType)||routeOpt||'full_route';
          next.meta={ ...(next.meta||{}), route_type:route, trip_type:(next.meta?.trip_type as TicketTripType)||(prod.meta?.trip_type as TicketTripType)||'round_trip', bus_type:(next.meta?.bus_type as string)||'besar' };
          next.unit_price=next.unit_price===0||upd.product_id!==r.product_id?busRoutePrice(prod,route):next.unit_price;
        } else {
          if(next.unit_price===0||upd.product_id!==r.product_id) next.unit_price=effP(prod);
        }
        if(next.type==='hotel'&&!(next.room_breakdown?.length)) next.room_breakdown=[{id:`rl-${uid()}`,room_type:'quad',quantity:1,unit_price:hrp(prod,'quad',false),with_meal:false}];
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
      if(prodBus) next.unit_price=busRoutePrice(prodBus,route);
    }
    if(upd.type!=null&&upd.type!==r.type){
      next.product_id=''; next.product_name=''; next.unit_price=0; next.meta=undefined;
      if(upd.type!=='hotel'){ next.room_type=undefined; next.room_breakdown=undefined; } else next.room_breakdown=next.room_breakdown??[];
    }
    return next;
  }));

  /* totals — hotel: harga per malam × jumlah malam × qty; non-hotel: unit_price × qty */
  const nightsFor=(r:OrderItemRow)=> r.type==='hotel' ? getNights(r.check_in,r.check_out) : 0;
  const rowSub=(r:OrderItemRow)=>{
    if(r.type==='hotel'&&r.room_breakdown?.length){
      const nights=nightsFor(r)||0;
      return r.room_breakdown.reduce((s,l)=>s+Math.max(0,l.quantity)*(l.unit_price||0)*nights,0);
    }
    if(r.type==='hotel'&&r.room_type) return Math.max(0,r.quantity)*(r.unit_price||0)*(nightsFor(r)||0);
    return Math.max(0,r.quantity)*(r.unit_price||0);
  };
  const rowPax=(r:OrderItemRow)=>{ if(r.type==='hotel'&&r.room_breakdown?.length) return r.room_breakdown.reduce((s,l)=>s+Math.max(0,l.quantity)*rCap(l.room_type),0); if(r.type==='hotel'&&r.room_type) return Math.max(0,r.quantity)*rCap(r.room_type); return 0; };
  const rowSAR=(r:OrderItemRow)=>{ const raw=rowSub(r); return rowCur(r)==='SAR'?raw:raw/(rates.SAR_TO_IDR||4200); };
  const totalSAR=items.reduce((s,r)=>s+rowSAR(r),0);
  const totalIDR=totalSAR*(rates.SAR_TO_IDR||4200);
  const totalPax=items.reduce((s,r)=>s+rowPax(r),0);
  const fmt=(n:number)=>new Intl.NumberFormat('id-ID').format(Math.round(n));

  /* submit */
  const handleSubmit=(e:React.FormEvent)=>{
    e.preventDefault();
    const valid=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some(l=>l.quantity>0)||(r.room_type&&r.quantity>0); return r.quantity>0; });
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
    const s2i=rates.SAR_TO_IDR||4200;
    const tIDR=(price:number,row:OrderItemRow)=>rowCur(row)==='SAR'?price*s2i:price;
    const payload:Record<string,any>[]=[];
    for(const r of valid){
      if(r.type==='hotel'&&r.room_breakdown?.length){ for(const l of r.room_breakdown){ if(l.quantity<=0) continue; const meal=l.with_meal??false; const meta:Record<string,unknown>={room_type:l.room_type,with_meal:meal}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; payload.push({product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:l.quantity,unit_price:tIDR(l.unit_price,r),room_type:l.room_type,meal,check_in:r.check_in,check_out:r.check_out,meta}); } }
      else if(r.type==='hotel'&&r.room_type){ const meta:Record<string,unknown>={room_type:r.room_type}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; payload.push({product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:Math.max(1,r.quantity),unit_price:tIDR(r.unit_price,r),room_type:r.room_type,check_in:r.check_in,check_out:r.check_out,meta}); }
      else{ const item:Record<string,any>={product_id:r.product_id,type:r.type,product_ref_type:r.type==='package'?'package':'product',quantity:Math.max(1,r.quantity),unit_price:tIDR(r.unit_price,r)}; if(r.meta&&Object.keys(r.meta).length) item.meta=r.meta; payload.push(item); }
    }
    setSaving(true);
    if(isEdit&&orderId){
      ordersApi.update(orderId,{items:payload})
        .then(()=>{ showToast('Invoice diperbarui. Tagihan ikut diperbarui.','success'); navigate('/dashboard/orders-invoices', { state: { refreshList: true } }); })
        .catch((err:any)=>showToast(err.response?.data?.message||'Gagal memperbarui','error'))
        .finally(()=>setSaving(false));
    } else {
      const body:Record<string,any>={items:payload};
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
    const valid=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some(l=>l.quantity>0)||(r.room_type&&r.quantity>0); return r.quantity>0; });
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
    const s2i=rates.SAR_TO_IDR||4200;
    const tIDR=(price:number,row:OrderItemRow)=>rowCur(row)==='SAR'?price*s2i:price;
    const payload:Record<string,any>[]=[];
    for(const r of valid){
      if(r.type==='hotel'&&r.room_breakdown?.length){ for(const l of r.room_breakdown){ if(l.quantity<=0) continue; const meal=l.with_meal??false; const meta:Record<string,unknown>={room_type:l.room_type,with_meal:meal}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; payload.push({product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:l.quantity,unit_price:tIDR(l.unit_price,r),room_type:l.room_type,meal,check_in:r.check_in,check_out:r.check_out,meta}); } }
      else if(r.type==='hotel'&&r.room_type){ const meta:Record<string,unknown>={room_type:r.room_type}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; payload.push({product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:Math.max(1,r.quantity),unit_price:tIDR(r.unit_price,r),room_type:r.room_type,check_in:r.check_in,check_out:r.check_out,meta}); }
      else{ const item:Record<string,any>={product_id:r.product_id,type:r.type,product_ref_type:r.type==='package'?'package':'product',quantity:Math.max(1,r.quantity),unit_price:tIDR(r.unit_price,r)}; if(r.meta&&Object.keys(r.meta).length) item.meta=r.meta; payload.push(item); }
    }
    setSaving(true);
    if(isEdit&&orderId){
      ordersApi.update(orderId,{items:payload})
        .then(()=>{ showToast('Draft disimpan. Invoice belum diterbitkan.','success'); setSaving(false); })
        .catch((err:any)=>showToast(err.response?.data?.message||'Gagal menyimpan draft','error'))
        .finally(()=>setSaving(false));
    } else {
      const body:Record<string,any>={items:payload,save_as_draft:true};
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-600">
      <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
      <span className="text-sm font-medium">Memuat detail order…</span>
    </div>
  );

  return (
    <div className="min-h-full w-full">
      {/* Header — compact, modern */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={()=>navigate('/dashboard/orders-invoices?tab=invoices')}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shrink-0"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 truncate">{isEdit ? 'Perbarui invoice' : 'Buat invoice baru'}</h1>
            <p className="text-xs text-slate-500">{isEdit ? 'Edit invoice' : 'Invoice baru'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-primary-500 text-white">
            <span className="text-sm font-bold tabular-nums">{formatSAR(totalSAR)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
            <span className="text-sm font-bold tabular-nums">{formatIDR(totalIDR)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
            <span className="text-sm font-bold tabular-nums">{formatUSD(totalIDR/(rates.USD_TO_IDR||15500))}</span>
          </div>
          {totalPax>0&&(
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
              <span className="text-sm font-bold tabular-nums">{totalPax}</span>
              <span className="text-xs text-slate-500 ml-1">Jamaah</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cabang */}
        {!isEdit&&!isOwner&&!canPickOwner&&branches.length>0&&(
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-primary-500" /> Cabang
            </h3>
            <Card padding="md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Pilih Cabang</h4>
                  <p className="text-xs text-slate-500">Wajib untuk membuat order</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cabang</label>
                  <select className={selectClass} value={branchSel} onChange={e=>{setBranchSel(e.target.value);setOwnerSel('');}} required>
                    <option value="">— Pilih cabang —</option>
                    {branches.map(b=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                  </select>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Owner */}
        {canPickOwner&&(
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-primary-500" /> Owner
            </h3>
            <Card padding="md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Pilih Owner</h4>
                  <p className="text-xs text-slate-500">Order & cabang mengikuti owner yang dipilih</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Owner</label>
                  <select className={selectClass} value={ownerSel} onChange={e=>setOwnerSel(e.target.value)} required>
                    <option value="">— Pilih owner —</option>
                    {owners.map(o=>{ const uid2=o.User?.id??o.user_id; const lbl=o.User?.company_name||o.User?.name||uid2; return <option key={uid2} value={uid2}>{lbl}</option>; })}
                  </select>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Item Pemesanan */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-primary-500" /> Item Pemesanan
          </h3>
          <Card padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h4 className="font-semibold text-slate-900">Daftar Item</h4>
              </div>
              {canEditPrice&&(
                <div className="flex flex-wrap items-center gap-2 text-slate-600">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ubah harga dalam</span>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                    {(['IDR','SAR','USD'] as const).map(c=>(
                      <button key={c} type="button"
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${priceCur===c ? 'bg-primary-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        onClick={()=>setPriceCur(c)} title={`Edit dalam ${c}; mata uang lain menyesuaikan otomatis`}>{c}</button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">Kurs dari Menu Settings.</span>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {loadingProd ? (
                <div className="flex items-center gap-3 py-4 text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-primary-500" /> Memuat produk…
                </div>
              ) : (
                <>
                  {items.map(row=>{
                    const tc=typeOf(row.type);
                    const hProd=row.type==='hotel'?byType('hotel').find(p=>p.id===row.product_id):undefined;
                    return (
                      <div key={row.id} className="border border-slate-200 rounded-xl bg-slate-50/50 p-4 space-y-4">
                        {/* Baris: tipe + produk + subtotal + hapus */}
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0">
                            <tc.Icon size={16}/>
                          </div>
                          <div className="min-w-[100px]">
                            <label className={labelClass}>Tipe</label>
                            <select className={selectClass} value={row.type} onChange={e=>updateRow(row.id,{type:e.target.value as ItemType})}>
                              {ITEM_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                          </div>
                          <div className="flex-1 min-w-[180px]">
                            <label className={labelClass}>Produk</label>
                            <select className={selectClass} value={row.product_id}
                              onChange={e=>{ const p=byType(row.type).find(x=>x.id===e.target.value); updateRow(row.id,{product_id:e.target.value,product_name:p?.name??'',unit_price:p?effP(p):0}); }}>
                              <option value="">— Pilih produk —</option>
                              {byType(row.type).map(p=><option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                            </select>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Subtotal</p>
                            <p className="text-sm font-bold text-slate-900 tabular-nums">{rowCur(row)==='SAR'?`${fmt(rowSub(row))} SAR`:formatIDR(rowSub(row))}</p>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={()=>removeRow(row.id)} className="text-slate-500 hover:text-red-600 shrink-0">
                            <X size={16}/>
                          </Button>
                        </div>
                        {/* Body: hotel (tanggal + room lines) atau non-hotel (qty + harga) */}
                        <div className="pl-0 sm:pl-12 space-y-4 border-t border-slate-200 pt-4">
                          {row.type==='hotel' ? (
                            <>
                              <div className="flex flex-wrap gap-4">
                                <div>
                                  <label className={labelClass}>Check-in</label>
                                  <input type="date" className={inputClass} style={{ minWidth: 140 }} value={row.check_in ?? ''} onChange={e => updateRow(row.id, { check_in: e.target.value || undefined })} />
                                </div>
                                <div>
                                  <label className={labelClass}>Check-out</label>
                                  <input type="date" className={inputClass} style={{ minWidth: 140 }} value={row.check_out ?? ''} onChange={e => updateRow(row.id, { check_out: e.target.value || undefined })} />
                                </div>
                                {row.check_in && row.check_out && (
                                  <div className="self-end text-sm font-medium text-slate-700">
                                    Jumlah malam: <span className="tabular-nums">{getNights(row.check_in, row.check_out)}</span>
                                    {getNights(row.check_in, row.check_out) === 0 && <span className="text-amber-600 ml-1">(Check-out harus setelah Check-in)</span>}
                                  </div>
                                )}
                                {row.product_id && row.check_in && row.check_out && (
                                  <div className="self-end text-sm text-slate-600">
                                    {hotelAvailability[row.id] === 'loading' && <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Memuat ketersediaan…</span>}
                                    {hotelAvailability[row.id] && typeof hotelAvailability[row.id] === 'object' && (
                                      <span>Tersedia: {Object.entries((hotelAvailability[row.id] as { byRoomType: Record<string, number> }).byRoomType).filter(([, n]) => n > 0).map(([rt, n]) => `${rt} ${n}`).join(', ') || '—'}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {row.check_in && row.check_out && (row.room_breakdown?.length ?? 0) > 0 && getNights(row.check_in, row.check_out) > 0 && (
                                <div className="rounded-lg bg-slate-100 border border-slate-200 p-3 text-sm text-slate-700 space-y-1">
                                  <p className="font-semibold text-slate-800 mb-2">Hitungan (harga SAR per malam × jumlah malam × kamar):</p>
                                  {(row.room_breakdown||[]).filter(l=>l.quantity>0).map(line=>{
                                    const nights = getNights(row.check_in!, row.check_out!);
                                    const roomOnly = hrp(hProd, line.room_type, false);
                                    const mealPrice = (hProd?.meta?.meal_price as number|undefined) ?? 0;
                                    const s2i = rates.SAR_TO_IDR || 4200;
                                    const toSAR = (p: number) => rowCur(row)==='SAR' ? p : p / s2i;
                                    const roomSar = toSAR(roomOnly);
                                    const mealSar = toSAR(mealPrice);
                                    const lineTotalRoom = roomSar * line.quantity * nights;
                                    const lineTotalMeal = (line.with_meal ? mealSar * line.quantity * nights : 0);
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
                              {(row.room_breakdown||[]).map(line=>(
                                <div key={line.id} className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-white border border-slate-200">
                                  <div className="w-28">
                                    <label className={labelClass}>Tipe Kamar</label>
                                    <select className={selectClass} value={line.room_type}
                                      onChange={e=>{ const rt=e.target.value as RoomTypeId; updLine(row.id,line.id,{room_type:rt,unit_price:hrp(hProd,rt,line.with_meal??false)}); }}>
                                      {ROOM_TYPES.map(rt=><option key={rt.id} value={rt.id}>{rt.label} · {rt.cap}px</option>)}
                                    </select>
                                  </div>
                                  <div className="w-20">
                                    <label className={labelClass}>Kamar</label>
                                    <input type="number" min="0" className={inputClass} value={line.quantity||''} placeholder="0"
                                      onChange={e=>{ const v=e.target.value; if(v===''){updLine(row.id,line.id,{quantity:0});return;} const n=parseInt(v,10); if(!isNaN(n)&&n>=0) updLine(row.id,line.id,{quantity:n}); }}/>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-500 text-sm pb-2.5"><Users size={12}/>{Math.max(0,line.quantity)*rCap(line.room_type)} jamaah</div>
                                  <Button type="button" variant={line.with_meal?'primary':'outline'} size="sm"
                                    onClick={()=>updLine(row.id,line.id,{with_meal:!(line.with_meal??false),unit_price:hrp(hProd,line.room_type,!(line.with_meal??false))})}>
                                    <Utensils size={12} className="mr-1"/> Makan
                                  </Button>
                                  <div className="flex-1 min-w-[140px]">
                                    {canEditPrice ? (
                                      <>
                                        <label className={labelClass}>Harga / kamar / malam {rowCur(row)==='SAR'?'(SAR)':'(IDR)'}</label>
                                        <div className="flex gap-2 flex-wrap">
                                          {(['IDR','SAR','USD'] as const).map(c=>{ const val=getInC(line.unit_price||0,row,c); const on=priceCur===c; return(
                                            <div key={c} className="flex items-center gap-1">
                                              <span className="text-xs font-medium text-slate-500 w-7">{c}</span>
                                              <input type="number" min="0" className={`w-24 ${inputClass} ${!on?'bg-slate-50 cursor-default':''}`}
                                                value={Math.round(val*100)/100||''} readOnly={!on} placeholder="0"
                                                onChange={on?e=>setLP(row.id,line.id,c,parseFloat(e.target.value)||0):undefined}/>
                                            </div>); })}
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <label className={labelClass}>Harga / kamar / malam</label>
                                        <p className="text-sm font-bold text-slate-900 tabular-nums">{rowCur(row)==='SAR'?`${fmt(line.unit_price||0)} SAR`:formatIDR(line.unit_price||0)}</p>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Subtotal</p>
                                    <p className="text-sm font-bold text-slate-900 tabular-nums">{rowCur(row)==='SAR'?`${fmt(Math.max(0,line.quantity)*(line.unit_price||0)*(nightsFor(row)||0))} SAR`:formatIDR(Math.max(0,line.quantity)*(line.unit_price||0)*(nightsFor(row)||0))}</p>
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" onClick={()=>removeLine(row.id,line.id)} className="text-slate-500 hover:text-red-600">
                                    <Trash2 size={14}/>
                                  </Button>
                                </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" onClick={()=>addLine(row.id)} className="border-dashed">
                                <Plus size={14} className="mr-1"/> Tambah tipe kamar
                              </Button>
                            </>
                          ) : (
                            <div className="flex flex-wrap items-end gap-4">
                              {row.type==='ticket' && (
                                <>
                                  <div className="min-w-[120px]">
                                    <label className={labelClass}>Bandara</label>
                                    <select className={selectClass} value={(row.meta?.bandara as string)||''}
                                      onChange={e=>{ const bandara=e.target.value; updateRow(row.id,{ meta: { ...(row.meta||{}), bandara, trip_type:(row.meta?.trip_type as TicketTripType)||'round_trip' } }); }}>
                                      <option value="">— Pilih bandara —</option>
                                      {BANDARA_TIKET.map(b=>(
                                        <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="min-w-[140px]">
                                    <label className={labelClass}>Perjalanan</label>
                                    <select className={selectClass} value={(row.meta?.trip_type as TicketTripType)||'round_trip'}
                                      onChange={e=>{ const trip_type=e.target.value as TicketTripType; updateRow(row.id,{ meta: { ...(row.meta||{}), trip_type, bandara:(row.meta?.bandara as string)||'BTH' } }); }}>
                                      {TICKET_TRIP_OPTIONS.map(o=>(
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  {(row.meta?.trip_type as TicketTripType)==='round_trip' && (
                                    <>
                                      <div className="min-w-[140px]">
                                        <label className={labelClass}>Tanggal keberangkatan</label>
                                        <input type="date" className={inputClass} value={(row.meta?.departure_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), departure_date: e.target.value || undefined } })} />
                                      </div>
                                      <div className="min-w-[140px]">
                                        <label className={labelClass}>Tanggal kepulangan</label>
                                        <input type="date" className={inputClass} value={(row.meta?.return_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), return_date: e.target.value || undefined } })} />
                                      </div>
                                    </>
                                  )}
                                  {(row.meta?.trip_type as TicketTripType)==='one_way' && (
                                    <div className="min-w-[140px]">
                                      <label className={labelClass}>Tanggal keberangkatan</label>
                                      <input type="date" className={inputClass} value={(row.meta?.departure_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), departure_date: e.target.value || undefined, return_date: undefined } })} />
                                    </div>
                                  )}
                                  {(row.meta?.trip_type as TicketTripType)==='return_only' && (
                                    <div className="min-w-[140px]">
                                      <label className={labelClass}>Tanggal kepulangan</label>
                                      <input type="date" className={inputClass} value={(row.meta?.return_date as string)??''} onChange={e=> updateRow(row.id,{ meta: { ...(row.meta||{}), return_date: e.target.value || undefined, departure_date: undefined } })} />
                                    </div>
                                  )}
                                </>
                              )}
                              {row.type==='bus' && (
                                <>
                                  <div className="min-w-[180px]">
                                    <label className={labelClass}>Rute</label>
                                    <select className={selectClass} value={(row.meta?.route_type as BusRouteType)||'full_route'}
                                      onChange={e=>{ const route_type=e.target.value as BusRouteType; updateRow(row.id,{ meta: { ...(row.meta||{}), route_type, trip_type:(row.meta?.trip_type as TicketTripType)||'round_trip', bus_type:(row.meta?.bus_type as string)||'besar' } }); }}>
                                      {BUS_ROUTE_OPTIONS.map(o=>(
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="min-w-[140px]">
                                    <label className={labelClass}>Perjalanan</label>
                                    <select className={selectClass} value={(row.meta?.trip_type as TicketTripType)||'round_trip'}
                                      onChange={e=>{ const trip_type=e.target.value as TicketTripType; updateRow(row.id,{ meta: { ...(row.meta||{}), trip_type, route_type:(row.meta?.route_type as BusRouteType)||'full_route', bus_type:(row.meta?.bus_type as string)||'besar' } }); }}>
                                      {TICKET_TRIP_OPTIONS.map(o=>(
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </>
                              )}
                              <div className="w-24">
                                <label className={labelClass}>Qty</label>
                                <input type="number" min="0" className={inputClass} value={row.quantity||''}
                                  onChange={e=>{ const v=e.target.value; if(v===''){updateRow(row.id,{quantity:0});return;} const n=parseInt(v,10); if(!isNaN(n)&&n>=0) updateRow(row.id,{quantity:n}); }}/>
                              </div>
                              {canEditPrice ? (
                                <div>
                                  <label className={labelClass}>Harga Satuan</label>
                                  <div className="flex gap-2 flex-wrap">
                                    {(['IDR','SAR','USD'] as const).map(c=>{ const val=getInC(row.unit_price||0,row,c); const on=priceCur===c; return(
                                      <div key={c} className="flex items-center gap-1">
                                        <span className="text-xs font-medium text-slate-500 w-7">{c}</span>
                                        <input type="number" min="0" className={`w-24 ${inputClass} ${!on?'bg-slate-50 cursor-default':''}`}
                                          value={Math.round(val*100)/100||''} readOnly={!on} placeholder="0"
                                          onChange={on?e=>setRP(row.id,c,parseFloat(e.target.value)||0):undefined}/>
                                      </div>); })}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <label className={labelClass}>Harga Satuan</label>
                                  <p className="text-sm font-bold text-slate-900 tabular-nums pt-1">{rowCur(row)==='SAR'?`${fmt(row.unit_price||0)} SAR`:formatIDR(row.unit_price||0)}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <Button type="button" variant="outline" onClick={addRow} className="w-full border-dashed text-slate-600">
                    <Plus size={16} className="mr-2"/> Tambah item pemesanan
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Ringkasan */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-primary-500" /> Ringkasan
          </h3>
          <Card padding="md">
            <div className="mb-6 pb-6 border-b border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Referensi Harga Admin Pusat</p>
              <p className="text-2xl font-bold text-primary-600 tabular-nums">{formatSAR(totalSAR)}</p>
              <p className="text-xs text-slate-500 mt-1">1 SAR = {formatIDR(rates.SAR_TO_IDR??4200)}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="rounded-xl bg-primary-50 border border-primary-100 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total SAR</p>
                <p className="text-lg font-bold text-primary-600 tabular-nums">{formatSAR(totalSAR)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Harga admin pusat</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total IDR</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{formatIDR(totalIDR)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Tagihan Rupiah</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total USD</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{formatUSD(totalIDR/(rates.USD_TO_IDR||15500))}</p>
                <p className="text-xs text-slate-500 mt-0.5">Pembayaran USD</p>
              </div>
            </div>
            {totalPax>0&&(
              <div className="flex items-center gap-2 text-slate-700 mb-4">
                <Users size={16} className="text-primary-500"/>
                Total jamaah: <span className="font-bold text-slate-900">{totalPax}</span> orang
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span>1 SAR = <b className="text-slate-900">{formatIDR(rates.SAR_TO_IDR??4200)}</b></span>
              <span>1 USD = <b className="text-slate-900">{formatIDR(rates.USD_TO_IDR??15500)}</b></span>
              <span className="text-xs text-slate-500">Kurs dari Menu Settings</span>
            </div>
          </Card>
        </div>

        {/* Footer — sticky bar */}
        <div className="sticky bottom-0 left-0 right-0 z-10 mt-8 py-4 px-4 -mx-4 sm:-mx-6 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={()=>navigate('/dashboard/orders-invoices?tab=invoices')}>Batal</Button>
          <div className="flex flex-wrap items-center gap-2">
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
  );
};

export default OrderFormPage;