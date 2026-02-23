import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Trash2, ArrowLeft, Hotel, Plane, FileText,
  Bus, Package, Users, Utensils, X, ChevronRight,
  Star, CreditCard, Building2
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import { productsApi, ordersApi, invoicesApi, businessRulesApi, branchesApi, ownersApi } from '../../../services/api';
import { formatIDR, formatSAR, formatUSD } from '../../../utils';
import { fillFromSource } from '../../../utils/currencyConversion';

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

type ItemType   = typeof ITEM_TYPES[number]['id'];
type RoomTypeId = typeof ROOM_TYPES[number]['id'];

interface ProductOption {
  id:string; name:string; code:string; type:string;
  is_package?:boolean; price_general?:number|null;
  price_branch?:number|null; price_owner?:number|null;
  currency?:string; meta?:{meal_price?:number;[k:string]:unknown};
  room_breakdown?:Record<string,any>; prices_by_room?:Record<string,any>;
}
interface HotelRoomLine { id:string; room_type:RoomTypeId; quantity:number; unit_price:number; with_meal?:boolean; }
interface OrderItemRow  { id:string; type:ItemType; product_id:string; product_name:string; quantity:number; room_type?:RoomTypeId; room_breakdown?:HotelRoomLine[]; unit_price:number; check_in?:string; check_out?:string; }
interface OwnerListItem { id:string; user_id:string; assigned_branch_id?:string; User?:{id:string;name?:string;company_name?:string}; AssignedBranch?:{id:string;code:string;name:string}; }

const uid  = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const newLine = (): HotelRoomLine => ({ id:`rl-${uid()}`, room_type:'quad', quantity:1, unit_price:0, with_meal:false });
const newRow  = (): OrderItemRow  => ({ id:`row-${uid()}`, type:'hotel', product_id:'', product_name:'', quantity:1, unit_price:0, room_breakdown:[newLine()] });
const rCap = (rt?:RoomTypeId) => rt ? (ROOM_TYPES.find(t=>t.id===rt)?.cap??0) : 0;
const canManage = (role?:string) => role==='owner' || role==='invoice_koordinator' || role==='role_invoice_saudi';

/* ═══════════════════════════════════════════════
   STYLES — Modern Smooth Minimal
═══════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

:root {
  --bg:        #ffffff;
  --surface:   #ffffff;
  --surface2:  #ffffff;
  --surface3:  #fafafa;
  --border:    #e5e5e5;
  --border2:   #d4d4d4;
  --tx1:       #1a1a18;
  --tx2:       #4a4a44;
  --tx3:       #9a9a90;
  --accent:    #3d6b5a;
  --accent-lt: #f5f5f5;
  --accent-md: #2e5244;
  --accent-glow: rgba(61,107,90,0.12);
  --warn:      #b45309;
  --warn-lt:   #fef3e2;
  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius:    14px;
  --radius-lg: 18px;
  --radius-xl: 22px;
  --shadow-xs: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03);
  --shadow:    0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
  --shadow-lg: 0 4px 20px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05);
  --t:         180ms;
  --ease:      cubic-bezier(0.4,0,0.2,1);
}

.ofp * { box-sizing:border-box; margin:0; padding:0; }
.ofp {
  font-family:'DM Sans',system-ui,sans-serif;
  color:var(--tx1);
  background:var(--bg);
  min-height:100vh;
  width:100%;
  -webkit-font-smoothing:antialiased;
}

/* ── HERO ─────────────────────────────── */
.ofp-hero {
  background:var(--surface);
  border-bottom:1px solid var(--border);
  position:sticky; top:0; z-index:30;
}
.ofp-hero-inner {
  width:100%;
  padding:14px 28px 16px;
  display:flex;
  align-items:center;
  gap:16px;
}
@media(max-width:600px){ .ofp-hero-inner { padding:12px 16px; } }

.ofp-back {
  display:inline-flex; align-items:center; gap:5px;
  background:var(--surface2); border:1px solid var(--border);
  border-radius:var(--radius-xs); cursor:pointer;
  color:var(--tx3); font-size:12px;
  font-family:'DM Sans',system-ui,sans-serif;
  font-weight:500; padding:5px 10px;
  transition:all var(--t) var(--ease);
  white-space:nowrap; flex-shrink:0;
}
.ofp-back:hover { color:var(--tx2); border-color:var(--border2); background:var(--surface3); }

.ofp-hero-center { flex:1; display:flex; flex-direction:column; gap:1px; }
.ofp-hero-eyebrow {
  font-size:10px; font-weight:600; letter-spacing:0.08em;
  text-transform:uppercase; color:var(--tx3);
}
.ofp-hero-title {
  font-size:clamp(16px,2.5vw,20px);
  font-weight:700; color:var(--tx1);
  letter-spacing:-0.3px; line-height:1.2;
}

