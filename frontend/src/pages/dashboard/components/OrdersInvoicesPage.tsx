import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Receipt, Download, Check, X, Unlock, Eye, FileText, ChevronLeft, ChevronRight,
  CreditCard, DollarSign, Package, Wallet, Plus, Edit, Trash2, FileSpreadsheet, LayoutGrid, ExternalLink, Upload, Link as LinkIcon
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { DashboardFilterBar, PageFilter, ActionsMenu, AutoRefreshControl } from '../../../components/common';
import type { ActionsMenuItem } from '../../../components/common/ActionsMenu';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { formatIDR, formatSAR, formatUSD, formatInvoiceDisplay } from '../../../utils';
import { INVOICE_STATUS_LABELS, API_BASE_URL } from '../../../utils/constants';
import { invoicesApi, branchesApi, businessRulesApi, ownersApi, ordersApi, hotelApi, type InvoicesSummaryData } from '../../../services/api';

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
 * owner, invoice_koordinator, role_invoice_saudi, role_hotel (pekerjaan hotel), admin pusat/cabang, accounting, dll.
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
  const [detailTab, setDetailTab] = useState<'invoice' | 'payments'>('invoice');
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [currencyRates, setCurrencyRates] = useState<{ SAR_TO_IDR?: number; USD_TO_IDR?: number }>({});
  const [summary, setSummary] = useState<InvoicesSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
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
  const [hotelProgressSaving, setHotelProgressSaving] = useState<string | null>(null);
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

  const isAdminPusat = user?.role === 'admin_pusat';
  const isAccounting = user?.role === 'role_accounting';
  const isInvoiceSaudi = user?.role === 'role_invoice_saudi';
  const canPayInvoice = (inv: any) => {
    if (!inv || parseFloat(inv.remaining_amount || 0) <= 0) return false;
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
      const res = await invoicesApi.list(params);
      if (res.data.success) {
        const data = res.data.data || [];
        setInvoices(data);
        const pag = (res.data as { pagination?: { total: number; page: number; limit: number; totalPages: number } }).pagination;
        setPagination(pag || (data.length > 0 ? { total: data.length, page: 1, limit: data.length, totalPages: 1 } : null));
        const summaryPayload = (res.data as { summary?: InvoicesSummaryData }).summary;
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
  };

  const fetchInvoiceDetail = async (id: string) => {
    try {
      const res = await invoicesApi.getById(id);
      if (res.data.success) setViewInvoice(res.data.data);
    } catch {
      showToast('Gagal memuat detail invoice', 'error');
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

  const VISA_STATUS_LABELS: Record<string, string> = { document_received: 'Dokumen diterima', submitted: 'Dikirim', in_process: 'Diproses', approved: 'Disetujui', issued: 'Terbit' };
  const TICKET_STATUS_LABELS: Record<string, string> = { pending: 'Menunggu', data_received: 'Data diterima', seat_reserved: 'Kursi reserved', booking: 'Booking', payment_airline: 'Bayar maskapai', ticket_issued: 'Tiket terbit' };
  const HOTEL_STATUS_LABELS: Record<string, string> = { waiting_confirmation: 'Menunggu konfirmasi', confirmed: 'Dikonfirmasi', room_assigned: 'Kamar ditetapkan', completed: 'Selesai' };

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
  const canVerify = ['admin_pusat', 'admin_koordinator', 'invoice_koordinator', 'role_invoice_saudi', 'role_invoice', 'invoice', 'role_accounting', 'super_admin'].includes(user?.role || '');

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

  const bankAccounts = (viewInvoice?.bank_accounts || []) as { bank_name?: string; account_number?: string; account_name?: string }[];
  const openPaymentModal = () => {
    setPayAmountIdr('');
    setPayAmountSaudi('');
    setPayTransferDate(new Date().toISOString().slice(0, 10));
    setPayBankIndex(0);
    setPayFile(null);
    setPaymentMethod(isInvoiceSaudi ? 'saudi' : 'bank');
    setShowPaymentModal(true);
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
      const bank = bankAccounts[payBankIndex];
      const paymentType = parseFloat(viewInvoice.paid_amount || 0) === 0 ? 'dp' : (amount >= remaining ? 'full' : 'partial');
      const form = new FormData();
      form.append('amount', String(Math.round(amount)));
      form.append('payment_type', paymentType);
      form.append('transfer_date', payTransferDate);
      if (bank?.bank_name) form.append('bank_name', bank.bank_name);
      if (bank?.account_number) form.append('account_number', bank.account_number);
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

  const s = summary || summaryFromTable || {
    total_invoices: pagination?.total ?? 0,
    total_orders: 0,
    total_amount: 0,
    total_paid: 0,
    total_remaining: 0,
    by_invoice_status: {},
    by_order_status: {}
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header: judul dan tombol Tambah Order di baris terpisah agar filter tidak ikut bergeser */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">Invoice</h1>
          <p className="text-stone-600 mt-1">
            {user?.role === 'role_hotel' ? 'Pekerjaan hotel: daftar order yang berisi item hotel. Buka invoice untuk update status & nomor kamar.' : user?.role === 'role_bus' ? 'Pekerjaan bus: daftar order yang berisi item bus. Buka invoice untuk detail.' : (isAdminPusat || isAccounting) ? 'Semua invoice dalam satu daftar.' : isInvoiceSaudi ? 'Semua invoice seluruh wilayah. Input pembayaran SAR/USD (Saudi) otomatis update invoice.' : (user?.role === 'owner' ? 'Invoice Anda.' : 'Invoice cabang Anda.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AutoRefreshControl onRefresh={fetchInvoices} disabled={loading} />
          {canOrderAction && (
            <Button variant="primary" onClick={() => navigate('/dashboard/orders/new')} className="shrink-0">
              <Plus className="w-5 h-5 mr-2" /> Tambah Invoice
            </Button>
          )}
        </div>
      </div>

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

      {/* Summary cards - travel card style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card hover className="travel-card flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total Invoice</p>
              <p className="text-xl sm:text-2xl font-bold text-stone-900 mt-0.5">{loadingSummary ? '...' : s.total_invoices.toLocaleString('id-ID')}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card hover className="travel-card flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total Trip</p>
              <p className="text-xl sm:text-2xl font-bold text-stone-900 mt-0.5">{loadingSummary ? '...' : s.total_orders.toLocaleString('id-ID')}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card hover className="travel-card flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total Tagihan</p>
              <p className="text-lg sm:text-xl font-bold text-stone-900 mt-0.5">{loadingSummary ? '...' : formatIDR(s.total_amount)}</p>
              {!loadingSummary && <p className="text-xs text-stone-500 mt-0.5">≈ {formatSAR(s.total_amount / sarToIdrList)} · ≈ {formatUSD(s.total_amount / usdToIdrList)}</p>}
            </div>
            <div className="p-2.5 rounded-xl bg-stone-100 text-stone-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card hover className="travel-card flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Dibayar</p>
              <p className="text-lg sm:text-xl font-bold text-primary-600 mt-0.5">{loadingSummary ? '...' : formatIDR(s.total_paid)}</p>
              {!loadingSummary && <p className="text-xs text-stone-500 mt-0.5">≈ {formatSAR(s.total_paid / sarToIdrList)} · ≈ {formatUSD(s.total_paid / usdToIdrList)}</p>}
            </div>
            <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card hover className="travel-card flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Sisa</p>
              <p className="text-lg sm:text-xl font-bold text-amber-600 mt-0.5">{loadingSummary ? '...' : formatIDR(s.total_remaining)}</p>
              {!loadingSummary && <p className="text-xs text-stone-500 mt-0.5">≈ {formatSAR(s.total_remaining / sarToIdrList)} · ≈ {formatUSD(s.total_remaining / usdToIdrList)}</p>}
            </div>
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Per Status Invoice */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="travel-card">
          <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Per Status Invoice
          </h3>
          {loadingSummary ? (
            <p className="text-stone-500 text-sm">Memuat...</p>
          ) : Object.keys(s.by_invoice_status).length === 0 ? (
            <p className="text-stone-500 text-sm">Tidak ada data</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(s.by_invoice_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-stone-50 border border-stone-100 min-w-[120px]">
                  <Badge variant={getStatusBadge(status)}>{INVOICE_STATUS_LABELS[status] || status}</Badge>
                  <span className="font-bold text-stone-900">{Number(count).toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {loading ? (
        <div className="py-12 text-center text-stone-500">Memuat...</div>
      ) : (
        <Card className="travel-card">
          <h2 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary-600" /> Daftar Invoice ({pagination?.total ?? invoices.length})
          </h2>
          <div className="overflow-x-auto rounded-travel">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-600 bg-stone-50/80">
                  <th className="pb-2 pr-4 pt-3 pl-4">Invoice</th>
                  <th className="pb-2 pr-4">Owner</th>
                  <th className="pb-2 pr-4">Cabang</th>
                  <th className="pb-2 pr-4 text-right">Total<br /><span className="text-xs font-normal text-stone-400">IDR · SAR · USD</span></th>
                  <th className="pb-2 pr-4 text-right">Dibayar<br /><span className="text-xs font-normal text-stone-400">IDR · SAR · USD</span></th>
                  <th className="pb-2 pr-4 text-right">Sisa<br /><span className="text-xs font-normal text-stone-400">IDR · SAR · USD</span></th>
                  <th className="pb-2 pr-4">Status Invoice<br /><span className="text-xs font-normal text-stone-400">% dibayar dari total</span></th>
                  <th className="pb-2 pr-4">Bukti Bayar<br /><span className="text-xs font-normal text-stone-400">Jumlah (IDR·SAR·USD) + Konfirmasi</span></th>
                  <th className="pb-2 pr-4">Tgl</th>
                  <th className="pb-2 pr-4 w-12">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-stone-100 hover:bg-stone-50/60">
                    <td className="py-3 pl-4 pr-2 font-mono font-semibold">{formatInvoiceDisplay(inv.status, inv.invoice_number, INVOICE_STATUS_LABELS)}</td>
                    <td className="py-3 pr-4">{inv.User?.name || inv.User?.company_name || '-'}</td>
                    <td className="py-3 pr-4">{inv.Branch?.name || inv.Branch?.code || '-'}</td>
                    <td className="py-3 pr-4 text-right font-medium">
                      <div>{formatIDR(parseFloat(inv.total_amount || 0))}</div>
                      {(() => { const t = amountTriple(parseFloat(inv.total_amount || 0)); return <div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {formatSAR(t.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(t.usd, false)}</div>; })()}
                    </td>
                    <td className="py-3 pr-4 text-right text-emerald-600 font-medium">
                      {(() => {
                        const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                        const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                        const t = amountTriple(paid);
                        return <><div>{formatIDR(paid)}</div><div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {formatSAR(t.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(t.usd, false)}</div></>;
                      })()}
                    </td>
                    <td className="py-3 pr-4 text-right text-red-600 font-medium">
                      {(() => {
                        const totalInv = parseFloat(inv.total_amount || 0);
                        const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                        const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                        const remaining = Math.max(0, totalInv - paid);
                        const t = amountTriple(remaining);
                        return <><div>{formatIDR(remaining)}</div><div className="text-xs text-slate-500 mt-0.5"><span className="text-slate-400">SAR:</span> {formatSAR(t.sar, false)} <span className="text-slate-400 ml-1">USD:</span> {formatUSD(t.usd, false)}</div></>;
                      })()}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={getStatusBadge(inv.status)}>{INVOICE_STATUS_LABELS[inv.status] || inv.status}</Badge>
                      {inv.is_blocked && <Badge variant="error" className="ml-1">Block</Badge>}
                      {(() => {
                        const total = parseFloat(inv.total_amount || 0);
                        const paidFromProofs = (inv.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                        const paid = parseFloat(inv.paid_amount || 0) || paidFromProofs;
                        const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                        return <div className="text-xs text-stone-600 mt-1">Dibayar <strong>{pct}%</strong> dari total tagihan</div>;
                      })()}
                    </td>
                    <td className="py-3 pr-4">
                      {(inv.PaymentProofs?.length ?? 0) === 0 ? (
                        <span className="text-stone-400 text-xs">-</span>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {inv.PaymentProofs?.map((p: any) => {
                            const ps = getProofStatus(p);
                            const amt = parseFloat(p.amount || 0);
                            const sar = amt / sarToIdrList;
                            const usd = amt / usdToIdrList;
                            const isKesNominal = p.payment_location === 'saudi' && p.amount_original != null && p.payment_currency && p.payment_currency !== 'IDR';
                            const statusLabel = ps.status === 'verified' ? 'Sudah konfirmasi' : ps.status === 'rejected' ? 'Ditolak' : 'Belum konfirmasi';
                            return (
                              <div key={p.id} className="rounded-lg border border-stone-200 bg-stone-50/80 px-2.5 py-2 text-xs">
                                <div className="font-semibold text-stone-700">{getProofDisplayLabel(p)}</div>
                                <div className="text-stone-600 mt-0.5">
                                  {isKesNominal ? (
                                    <><span className="text-stone-500">Nominal:</span> {p.payment_currency === 'SAR' ? formatSAR(Number(p.amount_original)) : formatUSD(Number(p.amount_original))} = {formatIDR(amt)}</>
                                  ) : (
                                    <><span className="text-stone-500">IDR:</span> {formatIDR(amt)} · <span className="text-stone-500">SAR:</span> {formatSAR(sar, false)} · <span className="text-stone-500">USD:</span> {formatUSD(usd, false)}</>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <Badge variant={ps.variant} className="text-xs">{statusLabel}</Badge>
                                  {ps.status === 'verified' && (p as any).VerifiedBy?.name && (
                                    <span className="text-slate-500">oleh {(p as any).VerifiedBy.name}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">{formatDate(inv.issued_at || inv.created_at)}</td>
                    <td className="py-3">
                      <div className="flex justify-center">
                        <ActionsMenu
                          align="right"
                          items={[
                            ...(canOrderAction && inv.order_id
                              ? [{ id: 'edit-order', label: 'Edit Invoice', icon: <Edit className="w-4 h-4" />, onClick: () => navigate(`/dashboard/orders/${inv.order_id}/edit`) }]
                              : []),
                            { id: 'view', label: 'Lihat Invoice', icon: <Eye className="w-4 h-4" />, onClick: () => { setViewInvoice(inv); setDetailTab('invoice'); fetchInvoiceDetail(inv.id); } },
                            { id: 'pdf', label: 'Unduh PDF', icon: <FileText className="w-4 h-4" />, onClick: () => openPdf(inv.id) },
                            ...(canOrderAction && inv.order_id
                              ? [{ id: 'delete', label: 'Batalkan Invoice', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteOrder(inv), danger: true, disabled: deletingOrderId === inv.order_id }]
                              : []),
                          ].filter(Boolean) as ActionsMenuItem[]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoices.length === 0 && <p className="text-stone-500 py-6 text-center">Belum ada invoice</p>}
          {pagination && pagination.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-stone-200 bg-stone-50/50 mt-2 rounded-b-travel">
              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-600">
                  Menampilkan {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}-{Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total}
                </span>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="px-2 py-1 border border-stone-200 rounded-lg text-stone-700 bg-white text-sm"
                >
                  {[25, 50, 100, 200, 500].map((n) => (
                    <option key={n} value={n}>{n} per halaman</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="p-2 rounded-lg border border-stone-200 bg-white disabled:opacity-50 text-stone-600"><ChevronLeft className="w-4 h-4" /></button>
                <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg border border-stone-200 bg-white disabled:opacity-50 text-stone-600"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Modal Detail Invoice */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Receipt className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Detail Invoice</h2>
                  <p className="text-sm text-slate-600 font-mono">{formatInvoiceDisplay(viewInvoice.status, viewInvoice.invoice_number, INVOICE_STATUS_LABELS)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openPdf(viewInvoice.id)}>
                  <Download className="w-4 h-4 mr-2" /> Unduh PDF
                </Button>
                {canUnblock(viewInvoice) && (
                  <Button variant="secondary" size="sm" onClick={() => handleUnblock(viewInvoice)}>
                    <Unlock className="w-4 h-4 mr-2" /> Aktifkan Kembali
                  </Button>
                )}
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50/50 px-6">
              <button
                onClick={() => setDetailTab('invoice')}
                className={`flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-colors -mb-px ${
                  detailTab === 'invoice'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> Invoice & Order
              </button>
              <button
                onClick={() => setDetailTab('payments')}
                className={`flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-colors -mb-px ${
                  detailTab === 'payments'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-4 h-4" /> Bukti Bayar
                {paymentProofs.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">{paymentProofs.length}</span>
                )}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailTab === 'invoice' && (
                <div className="space-y-6">
                  {/* Ringkasan info - grid rapi */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Data Order</h4>
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-600">Owner</dt><dd className="font-semibold">{viewInvoice.User?.name || viewInvoice.User?.company_name}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Cabang</dt><dd className="font-semibold">{viewInvoice.Branch?.name || viewInvoice.Branch?.code}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Mata Uang</dt><dd className="font-semibold">{viewInvoice.Order?.currency || 'IDR'}</dd></div>
                      </dl>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Data Invoice (lengkap IDR · SAR · USD)</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between items-start"><dt className="text-slate-600">Status</dt><dd><Badge variant={getStatusBadge(viewInvoice.status)}>{INVOICE_STATUS_LABELS[viewInvoice.status] || viewInvoice.status}</Badge>{viewInvoice.is_blocked && <Badge variant="error" className="ml-1">Block</Badge>}</dd></div>
                        {(() => {
                          const totalInv = Number(viewInvoice.total_amount) || 0;
                          const paidFromProofs = (viewInvoice?.PaymentProofs || [])
                            .filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected'))
                            .reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                          const paidFromInvoice = Number(viewInvoice.paid_amount) || 0;
                          const displayPaid = paidFromInvoice > 0 ? paidFromInvoice : paidFromProofs;
                          const displayRemaining = Math.max(0, totalInv - displayPaid);
                          return [
                            { label: 'Total', val: totalInv, color: '' },
                            { label: `DP (${viewInvoice.dp_percentage ?? 0}%)`, val: Number(viewInvoice.dp_amount) || 0, color: '' },
                            { label: 'Dibayar', val: displayPaid, color: 'text-emerald-600' },
                            { label: 'Sisa', val: displayRemaining, color: 'text-red-600' }
                          ];
                        })().map(({ label, val, color }) => {
                          const safeVal = Number.isFinite(val) ? val : 0;
                          const t = { idr: safeVal, sar: safeVal / sarToIdr, usd: safeVal / usdToIdr };
                          const kesBreakdown = (viewInvoice?.PaymentProofs || []).filter((pr: any) => pr.payment_location === 'saudi' && pr.amount_original != null && pr.payment_currency && pr.payment_currency !== 'IDR');
                          const kesSar = kesBreakdown.filter((pr: any) => pr.payment_currency === 'SAR').reduce((s: number, pr: any) => s + Number(pr.amount_original || 0), 0);
                          const kesUsd = kesBreakdown.filter((pr: any) => pr.payment_currency === 'USD').reduce((s: number, pr: any) => s + Number(pr.amount_original || 0), 0);
                          return (
                            <div key={label} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                              <dt className="text-slate-600 mb-0.5">{label}</dt>
                              <dd className={`font-semibold ${color}`}>
                                <div>{formatIDR(t.idr)}</div>
                                <div className="text-xs font-normal text-slate-500 mt-0.5">{formatSAR(t.sar)} · {formatUSD(t.usd)}</div>
                                {label === 'Dibayar' && (kesSar > 0 || kesUsd > 0) && (
                                  <div className="text-xs font-normal text-emerald-600 mt-1">Termasuk KES: {kesSar > 0 ? formatSAR(kesSar) : ''}{kesSar > 0 && kesUsd > 0 ? ' · ' : ''}{kesUsd > 0 ? formatUSD(kesUsd) : ''}</div>
                                )}
                              </dd>
                            </div>
                          );
                        })}
                        <div className="flex justify-between border-t border-slate-100 pt-2"><dt className="text-slate-600">Terbayar</dt><dd className="font-semibold">{(() => {
                          const total = Number(viewInvoice.total_amount) || 0;
                          const paidFromProofs = (viewInvoice?.PaymentProofs || []).filter((p: any) => p.payment_location === 'saudi' || p.verified_status === 'verified' || (p.verified_at && p.verified_status !== 'rejected')).reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
                          const paid = (Number(viewInvoice.paid_amount) || 0) || paidFromProofs;
                          const pct = total > 0 ? (paid / total) * 100 : 0;
                          return (Number.isFinite(pct) ? pct.toFixed(1) : '0') + '%';
                        })()}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Tgl Invoice</dt><dd>{formatDate(viewInvoice.issued_at || viewInvoice.created_at)}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-600">Jatuh Tempo DP</dt><dd>{formatDate(viewInvoice.due_date_dp)}</dd></div>
                      </dl>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Kurs (untuk pembayaran)</h4>
                      <dl className="space-y-1.5 text-sm text-slate-700">
                        <div>1 SAR = {formatIDR(sarToIdr)} IDR</div>
                        <div>1 USD = {formatIDR(usdToIdr)} IDR</div>
                        {(viewInvoice.Order?.currency === 'SAR' || viewInvoice.Order?.currency === 'USD') && (
                          <div className="pt-2 mt-2 border-t border-emerald-200 font-semibold">
                            Total: {viewInvoice.Order?.currency === 'SAR' && `${(parseFloat(viewInvoice.total_amount || 0) / sarToIdr).toFixed(2)} SAR`}
                            {viewInvoice.Order?.currency === 'USD' && `${(parseFloat(viewInvoice.total_amount || 0) / usdToIdr).toFixed(2)} USD`} = {formatIDR(parseFloat(viewInvoice.total_amount || 0))} IDR
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Data Jamaah & Status Visa/Tiket/Hotel/Bus — role_hotel hanya item hotel, role_bus hanya item bus */}
                  {(() => {
                    const order = viewInvoice?.Order;
                    const isRoleHotel = user?.role === 'role_hotel';
                    const isRoleBus = user?.role === 'role_bus';
                    const items = (order?.OrderItems || []).filter((i: any) => {
                      const t = (i.type || i.product_type);
                      if (isRoleHotel) return t === 'hotel';
                      if (isRoleBus) return t === 'bus';
                      return t === 'visa' || t === 'ticket' || t === 'hotel';
                    });
                    if (items.length === 0) return null;
                    const sectionTitle = isRoleHotel ? 'Data & Status Hotel' : isRoleBus ? 'Data & Status Bus' : 'Data Jamaah & Status Visa / Tiket / Hotel';
                    return (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> {sectionTitle}
                        </h4>
                        {items.map((item: any) => {
                          const isVisa = (item.type || item.product_type) === 'visa';
                          const isTicket = (item.type || item.product_type) === 'ticket';
                          const isHotel = (item.type || item.product_type) === 'hotel';
                          const isBus = (item.type || item.product_type) === 'bus';
                          const progress = isVisa ? item.VisaProgress : isTicket ? item.TicketProgress : item.HotelProgress;
                          const statusLabels = isVisa ? VISA_STATUS_LABELS : isTicket ? TICKET_STATUS_LABELS : HOTEL_STATUS_LABELS;
                          const status = isBus ? 'Item bus' : (progress?.status ? (statusLabels[progress.status] || progress.status) : (isHotel ? 'Menunggu konfirmasi' : (isVisa ? 'Menunggu data' : 'Menunggu data')));
                          const hasJamaah = item.jamaah_data_type && item.jamaah_data_value;
                          const jamaahUrl = item.jamaah_data_type === 'link' ? item.jamaah_data_value : item.jamaah_data_value ? getFileUrl(item.jamaah_data_value) : null;
                          const productLabel = item.Product?.name || item.product_name || (isVisa ? 'Visa' : isTicket ? 'Tiket' : isHotel ? 'Hotel' : 'Bus');
                          const badgeVariant = isBus ? 'default' : ((isVisa ? progress?.status === 'issued' : isTicket ? progress?.status === 'ticket_issued' : progress?.status === 'completed') ? 'success' : 'info');
                          return (
                            <div key={item.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium text-slate-800">{productLabel}</span>
                                <Badge variant={badgeVariant}>{status}</Badge>
                              </div>
                              {hasJamaah && (
                                <div className="text-sm text-slate-600">
                                  Dokumen (ZIP/link): {item.jamaah_data_type === 'link' ? (
                                    <a href={item.jamaah_data_value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                                      <LinkIcon className="w-3.5 h-3.5" /> Link Google Drive
                                    </a>
                                  ) : jamaahUrl ? (
                                    <a href={jamaahUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                                      <Download className="w-3.5 h-3.5" /> Unduh file
                                    </a>
                                  ) : (
                                    <span>File diunggah</span>
                                  )}
                                </div>
                              )}
                              {!isHotel && !isBus && (progress?.visa_file_url || progress?.ticket_file_url) && (
                                <div className="text-sm text-slate-600">
                                  Hasil terbit:{' '}
                                  <a
                                    href={getFileUrl(progress.visa_file_url || progress.ticket_file_url) || (progress.visa_file_url || progress.ticket_file_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-600 hover:underline inline-flex items-center gap-1 font-medium"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Unduh {isVisa ? 'visa terbit' : 'tiket terbit'}
                                  </a>
                                </div>
                              )}
                              {canOrderAction && viewInvoice?.order_id && !isBus && (
                                <div className="pt-2 border-t border-slate-200 space-y-2">
                                  <p className="text-xs text-slate-500">Upload dokumen (ZIP atau link Google Drive) untuk divisi visa/tiket/hotel:</p>
                                  <div className="flex flex-wrap gap-2 items-end">
                                    <label className="flex flex-col gap-1 text-xs">
                                      <span>File ZIP</span>
                                      <input
                                        type="file"
                                        accept=".zip"
                                        className="text-sm border border-slate-300 rounded px-2 py-1.5"
                                        onChange={async (e) => {
                                          const f = e.target.files?.[0];
                                          if (f) await handleUploadJamaahData(viewInvoice.order_id, item.id, f, '');
                                          e.target.value = '';
                                        }}
                                        disabled={!!uploadingJamaahItemId}
                                      />
                                    </label>
                                    <span className="text-slate-400">atau</span>
                                    <div className="flex flex-col gap-1">
                                      <input
                                        type="url"
                                        placeholder="Link Google Drive"
                                        value={jamaahLinkInput[item.id] || ''}
                                        onChange={(e) => setJamaahLinkInput((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                        className="text-sm border border-slate-300 rounded px-2 py-1.5 w-64"
                                        disabled={!!uploadingJamaahItemId}
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUploadJamaahData(viewInvoice.order_id, item.id, null, jamaahLinkInput[item.id] || '')}
                                        disabled={!!uploadingJamaahItemId || !(jamaahLinkInput[item.id] || '').trim()}
                                      >
                                        {uploadingJamaahItemId === item.id ? 'Mengunggah...' : <><Upload className="w-3.5 h-3.5 mr-1" /> Simpan link</>}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {isRoleHotel && isHotel && (
                                <div className="pt-2 border-t border-slate-200 space-y-2">
                                  <p className="text-xs font-medium text-slate-600">Update progress hotel</p>
                                  <form
                                    className="flex flex-wrap gap-3 items-end"
                                    onSubmit={async (e) => {
                                      e.preventDefault();
                                      const form = e.currentTarget;
                                      const fd = new FormData(form);
                                      const status = (fd.get('status') as string) || undefined;
                                      const room_number = (fd.get('room_number') as string)?.trim() || undefined;
                                      const meal_status = (fd.get('meal_status') as string) || undefined;
                                      setHotelProgressSaving(item.id);
                                      try {
                                        await hotelApi.updateItemProgress(item.id, { status, room_number, meal_status });
                                        showToast('Status hotel berhasil diperbarui', 'success');
                                        if (viewInvoice?.id) fetchInvoiceDetail(viewInvoice.id);
                                      } catch (err: any) {
                                        showToast(err.response?.data?.message || 'Gagal update progress hotel', 'error');
                                      } finally {
                                        setHotelProgressSaving(null);
                                      }
                                    }}
                                  >
                                    <label className="flex flex-col gap-1 text-xs">
                                      <span>Status</span>
                                      <select name="status" defaultValue={progress?.status || 'waiting_confirmation'} className="text-sm border border-slate-300 rounded px-2 py-1.5">
                                        {Object.entries(HOTEL_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                      </select>
                                    </label>
                                    <label className="flex flex-col gap-1 text-xs">
                                      <span>No. Kamar</span>
                                      <input type="text" name="room_number" defaultValue={progress?.room_number || ''} placeholder="Contoh: 301" className="text-sm border border-slate-300 rounded px-2 py-1.5 w-24" />
                                    </label>
                                    <label className="flex flex-col gap-1 text-xs">
                                      <span>Makan</span>
                                      <select name="meal_status" defaultValue={progress?.meal_status || 'pending'} className="text-sm border border-slate-300 rounded px-2 py-1.5">
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Dikonfirmasi</option>
                                        <option value="completed">Selesai</option>
                                      </select>
                                    </label>
                                    <Button type="submit" size="sm" variant="primary" disabled={!!hotelProgressSaving}>
                                      {hotelProgressSaving === item.id ? 'Menyimpan...' : 'Simpan'}
                                    </Button>
                                  </form>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Info Refund (jika invoice dibatalkan dengan pembayaran) */}
                  {(viewInvoice?.Refunds?.length ?? 0) > 0 && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
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

                  {/* Saldo owner & alokasi ke invoice ini */}
                  {user?.role === 'owner' && viewInvoice?.owner_id === user?.id && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
                      <h4 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Saldo Akun Anda
                      </h4>
                      {ownerBalanceLoading ? (
                        <p className="text-sm text-slate-500">Memuat saldo...</p>
                      ) : (
                        <>
                          <p className="text-lg font-bold text-emerald-700">{formatIDR(ownerBalance ?? 0)}</p>
                          <p className="text-xs text-slate-600">Saldo dapat digunakan untuk order baru atau dialokasikan ke tagihan (DP/lunas).</p>
                          {parseFloat(viewInvoice.remaining_amount || 0) > 0 && (ownerBalance ?? 0) > 0 && (
                            <div className="pt-2 border-t border-emerald-200 flex flex-wrap gap-2 items-end">
                              <label className="flex flex-col gap-1 text-xs">
                                <span>Alokasikan ke invoice ini (IDR)</span>
                                <input type="number" min="1" max={Math.min(ownerBalance ?? 0, parseFloat(viewInvoice.remaining_amount))} value={allocateAmount} onChange={(e) => setAllocateAmount(e.target.value)} className="w-40 text-sm border border-slate-300 rounded-lg px-3 py-2" placeholder="Jumlah" />
                              </label>
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
                                } finally {
                                  setAllocating(false);
                                }
                              }}>
                                {allocating ? 'Memproses...' : 'Alokasikan'}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {canPayInvoice(viewInvoice) && (
                    <div className="flex flex-wrap items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-sm text-amber-800">
                        <strong>Tagihan DP:</strong> Minimal {viewInvoice.dp_percentage || 30}% atau input sendiri. Bayar via Transfer Bank (cantumkan nomor rekening), VA, atau QRIS.
                      </p>
                      <Button onClick={openPaymentModal} variant="primary" size="sm">
                        <Wallet className="w-4 h-4 mr-2" /> Bayar DP / Bayar
                      </Button>
                    </div>
                  )}

                  {/* Preview PDF */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
                      <span className="font-semibold text-slate-700 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" /> Preview Invoice PDF
                      </span>
                      <Button size="sm" variant="outline" onClick={() => openPdf(viewInvoice.id)}>
                        <ExternalLink className="w-4 h-4 mr-1" /> Buka di tab baru
                      </Button>
                    </div>
                    <div className="h-[400px] min-h-[300px]">
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
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                      <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600 font-medium">Belum ada bukti pembayaran</p>
                      <p className="text-sm text-slate-500 mt-1">Upload bukti bayar untuk DP atau pelunasan via tombol &quot;Bayar DP / Bayar&quot; di tab Invoice</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paymentProofs.map((p: any) => {
                        const fileUrl = getFileUrl(p.proof_file_url);
                        const ps = getProofStatus(p);
                        const isPending = ps.status === 'pending';
                        return (
                          <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="font-semibold text-slate-800">{getProofDisplayLabel(p)}</span>
                                <span className="text-slate-600 text-sm">
                                  {p.payment_location === 'saudi'
                                    ? `Pembayaran KES${p.payment_currency && p.payment_currency !== 'IDR' ? ` (${p.payment_currency})` : ''}`
                                    : p.bank_name ? `Transfer Bank (${p.bank_name}${p.account_number ? ` ${p.account_number}` : ''})` : 'Transfer'}
                                </span>
                                {p.payment_location === 'saudi' && p.amount_original != null && p.payment_currency && p.payment_currency !== 'IDR' ? (
                                  <span className="text-emerald-600 font-semibold">
                                    Nominal diinput: {p.payment_currency === 'SAR' ? formatSAR(Number(p.amount_original)) : formatUSD(Number(p.amount_original))} = {formatIDR(parseFloat(p.amount))}
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-emerald-600 font-semibold">{formatIDR(parseFloat(p.amount))}</span>
                                    <span className="text-xs text-slate-500">≈ {formatSAR(parseFloat(p.amount) / sarToIdr)} · ≈ {formatUSD(parseFloat(p.amount) / usdToIdr)}</span>
                                  </>
                                )}
                                <Badge variant={ps.variant}>{ps.label}</Badge>
                                {ps.status === 'verified' && (p as any).VerifiedBy?.name && (
                                  <span className="text-xs text-slate-600">Diverifikasi oleh: <strong>{(p as any).VerifiedBy.name}</strong></span>
                                )}
                                {p.transfer_date && <span className="text-xs text-slate-500">Tgl transfer: {formatDate(p.transfer_date)}</span>}
                                {p.created_at && <span className="text-xs text-slate-500">Upload: {new Date(p.created_at).toLocaleString('id-ID')}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                {fileUrl && (
                                  <a href={fileUrl} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline">
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
                                  <span className="text-xs text-emerald-600 font-medium">Pembayaran KES — otomatis terverifikasi</span>
                                )}
                              </div>
                            </div>
                            <div className="p-4 bg-slate-50 min-h-[280px]">
                              <ProofPreview invoiceId={viewInvoice.id} proof={p} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50">
              <Button variant="outline" onClick={closeModal}>Tutup</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Batalkan Invoice: pilih Jadikan saldo atau Minta refund (isi bank & rekening) */}
      {showCancelModal && cancelTargetInv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !deletingOrderId && setShowCancelModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Batalkan Invoice</h3>
            {(() => {
              const paid = parseFloat(cancelTargetInv.paid_amount) || 0;
              if (paid > 0) {
                return (
                  <>
                    <p className="text-sm text-slate-600">
                      Invoice <strong>{cancelTargetInv.invoice_number}</strong> memiliki pembayaran <strong className="text-emerald-600">{formatIDR(paid)}</strong>. Pilih salah satu:
                    </p>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer border-slate-200 hover:border-emerald-300">
                        <input type="radio" name="cancelAction" checked={cancelAction === 'to_balance'} onChange={() => setCancelAction('to_balance')} className="mt-1" />
                        <div>
                          <span className="font-medium text-slate-800">Jadikan saldo</span>
                          <p className="text-xs text-slate-500 mt-0.5">Dana masuk ke saldo akun Anda. Bisa dipakai untuk order baru atau alokasi ke tagihan lain.</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer border-slate-200 hover:border-emerald-300">
                        <input type="radio" name="cancelAction" checked={cancelAction === 'refund'} onChange={() => setCancelAction('refund')} className="mt-1" />
                        <div>
                          <span className="font-medium text-slate-800">Minta refund ke rekening</span>
                          <p className="text-xs text-slate-500 mt-0.5">Admin/accounting akan memproses pengembalian ke rekening Anda.</p>
                        </div>
                      </label>
                    </div>
                    {cancelAction === 'refund' && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <p className="text-xs font-medium text-slate-600">Rekening tujuan refund (wajib)</p>
                        <input type="text" value={cancelBankName} onChange={(e) => setCancelBankName(e.target.value)} placeholder="Nama Bank (contoh: BCA, Mandiri)" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" disabled={!!deletingOrderId} />
                        <input type="text" value={cancelAccountNumber} onChange={(e) => setCancelAccountNumber(e.target.value)} placeholder="Nomor Rekening" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" disabled={!!deletingOrderId} />
                      </div>
                    )}
                    <p className="text-xs text-slate-500">Alasan pembatalan (opsional):</p>
                    <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Contoh: Order salah input..." className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 min-h-[60px] resize-y" disabled={!!deletingOrderId} />
                  </>
                );
              }
              return <p className="text-sm text-slate-600">Batalkan invoice <strong>{cancelTargetInv.invoice_number}</strong>? Tindakan ini tidak dapat dibatalkan.</p>;
            })()}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => { setShowCancelModal(false); setCancelTargetInv(null); setCancelReason(''); setCancelBankName(''); setCancelAccountNumber(''); }} disabled={!!deletingOrderId}>Batal</Button>
              <Button variant="primary" onClick={submitCancelModal} disabled={!!deletingOrderId} className="bg-red-600 hover:bg-red-700">
                {deletingOrderId ? 'Memproses...' : (parseFloat(cancelTargetInv.paid_amount) || 0) > 0 ? (cancelAction === 'to_balance' ? 'Ya, batalkan & jadikan saldo' : 'Ya, batalkan & minta refund') : 'Ya, batalkan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pembayaran (Transfer Bank / VA / QRIS) */}
      {showPaymentModal && viewInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !paySubmitting && setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Pembayaran Invoice</h3>
              <p className="text-sm text-slate-600 mt-0.5">Bayar dengan: <strong>{paymentMethod === 'bank' ? 'Transfer Bank' : paymentMethod === 'va' ? 'Virtual Account' : 'QRIS'}</strong>. Sisa tagihan: {formatIDR(parseFloat(viewInvoice.remaining_amount))} (≈ {formatSAR(parseFloat(viewInvoice.remaining_amount || 0) / sarToIdr)} · ≈ {formatUSD(parseFloat(viewInvoice.remaining_amount || 0) / usdToIdr)}). Pilih metode, input jumlah, lalu upload bukti.</p>
            </div>
            <div className="flex border-b border-slate-200 flex-wrap">
              {isInvoiceSaudi && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('saudi')}
                  className={`flex-1 min-w-[120px] px-4 py-3 text-sm font-medium ${paymentMethod === 'saudi' ? 'border-b-2 border-emerald-600 text-emerald-600 bg-emerald-50/50' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Pembayaran Saudi (SAR/USD)
                </button>
              )}
              {(['bank', 'va', 'qris'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium ${paymentMethod === m ? 'border-b-2 border-emerald-600 text-emerald-600 bg-emerald-50/50' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {m === 'bank' ? 'Transfer Bank' : m === 'va' ? 'Virtual Account' : 'QRIS'}
                </button>
              ))}
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {paymentMethod === 'saudi' && isInvoiceSaudi && (
                <>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">Input pembayaran KES (Saudi) dalam SAR atau USD. Jumlah dikonversi ke IDR sesuai kurs cabang. Pembayaran otomatis terverifikasi (tanpa konfirmasi). Bisa upload bukti KES opsional.</p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Mata uang</label>
                    <select
                      value={payCurrencySaudi}
                      onChange={(e) => setPayCurrencySaudi(e.target.value as 'SAR' | 'USD')}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="SAR">SAR (Riyal Saudi)</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Jumlah bayar ({payCurrencySaudi}) <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      value={payAmountSaudi}
                      onChange={(e) => setPayAmountSaudi(e.target.value.replace(/,/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                      placeholder={payCurrencySaudi === 'SAR' ? 'Contoh: 5000' : 'Contoh: 1500'}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    {payAmountSaudi && !isNaN(parseFloat(payAmountSaudi.replace(/,/g, ''))) && (() => {
                      const amt = parseFloat(payAmountSaudi.replace(/,/g, ''));
                      const idr = payCurrencySaudi === 'SAR' ? amt * sarToIdr : amt * usdToIdr;
                      return (
                        <p className="text-xs text-slate-500 mt-1">≈ {formatIDR(Math.round(idr))} IDR</p>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Tanggal transfer</label>
                    <input
                      type="date"
                      value={payTransferDate}
                      onChange={(e) => setPayTransferDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Upload bukti KES</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                      className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700"
                    />
                    <p className="text-xs text-slate-500 mt-1">Opsional. Bukti transfer KES (foto/screenshot/PDF). Pembayaran otomatis terverifikasi tanpa konfirmasi.</p>
                  </div>
                </>
              )}
              {paymentMethod === 'bank' && (
                <>
                  {bankAccounts.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Rekening tujuan</label>
                      <select
                        value={payBankIndex}
                        onChange={(e) => setPayBankIndex(parseInt(e.target.value, 10))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      >
                        {bankAccounts.map((b, i) => (
                          <option key={i} value={i}>{b.bank_name} – {b.account_number} {b.account_name ? `(${b.account_name})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">Daftar rekening belum dikonfigurasi. Hubungi admin untuk menambah di Business Rules (bank_accounts).</p>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Jumlah bayar (IDR) <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      value={payAmountIdr}
                      onChange={(e) => setPayAmountIdr(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
                      placeholder="Contoh: 5000000"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
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
                          <p><span className="text-slate-600">Dibayar total:</span> <strong className="text-emerald-600">{formatIDR(newPaid)}</strong> ≈ {formatSAR(newPaid / sarToIdr)} · ≈ {formatUSD(newPaid / usdToIdr)}</p>
                          <p><span className="text-slate-600">Sisa:</span> <strong className={newRemain <= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatIDR(Math.max(0, newRemain))}</strong> ≈ {formatSAR(Math.max(0, newRemain) / sarToIdr)} · ≈ {formatUSD(Math.max(0, newRemain) / usdToIdr)}</p>
                          {overpay && <p className="text-amber-700 text-xs">Jumlah melebihi sisa tagihan. Sistem akan catat sebagai pelunasan; kelebihan tidak dikembalikan otomatis.</p>}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Tanggal transfer <span className="text-red-600">*</span></label>
                    <input
                      type="date"
                      value={payTransferDate}
                      onChange={(e) => setPayTransferDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Upload bukti bayar <span className="text-red-600">*</span></label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                      className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700"
                    />
                  </div>
                </>
              )}
              {paymentMethod === 'va' && (
                <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl">Pembayaran via Virtual Account akan tampil di sini setelah nomor VA dikonfigurasi. Untuk saat ini gunakan <strong>Transfer Bank</strong>.</p>
              )}
              {paymentMethod === 'qris' && (
                <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl">QRIS: Masukkan jumlah yang ingin dibayar lalu QR code akan tampil (integrasi payment gateway). Untuk saat ini gunakan <strong>Transfer Bank</strong>.</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)} disabled={paySubmitting}>Batal</Button>
              <Button variant="primary" onClick={handleSubmitPayment} disabled={paySubmitting}>
                {paySubmitting ? 'Menyimpan...' : paymentMethod === 'saudi' ? 'Simpan Pembayaran Saudi' : paymentMethod === 'bank' ? 'Upload Bukti Bayar' : 'Lanjut'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersInvoicesPage;
