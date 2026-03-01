import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Receipt, Download, Check, X, Unlock, Eye, FileText, ChevronLeft, ChevronRight,
  CreditCard, DollarSign, Package, Wallet, Plus, Edit, Trash2, FileSpreadsheet, LayoutGrid, ExternalLink, Upload, Link as LinkIcon, ArrowRightLeft, ClipboardList, Send, Pencil, Plane, Clock, CheckCircle, Building2, QrCode, ArrowRight
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { DashboardFilterBar, PageFilter, ActionsMenu, AutoRefreshControl, PageHeader, FilterIconButton, StatCard, CardSectionHeader, Input, Textarea, Autocomplete, Modal, ModalHeader, ModalBody, ModalFooter, ModalBox, ModalBoxLg } from '../../../components/common';
import Table from '../../../components/common/Table';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import type { TableColumn } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { formatIDR, formatSAR, formatUSD, formatInvoiceDisplay } from '../../../utils';
import { INVOICE_STATUS_LABELS, API_BASE_URL } from '../../../utils/constants';
import { invoicesApi, branchesApi, businessRulesApi, ownersApi, ordersApi, hotelApi, accountingApi, type InvoicesSummaryData, type BankAccountItem } from '../../../services/api';

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
  overdue: { icon: <Clock className="w-5 h-5" /> },
  refunded: { icon: <Receipt className="w-5 h-5" /> },
  overpaid: { icon: <DollarSign className="w-5 h-5" /> }
};

/** Urutan tampilan card Per Status Invoice (status utama dulu). Status utama selalu ditampilkan sebagai card. */
const PER_STATUS_ORDER = ['tentative', 'partial_paid', 'paid', 'processing', 'completed', 'canceled', 'cancelled', 'overdue', 'draft', 'refunded', 'order_updated', 'overpaid', 'overpaid_transferred', 'overpaid_received', 'refund_canceled', 'overpaid_refund_pending'];
/** Status yang selalu ditampilkan di card (meskipun count 0): Tagihan DP, Pembayaran DP, Lunas, Processing, Completed, Dibatalkan */
const PER_STATUS_ALWAYS_SHOW = ['tentative', 'partial_paid', 'paid', 'processing', 'completed', 'canceled'];

/** Base URL untuk file uploads (supaya foto bukti bayar tampil; pakai origin saat proxy) */
const UPLOAD_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');

/** URL file untuk preview/download (uploads) */
const getFileUrl = (path: string) => {
  if (!path || path === 'issued-saudi') return null;
  if (path.startsWith('http')) return path;
  const base = UPLOAD_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
};