/* totals strip in hero */
.ofp-strip {
  display:flex; gap:0; flex-shrink:0;
  border:1px solid var(--border); border-radius:var(--radius-sm);
  overflow:hidden; background:var(--surface2);
}
.ofp-strip-tab {
  padding:8px 16px;
  display:flex; flex-direction:column; align-items:center; gap:1px;
  border-right:1px solid var(--border);
}
.ofp-strip-tab:last-child { border-right:none; }
.ofp-strip-tab.main { background:var(--accent-lt); }
.ofp-strip-val {
  font-size:13px; font-weight:700; color:var(--tx1);
  font-family:'DM Mono',monospace;
  white-space:nowrap;
}
.ofp-strip-tab.main .ofp-strip-val { color:var(--accent); }
.ofp-strip-lbl {
  font-size:9px; font-weight:600; letter-spacing:0.07em;
  text-transform:uppercase; color:var(--tx3);
}
@media(max-width:780px){ .ofp-strip { display:none; } }

/* ── CONTENT (fullscreen) ──────────────── */
.ofp-content {
  width:100%;
  padding:24px 28px 60px;
}
@media(max-width:600px){ .ofp-content { padding:16px 14px 48px; } }

/* ── SECTION ──────────────────────────── */
.ofp-section { margin-bottom:20px; }
.ofp-section-label {
  font-size:10px; font-weight:700;
  letter-spacing:0.1em; text-transform:uppercase;
  color:var(--tx3); margin-bottom:10px;
  padding-left:2px;
}

/* ── CARD ─────────────────────────────── */
.ofp-card {
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-xs);
  overflow:hidden;
  animation:fadeUp 0.22s var(--ease) both;
}
@keyframes fadeUp {
  from { opacity:0; transform:translateY(6px); }
  to   { opacity:1; transform:translateY(0); }
}
.ofp-card-head {
  padding:14px 18px;
  border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between;
  gap:12px; flex-wrap:wrap;
  background:var(--surface2);
}
.ofp-card-title {
  font-size:13px; font-weight:700;
  color:var(--tx1); letter-spacing:-0.1px;
  display:flex; align-items:center; gap:7px;
}
.ofp-card-title-icon {
  width:26px; height:26px; border-radius:7px;
  background:var(--accent-lt); color:var(--accent);
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0;
}
.ofp-card-body { padding:18px; }
@media(max-width:600px){ .ofp-card-body { padding:14px; } }

/* ── FORM ATOMS ───────────────────────── */
.ofp-lbl {
  display:block; font-size:10px; font-weight:600;
  letter-spacing:0.07em; text-transform:uppercase;
  color:var(--tx3); margin-bottom:5px;
}
.ofp-sel, .ofp-inp {
  width:100%; appearance:none; -webkit-appearance:none;
  border:1.5px solid var(--border);
  border-radius:var(--radius-sm);
  padding:9px 13px;
  font-size:13px; font-family:'DM Sans',system-ui,sans-serif;
  color:var(--tx1); background:var(--surface);
  outline:none; transition:border-color var(--t) var(--ease), box-shadow var(--t) var(--ease);
}
.ofp-sel:focus, .ofp-inp:focus {
  border-color:var(--accent);
  box-shadow:0 0 0 3px var(--accent-glow);
}
.ofp-sel-w { position:relative; }
.ofp-sel-w::after {
  content:''; position:absolute; right:11px; top:50%;
  transform:translateY(-50%);
  width:0; height:0;
  border-left:4px solid transparent; border-right:4px solid transparent;
  border-top:4.5px solid var(--tx3); pointer-events:none;
}
.ofp-hint { font-size:11px; color:var(--tx3); margin-top:4px; }
.ofp-g2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
@media(max-width:520px){ .ofp-g2 { grid-template-columns:1fr; } }

/* ── CURRENCY SWITCHER ────────────────── */
.ofp-cur-sw {
  display:inline-flex; background:var(--surface3);
  border:1px solid var(--border); border-radius:var(--radius-xs);
  padding:3px; gap:2px;
}
.ofp-cur-btn {
  padding:4px 11px; border-radius:6px;
  font-size:11px; font-weight:600;
  cursor:pointer; border:none; background:none;
  color:var(--tx3); transition:all var(--t) var(--ease);
  font-family:'DM Sans',system-ui,sans-serif;
}
.ofp-cur-btn.on {
  background:var(--surface);
  color:var(--accent);
  box-shadow:var(--shadow-xs);
}

/* ── ITEM CARD ────────────────────────── */
.ofp-item {
  border:1px solid var(--border);
  border-radius:var(--radius);
  margin-bottom:10px; overflow:hidden;
  background:var(--surface);
  box-shadow:var(--shadow-xs);
  transition:border-color var(--t) var(--ease), box-shadow var(--t) var(--ease);
}
.ofp-item:hover { border-color:var(--border2); box-shadow:var(--shadow); }
.ofp-item-head {
  display:flex; align-items:center; gap:8px;
  padding:10px 13px;
  background:var(--surface2);
  border-bottom:1px solid var(--border);
  flex-wrap:wrap;
}
.ofp-type-dot {
  width:28px; height:28px; border-radius:7px;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0; background:var(--accent-lt); color:var(--accent);
}
.ofp-type-sel { flex:0 0 115px; }
.ofp-prod-sel { flex:1; min-width:140px; }
@media(max-width:580px){ .ofp-type-sel { flex:0 0 100%; } .ofp-prod-sel { flex:1 1 100%; } }

