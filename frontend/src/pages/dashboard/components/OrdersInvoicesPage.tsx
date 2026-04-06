import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Receipt, Download, Check, X, Unlock, Eye, FileText, ChevronLeft, ChevronRight,
  CreditCard, DollarSign, Package, Wallet, Plus, Edit, Trash2, FileSpreadsheet, LayoutGrid, ExternalLink, Upload, Link as LinkIcon, ArrowRightLeft, ClipboardList, Send, Pencil, Plane, Clock, CheckCircle, Building2, QrCode, ArrowRight, Archive, Bus
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { DashboardFilterBar, PageFilter, ActionsMenu, AutoRefreshControl, PageHeader, FilterIconButton, StatCard, CardSectionHeader, Input, Textarea, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ModalBoxLg, ContentLoading, CONTENT_LOADING_MESSAGE, NominalDisplay } from '../../../components/common';
import Table from '../../../components/common/Table';
import { InvoiceStatusRefundCell, getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant, shouldHideInvoiceCancelAction } from '../../../components/common/InvoiceStatusRefundCell';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { PaymentProofCell, getProofStatus, getProofTypeLabel, getProofDisplayLabel } from '../../../components/common/PaymentProofCell';
import InvoiceProgressStatusCell, {
  PROGRESS_LABELS,
  ROOM_TYPE_LABELS,
  PROGRESS_LABELS_MEAL
} from '../../../components/common/InvoiceProgressStatusCell';
import {
  UNIFIED_PROGRESS,
  isUnifiedSelesai,
  labelBusIncludeLeg,
  labelBusItemProgress,
  labelBusTripProgress,
  labelHotelGroupProgress,
  labelHandlingSiskopatuhProgress
} from '../../../utils/progressStatusUnified';
import { InvoiceRefundDocument } from '../../../components/common/InvoiceRefundDocument';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import type { TableColumn } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { formatIDR, formatSAR, formatUSD, formatInvoiceDisplay } from '../../../utils';
import { formatInvoiceNumberDisplay } from '../../../utils/formatters';
import { INVOICE_STATUS_LABELS, API_BASE_URL, INVOICE_TABLE_COLUMN_PROOF, AUTOCOMPLETE_FILTER, getOrderItemSortIndex, getHotelLocationFromItem } from '../../../utils/constants';
import { getDisplayRemaining } from '../../../utils/invoiceTableHelpers';
import { invoicesApi, branchesApi, businessRulesApi, ownersApi, ordersApi, hotelApi, accountingApi, refundsApi, type InvoicesSummaryData, type BankAccountItem, type BankItem } from '../../../services/api';

/** Konfigurasi icon untuk card Per Status Invoice (StatCard pakai satu warna) */
const INVOICE_STATUS_CARD_CONFIG: Record<string, { icon: React.ReactNode }> = {
  draft: { icon: <Pencil className="w-5 h-5" /> },
  tentative: { icon: <Clock className="w-5 h-5" /> },
  partial_paid: { icon: <CreditCard className="w-5 h-5" /> },
  paid: { icon: <CheckCircle className="w-5 h-5" /> },
  processing: { icon: <Send className="w-5 h-5" /> },
  completed: { icon: <CheckCircle className="w-5 h-5" /> },
  canceled: { icon: <X className="w-5 h-5" /> },
  cancelled: { icon: <X className="w-5 h-5" /> },
  cancelled_refund: { icon: <X className="w-5 h-5" /> }, 
  overdue: { icon: <Clock className="w-5 h-5" /> },
  refunded: { icon: <Receipt className="w-5 h-5" /> },
  overpaid: { icon: <DollarSign className="w-5 h-5" /> }
};

/** Urutan tampilan card Per Status Invoice (status utama dulu). Status utama selalu ditampilkan sebagai card. */
const PER_STATUS_ORDER = ['tentative', 'partial_paid', 'paid', 'processing', 'completed', 'canceled', 'cancelled', 'overdue', 'draft', 'refunded', 'order_updated', 'overpaid', 'overpaid_transferred', 'overpaid_received', 'refund_canceled', 'overpaid_refund_pending'];
/** Status yang selalu ditampilkan di card (meskipun count 0): Tagihan DP, Pembayaran DP, Lunas, Processing, Completed, Dibatalkan */
const PER_STATUS_ALWAYS_SHOW = ['tentative', 'partial_paid', 'paid', 'processing', 'completed', 'canceled'];

/** Label trip type bus: pergi saja / pulang saja / pulang pergi */
const BUS_TRIP_LABELS: Record<string, string> = { one_way: 'Pergi saja', return_only: 'Pulang saja', round_trip: 'Pulang pergi' };

/** Base URL untuk file uploads (supaya foto bukti bayar tampil; pakai origin saat proxy) */
const UPLOAD_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');

/** URL file untuk preview/download (uploads) */
const getFileUrl = (path: string) => {
  if (!path || path === 'issued-saudi') return null;
  if (path.startsWith('http')) return path;
  const base = UPLOAD_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
};