/**
 * Order & Invoice - Satu halaman untuk semua role yang mengerjakan order/invoice:
 * owner, invoice_koordinator, role_invoice_saudi, role_hotel (pekerjaan hotel), admin pusat/cabang, accounting, dll. (role_invoice dihapus — pakai invoice_koordinator.)
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
  const canOrderAction = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'role_invoice_saudi';
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
  const [showFilters, setShowFilters] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'invoice' | 'payments' | 'progress'>('invoice');
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [summary, setSummary] = useState<InvoicesSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [exportingInvoicesExcel, setExportingInvoicesExcel] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'va' | 'qris' | 'saudi'>('bank');
  const [payAmountIdr, setPayAmountIdr] = useState<string>('');
  const [payTransferDate, setPayTransferDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payBankIndex, setPayBankIndex] = useState<number>(0);
  const [payFile, setPayFile] = useState<File | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payCurrencySaudi, setPayCurrencySaudi] = useState<'SAR' | 'USD'>('SAR');
  const [payAmountSaudi, setPayAmountSaudi] = useState<string>('');
  const [uploadingJamaahItemId, setUploadingJamaahItemId] = useState<string | null>(null);
  const [jamaahLinkInput, setJamaahLinkInput] = useState<Record<string, string>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetInv, setCancelTargetInv] = useState<any | null>(null);
  const [cancelAction, setCancelAction] = useState<'to_balance' | 'refund'>('to_balance');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBankName, setCancelBankName] = useState('');
  const [cancelAccountNumber, setCancelAccountNumber] = useState('');
  const [ownerBalance, setOwnerBalance] = useState<number | null>(null);
  const [ownerBalanceLoading, setOwnerBalanceLoading] = useState(false);
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
  const [draftOrders, setDraftOrders] = useState<any[]>([]);
  const [publishingDraftOrderId, setPublishingDraftOrderId] = useState<string | null>(null);
  const [uploadDocInvoice, setUploadDocInvoice] = useState<any | null>(null);
  const [uploadDocTab, setUploadDocTab] = useState<'hotel' | 'visa' | 'ticket'>('hotel');
  const [uploadDocLoading, setUploadDocLoading] = useState(false);

  const isAdminPusat = user?.role === 'admin_pusat';
  const canReallocate = ['owner', 'invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'admin_koordinator', 'super_admin'].includes(user?.role || '');
  const isAccounting = user?.role === 'role_accounting';
  const isInvoiceSaudi = user?.role === 'role_invoice_saudi';
  const isDraftRow = (inv: any) => inv?.status === 'draft' || inv?.is_draft_order;
  const canPayInvoice = (inv: any) => {
    if (!inv || isDraftRow(inv) || parseFloat(inv.remaining_amount || 0) <= 0) return false;
    return inv.owner_id === user?.id || ['invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'super_admin'].includes(user?.role || '');
  };

  const fetchBranches = async () => {
    if (!isAdminPusat && !isAccounting && !isInvoiceSaudi) return;
    try {
      const res = await branchesApi.list({ limit: 500, page: 1 });
      if (res.data.success) setBranches(res.data.data || []);
    } catch {
      setBranches([]);
    }
  };

  useEffect(() => {
    if (isAdminPusat || isAccounting || isInvoiceSaudi) {
      branchesApi.listWilayah().then((r) => { if (r.data.success) setWilayahList(r.data.data || []); }).catch(() => {});
      branchesApi.listProvinces().then((r) => { if (r.data.success) setProvinces(r.data.data || []); }).catch(() => {});
    }
  }, [isAdminPusat, isAccounting, isInvoiceSaudi]);

  const fetchOwners = async () => {
    if (!isAdminPusat && !isAccounting && !isInvoiceSaudi) return; // GET /owners untuk admin/accounting/invoice Saudi
    try {
      const params: { branch_id?: string } = {};
      if (branchId) params.branch_id = branchId;
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
        if (hasHotel) setUploadDocTab('hotel');
        else if (hasVisa) setUploadDocTab('visa');
        else if (hasTicket) setUploadDocTab('ticket');
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
    setCancelTargetInv(inv);
    setCancelAction('to_balance');
    setCancelReason('');
    setCancelBankName('');
    setCancelAccountNumber('');
    setShowCancelModal(true);
  };

  const fetchOwnerBalance = useCallback(() => {
    if (user?.role !== 'owner') return;
    setOwnerBalanceLoading(true);
    ownersApi.getMyBalance()
      .then((res) => { if (res.data?.success && res.data?.data) setOwnerBalance(res.data.data.balance); })
      .catch(() => setOwnerBalance(null))
      .finally(() => setOwnerBalanceLoading(false));
  }, [user?.role]);

  const handleTerbitkanDraft = async (inv: any) => {
    if (!inv?.order_id || !isDraftRow(inv)) return;
    setPublishingDraftOrderId(inv.order_id);
    try {
      await invoicesApi.create({ order_id: inv.order_id });
      showToast('Invoice diterbitkan. Pembayaran dapat dilakukan sekarang.', 'success');
      fetchInvoices();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal menerbitkan invoice', 'error');
    } finally {
      setPublishingDraftOrderId(null);
    }
  };

  const handleDeleteOrder = async (inv: any) => {
    if (!canOrderAction || !inv?.order_id) return;
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
      showToast(e.response?.data?.message || 'Gagal membatalkan order', 'error');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const submitCancelModal = async () => {
    if (!cancelTargetInv?.order_id) return;
    const paid = parseFloat(cancelTargetInv.paid_amount) || 0;
    if (paid > 0 && cancelAction === 'refund' && (!cancelBankName.trim() || !cancelAccountNumber.trim())) {
      showToast('Untuk refund wajib isi Nama Bank dan Nomor Rekening', 'error');
      return;
    }
    setDeletingOrderId(cancelTargetInv.order_id);
    try {
      const body: { action?: 'to_balance' | 'refund'; reason?: string; bank_name?: string; account_number?: string } = {};
      if (paid > 0) {
        body.action = cancelAction;
        if (cancelReason.trim()) body.reason = cancelReason.trim();
        if (cancelAction === 'refund') {
          body.bank_name = cancelBankName.trim();
          body.account_number = cancelAccountNumber.trim();
        }
      }
      const res = await ordersApi.delete(cancelTargetInv.order_id, body);
      const msg = (res.data as any)?.message || 'Order dibatalkan.';
      showToast(msg, 'success');
      setShowCancelModal(false);
      setCancelTargetInv(null);
      setCancelReason('');
      setCancelBankName('');
      setCancelAccountNumber('');
      fetchInvoices();
      if (viewInvoice?.id === cancelTargetInv.id) setViewInvoice(null);
      if (user?.role === 'owner') fetchOwnerBalance();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal membatalkan order', 'error');
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
    fetchBranches();
    fetchCurrencyRates();
  }, [isAdminPusat, isAccounting, isInvoiceSaudi]);

  useEffect(() => {
    if (isAdminPusat || isAccounting || isInvoiceSaudi) fetchOwners();
  }, [isAdminPusat, isAccounting, isInvoiceSaudi, branchId]);

  useEffect(() => {
    setPage(1);
  }, [branchId, wilayahId, provinsiId, limit, filterStatus, filterOwnerId, filterInvoiceNumber, filterDateFrom, filterDateTo, filterDueStatus, sortBy, sortOrder]);

  useEffect(() => {
    fetchInvoices();
  }, [branchId, wilayahId, provinsiId, isAdminPusat, isAccounting, page, limit, filterStatus, filterOwnerId, filterInvoiceNumber, filterDateFrom, filterDateTo, filterDueStatus, sortBy, sortOrder]);

  useEffect(() => {
    if ((location.state as { refreshList?: boolean })?.refreshList) {
      fetchInvoices();
      fetchSummary();
      if (viewInvoice?.id) fetchInvoiceDetail(viewInvoice.id);
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    fetchSummary();
  }, [branchId, wilayahId, provinsiId, filterStatus, filterOwnerId, filterInvoiceNumber, filterDateFrom, filterDateTo, filterDueStatus]);

  useEffect(() => {
    if (user?.role === 'owner') fetchOwnerBalance();
  }, [user?.role, fetchOwnerBalance]);

  useEffect(() => {
    if (viewInvoice && user?.role === 'owner') fetchOwnerBalance();
  }, [viewInvoice?.id, user?.role, fetchOwnerBalance]);

  const summaryFromTable = (() => {
    if (invoices.length === 0) return null;
    const total_amount = invoices.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    const total_paid = invoices.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0);
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
    if (showPaymentModal) {
      setPaymentBankAccountsLoading(true);
      accountingApi.getBankAccounts({ is_active: 'true' })
        .then((r) => { if (r.data?.success && Array.isArray(r.data.data)) setPaymentBankAccounts(r.data.data); else setPaymentBankAccounts([]); })
        .catch(() => setPaymentBankAccounts([]))
        .finally(() => setPaymentBankAccountsLoading(false));
    }
  }, [showPaymentModal]);

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
      showToast(verified ? 'Pembayaran dikonfirmasi' : 'Pembayaran ditolak', 'success');
      if (res.data?.success && res.data?.data) {
        const updated = res.data.data;
        setViewInvoice(updated);
        setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: updated.status, paid_amount: updated.paid_amount, remaining_amount: updated.remaining_amount, PaymentProofs: updated.PaymentProofs || inv.PaymentProofs } : inv)));
      }
      fetchInvoices();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal', 'error');
    } finally {
      setVerifyingId(null);
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
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Gagal unduh PDF', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
      paid: 'success', partial_paid: 'warning', tentative: 'default', draft: 'info', confirmed: 'info',
      processing: 'info', completed: 'success', overdue: 'error', canceled: 'error', cancelled: 'error',
      refunded: 'default', order_updated: 'warning', overpaid: 'warning', overpaid_transferred: 'info',
      overpaid_received: 'info', refund_canceled: 'error', overpaid_refund_pending: 'warning'
    };
    return (map[status] || 'default') as 'success' | 'warning' | 'info' | 'error' | 'default';
  };

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
  const formatDateWithTime = (d: string | null | undefined, time: string | null | undefined) => {
    const dateStr = formatDate(d ?? null);
    if (dateStr === '-') return '–';
    const t = (time || '').trim();
    return t ? `${dateStr}, ${t}` : `${dateStr}, –`;
  };

  const VISA_STATUS_LABELS: Record<string, string> = { document_received: 'Dokumen diterima', submitted: 'Dikirim', in_process: 'Diproses', approved: 'Disetujui', issued: 'Terbit' };
  const TICKET_STATUS_LABELS: Record<string, string> = { pending: 'Menunggu', data_received: 'Data diterima', seat_reserved: 'Kursi reserved', booking: 'Booking', payment_airline: 'Bayar maskapai', ticket_issued: 'Tiket terbit' };
  const HOTEL_STATUS_LABELS: Record<string, string> = { waiting_confirmation: 'Menunggu konfirmasi', confirmed: 'Dikonfirmasi', room_assigned: 'Kamar ditetapkan', completed: 'Selesai' };
  const BUS_TICKET_LABELS: Record<string, string> = { pending: 'Pending', issued: 'Terbit' };
  const ROOM_TYPE_LABELS: Record<string, string> = { single: 'Single', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };

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

  const canUnblock = (inv: any) =>
    inv?.is_blocked && ['invoice_koordinator', 'role_invoice_saudi', 'admin_pusat', 'super_admin', 'role_accounting'].includes(user?.role || '');

  // Hanya karyawan (bukan owner) yang boleh konfirmasi/tolak bukti bayar
  const canVerify = ['admin_pusat', 'admin_koordinator', 'invoice_koordinator', 'role_invoice_saudi', 'role_accounting', 'super_admin'].includes(user?.role || '');

  const rates = viewInvoice?.currency_rates || currencyRates;
  const sarToIdr = rates.SAR_TO_IDR || 4200;
  const usdToIdr = rates.USD_TO_IDR || 15500;

  const paymentProofs = viewInvoice?.PaymentProofs || [];

  /** Status bukti bayar: rejected > verified > pending. Pembayaran KES (Saudi) selalu dianggap terverifikasi. */
  const getProofStatus = (p: any) => {
    if (p.verified_status === 'rejected') return { status: 'rejected', label: 'Tidak valid', variant: 'error' as const };
    if (p.payment_location === 'saudi') return { status: 'verified', label: 'Diverifikasi', variant: 'success' as const };
    if (p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')) return { status: 'verified', label: 'Diverifikasi', variant: 'success' as const };
    return { status: 'pending', label: 'Menunggu verifikasi', variant: 'warning' as const };
  };

  const getProofTypeLabel = (type: string) => (type === 'dp' ? 'DP' : type === 'partial' ? 'Cicilan' : 'Lunas');
  /** Tampilkan Bukti Bayar: DP Transfer / Cicilan Transfer / Lunas Transfer atau DP KES / Cicilan KES / Lunas KES */
  const getProofDisplayLabel = (p: any) => {
    const typeLabel = getProofTypeLabel(p.payment_type);
    const channel = p.payment_location === 'saudi' ? 'KES' : 'Transfer';
    return `${typeLabel} ${channel}`;
  };

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
        Memuat...
      </div>
    );
  };


  // Daftar rekening untuk pembayaran: dari detail invoice (getById, BE isi dari accounting) atau fallback dari API accounting
  const bankAccountsForPayment: BankAccountItem[] =
    viewInvoice?.bank_accounts?.length > 0
      ? (viewInvoice.bank_accounts as BankAccountItem[])
      : paymentBankAccounts;

  const openPaymentModal = async () => {
    setPayAmountIdr('');
    setPayAmountSaudi('');
    setPayTransferDate(new Date().toISOString().slice(0, 10));
    setPayBankIndex(0);
    setPayFile(null);
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
        showToast('Masukkan jumlah pembayaran (SAR/USD) yang valid.', 'warning');
        return;
      }
      const paymentType = parseFloat(viewInvoice.paid_amount || 0) === 0 ? 'dp' : (amountS >= 1e9 ? 'full' : 'partial');
      const form = new FormData();
      form.append('payment_location', 'saudi');
      form.append('payment_currency', payCurrencySaudi);
      form.append('amount', String(amountS));
      form.append('payment_type', paymentType);
      form.append('transfer_date', payTransferDate);
      if (payFile) form.append('proof_file', payFile);
      setPaySubmitting(true);
      try {
        const res = await invoicesApi.uploadPaymentProof(viewInvoice.id, form);
        showToast('Pembayaran KES dicatat dan otomatis terverifikasi. Invoice dan order telah diupdate.', 'success');
        setShowPaymentModal(false);
        if (res.data?.invoice) setViewInvoice(res.data.invoice);
        else {
          const detailRes = await invoicesApi.getById(viewInvoice.id);
          if (detailRes.data?.success && detailRes.data?.data) setViewInvoice(detailRes.data.data);
        }
        fetchInvoices();
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Gagal input pembayaran Saudi', 'error');
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
    if (amount > remaining) {
      showToast(`Jumlah melebihi sisa tagihan (${formatIDR(remaining)}).`, 'warning');
      return;
    }
    if (paymentMethod === 'bank') {
      if (!payFile) {
        showToast('Upload bukti transfer wajib untuk metode Transfer Bank.', 'warning');
        return;
      }
      if (!bankAccountsForPayment.length || payBankIndex < 0 || payBankIndex >= bankAccountsForPayment.length) {
        showToast('Pilih rekening tujuan transfer.', 'warning');
        return;
      }
      const bank = bankAccountsForPayment[payBankIndex];
      const paymentType = parseFloat(viewInvoice.paid_amount || 0) === 0 ? 'dp' : (amount >= remaining ? 'full' : 'partial');
      const form = new FormData();
      form.append('amount', String(Math.round(amount)));
      form.append('payment_type', paymentType);
      form.append('transfer_date', payTransferDate);
      if (bank?.bank_name) form.append('bank_name', bank.bank_name);
      if (bank?.account_number) form.append('account_number', bank.account_number);
      if (bank?.name) form.append('account_name', bank.name);
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

  const sarToIdrList = currencyRates.SAR_TO_IDR || 4200;
  const usdToIdrList = currencyRates.USD_TO_IDR || 15500;
  const amountTriple = (idr: number) => ({ idr, sar: idr / sarToIdrList, usd: idr / usdToIdrList });

  const invoiceTableColumns: TableColumn[] = [
    { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'company', label: 'Perusahaan', align: 'left' },
    { id: 'wilayah', label: 'Wilayah', align: 'left' },
    { id: 'total', label: 'Total (IDR·SAR·USD)', align: 'right' },
    { id: 'paid', label: 'Dibayar (IDR·SAR·USD)', align: 'right' },
    { id: 'remaining', label: 'Sisa (IDR·SAR·USD)', align: 'right' },
    { id: 'status', label: 'Status Invoice', align: 'left' },
    { id: 'status_visa', label: 'Status Visa', align: 'left' },
    { id: 'status_ticket', label: 'Status Tiket', align: 'left' },
    { id: 'status_hotel', label: 'Status Hotel', align: 'left' },
    { id: 'status_bus', label: 'Status Bus', align: 'left' },
    { id: 'proof', label: 'Bukti Bayar', align: 'left' },
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

  const invoiceSubtitle = user?.role === 'role_hotel' ? 'Pekerjaan hotel: daftar order yang berisi item hotel. Buka invoice untuk update status & nomor kamar.' : user?.role === 'role_bus' ? 'Pekerjaan bus: daftar order yang berisi item bus. Buka invoice untuk detail.' : (isAdminPusat || isAccounting) ? 'Semua invoice dalam satu daftar.' : isInvoiceSaudi ? 'Semua invoice seluruh wilayah. Input pembayaran SAR/USD (Saudi) otomatis update invoice.' : (user?.role === 'owner' ? 'Invoice Anda.' : 'Invoice cabang Anda.');

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
          {canReallocate && (
            <Button variant="outline" onClick={() => {
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
            }} className="shrink-0">
              <ArrowRightLeft className="w-5 h-5 mr-2" /> Pemindahan Dana
            </Button>
          )}
          {canOrderAction && (
            <Button variant="primary" onClick={() => navigate('/dashboard/orders/new')} className="shrink-0">
              <Plus className="w-5 h-5 mr-2" /> Tambah Invoice
            </Button>
          )}
        </>
      }
      />

      {/* Baris filter full width - posisi tetap, tidak berpindah */}
      <PageFilter
        open={showFilters}
        onToggle={() => setShowFilters((v) => !v)}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        onApply={() => { setPage(1); fetchInvoices(); }}
        loading={loading}
        applyLabel="Terapkan"
        resetLabel="Reset"
        hideToggleRow
        className="w-full"
      >
        <DashboardFilterBar
            variant="page"
            loading={loading}
            showWilayah={isAdminPusat || isAccounting || isInvoiceSaudi}
            showProvinsi={isAdminPusat || isAccounting || isInvoiceSaudi}
            showBranch={isAdminPusat || isAccounting || isInvoiceSaudi}
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
            showReset
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
            onWilayahChange={setWilayahId}
            onProvinsiChange={setProvinsiId}
            onBranchChange={setBranchId}
            onStatusChange={setFilterStatus}
            onOwnerChange={setFilterOwnerId}
            onDateFromChange={setFilterDateFrom}
            onDateToChange={setFilterDateTo}
            onDueStatusChange={setFilterDueStatus}
            onApply={() => {}}
            onReset={resetFilters}
            wilayahList={wilayahList}
            provinces={provinces}
            branches={branches}
            invoiceStatusOptions={[{ value: '', label: 'Semua status' }, ...Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
            owners={owners.map((o) => ({ id: o.User?.id || (o as any).user_id || o.id, User: o.User }))}
            dueStatusOptions={[
              { value: '', label: 'Semua' },
              { value: 'current', label: 'Belum Jatuh Tempo' },
              { value: 'due', label: 'Jatuh Tempo' },
              { value: 'overdue', label: 'Terlambat' },
            ]}
          />
      </PageFilter>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Receipt className="w-5 h-5" />}
          label="Total Invoice"
          value={loadingSummary ? '...' : s.total_invoices.toLocaleString('id-ID')}
          iconClassName="bg-sky-100 text-sky-600"
        />
        <StatCard
          icon={<Package className="w-5 h-5" />}
          label="Total Trip"
          value={loadingSummary ? '...' : s.total_orders.toLocaleString('id-ID')}
          iconClassName="bg-[#0D1A63]/10 text-[#0D1A63]"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Tagihan"
          value={loadingSummary ? '...' : formatIDR(s.total_amount)}
          iconClassName="bg-slate-100 text-slate-600"
          subtitle={!loadingSummary ? `≈ ${formatSAR(s.total_amount / sarToIdrList)} · ≈ ${formatUSD(s.total_amount / usdToIdrList)}` : undefined}
        />
        <StatCard
          icon={<CreditCard className="w-5 h-5" />}
          label="Dibayar"
          value={loadingSummary ? '...' : formatIDR(s.total_paid)}
          iconClassName="bg-[#0D1A63]/10 text-[#0D1A63]"
          subtitle={!loadingSummary ? `≈ ${formatSAR(s.total_paid / sarToIdrList)} · ≈ ${formatUSD(s.total_paid / usdToIdrList)}` : undefined}
        />
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          label="Sisa"
          value={loadingSummary ? '...' : formatIDR(s.total_remaining)}
          iconClassName="bg-amber-100 text-amber-600"
          subtitle={!loadingSummary ? `≈ ${formatSAR(s.total_remaining / sarToIdrList)} · ≈ ${formatUSD(s.total_remaining / usdToIdrList)}` : undefined}
        />
      </div>

      {/* Per Status Invoice - card statistic (Tagihan DP, Pembayaran DP, Dibatalkan, dll.) */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-slate-500" /> Per Status Invoice
        </h3>
        {loadingSummary ? (
          <p className="text-slate-500 text-sm">Memuat...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {(() => {
              const keys: string[] = [...PER_STATUS_ALWAYS_SHOW];
              Object.keys(s.by_invoice_status).forEach((k) => { if (!keys.includes(k)) keys.push(k); });
              return keys
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
                    />
                  );
                });
            })()}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Memuat...</div>
      ) : (
        <Card className="travel-card rounded-2xl border-slate-200/80 shadow-sm">
          <CardSectionHeader
            icon={<Receipt className="w-6 h-6" />}
            title={`Daftar Invoice (${(pagination?.total ?? invoices.length) + draftOrders.length})`}
            subtitle="Geser horizontal jika tabel tidak muat"
            className="mb-5 px-1"
          />
          <div className="overflow-x-auto rounded-xl border border-slate-200">
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
                      {isDraftRow(inv) ? `Draft${inv.Order?.order_number ? ` (${inv.Order.order_number})` : ''}` : formatInvoiceDisplay(inv.status, inv.invoice_number, INVOICE_STATUS_LABELS)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 align-top">{inv.User?.name || inv.User?.company_name || '-'}</td>
                    <td className="py-3 px-4 text-slate-700 align-top">{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '-'}</td>
                    <td className="py-3 px-4 text-slate-600 align-top text-xs">
                      {[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 align-top">
                      <div>{formatIDR(parseFloat(inv.total_amount || 0))}</div>
                      {(() => { const t = amountTriple(parseFloat(inv.total_amount || 0)); return <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {formatSAR(t.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(t.usd, false)}</div>; })()}
                      {inv.Order?.currency_rates_override && (inv.Order.currency_rates_override.SAR_TO_IDR != null || inv.Order.currency_rates_override.USD_TO_IDR != null) && (
                        <div className="text-xs text-amber-700 mt-1 font-medium" title="Kurs & harga khusus order ini">
                          Kurs: {inv.Order.currency_rates_override.SAR_TO_IDR != null ? `SAR ${Number(inv.Order.currency_rates_override.SAR_TO_IDR).toLocaleString('id-ID')}` : ''}{inv.Order.currency_rates_override.SAR_TO_IDR != null && inv.Order.currency_rates_override.USD_TO_IDR != null ? ', ' : ''}{inv.Order.currency_rates_override.USD_TO_IDR != null ? `USD ${Number(inv.Order.currency_rates_override.USD_TO_IDR).toLocaleString('id-ID')}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-[#0D1A63] font-medium align-top">
                      {(() => {
                        const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                        const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                        const t = amountTriple(paid);
                        return <><div>{formatIDR(paid)}</div><div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {formatSAR(t.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(t.usd, false)}</div></>;
                      })()}
                    </td>
                    <td className="py-3 px-4 text-right text-red-600 font-medium align-top">
                      {(() => {
                        const totalInv = parseFloat(inv.total_amount || 0);
                        const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                        const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                        const remaining = Math.max(0, totalInv - paid);
                        const t = amountTriple(remaining);
                        return <><div>{formatIDR(remaining)}</div><div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {formatSAR(t.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(t.usd, false)}</div></>;
                      })()}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <Badge variant={getStatusBadge(inv.status)}>{INVOICE_STATUS_LABELS[inv.status] || inv.status}</Badge>
                      {inv.is_blocked && <Badge variant="error" className="ml-1">Block</Badge>}
                      {isDraftRow(inv) ? (
                        <div className="text-xs text-slate-500 mt-1">Belum diterbitkan — pembayaran belum tersedia</div>
                      ) : (() => {
                        const total = parseFloat(inv.total_amount || 0);
                        const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                        const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                        const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                        return <div className="text-xs text-slate-600 mt-1">Dibayar <strong>{pct}%</strong> dari total tagihan</div>;
                      })()}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {(() => {
                        const visaItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'visa');
                        if (visaItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                        const labels: Record<string, string> = { document_received: 'Dokumen diterima', submitted: 'Dikirim', in_process: 'Diproses', approved: 'Disetujui', issued: 'Terbit' };
                        return (
                          <div className="text-xs space-y-1.5">
                            {visaItems.map((item: any, idx: number) => {
                              const s = labels[item.VisaProgress?.status] || item.VisaProgress?.status || 'Menunggu';
                              const depDate = formatDate(item.meta?.travel_date ?? null);
                              return (
                                <div key={idx} className="flex flex-col gap-0.5">
                                  <Badge variant={s === 'Terbit' ? 'success' : 'info'} className="text-xs truncate w-fit">{s}</Badge>
                                  <span className="text-slate-500">Tgl keberangkatan: {depDate}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {(() => {
                        const ticketItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'ticket');
                        if (ticketItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                        const labels: Record<string, string> = { pending: 'Menunggu', data_received: 'Data diterima', seat_reserved: 'Kursi reserved', booking: 'Booking', payment_airline: 'Bayar maskapai', ticket_issued: 'Tiket terbit' };
                        return (
                          <div className="text-xs space-y-1.5">
                            {ticketItems.map((item: any, idx: number) => {
                              const s = labels[item.TicketProgress?.status] || item.TicketProgress?.status || 'Menunggu';
                              const depDate = formatDate(item.meta?.departure_date ?? null);
                              return (
                                <div key={idx} className="flex flex-col gap-0.5">
                                  <Badge variant={s === 'Tiket terbit' ? 'success' : 'info'} className="text-xs truncate w-fit">{s}</Badge>
                                  <span className="text-slate-500">Tgl keberangkatan: {depDate}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {(() => {
                        const hotelItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'hotel');
                        if (hotelItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                        const labels: Record<string, string> = { waiting_confirmation: 'Menunggu konfirmasi', confirmed: 'Dikonfirmasi', room_assigned: 'Kamar ditetapkan', completed: 'Selesai' };
                        const byHotel = hotelItems.reduce((acc: { key: string; name: string; status: string; checkIn: string; checkOut: string }[], item: any) => {
                          const pid = String(item.product_ref_id || item.product_id || '');
                          const name = item.Product?.name || (item as any).product_name || 'Hotel';
                          const status = labels[item.HotelProgress?.status] || item.HotelProgress?.status || 'Menunggu konfirmasi';
                          const checkIn = formatDateWithTime(item.HotelProgress?.check_in_date ?? item.meta?.check_in, item.HotelProgress?.check_in_time ?? item.meta?.check_in_time ?? '16:00');
                          const checkOut = formatDateWithTime(item.HotelProgress?.check_out_date ?? item.meta?.check_out, item.HotelProgress?.check_out_time ?? item.meta?.check_out_time ?? '12:00');
                          if (!acc.some((g) => g.key === pid)) acc.push({ key: pid, name, status, checkIn, checkOut });
                          return acc;
                        }, [] as { key: string; name: string; status: string; checkIn: string; checkOut: string }[]);
                        if (byHotel.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                        return (
                          <div className="text-xs space-y-2">
                            {byHotel.map((h: { key: string; name: string; status: string; checkIn: string; checkOut: string }, idx: number) => (
                              <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 space-y-0.5">
                                <div className="flex flex-wrap items-baseline gap-1">
                                  <span className="font-medium text-slate-800 truncate max-w-[140px]" title={h.name}>{h.name}:</span>
                                  <span className={h.status === 'Selesai' ? 'text-[#0D1A63]' : 'text-slate-600'}>{h.status}</span>
                                </div>
                                <div className="text-slate-500 pl-0.5">
                                  <span>CI {h.checkIn}</span>
                                  <span className="mx-1">·</span>
                                  <span>CO {h.checkOut}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {(() => {
                        const busItems = (inv.Order?.OrderItems || []).filter((i: any) => (i.type || i.product_type) === 'bus');
                        if (busItems.length === 0) return <span className="text-slate-400 text-xs">–</span>;
                        const labels: Record<string, string> = { pending: 'Pending', issued: 'Terbit' };
                        const statuses = busItems.map((i: any) => labels[i.BusProgress?.bus_ticket_status] || i.BusProgress?.bus_ticket_status || 'Pending');
                        return (
                          <div className="text-xs">
                            <div className="grid grid-cols-2 gap-1">
                              {statuses.map((s: string, idx: number) => (
                                <Badge key={idx} variant={s === 'Terbit' ? 'success' : 'info'} className="text-xs truncate">{s}</Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {isDraftRow(inv) ? (
                        <span className="text-slate-400 text-xs">Tidak tersedia (belum diterbitkan)</span>
                      ) : (inv.PaymentProofs?.length ?? 0) === 0 ? (
                        <span className="text-slate-400 text-xs">–</span>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 min-w-[160px]">
                          {inv.PaymentProofs?.map((p: any) => {
                            const ps = getProofStatus(p);
                            const amt = parseFloat(p.amount || 0);
                            const sar = amt / sarToIdrList;
                            const usd = amt / usdToIdrList;
                            const isKesNominal = p.payment_location === 'saudi' && p.amount_original != null && p.payment_currency && p.payment_currency !== 'IDR';
                            const statusLabel = ps.status === 'verified' ? 'Sudah konfirmasi' : ps.status === 'rejected' ? 'Ditolak' : 'Belum konfirmasi';
                            return (
                              <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-xs">
                                <div className="font-semibold text-slate-700 truncate">{getProofDisplayLabel(p)}</div>
                                <div className="text-slate-600 mt-0.5 truncate">
                                  {isKesNominal ? (
                                    <><span className="text-slate-500">Nominal:</span> {p.payment_currency === 'SAR' ? formatSAR(Number(p.amount_original)) : formatUSD(Number(p.amount_original))} = {formatIDR(amt)}</>
                                  ) : (
                                    <><span className="text-slate-500">IDR:</span> {formatIDR(amt)} · <span className="text-slate-500">SAR:</span> {formatSAR(sar, false)} · <span className="text-slate-500">USD:</span> {formatUSD(usd, false)}</>
                                  )}
                                </div>
                                {(p.bank_name || p.account_number) && p.payment_location !== 'saudi' && (
                                  <div className="text-slate-600 mt-0.5 truncate">
                                    <span className="text-slate-500">Bank:</span> {[p.bank_name, p.account_number].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                                {p.created_at && (
                                  <div className="text-slate-600 mt-0.5 truncate">
                                    <span className="text-slate-500">Tanggal upload bukti:</span> {formatDate(p.created_at)}
                                    <span className="text-slate-500"> · Jam:</span> {new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <Badge variant={ps.variant} className="text-xs">{statusLabel}</Badge>
                                  {ps.status === 'verified' && (p as any).VerifiedBy?.name && (
                                    <span className="text-slate-500 truncate">oleh {(p as any).VerifiedBy.name}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                              { id: 'pdf', label: 'Unduh PDF', icon: <FileText className="w-4 h-4" />, onClick: () => openPdf(inv.id) },
                              ...(canOrderAction && inv.order_id
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
          </div>
        </Card>
      )}

      {/* Modal Upload Dokumen – Tabs: Hotel / Visa / Tiket */}
      {uploadDocInvoice && (
        <Modal open onClose={() => !uploadDocLoading && setUploadDocInvoice(null)} zIndex={55}>
          <ModalBox className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <ModalHeader
              title="Upload dokumen"
              subtitle={uploadDocInvoice?.invoice_number || uploadDocInvoice?.Order?.order_number || ''}
              icon={<Upload className="w-5 h-5" />}
              onClose={() => !uploadDocLoading && setUploadDocInvoice(null)}
            />
            <ModalBody className="flex-1 overflow-y-auto">
            {uploadDocLoading ? (
              <div className="p-8 flex items-center justify-center">
                <p className="text-slate-500">Memuat data order…</p>
              </div>
            ) : (() => {
              const order = uploadDocInvoice.Order;
              const items = order?.OrderItems || [];
              const hotelItems = items.filter((i: any) => (i.type || i.product_type) === 'hotel');
              const visaItems = items.filter((i: any) => (i.type || i.product_type) === 'visa');
              const ticketItems = items.filter((i: any) => (i.type || i.product_type) === 'ticket');
              const hasAny = hotelItems.length > 0 || visaItems.length > 0 || ticketItems.length > 0;
              if (!hasAny) {
                return (
                  <div className="p-6">
                    <p className="text-slate-600 text-sm">Order ini tidak memiliki item hotel, visa, atau tiket. Tidak ada dokumen yang perlu diupload.</p>
                  </div>
                );
              }
              interface HotelUploadGroup { key: string; name: string; firstItem: any }
              const hotelByProduct: HotelUploadGroup[] = hotelItems.reduce(
                (acc: HotelUploadGroup[], item: any) => {
                  const pid = item.product_ref_id || item.product_id || '';
                  const name = item.Product?.name || (item as any).product_name || 'Hotel';
                  if (!acc.find((g: HotelUploadGroup) => g.key === pid)) acc.push({ key: pid, name, firstItem: item });
                  return acc;
                },
                [] as HotelUploadGroup[]
              );
              const tabs: { id: 'hotel' | 'visa' | 'ticket'; label: string; icon: React.ReactNode; count: number }[] = [
                ...(hotelByProduct.length > 0 ? [{ id: 'hotel' as const, label: 'Hotel', icon: <Package className="w-4 h-4" />, count: hotelByProduct.length }] : []),
                ...(visaItems.length > 0 ? [{ id: 'visa' as const, label: 'Visa', icon: <FileText className="w-4 h-4" />, count: visaItems.length }] : []),
                ...(ticketItems.length > 0 ? [{ id: 'ticket' as const, label: 'Tiket', icon: <Plane className="w-4 h-4" />, count: ticketItems.length }] : []),
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
                          const item = group.firstItem;
                          const hasUploaded = item.jamaah_data_type && item.jamaah_data_value;
                          const fileUrl = item.jamaah_data_type === 'link' ? item.jamaah_data_value : item.jamaah_data_value ? getFileUrl(item.jamaah_data_value) : null;
                          return (
                            <div key={group.key} className="rounded-xl border border-slate-200 bg-amber-50/30 p-4 space-y-3">
                              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <Package className="w-4 h-4 text-amber-600" /> {group.name}
                              </h3>
                              {hasUploaded && (
                                <div className="rounded-lg bg-white/80 border border-amber-200/60 p-3">
                                  <p className="text-xs font-medium text-slate-600 mb-1.5">Dokumen terunggah</p>
                                  {item.jamaah_data_type === 'link' ? (
                                    <a href={item.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5">
                                      <LinkIcon className="w-4 h-4" /> Buka link
                                    </a>
                                  ) : fileUrl ? (
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5">
                                      <Download className="w-4 h-4" /> Unduh file
                                    </a>
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
                                        setUploadingJamaahItemId(group.firstItem.id);
                                        try {
                                          await handleUploadJamaahData(uploadDocInvoice.order_id, group.firstItem.id, f, '');
                                          showToast('Paket info hotel berhasil diupload', 'success');
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
                                  {uploadingJamaahItemId === group.firstItem.id && <span className="text-xs text-slate-500">Mengunggah…</span>}
                                </div>
                              </label>
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
                          const fileUrl = item.jamaah_data_type === 'link' ? item.jamaah_data_value : item.jamaah_data_value ? getFileUrl(item.jamaah_data_value) : null;
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
                                  ) : fileUrl ? (
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5">
                                      <Download className="w-4 h-4" /> Unduh file
                                    </a>
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
                                  ) : fileUrl ? (
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1.5">
                                      <Download className="w-4 h-4" /> Unduh file
                                    </a>
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
              subtitle={formatInvoiceDisplay(viewInvoice.status, viewInvoice.invoice_number, INVOICE_STATUS_LABELS)}
              icon={<Receipt className="w-5 h-5" />}
              onClose={closeModal}
            />
            <div className="px-6 pt-2 pb-2 flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => openPdf(viewInvoice.id)} className="rounded-lg">
                <Download className="w-4 h-4 mr-2" /> Unduh PDF
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
                {paymentProofs.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-[#0D1A63]/10 text-emerald-700 rounded-full">{paymentProofs.length}</span>
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
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {detailTab === 'invoice' && (
                <div className="space-y-6">
                  {(() => {
                    const totalInv = Number(viewInvoice.total_amount) || 0;
                    const paidFromProofs = (viewInvoice?.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                    const paidFromInvoice = Number(viewInvoice.paid_amount) || 0;
                    const displayPaid = paidFromInvoice > 0 ? paidFromInvoice : paidFromProofs;
                    const displayRemaining = Math.max(0, totalInv - displayPaid);
                    const kesBreakdown = (viewInvoice?.PaymentProofs || []).filter((pr: any) => pr.payment_location === 'saudi' && pr.amount_original != null && pr.payment_currency && pr.payment_currency !== 'IDR');
                    const kesSar = kesBreakdown.filter((pr: any) => pr.payment_currency === 'SAR').reduce((s: number, pr: any) => s + Number(pr.amount_original || 0), 0);
                    const kesUsd = kesBreakdown.filter((pr: any) => pr.payment_currency === 'USD').reduce((s: number, pr: any) => s + Number(pr.amount_original || 0), 0);
                    const totalPct = totalInv > 0 ? ((displayPaid / totalInv) * 100) : 0;
                    return (
                      <>
                        {/* Baris aksi & ringkasan utama */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/80 shadow-sm">
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge variant={getStatusBadge(viewInvoice.status)} className="text-sm px-3 py-1">{INVOICE_STATUS_LABELS[viewInvoice.status] || viewInvoice.status}</Badge>
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
                              <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Owner</dt><dd className="mt-1 font-semibold text-slate-900">{viewInvoice.User?.name || viewInvoice.User?.company_name}</dd></div>
                              <div><dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cabang</dt><dd className="mt-1 font-semibold text-slate-900">{viewInvoice.Branch?.name || viewInvoice.Branch?.code}</dd></div>
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
                                <p className="text-xl font-bold text-slate-900 mt-1">{formatIDR(totalInv)}</p>
                                <p className="text-sm text-slate-500 mt-0.5">{formatSAR(totalInv / sarToIdr)} · {formatUSD(totalInv / usdToIdr)}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-xs text-slate-500">DP ({viewInvoice.dp_percentage ?? 0}%)</p><p className="font-semibold text-slate-900 mt-0.5">{formatIDR(Number(viewInvoice.dp_amount) || 0)}</p></div>
                                <div><p className="text-xs text-slate-500">Dibayar</p><p className="font-semibold text-[#0D1A63] mt-0.5">{formatIDR(displayPaid)}</p>{(kesSar > 0 || kesUsd > 0) && <p className="text-xs text-[#0D1A63] mt-0.5">KES: {formatSAR(kesSar)}{kesUsd > 0 ? ` · ${formatUSD(kesUsd)}` : ''}</p>}</div>
                                <div><p className="text-xs text-slate-500">Sisa</p><p className="font-semibold text-red-600 mt-0.5">{formatIDR(displayRemaining)}</p></div>
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
                            {user?.role === 'owner' && viewInvoice?.owner_id === user?.id && (
                              <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 shadow-sm">
                                <h4 className="text-sm font-semibold text-emerald-800 flex items-center gap-2 mb-3">
                                  <Wallet className="w-4 h-4" /> Saldo Akun Anda
                                </h4>
                                {ownerBalanceLoading ? (
                                  <p className="text-sm text-slate-500">Memuat saldo...</p>
                                ) : (
                                  <>
                                    <p className="text-2xl font-bold text-emerald-700">{formatIDR(ownerBalance ?? 0)}</p>
                                    <p className="text-xs text-slate-600 mt-1">Untuk order baru atau alokasi ke tagihan.</p>
                                    {parseFloat(viewInvoice.remaining_amount || 0) > 0 && (ownerBalance ?? 0) > 0 && (
                                      <div className="mt-4 pt-4 border-t border-emerald-200 space-y-2">
                                        <div className="flex gap-2 items-end">
                                          <Input label="Alokasikan ke invoice ini" type="number" min={1} max={Math.min(ownerBalance ?? 0, parseFloat(viewInvoice.remaining_amount))} value={allocateAmount} onChange={(e) => setAllocateAmount(e.target.value)} placeholder="Jumlah (IDR)" className="flex-1 min-w-0" />
                                          <Button size="sm" variant="primary" disabled={allocating || !allocateAmount || parseFloat(allocateAmount) <= 0} onClick={async () => {
                                            const amt = parseFloat(allocateAmount);
                                            if (!Number.isFinite(amt) || amt <= 0) return;
                                            setAllocating(true);
                                            try {
                                              await invoicesApi.allocateBalance(viewInvoice.id, { amount: amt });
                                              showToast(`Saldo Rp ${amt.toLocaleString('id-ID')} berhasil dialokasikan`, 'success');
                                              setAllocateAmount('');
                                              fetchInvoiceDetail(viewInvoice.id);
                                              fetchOwnerBalance();
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
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kurs pembayaran</p>
                              <p className="text-sm text-slate-700">1 SAR = {formatIDR(sarToIdr)}</p>
                              <p className="text-sm text-slate-700">1 USD = {formatIDR(usdToIdr)}</p>
                              {(viewInvoice.Order?.currency === 'SAR' || viewInvoice.Order?.currency === 'USD') && (
                                <p className="text-xs font-semibold text-slate-600 mt-2 pt-2 border-t border-slate-200">Total = {formatIDR(parseFloat(viewInvoice.total_amount || 0))} IDR</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Hint tagihan DP (jika bisa bayar, tombol sudah di atas) */}
                        {canPayInvoice(viewInvoice) && (
                          <p className="text-sm text-slate-500 px-1">Tagihan DP minimal {viewInvoice.dp_percentage || 30}% atau input sendiri. Bayar via Transfer Bank, VA, atau QRIS.</p>
                        )}
                      </>
                    );
                  })()}

                  {/* Info Refund (jika invoice dibatalkan dengan pembayaran) */}
                  {(viewInvoice?.Refunds?.length ?? 0) > 0 && (
                    <div className="p-5 bg-amber-50/80 rounded-2xl border border-amber-200 shadow-sm space-y-3">
                      <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                        <Receipt className="w-4 h-4" /> Permintaan Refund
                      </h4>
                      <p className="text-xs text-slate-500">Pembatalan invoice dengan pembayaran akan membuat permintaan refund. Status berikut menunggu proses oleh tim keuangan.</p>
                      <ul className="space-y-2">
                        {(viewInvoice.Refunds as any[]).map((r: any) => (
                          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm p-3 bg-white rounded-lg border border-slate-200">
                            <span className="font-semibold text-emerald-700">{formatIDR(parseFloat(r.amount))}</span>
                            <Badge variant={r.status === 'refunded' ? 'success' : r.status === 'rejected' ? 'error' : 'warning'}>
                              {r.status === 'requested' ? 'Menunggu proses' : r.status === 'approved' ? 'Disetujui' : r.status === 'rejected' ? 'Ditolak' : 'Sudah direfund'}
                            </Badge>
                            {(r.bank_name || r.account_number) && <span className="text-slate-600 text-xs w-full mt-1">Rekening: {r.bank_name} {r.account_number}</span>}
                            {r.reason && <span className="text-slate-600 text-xs w-full mt-1">Alasan: {r.reason}</span>}
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
                      <Button size="sm" variant="outline" onClick={() => openPdf(viewInvoice.id)}>
                        <ExternalLink className="w-4 h-4 mr-1" /> Buka di tab baru
                      </Button>
                    </div>
                    <div className="h-[420px] min-h-[320px] bg-slate-50">
                      {loadingPdf && (
                        <div className="flex items-center justify-center h-full text-slate-500">
                          <div className="animate-pulse">Memuat PDF...</div>
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
                  <p className="text-sm text-slate-600">Setelah bukti bayar diverifikasi, invoice otomatis update: persen terbayar, sisa tagihan, dan status (partial_paid / paid).</p>
                  {paymentProofs.length === 0 ? (
                    <div className="text-center py-14 rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="p-4 rounded-2xl bg-slate-100 w-fit mx-auto mb-4">
                        <CreditCard className="w-12 h-12 text-slate-400" />
                      </div>
                      <p className="text-slate-700 font-semibold">Belum ada bukti pembayaran</p>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Upload bukti bayar untuk DP atau pelunasan via tombol &quot;Bayar DP / Bayar&quot; di tab Invoice & Order.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paymentProofs.map((p: any) => {
                        const fileUrl = getFileUrl(p.proof_file_url);
                        const ps = getProofStatus(p);
                        const isPending = ps.status === 'pending';
                        return (
                          <div key={p.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50/80 border-b border-slate-100">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="font-semibold text-slate-800">{getProofDisplayLabel(p)}</span>
                                <span className="text-slate-600 text-sm">
                                  {p.payment_location === 'saudi'
                                    ? `Pembayaran KES${p.payment_currency && p.payment_currency !== 'IDR' ? ` (${p.payment_currency})` : ''}`
                                    : p.bank_name ? `Transfer Bank (${p.bank_name}${p.account_number ? ` ${p.account_number}` : ''})` : 'Transfer'}
                                </span>
                                {p.payment_location === 'saudi' && p.amount_original != null && p.payment_currency && p.payment_currency !== 'IDR' ? (
                                  <span className="text-[#0D1A63] font-semibold">
                                    Nominal diinput: {p.payment_currency === 'SAR' ? formatSAR(Number(p.amount_original)) : formatUSD(Number(p.amount_original))} = {formatIDR(parseFloat(p.amount))}
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-[#0D1A63] font-semibold">{formatIDR(parseFloat(p.amount))}</span>
                                    <span className="text-xs text-slate-500">≈ {formatSAR(parseFloat(p.amount) / sarToIdr)} · ≈ {formatUSD(parseFloat(p.amount) / usdToIdr)}</span>
                                  </>
                                )}
                                <Badge variant={ps.variant}>{ps.label}</Badge>
                                {ps.status === 'verified' && (p as any).VerifiedBy?.name && (
                                  <span className="text-xs text-slate-600">Diverifikasi oleh: <strong>{(p as any).VerifiedBy.name}</strong></span>
                                )}
                                {p.created_at && (
                                  <span className="text-xs text-slate-500">
                                    Tanggal upload bukti: {formatDate(p.created_at)} · Jam: {new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {fileUrl && (
                                  <a href={fileUrl} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#0D1A63] hover:underline">
                                    <Download className="w-4 h-4" /> Unduh
                                  </a>
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
                                  <span className="text-xs text-[#0D1A63] font-medium">Pembayaran KES — otomatis terverifikasi</span>
                                )}
                              </div>
                            </div>
                            <div className="p-4 bg-slate-50/50 min-h-[280px]">
                              <ProofPreview invoiceId={viewInvoice.id} proof={p} />
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
                  <p className="text-sm text-slate-600">Status pekerjaan per produk (visa, tiket, hotel, bus). Diupdate oleh divisi Visa, Tiket, dan Hotel.</p>
                  {(() => {
                    const order = viewInvoice?.Order;
                    const items = (order?.OrderItems || []).filter((i: any) => {
                      const t = (i.type || i.product_type);
                      return t === 'visa' || t === 'ticket' || t === 'hotel' || t === 'bus';
                    });
                    if (items.length === 0) {
                      return (
                        <div className="text-center py-14 rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="p-4 rounded-2xl bg-slate-100 w-fit mx-auto mb-4">
                            <ClipboardList className="w-12 h-12 text-slate-400" />
                          </div>
                          <p className="text-slate-700 font-semibold">Tidak ada item visa / tiket / hotel / bus</p>
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
                        const productLabel = item.Product?.name || (item as any).product_name || (t === 'visa' ? 'Visa' : t === 'ticket' ? 'Tiket' : t === 'hotel' ? 'Hotel' : 'Bus');
                        groupsMap.set(key, { key, productLabel, type: t, items: [] });
                      }
                      groupsMap.get(key)!.items.push(item);
                    }
                    const groups = Array.from(groupsMap.values());
                    return (
                      <div className="space-y-4">
                        {groups.map((group) => {
                          const first = group.items[0];
                          const itemWithJamaah = group.items.find((i: any) => i.jamaah_data_type && i.jamaah_data_value) || first;
                          const itemWithManifest = (group.type === 'ticket' || group.type === 'visa') ? group.items.find((i: any) => i.manifest_file_url) || first : first;
                          const isVisa = group.type === 'visa';
                          const isTicket = group.type === 'ticket';
                          const isHotel = group.type === 'hotel';
                          const isBus = group.type === 'bus';
                          const progress = isVisa ? first.VisaProgress : isTicket ? first.TicketProgress : first.HotelProgress;
                          const statusLabels = isVisa ? VISA_STATUS_LABELS : isTicket ? TICKET_STATUS_LABELS : isHotel ? HOTEL_STATUS_LABELS : BUS_TICKET_LABELS;
                          const status = isBus ? (progress?.bus_ticket_status ? (BUS_TICKET_LABELS[progress.bus_ticket_status] || progress.bus_ticket_status) : 'Pending') : (progress?.status ? (statusLabels[progress.status] || progress.status) : (isHotel ? 'Menunggu konfirmasi' : 'Menunggu data'));
                          const hasJamaah = itemWithJamaah.jamaah_data_type && itemWithJamaah.jamaah_data_value;
                          const jamaahUrl = itemWithJamaah.jamaah_data_type === 'link' ? itemWithJamaah.jamaah_data_value : itemWithJamaah.jamaah_data_value ? getFileUrl(itemWithJamaah.jamaah_data_value) : null;
                          const badgeVariant = isBus ? (progress?.bus_ticket_status === 'issued' ? 'success' : 'info') : ((isVisa ? progress?.status === 'issued' : isTicket ? progress?.status === 'ticket_issued' : progress?.status === 'completed') ? 'success' : 'info');
                          const typeIcon = isVisa ? <FileText className="w-4 h-4" /> : isTicket ? <Plane className="w-4 h-4" /> : isHotel ? <Package className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />;
                          const typeBg = isVisa ? 'bg-sky-100 text-sky-600' : isTicket ? 'bg-[#0D1A63]/10 text-[#0D1A63]' : isHotel ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600';
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
                                        ) : jamaahUrl ? (
                                          <a href={jamaahUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                                            <Download className="w-3.5 h-3.5" /> File
                                          </a>
                                        ) : (
                                          <span className="inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> File diunggah</span>
                                        )}
                                      </span>
                                    )}
                                    {(isTicket || isVisa) && itemWithManifest.manifest_file_url && (
                                      <a href={getFileUrl(itemWithManifest.manifest_file_url) || itemWithManifest.manifest_file_url} target="_blank" rel="noopener noreferrer" download className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                                        <Download className="w-3.5 h-3.5" /> Manifest
                                      </a>
                                    )}
                                    {!isHotel && !isBus && (progress?.visa_file_url || progress?.ticket_file_url) && (
                                      <a href={getFileUrl(progress.visa_file_url || progress.ticket_file_url) || (progress.visa_file_url || progress.ticket_file_url)} target="_blank" rel="noopener noreferrer" download className="text-[#0D1A63] hover:underline inline-flex items-center gap-1 font-medium">
                                        <Download className="w-3.5 h-3.5" /> Dokumen terbit
                                      </a>
                                    )}
                                  </div>
                                  {progress?.issued_at && (
                                    <p className="text-xs text-slate-500">Terbit: {new Date(progress.issued_at).toLocaleString('id-ID')}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
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

      {/* Modal Batalkan Invoice: pilih Jadikan saldo atau Minta refund (isi bank & rekening) */}
      {showCancelModal && cancelTargetInv && (
        <Modal open onClose={() => !deletingOrderId && setShowCancelModal(false)} zIndex={60}>
          <ModalBox>
            <ModalHeader title="Batalkan Invoice" subtitle="Konfirmasi pembatalan invoice dan pengembalian dana jika ada pembayaran" icon={<X className="w-5 h-5" />} onClose={() => !deletingOrderId && setShowCancelModal(false)} />
            <ModalBody className="space-y-4">
            {(() => {
              const paid = parseFloat(cancelTargetInv.paid_amount) || 0;
              if (paid > 0) {
                return (
                  <>
                    <p className="text-sm text-slate-600">
                      Invoice <strong>{cancelTargetInv.invoice_number}</strong> memiliki pembayaran <strong className="text-[#0D1A63]">{formatIDR(paid)}</strong>. Pilih salah satu:
                    </p>
                    <div className="space-y-3">
                      <Button
                        type="button"
                        variant={cancelAction === 'to_balance' ? 'primary' : 'outline'}
                        fullWidth
                        onClick={() => setCancelAction('to_balance')}
                        className="flex flex-col items-start text-left h-auto py-3"
                      >
                        <span className="font-medium">Jadikan saldo</span>
                        <span className="text-xs opacity-90 mt-0.5">Dana masuk ke saldo akun Anda. Bisa dipakai untuk order baru atau alokasi ke tagihan lain.</span>
                      </Button>
                      <Button
                        type="button"
                        variant={cancelAction === 'refund' ? 'primary' : 'outline'}
                        fullWidth
                        onClick={() => setCancelAction('refund')}
                        className="flex flex-col items-start text-left h-auto py-3"
                      >
                        <span className="font-medium">Minta refund ke rekening</span>
                        <span className="text-xs opacity-90 mt-0.5">Admin/accounting akan memproses pengembalian ke rekening Anda.</span>
                      </Button>
                    </div>
                    {cancelAction === 'refund' && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <Input label="Nama Bank (wajib)" type="text" value={cancelBankName} onChange={(e) => setCancelBankName(e.target.value)} placeholder="Contoh: BCA, Mandiri" disabled={!!deletingOrderId} />
                        <Input label="Nomor Rekening (wajib)" type="text" value={cancelAccountNumber} onChange={(e) => setCancelAccountNumber(e.target.value)} placeholder="Nomor Rekening" disabled={!!deletingOrderId} />
                      </div>
                    )}
                    <Textarea label="Alasan pembatalan (opsional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Contoh: Order salah input..." rows={3} disabled={!!deletingOrderId} />
                  </>
                );
              }
              return <p className="text-sm text-slate-600">Batalkan invoice <strong>{cancelTargetInv.invoice_number}</strong>? Tindakan ini tidak dapat dibatalkan.</p>;
            })()}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => { setShowCancelModal(false); setCancelTargetInv(null); setCancelReason(''); setCancelBankName(''); setCancelAccountNumber(''); }} disabled={!!deletingOrderId}>Batal</Button>
              <Button variant="primary" onClick={submitCancelModal} disabled={!!deletingOrderId} className="bg-red-600 hover:bg-red-700">
                {deletingOrderId ? 'Memproses...' : (parseFloat(cancelTargetInv.paid_amount) || 0) > 0 ? (cancelAction === 'to_balance' ? 'Ya, batalkan & jadikan saldo' : 'Ya, batalkan & minta refund') : 'Ya, batalkan'}
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
          return (st === 'canceled' || st === 'cancelled') ? paid > 0 : overpaid > 0;
        });
        const targetCandidates = list.filter((i: any) => {
          const st = (i.status || '').toLowerCase();
          const remain = parseFloat(i.remaining_amount || 0);
          return st !== 'canceled' && st !== 'cancelled' && remain > 0;
        });
        const getReleasable = (inv: any) => {
          const st = (inv?.status || '').toLowerCase();
          if (st === 'canceled' || st === 'cancelled') return parseFloat(inv?.paid_amount || 0);
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
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 shrink-0">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5" /> Pemindahan Dana Antar Invoice
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Alokasikan dana dari invoice sumber (dibatalkan / kelebihan bayar) ke invoice penerima. Bisa satu atau lebih sumber dan satu atau lebih penerima.
                </p>
              </div>
              <div className="p-6 flex-1 space-y-4 min-h-0">
                {reallocateListLoading ? (
                  <p className="text-slate-500">Memuat daftar invoice...</p>
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
                          Total dipindahkan: <strong>{formatIDR(totalAmount)}</strong>
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
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReallocateModal(false)} disabled={reallocateSubmitting}>Batal</Button>
                <Button variant="primary" onClick={submitReallocate} disabled={reallocateSubmitting || !canSubmit}>
                  {reallocateSubmitting ? 'Memproses...' : 'Proses Pemindahan'}
                </Button>
              </div>
            </div>
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
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">Input pembayaran KES (Saudi) dalam SAR atau USD. Jumlah dikonversi ke IDR sesuai kurs cabang. Pembayaran otomatis terverifikasi (tanpa konfirmasi). Bisa upload bukti KES opsional.</p>
                  <Autocomplete
                    label="Mata uang"
                    value={payCurrencySaudi}
                    onChange={(v) => setPayCurrencySaudi((v as 'SAR' | 'USD') || 'SAR')}
                    options={[
                      { value: 'SAR', label: 'SAR (Riyal Saudi)' },
                      { value: 'USD', label: 'USD' }
                    ]}
                    placeholder="Pilih mata uang"
                  />
                  <Input
                    label={`Jumlah bayar (${payCurrencySaudi}) *`}
                    type="text"
                    value={payAmountSaudi}
                    onChange={(e) => setPayAmountSaudi(e.target.value.replace(/,/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                    placeholder={payCurrencySaudi === 'SAR' ? 'Contoh: 5000' : 'Contoh: 1500'}
                  />
                  {payAmountSaudi && !isNaN(parseFloat(payAmountSaudi.replace(/,/g, ''))) && (() => {
                    const amt = parseFloat(payAmountSaudi.replace(/,/g, ''));
                    const idr = payCurrencySaudi === 'SAR' ? amt * sarToIdr : amt * usdToIdr;
                    return (
                      <p className="text-xs text-slate-500 mt-1">≈ {formatIDR(Math.round(idr))} IDR</p>
                    );
                  })()}
                  <Input
                    label="Tanggal transfer"
                    type="date"
                    value={payTransferDate}
                    onChange={(e) => setPayTransferDate(e.target.value)}
                  />
                  <div>
                    <Input
                      label="Upload bukti KES"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                      className="file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">Opsional. Bukti transfer KES (foto/screenshot/PDF). Pembayaran otomatis terverifikasi tanpa konfirmasi.</p>
                  </div>
                </>
              )}
              {paymentMethod === 'bank' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Transfer ke rekening</label>
                    {!bankAccountsForPayment.length && paymentBankAccountsLoading ? (
                      <p className="text-sm text-slate-500 py-2">Memuat data rekening bank...</p>
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
                      const overpay = newRemain < 0;
                      return (
                        <div className="mt-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/80 space-y-2 text-sm">
                          <p className="font-semibold text-slate-800">Validasi pembayaran (otomatis)</p>
                          <p><span className="text-slate-600">Jumlah yang diinput:</span> <strong>{formatIDR(inputIdr)}</strong> ≈ {formatSAR(inputIdr / sarToIdr)} · ≈ {formatUSD(inputIdr / usdToIdr)}</p>
                          <p><span className="text-slate-600">Setelah pembayaran ini —</span></p>
                          <p><span className="text-slate-600">Dibayar total:</span> <strong className="text-[#0D1A63]">{formatIDR(newPaid)}</strong> ≈ {formatSAR(newPaid / sarToIdr)} · ≈ {formatUSD(newPaid / usdToIdr)}</p>
                          <p><span className="text-slate-600">Sisa:</span> <strong className={newRemain <= 0 ? 'text-[#0D1A63]' : 'text-red-600'}>{formatIDR(Math.max(0, newRemain))}</strong> ≈ {formatSAR(Math.max(0, newRemain) / sarToIdr)} · ≈ {formatUSD(Math.max(0, newRemain) / usdToIdr)}</p>
                          {overpay && <p className="text-amber-700 text-xs">Jumlah melebihi sisa tagihan. Sistem akan catat sebagai pelunasan; kelebihan tidak dikembalikan otomatis.</p>}
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
                    label="Upload bukti bayar *"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                    className="file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm"
                  />
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
                  (paymentMethod === 'bank' && bankAccountsForPayment.length === 0)
                }
              >
                {paySubmitting ? 'Menyimpan...' : paymentMethod === 'saudi' ? 'Simpan Pembayaran Saudi' : paymentMethod === 'bank' ? 'Upload Bukti Bayar' : 'Lanjut'}
              </Button>
            </ModalFooter>
          </ModalBox>
        </Modal>
      )}
    </div>
  );
};

export default OrdersInvoicesPage;