.ofp-subtotal {
  display:inline-flex; align-items:center;
  background:var(--accent-lt); color:var(--accent);
  border-radius:6px; padding:4px 10px;
  font-size:12px; font-weight:700;
  font-family:'DM Mono',monospace;
  white-space:nowrap; margin-left:auto;
}
.ofp-del {
  width:28px; height:28px; border-radius:7px;
  border:1px solid #fde8e8; background:#fff8f8;
  color:#dc5555; cursor:pointer; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  transition:all var(--t) var(--ease);
}
.ofp-del:hover { background:#fee2e2; border-color:#dc5555; }
.ofp-del.sm { width:24px; height:24px; border-radius:6px; }

.ofp-item-body { padding:13px; }
@media(max-width:600px){ .ofp-item-body { padding:11px; } }

/* ── ROOM LINE ────────────────────────── */
.ofp-room {
  display:flex; gap:10px;
  background:var(--surface2);
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  padding:12px; margin-bottom:8px;
  flex-wrap:wrap; align-items:flex-end;
}
.ofp-room:last-child { margin-bottom:0; }

.ofp-qty {
  width:56px; text-align:center;
  border:1.5px solid var(--border); border-radius:8px;
  padding:7px 4px; font-size:15px; font-weight:700;
  font-family:'DM Mono',monospace;
  background:var(--surface); outline:none;
  transition:border-color var(--t) var(--ease); color:var(--tx1);
}
.ofp-qty:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-glow); }

.ofp-meal {
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 10px; border-radius:20px;
  font-size:11.5px; font-weight:600;
  cursor:pointer; border:1.5px solid var(--border);
  background:var(--surface); color:var(--tx3);
  transition:all var(--t) var(--ease);
  font-family:'DM Sans',system-ui,sans-serif;
  user-select:none; white-space:nowrap;
}
.ofp-meal.on { border-color:var(--accent); background:var(--accent-lt); color:var(--accent); }

.ofp-pax { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:var(--tx3); }

/* ── PRICE INPUTS ─────────────────────── */
.ofp-price-row { display:flex; gap:8px; flex-wrap:wrap; }
.ofp-price-cell { display:flex; flex-direction:column; gap:3px; }
.ofp-price-tag { font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--tx3); }
.ofp-price-inp {
  width:104px; border:1.5px solid var(--border); border-radius:8px;
  padding:7px 9px; font-size:12.5px; font-weight:500;
  font-family:'DM Mono',monospace;
  background:var(--surface); outline:none;
  transition:all var(--t) var(--ease); color:var(--tx1);
}
.ofp-price-inp:focus { border-color:var(--accent); background:var(--surface); box-shadow:0 0 0 3px var(--accent-glow); }
.ofp-price-inp.on  { border-color:var(--accent); background:var(--accent-lt); }
.ofp-price-inp.off { background:var(--surface3); color:var(--tx3); cursor:not-allowed; border-color:var(--border); }

/* ── ADD BUTTONS ──────────────────────── */
.ofp-add-row {
  display:flex; align-items:center; justify-content:center; gap:7px;
  width:100%; padding:13px;
  border:1.5px dashed var(--border2); border-radius:var(--radius);
  background:none; cursor:pointer; font-size:13px;
  font-family:'DM Sans',system-ui,sans-serif;
  font-weight:500; color:var(--tx3);
  transition:all var(--t) var(--ease);
}
.ofp-add-row:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-lt); }

.ofp-add-line {
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px; border-radius:7px;
  border:1px solid var(--border); background:var(--surface);
  color:var(--tx3); font-size:12px; font-weight:600;
  font-family:'DM Sans',system-ui,sans-serif;
  cursor:pointer; transition:all var(--t) var(--ease); margin-top:9px;
}
.ofp-add-line:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-lt); }

/* ── NON-HOTEL ROW ────────────────────── */
.ofp-row-f { display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; }

/* ── SUMMARY ──────────────────────────── */
.ofp-sum {
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  overflow:hidden;
  box-shadow:var(--shadow);
  margin-bottom:20px;
}
.ofp-sum-top {
  padding:22px 22px 20px;
  background:var(--surface);
  border-bottom:1px solid var(--border);
  position:relative; overflow:hidden;
}
.ofp-sum-top::after { display:none; }
.ofp-sum-rel { position:relative; z-index:1; }
.ofp-sum-eyebrow {
  font-size:9.5px; font-weight:600; letter-spacing:0.1em;
  text-transform:uppercase; color:var(--tx3); margin-bottom:8px;
}
.ofp-sum-big {
  font-size:clamp(24px,4vw,36px);
  font-weight:700; color:var(--tx1);
  letter-spacing:-0.5px; line-height:1;
  font-family:'DM Mono',monospace;
}
.ofp-sum-note { font-size:11px; color:var(--tx3); margin-top:6px; }
.ofp-sum-bot {
  padding:18px 22px;
  border-top:1px solid var(--border);
}
@media(max-width:600px){ .ofp-sum-bot { padding:14px 15px; } }
.ofp-sum-grid {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
  gap:10px;
}
.ofp-sum-cell {
  padding:13px 14px;
  background:var(--surface2);
  border:1px solid var(--border); border-radius:var(--radius-sm);
}
.ofp-sum-cell.hi {
  background:var(--accent-lt);
  border-color:rgba(61,107,90,0.15);
}
.ofp-sum-cell-lbl { font-size:9.5px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--tx3); margin-bottom:5px; }
.ofp-sum-cell-val { font-size:clamp(15px,2.5vw,18px); font-weight:700; color:var(--tx1); font-family:'DM Mono',monospace; line-height:1; }
.ofp-sum-cell.hi .ofp-sum-cell-val { color:var(--accent); }
.ofp-sum-cell-sub { font-size:10.5px; color:var(--tx3); margin-top:4px; }
.ofp-pax-row {
  display:flex; align-items:center; gap:6px;
  margin-top:12px; padding-top:12px;
  border-top:1px solid var(--border);
  font-size:13px; color:var(--tx3);
}
.ofp-pax-n { font-size:16px; font-weight:700; color:var(--tx1); }
.ofp-kurs {
  display:flex; gap:16px; flex-wrap:wrap;
  margin-top:10px; padding-top:10px;
  border-top:1px solid var(--border);
  font-size:11.5px; color:var(--tx3);
}
.ofp-kurs b { color:var(--tx2); font-weight:600; }