/** Samakan dengan backend SISKOPATUH_PAYMENT_ACCOUNT_NUMBER (invoiceBankAccounts.js). */
function nabielaAccountDigitsFrontend(): string {
  const raw =
    (typeof import.meta !== 'undefined' && (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_SISKOPATUH_PAYMENT_ACCOUNT_NUMBER) ||
    (typeof process !== 'undefined' && process.env?.REACT_APP_SISKOPATUH_PAYMENT_ACCOUNT_NUMBER) ||
    '1330020805941';
  return String(raw).replace(/\D/g, '');
}

function isNabielaBankAccountRow(b: BankAccountItem): boolean {
  const d = nabielaAccountDigitsFrontend();
  if (!d || !b?.account_number) return false;
  return String(b.account_number).replace(/\D/g, '') === d;
}

function splitBankAccountsForDualPayment(list: BankAccountItem[]) {
  const nabiela = list.filter(isNabielaBankAccountRow);
  const others = list.filter((row) => !isNabielaBankAccountRow(row));
  return { nabiela, others, isDual: nabiela.length > 0 && others.length > 0 };
}

/** Bagi sisa pembayaran: bagian siskopatuh mengacu subtotal item siskopatuh (maks. sisa tagihan). */
function suggestedDualPaymentAmounts(viewInv: any): { other: number; nabiela: number } {
  const rem = Math.round(parseFloat(viewInv?.remaining_amount || 0));
  const items = viewInv?.Order?.OrderItems || [];
  const siskSubtotal = items
    .filter((i: any) => (i.type || i.product_type || '').toLowerCase() === 'siskopatuh')
    .reduce((s: number, i: any) => s + (parseFloat(i.subtotal) || 0), 0);
  const nabiela = Math.min(Math.round(siskSubtotal), rem);
  const other = Math.max(0, rem - nabiela);
  return { other, nabiela };
}

/** Invoice boleh dipilih sebagai tujuan alokasi dana: sisa tagihan > 0, bukan batal/lunas, order aktif. */
function isInvoiceReallocateTarget(inv: any, excludeInvoiceId?: string): boolean {
  if (!inv?.id) return false;
  if (excludeInvoiceId && inv.id === excludeInvoiceId) return false;
  const st = (inv.status || '').toLowerCase();
  const blocked =
    st === 'canceled' ||
    st === 'cancelled' ||
    st === 'cancelled_refund' ||
    st === 'refunded' ||
    st === 'refund_canceled' ||
    st === 'draft' ||
    st === 'paid' ||
    st === 'completed' ||
    st === 'overpaid_transferred';
  if (blocked) return false;
  const remain = parseFloat(inv.remaining_amount ?? 0);
  if (!Number.isFinite(remain) || remain <= 0) return false;
  const ordSt = inv.Order?.status != null ? String(inv.Order.status).toLowerCase() : '';
  if (ordSt === 'cancelled' || ordSt === 'canceled') return false;
  return true;
}

/** Selaras backend: lunas (sisa ~0 atau status paid/completed) → owner mengajukan pembatalan ke Admin Pusat. */
function isInvoiceFullyPaidOwnerCancelFlow(inv: any): boolean {
  const paid = parseFloat(inv?.paid_amount) || 0;
  if (paid <= 0) return false;
  const rem = parseFloat(inv?.remaining_amount) || 0;
  const st = String(inv?.status || '').toLowerCase();
  return rem <= 0.01 || st === 'paid' || st === 'completed';
}

const OWNER_CANCEL_MAX_CALENDAR_DAYS = 7;

function calendarDaysBetweenUtcDateOnly(a: Date, b: Date): number {
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

/** Tanggal acuan: order dibuat (Order.created_at). */
function getInvoiceOrderCreatedAt(inv: any): Date | null {
  const raw = inv?.Order?.created_at ?? inv?.Order?.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Owner boleh membatalkan lewat UI hanya jika belum lewat 7 hari kalender sejak order dibuat (tim invoice tidak dibatasi). */
function isOwnerWithinOrderCancelWindow(inv: any): boolean {
  const d = getInvoiceOrderCreatedAt(inv);
  if (!d) return true;
  return calendarDaysBetweenUtcDateOnly(d, new Date()) < OWNER_CANCEL_MAX_CALENDAR_DAYS;
}

/** Jumlah hari kalender dari ymd A ke ymd B (format YYYY-MM-DD). */
function calendarDaysBetweenYmdStrings(fromYmd: string, toYmd: string): number {
  const parse = (s: string) => {
    const p = s.slice(0, 10).split('-').map(Number);
    if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return NaN;
    return Date.UTC(p[0], p[1] - 1, p[2]);
  };
  const a = parse(fromYmd);
  const b = parse(toYmd);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pushServiceYmd(bucket: string[], raw: unknown) {
  if (raw == null || raw === '') return;
  const s = String(raw).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) bucket.push(s);
}

function getItemMetaObj(item: any): Record<string, unknown> {
  const m = item?.meta;
  if (!m) return {};
  if (typeof m === 'string') {
    try {
      return JSON.parse(m) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof m === 'object') return m as Record<string, unknown>;
  return {};
}

/** Tanggal layanan terawal dari item order (check-in hotel, berangkat tiket, travel visa/bus, dll.). */
function getEarliestServiceYmdFromInvoice(inv: any): string | null {
  const items = inv?.Order?.OrderItems;
  if (!Array.isArray(items) || items.length === 0) return null;
  const all: string[] = [];
  for (const it of items) {
    const meta = getItemMetaObj(it);
    pushServiceYmd(all, meta.check_in);
    pushServiceYmd(all, meta.departure_date);
    pushServiceYmd(all, meta.return_date);
    pushServiceYmd(all, meta.travel_date);
    pushServiceYmd(all, meta.service_date);
    const hp = it?.HotelProgress;
    if (hp?.check_in_date) pushServiceYmd(all, hp.check_in_date);
  }
  if (all.length === 0) return null;
  return all.sort()[0];
}

/** Hari kalender: owner tidak boleh batalkan jika layanan terawal sudah lewat atau dalam 7 hari ke depan (termasuk besok). */
const OWNER_CANCEL_SERVICE_EXCLUSION_DAYS = 7;

function isOwnerCancelBlockedByUpcomingService(inv: any): boolean {
  const earliest = getEarliestServiceYmdFromInvoice(inv);
  if (!earliest) return false;
  const today = todayLocalYmd();
  const daysUntil = calendarDaysBetweenYmdStrings(today, earliest);
  if (!Number.isFinite(daysUntil)) return false;
  if (daysUntil < 0) return true;
  return daysUntil < OWNER_CANCEL_SERVICE_EXCLUSION_DAYS;
}

/** Tagihan DP (tentative/draft, belum ada pembayaran): owner boleh batalkan tanpa batas 7 hari order / tanggal layanan. */
function isOwnerInvoiceTagihanDpPhase(inv: any): boolean {
  const paid = parseFloat(inv?.paid_amount) || 0;
  if (paid > 0.01) return false;
  const st = (inv?.status || '').toLowerCase();
  return st === 'tentative' || st === 'draft' || !!inv?.is_draft_order;
}

/** Gabungan aturan owner: jendela dari tanggal order + tidak dalam masa 7 hari menjelang layanan. */
function canOwnerCancelInvoiceInUi(inv: any): boolean {
  if (isOwnerInvoiceTagihanDpPhase(inv)) return true;
  return isOwnerWithinOrderCancelWindow(inv) && !isOwnerCancelBlockedByUpcomingService(inv);
}

/**
 * Order & Invoice - Satu komponen untuk menu Invoice (admin pusat, koordinator, divisi hotel/bus/visa/tiket, accounting, owner).
 * Data dibatasi: koordinator & divisi visa/tiket = wilayah masing-masing; hotel & bus = semua wilayah.
 * Modal Detail Invoice: tab Invoice & Order & tab Bukti Bayar, file preview inline.
 */
type ApiOrder = {
  id: string;
  order_number: string;
  owner_id?: string;
  status: string;
  total_amount: number;
  created_at: string;
  User?: { id: string; name?: string; company_name?: string };
  Branch?: { id: string; code?: string; name?: string };
};

const OrdersInvoicesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const canOrderAction = (user?.role === 'owner_mou' || user?.role === 'owner_non_mou') || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const isOwnerRoleUser = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';
  const isInvoiceTeamUser = user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const [branchId, setBranchId] = useState<string>('');
  const [wilayahId, setWilayahId] = useState<string>('');
  const [provinsiId, setProvinsiId] = useState<string>('');
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ id: string | number; name?: string; nama?: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; user_id?: string; User?: { id: string; name: string; company_name?: string } }[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterOwnerId, setFilterOwnerId] = useState<string>('');
  const [filterInvoiceNumber, setFilterInvoiceNumber] = useState<string>(() => searchParams.get('invoice_number') || '');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterDueStatus, setFilterDueStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'invoice' | 'payments' | 'progress' | 'invoice_refund'>('invoice');
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [orderRevisions, setOrderRevisions] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingArchiveId, setLoadingArchiveId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingProofId, setDeletingProofId] = useState<string | null>(null);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [summary, setSummary] = useState<InvoicesSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [statModal, setStatModal] = useState<'total_invoice' | 'total_tagihan' | 'dibayar' | 'sisa' | null>(null);
  const [statusModal, setStatusModal] = useState<string | null>(null);
  const [exportingInvoicesExcel, setExportingInvoicesExcel] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'va' | 'qris' | 'saudi'>('bank');
  const [payAmountIdr, setPayAmountIdr] = useState<string>('');
  const [payTransferDate, setPayTransferDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payTransferTime, setPayTransferTime] = useState<string>(() => new Date().toTimeString().slice(0, 8));
  const [payBankIndex, setPayBankIndex] = useState<number>(0);
  const [payFile, setPayFile] = useState<File | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payCurrencySaudi, setPayCurrencySaudi] = useState<'SAR' | 'USD' | 'IDR'>('SAR');
  const [payAmountSaudi, setPayAmountSaudi] = useState<string>('');
  const [uploadingJamaahItemId, setUploadingJamaahItemId] = useState<string | null>(null);
  const [downloadingJamaahItemId, setDownloadingJamaahItemId] = useState<string | null>(null);
  const [jamaahLinkInput, setJamaahLinkInput] = useState<Record<string, string>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetInv, setCancelTargetInv] = useState<any | null>(null);
  const [cancelAction, setCancelAction] = useState<'to_balance' | 'refund' | 'allocate_to_order'>('to_balance');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBankName, setCancelBankName] = useState('');
  const [cancelAccountNumber, setCancelAccountNumber] = useState('');
  const [cancelAccountHolderName, setCancelAccountHolderName] = useState('');
  const [cancelRefundAmount, setCancelRefundAmount] = useState<string>('');
  const [cancelRemainderAction, setCancelRemainderAction] = useState<'to_balance' | 'allocate_to_order'>('to_balance');
  const [cancelRemainderTargetInvoiceId, setCancelRemainderTargetInvoiceId] = useState('');
  const [cancelTargetInvoiceId, setCancelTargetInvoiceId] = useState('');
  const [cancelTargetInvoiceOptions, setCancelTargetInvoiceOptions] = useState<any[]>([]);
  const [cancelModalTab, setCancelModalTab] = useState<'view_invoice' | 'invoice_refund'>('view_invoice');
  const [cancelModalPdfUrl, setCancelModalPdfUrl] = useState<string | null>(null);
  const [loadingCancelPdf, setLoadingCancelPdf] = useState(false);
  const [cancelOwnerNote, setCancelOwnerNote] = useState('');
  const [ownerBalance, setOwnerBalance] = useState<number | null>(null);
  const [ownerBalanceLoading, setOwnerBalanceLoading] = useState(false);
  const [invoiceOwnerBalance, setInvoiceOwnerBalance] = useState<number | null>(null);
  const [invoiceOwnerBalanceLoading, setInvoiceOwnerBalanceLoading] = useState(false);
  const [invoiceOwnerBalanceError, setInvoiceOwnerBalanceError] = useState(false);
  const [allocateAmount, setAllocateAmount] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [showReallocateModal, setShowReallocateModal] = useState(false);
  const [reallocateRows, setReallocateRows] = useState<Array<{ source_invoice_id: string; target_invoice_id: string; amount: string }>>([]);
  const [reallocateNotes, setReallocateNotes] = useState('');
  const [reallocateSubmitting, setReallocateSubmitting] = useState(false);
  const [reallocateInvoiceList, setReallocateInvoiceList] = useState<any[]>([]);
  const [reallocateListLoading, setReallocateListLoading] = useState(false);
  const [paymentBankAccounts, setPaymentBankAccounts] = useState<BankAccountItem[]>([]);
  const [paymentBankAccountsLoading, setPaymentBankAccountsLoading] = useState(false);
  const [paymentBanks, setPaymentBanks] = useState<BankItem[]>([]);
  const [payBankId, setPayBankId] = useState<string>('');
  const [paySenderAccountName, setPaySenderAccountName] = useState<string>('');
  const [paySenderAccountNumber, setPaySenderAccountNumber] = useState<string>('');
  /** Dua transfer bank: produk lain vs siskopatuh (rekening Mandiri / Nabiela). */
  const [payBankIndexOther, setPayBankIndexOther] = useState(0);
  const [payBankIndexNabiela, setPayBankIndexNabiela] = useState(0);
  const [payBankIdOther, setPayBankIdOther] = useState('');
  const [payBankIdNabiela, setPayBankIdNabiela] = useState('');
  const [paySenderAccountNameOther, setPaySenderAccountNameOther] = useState('');
  const [paySenderAccountNumberOther, setPaySenderAccountNumberOther] = useState('');
  const [paySenderAccountNameNabiela, setPaySenderAccountNameNabiela] = useState('');
  const [paySenderAccountNumberNabiela, setPaySenderAccountNumberNabiela] = useState('');
  const [payAmountIdrOther, setPayAmountIdrOther] = useState('');
  const [payAmountIdrNabiela, setPayAmountIdrNabiela] = useState('');
  const [payFileOther, setPayFileOther] = useState<File | null>(null);
  const [payFileNabiela, setPayFileNabiela] = useState<File | null>(null);
  const [draftOrders, setDraftOrders] = useState<any[]>([]);
  const [publishingDraftOrderId, setPublishingDraftOrderId] = useState<string | null>(null);
  const [publishDraftModalInv, setPublishDraftModalInv] = useState<any | null>(null);
  const [publishDraftPicName, setPublishDraftPicName] = useState('');
  const [uploadDocInvoice, setUploadDocInvoice] = useState<any | null>(null);
  const [uploadDocTab, setUploadDocTab] = useState<'hotel' | 'visa' | 'ticket' | 'siskopatuh'>('hotel');
  const [uploadDocLoading, setUploadDocLoading] = useState(false);

  const isAdminPusat = user?.role === 'admin_pusat';
  const canReallocate = ['owner_mou', 'owner_non_mou', 'invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(user?.role || '');
  const isAccounting = user?.role === 'role_accounting';
  const isInvoiceSaudi = user?.role === 'invoice_saudi';
  const isDraftRow = (inv: any) => inv?.status === 'draft' || inv?.is_draft_order;
  const canPayInvoice = (inv: any) => {
    if (!inv || isDraftRow(inv) || parseFloat(inv.remaining_amount || 0) <= 0) return false;
    return inv.owner_id === user?.id || ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(user?.role || '');
  };

  /** Tim invoice/admin: lihat & pakai saldo akun owner terdaftar untuk alokasi ke invoice (bukan saldo user login). */
  const canUseInvoiceOwnerBalance = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(user?.role || '');

  const showLocationFilters = isAdminPusat || isAccounting || isInvoiceSaudi || user?.role === 'invoice_koordinator';
  const fetchBranches = useCallback(async () => {
    if (!showLocationFilters) return;
    try {
      const params: { limit: number; page: number; wilayah_id?: string; provinsi_id?: string } = { limit: 500, page: 1 };
      if (wilayahId) params.wilayah_id = wilayahId;
      if (provinsiId) params.provinsi_id = provinsiId;
      const res = await branchesApi.list(params);
      if (res.data.success) setBranches(res.data.data || []);
    } catch {
      setBranches([]);
    }
  }, [showLocationFilters, wilayahId, provinsiId]);

  useEffect(() => {
    if (showLocationFilters) {
      branchesApi.listWilayah().then((r) => { if (r.data.success) setWilayahList(r.data.data || []); }).catch(() => {});
      branchesApi.listProvinces().then((r) => { if (r.data.success) setProvinces(r.data.data || []); }).catch(() => {});
    }
  }, [showLocationFilters]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const fetchOwners = async () => {
    const canListOwners = isAdminPusat || isAccounting || isInvoiceSaudi || user?.role === 'invoice_koordinator';
    if (!canListOwners) return; // GET /owners untuk admin, accounting, invoice Saudi, koordinator wilayah
    try {
      const params: { branch_id?: string; wilayah_id?: string; limit?: number } = { limit: 500 };
      if (branchId) params.branch_id = branchId;
      if (user?.role === 'invoice_koordinator' && user?.wilayah_id) params.wilayah_id = user.wilayah_id;
      const res = await ownersApi.list(params);
      if (res.data.success) setOwners(res.data.data || []);
    } catch {
      setOwners([]);
    }
  };

  const buildListParams = () => {
    const params: Record<string, string | number | undefined> = { limit, page, sort_by: sortBy, sort_order: sortOrder };
    if (branchId) params.branch_id = branchId;
    if (wilayahId) params.wilayah_id = wilayahId;
    if (provinsiId) params.provinsi_id = provinsiId;
    if (filterStatus) params.status = filterStatus;
    if (filterOwnerId) params.owner_id = filterOwnerId;
    if (filterInvoiceNumber.trim()) params.invoice_number = filterInvoiceNumber.trim();
    if (filterDateFrom) params.date_from = filterDateFrom;
    if (filterDateTo) params.date_to = filterDateTo;
    if (filterDueStatus) params.due_status = filterDueStatus;
    return params;
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const params: Record<string, string> = {};
      if (branchId) params.branch_id = branchId;
      if (wilayahId) params.wilayah_id = wilayahId;
      if (provinsiId) params.provinsi_id = provinsiId;
      if (filterStatus) params.status = filterStatus;
      if (filterOwnerId) params.owner_id = filterOwnerId;
      if (filterInvoiceNumber.trim()) params.invoice_number = filterInvoiceNumber.trim();
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      if (filterDueStatus) params.due_status = filterDueStatus;
      const res = await invoicesApi.getSummary(params);
      if (res.data.success && res.data.data) setSummary(res.data.data);
      else setSummary(null);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = buildListParams();
      const listRes = await invoicesApi.list(params);
      if (listRes.data.success) {
        const data = listRes.data.data || [];
        setInvoices(data);
        const pag = (listRes.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(pag || (data.length > 0 ? { total: data.length, page: 1, limit: data.length, totalPages: 1 } : null));
        const summaryPayload = (listRes.data as { summary?: InvoicesSummaryData }).summary;
        if (summaryPayload) setSummary(summaryPayload);
      } else {
        setPagination(null);
        setSummary(null);
      }
    } catch {
      setInvoices([]);
      setPagination(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
    // Draft orders dipanggil terpisah agar jika gagal (mis. 500) daftar invoice tetap tampil
    try {
      const draftRes = await invoicesApi.getDraftOrders({ branch_id: branchId || undefined, wilayah_id: wilayahId || undefined, provinsi_id: provinsiId || undefined });
      if (draftRes.data.success) setDraftOrders(draftRes.data.data || []);
      else setDraftOrders([]);
    } catch {
      setDraftOrders([]);
    }
  };

  const fetchInvoiceDetail = async (id: string) => {
    try {
      const res = await invoicesApi.getById(id);
      if (res.data.success) setViewInvoice(res.data.data);
    } catch {
      showToast('Gagal memuat detail invoice', 'error');
    }
  };

  /** Tutup modal ringkasan (card Total / Per Status) lalu buka modal Detail Invoice — sama dengan aksi di tabel utama. */
  const openInvoiceDetailFromStatModal = (inv: any, tab: 'invoice' | 'invoice_refund' = 'invoice') => {
    setStatModal(null);
    setStatusModal(null);
    setViewInvoice(inv);
    setDetailTab(tab);
    void fetchInvoiceDetail(inv.id);
  };

  const openUploadDocModal = async (inv: any) => {
    if (!inv?.id || !inv?.order_id) return;
    setUploadDocInvoice(inv);
    setUploadDocLoading(true);
    try {
      const res = await invoicesApi.getById(inv.id);
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        setUploadDocInvoice(data);
        const items = data.Order?.OrderItems || [];
        const hasHotel = items.some((i: any) => (i.type || i.product_type) === 'hotel');
        const hasVisa = items.some((i: any) => (i.type || i.product_type) === 'visa');
        const hasTicket = items.some((i: any) => (i.type || i.product_type) === 'ticket');
        const hasSiskopatuh = items.some((i: any) => (i.type || i.product_type) === 'siskopatuh');
        if (hasHotel) setUploadDocTab('hotel');
        else if (hasVisa) setUploadDocTab('visa');
        else if (hasTicket) setUploadDocTab('ticket');
        else if (hasSiskopatuh) setUploadDocTab('siskopatuh');
      }
    } catch {
      showToast('Gagal memuat data order', 'error');
      setUploadDocInvoice(null);
    } finally {
      setUploadDocLoading(false);
    }
  };

  const fetchCurrencyRates = async () => {
    try {
      const res = await businessRulesApi.get({});
      if (res.data?.data?.currency_rates) {
        const cr = res.data.data.currency_rates;
        setCurrencyRates(typeof cr === 'string' ? JSON.parse(cr) : cr);
      }
    } catch {}
  };

  const openCancelModal = (inv: any) => {
    if (!canOrderAction || !inv?.order_id) return;
    if (shouldHideInvoiceCancelAction(inv)) {
      showToast('Invoice ini sudah dibatalkan atau tidak dapat dibatalkan lagi.', 'error');
      return;
    }
    if (isOwnerRoleUser && !isInvoiceTeamUser && !canOwnerCancelInvoiceInUi(inv)) {
      if (isOwnerCancelBlockedByUpcomingService(inv)) {
        showToast('Pembatalan tidak tersedia karena tanggal layanan (check-in/keberangkatan) sudah dalam 7 hari. Hubungi tim invoice.', 'error');
      } else {
        showToast('Pembatalan oleh owner hanya dalam 7 hari sejak order dibuat. Hubungi tim invoice.', 'error');
      }
      return;
    }
    const paid = parseFloat(inv.paid_amount || 0);
    const formatNum = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setCancelTargetInv(inv);
    setCancelAction('to_balance');
    setCancelReason('');
    setCancelBankName('');
    setCancelAccountNumber('');
    setCancelAccountHolderName('');
    setCancelRefundAmount(paid > 0 ? formatNum(paid) : '');
    setCancelRemainderAction('to_balance');
    setCancelRemainderTargetInvoiceId('');
    setCancelTargetInvoiceId('');
    setCancelModalTab('view_invoice');
    setCancelModalPdfUrl(null);
    setCancelOwnerNote('');
    setShowCancelModal(true);
    if (paid > 0 && inv.owner_id) {
      invoicesApi.list({ owner_id: inv.owner_id, limit: 200 })
        .then((r: any) => {
          const list = (r.data?.data ?? []) as any[];
          const options = list.filter((i: any) => isInvoiceReallocateTarget(i, inv.id));
          setCancelTargetInvoiceOptions(options);
        })
        .catch(() => setCancelTargetInvoiceOptions([]));
    } else setCancelTargetInvoiceOptions([]);
  };

  const fetchOwnerBalance = useCallback(() => {
    if (user?.role !== 'owner_mou' && user?.role !== 'owner_non_mou') return;
    setOwnerBalanceLoading(true);
    ownersApi.getMyBalance()
      .then((res) => { if (res.data?.success && res.data?.data) setOwnerBalance(res.data.data.balance); })
      .catch(() => setOwnerBalance(null))
      .finally(() => setOwnerBalanceLoading(false));
  }, [user?.role]);

  useEffect(() => {
    if (!viewInvoice?.owner_id || !canUseInvoiceOwnerBalance) {
      setInvoiceOwnerBalance(null);
      setInvoiceOwnerBalanceLoading(false);
      setInvoiceOwnerBalanceError(false);
      return;
    }
    let cancelled = false;
    setInvoiceOwnerBalanceLoading(true);
    setInvoiceOwnerBalanceError(false);
    ownersApi
      .getBalanceForUser(viewInvoice.owner_id)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && res.data?.data) {
          setInvoiceOwnerBalance(res.data.data.balance);
          setInvoiceOwnerBalanceError(false);
        } else {
          setInvoiceOwnerBalance(null);
          setInvoiceOwnerBalanceError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInvoiceOwnerBalance(null);
          setInvoiceOwnerBalanceError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setInvoiceOwnerBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewInvoice?.owner_id, canUseInvoiceOwnerBalance]);

  const handleTerbitkanDraft = (inv: any) => {
    if (!inv?.order_id || !isDraftRow(inv)) return;
    const pref = String(inv.pic_name || inv.Order?.pic_name || '').trim();
    setPublishDraftPicName(pref);
    setPublishDraftModalInv(inv);
  };

  const submitPublishDraft = async () => {
    const inv = publishDraftModalInv;
    if (!inv?.order_id) return;
    const pic = publishDraftPicName.trim();
    if (!pic) {
      showToast('Nama PIC wajib diisi.', 'error');
      return;
    }
    setPublishingDraftOrderId(inv.order_id);
    try {
      await invoicesApi.create({ order_id: inv.order_id, pic_name: pic });
      showToast('Invoice diterbitkan. Pembayaran dapat dilakukan sekarang.', 'success');
      setPublishDraftModalInv(null);
      fetchInvoices();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menerbitkan invoice', 'error');
    } finally {
      setPublishingDraftOrderId(null);
    }
  };

  const handleDeleteOrder = async (inv: any) => {
    if (!canOrderAction || !inv?.order_id) return;
    if (shouldHideInvoiceCancelAction(inv)) {
      showToast('Invoice ini sudah dibatalkan atau tidak dapat dibatalkan lagi.', 'error');
      return;
    }
    if (isOwnerRoleUser && !isInvoiceTeamUser && !canOwnerCancelInvoiceInUi(inv)) {
      if (isOwnerCancelBlockedByUpcomingService(inv)) {
        showToast('Pembatalan tidak tersedia karena tanggal layanan (check-in/keberangkatan) sudah dalam 7 hari. Hubungi tim invoice.', 'error');
      } else {
        showToast('Pembatalan oleh owner hanya dalam 7 hari sejak order dibuat. Hubungi tim invoice.', 'error');
      }
      return;
    }
    const paidAmount = parseFloat(inv.paid_amount) || 0;
    if (paidAmount > 0) {
      openCancelModal(inv);
      return;
    }
    if (!window.confirm(`Batalkan invoice "${inv.invoice_number || inv.id}"?`)) return;
    setDeletingOrderId(inv.order_id);
    try {
      await ordersApi.delete(inv.order_id);
      showToast('Order dibatalkan', 'success');
      fetchInvoices();
    } catch (e: any) {
      const code = e.response?.data?.code;
      if (code === 'OWNER_CANCEL_WINDOW_EXPIRED') {
        showToast(e.response?.data?.message || 'Batas 7 hari pembatalan owner telah lewat.', 'error');
      } else if (code === 'OWNER_CANCEL_SERVICE_TOO_SOON') {
        showToast(e.response?.data?.message || 'Pembatalan tidak tersedia karena tanggal layanan sudah dekat.', 'error');
      } else {
        showToast(e.response?.data?.message || 'Gagal membatalkan order', 'error');
      }
    } finally {
      setDeletingOrderId(null);
    }
  };

  const submitCancelModal = async () => {
    if (!cancelTargetInv?.order_id) return;
    if (shouldHideInvoiceCancelAction(cancelTargetInv)) {
      showToast('Invoice ini sudah dibatalkan atau tidak dapat dibatalkan lagi.', 'error');
      setShowCancelModal(false);
      return;
    }
    if (isOwnerRoleUser && !isInvoiceTeamUser && !canOwnerCancelInvoiceInUi(cancelTargetInv)) {
      if (isOwnerCancelBlockedByUpcomingService(cancelTargetInv)) {
        showToast('Pembatalan tidak tersedia karena tanggal layanan (check-in/keberangkatan) sudah dalam 7 hari. Hubungi tim invoice.', 'error');
      } else {
        showToast('Pembatalan oleh owner hanya dalam 7 hari sejak order dibuat. Hubungi tim invoice.', 'error');
      }
      return;
    }
    const paid = parseFloat(cancelTargetInv.paid_amount) || 0;
    if (paid > 0 && cancelAction === 'refund') {
      if (!cancelBankName.trim() || !cancelAccountNumber.trim()) {
        showToast('Untuk refund wajib isi Nama Bank dan Nomor Rekening', 'error');
        return;
      }
      const refundAmt = cancelRefundAmount.trim() ? parseFloat(cancelRefundAmount.replace(/,/g, '')) : paid;
      if (!Number.isFinite(refundAmt) || refundAmt <= 0) {
        showToast('Jumlah refund tidak valid', 'error');
        return;
      }
    }
    if (paid > 0 && cancelAction === 'allocate_to_order' && !cancelTargetInvoiceId.trim()) {
      showToast('Pilih invoice tujuan untuk mengalihkan dana', 'error');
      return;
    }
    setDeletingOrderId(cancelTargetInv.order_id);
    try {
      const body: Record<string, any> = {};
      if (paid > 0) {
        body.action = cancelAction;
        if (cancelReason.trim()) body.reason = cancelReason.trim();
        if (cancelAction === 'refund') {
          body.bank_name = cancelBankName.trim();
          body.account_number = cancelAccountNumber.trim();
          if (cancelAccountHolderName.trim()) body.account_holder_name = cancelAccountHolderName.trim();
          const refundAmt = cancelRefundAmount.trim() ? parseFloat(cancelRefundAmount.replace(/,/g, '')) : paid;
          if (refundAmt < paid) {
            body.refund_amount = refundAmt;
            body.remainder_action = 'to_balance';
          }
        } else if (cancelAction === 'allocate_to_order' && cancelTargetInvoiceId.trim()) {
          body.target_invoice_id = cancelTargetInvoiceId.trim();
        }
      }
      const isOwnerUser = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';
      const ownerLunasRequest = isOwnerUser && paid > 0 && isInvoiceFullyPaidOwnerCancelFlow(cancelTargetInv);
      if (ownerLunasRequest) {
        if (cancelOwnerNote.trim()) (body as Record<string, unknown>).owner_note = cancelOwnerNote.trim();
        const res = await ordersApi.createCancellationRequest(cancelTargetInv.order_id, body as any);
        const msg = (res.data as any)?.message || 'Pengajuan pembatalan terkirim.';
        showToast(msg, 'success');
      } else {
        const res = await ordersApi.delete(cancelTargetInv.order_id, body);
        const msg = (res.data as any)?.message || 'Order dibatalkan.';
        showToast(msg, 'success');
      }
      const wasViewing = viewInvoice?.id === cancelTargetInv.id;
      closeCancelModal();
      fetchInvoices();
      if (wasViewing) setViewInvoice(null);
      if (user?.role === 'owner_mou' || user?.role === 'owner_non_mou') fetchOwnerBalance();
    } catch (e: any) {
      const code = e.response?.data?.code;
      if (code === 'CANCEL_REQUIRES_ADMIN_APPROVAL') {
        showToast(e.response?.data?.message || 'Pengajuan ke Admin Pusat diperlukan.', 'error');
      } else if (code === 'OWNER_CANCEL_WINDOW_EXPIRED') {
        showToast(e.response?.data?.message || 'Batas 7 hari pembatalan owner telah lewat.', 'error');
      } else if (code === 'OWNER_CANCEL_SERVICE_TOO_SOON') {
        showToast(e.response?.data?.message || 'Pembatalan tidak tersedia karena tanggal layanan sudah dekat.', 'error');
      } else {
        showToast(e.response?.data?.message || 'Gagal membatalkan order', 'error');
      }
    } finally {
      setDeletingOrderId(null);
    }
  };

  const fetchInvoicePdf = useCallback(async (invoiceId: string) => {
    setLoadingPdf(true);
    setInvoicePdfUrl(null);
    try {
      const res = await invoicesApi.getPdf(invoiceId);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      setInvoicePdfUrl(url);
    } catch {
      showToast('Gagal memuat PDF invoice', 'error');
    } finally {
      setLoadingPdf(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCurrencyRates();
  }, [isAdminPusat, isAccounting, isInvoiceSaudi]);

  useEffect(() => {
    const canListOwners = isAdminPusat || isAccounting || isInvoiceSaudi || user?.role === 'invoice_koordinator';
    if (canListOwners) fetchOwners();
  }, [isAdminPusat, isAccounting, isInvoiceSaudi, user?.role, user?.wilayah_id, branchId]);

  useEffect(() => {
    setPage(1);
  }, [branchId, wilayahId, provinsiId, limit, filterStatus, filterOwnerId, filterInvoiceNumber, filterDateFrom, filterDateTo, filterDueStatus, sortBy, sortOrder]);

  useEffect(() => {
    fetchInvoices();
  }, [branchId, wilayahId, provinsiId, isAdminPusat, isAccounting, page, limit, filterStatus, filterOwnerId, filterInvoiceNumber, filterDateFrom, filterDateTo, filterDueStatus, sortBy, sortOrder]);

  useEffect(() => {
    const state = location.state as { refreshList?: boolean } | undefined;
    if (!state?.refreshList) return;
    let cancelled = false;
    (async () => {
      await fetchInvoices();
      if (cancelled) return;
      await fetchSummary();
      if (cancelled) return;
      if (viewInvoice?.id) fetchInvoiceDetail(viewInvoice.id);
      navigate(location.pathname + location.search, { replace: true, state: {} });
    })();
    return () => { cancelled = true; };
  }, [location.state]);

  const invoiceIdFromUrl = searchParams.get('invoice_id');
  useEffect(() => {
    if (!invoiceIdFromUrl) return;
    let cancelled = false;
    invoicesApi.getById(invoiceIdFromUrl)
      .then((res: any) => {
        if (cancelled) return;
        if (res.data?.success && res.data?.data) {
          setViewInvoice(res.data.data);
          setDetailTab('invoice');
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [invoiceIdFromUrl]);

  useEffect(() => {
    fetchSummary();
  }, [branchId, wilayahId, provinsiId, filterStatus, filterOwnerId, filterInvoiceNumber, filterDateFrom, filterDateTo, filterDueStatus]);

  useEffect(() => {
    if (user?.role === 'owner_mou' || user?.role === 'owner_non_mou') fetchOwnerBalance();
  }, [user?.role, fetchOwnerBalance]);

  useEffect(() => {
    if (viewInvoice && (user?.role === 'owner_mou' || user?.role === 'owner_non_mou')) fetchOwnerBalance();
  }, [viewInvoice?.id, user?.role, fetchOwnerBalance]);

  const summaryFromTable = (() => {
    if (invoices.length === 0) return null;
    const total_amount = invoices.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    // Dibayar: jangan gabungkan dana yang sudah di-refund
    const total_paid = invoices.reduce((s, i) => {
      const paid = parseFloat(i.paid_amount || 0);
      const refunded = (i.Refunds || []).filter((r: { status?: string }) => r.status === 'refunded').reduce((a: number, r: { amount?: number | string }) => a + parseFloat(String(r.amount || 0)), 0);
      return s + Math.max(0, paid - refunded);
    }, 0);
    const total_remaining = invoices.reduce((s, i) => s + parseFloat(i.remaining_amount || 0), 0);
    const orderIds = Array.from(new Set(invoices.map((i) => i.order_id).filter(Boolean)));
    const by_invoice_status = invoices.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const by_order_status = invoices.reduce((acc, i) => {
      const st = i.Order?.status;
      if (st) acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total_invoices: invoices.length,
      total_orders: orderIds.length,
      total_amount,
      total_paid,
      total_remaining,
      by_invoice_status,
      by_order_status
    };
  })();

  useEffect(() => {
    if (viewInvoice && detailTab === 'invoice') {
      fetchInvoicePdf(viewInvoice.id);
    }
  }, [viewInvoice?.id, detailTab, fetchInvoicePdf]);

  useEffect(() => {
    if (!viewInvoice?.id) {
      setStatusHistory([]);
      setOrderRevisions([]);
      return;
    }
    setAuditLoading(true);
    Promise.all([invoicesApi.getStatusHistory(viewInvoice.id), invoicesApi.getOrderRevisions(viewInvoice.id)])
      .then(([h, r]) => {
        setStatusHistory((h.data as any)?.data || []);
        setOrderRevisions((r.data as any)?.data || []);
      })
      .catch(() => {
        setStatusHistory([]);
        setOrderRevisions([]);
      })
      .finally(() => setAuditLoading(false));
  }, [viewInvoice?.id]);

  useEffect(() => {
    if (showPaymentModal) {
      setPaymentBankAccountsLoading(true);
      accountingApi.getBankAccounts({ is_active: 'true' })
        .then((r) => { if (r.data?.success && Array.isArray(r.data.data)) setPaymentBankAccounts(r.data.data); else setPaymentBankAccounts([]); })
        .catch(() => setPaymentBankAccounts([]))
        .finally(() => setPaymentBankAccountsLoading(false));
    }
    if (showPaymentModal || showCancelModal) {
      accountingApi.getBanks({ is_active: 'true' })
        .then((r) => { if (r.data?.success && Array.isArray(r.data.data)) setPaymentBanks(r.data.data); else setPaymentBanks([]); })
        .catch(() => setPaymentBanks([]));
    }
  }, [showPaymentModal, showCancelModal]);

  useEffect(() => {
    if (!showCancelModal || !cancelTargetInv?.id || cancelModalTab !== 'view_invoice') return;
    let cancelled = false;
    setLoadingCancelPdf(true);
    setCancelModalPdfUrl(null);
    invoicesApi.getPdf(cancelTargetInv.id)
      .then((res) => {
        if (cancelled) return;
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        setCancelModalPdfUrl(url);
      })
      .catch(() => { if (!cancelled) showToast('Gagal memuat PDF invoice', 'error'); })
      .finally(() => { if (!cancelled) setLoadingCancelPdf(false); });
    return () => { cancelled = true; };
  }, [showCancelModal, cancelTargetInv?.id, cancelModalTab, showToast]);

  const closeCancelModal = useCallback(() => {
    setCancelModalPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setShowCancelModal(false);
    setCancelTargetInv(null);
    setCancelReason('');
    setCancelBankName('');
    setCancelAccountNumber('');
    setCancelAccountHolderName('');
    setCancelRefundAmount('');
    setCancelRemainderTargetInvoiceId('');
    setCancelTargetInvoiceId('');
    setCancelOwnerNote('');
  }, []);

  const closeModal = useCallback(() => {
    if (invoicePdfUrl) {
      URL.revokeObjectURL(invoicePdfUrl);
      setInvoicePdfUrl(null);
    }
    setViewInvoice(null);
  }, [invoicePdfUrl]);

  const handleVerifyPayment = async (invoiceId: string, paymentProofId: string, verified: boolean) => {
    setVerifyingId(paymentProofId);
    try {
      const res = await invoicesApi.verifyPayment(invoiceId, { payment_proof_id: paymentProofId, verified });
      showToast(verified ? 'Pembayaran dikonfirmasi. Status invoice diperbarui.' : 'Pembayaran ditolak', 'success');
      if (res.data?.success && res.data?.data) {
        const updated = res.data.data;
        setViewInvoice(updated);
        setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: updated.status, paid_amount: updated.paid_amount, remaining_amount: updated.remaining_amount, PaymentProofs: updated.PaymentProofs || inv.PaymentProofs, BalanceAllocations: updated.BalanceAllocations ?? inv.BalanceAllocations } : inv)));
      }
      await fetchInvoices();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal', 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteRejectedProof = async (invoiceId: string, paymentProofId: string) => {
    if (!window.confirm('Hapus bukti bayar yang ditolak ini beserta file lampirannya? Tindakan tidak bisa dibatalkan.')) return;
    setDeletingProofId(paymentProofId);
    try {
      const res = await invoicesApi.deleteRejectedPaymentProof(invoiceId, paymentProofId);
      showToast(res.data?.message || 'Bukti bayar dihapus.', 'success');
      if (res.data?.success && res.data?.data) {
        const updated = res.data.data;
        setViewInvoice((prev: any | null) => (prev && prev.id === invoiceId ? { ...prev, ...updated, PaymentProofs: updated.PaymentProofs ?? prev.PaymentProofs } : prev));
        setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, PaymentProofs: updated.PaymentProofs || inv.PaymentProofs } : inv)));
      }
      await fetchInvoices();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menghapus bukti', 'error');
    } finally {
      setDeletingProofId(null);
    }
  };

  const handleUnblock = async (inv: any) => {
    try {
      const res = await invoicesApi.unblock(inv.id);
      showToast('Invoice diaktifkan kembali', 'success');
      const updated = res.data?.data;
      closeModal();
      if (updated) {
        const merged = { ...inv, is_blocked: false, unblocked_at: updated.unblocked_at, auto_cancel_at: updated.auto_cancel_at, Order: updated.Order ? { ...inv.Order, ...updated.Order, status: 'tentative' } : { ...inv.Order, status: 'tentative' } };
        setInvoices((prev) => prev.map((i) => (i.id === inv.id ? merged : i)));
      }
      fetchInvoices();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unblock', 'error');
    }
  };

  const openPdf = async (invoiceId: string) => {
    try {
      const res = await invoicesApi.getPdf(invoiceId);
      const blob = res.data as Blob;
      const disposition = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)|filename="?([^";\n]+)"?/);
      const filename = (match && (decodeURIComponent((match[1] || match[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) || `invoice-${invoiceId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'invoice.pdf';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unduh PDF', 'error');
    }
  };

  /** Buka PDF di tab baru (viewer browser), bukan unduh file */
  const openPdfInNewTab = async (invoiceId: string) => {
    try {
      const res = await invoicesApi.getPdf(invoiceId);
      const raw = res.data as Blob;
      const blob = raw.type === 'application/pdf' ? raw : new Blob([raw], { type: 'application/pdf' });
      const disposition = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)|filename="?([^";\n]+)"?/);
      const filename = (match && (decodeURIComponent((match[1] || match[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) || `invoice-${invoiceId}.pdf`;
      const url = URL.createObjectURL(blob);
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) {
        showToast('Popup diblokir. Izinkan popup untuk situs ini agar PDF bisa dibuka di tab baru.', 'error');
        URL.revokeObjectURL(url);
        return;
      }
      const safeTitle = filename.replace(/[<>]/g, '');
      w.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${safeTitle}</title>
            <style>
              html, body { margin: 0; padding: 0; height: 100%; background: #0b1020; }
              iframe { border: 0; width: 100%; height: 100%; }
            </style>
          </head>
          <body>
            <iframe src="${url}" title="${safeTitle}"></iframe>
          </body>
        </html>
      `);
      w.document.close();
      // Revoke setelah jeda panjang agar viewer PDF di tab baru sempat memuat blob
      setTimeout(() => URL.revokeObjectURL(url), 600000);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal membuka PDF', 'error');
    }
  };

  /** Unduh arsip ZIP: invoice PDF + semua bukti bayar (tagihan DP, pembayaran DP, lunas) + bukti refund jika ada */
  const openArchive = async (invoiceId: string) => {
    setLoadingArchiveId(invoiceId);
    try {
      const res = await invoicesApi.getArchive(invoiceId);
      const blob = res.data as Blob;
      const disposition = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)|filename="?([^";\n]+)"?/);
      const filename = (match && (decodeURIComponent((match[1] || match[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) || `invoice-${invoiceId}-arsip.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'invoice-arsip.zip';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('Arsip ZIP berhasil diunduh', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unduh arsip ZIP', 'error');
    } finally {
      setLoadingArchiveId(null);
    }
  };

  /** Unduh bukti bayar via API (supaya file yang disimpan di DB juga bisa diunduh) */
  const downloadProofFile = async (invoiceId: string, proof: { id: string; proof_file_url?: string; proof_file_name?: string }) => {
    if (!proof?.proof_file_url || proof.proof_file_url === 'issued-saudi') return;
    try {
      const res = await invoicesApi.getPaymentProofFile(invoiceId, proof.id);
      const blob = res.data as Blob;
      const disp = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const m = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)|filename=["']?([^"'\s;]+)/i);
      const name = (m && (decodeURIComponent((m[1] || m[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) || (proof as any).proof_file_name || `bukti-bayar-${proof.id.slice(-6)}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'bukti-bayar';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unduh bukti bayar', 'error');
    }
  };

  /** Unduh file manifest jamaah via API (sama seperti invoice/visa/tiket) */
  const downloadManifestFile = async (invoiceId: string, orderItemId: string) => {
    try {
      const res = await invoicesApi.getManifestFile(invoiceId, orderItemId);
      const blob = res.data as Blob;
      const disp = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const m = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)|filename=["']?([^"'\s;]+)/i);
      const name = (m && (decodeURIComponent((m[1] || m[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) || `manifest-${orderItemId.slice(-6)}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('File manifest berhasil diunduh', 'success');
    } catch (e: any) {
      const msg = e.response?.data?.message || (e.response?.status === 404 ? 'File tidak tersedia di server' : 'Gagal unduh manifest');
      showToast(msg, 'error');
    }
  };

  /** Unduh dokumen terbit (tiket/visa) via API — file di-stream dari server, mengatasi "file not available" */
  const downloadIssuedDoc = async (invoiceId: string, orderItemId: string, type: 'ticket' | 'visa' | 'siskopatuh') => {
    try {
      const res =
        type === 'ticket'
          ? await invoicesApi.getTicketFile(invoiceId, orderItemId)
          : type === 'visa'
            ? await invoicesApi.getVisaFile(invoiceId, orderItemId)
            : await invoicesApi.getSiskopatuhFile(invoiceId, orderItemId);
      const blob = res.data as Blob;
      const disp = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const m = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)|filename=["']?([^"'\s;]+)/i);
      const name =
        (m && (decodeURIComponent((m[1] || m[2] || '').replace(/^["']|["']$/g, '').trim()) || '')) ||
        `dokumen-terbit-${type}-${orderItemId.slice(-6)}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('Dokumen terbit berhasil diunduh', 'success');
    } catch (e: any) {
      const msg = e.response?.data?.message || (e.response?.status === 404 ? 'File tidak tersedia di server' : 'Gagal unduh dokumen terbit');
      showToast(msg, 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
      paid: 'success', partial_paid: 'warning', tentative: 'default', draft: 'info', confirmed: 'info',
      processing: 'info', completed: 'success', overdue: 'error', canceled: 'error', cancelled: 'error', cancelled_refund: 'error',
      refunded: 'default', order_updated: 'warning', overpaid: 'warning', overpaid_transferred: 'info',
      overpaid_received: 'info', refund_canceled: 'error', overpaid_refund_pending: 'warning'
    };
    return (map[status] || 'default') as 'success' | 'warning' | 'info' | 'error' | 'default';
  };

  const formatDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
  const formatDateWithTime = (d: string | null | undefined, time: string | null | undefined) => {
    const dateStr = formatDate(d ?? null);
    if (dateStr === '-') return '–';
    const t = (time || '').trim();
    return t ? `${dateStr}, ${t}` : `${dateStr}, –`;
  };

  const VISA_STATUS_LABELS = PROGRESS_LABELS.visa;
  const TICKET_STATUS_LABELS = PROGRESS_LABELS.ticket;
  const HOTEL_STATUS_LABELS = PROGRESS_LABELS.hotel;
  const BUS_TICKET_LABELS = PROGRESS_LABELS.bus;

  const handleUploadJamaahData = async (orderId: string, itemId: string, file: File | null, link: string) => {
    if (!file && !link?.trim()) {
      showToast('Upload file ZIP atau isi link Google Drive', 'error');
      return;
    }
    setUploadingJamaahItemId(itemId);
    try {
      if (file) {
        const form = new FormData();
        form.append('jamaah_file', file);
        await ordersApi.uploadJamaahData(orderId, itemId, form);
      } else {
        await ordersApi.uploadJamaahData(orderId, itemId, { jamaah_data_link: link.trim() });
      }
      showToast('Data jamaah berhasil diunggah', 'success');
      setJamaahLinkInput((prev) => ({ ...prev, [itemId]: '' }));
      if (viewInvoice?.id) fetchInvoiceDetail(viewInvoice.id);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal mengunggah data jamaah', 'error');
    } finally {
      setUploadingJamaahItemId(null);
    }
  };

  /** Unduh file data jamaah via API (stream dari server) — mengatasi "File wasn't available on site" */
  const downloadJamaahFile = async (orderId: string, itemId: string, urlPath?: string) => {
    setDownloadingJamaahItemId(itemId);
    try {
      const res = await ordersApi.getJamaahFile(orderId, itemId);
      const blob = res.data as Blob;
      const name = (urlPath && typeof urlPath === 'string' ? urlPath.replace(/^.*\//, '') : null) || `data-jamaah-${itemId.slice(-6)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('File data jamaah berhasil diunduh', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unduh file', 'error');
    } finally {
      setDownloadingJamaahItemId(null);
    }
  };

  const canUnblock = (inv: any) =>
    inv?.is_blocked && ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin', 'role_accounting'].includes(user?.role || '');

  // Hanya karyawan (bukan owner) yang boleh konfirmasi/tolak bukti bayar
  const canVerify = ['admin_pusat', 'invoice_koordinator', 'invoice_saudi', 'role_accounting', 'super_admin'].includes(user?.role || '');
  const canDeleteRejectedProof = (inv: { owner_id?: string } | null) =>
    canVerify || Boolean(inv?.owner_id && user?.id === inv.owner_id);

  const rates = viewInvoice?.currency_rates || currencyRates;
  const sarToIdr = rates.SAR_TO_IDR || 4200;
  const usdToIdr = rates.USD_TO_IDR || 15500;
  const payRemainingIdr = parseFloat(viewInvoice?.remaining_amount || 0);

  /** Blokir simpan jika jumlah melebihi sisa tagihan (transfer tunggal / ganda / Saudi setara IDR). */
  const payBankSingleExceedsRemaining = useMemo(() => {
    const amt = parseFloat(payAmountIdr.replace(/,/g, '').trim());
    if (isNaN(amt) || amt <= 0) return false;
    return amt > payRemainingIdr + 0.5;
  }, [payAmountIdr, payRemainingIdr]);

  const payBankDualExceedsRemaining = useMemo(() => {
    const a = parseFloat(payAmountIdrOther.replace(/,/g, '').trim());
    const b = parseFloat(payAmountIdrNabiela.replace(/,/g, '').trim());
    if (isNaN(a) || isNaN(b) || a <= 0 || b <= 0) return false;
    return a + b > payRemainingIdr + 0.5;
  }, [payAmountIdrOther, payAmountIdrNabiela, payRemainingIdr]);

  const paySaudiExceedsRemaining = useMemo(() => {
    const amt = parseFloat(payAmountSaudi.replace(/,/g, '').trim());
    if (isNaN(amt) || amt <= 0) return false;
    const idr = payCurrencySaudi === 'IDR' ? amt : payCurrencySaudi === 'SAR' ? amt * sarToIdr : amt * usdToIdr;
    return Math.round(idr) > payRemainingIdr + 0.5;
  }, [payAmountSaudi, payCurrencySaudi, sarToIdr, usdToIdr, payRemainingIdr]);

  const paymentProofs = viewInvoice?.PaymentProofs || [];
  const balanceAllocationsDetail = viewInvoice?.BalanceAllocations || [];
  const paymentsTabCount = paymentProofs.length + balanceAllocationsDetail.length;

  /** Preview bukti bayar: coba via API (auth), fallback ke URL langsung (sama seperti Unduh) */
  const ProofPreview = ({ invoiceId, proof }: { invoiceId: string; proof: any }) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [apiFailed, setApiFailed] = useState(false);
    const [directFailed, setDirectFailed] = useState(false);
    const blobUrlRef = React.useRef<string | null>(null);
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(proof?.proof_file_url || '');
    const directUrl = getFileUrl(proof?.proof_file_url);

    useEffect(() => {
      if (!proof?.proof_file_url || proof.proof_file_url === 'issued-saudi') return;
      let cancelled = false;
      invoicesApi.getPaymentProofFile(invoiceId, proof.id)
        .then((r) => {
          if (cancelled) return;
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          const url = URL.createObjectURL(r.data as Blob);
          blobUrlRef.current = url;
          setBlobUrl(url);
        })
        .catch(() => { if (!cancelled) setApiFailed(true); });
      return () => {
        cancelled = true;
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }, [invoiceId, proof?.id, proof?.proof_file_url]);

    if (!proof?.proof_file_url || proof.proof_file_url === 'issued-saudi') {
      return (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          Pembayaran via Saudi (issued by role invoice)
        </div>
      );
    }
    if (blobUrl) {
      return isImage ? (
        <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="block">
          <img src={blobUrl} alt="Bukti bayar" className="max-w-full max-h-72 object-contain rounded-lg border border-slate-200" />
        </a>
      ) : (
        <iframe src={blobUrl} title={`Bukti bayar ${proof.payment_type}`} className="w-full h-72 border border-slate-200 rounded-lg bg-white" />
      );
    }
    if (apiFailed && directUrl && !directFailed) {
      return isImage ? (
        <a href={directUrl} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={directUrl}
            alt="Bukti bayar"
            className="max-w-full max-h-72 object-contain rounded-lg border border-slate-200"
            onError={() => setDirectFailed(true)}
          />
        </a>
      ) : (
        <iframe src={directUrl} title={`Bukti bayar ${proof.payment_type}`} className="w-full h-72 border border-slate-200 rounded-lg bg-white" />
      );
    }
    if (apiFailed && (!directUrl || directFailed)) {
      return (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          Gagal memuat preview. Gunakan tombol Unduh.
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        {CONTENT_LOADING_MESSAGE}
      </div>
    );
  };


  // Daftar rekening untuk pembayaran: dari detail invoice (getById, BE isi dari accounting) atau fallback dari API accounting
  const bankAccountsForPayment: BankAccountItem[] =
    viewInvoice?.bank_accounts?.length > 0
      ? (viewInvoice.bank_accounts as BankAccountItem[])
      : paymentBankAccounts;

  const paymentBankAccountsSplit = useMemo(() => {
    const nabiela = bankAccountsForPayment.filter(isNabielaBankAccountRow);
    const others = bankAccountsForPayment.filter((b) => !isNabielaBankAccountRow(b));
    return { nabiela, others, isDual: nabiela.length > 0 && others.length > 0 };
  }, [bankAccountsForPayment]);

  const openPaymentModal = async () => {
    const remaining = parseFloat(viewInvoice?.remaining_amount || 0);
    const formatNum = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const list: BankAccountItem[] =
      viewInvoice?.bank_accounts?.length > 0
        ? (viewInvoice.bank_accounts as BankAccountItem[])
        : paymentBankAccounts;
    const splitOpen = splitBankAccountsForDualPayment(list);

    setPayTransferDate(new Date().toISOString().slice(0, 10));
    setPayTransferTime(new Date().toTimeString().slice(0, 8));
    setPayBankIndex(0);
    setPayBankId('');
    setPaySenderAccountName('');
    setPaySenderAccountNumber('');
    setPayFile(null);
    setPayBankIndexOther(0);
    setPayBankIndexNabiela(0);
    setPayBankIdOther('');
    setPayBankIdNabiela('');
    setPaySenderAccountNameOther('');
    setPaySenderAccountNumberOther('');
    setPaySenderAccountNameNabiela('');
    setPaySenderAccountNumberNabiela('');
    setPayAmountIdrOther('');
    setPayAmountIdrNabiela('');
    setPayFileOther(null);
    setPayFileNabiela(null);

    if (remaining > 0) {
      const sarRate = viewInvoice?.currency_rates?.SAR_TO_IDR || currencyRates?.SAR_TO_IDR || 4200;
      setPayAmountSaudi(formatNum(Math.round(remaining / sarRate)));
    } else {
      setPayAmountSaudi('');
    }

    if (splitOpen.isDual) {
      const { other, nabiela: nabAmt } = suggestedDualPaymentAmounts(viewInvoice);
      setPayAmountIdr('');
      setPayAmountIdrOther(formatNum(other));
      setPayAmountIdrNabiela(formatNum(nabAmt));
    } else if (remaining > 0) {
      setPayAmountIdr(formatNum(remaining));
    } else {
      setPayAmountIdr('');
    }

    setPaymentMethod(isInvoiceSaudi ? 'saudi' : 'bank');
    setShowPaymentModal(true);
    // Agar owner/role lain dapat daftar rekening: muat ulang detail invoice (getById mengembalikan bank_accounts dari accounting)
    if (viewInvoice?.id && (!viewInvoice.bank_accounts || viewInvoice.bank_accounts.length === 0)) {
      try {
        const res = await invoicesApi.getById(viewInvoice.id);
        if (res.data?.success && res.data?.data) setViewInvoice(res.data.data);
      } catch {
        // ignore; paymentBankAccounts fallback dari API accounting tetap di-fetch di useEffect
      }
    }
  };
  const handleSubmitPayment = async () => {
    if (!viewInvoice?.id) return;
    if (paymentMethod === 'saudi' && isInvoiceSaudi) {
      const amountS = parseFloat(payAmountSaudi.replace(/,/g, '').trim());
      if (isNaN(amountS) || amountS <= 0) {
        showToast('Masukkan jumlah pembayaran yang valid.', 'warning');
        return;
      }
      if (!payFile) {
        showToast('Upload bukti bayar wajib.', 'warning');
        return;
      }
      if (!payTransferTime) {
        showToast('Isi jam transfer sesuai bukti.', 'warning');
        return;
      }
      const remainingIdr = parseFloat(viewInvoice.remaining_amount || 0);
      const amountIdrEquiv =
        payCurrencySaudi === 'IDR'
          ? Math.round(amountS)
          : payCurrencySaudi === 'SAR'
            ? Math.round(amountS * sarToIdr)
            : Math.round(amountS * usdToIdr);
      if (amountIdrEquiv > remainingIdr + 0.5) {
        showToast(`Jumlah pembayaran melebihi sisa tagihan (${formatIDR(remainingIdr)}). Kurangi jumlah terlebih dahulu.`, 'warning');
        return;
      }
      const paymentType = parseFloat(viewInvoice.paid_amount || 0) === 0 ? 'dp' : (amountS >= 1e9 ? 'full' : 'partial');
      const form = new FormData();
      form.append('payment_location', 'saudi');
      form.append('payment_currency', payCurrencySaudi);
      form.append('amount', String(amountS));
      form.append('payment_type', paymentType);
      form.append('transfer_date', payTransferDate);
      form.append('notes', `Jam transfer pada bukti: ${payTransferTime}`);
      form.append('proof_file', payFile);
      setPaySubmitting(true);
      try {
        const res = await invoicesApi.uploadPaymentProof(viewInvoice.id, form);
        const updatedInv = res.data?.invoice;
        const proofCount = updatedInv?.PaymentProofs?.length ?? (viewInvoice?.PaymentProofs?.length ?? 0) + 1;
        const remaining = updatedInv ? parseFloat(updatedInv.remaining_amount || 0) : 0;
        showToast(`Pembayaran ke-${proofCount} dicatat. Sisa tagihan: ${formatIDR(remaining)}. Invoice terupdate.`, 'success');
        setShowPaymentModal(false);
        if (updatedInv) setViewInvoice(updatedInv);
        else {
          const detailRes = await invoicesApi.getById(viewInvoice.id);
          if (detailRes.data?.success && detailRes.data?.data) setViewInvoice(detailRes.data.data);
        }
        fetchInvoices();
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Gagal input pembayaran', 'error');
      } finally {
        setPaySubmitting(false);
      }
      return;
    }

    if (paymentMethod === 'bank' && paymentBankAccountsSplit.isDual) {
      const { nabiela: nabRows, others: otherRows } = paymentBankAccountsSplit;
      const amtOther = parseFloat(payAmountIdrOther.replace(/,/g, '').trim());
      const amtNab = parseFloat(payAmountIdrNabiela.replace(/,/g, '').trim());
      if (isNaN(amtOther) || amtOther <= 0 || isNaN(amtNab) || amtNab <= 0) {
        showToast('Isi jumlah pembayaran untuk kedua transfer (produk lain dan siskopatuh ke rekening Mandiri / Nabiela).', 'warning');
        return;
      }
      const remaining0 = parseFloat(viewInvoice.remaining_amount || 0);
      if (amtOther + amtNab > remaining0 + 0.5) {
        showToast(`Total kedua transfer melebihi sisa tagihan (${formatIDR(remaining0)}). Kurangi jumlah terlebih dahulu.`, 'warning');
        return;
      }
      if (!payFileOther || !payFileNabiela) {
        showToast('Upload bukti transfer wajib untuk kedua pembayaran (masing-masing satu file).', 'warning');
        return;
      }
      if (!payTransferTime) {
        showToast('Isi jam transfer sesuai bukti.', 'warning');
        return;
      }
      if (!payBankIdOther?.trim() || !payBankIdNabiela?.trim()) {
        showToast('Pilih bank pengirim untuk kedua transfer.', 'warning');
        return;
      }
      if (!paySenderAccountNameOther?.trim() || !paySenderAccountNameNabiela?.trim()) {
        showToast('Isi nama rekening pengirim untuk kedua transfer.', 'warning');
        return;
      }
      if (!paySenderAccountNumberOther?.trim() || !paySenderAccountNumberNabiela?.trim()) {
        showToast('Isi nomor rekening pengirim untuk kedua transfer.', 'warning');
        return;
      }
      if (
        !otherRows.length ||
        payBankIndexOther < 0 ||
        payBankIndexOther >= otherRows.length ||
        !nabRows.length ||
        payBankIndexNabiela < 0 ||
        payBankIndexNabiela >= nabRows.length
      ) {
        showToast('Pilih rekening tujuan untuk kedua transfer.', 'warning');
        return;
      }
      const bankOther = otherRows[payBankIndexOther];
      const bankNab = nabRows[payBankIndexNabiela];

      const postOneProof = async (
        amount: number,
        bank: BankAccountItem,
        senderBankId: string,
        senderName: string,
        senderNumber: string,
        file: File,
        invRef: any
      ) => {
        const rem = parseFloat(invRef.remaining_amount || 0);
        const paymentType = parseFloat(invRef.paid_amount || 0) === 0 ? 'dp' : (amount >= rem ? 'full' : 'partial');
        const form = new FormData();
        form.append('amount', String(Math.round(amount)));
        form.append('payment_type', paymentType);
        form.append('transfer_date', payTransferDate);
        form.append('notes', `Jam transfer pada bukti: ${payTransferTime}`);
        if (senderBankId) form.append('bank_id', senderBankId);
        if (senderName?.trim()) form.append('sender_account_name', senderName.trim());
        if (senderNumber?.trim()) form.append('sender_account_number', senderNumber.trim());
        if (bank?.id) form.append('recipient_bank_account_id', bank.id);
        form.append('proof_file', file);
        const res = await invoicesApi.uploadPaymentProof(invRef.id, form);
        let next = res.data?.invoice;
        if (!next) {
          const detailRes = await invoicesApi.getById(invRef.id);
          if (detailRes.data?.success && detailRes.data?.data) next = detailRes.data.data;
        }
        return next || invRef;
      };

      setPaySubmitting(true);
      try {
        let invAfter = viewInvoice;
        invAfter = await postOneProof(amtOther, bankOther, payBankIdOther, paySenderAccountNameOther, paySenderAccountNumberOther, payFileOther, invAfter);
        invAfter = await postOneProof(amtNab, bankNab, payBankIdNabiela, paySenderAccountNameNabiela, paySenderAccountNumberNabiela, payFileNabiela, invAfter);
        showToast('Kedua bukti bayar berhasil diupload. Menunggu verifikasi.', 'success');
        setShowPaymentModal(false);
        setViewInvoice(invAfter);
        fetchInvoices();
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Gagal upload salah satu bukti bayar', 'error');
      } finally {
        setPaySubmitting(false);
      }
      return;
    }

    const amount = parseFloat(payAmountIdr.replace(/,/g, '').trim());
    if (isNaN(amount) || amount <= 0) {
      showToast('Masukkan jumlah pembayaran (IDR) yang valid.', 'warning');
      return;
    }
    const remaining = parseFloat(viewInvoice.remaining_amount || 0);
    if (amount > remaining + 0.5) {
      showToast(`Jumlah pembayaran melebihi sisa tagihan (${formatIDR(remaining)}). Kurangi jumlah terlebih dahulu.`, 'warning');
      return;
    }
    if (paymentMethod === 'bank') {
      if (!payFile) {
        showToast('Upload bukti transfer wajib untuk metode Transfer Bank.', 'warning');
        return;
      }
      if (!payTransferTime) {
        showToast('Isi jam transfer sesuai bukti.', 'warning');
        return;
      }
      if (!payBankId?.trim()) {
        showToast('Pilih bank pengirim.', 'warning');
        return;
      }
      if (!paySenderAccountName?.trim()) {
        showToast('Isi nama rekening pengirim.', 'warning');
        return;
      }
      if (!paySenderAccountNumber?.trim()) {
        showToast('Isi nomor rekening pengirim.', 'warning');
        return;
      }
      if (!bankAccountsForPayment.length || payBankIndex < 0 || payBankIndex >= bankAccountsForPayment.length) {
        showToast('Pilih rekening tujuan transfer (bank penerima).', 'warning');
        return;
      }
      const bank = bankAccountsForPayment[payBankIndex];
      const paymentType = parseFloat(viewInvoice.paid_amount || 0) === 0 ? 'dp' : (amount >= remaining ? 'full' : 'partial');
      const form = new FormData();
      form.append('amount', String(Math.round(amount)));
      form.append('payment_type', paymentType);
      form.append('transfer_date', payTransferDate);
      form.append('notes', `Jam transfer pada bukti: ${payTransferTime}`);
      if (payBankId) form.append('bank_id', payBankId);
      if (paySenderAccountName?.trim()) form.append('sender_account_name', paySenderAccountName.trim());
      if (paySenderAccountNumber?.trim()) form.append('sender_account_number', paySenderAccountNumber.trim());
      if (bank?.id) form.append('recipient_bank_account_id', bank.id);
      form.append('proof_file', payFile);
      setPaySubmitting(true);
      try {
        await invoicesApi.uploadPaymentProof(viewInvoice.id, form);
        showToast('Bukti bayar berhasil diupload. Menunggu verifikasi.', 'success');
        setShowPaymentModal(false);
        const res = await invoicesApi.getById(viewInvoice.id);
        if (res.data?.success && res.data?.data) setViewInvoice(res.data.data);
        fetchInvoices();
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Gagal upload bukti bayar', 'error');
      } finally {
        setPaySubmitting(false);
      }
    } else {
      showToast('Metode VA/QRIS akan segera tersedia. Gunakan Transfer Bank.', 'info');
    }
  };

  const resetFilters = () => {
    setBranchId('');
    setWilayahId('');
    setProvinsiId('');
    setFilterStatus('');
    setFilterOwnerId('');
    setFilterInvoiceNumber('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterDueStatus('');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
  };

  const hasActiveFilters = !!(branchId || wilayahId || provinsiId || filterStatus || filterOwnerId || filterInvoiceNumber.trim() || filterDateFrom || filterDateTo || filterDueStatus || sortBy !== 'created_at' || sortOrder !== 'desc');

  /** Opsi filter Owner: gabung dari API + unique owner di data invoice agar semua owner yang punya invoice bisa dipilih dan filter tampil benar */
  const ownerFilterOptions = (() => {
    const map = new Map<string, { id: string; name?: string; User?: { name?: string; company_name?: string } }>();
    owners.forEach((o) => {
      const userId = (o as { user_id?: string }).user_id ?? o.User?.id ?? '';
      const id = String(userId).trim();
      if (!id) return;
      const name = o.User?.name || o.User?.company_name;
      if (!map.has(id)) map.set(id, { id, name, User: o.User });
    });
    invoices.forEach((inv: any) => {
      const id = inv.owner_id || inv.User?.id || inv.Order?.User?.id;
      if (!id) return;
      const sid = String(id).trim();
      if (map.has(sid)) return;
      const name = (inv.User?.name || inv.User?.company_name || inv.Order?.User?.name || inv.Order?.User?.company_name || '').trim() || undefined;
      map.set(sid, { id: sid, name, User: { name, company_name: inv.User?.company_name || inv.Order?.User?.company_name } });
    });
    return Array.from(map.values()).filter((o) => Boolean(o.id));
  })();

  const sarToIdrList = currencyRates.SAR_TO_IDR || 4200;
  const usdToIdrList = currencyRates.USD_TO_IDR || 15500;
  const amountTriple = (idr: number) => ({ idr, sar: idr / sarToIdrList, usd: idr / usdToIdrList });
  /** Dibatalkan dan belum ada pembayaran → Total & Sisa tampil 0. */
  const isCancelledNoPayment = (inv: any) => {
    const st = (inv?.status || '').toLowerCase();
    if (st !== 'canceled' && st !== 'cancelled' && st !== 'cancelled_refund') return false;
    const paidFromProofs = (inv?.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
    const paid = parseFloat(inv?.paid_amount || 0) || paidFromProofs;
    return paid <= 0;
  };
  /** Total invoice: gunakan total_amount_idr & total_amount_sar dari BE; 0 jika dibatalkan dan belum bayar. */
  const invoiceTotalTriple = (inv: any) => {
    if (isCancelledNoPayment(inv)) return { idr: 0, sar: 0, usd: 0 };
    const idr = inv?.total_amount_idr != null ? parseFloat(inv.total_amount_idr) : parseFloat(inv?.total_amount || 0);
    const sar = inv?.total_amount_sar != null ? parseFloat(inv.total_amount_sar) : idr / sarToIdrList;
    return { idr, sar, usd: idr / usdToIdrList };
  };

  /** Baru: tampil hanya jika invoice diterbitkan/dibuat dalam 1 hari terakhir (24 jam). */

  /** Label status invoice: pakai helper yang sama dengan tabel & InvoiceStatusRefundCell (sesuai data GET invoice). */
  const getInvoiceStatusLabel = (inv: any) => getEffectiveInvoiceStatusLabel(inv);

  const invoiceTableColumns: TableColumn[] = [
    { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'owner_type', label: 'Tipe Owner', align: 'left' },
    { id: 'company_wilayah', label: 'Perusahaan', align: 'left' },
    { id: 'pic_name', label: 'PIC', align: 'left' },
    { id: 'total', label: 'Total (IDR·SAR·USD)', align: 'right' },
    { id: 'paid', label: 'Status · Dibayar (IDR·SAR·USD)', align: 'right' },
    { id: 'remaining', label: 'Sisa (IDR·SAR·USD)', align: 'right' },
    { id: 'status_progress', label: 'Status Progress', align: 'left' },
    INVOICE_TABLE_COLUMN_PROOF,
    { id: 'date', label: 'Tgl', align: 'left' },
    { id: 'actions', label: 'Aksi', align: 'center' }
  ];

  const s = summary || summaryFromTable || {
    total_invoices: pagination?.total ?? 0,
    total_orders: 0,
    total_amount: 0,
    total_paid: 0,
    total_remaining: 0,
    by_invoice_status: {},
    by_order_status: {}
  };

  const isHotelOrBus = user?.role === 'role_hotel' || user?.role === 'role_bus';
  const isKoordinator = ['invoice_koordinator', 'visa_koordinator', 'tiket_koordinator'].includes(user?.role || '');
  const scopeHint = isHotelOrBus ? ' Data: semua wilayah.' : isKoordinator ? ' Data: wilayah Anda.' : '';
  // Card statistik & Per Status selalu tampil untuk semua role (termasuk tiket, handling, bus, visa, hotel) meskipun belum ada data
  const showInvoiceStatCards = true;
  // Tombol Pemindahan Dana hanya tampil jika ada invoice yang dibatalkan dan sudah ada pembayaran (paid_amount > 0)
  const hasCancelledInvoiceWithPayment = invoices.some((inv: any) => {
    const st = (inv.status || '').toLowerCase();
    const paid = parseFloat(inv.paid_amount || 0);
    const cancelledRefundAmt = parseFloat(inv.cancelled_refund_amount || 0);
    return (st === 'canceled' || st === 'cancelled' || st === 'cancelled_refund') && (paid > 0 || cancelledRefundAmt > 0);
  });
  const showReallocateButton = canReallocate && hasCancelledInvoiceWithPayment;
  const invoiceSubtitle = `Daftar invoice. Buka untuk detail, pembayaran, dan update status produk (Visa, Tiket, Hotel, Bus).${scopeHint}`;

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Invoice"
        subtitle={invoiceSubtitle}
        right={
          <>
            <AutoRefreshControl onRefresh={fetchInvoices} disabled={loading} />
            <FilterIconButton open={showFilters} onToggle={() => setShowFilters((v) => !v)} hasActiveFilters={hasActiveFilters} />
            {isAccounting && (
            <Button
              variant="outline"
              disabled={exportingInvoicesExcel}
              onClick={async () => {
                setExportingInvoicesExcel(true);
                try {
                  const params = buildListParams();
                  const res = await accountingApi.exportInvoicesExcel({
                    branch_id: params.branch_id as string | undefined,
                    provinsi_id: params.provinsi_id as string | undefined,
                    wilayah_id: params.wilayah_id as string | undefined,
                    owner_id: params.owner_id as string | undefined,
                    status: params.status as string | undefined,
                    date_from: params.date_from as string | undefined,
                    date_to: params.date_to as string | undefined,
                    invoice_number: params.invoice_number as string | undefined
                  });
                  const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `daftar-invoice-${new Date().toISOString().slice(0, 10)}.xlsx`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('Export Excel berhasil diunduh.', 'success');
                } catch {
                  showToast('Gagal export Excel.', 'error');
                } finally {
                  setExportingInvoicesExcel(false);
                }
              }}
              className="shrink-0"
            >
              <FileSpreadsheet className="w-5 h-5 mr-2" />
              {exportingInvoicesExcel ? 'Mengunduh...' : 'Export Excel'}
            </Button>
          )}
        </>
      }
      />

      {/* Baris filter full width - posisi tetap, tidak berpindah */}
      <PageFilter
        open={showFilters}
        onToggle={() => setShowFilters((v) => !v)}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
        hideToggleRow
        className="w-full"
      >
        <DashboardFilterBar
            variant="page"
            loading={loading}
            showWilayah={isAdminPusat || isAccounting || isInvoiceSaudi || user?.role === 'invoice_koordinator'}
            showProvinsi={isAdminPusat || isAccounting || isInvoiceSaudi || user?.role === 'invoice_koordinator'}
            showBranch={isAdminPusat || isAccounting || isInvoiceSaudi || user?.role === 'invoice_koordinator'}
            showStatus
            statusType="invoice"
            showOwner
            showSearch2
            search2Placeholder="No. Invoice..."
            search2={filterInvoiceNumber}
            onSearch2Change={setFilterInvoiceNumber}
            showDateRange
            showDueStatus
            showSort
            hideActions
            wilayahId={wilayahId}
            provinsiId={provinsiId}
            branchId={branchId}
            status={filterStatus}
            ownerId={filterOwnerId}
            dateFrom={filterDateFrom}
            dateTo={filterDateTo}
            dueStatus={filterDueStatus}
            sortBy={sortBy}
            sortOrder={sortOrder}
            sortOptions={[
              { value: 'created_at', label: 'Tanggal dibuat' },
              { value: 'invoice_number', label: 'Nomor invoice' },
              { value: 'total_amount', label: 'Total' },
              { value: 'status', label: 'Status' }
            ]}
            onSortByChange={setSortBy}
            onSortOrderChange={setSortOrder}
            onWilayahChange={(v) => { setWilayahId(v); setProvinsiId(''); setBranchId(''); }}
            onProvinsiChange={(v) => { setProvinsiId(v); setBranchId(''); }}
            onBranchChange={setBranchId}
            onStatusChange={setFilterStatus}
            onOwnerChange={setFilterOwnerId}
            onDateFromChange={setFilterDateFrom}
            onDateToChange={setFilterDateTo}
            onDueStatusChange={setFilterDueStatus}
            onApply={() => {}}
            wilayahList={wilayahList}
            provinces={wilayahId ? provinces.filter((p) => (p as { wilayah_id?: string }).wilayah_id === wilayahId) : provinces}
            branches={branches}
            branchLabel="Cabang"
            branchEmptyLabel={AUTOCOMPLETE_FILTER.SEMUA_CABANG}
            invoiceStatusOptions={[{ value: '', label: 'Semua status' }, ...Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
            owners={ownerFilterOptions}
            dueStatusOptions={[
              { value: '', label: 'Semua' },
              { value: 'current', label: 'Belum Jatuh Tempo' },
              { value: 'due', label: 'Jatuh Tempo' },
              { value: 'overdue', label: 'Terlambat' },
            ]}
          />
      </PageFilter>

      {/* Summary cards & Per Status: tampil untuk semua role termasuk saat belum ada data */}
      {showInvoiceStatCards && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Receipt className="w-5 h-5" />}
              label="Total Invoice"
              value={loadingSummary ? '...' : s.total_invoices.toLocaleString('id-ID')}
              iconClassName="bg-sky-100 text-sky-600"
              onClick={() => setStatModal('total_invoice')}
              action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('total_invoice')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
            />
            <StatCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Total Tagihan"
              value={loadingSummary ? '...' : <NominalDisplay amount={s.total_amount} currency="IDR" />}
              iconClassName="bg-slate-100 text-slate-600"
              subtitle={!loadingSummary ? <>Total nilai invoice · ≈ <NominalDisplay amount={s.total_amount / sarToIdrList} currency="SAR" /> · ≈ <NominalDisplay amount={s.total_amount / usdToIdrList} currency="USD" /></> : undefined}
              onClick={() => setStatModal('total_tagihan')}
              action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('total_tagihan')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
            />
            <StatCard
              icon={<CreditCard className="w-5 h-5" />}
              label="Dibayar"
              value={loadingSummary ? '...' : <NominalDisplay amount={s.total_paid} currency="IDR" />}
              iconClassName="bg-[#0D1A63]/10 text-[#0D1A63]"
              subtitle={!loadingSummary ? <>≈ <NominalDisplay amount={s.total_paid / sarToIdrList} currency="SAR" /> · ≈ <NominalDisplay amount={s.total_paid / usdToIdrList} currency="USD" /></> : undefined}
              onClick={() => setStatModal('dibayar')}
              action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('dibayar')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
            />
            <StatCard
              icon={<Wallet className="w-5 h-5" />}
              label="Sisa"
              value={loadingSummary ? '...' : <NominalDisplay amount={s.total_remaining} currency="IDR" />}
              iconClassName="bg-amber-100 text-amber-600"
              subtitle={!loadingSummary ? <>Belum dibayar · ≈ <NominalDisplay amount={s.total_remaining / sarToIdrList} currency="SAR" /> · ≈ <NominalDisplay amount={s.total_remaining / usdToIdrList} currency="USD" /></> : undefined}
              onClick={() => setStatModal('sisa')}
              action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatModal('sisa')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
            />
          </div>

          {/* Modal detail card statistik: daftar invoice terfilter sesuai statistik */}
          {statModal && (() => {
            const getPaid = (inv: any) => {
              const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
              return parseFloat(inv.paid_amount || 0) || paidFromProofs;
            };
            const getRemaining = (inv: any) => {
              if (isCancelledNoPayment(inv)) return 0;
              const totalInv = parseFloat(inv.total_amount || 0);
              return Math.max(0, totalInv - getPaid(inv));
            };
            const filteredList = statModal === 'dibayar' ? invoices.filter((inv: any) => getPaid(inv) > 0)
              : statModal === 'sisa' ? invoices.filter((inv: any) => getRemaining(inv) > 0)
              : invoices;
            const statModalColumns: TableColumn[] = [
              { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
              { id: 'owner', label: 'Owner', align: 'left' },
              { id: 'owner_type', label: 'Tipe Owner', align: 'left' },
              { id: 'company', label: 'Perusahaan', align: 'left' },
              { id: 'pic', label: 'PIC', align: 'left' },
              { id: 'total', label: 'Total', align: 'right' },
              { id: 'paid', label: 'Dibayar', align: 'right' },
              { id: 'remaining', label: 'Sisa', align: 'right' },
              { id: 'actions', label: 'Aksi', align: 'center' }
            ];
            const totalCount = pagination?.total ?? filteredList.length;
            const range = pagination ? `Halaman saat ini: ${filteredList.length} dari ${totalCount} invoice` : `${filteredList.length} invoice`;
            return (
              <Modal open onClose={() => setStatModal(null)}>
                <ModalBoxLg>
                  <ModalHeader
                    title={
                      statModal === 'total_invoice' ? 'Total Invoice' :
                      statModal === 'total_tagihan' ? 'Total Tagihan' :
                      statModal === 'dibayar' ? 'Dibayar' : 'Sisa'
                    }
                    subtitle={range + (statModal === 'dibayar' || statModal === 'sisa' ? ' (sesuai filter)' : ' sesuai filter')}
                    onClose={() => setStatModal(null)}
                  />
                  <ModalBody className="p-0 overflow-hidden flex flex-col min-h-0">
                    <div className="overflow-auto flex-1 min-h-0">
                      <Table
                        columns={statModalColumns}
                        data={filteredList}
                        emptyMessage="Tidak ada invoice dalam kategori ini."
                        renderRow={(inv: any) => {
                          const zeroOut = isCancelledNoPayment(inv);
                          const totalInv = zeroOut ? 0 : parseFloat(inv.total_amount || 0);
                          const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                          const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                          const remaining = getDisplayRemaining(inv);
                          const totalTriple = invoiceTotalTriple(inv);
                          return (
                            <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                              <td className="py-2 px-4 font-mono text-sm"><InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan compact /></td>
                              <td className="py-2 px-4 text-slate-700 text-sm">{inv.User?.name || inv.User?.company_name || inv.owner_name_manual || inv.Order?.owner_name_manual || '-'}</td>
                              <td className="py-2 px-4"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${inv.owner_is_mou ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{inv.owner_is_mou ? 'Owner MOU' : 'Non-MOU'}</span></td>
                              <td className="py-2 px-4 text-slate-600 text-sm max-w-[180px] truncate"><div>{inv.User?.company_name || inv.User?.name || inv.owner_name_manual || inv.Order?.owner_name_manual || inv.Branch?.name || '–'}</div><div className="text-xs text-slate-400">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div></td>
                              <td className="py-2 px-4 text-slate-700 text-sm">{inv.pic_name || inv.Order?.pic_name || '–'}</td>
                              <td className="py-2 px-4 text-right text-sm"><NominalDisplay amount={totalTriple.idr} currency="IDR" /></td>
                              <td className="py-2 px-4 text-right text-emerald-600 text-sm"><NominalDisplay amount={paid} currency="IDR" /></td>
                              <td className="py-2 px-4 text-right text-amber-600 font-medium text-sm"><NominalDisplay amount={remaining} currency="IDR" /></td>
                              <td className="py-2 px-4 text-center whitespace-nowrap">
                                <div className="flex justify-center">
                                  <ActionsMenu
                                    align="right"
                                    items={[
                                      { id: 'view', label: 'Lihat Invoice', icon: <Eye className="w-4 h-4" />, onClick: () => openInvoiceDetailFromStatModal(inv, 'invoice') },
                                      ...(['canceled', 'cancelled', 'cancelled_refund', 'refunded'].includes((inv.status || '').toLowerCase())
                                        ? [{ id: 'view-refund', label: 'Lihat Invoice Refund', icon: <Receipt className="w-4 h-4" />, onClick: () => openInvoiceDetailFromStatModal(inv, 'invoice_refund') }]
                                        : []),
                                      { id: 'pdf', label: 'Unduh PDF', icon: <FileText className="w-4 h-4" />, onClick: () => openPdf(inv.id) }
                                    ].filter(Boolean) as ActionsMenuItem[]}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        }}
                      />
                    </div>
                  </ModalBody>
                </ModalBoxLg>
              </Modal>
            );
          })()}

          {/* Modal Per Status Invoice: daftar invoice per status */}
          {statusModal && (() => {
            const byStatusList = invoices.filter((inv: any) => (inv.status || '') === statusModal);
            const statusListModalColumns: TableColumn[] = [
              { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
              { id: 'owner', label: 'Owner', align: 'left' },
              { id: 'owner_type', label: 'Tipe Owner', align: 'left' },
              { id: 'company', label: 'Perusahaan', align: 'left' },
              { id: 'pic', label: 'PIC', align: 'left' },
              { id: 'total', label: 'Total', align: 'right' },
              { id: 'paid', label: 'Dibayar', align: 'right' },
              { id: 'remaining', label: 'Sisa', align: 'right' },
              { id: 'actions', label: 'Aksi', align: 'center' }
            ];
            return (
              <Modal open onClose={() => setStatusModal(null)}>
                <ModalBoxLg>
                  <ModalHeader
                    title={INVOICE_STATUS_LABELS[statusModal] || statusModal}
                    subtitle={`${byStatusList.length} invoice dengan status ini (sesuai filter)`}
                    onClose={() => setStatusModal(null)}
                  />
                  <ModalBody className="p-0 overflow-hidden flex flex-col min-h-0">
                    <div className="overflow-auto flex-1 min-h-0">
                      <Table
                        columns={statusListModalColumns}
                        data={byStatusList}
                        emptyMessage="Tidak ada invoice dengan status ini."
                        renderRow={(inv: any) => {
                          const zeroOut = isCancelledNoPayment(inv);
                          const totalInv = zeroOut ? 0 : parseFloat(inv.total_amount || 0);
                          const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                          const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                          const remaining = getDisplayRemaining(inv);
                          const totalTriple = invoiceTotalTriple(inv);
                          return (
                            <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                              <td className="py-2 px-4 font-mono text-sm"><InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan compact /></td>
                              <td className="py-2 px-4 text-slate-700 text-sm">{inv.User?.name || inv.User?.company_name || inv.owner_name_manual || inv.Order?.owner_name_manual || '-'}</td>
                              <td className="py-2 px-4"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${inv.owner_is_mou ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{inv.owner_is_mou ? 'Owner MOU' : 'Non-MOU'}</span></td>
                              <td className="py-2 px-4 text-slate-600 text-sm max-w-[180px] truncate"><div>{inv.User?.company_name || inv.User?.name || inv.owner_name_manual || inv.Order?.owner_name_manual || inv.Branch?.name || '–'}</div><div className="text-xs text-slate-400">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div></td>
                              <td className="py-2 px-4 text-slate-700 text-sm">{inv.pic_name || inv.Order?.pic_name || '–'}</td>
                              <td className="py-2 px-4 text-right text-sm"><NominalDisplay amount={totalTriple.idr} currency="IDR" /></td>
                              <td className="py-2 px-4 text-right text-emerald-600 text-sm"><NominalDisplay amount={paid} currency="IDR" /></td>
                              <td className="py-2 px-4 text-right text-amber-600 font-medium text-sm"><NominalDisplay amount={remaining} currency="IDR" /></td>
                              <td className="py-2 px-4 text-center whitespace-nowrap">
                                <div className="flex justify-center">
                                  <ActionsMenu
                                    align="right"
                                    items={[
                                      { id: 'view', label: 'Lihat Invoice', icon: <Eye className="w-4 h-4" />, onClick: () => openInvoiceDetailFromStatModal(inv, 'invoice') },
                                      ...(['canceled', 'cancelled', 'cancelled_refund', 'refunded'].includes((inv.status || '').toLowerCase())
                                        ? [{ id: 'view-refund', label: 'Lihat Invoice Refund', icon: <Receipt className="w-4 h-4" />, onClick: () => openInvoiceDetailFromStatModal(inv, 'invoice_refund') }]
                                        : []),
                                      { id: 'pdf', label: 'Unduh PDF', icon: <FileText className="w-4 h-4" />, onClick: () => openPdf(inv.id) }
                                    ].filter(Boolean) as ActionsMenuItem[]}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        }}
                      />
                    </div>
                  </ModalBody>
                </ModalBoxLg>
              </Modal>
            );
          })()}

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" /> Per Status Invoice
            </h3>
            {loadingSummary ? (
              <p className="text-slate-500 text-sm">{CONTENT_LOADING_MESSAGE}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {(() => {
                  const keys: string[] = [...PER_STATUS_ALWAYS_SHOW];
                  Object.keys(s.by_invoice_status).forEach((k) => { if (!keys.includes(k)) keys.push(k); });
                  return keys
                    .filter((status) => status !== 'cancelled_refund')
                    .sort((a, b) => {
                      const ia = PER_STATUS_ORDER.indexOf(a);
                      const ib = PER_STATUS_ORDER.indexOf(b);
                      if (ia === -1 && ib === -1) return a.localeCompare(b);
                      if (ia === -1) return 1;
                      if (ib === -1) return -1;
                      return ia - ib;
                    })
                    .map((status) => {
                      const count = s.by_invoice_status[status] ?? 0;
                      const cfg = INVOICE_STATUS_CARD_CONFIG[status] || { icon: <Receipt className="w-5 h-5" /> };
                      return (
                        <StatCard
                          key={status}
                          icon={cfg.icon}
                          label={INVOICE_STATUS_LABELS[status] || status}
                          value={Number(count).toLocaleString('id-ID')}
                          onClick={() => setStatusModal(status)}
                          action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => setStatusModal(status)}><Eye className="w-4 h-4" /> Lihat</Button></div>}
                        />
                      );
                    });
                })()}
              </div>
            )}
          </div>
        </>
      )}

      <Card className="travel-card rounded-2xl border-slate-200/80 shadow-sm">
        <CardSectionHeader
          icon={<Receipt className="w-6 h-6" />}
          title={`Daftar Invoice (${(pagination?.total ?? invoices.length) + draftOrders.length})`}
          subtitle="Geser horizontal jika tabel tidak muat"
          className="mb-5 px-1"
          right={
            <div className="flex items-center gap-2 shrink-0">
              {showReallocateButton && (
                <Button variant="outline" size="sm" onClick={() => {
                  setShowReallocateModal(true);
                  setReallocateRows([{ source_invoice_id: '', target_invoice_id: '', amount: '' }]);
                  setReallocateNotes('');
                  setReallocateListLoading(true);
                  const params = { ...buildListParams(), limit: 300, page: 1 };
                  invoicesApi.list(params)
                    .then((r) => {
                      const raw = r?.data;
                      const arr = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
                      setReallocateInvoiceList(arr);
                    })
                    .catch(() => setReallocateInvoiceList([]))
                    .finally(() => setReallocateListLoading(false));
                }}>
                  <ArrowRightLeft className="w-5 h-5 mr-2" /> Pemindahan Dana
                </Button>
              )}
              {canOrderAction && (
                <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/orders/new')}>
                  <Plus className="w-5 h-5 mr-2" /> Tambah Invoice
                </Button>
              )}
            </div>
          }
        />
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          {loading ? (
            <ContentLoading />
          ) : (
            <Table
              columns={invoiceTableColumns}
              data={page === 1 ? [...draftOrders, ...invoices] : invoices}
              emptyMessage="Belum ada invoice"
              emptyDescription="Buat order lalu terbitkan invoice, atau ubah filter untuk melihat data."
              stickyActionsColumn
              pagination={
                pagination && (pagination.total > 0 || draftOrders.length > 0)
                  ? {
                      total: pagination.total,
                      page: pagination.page,
                      limit,
                      totalPages: pagination.totalPages,
                      onPageChange: setPage,
                      onLimitChange: (l) => { setLimit(l); setPage(1); }
                    }
                  : undefined
              }
              renderRow={(inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 align-top">
                      <InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS} showBaruAndPerubahan showCancellationNote />
                    </td>
                    <td className="py-3 px-4 text-slate-700 align-top">{inv.User?.name || inv.User?.company_name || inv.owner_name_manual || inv.Order?.owner_name_manual || '-'}</td>
                    <td className="py-3 px-4 align-top">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${inv.owner_is_mou ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {inv.owner_is_mou ? 'Owner MOU' : 'Non-MOU'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 align-top text-sm">
                      <div>{inv.User?.company_name || inv.User?.name || inv.owner_name_manual || inv.Order?.owner_name_manual || inv.Branch?.name || '–'}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 align-top text-sm">{inv.pic_name || inv.Order?.pic_name || '–'}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 align-top">
                      {(() => { const t = invoiceTotalTriple(inv); return <><div><NominalDisplay amount={t.idr} currency="IDR" /></div><div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div></>; })()}
                      {inv.Order?.currency_rates_override && (inv.Order.currency_rates_override.SAR_TO_IDR != null || inv.Order.currency_rates_override.USD_TO_IDR != null) && (
                        <div className="text-xs text-amber-700 mt-1 font-medium" title="Kurs & harga khusus order ini">
                          Kurs: {inv.Order.currency_rates_override.SAR_TO_IDR != null ? `SAR ${Number(inv.Order.currency_rates_override.SAR_TO_IDR).toLocaleString('id-ID')}` : ''}{inv.Order.currency_rates_override.SAR_TO_IDR != null && inv.Order.currency_rates_override.USD_TO_IDR != null ? ', ' : ''}{inv.Order.currency_rates_override.USD_TO_IDR != null ? `USD ${Number(inv.Order.currency_rates_override.USD_TO_IDR).toLocaleString('id-ID')}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right align-top">
                      <InvoiceStatusRefundCell inv={inv} currencyRates={currencyRates} align="right" />
                    </td>
                    <td className="py-3 px-4 text-right text-red-600 font-medium align-top">
                      {(() => {
                        const remaining = getDisplayRemaining(inv);
                        const t = amountTriple(remaining);
                        return <><div><NominalDisplay amount={remaining} currency="IDR" /></div><div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> <NominalDisplay amount={t.sar} currency="SAR" showCurrency={false} /> <span className="text-slate-400 ml-1">USD:</span> <NominalDisplay amount={t.usd} currency="USD" showCurrency={false} /></div></>;
                      })()}
                    </td>
                    <td className="py-3 px-4 align-top min-w-[260px] max-w-[360px]">
                      <InvoiceProgressStatusCell
                        inv={inv}
                        formatDate={formatDate}
                        formatDateWithTime={formatDateWithTime}
                        layout="table"
                      />
                    </td>
                    <td className="py-3 px-4 align-top min-w-[420px] max-w-[32rem] max-h-[300px] overflow-y-auto overflow-x-hidden">
                      <PaymentProofCell paymentProofs={inv.PaymentProofs} balanceAllocations={inv.BalanceAllocations} currencyRates={currencyRates} isDraft={isDraftRow(inv)} />
                    </td>
                    <td className="py-3 px-4 text-slate-600 align-top whitespace-nowrap">{formatDate(inv.issued_at || inv.created_at)}</td>
                    <td className="py-3 px-4 sticky right-0 bg-white hover:bg-slate-50/80 border-l border-slate-100 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex justify-center">
                        {isDraftRow(inv) ? (
                          <ActionsMenu
                            align="right"
                            items={[
                              ...(canOrderAction && inv.order_id
                                ? [
                                    { id: 'lanjutkan', label: 'Lanjutkan', icon: <Pencil className="w-4 h-4" />, onClick: () => navigate(`/dashboard/orders/${inv.order_id}/edit`) },
                                    { id: 'terbitkan', label: 'Terbitkan invoice', icon: <Send className="w-4 h-4" />, onClick: () => handleTerbitkanDraft(inv), disabled: publishingDraftOrderId === inv.order_id },
                                  ]
                                : []),
                            ].filter(Boolean) as ActionsMenuItem[]}
                          />
                        ) : (
                          <ActionsMenu
                            align="right"
                            items={[
                              ...(canOrderAction && inv.order_id
                                ? [{ id: 'edit-order', label: 'Edit Invoice', icon: <Edit className="w-4 h-4" />, onClick: () => navigate(`/dashboard/orders/${inv.order_id}/edit`) }]
                                : []),
                              ...(canOrderAction && inv.order_id
                                ? [{ id: 'upload-doc', label: 'Upload dokumen', icon: <Upload className="w-4 h-4" />, onClick: () => openUploadDocModal(inv) }]
                                : []),
                              { id: 'view', label: 'Lihat Invoice', icon: <Eye className="w-4 h-4" />, onClick: () => { setViewInvoice(inv); setDetailTab('invoice'); fetchInvoiceDetail(inv.id); } },
                              ...(['canceled', 'cancelled', 'cancelled_refund', 'refunded'].includes((inv.status || '').toLowerCase())
                                ? [{ id: 'view-refund', label: 'Lihat Invoice Refund', icon: <Receipt className="w-4 h-4" />, onClick: () => { setViewInvoice(inv); setDetailTab('invoice_refund'); fetchInvoiceDetail(inv.id); } }]
                                : []),
                              { id: 'pdf', label: 'Unduh PDF', icon: <FileText className="w-4 h-4" />, onClick: () => openPdf(inv.id) },
                              ...(canOrderAction && inv.order_id && !shouldHideInvoiceCancelAction(inv) && (isInvoiceTeamUser || !isOwnerRoleUser || canOwnerCancelInvoiceInUi(inv))
                                ? [{ id: 'delete', label: 'Batalkan Invoice', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteOrder(inv), danger: true, disabled: deletingOrderId === inv.order_id }]
                                : []),
                            ].filter(Boolean) as ActionsMenuItem[]}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
              )}
            />
          )}
        </div>
      </Card>

      {publishDraftModalInv && (
        <Modal open onClose={() => !publishingDraftOrderId && setPublishDraftModalInv(null)} zIndex={55}>
          <ModalBox className="max-w-md w-full">
            <ModalHeader
              title="Terbitkan invoice"
              subtitle={publishDraftModalInv.invoice_number || publishDraftModalInv.Order?.invoice_number || 'Draft — isi nama PIC'}
              onClose={() => !publishingDraftOrderId && setPublishDraftModalInv(null)}
            />
            <ModalBody className="space-y-4">
              <Input
                label="Nama PIC *"
                type="text"
                value={publishDraftPicName}
                onChange={(e) => setPublishDraftPicName(e.target.value)}
                placeholder="Nama penanggung jawab invoice"
              />
              <p className="text-xs text-slate-500">Nama PIC wajib sama dengan yang digunakan untuk invoice ini.</p>
            </ModalBody>
            <ModalFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={!!publishingDraftOrderId} onClick={() => setPublishDraftModalInv(null)}>
                Batal
              </Button>
              <Button type="button" variant="primary" disabled={!!publishingDraftOrderId} onClick={() => void submitPublishDraft()}>
                Terbitkan
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {/* Modal Upload Dokumen – Tabs: Hotel / Visa / Tiket / Siskopatuh */}
      {uploadDocInvoice && (
        <Modal open onClose={() => !uploadDocLoading && setUploadDocInvoice(null)} zIndex={55}>
          <ModalBox className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <ModalHeader
              title="Upload dokumen"
              subtitle={uploadDocInvoice?.invoice_number || ''}
              icon={<Upload className="w-5 h-5" />}
              onClose={() => !uploadDocLoading && setUploadDocInvoice(null)}
            />
            <ModalBody className="flex-1 overflow-y-auto">
            {uploadDocLoading ? (
              <div className="p-8 flex items-center justify-center">
                <ContentLoading minHeight={120} />
              </div>
            ) : (() => {
              const order = uploadDocInvoice.Order;
              const items = order?.OrderItems || [];
              const hotelItems = items.filter((i: any) => (i.type || i.product_type) === 'hotel');
              const visaItems = items.filter((i: any) => (i.type || i.product_type) === 'visa');
              const ticketItems = items.filter((i: any) => (i.type || i.product_type) === 'ticket');
              const siskopatuhItems = items.filter((i: any) => (i.type || i.product_type) === 'siskopatuh');
              const hasAny =
                hotelItems.length > 0 || visaItems.length > 0 || ticketItems.length > 0 || siskopatuhItems.length > 0;
              if (!hasAny) {
                return (
                  <div className="p-6">
                    <p className="text-slate-600 text-sm">
                      Order ini tidak memiliki item hotel, visa, tiket, atau siskopatuh. Tidak ada dokumen yang perlu diupload.
                    </p>
                  </div>
                );
              }
              interface HotelUploadGroup { key: string; name: string; firstItem: any }
              const hotelItemGroupKey = (item: any) =>
                String(item.product_ref_id || item.product_id || item.id || '');
              const hotelByProduct: HotelUploadGroup[] = hotelItems.reduce(
                (acc: HotelUploadGroup[], item: any) => {
                  const key = hotelItemGroupKey(item);
                  const name = item.Product?.name || (item as any).product_name || 'Hotel';
                  if (!acc.find((g: HotelUploadGroup) => g.key === key)) acc.push({ key, name, firstItem: item });
                  return acc;
                },
                [] as HotelUploadGroup[]
              );
              const tabs: { id: 'hotel' | 'visa' | 'ticket' | 'siskopatuh'; label: string; icon: React.ReactNode; count: number }[] = [
                ...(hotelByProduct.length > 0 ? [{ id: 'hotel' as const, label: 'Hotel', icon: <Package className="w-4 h-4" />, count: hotelByProduct.length }] : []),
                ...(visaItems.length > 0 ? [{ id: 'visa' as const, label: 'Visa', icon: <FileText className="w-4 h-4" />, count: visaItems.length }] : []),
                ...(ticketItems.length > 0 ? [{ id: 'ticket' as const, label: 'Tiket', icon: <Plane className="w-4 h-4" />, count: ticketItems.length }] : []),
                ...(siskopatuhItems.length > 0
                  ? [{ id: 'siskopatuh' as const, label: 'Siskopatuh', icon: <FileText className="w-4 h-4 text-violet-600" />, count: siskopatuhItems.length }]
                  : []),
              ];
              const activeTab = tabs.some((t) => t.id === uploadDocTab) ? uploadDocTab : (tabs[0]?.id ?? 'hotel');

              return (
                <>
                  {/* Tabs */}
                  <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 gap-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setUploadDocTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px rounded-t-lg ${
                          activeTab === tab.id
                            ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm'
                            : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                        {tab.count > 1 && <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{tab.count}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="p-6 overflow-y-auto flex-1 bg-white">
                    {activeTab === 'hotel' && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-600">Satu file per hotel. Upload file Excel/spreadsheet berisi info paket untuk hotel tersebut.</p>
                        {hotelByProduct.map((group) => {
                          const groupHotelItems = hotelItems.filter((hi: any) => hotelItemGroupKey(hi) === group.key);
                          const itemWithDoc = groupHotelItems.find(
                            (i: any) => i.jamaah_data_type && String(i.jamaah_data_value || '').trim()
                          );
                          const primaryItem = itemWithDoc || group.firstItem;
                          const hasUploaded = !!(primaryItem.jamaah_data_type && String(primaryItem.jamaah_data_value || '').trim());
                          return (
                            <div key={group.key} className="rounded-xl border border-slate-200 bg-amber-50/30 p-4 space-y-3">
                              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <Package className="w-4 h-4 text-amber-600" /> {group.name}
                              </h3>
                              {hasUploaded && (
                                <div className="rounded-lg bg-white/80 border border-amber-200/60 p-3">
                                  <p className="text-xs font-medium text-slate-600 mb-1.5">Dokumen terunggah</p>
                                  {primaryItem.jamaah_data_type === 'link' ? (
                                    <a href={primaryItem.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5">
                                      <LinkIcon className="w-4 h-4" /> Buka link
                                    </a>
                                  ) : uploadDocInvoice?.order_id ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      disabled={downloadingJamaahItemId === primaryItem.id}
                                      onClick={() =>
                                        downloadJamaahFile(
                                          uploadDocInvoice.order_id,
                                          primaryItem.id,
                                          primaryItem.jamaah_data_value
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5"
                                    >
                                      {downloadingJamaahItemId === primaryItem.id ? (
                                        'Mengunduh…'
                                      ) : (
                                        <>
                                          <Download className="w-4 h-4" /> Unduh file
                                        </>
                                      )}
                                    </Button>
                                  ) : (
                                    <span className="text-sm text-slate-500">File tersimpan</span>
                                  )}
                                </div>
                              )}
                              <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-slate-600">{hasUploaded ? 'Upload ulang' : 'File Excel (.xlsx, .xls)'}</span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      if (f && uploadDocInvoice?.order_id) {
                                        setUploadingJamaahItemId(primaryItem.id);
                                        try {
                                          await handleUploadJamaahData(uploadDocInvoice.order_id, primaryItem.id, f, '');
                                          const res = await invoicesApi.getById(uploadDocInvoice.id);
                                          if (res.data?.success && res.data?.data) setUploadDocInvoice(res.data.data);
                                        } catch (err: any) {
                                          showToast(err.response?.data?.message || 'Gagal upload', 'error');
                                        } finally {
                                          setUploadingJamaahItemId(null);
                                        }
                                      }
                                      e.target.value = '';
                                    }}
                                    disabled={!!uploadingJamaahItemId}
                                  />
                                  {uploadingJamaahItemId === primaryItem.id && <span className="text-xs text-slate-500">Mengunggah…</span>}
                                </div>
                              </label>
                              <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-slate-600">atau Link Google Drive</span>
                                <div className="flex gap-2 flex-wrap">
                                  <Input
                                    type="url"
                                    placeholder="https://drive.google.com/..."
                                    value={jamaahLinkInput[primaryItem.id] || ''}
                                    onChange={(e) =>
                                      setJamaahLinkInput((p) => ({ ...p, [primaryItem.id]: e.target.value }))
                                    }
                                    className="flex-1 min-w-[200px]"
                                    disabled={!!uploadingJamaahItemId}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      if (!uploadDocInvoice?.order_id || !(jamaahLinkInput[primaryItem.id] || '').trim()) return;
                                      setUploadingJamaahItemId(primaryItem.id);
                                      try {
                                        await handleUploadJamaahData(
                                          uploadDocInvoice.order_id,
                                          primaryItem.id,
                                          null,
                                          jamaahLinkInput[primaryItem.id] || ''
                                        );
                                        showToast('Link berhasil disimpan', 'success');
                                        setJamaahLinkInput((p) => ({ ...p, [primaryItem.id]: '' }));
                                        const res = await invoicesApi.getById(uploadDocInvoice.id);
                                        if (res.data?.success && res.data?.data) setUploadDocInvoice(res.data.data);
                                      } catch (err: any) {
                                        showToast(err.response?.data?.message || 'Gagal simpan link', 'error');
                                      } finally {
                                        setUploadingJamaahItemId(null);
                                      }
                                    }}
                                    disabled={!!uploadingJamaahItemId || !(jamaahLinkInput[primaryItem.id] || '').trim()}
                                  >
                                    {uploadingJamaahItemId === primaryItem.id ? 'Mengunggah…' : 'Simpan link'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {activeTab === 'visa' && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-600">Upload data paspor (ZIP) atau masukkan link Google Drive.</p>
                        {visaItems.map((item: any) => {
                          const hasUploaded = item.jamaah_data_type && item.jamaah_data_value;
                          return (
                            <div key={item.id} className="rounded-xl border border-slate-200 bg-sky-50/30 p-4 space-y-3">
                              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-sky-600" /> {item.Product?.name || item.product_name || 'Visa'}
                              </h3>
                              {hasUploaded && (
                                <div className="rounded-lg bg-white/80 border border-sky-200/60 p-3">
                                  <p className="text-xs font-medium text-slate-600 mb-1.5">Dokumen terunggah</p>
                                  {item.jamaah_data_type === 'link' ? (
                                    <a href={item.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5">
                                      <LinkIcon className="w-4 h-4" /> Buka link
                                    </a>
                                  ) : uploadDocInvoice?.order_id ? (
                                    <Button type="button" size="sm" variant="secondary" disabled={downloadingJamaahItemId === item.id} onClick={() => downloadJamaahFile(uploadDocInvoice.order_id, item.id, item.jamaah_data_value)} className="inline-flex items-center gap-1.5">
                                      {downloadingJamaahItemId === item.id ? 'Mengunduh…' : <><Download className="w-4 h-4" /> Unduh file</>}
                                    </Button>
                                  ) : (
                                    <span className="text-sm text-slate-500">File tersimpan</span>
                                  )}
                                </div>
                              )}
                              <div className="flex flex-col gap-3">
                                <label className="flex flex-col gap-1.5">
                                  <span className="text-xs font-medium text-slate-600">{hasUploaded ? 'Upload ulang' : 'File ZIP'}</span>
                                  <input type="file" accept=".zip" className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700" onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    if (f && uploadDocInvoice?.order_id) {
                                      setUploadingJamaahItemId(item.id);
                                      try {
                                        await handleUploadJamaahData(uploadDocInvoice.order_id, item.id, f, '');
                                        showToast('Data paspor berhasil diupload', 'success');
                                        const res = await invoicesApi.getById(uploadDocInvoice.id);
                                        if (res.data?.success && res.data?.data) setUploadDocInvoice(res.data.data);
                                      } catch (err: any) {
                                        showToast(err.response?.data?.message || 'Gagal upload', 'error');
                                      } finally {
                                        setUploadingJamaahItemId(null);
                                      }
                                    }
                                    e.target.value = '';
                                  }} disabled={!!uploadingJamaahItemId} />
                                </label>
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-xs font-medium text-slate-600">atau Link Google Drive</span>
                                  <div className="flex gap-2 flex-wrap">
                                    <Input type="url" placeholder="https://drive.google.com/..." value={jamaahLinkInput[item.id] || ''} onChange={(e) => setJamaahLinkInput((p) => ({ ...p, [item.id]: e.target.value }))} className="flex-1 min-w-[200px]" disabled={!!uploadingJamaahItemId} />
                                    <Button size="sm" variant="outline" onClick={async () => {
                                      if (!uploadDocInvoice?.order_id || !(jamaahLinkInput[item.id] || '').trim()) return;
                                      setUploadingJamaahItemId(item.id);
                                      try {
                                        await handleUploadJamaahData(uploadDocInvoice.order_id, item.id, null, jamaahLinkInput[item.id] || '');
                                        showToast('Link berhasil disimpan', 'success');
                                        setJamaahLinkInput((p) => ({ ...p, [item.id]: '' }));
                                        const res = await invoicesApi.getById(uploadDocInvoice.id);
                                        if (res.data?.success && res.data?.data) setUploadDocInvoice(res.data.data);
                                      } catch (err: any) {
                                        showToast(err.response?.data?.message || 'Gagal simpan link', 'error');
                                      } finally {
                                        setUploadingJamaahItemId(null);
                                      }
                                    }} disabled={!!uploadingJamaahItemId || !(jamaahLinkInput[item.id] || '').trim()}>
                                      {uploadingJamaahItemId === item.id ? 'Mengunggah…' : 'Simpan link'}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {activeTab === 'ticket' && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-600">Upload dokumen penerbangan (ZIP) atau masukkan link Google Drive.</p>
                        {ticketItems.map((item: any) => {
                          const hasUploaded = item.jamaah_data_type && item.jamaah_data_value;
                          const fileUrl = item.jamaah_data_type === 'link' ? item.jamaah_data_value : item.jamaah_data_value ? getFileUrl(item.jamaah_data_value) : null;
                          return (
                            <div key={item.id} className="rounded-xl border border-slate-200 bg-[#0D1A63]/5 p-4 space-y-3">
                              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <Plane className="w-4 h-4 text-[#0D1A63]" /> {item.Product?.name || item.product_name || 'Tiket'}
                              </h3>
                              {hasUploaded && (
                                <div className="rounded-lg bg-white/80 border border-emerald-200/60 p-3">
                                  <p className="text-xs font-medium text-slate-600 mb-1.5">Dokumen terunggah</p>
                                  {item.jamaah_data_type === 'link' ? (
                                    <a href={item.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5">
                                      <LinkIcon className="w-4 h-4" /> Buka link
                                    </a>
                                  ) : uploadDocInvoice?.order_id ? (
                                    <Button type="button" size="sm" variant="secondary" disabled={downloadingJamaahItemId === item.id} onClick={() => downloadJamaahFile(uploadDocInvoice.order_id, item.id, item.jamaah_data_value)} className="inline-flex items-center gap-1.5">
                                      {downloadingJamaahItemId === item.id ? 'Mengunduh…' : <><Download className="w-4 h-4" /> Unduh file</>}
                                    </Button>
                                  ) : (
                                    <span className="text-sm text-slate-500">File tersimpan</span>
                                  )}
                                </div>
                              )}
                              <div className="flex flex-col gap-3">
                                <label className="flex flex-col gap-1.5">
                                  <span className="text-xs font-medium text-slate-600">{hasUploaded ? 'Upload ulang' : 'File ZIP'}</span>
                                  <input type="file" accept=".zip" className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700" onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    if (f && uploadDocInvoice?.order_id) {
                                      setUploadingJamaahItemId(item.id);
                                      try {
                                        await handleUploadJamaahData(uploadDocInvoice.order_id, item.id, f, '');
                                        showToast('Dokumen tiket berhasil diupload', 'success');
                                        const res = await invoicesApi.getById(uploadDocInvoice.id);
                                        if (res.data?.success && res.data?.data) setUploadDocInvoice(res.data.data);
                                      } catch (err: any) {
                                        showToast(err.response?.data?.message || 'Gagal upload', 'error');
                                      } finally {
                                        setUploadingJamaahItemId(null);
                                      }
                                    }
                                    e.target.value = '';
                                  }} disabled={!!uploadingJamaahItemId} />
                                </label>
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-xs font-medium text-slate-600">atau Link Google Drive</span>
                                  <div className="flex gap-2 flex-wrap">
                                    <Input type="url" placeholder="https://drive.google.com/..." value={jamaahLinkInput[item.id] || ''} onChange={(e) => setJamaahLinkInput((p) => ({ ...p, [item.id]: e.target.value }))} className="flex-1 min-w-[200px]" disabled={!!uploadingJamaahItemId} />
                                    <Button size="sm" variant="outline" onClick={async () => {
                                      if (!uploadDocInvoice?.order_id || !(jamaahLinkInput[item.id] || '').trim()) return;
                                      setUploadingJamaahItemId(item.id);
                                      try {
                                        await handleUploadJamaahData(uploadDocInvoice.order_id, item.id, null, jamaahLinkInput[item.id] || '');
                                        showToast('Link berhasil disimpan', 'success');
                                        setJamaahLinkInput((p) => ({ ...p, [item.id]: '' }));
                                        const res = await invoicesApi.getById(uploadDocInvoice.id);
                                        if (res.data?.success && res.data?.data) setUploadDocInvoice(res.data.data);
                                      } catch (err: any) {
                                        showToast(err.response?.data?.message || 'Gagal simpan link', 'error');
                                      } finally {
                                        setUploadingJamaahItemId(null);
                                      }
                                    }} disabled={!!uploadingJamaahItemId || !(jamaahLinkInput[item.id] || '').trim()}>
                                      {uploadingJamaahItemId === item.id ? 'Mengunggah…' : 'Simpan link'}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {activeTab === 'siskopatuh' && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                          Upload dokumen siskopatuh (ZIP) atau masukkan link Google Drive — sama seperti visa/tiket.
                        </p>
                        {siskopatuhItems.map((item: any) => {
                          const hasUploaded = item.jamaah_data_type && item.jamaah_data_value;
                          return (
                            <div key={item.id} className="rounded-xl border border-slate-200 bg-violet-50/40 p-4 space-y-3">
                              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-violet-600" /> {item.Product?.name || item.product_name || 'Siskopatuh'}
                              </h3>
                              {hasUploaded && (
                                <div className="rounded-lg bg-white/80 border border-violet-200/60 p-3">
                                  <p className="text-xs font-medium text-slate-600 mb-1.5">Dokumen terunggah</p>
                                  {item.jamaah_data_type === 'link' ? (
                                    <a href={item.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5">
                                      <LinkIcon className="w-4 h-4" /> Buka link
                                    </a>
                                  ) : uploadDocInvoice?.order_id ? (
                                    <Button type="button" size="sm" variant="secondary" disabled={downloadingJamaahItemId === item.id} onClick={() => downloadJamaahFile(uploadDocInvoice.order_id, item.id, item.jamaah_data_value)} className="inline-flex items-center gap-1.5">
                                      {downloadingJamaahItemId === item.id ? 'Mengunduh…' : <><Download className="w-4 h-4" /> Unduh file</>}
                                    </Button>
                                  ) : (
                                    <span className="text-sm text-slate-500">File tersimpan</span>
                                  )}
                                </div>
                              )}
                              <div className="flex flex-col gap-3">
                                <label className="flex flex-col gap-1.5">
                                  <span className="text-xs font-medium text-slate-600">{hasUploaded ? 'Upload ulang' : 'File ZIP'}</span>
                                  <input type="file" accept=".zip" className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700" onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    if (f && uploadDocInvoice?.order_id) {
                                      setUploadingJamaahItemId(item.id);
                                      try {
                                        await handleUploadJamaahData(uploadDocInvoice.order_id, item.id, f, '');
                                        showToast('Dokumen siskopatuh berhasil diupload', 'success');
                                        const res = await invoicesApi.getById(uploadDocInvoice.id);
                                        if (res.data?.success && res.data?.data) setUploadDocInvoice(res.data.data);
                                      } catch (err: any) {
                                        showToast(err.response?.data?.message || 'Gagal upload', 'error');
                                      } finally {
                                        setUploadingJamaahItemId(null);
                                      }
                                    }
                                    e.target.value = '';
                                  }} disabled={!!uploadingJamaahItemId} />
                                </label>
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-xs font-medium text-slate-600">atau Link Google Drive</span>
                                  <div className="flex gap-2 flex-wrap">
                                    <Input type="url" placeholder="https://drive.google.com/..." value={jamaahLinkInput[item.id] || ''} onChange={(e) => setJamaahLinkInput((p) => ({ ...p, [item.id]: e.target.value }))} className="flex-1 min-w-[200px]" disabled={!!uploadingJamaahItemId} />
                                    <Button size="sm" variant="outline" onClick={async () => {
                                      if (!uploadDocInvoice?.order_id || !(jamaahLinkInput[item.id] || '').trim()) return;
                                      setUploadingJamaahItemId(item.id);
                                      try {
                                        await handleUploadJamaahData(uploadDocInvoice.order_id, item.id, null, jamaahLinkInput[item.id] || '');
                                        showToast('Link berhasil disimpan', 'success');
                                        setJamaahLinkInput((p) => ({ ...p, [item.id]: '' }));
                                        const res = await invoicesApi.getById(uploadDocInvoice.id);
                                        if (res.data?.success && res.data?.data) setUploadDocInvoice(res.data.data);
                                      } catch (err: any) {
                                        showToast(err.response?.data?.message || 'Gagal simpan link', 'error');
                                      } finally {
                                        setUploadingJamaahItemId(null);
                                      }
                                    }} disabled={!!uploadingJamaahItemId || !(jamaahLinkInput[item.id] || '').trim()}>
                                      {uploadingJamaahItemId === item.id ? 'Mengunggah…' : 'Simpan link'}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
            </ModalBody>
          </ModalBox>
        </Modal>
      )}

      {/* Modal Detail Invoice */}
      {viewInvoice && (
        <Modal open onClose={closeModal} zIndex={50}>
          <ModalBoxLg>
            <ModalHeader
              title="Detail Invoice"
              subtitle={formatInvoiceNumberDisplay(viewInvoice, INVOICE_STATUS_LABELS, getEffectiveInvoiceStatusLabel(viewInvoice))}
              icon={<Receipt className="w-5 h-5" />}
              onClose={closeModal}
            />
            <div className="px-6 pt-2 pb-2 flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => openPdf(viewInvoice.id)} className="rounded-lg">
                <Download className="w-4 h-4 mr-2" /> Unduh PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => openArchive(viewInvoice.id)} disabled={loadingArchiveId === viewInvoice.id} className="rounded-lg" title="Unduh ZIP berisi: Invoice PDF + semua bukti bayar (tagihan DP, pembayaran DP, lunas) + bukti refund">
                {loadingArchiveId === viewInvoice.id ? <span className="animate-pulse">Membuat ZIP...</span> : <><Archive className="w-4 h-4 mr-2" /> Unduh ZIP</>}
              </Button>
              {canUnblock(viewInvoice) && (
                <Button variant="secondary" size="sm" onClick={() => handleUnblock(viewInvoice)} className="rounded-lg">
                  <Unlock className="w-4 h-4 mr-2" /> Aktifkan Kembali
                </Button>
              )}
            </div>

            <ModalBody className="flex-1 overflow-hidden flex flex-col p-0">
            {/* Tabs - pill style */}
            <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-slate-200 bg-slate-50/60 shrink-0">
              <button
                onClick={() => setDetailTab('invoice')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl border border-b-0 transition-all -mb-px ${
                  detailTab === 'invoice'
                    ? 'bg-white border-slate-200 shadow-sm text-[#0D1A63] border-emerald-200'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> Invoice & Order
              </button>
              <button
                onClick={() => setDetailTab('payments')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl border border-b-0 transition-all -mb-px ${
                  detailTab === 'payments'
                    ? 'bg-white border-slate-200 shadow-sm text-[#0D1A63] border-emerald-200'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <CreditCard className="w-4 h-4" /> Bukti Bayar
                {paymentsTabCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-[#0D1A63]/10 text-emerald-700 rounded-full">{paymentsTabCount}</span>
                )}
              </button>
              <button
                onClick={() => setDetailTab('progress')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl border border-b-0 transition-all -mb-px ${
                  detailTab === 'progress'
                    ? 'bg-white border-slate-200 shadow-sm text-[#0D1A63] border-emerald-200'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <ClipboardList className="w-4 h-4" /> Status Pekerjaan
              </button>
              {['canceled', 'cancelled', 'cancelled_refund', 'refunded'].includes((viewInvoice?.status || '').toLowerCase()) && (
                <button
                  onClick={() => setDetailTab('invoice_refund')}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl border border-b-0 transition-all -mb-px ${
                    detailTab === 'invoice_refund'
                      ? 'bg-white border-red-200 shadow-sm text-red-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Receipt className="w-4 h-4" /> Invoice Refund
                </button>
              )}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {detailTab === 'invoice' && (
                <div className="space-y-6">
                  {(() => {
                    const zeroOut = isCancelledNoPayment(viewInvoice);
                    const totalInvIdr = zeroOut ? 0 : (viewInvoice.total_amount_idr != null ? Number(viewInvoice.total_amount_idr) : Number(viewInvoice.total_amount) || 0);
                    const totalInvSar = zeroOut ? 0 : (viewInvoice.total_amount_sar != null ? Number(viewInvoice.total_amount_sar) : totalInvIdr / sarToIdr);
                    const totalInv = totalInvIdr;
                    const paidFromProofs = (viewInvoice?.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                    const paidFromInvoice = Number(viewInvoice.paid_amount) || 0;
                    const displayPaid = paidFromInvoice > 0 ? paidFromInvoice : paidFromProofs;
                    const displayRemaining = zeroOut ? 0 : Math.max(0, totalInv - displayPaid);
                    const kesBreakdown = (viewInvoice?.PaymentProofs || []).filter((pr: any) => pr.payment_location === 'saudi' && pr.amount_original != null && pr.payment_currency && pr.payment_currency !== 'IDR');
                    const kesSar = kesBreakdown.filter((pr: any) => pr.payment_currency === 'SAR').reduce((s: number, pr: any) => s + Number(pr.amount_original || 0), 0);
                    const kesUsd = kesBreakdown.filter((pr: any) => pr.payment_currency === 'USD').reduce((s: number, pr: any) => s + Number(pr.amount_original || 0), 0);
                    const totalPct = totalInv > 0 ? ((displayPaid / totalInv) * 100) : 0;
                    return (
                      <>
                        {/* Baris aksi & ringkasan utama */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/80 shadow-sm">
                          <div className="flex flex-wrap items-center gap-3">
                            {(() => {
                              const refundsDetail = (viewInvoice.Refunds || []) as { status: string }[];
                              const latestRefundDetail = refundsDetail[0];
                              const isRefundCompleted = refundsDetail.some((r: any) => r.status === 'refunded');
                              const pct = viewInvoice.Order?.dp_percentage_paid != null ? Number(viewInvoice.Order.dp_percentage_paid) : null;
                              const updatedAt = viewInvoice.Order?.order_updated_at || viewInvoice.order_updated_at || viewInvoice.orderUpdatedAt || null;
                              const label = getEffectiveInvoiceStatusLabel(viewInvoice);
                              const badgeVariant = getEffectiveInvoiceStatusBadgeVariant(viewInvoice);
                              const REFUND_STATUS_LABELS_DETAIL: Record<string, string> = { requested: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', refunded: 'Sudah direfund' };
                              const refundProcessLabelDetail = latestRefundDetail ? (REFUND_STATUS_LABELS_DETAIL[latestRefundDetail.status] || latestRefundDetail.status) : null;
                              return (
                                <div className="flex flex-col">
                                  <Badge variant={badgeVariant} className="text-sm px-3 py-1 w-fit">{label}</Badge>
                                  {refundProcessLabelDetail != null && !isRefundCompleted && <span className="text-sm text-slate-600 mt-1">Proses refund: <strong>{refundProcessLabelDetail}</strong></span>}
                                  {pct != null && <span className="text-sm text-slate-600 mt-1">Dibayar <strong>{pct}%</strong> dari total tagihan</span>}
                                  {updatedAt && <span className="text-xs text-slate-500 mt-0.5">Update order: {formatDate(updatedAt)}</span>}
                                </div>
                              );
                            })()}
                            {viewInvoice.is_blocked && <Badge variant="error">Block</Badge>}
                            <span className="text-slate-500 text-sm">{formatDate(viewInvoice.issued_at || viewInvoice.created_at)} · Jatuh tempo DP {formatDate(viewInvoice.due_date_dp)}</span>
                          </div>
                          {canPayInvoice(viewInvoice) && (
                            <Button onClick={openPaymentModal} variant="primary" size="sm" className="shadow-md">
                              <Wallet className="w-4 h-4 mr-2" /> Bayar DP / Bayar
                            </Button>
                          )}
                        </div>

                        {/* Grid: Data Order | Data Invoice | Saldo + Kurs */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                          {/* Data Order */}
                          <div className="lg:col-span-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                              <span className="w-1 h-5 rounded-full bg-primary-500" /> Data Order
                            </h4>
                            <dl className="space-y-4">
                              <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Owner</dt><dd className="mt-1 font-semibold text-slate-900">{viewInvoice.User?.name || viewInvoice.User?.company_name || viewInvoice.owner_name_manual || viewInvoice.Order?.owner_name_manual || '-'}</dd></div>
                              <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tipe Owner</dt><dd className="mt-1"><span className={`inline-flex items-center px-2 py-0.5 rounded font-medium text-sm ${viewInvoice.owner_is_mou ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{viewInvoice.owner_is_mou ? 'Owner MOU' : 'Non-MOU'}</span></dd></div>
                              <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nama PIC</dt><dd className="mt-1 font-semibold text-slate-900">{viewInvoice.pic_name || viewInvoice.Order?.pic_name || '–'}</dd></div>
                              <div className="pt-2 border-t border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Lokasi</p>
                                <div className="space-y-2">
                                  <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kota</dt><dd className="mt-0.5 font-semibold text-slate-900">{viewInvoice.Branch?.name || viewInvoice.Branch?.code}</dd></div>
                                  <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Wilayah</dt><dd className="mt-0.5 font-semibold text-slate-900">{viewInvoice.Branch?.Provinsi?.Wilayah?.name || '–'}</dd></div>
                                  <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Provinsi</dt><dd className="mt-0.5 font-semibold text-slate-900">{viewInvoice.Branch?.Provinsi?.name || viewInvoice.Branch?.Provinsi?.nama || '–'}</dd></div>
                                  <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kode Cabang</dt><dd className="mt-0.5 font-semibold text-slate-900">{viewInvoice.Branch?.code || '–'}</dd></div>
                                </div>
                              </div>
                              <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Mata Uang</dt><dd className="mt-1 font-semibold text-slate-900">{viewInvoice.Order?.currency || 'IDR'}</dd></div>
                            </dl>
                          </div>

                          {/* Data Invoice — tagihan & angka */}
                          <div className="lg:col-span-5 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                              <span className="w-1 h-5 rounded-full bg-primary-500" /> Data Invoice
                            </h4>
                            <div className="space-y-4">
                              <div className="pb-4 border-b border-slate-100">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
                                <p className="text-xl font-bold text-slate-900 mt-1"><NominalDisplay amount={totalInv} currency="IDR" /></p>
                                <p className="text-sm text-slate-500 mt-0.5"><NominalDisplay amount={totalInvSar} currency="SAR" /> · <NominalDisplay amount={totalInv / usdToIdr} currency="USD" /></p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-xs text-slate-500">DP ({viewInvoice.dp_percentage ?? 0}%)</p><p className="font-semibold text-slate-900 mt-0.5"><NominalDisplay amount={Number(viewInvoice.dp_amount) || 0} currency="IDR" /></p></div>
                                <div><p className="text-xs text-slate-500">Dibayar</p><p className="font-semibold text-[#0D1A63] mt-0.5"><NominalDisplay amount={displayPaid} currency="IDR" /></p>{(kesSar > 0 || kesUsd > 0) && <p className="text-xs text-[#0D1A63] mt-0.5">KES: <NominalDisplay amount={kesSar} currency="SAR" />{kesUsd > 0 ? <> · <NominalDisplay amount={kesUsd} currency="USD" /></> : ''}</p>}</div>
                                <div><p className="text-xs text-slate-500">Sisa</p><p className="font-semibold text-red-600 mt-0.5"><NominalDisplay amount={displayRemaining} currency="IDR" /></p></div>
                                <div><p className="text-xs text-slate-500">Terbayar</p><p className="font-semibold text-slate-900 mt-0.5">{(Number.isFinite(totalPct) ? totalPct.toFixed(1) : '0')}%</p></div>
                              </div>
                              <div className="flex flex-wrap gap-4 pt-2 text-sm text-slate-600">
                                <span>Tgl invoice: <strong className="text-slate-800">{formatDate(viewInvoice.issued_at || viewInvoice.created_at)}</strong></span>
                                <span>Jatuh tempo DP: <strong className="text-slate-800">{formatDate(viewInvoice.due_date_dp)}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Saldo (owner) + Kurs */}
                          <div className="lg:col-span-3 space-y-4">
                            {(user?.role === 'owner_mou' || user?.role === 'owner_non_mou') && viewInvoice?.owner_id === user?.id && (
                              <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 shadow-sm">
                                <h4 className="text-sm font-semibold text-emerald-800 flex items-center gap-2 mb-3">
                                  <Wallet className="w-4 h-4" /> Saldo Akun Anda
                                </h4>
                                {ownerBalanceLoading ? (
                                  <p className="text-sm text-slate-500">{CONTENT_LOADING_MESSAGE}</p>
                                ) : (
                                  <>
                                    <p className="text-2xl font-bold text-emerald-700"><NominalDisplay amount={ownerBalance ?? 0} currency="IDR" /></p>
                                    <p className="text-xs text-slate-600 mt-1">Untuk order baru atau alokasi ke tagihan.</p>
                                    {parseFloat(viewInvoice.remaining_amount || 0) > 0 && (ownerBalance ?? 0) > 0 && (
                                      <div className="mt-4 pt-4 border-t border-emerald-200 space-y-2">
                                        <div className="flex gap-2 items-end">
                                          <Input label="Alokasikan ke invoice ini" type="number" min={1} max={Math.min(ownerBalance ?? 0, parseFloat(viewInvoice.remaining_amount || 0))} value={allocateAmount} onChange={(e) => setAllocateAmount(e.target.value)} placeholder="Jumlah (IDR)" className="flex-1 min-w-0" />
                                          <Button size="sm" variant="primary" disabled={allocating || !allocateAmount || parseFloat(allocateAmount) <= 0} onClick={async () => {
                                            const remaining = parseFloat(viewInvoice.remaining_amount || 0) || 0;
                                            const balance = ownerBalance ?? 0;
                                            let amt = parseFloat(allocateAmount);
                                            if (!Number.isFinite(amt) || amt <= 0) return;
                                            amt = Math.min(amt, balance, remaining);
                                            if (amt <= 0) {
                                              showToast('Jumlah tidak valid atau sisa tagihan/saldo tidak cukup', 'error');
                                              return;
                                            }
                                            setAllocating(true);
                                            try {
                                              const res = await invoicesApi.allocateBalance(viewInvoice.id, { amount: amt });
                                              showToast(`Saldo Rp ${amt.toLocaleString('id-ID')} berhasil dialokasikan`, 'success');
                                              setAllocateAmount('');
                                              const updated = (res.data as any)?.data;
                                              if (updated && updated.id === viewInvoice.id) {
                                                setViewInvoice((prev: any) => {
                                                  if (!prev || prev.id !== updated.id) return prev;
                                                  return {
                                                    ...prev,
                                                    paid_amount: updated.paid_amount,
                                                    remaining_amount: updated.remaining_amount,
                                                    status: updated.status,
                                                    BalanceAllocations: updated.BalanceAllocations ?? prev.BalanceAllocations,
                                                    Order: prev.Order ? { ...prev.Order, ...updated.Order } : updated.Order
                                                  };
                                                });
                                                setOwnerBalance((b) => Math.max(0, (b ?? 0) - amt));
                                              }
                                              fetchInvoiceDetail(viewInvoice.id);
                                              fetchOwnerBalance();
                                              fetchInvoices();
                                            } catch (e: any) {
                                              showToast(e.response?.data?.message || 'Gagal alokasi', 'error');
                                            } finally { setAllocating(false); }
                                          }}>{allocating ? '...' : 'Alokasikan'}</Button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            {canUseInvoiceOwnerBalance && viewInvoice?.owner_id && !isDraftRow(viewInvoice) && (
                              <div className="p-5 rounded-2xl bg-indigo-50/90 border border-indigo-200 shadow-sm">
                                <h4 className="text-sm font-semibold text-[#0D1A63] flex items-center gap-2 mb-3">
                                  <Wallet className="w-4 h-4" /> Saldo akun owner
                                </h4>
                                {invoiceOwnerBalanceLoading || (invoiceOwnerBalance === null && !invoiceOwnerBalanceError) ? (
                                  <p className="text-sm text-slate-500">{CONTENT_LOADING_MESSAGE}</p>
                                ) : invoiceOwnerBalanceError || invoiceOwnerBalance === null ? (
                                  <p className="text-sm text-slate-600">Saldo tidak dapat dimuat (owner tidak terdaftar atau di luar wilayah Anda).</p>
                                ) : (
                                  <>
                                    <p className="text-2xl font-bold text-[#0D1A63]"><NominalDisplay amount={invoiceOwnerBalance} currency="IDR" /></p>
                                    <p className="text-xs text-slate-600 mt-1">Pembayaran memakai saldo milik pemilik invoice ini (bukan akun Anda).</p>
                                    {parseFloat(viewInvoice.remaining_amount || 0) > 0 && invoiceOwnerBalance > 0 && (
                                      <div className="mt-4 pt-4 border-t border-indigo-200 space-y-2">
                                        <div className="flex gap-2 items-end">
                                          <Input
                                            label="Alokasikan saldo owner ke invoice"
                                            type="number"
                                            min={1}
                                            max={Math.min(invoiceOwnerBalance, parseFloat(viewInvoice.remaining_amount || 0))}
                                            value={allocateAmount}
                                            onChange={(e) => setAllocateAmount(e.target.value)}
                                            placeholder="Jumlah (IDR)"
                                            className="flex-1 min-w-0"
                                          />
                                          <Button
                                            size="sm"
                                            variant="primary"
                                            disabled={allocating || !allocateAmount || parseFloat(allocateAmount) <= 0}
                                            onClick={async () => {
                                              const remaining = parseFloat(viewInvoice.remaining_amount || 0) || 0;
                                              const balance = invoiceOwnerBalance;
                                              let amt = parseFloat(allocateAmount);
                                              if (!Number.isFinite(amt) || amt <= 0) return;
                                              amt = Math.min(amt, balance, remaining);
                                              if (amt <= 0) {
                                                showToast('Jumlah tidak valid atau sisa tagihan/saldo tidak cukup', 'error');
                                                return;
                                              }
                                              setAllocating(true);
                                              try {
                                                const res = await invoicesApi.allocateBalance(viewInvoice.id, { amount: amt });
                                                showToast(`Saldo Rp ${amt.toLocaleString('id-ID')} berhasil dialokasikan`, 'success');
                                                setAllocateAmount('');
                                                const updated = (res.data as any)?.data;
                                                if (updated && updated.id === viewInvoice.id) {
                                                  setViewInvoice((prev: any) => {
                                                    if (!prev || prev.id !== updated.id) return prev;
                                                    return {
                                                      ...prev,
                                                      paid_amount: updated.paid_amount,
                                                      remaining_amount: updated.remaining_amount,
                                                      status: updated.status,
                                                      BalanceAllocations: updated.BalanceAllocations ?? prev.BalanceAllocations,
                                                      Order: prev.Order ? { ...prev.Order, ...updated.Order } : updated.Order
                                                    };
                                                  });
                                                  setInvoiceOwnerBalance((b) => (b != null ? Math.max(0, b - amt) : null));
                                                }
                                                fetchInvoiceDetail(viewInvoice.id);
                                                if (viewInvoice.owner_id) {
                                                  ownersApi.getBalanceForUser(viewInvoice.owner_id).then((r) => {
                                                    if (r.data?.success && r.data?.data) setInvoiceOwnerBalance(r.data.data.balance);
                                                  }).catch(() => {});
                                                }
                                                fetchInvoices();
                                              } catch (e: any) {
                                                showToast(e.response?.data?.message || 'Gagal alokasi', 'error');
                                              } finally {
                                                setAllocating(false);
                                              }
                                            }}
                                          >
                                            {allocating ? '...' : 'Alokasikan'}
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kurs pembayaran</p>
                              <p className="text-sm text-slate-700">1 SAR = <NominalDisplay amount={sarToIdr} currency="IDR" /></p>
                              <p className="text-sm text-slate-700">1 USD = <NominalDisplay amount={usdToIdr} currency="IDR" /></p>
                              {(viewInvoice.Order?.currency === 'SAR' || viewInvoice.Order?.currency === 'USD') && (
                                <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-slate-200">Total = <NominalDisplay amount={totalInv} currency="IDR" /> IDR</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Rincian item order sesuai tipe produk (workflow masing-masing). Satu product hotel + banyak tipe kamar + tanggal sama = satu baris, detail di Deskripsi. */}
                        {(() => {
                          const rawItems = viewInvoice?.Order?.OrderItems || [];
                          if (rawItems.length === 0) return null;
                          const ROOM_CAP: Record<string, number> = { single: 1, double: 2, triple: 3, quad: 4, quint: 5 };
                          const ROOM_LABELS: Record<string, string> = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };
                          /** Gabung item hotel yang sama product + check_in + check_out jadi satu baris; isi Deskripsi dengan breakdown tipe kamar. */
                          const orderItems: any[] = (() => {
                            const hotelKey = (it: any) => {
                              const meta = it.meta && typeof it.meta === 'object' ? it.meta : {};
                              const pid = it.product_ref_id || it.product_id || '';
                              const ci = (meta.check_in || '').toString().slice(0, 10);
                              const co = (meta.check_out || '').toString().slice(0, 10);
                              return `${pid}|${ci}|${co}`;
                            };
                            const groups = new Map<string, any[]>();
                            rawItems.forEach((it: any) => {
                              if ((it.type || '').toLowerCase() !== 'hotel') return;
                              const key = hotelKey(it);
                              if (!groups.has(key)) groups.set(key, []);
                              groups.get(key)!.push(it);
                            });
                            const seenHotelKeys = new Set<string>();
                            const result: any[] = [];
                            rawItems.forEach((it: any) => {
                              if ((it.type || '').toLowerCase() !== 'hotel') {
                                result.push(it);
                                return;
                              }
                              const key = hotelKey(it);
                              if (seenHotelKeys.has(key)) return;
                              seenHotelKeys.add(key);
                              const items = groups.get(key) || [];
                              if (items.length === 0) return;
                              const first = items[0];
                              if (items.length === 1) {
                                result.push(first);
                                return;
                              }
                              const meta0 = first.meta && typeof first.meta === 'object' ? first.meta : {};
                              const ci = meta0.check_in ? formatDate(meta0.check_in) : '';
                              const co = meta0.check_out ? formatDate(meta0.check_out) : '';
                              const nights = meta0.nights != null ? Number(meta0.nights) : 0;
                              const roomParts = items.map((it2: any) => {
                                const m = it2.meta && typeof it2.meta === 'object' ? it2.meta : {};
                                const rt = (m.room_type || 'quad').toString().toLowerCase();
                                const q = it2.quantity != null ? Number(it2.quantity) : 1;
                                return `${ROOM_LABELS[rt] || rt} × ${q}`;
                              });
                              const descLine = `Check-in: ${ci}, Check-out: ${co}.${nights ? ` ${nights} malam.` : ''} ${roomParts.join(', ')}.`;
                              const totalSub = items.reduce((s: number, it2: any) => s + (Number(it2.subtotal) || 0), 0);
                              const totalQty = items.reduce((s: number, it2: any) => s + (it2.quantity != null ? Number(it2.quantity) : 1), 0);
                              // Hitung breakdown subtotal kamar vs makan untuk baris gabungan (agar kolom harga makan & subtotal gabungan konsisten).
                              // Jika meta.meal_unit_price tidak ada, estimasi dari (subtotal - roomPart) per item.
                              let mergedRoomSub = 0;
                              let mergedMealSub = 0;
                              let mergedOrangNights = 0; // total (orang × malam) untuk menghitung harga satuan makan rata-rata
                              items.forEach((it2: any) => {
                                const m = it2.meta && typeof it2.meta === 'object' ? it2.meta : {};
                                const q = it2.quantity != null ? Number(it2.quantity) : 1;
                                const rt = (m.room_type || 'quad').toString().toLowerCase();
                                const cap = ROOM_CAP[rt] ?? 1;
                                const totalOrang = q * cap;
                                const cur = (it2.unit_price_currency || 'IDR').toUpperCase();
                                const toIdr = (v: number) => cur === 'SAR' ? v * sarToIdr : cur === 'USD' ? v * usdToIdr : v;
                                const roomUnitRaw = m.room_unit_price != null ? Number(m.room_unit_price) : (Number(it2.unit_price) || 0);
                                const mealUnitRaw = m.meal_unit_price != null ? Number(m.meal_unit_price) : NaN;
                                const roomUnitIdr = Number.isFinite(roomUnitRaw) ? toIdr(roomUnitRaw) : 0;
                                let mealUnitIdr = Number.isFinite(mealUnitRaw) ? toIdr(mealUnitRaw) : 0;
                                const withMeal = !!(m.meal || m.with_meal);
                                const roomPart = nights > 0 ? roomUnitIdr * q * nights : 0;
                                let mealPart = (withMeal && nights > 0 && mealUnitIdr > 0) ? mealUnitIdr * totalOrang * nights : 0;
                                const itemSubtotal = Number(it2.subtotal) || 0;
                                if (withMeal && nights > 0 && mealUnitIdr <= 0 && roomPart > 0 && itemSubtotal > roomPart && (totalOrang * nights) > 0) {
                                  mealPart = itemSubtotal - roomPart;
                                  mealUnitIdr = mealPart / (totalOrang * nights);
                                }
                                mergedRoomSub += roomPart > 0 ? roomPart : Math.max(0, itemSubtotal - mealPart);
                                mergedMealSub += mealPart > 0 ? mealPart : 0;
                                if (withMeal && nights > 0 && (totalOrang * nights) > 0) mergedOrangNights += (totalOrang * nights);
                              });
                              const mergedMealUnitIdr = mergedOrangNights > 0 ? (mergedMealSub / mergedOrangNights) : 0;
                              result.push({
                                ...first,
                                id: first.id + '_merged',
                                _merged: true,
                                _mergedDesc: descLine,
                                _mergedSubtotal: totalSub,
                                _mergedQty: totalQty,
                                _mergedNights: nights,
                                _mergedRoomSubtotal: mergedRoomSub,
                                _mergedMealSubtotal: mergedMealSub,
                                _mergedMealUnitIdr: mergedMealUnitIdr,
                                _mergedOrangNights: mergedOrangNights,
                                quantity: totalQty,
                                subtotal: totalSub
                              });
                            });
                            result.sort((a, b) => {
                              const tA = (a.type || a.product_type) as string;
                              const tB = (b.type || b.product_type) as string;
                              const locA = tA === 'hotel' ? getHotelLocationFromItem(a) : null;
                              const locB = tB === 'hotel' ? getHotelLocationFromItem(b) : null;
                              return getOrderItemSortIndex(tA, locA) - getOrderItemSortIndex(tB, locB);
                            });
                            return result;
                          })();
                          const getItemDesc = (item: any) => {
                            const t = (item.type || item.product_type || '').toLowerCase();
                            const meta = item.meta || {};
                            if (t === 'hotel') {
                              const ci = meta.check_in ? formatDate(meta.check_in) : '';
                              const co = meta.check_out ? formatDate(meta.check_out) : '';
                              const nights = meta.nights != null ? Number(meta.nights) : 0;
                              const qty = item.quantity != null ? Number(item.quantity) : 1;
                              const meal = meta.meal || meta.with_meal ? 'Ya' : 'Tidak';
                              const roomType = meta.room_type ? String(meta.room_type) : '';
                              const cap = ROOM_CAP[roomType.toLowerCase()] ?? 1;
                              const totalOrang = qty * cap;
                              const line1 = [ci && co ? `CI ${ci} – CO ${co}` : null, nights ? `${nights} malam` : null, `Makan: ${meal}`, roomType ? `Tipe kamar: ${roomType}` : null].filter(Boolean).join(' · ');
                              const line2 = nights > 0 ? `${qty} kamar × ${nights} malam | Paket makan: ${meal} | Tipe kamar: ${roomType || '–'}` : '';
                              const line3 = (meta.meal || meta.with_meal) && nights > 0 && totalOrang > 0 ? `Perhitungan: ${totalOrang} orang × ${nights} malam = ${totalOrang * nights} (paket makan: Ya)` : '';
                              return [line1, line2, line3].filter(Boolean).join('\n');
                            }
                            if (t === 'visa') {
                              return meta.travel_date ? `Keberangkatan: ${formatDate(meta.travel_date)}` : '';
                            }
                            if (t === 'ticket') {
                              const bandara = meta.bandara ? `Bandara ${meta.bandara}` : '';
                              const trip = meta.trip_type ? BUS_TRIP_LABELS[meta.trip_type] || meta.trip_type : '';
                              const dep = meta.departure_date ? formatDate(meta.departure_date) : '';
                              const ret = meta.return_date ? formatDate(meta.return_date) : '';
                              return [bandara, trip, dep && `Berangkat ${dep}`, ret && `Pulang ${ret}`].filter(Boolean).join(' · ');
                            }
                            if (t === 'bus') {
                              const trip = meta.trip_type ? BUS_TRIP_LABELS[meta.trip_type] || meta.trip_type : '';
                              const tgl = meta.travel_date ? formatDate(meta.travel_date) : '';
                              const route = meta.route_type ? String(meta.route_type) : '';
                              return [trip, tgl && `Tgl ${tgl}`, route && `Rute ${route}`].filter(Boolean).join(' · ');
                            }
                            if (t === 'siskopatuh') {
                              return meta.service_date ? `Tanggal layanan: ${formatDate(meta.service_date)}` : '';
                            }
                            return '';
                          };
                          return (
                            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                              <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <span className="w-1 h-5 rounded-full bg-primary-500" /> Rincian Item Order
                              </h4>
                              <p className="text-xs text-slate-500 mb-3">Deskripsi per item sesuai data dan tipe produk (sama seperti di PDF invoice).</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm table-fixed">
                                  <colgroup>
                                    <col className="w-10" />
                                    <col className="w-12" />
                                    <col className="w-[16%]" />
                                    <col className="w-[24%]" />
                                    <col className="w-10" />
                                    <col className="w-[14%]" />
                                    <col className="w-[14%]" />
                                    <col className="w-[16%]" />
                                  </colgroup>
                                  <thead>
                                    <tr className="border-b border-slate-200">
                                      <th className="text-left py-2 px-2 font-medium text-slate-600">No</th>
                                      <th className="text-left py-2 px-2 font-medium text-slate-600">Tipe</th>
                                      <th className="text-left py-2 px-2 font-medium text-slate-600">Produk</th>
                                      <th className="text-left py-2 px-2 font-medium text-slate-600">Deskripsi / Workflow</th>
                                      <th className="text-right py-2 px-2 font-medium text-slate-600">Qty</th>
                                      <th className="text-right py-2 px-2 font-medium text-slate-600">Harga Satuan Kamar</th>
                                      <th className="text-right py-2 px-2 font-medium text-slate-600">Harga Satuan Makan</th>
                                      <th className="text-right py-2 px-2 font-medium text-slate-600">Subtotal (gabungan)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {orderItems.map((item: any, idx: number) => {
                                      const name = item.Product?.name || item.product_name || `${item.type || 'Item'} ${idx + 1}`;
                                      const typeKey = (item.type || item.product_type) as string;
                                      const typeLabel = { hotel: 'Hotel', visa: 'Visa', ticket: 'Tiket', bus: 'Bus', siskopatuh: 'Siskopatuh', handling: 'Handling', package: 'Paket' }[typeKey] || typeKey || '-';
                                      const desc = item._mergedDesc != null ? item._mergedDesc : getItemDesc(item);
                                      const isMerged = !!item._merged;
                                      const qty = isMerged ? (item._mergedQty ?? item.quantity ?? 1) : (item.quantity != null ? item.quantity : 1);
                                      const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
                                      const nights = isMerged ? (item._mergedNights ?? meta.nights ?? 0) : (meta.nights != null ? Number(meta.nights) : 0);
                                      const cur = (item.unit_price_currency || 'IDR').toUpperCase();
                                      const toIdr = (v: number) => cur === 'SAR' ? v * sarToIdr : cur === 'USD' ? v * usdToIdr : v;
                                      const ROOM_CAP_TBL = { single: 1, double: 2, triple: 3, quad: 4, quint: 5 } as Record<string, number>;
                                      const capacity = ROOM_CAP_TBL[String(meta.room_type || '').toLowerCase()] ?? 1;
                                      const totalOrang = qty * capacity;
                                      const roomUnitRaw = meta.room_unit_price != null ? Number(meta.room_unit_price) : (typeKey === 'hotel' ? Number(item.unit_price) : NaN);
                                      const mealUnitRaw = meta.meal_unit_price != null ? Number(meta.meal_unit_price) : NaN;
                                      let roomUnitIdr = Number.isFinite(roomUnitRaw) ? toIdr(roomUnitRaw) : 0;
                                      let mealUnitIdr = Number.isFinite(mealUnitRaw) ? toIdr(mealUnitRaw) : 0;
                                      const withMeal = !!(meta.meal || meta.with_meal);
                                      const roomPart = typeKey === 'hotel' && nights > 0 ? roomUnitIdr * qty * nights : 0;
                                      let mealPart = typeKey === 'hotel' && nights > 0 && mealUnitIdr > 0 ? mealUnitIdr * totalOrang * nights : 0;
                                      const rawSubtotal = isMerged ? (item._mergedSubtotal ?? Number(item.subtotal) ?? 0) : (item.subtotal != null ? Number(item.subtotal) : (Number(item.unit_price) || 0) * (typeKey === 'hotel' && nights > 0 ? qty * nights : qty));
                                      // Untuk baris gabungan: gunakan hasil breakdown dari proses merge (jika ada)
                                      const mergedMealUnitIdr = isMerged && item._mergedMealUnitIdr != null ? Number(item._mergedMealUnitIdr) : 0;
                                      const mergedMealSub = isMerged && item._mergedMealSubtotal != null ? Number(item._mergedMealSubtotal) : 0;
                                      const mergedRoomSub = isMerged && item._mergedRoomSubtotal != null ? Number(item._mergedRoomSubtotal) : 0;
                                      if (isMerged && typeKey === 'hotel') {
                                        if (mergedMealUnitIdr > 0) mealUnitIdr = mergedMealUnitIdr;
                                        mealPart = mergedMealSub > 0 ? mergedMealSub : 0;
                                        // roomPart untuk merged tidak akurat jika beda tipe kamar; pakai hasil merge.
                                        // tetap dipakai untuk tampilan perhitungan subtotal.
                                      }
                                      if (!isMerged && typeKey === 'hotel' && withMeal && nights > 0 && totalOrang > 0 && mealUnitIdr <= 0 && roomPart > 0 && rawSubtotal > roomPart) {
                                        mealPart = rawSubtotal - roomPart;
                                        mealUnitIdr = mealPart / (totalOrang * nights);
                                      }
                                      const hasHotelBreakdown = !isMerged && typeKey === 'hotel' && nights > 0 && (roomUnitIdr > 0 || mealUnitIdr > 0);
                                      const hasMergedBreakdown = isMerged && typeKey === 'hotel' && ((mergedRoomSub > 0) || (mergedMealSub > 0));
                                      const subtotalFromBreakdown = hasHotelBreakdown ? roomPart + mealPart : (hasMergedBreakdown ? (mergedRoomSub + mergedMealSub) : 0);
                                      const subtotal = (subtotalFromBreakdown > 0 ? subtotalFromBreakdown : rawSubtotal);
                                      const unitPrice = item.unit_price != null ? Number(item.unit_price) : (qty > 0 ? (item.subtotal != null ? Number(item.subtotal) : 0) / (typeKey === 'hotel' && nights > 0 ? qty * nights : qty) : 0);
                                      const unitPriceIdr = cur === 'SAR' ? unitPrice * sarToIdr : cur === 'USD' ? unitPrice * usdToIdr : unitPrice;
                                      const sarUsdLine = (amountIdr: number) => (
                                        <div className="text-xs text-slate-500 mt-0.5">≈ <NominalDisplay amount={amountIdr / sarToIdr} currency="SAR" showCurrency={false} /> SAR · ≈ <NominalDisplay amount={amountIdr / usdToIdr} currency="USD" showCurrency={false} /> USD</div>
                                      );
                                      return (
                                        <tr key={item.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50 align-top">
                                          <td className="py-2 px-2 text-slate-600 align-top">{idx + 1}</td>
                                          <td className="py-2 px-2 font-medium text-slate-700 align-top">{typeLabel}</td>
                                          <td className="py-2 px-2 text-slate-900 align-top">{name}</td>
                                          <td className="py-2 px-2 text-slate-600 text-xs align-top leading-relaxed break-words min-w-0 whitespace-pre-line">{desc || '–'}</td>
                                          <td className="py-2 px-2 text-right tabular-nums align-top">{typeKey === 'hotel' && nights > 0 ? `${qty} × ${nights}` : qty}</td>
                                          <td className="py-2 px-2 text-right tabular-nums align-top">
                                            {isMerged ? (roomUnitIdr > 0 ? (
                                              <>
                                                <div><NominalDisplay amount={roomUnitIdr} currency="IDR" /></div>
                                                {sarUsdLine(roomUnitIdr)}
                                              </>
                                            ) : unitPriceIdr > 0 ? (
                                              <>
                                                <div><NominalDisplay amount={unitPriceIdr} currency="IDR" /></div>
                                                {sarUsdLine(unitPriceIdr)}
                                              </>
                                            ) : '–') : hasHotelBreakdown ? (
                                              <>
                                                <div><NominalDisplay amount={roomUnitIdr} currency="IDR" /></div>
                                                {sarUsdLine(roomUnitIdr)}
                                              </>
                                            ) : (
                                              <>
                                                <div><NominalDisplay amount={unitPriceIdr} currency="IDR" /></div>
                                                {sarUsdLine(unitPriceIdr)}
                                              </>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-right tabular-nums align-top">
                                            {(typeKey === 'hotel' && withMeal && mealUnitIdr <= 0) ? (
                                              <div className="text-xs font-semibold text-emerald-700">Gratis</div>
                                            ) : isMerged ? (mealUnitIdr > 0 ? (
                                              <>
                                                <div><NominalDisplay amount={mealUnitIdr} currency="IDR" /></div>
                                                {sarUsdLine(mealUnitIdr)}
                                              </>
                                            ) : '–') : hasHotelBreakdown ? (mealUnitIdr > 0 ? (
                                              <>
                                                <div><NominalDisplay amount={mealUnitIdr} currency="IDR" /></div>
                                                {sarUsdLine(mealUnitIdr)}
                                              </>
                                            ) : '–') : '–'}
                                          </td>
                                          <td className="py-2 px-2 text-right font-medium tabular-nums align-top">
                                            {(hasHotelBreakdown || hasMergedBreakdown) && ((isMerged ? (mergedRoomSub + mergedMealSub) : (roomPart + mealPart)) > 0) ? (
                                              <div className="text-xs">
                                                <div className="font-semibold text-slate-800"><NominalDisplay amount={subtotal} currency="IDR" /></div>
                                                {sarUsdLine(subtotal)}
                                                <div className="text-slate-500 mt-1">
                                                  Perhitungan subtotal:{' '}
                                                  {(isMerged ? mergedMealSub : mealPart) > 0 ? (
                                                    <>
                                                      Kamar <NominalDisplay amount={isMerged ? mergedRoomSub : roomPart} currency="IDR" showCurrency={false} /> + Makan{' '}
                                                      <NominalDisplay amount={isMerged ? mergedMealSub : mealPart} currency="IDR" showCurrency={false} /> ={' '}
                                                      <NominalDisplay amount={subtotal} currency="IDR" showCurrency={false} />
                                                    </>
                                                  ) : (
                                                    <>
                                                      Kamar <NominalDisplay amount={isMerged ? mergedRoomSub : roomPart} currency="IDR" showCurrency={false} /> ={' '}
                                                      <NominalDisplay amount={subtotal} currency="IDR" showCurrency={false} />
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                <div><NominalDisplay amount={subtotal} currency="IDR" /></div>
                                                {sarUsdLine(subtotal)}
                                              </>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {(() => {
                                      const order = viewInvoice?.Order;
                                      const raw = viewInvoice?.Order?.OrderItems || [];
                                      const hasVisa = raw.some((i: any) => (i.type || i.product_type) === 'visa');
                                      const hasBusItems = raw.some((i: any) => (i.type || i.product_type) === 'bus');
                                      const busIncludeAllowed = String(order?.bus_service_option || '') !== 'visa_only';
                                      const hasBusInclude = busIncludeAllowed && (hasVisa || (Number(order?.penalty_amount) > 0) || !!order?.waive_bus_penalty) && !hasBusItems;
                                      if (!hasBusInclude) return null;
                                      const penalty = Number(order?.penalty_amount) || 0;
                                      const waive = !!order?.waive_bus_penalty;
                                      const desc = waive ? 'Tanpa penalti (Hiace)' : (penalty > 0 ? `Penalti bus: Rp ${(penalty / 1e6).toFixed(0)} jt (visa < 35 pack)` : 'Termasuk dengan visa');
                                      return (
                                        <tr className="border-b border-slate-100 bg-amber-50/50">
                                          <td className="py-2 px-2 text-slate-600 align-top">{orderItems.length + 1}</td>
                                          <td className="py-2 px-2 font-medium text-slate-700 align-top">Bus</td>
                                          <td className="py-2 px-2 text-slate-900 align-top">Bus include (dengan visa)</td>
                                          <td className="py-2 px-2 text-slate-600 text-xs align-top">{desc}</td>
                                          <td className="py-2 px-2 text-right tabular-nums align-top">–</td>
                                          <td className="py-2 px-2 text-right align-top">–</td>
                                          <td className="py-2 px-2 text-right align-top">–</td>
                                          <td className="py-2 px-2 text-right align-top">{penalty > 0 && !waive ? <NominalDisplay amount={penalty} currency="IDR" /> : '–'}</td>
                                        </tr>
                                      );
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Hint tagihan DP (jika bisa bayar, tombol sudah di atas) */}
                        {canPayInvoice(viewInvoice) && (
                          <p className="text-sm text-slate-500 px-1">Tagihan DP minimal {viewInvoice.dp_percentage || 30}% atau input sendiri. Bayar via Transfer Bank, VA, atau QRIS.</p>
                        )}
                      </>
                    );
                  })()}

                  {/* Audit: Riwayat Status + Perubahan Order */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-5 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="w-1 h-5 rounded-full bg-primary-500" /> Riwayat Status
                      </h4>
                      {auditLoading ? (
                        <div className="text-sm text-slate-500">{CONTENT_LOADING_MESSAGE}</div>
                      ) : (() => {
                        const hasRefundCompleted = (viewInvoice?.Refunds || []).some((r: any) => r.status === 'refunded');
                        const completedRefundRecord = hasRefundCompleted ? (viewInvoice?.Refunds as any[]).find((r: any) => r.status === 'refunded') : null;
                        const refundedDate = completedRefundRecord?.updated_at || completedRefundRecord?.created_at;
                        const syntheticRefundEntry = hasRefundCompleted ? { id: 'refund-completed', to_status: 'refunded', from_status: null, changed_at: refundedDate, _synthetic: true } : null;
                        const combinedHistory = syntheticRefundEntry ? [syntheticRefundEntry, ...statusHistory] : statusHistory;
                        const toShow = combinedHistory.slice().reverse();
                        if (toShow.length === 0) return <div className="text-sm text-slate-500">Belum ada riwayat.</div>;
                        return (
                          <div className="space-y-2">
                            {toShow.map((h: any) => (
                              <div key={h._synthetic ? 'refund-completed' : h.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/40">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant={h._synthetic || h.to_status === 'refunded' ? 'success' : getStatusBadge(h.to_status)} className="text-xs">
                                      {h._synthetic ? 'Sudah direfund' : (INVOICE_STATUS_LABELS[h.to_status] || h.to_status)}
                                    </Badge>
                                    <span className="text-xs text-slate-600">
                                      {h._synthetic ? 'Status terbaru: Sudah direfund' : (h.from_status ? `${INVOICE_STATUS_LABELS[h.from_status] || h.from_status} → ` : '') + (INVOICE_STATUS_LABELS[h.to_status] || h.to_status)}
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-500">{h.changed_at ? new Date(h.changed_at).toLocaleString('id-ID') : '–'}</span>
                                </div>
                                {!h._synthetic && (
                                  <div className="text-xs text-slate-600 mt-1">
                                    {(h.ChangedBy?.name || h.ChangedBy?.email) ? <>oleh <strong className="text-slate-800">{h.ChangedBy?.name || h.ChangedBy?.email}</strong></> : <span className="text-slate-500">oleh sistem</span>}
                                    {h.reason ? <span className="text-slate-500"> · {String(h.reason).replace(/_/g, ' ')}</span> : null}
                                  </div>
                                )}
                                {h._synthetic && <div className="text-xs text-slate-600 mt-1"><span className="text-slate-500">Refund selesai (bukti diupload)</span></div>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="lg:col-span-7 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="w-1 h-5 rounded-full bg-primary-500" /> Perubahan Order
                      </h4>
                      {auditLoading ? (
                        <div className="text-sm text-slate-500">{CONTENT_LOADING_MESSAGE}</div>
                      ) : orderRevisions.length === 0 ? (
                        <div className="text-sm text-slate-500">Belum ada revisi.</div>
                      ) : (() => {
                        const rev = orderRevisions[0];
                        const diff = rev?.diff || {};
                        const added = diff.added || [];
                        const removed = diff.removed || [];
                        const updated = diff.updated || [];
                        return (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50/40 border border-slate-200">
                              <div className="text-sm text-slate-700">
                                <span className="font-semibold">Revisi #{rev.revision_no}</span>
                                <span className="text-slate-500"> · {rev.changed_at ? new Date(rev.changed_at).toLocaleString('id-ID') : '–'}</span>
                                {(rev.ChangedBy?.name || rev.ChangedBy?.email) && <span className="text-slate-500"> · {rev.ChangedBy?.name || rev.ChangedBy?.email}</span>}
                              </div>
                              <div className="text-xs text-slate-600 flex gap-2 flex-wrap">
                                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Tambah {added.length}</span>
                                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Ubah {updated.length}</span>
                                <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Hapus {removed.length}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                                <div className="text-xs font-semibold text-slate-600 mb-2">Ditambah</div>
                                {added.length === 0 ? <div className="text-xs text-slate-400">–</div> : (
                                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                    {added.map((x: any, idx: number) => (
                                      <div key={idx} className="text-xs text-slate-700 p-2 rounded-lg bg-emerald-50/40 border border-emerald-100">
                                        <div className="font-medium">{x.after?.product_name || x.after?.product_ref_id || 'Item'}</div>
                                        <div className="text-slate-600">Qty {x.after?.quantity} · <NominalDisplay amount={Number(x.after?.unit_price || 0)} currency="IDR" /></div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                                <div className="text-xs font-semibold text-slate-600 mb-2">Diubah</div>
                                {updated.length === 0 ? <div className="text-xs text-slate-400">–</div> : (
                                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                    {updated.map((x: any, idx: number) => (
                                      <div key={idx} className="text-xs text-slate-700 p-2 rounded-lg bg-amber-50/40 border border-amber-100">
                                        <div className="font-medium">{x.after?.product_name || x.before?.product_name || x.after?.product_ref_id || 'Item'}</div>
                                        <div className="text-slate-600">
                                          Qty {x.before?.quantity} → {x.after?.quantity} · <NominalDisplay amount={Number(x.before?.unit_price || 0)} currency="IDR" /> → <NominalDisplay amount={Number(x.after?.unit_price || 0)} currency="IDR" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                                <div className="text-xs font-semibold text-slate-600 mb-2">Dihapus</div>
                                {removed.length === 0 ? <div className="text-xs text-slate-400">–</div> : (
                                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                    {removed.map((x: any, idx: number) => (
                                      <div key={idx} className="text-xs text-slate-700 p-2 rounded-lg bg-rose-50/40 border border-rose-100">
                                        <div className="font-medium">{x.before?.product_name || x.before?.product_ref_id || 'Item'}</div>
                                        <div className="text-slate-600">Qty {x.before?.quantity} · <NominalDisplay amount={Number(x.before?.unit_price || 0)} currency="IDR" /></div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Informasi Pembatalan (workflow: jadikan saldo / refund / alihkan ke invoice lain) */}
                  {(viewInvoice?.status === 'canceled' || viewInvoice?.status === 'cancelled' || viewInvoice?.status === 'cancelled_refund') && (viewInvoice as any)?.cancellation_handling_note && (
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                      <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <X className="w-4 h-4 text-slate-500" /> Informasi Pembatalan
                      </h4>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{String((viewInvoice as any).cancellation_handling_note || '').replace(/Refund\.\s*Jumlah:\s*Rp\s*[\d.,]+\.?\s*/gi, '').replace(/Diproses di menu Refund\.?\s*/gi, '').trim() || '–'}</p>
                      <p className="text-xs text-slate-500">Pembayaran pada invoice ini telah menjadi Rp 0 (nol) sesuai tindakan di atas.</p>
                    </div>
                  )}

                  {/* Info Refund (jika invoice dibatalkan dengan pembayaran) */}
                  {(viewInvoice?.Refunds?.length ?? 0) > 0 && (
                    <div className="p-5 bg-amber-50/80 rounded-2xl border border-amber-200 shadow-sm space-y-3">
                      <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                        <Receipt className="w-4 h-4" /> Permintaan Refund
                      </h4>
                      <p className="text-xs text-slate-500">Data ini muncul di menu Refund dan akan diproses oleh accounting. Setelah proses selesai, bukti refund dikirim ke email pemesan (pengorder).</p>
                      <ul className="space-y-2">
                        {(viewInvoice.Refunds as any[]).map((r: any) => (
                          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm p-3 bg-white rounded-lg border border-slate-200">
                            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                              <span className="font-semibold text-emerald-700"><NominalDisplay amount={parseFloat(r.amount)} currency="IDR" /></span>
                              <Badge variant={r.status === 'refunded' ? 'success' : r.status === 'rejected' ? 'error' : 'warning'}>
                                {r.status === 'requested' ? 'Menunggu proses' : r.status === 'approved' ? 'Disetujui' : r.status === 'rejected' ? 'Ditolak' : 'Sudah direfund'}
                              </Badge>
                              {r.proof_file_url && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    refundsApi.getProofFile(r.id)
                                      .then((res) => {
                                        const contentType = (res.headers?.['content-type'] || '').toLowerCase();
                                        if (res.status !== 200 || !(res.data instanceof Blob) || contentType.includes('application/json')) {
                                          showToast('Gagal unduh bukti refund', 'error');
                                          return;
                                        }
                                        const blob = res.data as Blob;
                                        const disp = res.headers?.['content-disposition'];
                                        let name = `bukti-refund-${viewInvoice?.invoice_number || r.id}.pdf`;
                                        if (typeof disp === 'string' && /filename[*]?=(?:UTF-8'')?["']?([^"'\s;]+)/i.test(disp)) {
                                          const m = disp.match(/filename[*]?=(?:UTF-8'')?["']?([^"'\s;]+)/i);
                                          if (m?.[1]) name = m[1].replace(/^["']|["']$/g, '');
                                        }
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = name;
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                      })
                                      .catch(() => showToast('Gagal unduh bukti refund', 'error'));
                                  }}
                                  className="text-[#0D1A63] hover:underline inline-flex items-center gap-1 text-xs font-medium"
                                >
                                  <Download className="w-3.5 h-3.5" /> Unduh bukti refund
                                </button>
                              )}
                            </div>
                            {(r.bank_name || r.account_number) && <span className="text-slate-600 text-xs w-full mt-1">Rekening: {r.bank_name} {r.account_number}</span>}
                            {r.reason && <span className="text-slate-600 text-xs w-full mt-1">Alasan: {r.reason}</span>}
                            {r.status === 'refunded' && r.proof_file_url && <span className="text-emerald-700 text-xs w-full mt-1">Bukti refund telah dikirim ke email pemesan.</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Preview PDF */}
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                      <span className="font-semibold text-slate-700 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" /> Preview Invoice PDF
                      </span>
                      <Button size="sm" variant="outline" onClick={() => openPdfInNewTab(viewInvoice.id)}>
                        <ExternalLink className="w-4 h-4 mr-1" /> Buka di tab baru
                      </Button>
                    </div>
                    <div className="h-[420px] min-h-[320px] bg-slate-50">
                      {loadingPdf && (
                        <div className="flex items-center justify-center h-full">
                          <ContentLoading minHeight={320} />
                        </div>
                      )}
                      {!loadingPdf && invoicePdfUrl && (
                        <iframe src={invoicePdfUrl} title="Invoice PDF" className="w-full h-full border-0" />
                      )}
                      {!loadingPdf && !invoicePdfUrl && (
                        <div className="flex items-center justify-center h-full text-slate-500">PDF tidak tersedia</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'payments' && (
                <div className="space-y-6">
                  <p className="text-sm text-slate-600">
                    Setiap kartu = satu bukti transfer <em>atau</em> satu alokasi saldo akun. Untuk transfer, status verifikasi dan verifikator tercantum di kartu. Pembayaran dari saldo tercatat otomatis tanpa upload file. Setelah bukti diverifikasi (atau alokasi saldo), invoice diperbarui: persen terbayar, sisa tagihan, dan status.
                  </p>
                  {paymentProofs.length === 0 && balanceAllocationsDetail.length === 0 ? (
                    <div className="text-center py-14 rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="p-4 rounded-2xl bg-slate-100 w-fit mx-auto mb-4">
                        <CreditCard className="w-12 h-12 text-slate-400" />
                      </div>
                      <p className="text-slate-700 font-semibold">Belum ada bukti pembayaran</p>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Upload bukti bayar untuk DP atau pelunasan via tombol &quot;Bayar DP / Bayar&quot; di tab Invoice & Order, atau alokasikan saldo akun jika tersedia.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paymentProofs.map((p: any, idx: number) => {
                        const fileUrl = getFileUrl(p.proof_file_url);
                        const ps = getProofStatus(p);
                        const isPending = ps.status === 'pending';
                        return (
                          <div key={p.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50/80 border-b border-slate-100">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="font-semibold text-[#0D1A63]">Pembayaran ke-{idx + 1}</span>
                                <span className="font-semibold text-slate-800">{getProofDisplayLabel(p)}</span>
                                <span className="text-slate-600 text-sm">
                                  {p.payment_location === 'saudi'
                                    ? `Pembayaran KES${p.payment_currency && p.payment_currency !== 'IDR' ? ` (${p.payment_currency})` : ''}`
                                    : 'Transfer Bank'}
                                </span>
                                {p.payment_location === 'saudi' ? (
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-1 w-full">
                                    <span><strong className="text-slate-500">Rek. pengirim / keterangan:</strong> Bagian Keuangan Kantor KSA</span>
                                    <span><strong className="text-slate-500">Rek. penerima:</strong> Pembayaran KES</span>
                                  </div>
                                ) : (
                                  (() => {
                                    const senderBank = (p as any).Bank?.name || p.bank_name;
                                    const senderName = (p as any).sender_account_name;
                                    const senderNo = (p as any).sender_account_number;
                                    const rec = (p as any).RecipientAccount;
                                    const hasSender = senderBank || senderName || senderNo;
                                    const hasRec = rec ? (rec.bank_name || rec.account_number || rec.name) : (p.bank_name || p.account_number);
                                    if (!hasSender && !hasRec) return null;
                                    return (
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
                                        {hasSender && <span><strong className="text-slate-500">Pengirim:</strong> {[senderBank, senderName, senderNo].filter(Boolean).join(' · ')}</span>}
                                        {hasRec && <span><strong className="text-slate-500">Penerima:</strong> {rec ? [rec.bank_name, rec.account_number, rec.name ? `A.n. ${rec.name}` : ''].filter(Boolean).join(' · ') : [p.bank_name, p.account_number].filter(Boolean).join(' · ')}</span>}
                                      </div>
                                    );
                                  })()
                                )}
                                {p.payment_location === 'saudi' && p.amount_original != null && p.payment_currency && p.payment_currency !== 'IDR' ? (
                                  <span className="text-[#0D1A63] font-semibold">
                                    Nominal diinput: {p.payment_currency === 'SAR' ? <NominalDisplay amount={Number(p.amount_original)} currency="SAR" /> : <NominalDisplay amount={Number(p.amount_original)} currency="USD" />} = <NominalDisplay amount={parseFloat(p.amount)} currency="IDR" />
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-[#0D1A63] font-semibold"><NominalDisplay amount={parseFloat(p.amount)} currency="IDR" /></span>
                                    <span className="text-xs text-slate-500">≈ <NominalDisplay amount={parseFloat(p.amount) / sarToIdr} currency="SAR" /> · ≈ <NominalDisplay amount={parseFloat(p.amount) / usdToIdr} currency="USD" /></span>
                                  </>
                                )}
                                <span className="inline-flex flex-col gap-0.5">
                                  <Badge variant={ps.variant}>{ps.label}</Badge>
                                  {ps.status === 'verified' && (p as any).VerifiedBy?.name && (
                                    <span className="text-xs text-slate-600">oleh: <strong className="text-slate-800">{(p as any).VerifiedBy.name}</strong></span>
                                  )}
                                </span>
                                {p.created_at && (
                                  <span className="text-xs text-slate-500">
                                    Tanggal upload bukti: {formatDate(p.created_at)} · Jam: {new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {(p as any).proof_file_name && (
                                  <span className="text-xs text-slate-600">
                                    File: <span className="font-medium text-slate-700">{(p as any).proof_file_name}</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {(fileUrl || (p.proof_file_url && p.proof_file_url !== 'issued-saudi')) && (
                                  <button type="button" onClick={() => downloadProofFile(viewInvoice.id, p)} className="inline-flex items-center gap-1 text-sm text-[#0D1A63] hover:underline bg-transparent border-0 cursor-pointer p-0" title={(p as any).proof_file_name ? `Unduh: ${(p as any).proof_file_name}` : undefined}>
                                    <Download className="w-4 h-4" /> Unduh
                                  </button>
                                )}
                                {isPending && canVerify && p.payment_location !== 'saudi' && (
                                  <>
                                    <Button size="sm" onClick={() => handleVerifyPayment(viewInvoice.id, p.id, true)} disabled={verifyingId === p.id}>
                                      <Check className="w-4 h-4 mr-1" /> Konfirmasi
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleVerifyPayment(viewInvoice.id, p.id, false)} disabled={verifyingId === p.id}>
                                      Tolak
                                    </Button>
                                  </>
                                )}
                                {p.payment_location === 'saudi' && (
                                  <span className="text-xs text-[#0D1A63] font-medium">Pembayaran KES — otomatis terverifikasi (tidak perlu konfirmasi admin)</span>
                                )}
                                {ps.status === 'rejected' && canDeleteRejectedProof(viewInvoice) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-700 border-red-200 hover:bg-red-50"
                                    onClick={() => handleDeleteRejectedProof(viewInvoice.id, p.id)}
                                    disabled={deletingProofId === p.id || verifyingId === p.id}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" /> Hapus
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="p-4 bg-slate-50/50 min-h-[280px]">
                              <ProofPreview invoiceId={viewInvoice.id} proof={p} />
                            </div>
                          </div>
                        );
                      })}
                      {balanceAllocationsDetail.map((b: any, aIdx: number) => {
                        const amt = parseFloat(String(b.amount || 0));
                        return (
                          <div key={b.id} className="rounded-xl border border-emerald-200 overflow-hidden bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-emerald-50/80 border-b border-emerald-100">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="font-semibold text-[#0D1A63]">Saldo akun #{aIdx + 1}</span>
                                <span className="font-semibold text-slate-800">Bayar dari saldo akun</span>
                                <span className="text-slate-600 text-sm">Tanpa upload bukti transfer</span>
                                <span className="text-[#0D1A63] font-semibold"><NominalDisplay amount={amt} currency="IDR" /></span>
                                <span className="text-xs text-slate-500">
                                  ≈ <NominalDisplay amount={amt / sarToIdr} currency="SAR" /> · ≈ <NominalDisplay amount={amt / usdToIdr} currency="USD" />
                                </span>
                                <Badge variant="success">Tercatat otomatis</Badge>
                                {b.created_at && (
                                  <span className="text-xs text-slate-500">
                                    Tanggal: {formatDate(b.created_at)} · Jam: {new Date(b.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="p-5 bg-white text-sm text-slate-600 space-y-2">
                              <p>Nominal di atas dipotong dari saldo akun owner dan langsung menambah pembayaran invoice ini.</p>
                              {b.notes ? (
                                <p>
                                  <span className="text-slate-500 font-medium">Keterangan:</span> {b.notes}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'progress' && (
                <div className="space-y-6">
                  <p className="text-sm text-slate-600">Status pekerjaan per produk (visa, tiket, hotel, bus, siskopatuh). Diupdate oleh divisi terkait.</p>
                  {(() => {
                    const order = viewInvoice?.Order;
                    const items = (order?.OrderItems || []).filter((i: any) => {
                      const t = (i.type || i.product_type);
                      return t === 'visa' || t === 'ticket' || t === 'hotel' || t === 'bus' || t === 'siskopatuh';
                    });
                    const hasVisaItems = (order?.OrderItems || []).some((i: any) => (i.type || i.product_type) === 'visa');
                    const hasBusItems = (order?.OrderItems || []).some((i: any) => (i.type || i.product_type) === 'bus');
                    const waiveBus = !!order?.waive_bus_penalty;
                    const busIncludeAllowed = String(order?.bus_service_option || '') !== 'visa_only';
                    const isBusInclude = busIncludeAllowed && (hasVisaItems || waiveBus) && !hasBusItems;
                    if (items.length === 0 && !isBusInclude) {
                      return (
                        <div className="text-center py-14 rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="p-4 rounded-2xl bg-slate-100 w-fit mx-auto mb-4">
                            <ClipboardList className="w-12 h-12 text-slate-400" />
                          </div>
                          <p className="text-slate-700 font-semibold">Tidak ada item visa / tiket / hotel / bus / siskopatuh</p>
                          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Invoice ini tidak memiliki item dengan status pekerjaan.</p>
                        </div>
                      );
                    }
                    // Kelompokkan per produk (product_ref_id), bukan per tipe kamar
                    type Group = { key: string; productLabel: string; type: string; items: any[] };
                    const groupsMap = new Map<string, Group>();
                    for (const item of items) {
                      const t = (item.type || item.product_type) as string;
                      const pid = String(item.product_ref_id || item.product_id || '');
                      const key = `${t}-${pid || item.id}`;
                      if (!groupsMap.has(key)) {
                        const productLabel =
                          item.Product?.name ||
                          (item as any).product_name ||
                          (t === 'visa' ? 'Visa' : t === 'ticket' ? 'Tiket' : t === 'hotel' ? 'Hotel' : t === 'siskopatuh' ? 'Siskopatuh' : 'Bus');
                        groupsMap.set(key, { key, productLabel, type: t, items: [] });
                      }
                      groupsMap.get(key)!.items.push(item);
                    }
                    if (isBusInclude) {
                      groupsMap.set('bus-include', { key: 'bus-include', productLabel: 'Bus include (dengan visa)', type: 'bus_include', items: [] });
                    }
                    const groups = Array.from(groupsMap.values());
                    groups.sort((a, b) => {
                      const sortIdx = (g: typeof a) => {
                        if (g.type === 'bus_include') return 7;
                        if (g.type === 'hotel' && g.items.length > 0) return getHotelLocationFromItem(g.items[0]) === 'madinah' ? 0 : 1;
                        return getOrderItemSortIndex(g.type, undefined);
                      };
                      return sortIdx(a) - sortIdx(b);
                    });
                    return (
                      <div className="space-y-4">
                        {groups.map((group) => {
                          const first = group.items[0];
                          const isBusInclude = group.type === 'bus_include';
                          if (isBusInclude) {
                            const o = viewInvoice?.Order as any;
                            const arrivalStatus = o?.bus_include_arrival_status || 'pending';
                            const returnStatus = o?.bus_include_return_status || 'pending';
                            const arrivalLabel = labelBusIncludeLeg(arrivalStatus);
                            const returnLabel = labelBusIncludeLeg(returnStatus);
                            return (
                              <div key={group.key} className="rounded-xl border border-amber-200 bg-amber-50/50 shadow-sm overflow-hidden">
                                <div className="flex items-start gap-4 p-4">
                                  <div className="p-2.5 rounded-xl shrink-0 bg-amber-100 text-amber-700">
                                    <Bus className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-900">Bus include (dengan visa)</span>
                                      <Badge variant="info" className="shrink-0">Divisi Bus</Badge>
                                    </div>
                                    <dl className="text-sm text-slate-700 space-y-1">
                                      <div><span className="font-medium">Kedatangan:</span> {arrivalLabel}</div>
                                      <div><span className="font-medium">Kepulangan:</span> {returnLabel}</div>
                                    </dl>
                                    <p className="text-xs text-slate-500">Diupdate oleh divisi Bus (menu Progress → Bus).</p>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          const itemWithJamaah = group.items.find((i: any) => i.jamaah_data_type && i.jamaah_data_value) || first;
                          const itemWithManifest = (group.type === 'ticket' || group.type === 'visa') ? group.items.find((i: any) => i.manifest_file_url) || first : first;
                          const isVisa = group.type === 'visa';
                          const isTicket = group.type === 'ticket';
                          const isHotel = group.type === 'hotel';
                          const isBus = group.type === 'bus';
                          const isSiskopatuh = group.type === 'siskopatuh';
                          const skRaw =
                            isSiskopatuh && first.meta && typeof first.meta === 'object'
                              ? String((first.meta as { siskopatuh_status?: string }).siskopatuh_status || 'pending')
                              : '';
                          const progress = isVisa ? first.VisaProgress : isTicket ? first.TicketProgress : isHotel ? first.HotelProgress : isBus ? first.BusProgress : null;
                          const statusLabels = isVisa ? VISA_STATUS_LABELS : isTicket ? TICKET_STATUS_LABELS : isHotel ? HOTEL_STATUS_LABELS : BUS_TICKET_LABELS;
                          const status = isSiskopatuh
                            ? labelHandlingSiskopatuhProgress(skRaw)
                            : isBus
                              ? labelBusItemProgress(first || {})
                              : isHotel
                                ? labelHotelGroupProgress(group.items)
                                : progress?.status
                                  ? statusLabels[progress.status] || UNIFIED_PROGRESS.MENUNGGU
                                  : UNIFIED_PROGRESS.MENUNGGU;
                          const hasJamaah = itemWithJamaah.jamaah_data_type && itemWithJamaah.jamaah_data_value;
                          const badgeVariant = isUnifiedSelesai(status) ? 'success' : 'info';
                          const typeIcon = isSiskopatuh ? (
                            <FileText className="w-4 h-4" />
                          ) : isVisa ? (
                            <FileText className="w-4 h-4" />
                          ) : isTicket ? (
                            <Plane className="w-4 h-4" />
                          ) : isHotel ? (
                            <Package className="w-4 h-4" />
                          ) : (
                            <CreditCard className="w-4 h-4" />
                          );
                          const typeBg = isSiskopatuh
                            ? 'bg-violet-100 text-violet-600'
                            : isVisa
                              ? 'bg-sky-100 text-sky-600'
                              : isTicket
                                ? 'bg-[#0D1A63]/10 text-[#0D1A63]'
                                : isHotel
                                  ? 'bg-amber-100 text-amber-600'
                                  : 'bg-slate-100 text-slate-600';
                          const siskopatuhFileUrl =
                            isSiskopatuh && first.meta && typeof first.meta === 'object'
                              ? String((first.meta as { siskopatuh_file_url?: string }).siskopatuh_file_url || '').trim()
                              : '';
                          return (
                            <div key={group.key} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                              <div className="flex items-start gap-4 p-4">
                                <div className={`p-2.5 rounded-xl shrink-0 ${typeBg}`}>{typeIcon}</div>
                                <div className="flex-1 min-w-0 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-900">{group.productLabel}</span>
                                    <Badge variant={badgeVariant} className="shrink-0">{status}</Badge>
                                  </div>
                                  {isHotel && (
                                    <p className="text-xs text-slate-500">
                                      {group.items.map((it: any) => {
                                        const rt = (it.meta?.room_type || '').toString() || '–';
                                        const label = ROOM_TYPE_LABELS[rt] || rt;
                                        return `${label} × ${it.quantity || 1}`;
                                      }).join(', ')} kamar
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                                    {hasJamaah && (
                                      <span>
                                        {itemWithJamaah.jamaah_data_type === 'link' ? (
                                          <a href={itemWithJamaah.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                                            <LinkIcon className="w-3.5 h-3.5" /> Link
                                          </a>
                                        ) : viewInvoice?.Order?.id ? (
                                          <button type="button" onClick={() => downloadJamaahFile(viewInvoice.Order.id, itemWithJamaah.id, itemWithJamaah.jamaah_data_value)} className="text-[#0D1A63] hover:underline inline-flex items-center gap-1 font-medium bg-transparent border-0 cursor-pointer p-0" disabled={!!downloadingJamaahItemId}>
                                            {downloadingJamaahItemId === itemWithJamaah.id ? 'Mengunduh…' : <><Download className="w-3.5 h-3.5" /> File</>}
                                          </button>
                                        ) : (
                                          <span className="inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> File diunggah</span>
                                        )}
                                      </span>
                                    )}
                                    {(isTicket || isVisa) && itemWithManifest.manifest_file_url && viewInvoice?.id && first?.id && (
                                      <button type="button" onClick={() => downloadManifestFile(viewInvoice.id, first.id)} className="text-[#0D1A63] hover:underline inline-flex items-center gap-1 font-medium bg-transparent border-0 cursor-pointer p-0">
                                        <Download className="w-3.5 h-3.5" /> Manifest
                                      </button>
                                    )}
                                    {!isHotel && !isBus && !isSiskopatuh && (progress?.visa_file_url || progress?.ticket_file_url) && viewInvoice?.id && first?.id && (
                                      <button type="button" onClick={() => downloadIssuedDoc(viewInvoice.id, first.id, isVisa ? 'visa' : 'ticket')} className="text-[#0D1A63] hover:underline inline-flex items-center gap-1 font-medium bg-transparent border-0 cursor-pointer p-0">
                                        <Download className="w-3.5 h-3.5" /> Dokumen terbit
                                      </button>
                                    )}
                                    {isSiskopatuh && siskopatuhFileUrl && viewInvoice?.id && first?.id && (
                                      <button type="button" onClick={() => downloadIssuedDoc(viewInvoice.id, first.id, 'siskopatuh')} className="text-[#0D1A63] hover:underline inline-flex items-center gap-1 font-medium bg-transparent border-0 cursor-pointer p-0">
                                        <Download className="w-3.5 h-3.5" /> Dokumen Siskopatuh
                                      </button>
                                    )}
                                  </div>
                                  {progress?.issued_at && (
                                    <p className="text-xs text-slate-500">Terbit: {new Date(progress.issued_at).toLocaleString('id-ID')}</p>
                                  )}
                                  {isSiskopatuh && first.meta && typeof first.meta === 'object' && (first.meta as { siskopatuh_file_uploaded_at?: string }).siskopatuh_file_uploaded_at && (
                                    <p className="text-xs text-slate-500">
                                      Dokumen diunggah:{' '}
                                      {new Date((first.meta as { siskopatuh_file_uploaded_at: string }).siskopatuh_file_uploaded_at).toLocaleString('id-ID')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {/* Slip per item ketika status selesai/terbit */}
                              {(() => {
                                const isSlipEligible = (item: any) => {
                                  if (isHotel) {
                                    const p = item.HotelProgress;
                                    const st = (p?.status || '');
                                    const room = (p?.room_number || '').trim();
                                    const meal = (p?.meal_status || '');
                                    return (st === 'completed' || st === 'room_assigned') && !!room && meal === 'completed';
                                  }
                                  if (isVisa) return (item.VisaProgress?.status || '') === 'issued';
                                  if (isTicket) return (item.TicketProgress?.status || '') === 'ticket_issued';
                                  if (isBus) return (item.BusProgress?.bus_ticket_status || '') === 'issued';
                                  return false;
                                };
                                const slipItems = group.items.filter((item: any) => isSlipEligible(item));
                                if (slipItems.length === 0) return null;
                                const ord = viewInvoice?.Order;
                                const invoiceNum = viewInvoice?.invoice_number ?? '–';
                                const ownerName = ord?.User?.name || ord?.User?.company_name || ord?.owner_name_manual || '–';
                                const slipTitle = isHotel ? 'Slip Informasi Hotel' : isVisa ? 'Slip Informasi Visa' : isTicket ? 'Slip Informasi Tiket' : 'Slip Informasi Bus';
                                return (
                                  <div className="border-t border-slate-200 bg-slate-50/50 p-4 space-y-4">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{slipTitle}</p>
                                    {slipItems.map((item: any) => {
                                      const prog = isVisa ? item.VisaProgress : isTicket ? item.TicketProgress : isHotel ? item.HotelProgress : item.BusProgress;
                                      const productName = item.Product?.name || (item as any).product_name || (isVisa ? 'Visa' : isTicket ? 'Tiket' : isHotel ? 'Hotel' : 'Bus');
                                      const statusLabel = isBus
                                        ? labelBusItemProgress(item)
                                        : isHotel
                                          ? HOTEL_STATUS_LABELS[prog?.status || ''] || UNIFIED_PROGRESS.MENUNGGU
                                          : isVisa
                                            ? VISA_STATUS_LABELS[prog?.status || ''] || UNIFIED_PROGRESS.MENUNGGU
                                            : TICKET_STATUS_LABELS[prog?.status || ''] || UNIFIED_PROGRESS.MENUNGGU;
                                      const mealLabel = isHotel && prog ? (PROGRESS_LABELS_MEAL[prog.meal_status || ''] || prog.meal_status) : null;
                                      return (
                                        <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                            <div><dt className="text-slate-500">No. Invoice</dt><dd className="font-medium text-slate-900">{invoiceNum}</dd></div>
                                            <div><dt className="text-slate-500">Produk</dt><dd className="font-medium text-slate-900">{productName}</dd></div>
                                            <div><dt className="text-slate-500">Pemesan (Owner)</dt><dd className="font-medium text-slate-900">{ownerName}</dd></div>
                                            {isHotel && (
                                              <>
                                                <div><dt className="text-slate-500">Tipe Kamar</dt><dd className="font-medium text-slate-900">{ROOM_TYPE_LABELS[(item.meta?.room_type || '').toString()] || item.meta?.room_type || '–'}</dd></div>
                                                <div><dt className="text-slate-500">Jumlah Kamar</dt><dd className="font-medium text-slate-900">{item.quantity ?? '–'}</dd></div>
                                                <div><dt className="text-slate-500">Nomor Kamar</dt><dd className="font-medium text-slate-900">{(prog?.room_number || '').trim() || '–'}</dd></div>
                                                {mealLabel != null && <div><dt className="text-slate-500">Status Makan</dt><dd className="font-medium text-slate-900">{mealLabel}</dd></div>}
                                                <div><dt className="text-slate-500">Check-in</dt><dd className="font-medium text-slate-900">{prog?.check_in_date ? formatDate(prog.check_in_date) + ' 16:00' : '–'}</dd></div>
                                                <div><dt className="text-slate-500">Check-out</dt><dd className="font-medium text-slate-900">{prog?.check_out_date ? formatDate(prog.check_out_date) + ' 12:00' : '–'}</dd></div>
                                              </>
                                            )}
                                            {isVisa && (
                                              <>
                                                <div><dt className="text-slate-500">Jumlah</dt><dd className="font-medium text-slate-900">{item.quantity ?? '–'}</dd></div>
                                                <div><dt className="text-slate-500">Tanggal Terbit</dt><dd className="font-medium text-slate-900">{prog?.issued_at ? new Date(prog.issued_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'}</dd></div>
                                              </>
                                            )}
                                            {isTicket && (
                                              <>
                                                <div><dt className="text-slate-500">Jumlah</dt><dd className="font-medium text-slate-900">{item.quantity ?? '–'}</dd></div>
                                                <div><dt className="text-slate-500">Tipe Perjalanan</dt><dd className="font-medium text-slate-900">{(item.meta?.trip_type || '').toString() || '–'}</dd></div>
                                                <div><dt className="text-slate-500">Tanggal Terbit</dt><dd className="font-medium text-slate-900">{prog?.issued_at ? new Date(prog.issued_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'}</dd></div>
                                              </>
                                            )}
                                            {isBus && (
                                              <>
                                                <div><dt className="text-slate-500">Jumlah</dt><dd className="font-medium text-slate-900">{item.quantity ?? '–'}</dd></div>
                                                <div><dt className="text-slate-500">Rute</dt><dd className="font-medium text-slate-900">{(item.meta?.route || item.meta?.bus_route || '').toString() || '–'}</dd></div>
                                                <div><dt className="text-slate-500">Info Tiket Bus</dt><dd className="font-medium text-slate-900">{(prog?.bus_ticket_info || '').trim() || '–'}</dd></div>
                                                <div><dt className="text-slate-500">Kedatangan</dt><dd className="font-medium text-slate-900">{labelBusTripProgress(String(prog?.arrival_status || ''))}</dd></div>
                                                <div><dt className="text-slate-500">Keberangkatan</dt><dd className="font-medium text-slate-900">{labelBusTripProgress(String(prog?.departure_status || ''))}</dd></div>
                                                <div><dt className="text-slate-500">Kepulangan</dt><dd className="font-medium text-slate-900">{labelBusTripProgress(String(prog?.return_status || ''))}</dd></div>
                                              </>
                                            )}
                                            <div><dt className="text-slate-500">Status Progress</dt><dd className="font-medium text-slate-900">{statusLabel || '–'}</dd></div>
                                            <div className="sm:col-span-2"><dt className="text-slate-500">Catatan</dt><dd className="font-medium text-slate-900">{(prog?.notes || '').trim() || '–'}</dd></div>
                                          </dl>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {detailTab === 'invoice_refund' && viewInvoice && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Dokumen pembatalan / refund invoice. Informasi lengkap tersimpan di sistem.</p>
                  <InvoiceRefundDocument
                    inv={viewInvoice}
                    formatDate={(d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–')}
                  />
                </div>
              )}
            </div>
            </ModalBody>

            <ModalFooter>
              <Button variant="outline" onClick={closeModal} className="rounded-xl min-w-[100px]">Tutup</Button>
            </ModalFooter>
          </ModalBoxLg>
        </Modal>
      )}

      {/* Modal Batalkan Invoice: dua tab — Lihat Invoice (PDF) & Invoice batal (dokumen + form) */}
      {showCancelModal && cancelTargetInv && (
        <Modal open onClose={() => !deletingOrderId && closeCancelModal()} zIndex={60}>
          <ModalBox className="max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <ModalHeader
              title="Batalkan Order / Invoice"
              subtitle={
                (user?.role === 'owner_mou' || user?.role === 'owner_non_mou') &&
                isInvoiceFullyPaidOwnerCancelFlow(cancelTargetInv) &&
                (parseFloat(cancelTargetInv.paid_amount) || 0) > 0
                  ? 'Invoice lunas: konfirmasi mengirim pengajuan ke Admin Pusat. Setelah disetujui, pembatalan diproses otomatis (saldo/refund/alokasi sesuai pilihan Anda).'
                  : 'Lihat invoice pembayaran sebelumnya dan konfirmasi pembatalan.'
              }
              icon={<X className="w-5 h-5" />}
              onClose={() => !deletingOrderId && closeCancelModal()}
            />
            <div className="flex gap-1 px-6 pt-2 pb-0 border-b border-slate-200 bg-slate-50/60 shrink-0">
              <button
                type="button"
                onClick={() => setCancelModalTab('view_invoice')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl border border-b-0 transition-all -mb-px ${
                  cancelModalTab === 'view_invoice' ? 'bg-white border-slate-200 shadow-sm text-[#0D1A63]' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> Invoice pembayaran sebelumnya
              </button>
              <button
                type="button"
                onClick={() => setCancelModalTab('invoice_refund')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl border border-b-0 transition-all -mb-px ${
                  cancelModalTab === 'invoice_refund' ? 'bg-white border-slate-200 shadow-sm text-red-700 border-red-200' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Receipt className="w-4 h-4" /> Invoice batal
              </button>
            </div>
            <ModalBody className="flex-1 overflow-y-auto p-6 space-y-4">
              {cancelModalTab === 'view_invoice' && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                  <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-sm font-medium text-slate-700">Preview invoice (sebelum dibatalkan)</div>
                  <div className="h-[420px] min-h-[320px]">
                    {loadingCancelPdf && (
                      <div className="flex items-center justify-center h-full"><ContentLoading minHeight={320} /></div>
                    )}
                    {!loadingCancelPdf && cancelModalPdfUrl && (
                      <iframe src={cancelModalPdfUrl} title="Invoice PDF" className="w-full h-full border-0" />
                    )}
                    {!loadingCancelPdf && !cancelModalPdfUrl && (
                      <div className="flex items-center justify-center h-full text-slate-500">PDF tidak tersedia</div>
                    )}
                  </div>
                </div>
              )}
              {cancelModalTab === 'invoice_refund' && (
                <>
                  <InvoiceRefundDocument
                    inv={cancelTargetInv}
                    preview={(() => {
                      const paid = parseFloat(cancelTargetInv.paid_amount) || 0;
                      if (paid === 0) return { action: 'to_balance', reason: cancelReason };
                      const refundAmt = cancelRefundAmount.trim() ? parseFloat(cancelRefundAmount.replace(/,/g, '')) : paid;
                      const targetOpt = cancelTargetInvoiceOptions.find((i: any) => i.id === cancelTargetInvoiceId);
                      const remainderOpt = cancelTargetInvoiceOptions.find((i: any) => i.id === cancelRemainderTargetInvoiceId);
                      return {
                        action: cancelAction,
                        refundAmount: Number.isFinite(refundAmt) ? refundAmt : paid,
                        remainderAction: cancelAction === 'refund' ? 'to_balance' : cancelRemainderAction,
                        bankName: cancelBankName || undefined,
                        accountNumber: cancelAccountNumber || undefined,
                        accountHolderName: cancelAccountHolderName || undefined,
                        targetInvoiceNumber: cancelAction === 'allocate_to_order' ? targetOpt?.invoice_number : undefined,
                        remainderTargetInvoiceNumber: cancelAction !== 'refund' && cancelRemainderAction === 'allocate_to_order' ? remainderOpt?.invoice_number : undefined,
                        reason: cancelReason || undefined,
                      };
                    })()}
                    formatDate={(d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '–')}
                  />
                  {(() => {
                    const paid = parseFloat(cancelTargetInv.paid_amount) || 0;
                    if (paid > 0) {
                      const refundAmt = cancelRefundAmount.trim() ? parseFloat(cancelRefundAmount.replace(/,/g, '')) : paid;
                      const isPartialRefund = Number.isFinite(refundAmt) && refundAmt > 0 && refundAmt < paid;
                      const remainder = isPartialRefund ? paid - refundAmt : 0;
                      return (
                        <div className="pt-4 border-t border-slate-200 space-y-4">
                          {(user?.role === 'owner_mou' || user?.role === 'owner_non_mou') && isInvoiceFullyPaidOwnerCancelFlow(cancelTargetInv) && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-sm px-3 py-2">
                              Invoice sudah lunas: pembatalan tidak langsung aktif. Data di bawah dikirim sebagai <strong>pengajuan</strong> ke Admin Pusat untuk ditinjau.
                            </div>
                          )}
                          <p className="text-sm font-medium text-slate-700">Pilih tindakan dan isi data:</p>
                          <div className="space-y-3">
                            <Button type="button" variant={cancelAction === 'to_balance' ? 'primary' : 'outline'} fullWidth onClick={() => setCancelAction('to_balance')} className="flex flex-col items-start text-left h-auto py-3">
                              <span className="font-medium">Jadikan saldo akun</span>
                              <span className="text-xs opacity-90 mt-0.5">Dana masuk ke saldo. Bisa dipakai untuk order baru atau alokasi ke tagihan lain.</span>
                            </Button>
                            <Button type="button" variant={cancelAction === 'refund' ? 'primary' : 'outline'} fullWidth onClick={() => setCancelAction('refund')} className="flex flex-col items-start text-left h-auto py-3">
                              <span className="font-medium">Refund ke rekening</span>
                              <span className="text-xs opacity-90 mt-0.5">Masukkan data bank & rekening. Role accounting akan memproses pengembalian dana.</span>
                            </Button>
                            <Button type="button" variant={cancelAction === 'allocate_to_order' ? 'primary' : 'outline'} fullWidth onClick={() => setCancelAction('allocate_to_order')} className="flex flex-col items-start text-left h-auto py-3">
                              <span className="font-medium">Pindah / alokasikan ke order lain</span>
                              <span className="text-xs opacity-90 mt-0.5">Seluruh pembayaran dialihkan ke invoice lain (milik owner yang sama).</span>
                            </Button>
                          </div>
                          {cancelAction === 'refund' && (
                            <div className="space-y-3 pt-3 border-t border-slate-200">
                              <Input label="Jumlah yang ingin di-refund (default = sesuai yang dibayarkan, kosong = full)" type="text" value={cancelRefundAmount} onChange={(e) => setCancelRefundAmount(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))} placeholder={formatIDR(paid)} disabled={!!deletingOrderId} />
                              <Autocomplete label="Nama Bank (wajib)" value={cancelBankName} onChange={(v) => setCancelBankName(v || '')} options={paymentBanks.map((b) => ({ value: b.name, label: b.name }))} placeholder="Pilih bank" emptyLabel="Pilih bank" disabled={!!deletingOrderId} />
                              <Input label="Nomor Rekening (wajib)" type="text" value={cancelAccountNumber} onChange={(e) => setCancelAccountNumber(e.target.value)} placeholder="Nomor Rekening" disabled={!!deletingOrderId} />
                              <Input label="Nama pemilik rekening (opsional)" type="text" value={cancelAccountHolderName} onChange={(e) => setCancelAccountHolderName(e.target.value)} placeholder="A.n. nama pemilik" disabled={!!deletingOrderId} />
                            </div>
                          )}
                          {cancelAction === 'allocate_to_order' && (
                            <div className="pt-3 border-t border-slate-200">
                              <Autocomplete label="Invoice tujuan (seluruh dana)" value={cancelTargetInvoiceId} onChange={(v) => setCancelTargetInvoiceId(v || '')} options={cancelTargetInvoiceOptions.map((i: any) => ({ value: i.id, label: `${i.invoice_number} — ${formatIDR(parseFloat(i.remaining_amount) || 0)} sisa` }))} placeholder="Pilih invoice" emptyLabel="Pilih invoice" />
                            </div>
                          )}
                          <Textarea label="Alasan pembatalan (opsional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Contoh: Order salah input..." rows={2} disabled={!!deletingOrderId} />
                          {(user?.role === 'owner_mou' || user?.role === 'owner_non_mou') && isInvoiceFullyPaidOwnerCancelFlow(cancelTargetInv) && (
                            <Textarea
                              label="Catatan untuk Admin Pusat (opsional)"
                              value={cancelOwnerNote}
                              onChange={(e) => setCancelOwnerNote(e.target.value)}
                              placeholder="Informasi tambahan untuk peninjauan..."
                              rows={2}
                              disabled={!!deletingOrderId}
                            />
                          )}
                          <p className="text-xs text-slate-500">Seluruh proses tersimpan di sistem dan dapat dilihat di riwayat invoice serta tab Invoice Refund.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="pt-4 border-t border-slate-200">
                        <Textarea label="Alasan pembatalan (opsional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Contoh: Order salah input..." rows={2} disabled={!!deletingOrderId} />
                        <p className="text-sm text-slate-600 mt-2">Batalkan invoice <strong>{cancelTargetInv.invoice_number}</strong>? Tindakan ini tidak dapat dibatalkan.</p>
                      </div>
                    );
                  })()}
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={closeCancelModal} disabled={!!deletingOrderId}>Batal</Button>
              <Button variant="primary" onClick={submitCancelModal} disabled={!!deletingOrderId} className="bg-red-600 hover:bg-red-700">
                {deletingOrderId
                  ? 'Memproses...'
                  : (parseFloat(cancelTargetInv.paid_amount) || 0) > 0
                    ? (user?.role === 'owner_mou' || user?.role === 'owner_non_mou') && isInvoiceFullyPaidOwnerCancelFlow(cancelTargetInv)
                      ? 'Ajukan ke Admin Pusat'
                      : cancelAction === 'to_balance'
                        ? 'Ya, batalkan & jadikan saldo'
                        : cancelAction === 'refund'
                          ? 'Ya, batalkan & minta refund'
                          : 'Ya, batalkan & pindah ke invoice lain'
                    : 'Ya, batalkan'}
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}

      {/* Modal Pemindahan Dana (alokasi dari invoice sumber ke penerima) */}
      {showReallocateModal && (() => {
        const list = reallocateInvoiceList || [];
        const sourceCandidates = list.filter((i: any) => {
          const st = (i.status || '').toLowerCase();
          const paid = parseFloat(i.paid_amount || 0);
          const overpaid = parseFloat(i.overpaid_amount || 0);
          const cancelledRefundAmt = parseFloat(i.cancelled_refund_amount || 0);
          if (st === 'canceled' || st === 'cancelled' || st === 'cancelled_refund') return paid > 0 || cancelledRefundAmt > 0;
          return overpaid > 0;
        });
        const targetCandidates = list.filter((i: any) => isInvoiceReallocateTarget(i));
        const getReleasable = (inv: any) => {
          const st = (inv?.status || '').toLowerCase();
          if (st === 'canceled' || st === 'cancelled' || st === 'cancelled_refund') {
            const paid = parseFloat(inv?.paid_amount || 0);
            const cancelledRefundAmt = parseFloat(inv?.cancelled_refund_amount || 0);
            return paid > 0 ? paid : cancelledRefundAmt;
          }
          return parseFloat(inv?.overpaid_amount || 0);
        };
        const addRow = () => setReallocateRows((prev) => [...prev, { source_invoice_id: '', target_invoice_id: '', amount: '' }]);
        const removeRow = (idx: number) => setReallocateRows((prev) => prev.filter((_, i) => i !== idx));
        const updateRow = (idx: number, field: 'source_invoice_id' | 'target_invoice_id' | 'amount', value: string) => {
          setReallocateRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
        };
        const transfers = reallocateRows
          .map((r) => ({ ...r, amount: parseFloat(String(r.amount).replace(/,/g, '')) || 0 }))
          .filter((t) => t.source_invoice_id && t.target_invoice_id && t.amount > 0);
        const totalFromSources: Record<string, number> = {};
        const sourceReleasable: Record<string, number> = {};
        sourceCandidates.forEach((i: any) => { sourceReleasable[i.id] = getReleasable(i); });
        transfers.forEach((t) => { totalFromSources[t.source_invoice_id] = (totalFromSources[t.source_invoice_id] || 0) + t.amount; });
        const sourceOk = Object.entries(totalFromSources).every(([id, sum]) => sum <= (sourceReleasable[id] || 0));
        const totalAmount = transfers.reduce((s, t) => s + t.amount, 0);
        const canSubmit = transfers.length > 0 && sourceOk;

        const submitReallocate = async () => {
          if (!canSubmit) return;
          setReallocateSubmitting(true);
          try {
            const res = await invoicesApi.reallocatePayments({
              transfers: transfers.map((t) => ({ source_invoice_id: t.source_invoice_id, target_invoice_id: t.target_invoice_id, amount: t.amount })),
              notes: reallocateNotes.trim() || undefined
            });
            const msg = (res.data as any)?.message || 'Pemindahan dana berhasil.';
            showToast(msg, 'success');
            setShowReallocateModal(false);
            setReallocateRows([]);
            setReallocateNotes('');
            fetchInvoices();
            fetchSummary();
            if (viewInvoice?.id) fetchInvoiceDetail(viewInvoice.id);
          } catch (e: any) {
            showToast(e.response?.data?.message || 'Gagal memindahkan dana', 'error');
          } finally {
            setReallocateSubmitting(false);
          }
        };

        return (
          <Modal
            open={showReallocateModal}
            onClose={() => !reallocateSubmitting && setShowReallocateModal(false)}
            zIndex={60}
          >
            <ModalBox className="max-w-4xl w-full">
              <ModalHeader
                title="Pemindahan Dana Antar Invoice"
                subtitle="Alokasikan dana dari invoice sumber (dibatalkan / kelebihan bayar) ke invoice penerima. Yang diterapkan ke penerima dibatasi sisa tagihannya; kelebihan tetap di invoice sumber (bisa dipindah lagi atau saldo via alur lain)."
                icon={<ArrowRightLeft className="w-5 h-5" />}
                onClose={() => !reallocateSubmitting && setShowReallocateModal(false)}
              />
              <ModalBody className="flex-1 space-y-4 min-h-0">
                {reallocateListLoading ? (
                  <p className="text-slate-500">{CONTENT_LOADING_MESSAGE}</p>
                ) : (
                  <>
                    {(sourceCandidates.length === 0 || targetCandidates.length === 0) && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
                        {sourceCandidates.length === 0 && (
                          <p className="text-amber-800 text-sm">Tidak ada invoice sumber (invoice dibatalkan dengan pembayaran, atau invoice dengan kelebihan bayar).</p>
                        )}
                        {targetCandidates.length === 0 && (
                          <p className="text-amber-800 text-sm">Tidak ada invoice penerima (invoice aktif dengan sisa tagihan).</p>
                        )}
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700">Detail alokasi</span>
                        <Button variant="outline" size="sm" onClick={addRow}>Tambah baris</Button>
                      </div>
                      <div className="border border-slate-200 rounded-xl w-full">
                        <table className="w-full text-sm table-fixed">
                          <colgroup>
                            <col className="w-[38%]" />
                            <col className="w-[38%]" />
                            <col className="w-[18%]" />
                            <col className="w-[6%]" />
                          </colgroup>
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2.5 px-3 text-slate-600 font-medium">Invoice Sumber</th>
                              <th className="text-left py-2.5 px-3 text-slate-600 font-medium">Invoice Penerima</th>
                              <th className="text-left py-2.5 px-3 text-slate-600 font-medium">Jumlah (IDR)</th>
                              <th className="w-10 py-2.5 px-1" />
                            </tr>
                          </thead>
                          <tbody>
                            {reallocateRows.map((row, idx) => (
                              <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                <td className="py-2 px-3 align-middle">
                                  <div className="w-full min-w-0">
                                    <Autocomplete
                                      value={row.source_invoice_id}
                                      onChange={(v) => updateRow(idx, 'source_invoice_id', v)}
                                      options={[
                                        { value: '', label: 'Pilih sumber' },
                                        ...sourceCandidates.map((i: any) => ({ value: i.id, label: `${i.invoice_number} — ${formatIDR(getReleasable(i))} tersedia` }))
                                      ]}
                                      emptyLabel="Pilih sumber"
                                      className="w-full"
                                    />
                                  </div>
                                </td>
                                <td className="py-2 px-3 align-middle">
                                  <div className="w-full min-w-0">
                                    <Autocomplete
                                      value={row.target_invoice_id}
                                      onChange={(v) => updateRow(idx, 'target_invoice_id', v)}
                                      options={[
                                        { value: '', label: 'Pilih penerima' },
                                        ...targetCandidates.map((i: any) => ({ value: i.id, label: `${i.invoice_number} — sisa ${formatIDR(parseFloat(i.remaining_amount || 0))}` }))
                                      ]}
                                      emptyLabel="Pilih penerima"
                                      className="w-full"
                                    />
                                  </div>
                                </td>
                                <td className="py-2 px-3 align-middle">
                                  <div className="w-full min-w-0">
                                    <Input
                                      type="text"
                                      value={row.amount}
                                      onChange={(e) => updateRow(idx, 'amount', e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                                      placeholder="0"
                                      fullWidth
                                    />
                                  </div>
                                </td>
                                <td className="py-2 px-1 align-middle text-center">
                                  <button type="button" onClick={() => removeRow(idx)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex" title="Hapus baris">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {reallocateRows.length === 0 && (
                        <p className="text-slate-500 text-sm py-2">Klik &quot;Tambah baris&quot; untuk menambah alokasi.</p>
                      )}
                      {transfers.length > 0 && (
                        <p className="text-sm text-slate-600">
                          Total dipindahkan: <strong><NominalDisplay amount={totalAmount} currency="IDR" /></strong>
                          {!sourceOk && <span className="text-red-600 ml-2">— Jumlah dari salah satu sumber melebihi dana yang tersedia.</span>}
                        </p>
                      )}
                    </div>
                    <div className="pt-1">
                      <Textarea
                        label="Catatan (opsional)"
                        value={reallocateNotes}
                        onChange={(e) => setReallocateNotes(e.target.value)}
                        placeholder="Contoh: Alokasi dari pembatalan order #X ke invoice #Y"
                        rows={3}
                        fullWidth
                      />
                    </div>
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="outline" onClick={() => setShowReallocateModal(false)} disabled={reallocateSubmitting}>Batal</Button>
                <Button variant="primary" onClick={submitReallocate} disabled={reallocateSubmitting || !canSubmit}>
                  {reallocateSubmitting ? 'Memproses...' : 'Proses Pemindahan'}
                </Button>
              </ModalFooter>
            </ModalBox>
          </Modal>
        );
      })()}

      {/* Modal Pembayaran (Transfer Bank / VA / QRIS) */}
      {showPaymentModal && viewInvoice && (
        <Modal open onClose={() => !paySubmitting && setShowPaymentModal(false)} zIndex={60}>
          <ModalBox>
            <ModalHeader
              title="Pembayaran Invoice"
              subtitle={`Bayar dengan: ${paymentMethod === 'bank' ? 'Transfer Bank' : paymentMethod === 'va' ? 'Virtual Account' : 'QRIS'}. Sisa tagihan: ${formatIDR(parseFloat(viewInvoice.remaining_amount))} (≈ ${formatSAR(parseFloat(viewInvoice.remaining_amount || 0) / sarToIdr)} · ≈ ${formatUSD(parseFloat(viewInvoice.remaining_amount || 0) / usdToIdr)}). Pilih metode, input jumlah, lalu upload bukti.`}
              icon={<CreditCard className="w-5 h-5" />}
              onClose={() => !paySubmitting && setShowPaymentModal(false)}
            />
            <ModalBody className="p-0 flex flex-col flex-1 overflow-hidden">
            <div className="flex border-b border-slate-200 flex-wrap px-6">
              {isInvoiceSaudi && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('saudi')}
                  className={`flex-1 min-w-[120px] px-4 py-3 text-sm font-medium ${paymentMethod === 'saudi' ? 'border-b-2 border-emerald-600 text-[#0D1A63] bg-emerald-50/50' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Pembayaran Saudi (SAR/USD)
                </button>
              )}
              {(['bank', 'va', 'qris'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium ${paymentMethod === m ? 'border-b-2 border-emerald-600 text-[#0D1A63] bg-emerald-50/50' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {m === 'bank' ? 'Transfer Bank' : m === 'va' ? 'Virtual Account' : 'QRIS'}
                </button>
              ))}
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {paymentMethod === 'saudi' && isInvoiceSaudi && (
                <>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">Pilih mata uang yang dibayarkan (SAR, USD, atau IDR). Jumlah sesuai mata uang; sistem mencatat dan mengupdate sisa tagihan otomatis. Upload bukti bayar wajib.</p>
                  <Autocomplete
                    label="Mata uang pembayaran *"
                    value={payCurrencySaudi}
                    onChange={(v) => setPayCurrencySaudi((v as 'SAR' | 'USD' | 'IDR') || 'SAR')}
                    options={[
                      { value: 'SAR', label: 'SAR (Riyal Saudi)' },
                      { value: 'USD', label: 'USD' },
                      { value: 'IDR', label: 'IDR (Rupiah)' }
                    ]}
                    placeholder="Pilih mata uang"
                  />
                  {parseFloat(viewInvoice?.remaining_amount || 0) > 0 && (
                    <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">Sisa tagihan: <strong><NominalDisplay amount={parseFloat(viewInvoice.remaining_amount || 0)} currency="IDR" /></strong> — jumlah bayar di bawah diisi otomatis dengan sisa (dapat diubah).</p>
                  )}
                  <Input
                    label={`Jumlah bayar (${payCurrencySaudi}) *`}
                    type="text"
                    value={payAmountSaudi}
                    onChange={(e) => setPayAmountSaudi(e.target.value.replace(/,/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                    placeholder={payCurrencySaudi === 'IDR' ? 'Contoh: 5000000' : payCurrencySaudi === 'SAR' ? 'Contoh: 5000' : 'Contoh: 1500'}
                  />
                  {payAmountSaudi && !isNaN(parseFloat(payAmountSaudi.replace(/,/g, ''))) && (() => {
                    const amt = parseFloat(payAmountSaudi.replace(/,/g, ''));
                    const idr = payCurrencySaudi === 'IDR' ? amt : payCurrencySaudi === 'SAR' ? amt * sarToIdr : amt * usdToIdr;
                    const currentPaid = parseFloat(viewInvoice.paid_amount || 0);
                    const totalInvPay = viewInvoice.total_amount_idr != null ? parseFloat(viewInvoice.total_amount_idr) : parseFloat(viewInvoice.total_amount || 0);
                    const newPaid = currentPaid + Math.round(idr);
                    const newRemainRaw = totalInvPay - newPaid;
                    const exceeds = newRemainRaw < -0.5;
                    const newRemainDisplay = Math.max(0, newRemainRaw);
                    return (
                      <div
                        className={`mt-3 p-4 rounded-xl border space-y-2 text-sm ${
                          exceeds ? 'border-red-300 bg-red-50/90' : 'border-emerald-200 bg-emerald-50/80'
                        }`}
                      >
                        {payCurrencySaudi !== 'IDR' && <p className="text-xs text-slate-600">≈ <NominalDisplay amount={Math.round(idr)} currency="IDR" /> IDR (konversi untuk tagihan)</p>}
                        <p className="font-semibold text-slate-800">Setelah pembayaran ini</p>
                        <p><span className="text-slate-600">Dibayar total:</span> <strong className="text-[#0D1A63]"><NominalDisplay amount={newPaid} currency="IDR" /></strong></p>
                        <p>
                          <span className="text-slate-600">Sisa tagihan:</span>{' '}
                          <strong className={exceeds ? 'text-red-600' : newRemainDisplay <= 0 ? 'text-[#0D1A63]' : 'text-red-600'}>
                            <NominalDisplay amount={newRemainDisplay} currency="IDR" />
                          </strong>
                        </p>
                        {exceeds && (
                          <p className="text-red-700 text-sm font-medium pt-1">
                            Jumlah pembayaran melebihi sisa tagihan. Pembayaran tidak dapat disimpan; kurangi jumlah yang diinput.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <Input
                    label="Tanggal transfer *"
                    type="date"
                    value={payTransferDate}
                    onChange={(e) => setPayTransferDate(e.target.value)}
                  />
                  <Input
                    label="Jam transfer *"
                    type="time"
                    step={1}
                    value={payTransferTime}
                    onChange={(e) => setPayTransferTime(e.target.value)}
                  />
                  <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                    Tanggal dan jam transfer (termasuk detik bila ada di bukti) harus sesuai yang tertera di bukti transfer.
                  </p>
                  <div>
                    <Input
                      label="Upload bukti bayar *"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                      className="file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">Bukti transfer (foto/screenshot/PDF). Pembayaran otomatis terverifikasi.</p>
                  </div>
                </>
              )}
              {paymentMethod === 'bank' && (
                <>
                  {paymentBankAccountsSplit.isDual && (
                    <p className="text-sm text-slate-700 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5 leading-relaxed">
                      Pesanan ini memuat <strong>siskopatuh</strong> bersama produk lain. Lakukan <strong>dua transfer terpisah</strong>: satu ke rekening untuk produk lain, dan satu ke <strong>Bank Mandiri / Nabiela</strong> khusus siskopatuh. Isi data pengirim dan penerima serta unggah bukti untuk masing-masing transfer.
                    </p>
                  )}
                  {!paymentBankAccountsSplit.isDual ? (
                    <>
                      <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <p className="text-sm font-medium text-slate-700">Bank pengirim (asal transfer)</p>
                        <Autocomplete
                          label="Nama bank pengirim *"
                          value={payBankId}
                          onChange={(v) => setPayBankId(v || '')}
                          options={paymentBanks.map((b) => ({ value: b.id, label: b.name }))}
                          placeholder="Pilih bank pengirim..."
                          emptyLabel="Pilih bank"
                        />
                        <Input
                          label="Nama rekening pengirim *"
                          type="text"
                          value={paySenderAccountName}
                          onChange={(e) => setPaySenderAccountName(e.target.value)}
                          placeholder="Nama pemilik rekening pengirim"
                        />
                        <Input
                          label="Nomor rekening pengirim *"
                          type="text"
                          value={paySenderAccountNumber}
                          onChange={(e) => setPaySenderAccountNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder="Nomor rekening pengirim"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bank penerima (rekening tujuan — dari Data Rekening Bank)</label>
                        {!bankAccountsForPayment.length && paymentBankAccountsLoading ? (
                          <p className="text-sm text-slate-500 py-2">{CONTENT_LOADING_MESSAGE}</p>
                        ) : bankAccountsForPayment.length === 0 ? (
                          <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">Belum ada rekening bank. Konfigurasi di menu <strong>Data Rekening Bank</strong> (Accounting).</p>
                        ) : (
                          <>
                            <Autocomplete
                              label=""
                              value={String(payBankIndex >= bankAccountsForPayment.length ? 0 : payBankIndex)}
                              onChange={(v) => setPayBankIndex(parseInt(v || '0', 10))}
                              options={bankAccountsForPayment.map((b, i) => ({
                                value: String(i),
                                label: `${b.bank_name} – ${b.account_number} · ${b.name} · ${b.currency || 'IDR'}`
                              }))}
                              placeholder="Pilih rekening tujuan transfer..."
                              emptyLabel="Pilih rekening"
                            />
                            {bankAccountsForPayment[payBankIndex >= bankAccountsForPayment.length ? 0 : payBankIndex] && (
                              <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                                <p className="font-medium">{bankAccountsForPayment[payBankIndex >= bankAccountsForPayment.length ? 0 : payBankIndex].bank_name}</p>
                                <p className="font-mono text-slate-600">No. Rekening: {bankAccountsForPayment[payBankIndex >= bankAccountsForPayment.length ? 0 : payBankIndex].account_number}</p>
                                <p className="text-slate-600">A.n. {bankAccountsForPayment[payBankIndex >= bankAccountsForPayment.length ? 0 : payBankIndex].name} · {bankAccountsForPayment[payBankIndex >= bankAccountsForPayment.length ? 0 : payBankIndex].currency || 'IDR'}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {parseFloat(viewInvoice?.remaining_amount || 0) > 0 && (
                        <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">Sisa tagihan: <strong><NominalDisplay amount={parseFloat(viewInvoice.remaining_amount || 0)} currency="IDR" /></strong> — jumlah bayar di bawah diisi otomatis dengan sisa (dapat diubah).</p>
                      )}
                      <Input
                        label="Jumlah bayar (IDR) *"
                        type="text"
                        value={payAmountIdr}
                        onChange={(e) => setPayAmountIdr(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                        placeholder="Contoh: 5000000"
                      />
                      <div>
                        {payAmountIdr && !isNaN(parseFloat(payAmountIdr.replace(/,/g, ''))) && (() => {
                          const inputIdr = parseFloat(payAmountIdr.replace(/,/g, ''));
                          const currentPaid = parseFloat(viewInvoice.paid_amount || 0);
                          const currentRemain = parseFloat(viewInvoice.remaining_amount || 0);
                          const newPaid = currentPaid + inputIdr;
                          const newRemain = currentRemain - inputIdr;
                          const overpay = newRemain < -0.5;
                          return (
                            <div
                              className={`mt-3 p-4 rounded-xl border space-y-2 text-sm ${
                                overpay ? 'border-red-300 bg-red-50/90' : 'border-emerald-200 bg-emerald-50/80'
                              }`}
                            >
                              <p className="font-semibold text-slate-800">Validasi pembayaran (otomatis)</p>
                              <p><span className="text-slate-600">Jumlah yang diinput:</span> <strong><NominalDisplay amount={inputIdr} currency="IDR" /></strong> ≈ <NominalDisplay amount={inputIdr / sarToIdr} currency="SAR" /> · ≈ <NominalDisplay amount={inputIdr / usdToIdr} currency="USD" /></p>
                              <p><span className="text-slate-600">Setelah pembayaran ini —</span></p>
                              <p><span className="text-slate-600">Dibayar total:</span> <strong className="text-[#0D1A63]"><NominalDisplay amount={newPaid} currency="IDR" /></strong> ≈ <NominalDisplay amount={newPaid / sarToIdr} currency="SAR" /> · ≈ <NominalDisplay amount={newPaid / usdToIdr} currency="USD" /></p>
                              <p><span className="text-slate-600">Sisa:</span> <strong className={overpay ? 'text-red-600' : newRemain <= 0 ? 'text-[#0D1A63]' : 'text-red-600'}><NominalDisplay amount={Math.max(0, newRemain)} currency="IDR" /></strong> ≈ <NominalDisplay amount={Math.max(0, newRemain) / sarToIdr} currency="SAR" /> · ≈ <NominalDisplay amount={Math.max(0, newRemain) / usdToIdr} currency="USD" /></p>
                              {overpay && (
                                <p className="text-red-700 text-sm font-medium">
                                  Jumlah pembayaran melebihi sisa tagihan. Pembayaran tidak dapat disimpan; kurangi jumlah yang diinput.
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <Input
                        label="Tanggal transfer *"
                        type="date"
                        value={payTransferDate}
                        onChange={(e) => setPayTransferDate(e.target.value)}
                      />
                      <Input
                        label="Jam transfer *"
                        type="time"
                        step={1}
                        value={payTransferTime}
                        onChange={(e) => setPayTransferTime(e.target.value)}
                      />
                      <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                        Tanggal dan jam transfer (termasuk detik bila ada di bukti) harus sesuai yang tertera di bukti transfer.
                      </p>
                      <Input
                        label="Upload bukti bayar *"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                        className="file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm"
                      />
                    </>
                  ) : (
                    <>
                      {!bankAccountsForPayment.length && paymentBankAccountsLoading ? (
                        <p className="text-sm text-slate-500 py-2">{CONTENT_LOADING_MESSAGE}</p>
                      ) : bankAccountsForPayment.length === 0 ? (
                        <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">Belum ada rekening bank. Konfigurasi di menu <strong>Data Rekening Bank</strong> (Accounting).</p>
                      ) : (
                        <>
                          {parseFloat(viewInvoice?.remaining_amount || 0) > 0 && (
                            <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                              Sisa tagihan: <strong><NominalDisplay amount={parseFloat(viewInvoice.remaining_amount || 0)} currency="IDR" /></strong> — total kedua jumlah di bawah diisi otomatis sesuai pembagian (dapat diubah; jumlah keduanya tidak boleh melebihi sisa).
                            </p>
                          )}
                          {/* Transfer 1: produk lain */}
                          <div className="rounded-xl border-2 border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                            <p className="text-sm font-semibold text-[#0D1A63]">1. Produk selain siskopatuh</p>
                            <div className="space-y-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                              <p className="text-sm font-medium text-slate-700">Bank pengirim (asal transfer)</p>
                              <Autocomplete
                                label="Nama bank pengirim *"
                                value={payBankIdOther}
                                onChange={(v) => setPayBankIdOther(v || '')}
                                options={paymentBanks.map((b) => ({ value: b.id, label: b.name }))}
                                placeholder="Pilih bank pengirim..."
                                emptyLabel="Pilih bank"
                              />
                              <Input
                                label="Nama rekening pengirim *"
                                type="text"
                                value={paySenderAccountNameOther}
                                onChange={(e) => setPaySenderAccountNameOther(e.target.value)}
                                placeholder="Nama pemilik rekening pengirim"
                              />
                              <Input
                                label="Nomor rekening pengirim *"
                                type="text"
                                value={paySenderAccountNumberOther}
                                onChange={(e) => setPaySenderAccountNumberOther(e.target.value.replace(/\D/g, ''))}
                                placeholder="Nomor rekening pengirim"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Bank penerima (rekening tujuan — produk lain)</label>
                              <Autocomplete
                                label=""
                                value={String(
                                  payBankIndexOther >= paymentBankAccountsSplit.others.length ? 0 : payBankIndexOther
                                )}
                                onChange={(v) => setPayBankIndexOther(parseInt(v || '0', 10))}
                                options={paymentBankAccountsSplit.others.map((b, i) => ({
                                  value: String(i),
                                  label: `${b.bank_name} – ${b.account_number} · ${b.name} · ${b.currency || 'IDR'}`
                                }))}
                                placeholder="Pilih rekening tujuan..."
                                emptyLabel="Pilih rekening"
                              />
                              {paymentBankAccountsSplit.others[
                                payBankIndexOther >= paymentBankAccountsSplit.others.length ? 0 : payBankIndexOther
                              ] && (
                                <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                                  <p className="font-medium">
                                    {paymentBankAccountsSplit.others[payBankIndexOther >= paymentBankAccountsSplit.others.length ? 0 : payBankIndexOther].bank_name}
                                  </p>
                                  <p className="font-mono text-slate-600">
                                    No. Rekening:{' '}
                                    {paymentBankAccountsSplit.others[payBankIndexOther >= paymentBankAccountsSplit.others.length ? 0 : payBankIndexOther].account_number}
                                  </p>
                                  <p className="text-slate-600">
                                    A.n.{' '}
                                    {paymentBankAccountsSplit.others[payBankIndexOther >= paymentBankAccountsSplit.others.length ? 0 : payBankIndexOther].name} ·{' '}
                                    {paymentBankAccountsSplit.others[payBankIndexOther >= paymentBankAccountsSplit.others.length ? 0 : payBankIndexOther].currency || 'IDR'}
                                  </p>
                                </div>
                              )}
                            </div>
                            <Input
                              label="Jumlah bayar transfer ini (IDR) *"
                              type="text"
                              value={payAmountIdrOther}
                              onChange={(e) => setPayAmountIdrOther(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                              placeholder="Contoh: 5000000"
                            />
                            <Input
                              label="Upload bukti transfer ini *"
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => setPayFileOther(e.target.files?.[0] || null)}
                              className="file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm"
                            />
                          </div>
                          {/* Transfer 2: siskopatuh / Nabiela */}
                          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/30 p-4 space-y-3 shadow-sm">
                            <p className="text-sm font-semibold text-emerald-900">2. Siskopatuh — rekening Mandiri / Nabiela</p>
                            <div className="space-y-3 p-3 rounded-lg border border-emerald-100 bg-white/80">
                              <p className="text-sm font-medium text-slate-700">Bank pengirim (asal transfer)</p>
                              <Autocomplete
                                label="Nama bank pengirim *"
                                value={payBankIdNabiela}
                                onChange={(v) => setPayBankIdNabiela(v || '')}
                                options={paymentBanks.map((b) => ({ value: b.id, label: b.name }))}
                                placeholder="Pilih bank pengirim..."
                                emptyLabel="Pilih bank"
                              />
                              <Input
                                label="Nama rekening pengirim *"
                                type="text"
                                value={paySenderAccountNameNabiela}
                                onChange={(e) => setPaySenderAccountNameNabiela(e.target.value)}
                                placeholder="Nama pemilik rekening pengirim"
                              />
                              <Input
                                label="Nomor rekening pengirim *"
                                type="text"
                                value={paySenderAccountNumberNabiela}
                                onChange={(e) => setPaySenderAccountNumberNabiela(e.target.value.replace(/\D/g, ''))}
                                placeholder="Nomor rekening pengirim"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Bank penerima (rekening tujuan — siskopatuh)</label>
                              <Autocomplete
                                label=""
                                value={String(
                                  payBankIndexNabiela >= paymentBankAccountsSplit.nabiela.length ? 0 : payBankIndexNabiela
                                )}
                                onChange={(v) => setPayBankIndexNabiela(parseInt(v || '0', 10))}
                                options={paymentBankAccountsSplit.nabiela.map((b, i) => ({
                                  value: String(i),
                                  label: `${b.bank_name} – ${b.account_number} · ${b.name} · ${b.currency || 'IDR'}`
                                }))}
                                placeholder="Pilih rekening Nabiela..."
                                emptyLabel="Pilih rekening"
                              />
                              {paymentBankAccountsSplit.nabiela[
                                payBankIndexNabiela >= paymentBankAccountsSplit.nabiela.length ? 0 : payBankIndexNabiela
                              ] && (
                                <div className="mt-2 p-3 rounded-lg bg-white border border-emerald-200 text-sm text-slate-700">
                                  <p className="font-medium">
                                    {paymentBankAccountsSplit.nabiela[payBankIndexNabiela >= paymentBankAccountsSplit.nabiela.length ? 0 : payBankIndexNabiela].bank_name}
                                  </p>
                                  <p className="font-mono text-slate-600">
                                    No. Rekening:{' '}
                                    {paymentBankAccountsSplit.nabiela[payBankIndexNabiela >= paymentBankAccountsSplit.nabiela.length ? 0 : payBankIndexNabiela].account_number}
                                  </p>
                                  <p className="text-slate-600">
                                    A.n.{' '}
                                    {paymentBankAccountsSplit.nabiela[payBankIndexNabiela >= paymentBankAccountsSplit.nabiela.length ? 0 : payBankIndexNabiela].name} ·{' '}
                                    {paymentBankAccountsSplit.nabiela[payBankIndexNabiela >= paymentBankAccountsSplit.nabiela.length ? 0 : payBankIndexNabiela].currency || 'IDR'}
                                  </p>
                                </div>
                              )}
                            </div>
                            <Input
                              label="Jumlah bayar transfer ini (IDR) *"
                              type="text"
                              value={payAmountIdrNabiela}
                              onChange={(e) => setPayAmountIdrNabiela(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                              placeholder="Contoh: 5000000"
                            />
                            <Input
                              label="Upload bukti transfer ini *"
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => setPayFileNabiela(e.target.files?.[0] || null)}
                              className="file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm"
                            />
                          </div>
                          {payAmountIdrOther &&
                            payAmountIdrNabiela &&
                            !isNaN(parseFloat(payAmountIdrOther.replace(/,/g, ''))) &&
                            !isNaN(parseFloat(payAmountIdrNabiela.replace(/,/g, ''))) &&
                            (() => {
                              const a = parseFloat(payAmountIdrOther.replace(/,/g, ''));
                              const b = parseFloat(payAmountIdrNabiela.replace(/,/g, ''));
                              const totalIn = a + b;
                              const currentPaid = parseFloat(viewInvoice.paid_amount || 0);
                              const currentRemain = parseFloat(viewInvoice.remaining_amount || 0);
                              const newPaid = currentPaid + totalIn;
                              const newRemain = currentRemain - totalIn;
                              const overpay = newRemain < -0.5;
                              return (
                                <div
                                  className={`p-4 rounded-xl border space-y-2 text-sm ${
                                    overpay ? 'border-red-300 bg-red-50/90' : 'border-emerald-200 bg-emerald-50/80'
                                  }`}
                                >
                                  <p className="font-semibold text-slate-800">Ringkasan kedua transfer</p>
                                  <p>
                                    <span className="text-slate-600">Total yang diinput:</span>{' '}
                                    <strong>
                                      <NominalDisplay amount={totalIn} currency="IDR" />
                                    </strong>
                                  </p>
                                  <p>
                                    <span className="text-slate-600">Setelah keduanya tercatat — dibayar total:</span>{' '}
                                    <strong className="text-[#0D1A63]">
                                      <NominalDisplay amount={newPaid} currency="IDR" />
                                    </strong>
                                  </p>
                                  <p>
                                    <span className="text-slate-600">Perkiraan sisa:</span>{' '}
                                    <strong className={overpay ? 'text-red-600' : newRemain <= 0 ? 'text-[#0D1A63]' : 'text-red-600'}>
                                      <NominalDisplay amount={Math.max(0, newRemain)} currency="IDR" />
                                    </strong>
                                  </p>
                                  {overpay && (
                                    <p className="text-red-700 text-sm font-medium">
                                      Total kedua transfer melebihi sisa tagihan. Pembayaran tidak dapat disimpan; sesuaikan jumlah salah satu transfer.
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          <Input
                            label="Tanggal transfer *"
                            type="date"
                            value={payTransferDate}
                            onChange={(e) => setPayTransferDate(e.target.value)}
                          />
                          <Input
                            label="Jam transfer *"
                            type="time"
                            step={1}
                            value={payTransferTime}
                            onChange={(e) => setPayTransferTime(e.target.value)}
                          />
                          <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                            Tanggal dan jam transfer (termasuk detik bila ada di bukti) harus sesuai yang tertera di bukti transfer.
                          </p>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
              {paymentMethod === 'va' && (
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#0D1A63]/10 flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-[#0D1A63]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-semibold text-slate-800 mb-1">Virtual Account</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Pembayaran via Virtual Account akan tampil di sini setelah nomor VA dikonfigurasi.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Sementara ini gunakan</span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D1A63]">
                          <CreditCard className="w-4 h-4" />
                          Transfer Bank
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {paymentMethod === 'qris' && (
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <QrCode className="w-7 h-7 text-emerald-600" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-semibold text-slate-800 mb-1">QRIS</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Masukkan jumlah yang ingin dibayar, lalu QR code akan tampil (integrasi payment gateway).
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Sementara ini gunakan</span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D1A63]">
                          <CreditCard className="w-4 h-4" />
                          Transfer Bank
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowPaymentModal(false)} disabled={paySubmitting}>Batal</Button>
              <Button
                variant="primary"
                onClick={handleSubmitPayment}
                disabled={
                  paySubmitting ||
                  (paymentMethod === 'saudi' && isInvoiceSaudi && paySaudiExceedsRemaining) ||
                  (paymentMethod === 'bank' &&
                    (paymentBankAccountsSplit.isDual
                      ? bankAccountsForPayment.length === 0 ||
                        payBankDualExceedsRemaining ||
                        !payBankIdOther?.trim() ||
                        !paySenderAccountNameOther?.trim() ||
                        !paySenderAccountNumberOther?.trim() ||
                        !payBankIdNabiela?.trim() ||
                        !paySenderAccountNameNabiela?.trim() ||
                        !paySenderAccountNumberNabiela?.trim()
                      : bankAccountsForPayment.length === 0 ||
                        payBankSingleExceedsRemaining ||
                        !payBankId?.trim() ||
                        !paySenderAccountName?.trim() ||
                        !paySenderAccountNumber?.trim()))
                }
              >
                {paySubmitting
                  ? 'Menyimpan...'
                  : paymentMethod === 'saudi'
                    ? 'Simpan Pembayaran Saudi'
                    : paymentMethod === 'bank'
                      ? paymentBankAccountsSplit.isDual
                        ? 'Upload kedua bukti bayar'
                        : 'Upload Bukti Bayar'
                      : 'Lanjut'}
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default OrdersInvoicesPage;