/* ── FOOTER ───────────────────────────── */
.ofp-footer {
  display:flex; justify-content:flex-end; align-items:center;
  gap:10px; flex-wrap:wrap; padding-top:4px;
}
.ofp-btn-ghost {
  padding:10px 20px; border-radius:var(--radius-sm);
  border:1px solid var(--border); background:var(--surface);
  color:var(--tx2); font-size:13px; font-weight:600;
  font-family:'DM Sans',system-ui,sans-serif; cursor:pointer;
  transition:all var(--t) var(--ease);
}
.ofp-btn-ghost:hover { background:var(--surface2); border-color:var(--border2); }
.ofp-btn-save {
  padding:10px 24px; border-radius:var(--radius-sm);
  border:none; background:var(--accent);
  color:#fff; font-size:13px; font-weight:700;
  font-family:'DM Sans',system-ui,sans-serif; cursor:pointer;
  box-shadow:0 2px 8px var(--accent-glow);
  transition:all var(--t) var(--ease);
  display:flex; align-items:center; gap:6px;
}
.ofp-btn-save:hover { background:var(--accent-md); transform:translateY(-1px); box-shadow:0 4px 14px rgba(61,107,90,0.25); }
.ofp-btn-save:disabled { opacity:0.55; cursor:not-allowed; transform:none; box-shadow:none; }

/* ── LOADING ──────────────────────────── */
.ofp-loading {
  min-height:100vh; display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  background:var(--bg); gap:14px;
  font-family:'DM Sans',system-ui,sans-serif; color:var(--tx3);
  font-size:13.5px;
}
.ofp-spin {
  width:32px; height:32px;
  border:2.5px solid var(--border2); border-top-color:var(--accent);
  border-radius:50%; animation:spin 0.7s linear infinite;
}
@keyframes spin { to { transform:rotate(360deg); } }
.ofp-spin-sm { width:18px; height:18px; border-width:2px; }

/* ── DIVIDER / HELPERS ────────────────── */
.ofp-flex-row { display:flex; align-items:center; gap:8px; }
.ofp-spacer { flex:1; }
`;

/* ═══════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════ */
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
        check_out:d.check_out
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
        rows.push({ id:oi.id||`row-${uid()}`, type:t, product_id:productRefId, product_name:productName, quantity:Math.max(0,qty(oi)), room_type:(meta.room_type??getVal(oi,'room_type')) as RoomTypeId|undefined, unit_price:unitPrice });
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
  const updateRow=(rowId:string,upd:Partial<OrderItemRow>)=>setItems(p=>p.map(r=>{ if(r.id!==rowId) return r; const next={...r,...upd}; if(upd.product_id!=null){ const prod=byType(next.type).find(x=>x.id===upd.product_id); if(prod){ next.product_name=prod.name; if(next.unit_price===0||upd.product_id!==r.product_id) next.unit_price=effP(prod); if(next.type==='hotel'&&!(next.room_breakdown?.length)) next.room_breakdown=[{id:`rl-${uid()}`,room_type:'quad',quantity:1,unit_price:hrp(prod,'quad',false),with_meal:false}]; } } if(upd.type!=null&&upd.type!==r.type){ next.product_id=''; next.product_name=''; next.unit_price=0; if(upd.type!=='hotel'){ next.room_type=undefined; next.room_breakdown=undefined; } else next.room_breakdown=next.room_breakdown??[]; } return next; }));

  /* totals */
  const rowSub=(r:OrderItemRow)=> r.type==='hotel'&&r.room_breakdown?.length ? r.room_breakdown.reduce((s,l)=>s+Math.max(0,l.quantity)*(l.unit_price||0),0) : Math.max(0,r.quantity)*(r.unit_price||0);
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
    if(!isEdit&&!isOwner&&!canPickOwner&&!branchId){ showToast('Pilih cabang terlebih dahulu','warning'); return; }
    if(canPickOwner&&!ownerSel){ showToast('Pilih owner untuk order ini','warning'); return; }
    if(canPickOwner&&ownerSel&&!bFromOwner){ showToast('Owner belum memiliki cabang','warning'); return; }
    const s2i=rates.SAR_TO_IDR||4200;
    const tIDR=(price:number,row:OrderItemRow)=>rowCur(row)==='SAR'?price*s2i:price;
    const payload:Record<string,any>[]=[];
    for(const r of valid){
      if(r.type==='hotel'&&r.room_breakdown?.length){ for(const l of r.room_breakdown){ if(l.quantity<=0) continue; const meal=l.with_meal??false; const meta:Record<string,unknown>={room_type:l.room_type,with_meal:meal}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; payload.push({product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:l.quantity,unit_price:tIDR(l.unit_price,r),room_type:l.room_type,meal,check_in:r.check_in,check_out:r.check_out,meta}); } }
      else if(r.type==='hotel'&&r.room_type){ const meta:Record<string,unknown>={room_type:r.room_type}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; payload.push({product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:Math.max(1,r.quantity),unit_price:tIDR(r.unit_price,r),room_type:r.room_type,check_in:r.check_in,check_out:r.check_out,meta}); }
      else{ payload.push({product_id:r.product_id,type:r.type,product_ref_type:r.type==='package'?'package':'product',quantity:Math.max(1,r.quantity),unit_price:tIDR(r.unit_price,r)}); }
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

  const handleSaveDraft=(e:React.MouseEvent)=>{
    e.preventDefault();
    const valid=items.filter(r=>{ if(!r.product_id) return false; if(r.type==='hotel') return r.room_breakdown?.some(l=>l.quantity>0)||(r.room_type&&r.quantity>0); return r.quantity>0; });
    if(!valid.length){ showToast('Minimal satu item dengan produk dan qty > 0','warning'); return; }
    const hotelWithoutDates=valid.filter(r=>r.type==='hotel'&&(!r.check_in||!r.check_out));
    if(hotelWithoutDates.length){ showToast('Item hotel wajib isi tanggal Check-in dan Check-out','warning'); return; }
    if(!isEdit&&!isOwner&&!canPickOwner&&!branchId){ showToast('Pilih cabang terlebih dahulu','warning'); return; }
    if(canPickOwner&&!ownerSel){ showToast('Pilih owner untuk invoice ini','warning'); return; }
    if(canPickOwner&&ownerSel&&!bFromOwner){ showToast('Owner belum memiliki cabang','warning'); return; }
    const s2i=rates.SAR_TO_IDR||4200;
    const tIDR=(price:number,row:OrderItemRow)=>rowCur(row)==='SAR'?price*s2i:price;
    const payload:Record<string,any>[]=[];
    for(const r of valid){
      if(r.type==='hotel'&&r.room_breakdown?.length){ for(const l of r.room_breakdown){ if(l.quantity<=0) continue; const meal=l.with_meal??false; const meta:Record<string,unknown>={room_type:l.room_type,with_meal:meal}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; payload.push({product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:l.quantity,unit_price:tIDR(l.unit_price,r),room_type:l.room_type,meal,check_in:r.check_in,check_out:r.check_out,meta}); } }
      else if(r.type==='hotel'&&r.room_type){ const meta:Record<string,unknown>={room_type:r.room_type}; if(r.check_in) meta.check_in=r.check_in; if(r.check_out) meta.check_out=r.check_out; payload.push({product_id:r.product_id,type:'hotel',product_ref_type:'product',quantity:Math.max(1,r.quantity),unit_price:tIDR(r.unit_price,r),room_type:r.room_type,check_in:r.check_in,check_out:r.check_out,meta}); }
      else{ payload.push({product_id:r.product_id,type:r.type,product_ref_type:r.type==='package'?'package':'product',quantity:Math.max(1,r.quantity),unit_price:tIDR(r.unit_price,r)}); }
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

  const handleTerbitkanInvoice=(e:React.MouseEvent)=>{
    e.preventDefault();
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
    <><style>{CSS}</style>
    <div className="ofp-loading"><div className="ofp-spin"/><span>Memuat detail order…</span></div></>
  );

  return (
    <><style>{CSS}</style>
    <div className="ofp">

      {/* ── HERO / TOPBAR ── */}
      <div className="ofp-hero">
        <div className="ofp-hero-inner">
          <button className="ofp-back" onClick={()=>navigate('/dashboard/orders-invoices?tab=invoices')}>
            <ArrowLeft size={12}/> Kembali
          </button>
          <div className="ofp-hero-center">
            <div className="ofp-hero-eyebrow">{isEdit ? 'Edit Invoice' : 'Invoice Baru'}</div>
            <div className="ofp-hero-title">{isEdit ? 'Perbarui Invoice' : 'Buat Invoice Baru'}</div>
          </div>
          <div className="ofp-strip">
            <div className="ofp-strip-tab main">
              <div className="ofp-strip-val">{formatSAR(totalSAR)}</div>
              <div className="ofp-strip-lbl">Total SAR</div>
            </div>
            <div className="ofp-strip-tab">
              <div className="ofp-strip-val">{formatIDR(totalIDR)}</div>
              <div className="ofp-strip-lbl">Total IDR</div>
            </div>
            <div className="ofp-strip-tab">
              <div className="ofp-strip-val">{formatUSD(totalIDR/(rates.USD_TO_IDR||15500))}</div>
              <div className="ofp-strip-lbl">Total USD</div>
            </div>
            {totalPax>0&&(
              <div className="ofp-strip-tab">
                <div className="ofp-strip-val">{totalPax}</div>
                <div className="ofp-strip-lbl">Jamaah</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="ofp-content">
        <form onSubmit={handleSubmit}>

          {/* Branch */}
          {!isEdit&&!isOwner&&!canPickOwner&&branches.length>0&&(
            <div className="ofp-section">
              <div className="ofp-section-label">Cabang</div>
              <div className="ofp-card">
                <div className="ofp-card-head">
                  <div className="ofp-card-title">
                    <div className="ofp-card-title-icon"><Building2 size={13}/></div>
                    Pilih Cabang
                  </div>
                </div>
                <div className="ofp-card-body">
                  <div className="ofp-g2">
                    <div>
                      <label className="ofp-lbl">Cabang</label>
                      <div className="ofp-sel-w">
                        <select className="ofp-sel" value={branchSel} onChange={e=>{setBranchSel(e.target.value);setOwnerSel('');}} required>
                          <option value="">— Pilih cabang —</option>
                          {branches.map(b=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                        </select>
                      </div>
                      <div className="ofp-hint">Wajib untuk membuat order</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Owner */}
          {canPickOwner&&(
            <div className="ofp-section">
              <div className="ofp-section-label">Owner</div>
              <div className="ofp-card">
                <div className="ofp-card-head">
                  <div className="ofp-card-title">
                    <div className="ofp-card-title-icon"><Users size={13}/></div>
                    Pilih Owner
                  </div>
                </div>
                <div className="ofp-card-body">
                  <div className="ofp-g2">
                    <div>
                      <label className="ofp-lbl">Owner</label>
                      <div className="ofp-sel-w">
                        <select className="ofp-sel" value={ownerSel} onChange={e=>setOwnerSel(e.target.value)} required>
                          <option value="">— Pilih owner —</option>
                          {owners.map(o=>{ const uid2=o.User?.id??o.user_id; const lbl=o.User?.company_name||o.User?.name||uid2; return <option key={uid2} value={uid2}>{lbl}</option>; })}
                        </select>
                      </div>
                      <div className="ofp-hint">Order & cabang mengikuti owner yang dipilih</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="ofp-section">
            <div className="ofp-section-label">Item Pemesanan</div>
            <div className="ofp-card">
              <div className="ofp-card-head">
                <div className="ofp-card-title">
                  <div className="ofp-card-title-icon"><CreditCard size={13}/></div>
                  Daftar Item
                </div>
                {canEditPrice&&(
                  <div className="ofp-flex-row" style={{gap:8}}>
                    <span style={{fontSize:10,color:'var(--tx3)',fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase'}}>Ubah harga dalam</span>
                    <div className="ofp-cur-sw">
                      {(['IDR','SAR','USD'] as const).map(c=>(
                        <button key={c} type="button" className={`ofp-cur-btn${priceCur===c?' on':''}`} onClick={()=>setPriceCur(c)} title={`Edit dalam ${c}; mata uang lain menyesuaikan otomatis`}>{c}</button>
                      ))}
                    </div>
                    <span style={{fontSize:11,color:'var(--tx3)'}}>Mata uang lain menyesuaikan otomatis. Kurs dari Menu Settings.</span>
                  </div>
                )}
              </div>
              <div className="ofp-card-body">
                {loadingProd
                  ? <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',color:'var(--tx3)',fontSize:13}}><div className="ofp-spin ofp-spin-sm"/>Memuat produk…</div>
                  : (
                    <>
                      {items.map(row=>{
                        const tc=typeOf(row.type);
                        const hProd=row.type==='hotel'?byType('hotel').find(p=>p.id===row.product_id):undefined;
                        return (
                          <div key={row.id} className="ofp-item">
                            {/* head */}
                            <div className="ofp-item-head">
                              <div className="ofp-type-dot"><tc.Icon size={14}/></div>
                              <div className="ofp-type-sel">
                                <div className="ofp-sel-w">
                                  <select className="ofp-sel" style={{fontSize:12.5,padding:'7px 26px 7px 9px'}} value={row.type} onChange={e=>updateRow(row.id,{type:e.target.value as ItemType})}>
                                    {ITEM_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="ofp-prod-sel">
                                <div className="ofp-sel-w">
                                  <select className="ofp-sel" style={{fontSize:12.5,padding:'7px 26px 7px 9px'}} value={row.product_id}
                                    onChange={e=>{ const p=byType(row.type).find(x=>x.id===e.target.value); updateRow(row.id,{product_id:e.target.value,product_name:p?.name??'',unit_price:p?effP(p):0}); }}>
                                    <option value="">— Pilih produk —</option>
                                    {byType(row.type).map(p=><option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="ofp-subtotal">
                                {rowCur(row)==='SAR'?`${fmt(rowSub(row))} SAR`:formatIDR(rowSub(row))}
                              </div>
                              <button type="button" className="ofp-del" onClick={()=>removeRow(row.id)}><X size={12}/></button>
                            </div>
                            {/* body */}
                            <div className="ofp-item-body">
                              {row.type==='hotel' ? (
                                <>
                                  <div className="ofp-row-f" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                                    <div>
                                      <label className="ofp-lbl">Check-in</label>
                                      <input type="date" className="ofp-qty" style={{ minWidth: 130 }} value={row.check_in ?? ''} onChange={e => updateRow(row.id, { check_in: e.target.value || undefined })} />
                                    </div>
                                    <div>
                                      <label className="ofp-lbl">Check-out</label>
                                      <input type="date" className="ofp-qty" style={{ minWidth: 130 }} value={row.check_out ?? ''} onChange={e => updateRow(row.id, { check_out: e.target.value || undefined })} />
                                    </div>
                                    {row.product_id && row.check_in && row.check_out && (
                                      <div style={{ alignSelf: 'flex-end', fontSize: 12, color: 'var(--tx2)' }}>
                                        {hotelAvailability[row.id] === 'loading' && <span>Memuat ketersediaan…</span>}
                                        {hotelAvailability[row.id] && typeof hotelAvailability[row.id] === 'object' && (
                                          <span>Tersedia: {Object.entries((hotelAvailability[row.id] as { byRoomType: Record<string, number> }).byRoomType).filter(([, n]) => n > 0).map(([rt, n]) => `${rt} ${n}`).join(', ') || '—'}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {(row.room_breakdown||[]).map(line=>(
                                    <div key={line.id} className="ofp-room">
                                      <div style={{flex:'0 0 118px'}}>
                                        <label className="ofp-lbl">Tipe Kamar</label>
                                        <div className="ofp-sel-w">
                                          <select className="ofp-sel" style={{fontSize:12,padding:'7px 24px 7px 9px'}} value={line.room_type}
                                            onChange={e=>{ const rt=e.target.value as RoomTypeId; updLine(row.id,line.id,{room_type:rt,unit_price:hrp(hProd,rt,line.with_meal??false)}); }}>
                                            {ROOM_TYPES.map(rt=><option key={rt.id} value={rt.id}>{rt.label} · {rt.cap}px</option>)}
                                          </select>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="ofp-lbl">Kamar</label>
                                        <input type="number" min="0" className="ofp-qty" value={line.quantity||''} placeholder="0"
                                          onChange={e=>{ const v=e.target.value; if(v===''){updLine(row.id,line.id,{quantity:0});return;} const n=parseInt(v,10); if(!isNaN(n)&&n>=0) updLine(row.id,line.id,{quantity:n}); }}/>
                                      </div>
                                      <div className="ofp-pax" style={{alignSelf:'flex-end',paddingBottom:2}}><Users size={11}/>{Math.max(0,line.quantity)*rCap(line.room_type)} jamaah</div>
                                      <div style={{alignSelf:'flex-end',paddingBottom:2}}>
                                        <button type="button" className={`ofp-meal${line.with_meal?' on':''}`}
                                          onClick={()=>updLine(row.id,line.id,{with_meal:!(line.with_meal??false),unit_price:hrp(hProd,line.room_type,!(line.with_meal??false))})}>
                                          <Utensils size={10}/> Makan
                                        </button>
                                      </div>
                                      <div style={{flex:1}}>
                                        {canEditPrice ? (
                                          <>
                                            <label className="ofp-lbl">Harga / kamar</label>
                                            <div className="ofp-price-row">
                                              {(['IDR','SAR','USD'] as const).map(c=>{ const val=getInC(line.unit_price||0,row,c); const on=priceCur===c; return(
                                                <div key={c} className="ofp-price-cell">
                                                  <span className="ofp-price-tag">{c}</span>
                                                  <input type="number" min="0" className={`ofp-price-inp${on?' on':' off'}`}
                                                    value={Math.round(val*100)/100||''} readOnly={!on} placeholder="0"
                                                    onChange={on?e=>setLP(row.id,line.id,c,parseFloat(e.target.value)||0):undefined}/>
                                                </div>); })}
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <label className="ofp-lbl">Harga / kamar</label>
                                            <span style={{fontSize:14,fontWeight:700,color:'var(--tx1)',fontFamily:'\'DM Mono\',monospace'}}>{rowCur(row)==='SAR'?`${fmt(line.unit_price||0)} SAR`:formatIDR(line.unit_price||0)}</span>
                                          </>
                                        )}
                                      </div>
                                      <div style={{alignSelf:'flex-end',textAlign:'right',paddingBottom:2}}>
                                        <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--tx3)',marginBottom:2}}>Subtotal</div>
                                        <div style={{fontSize:13,fontWeight:700,color:'var(--tx1)',fontFamily:'\'DM Mono\',monospace'}}>{rowCur(row)==='SAR'?`${fmt(Math.max(0,line.quantity)*(line.unit_price||0))} SAR`:formatIDR(Math.max(0,line.quantity)*(line.unit_price||0))}</div>
                                      </div>
                                      <div style={{alignSelf:'flex-end',paddingBottom:2}}>
                                        <button type="button" className="ofp-del sm" onClick={()=>removeLine(row.id,line.id)}><Trash2 size={10}/></button>
                                      </div>
                                    </div>
                                  ))}
                                  <button type="button" className="ofp-add-line" onClick={()=>addLine(row.id)}>
                                    <Plus size={11}/> Tambah tipe kamar
                                  </button>
                                </>
                              ) : (
                                <div className="ofp-row-f">
                                  <div>
                                    <label className="ofp-lbl">Qty</label>
                                    <input type="number" min="0" className="ofp-qty" value={row.quantity||''}
                                      onChange={e=>{ const v=e.target.value; if(v===''){updateRow(row.id,{quantity:0});return;} const n=parseInt(v,10); if(!isNaN(n)&&n>=0) updateRow(row.id,{quantity:n}); }}/>
                                  </div>
                                  {canEditPrice ? (
                                    <div>
                                      <label className="ofp-lbl">Harga Satuan</label>
                                      <div className="ofp-price-row">
                                        {(['IDR','SAR','USD'] as const).map(c=>{ const val=getInC(row.unit_price||0,row,c); const on=priceCur===c; return(
                                          <div key={c} className="ofp-price-cell">
                                            <span className="ofp-price-tag">{c}</span>
                                            <input type="number" min="0" className={`ofp-price-inp${on?' on':' off'}`}
                                              value={Math.round(val*100)/100||''} readOnly={!on} placeholder="0"
                                              onChange={on?e=>setRP(row.id,c,parseFloat(e.target.value)||0):undefined}/>
                                          </div>); })}
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="ofp-lbl">Harga Satuan</label>
                                      <span style={{fontSize:14,fontWeight:700,color:'var(--tx1)',paddingTop:4,display:'block',fontFamily:'\'DM Mono\',monospace'}}>{rowCur(row)==='SAR'?`${fmt(row.unit_price||0)} SAR`:formatIDR(row.unit_price||0)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" className="ofp-add-row" onClick={addRow}>
                        <Plus size={14}/> Tambah item pemesanan
                      </button>
                    </>
                  )}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="ofp-section">
            <div className="ofp-section-label">Ringkasan</div>
            <div className="ofp-sum">
              <div className="ofp-sum-top">
                <div className="ofp-sum-rel">
                  <div className="ofp-sum-eyebrow">Referensi Harga Admin Pusat</div>
                  <div className="ofp-sum-big">{formatSAR(totalSAR)}</div>
                  <div className="ofp-sum-note">1 SAR = {formatIDR(rates.SAR_TO_IDR??4200)}</div>
                </div>
              </div>
              <div className="ofp-sum-bot">
                <div className="ofp-sum-grid">
                  <div className="ofp-sum-cell hi">
                    <div className="ofp-sum-cell-lbl">Total SAR</div>
                    <div className="ofp-sum-cell-val">{formatSAR(totalSAR)}</div>
                    <div className="ofp-sum-cell-sub">Harga admin pusat</div>
                  </div>
                  <div className="ofp-sum-cell">
                    <div className="ofp-sum-cell-lbl">Total IDR</div>
                    <div className="ofp-sum-cell-val">{formatIDR(totalIDR)}</div>
                    <div className="ofp-sum-cell-sub">Tagihan Rupiah</div>
                  </div>
                  <div className="ofp-sum-cell">
                    <div className="ofp-sum-cell-lbl">Total USD</div>
                    <div className="ofp-sum-cell-val">{formatUSD(totalIDR/(rates.USD_TO_IDR||15500))}</div>
                    <div className="ofp-sum-cell-sub">Pembayaran USD</div>
                  </div>
                </div>
                {totalPax>0&&(
                  <div className="ofp-pax-row">
                    <Users size={13} style={{color:'var(--accent)'}}/>
                    Total jamaah: <span className="ofp-pax-n">{totalPax}</span> orang
                  </div>
                )}
                <div className="ofp-kurs">
                  <span>1 SAR = <b>{formatIDR(rates.SAR_TO_IDR??4200)}</b></span>
                  <span>1 USD = <b>{formatIDR(rates.USD_TO_IDR??15500)}</b></span>
                  <span style={{fontSize:11,color:'var(--tx3)',fontWeight:400}}>Kurs dari Menu Settings</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="ofp-footer">
            <button type="button" className="ofp-btn-ghost" onClick={()=>navigate('/dashboard/orders-invoices?tab=invoices')}>Batal</button>
            <div className="flex items-center gap-2">
              {isDraftNoInvoice && (
                <>
                  <button type="button" className="ofp-btn-ghost border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={handleSaveDraft} disabled={saving}>
                    {saving ? 'Menyimpan…' : 'Simpan Draft'}
                  </button>
                  <button type="button" className="ofp-btn-save" onClick={handleTerbitkanInvoice} disabled={saving}>
                    {saving ? 'Menerbitkan…' : 'Terbitkan Invoice'}
                    {!saving&&<ChevronRight size={14}/>}
                  </button>
                </>
              )}
              {!isEdit && (
                <>
                  <button type="button" className="ofp-btn-ghost border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={handleSaveDraft} disabled={saving}>
                    {saving ? 'Menyimpan…' : 'Simpan Draft'}
                  </button>
                  <button type="submit" className="ofp-btn-save" disabled={saving}>
                    {saving ? 'Menyimpan…' : 'Buat Invoice'}
                    {!saving&&<ChevronRight size={14}/>}
                  </button>
                </>
              )}
              {isEdit && !isDraftNoInvoice && (
                <button type="submit" className="ofp-btn-save" disabled={saving}>
                  {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
                  {!saving&&<ChevronRight size={14}/>}
                </button>
              )}
            </div>
          </div>

        </form>
      </div>
    </div>
    </>
  );
};

export default OrderFormPage;