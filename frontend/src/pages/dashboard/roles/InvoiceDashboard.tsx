import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
  Unlock,
  Search,
  ChevronRight,
  FileText,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { formatIDR } from '../../../utils';
import { INVOICE_STATUS_LABELS } from '../../../utils/constants';
import { invoicesApi } from '../../../services/api';
import type { InvoicesSummaryData } from '../../../services/api';

const formatDate = (d: string | null | undefined) => {
  if (!d) return '–';
  try {
    const date = new Date(d);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '–';
  }
};

const InvoiceDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<InvoicesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, sumRes] = await Promise.all([
        invoicesApi.list({ limit: 50, page: 1, sort_by: 'created_at', sort_order: 'desc' }),
        invoicesApi.getSummary({})
      ]);
      if (invRes.data.success) setInvoices(invRes.data.data || []);
      if (sumRes.data?.success && sumRes.data.data) setSummary(sumRes.data.data);
    } catch {
      setInvoices([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pendingVerification = invoices.filter(
    (inv) => inv.PaymentProofs?.length > 0 && inv.PaymentProofs.some((p: any) => !p.verified_at)
  );
  const blockedInvoices = invoices.filter((inv) => inv.is_blocked);
  const today = new Date().toISOString().slice(0, 10);
  const verifiedToday = invoices.filter((inv) =>
    inv.PaymentProofs?.some((p: any) => p.verified_at && String(p.verified_at).slice(0, 10) === today)
  );
  const verifiedTodayAmount = verifiedToday.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0);

  const filteredRecent = searchQuery.trim()
    ? invoices.filter((inv) => {
        const q = searchQuery.trim().toLowerCase();
        const invNum = (inv.invoice_number ?? '').toLowerCase();
        const orderNum = (inv.Order?.order_number ?? '').toLowerCase();
        const owner = (inv.User?.name ?? inv.Order?.User?.name ?? '').toLowerCase();
        const branch = (inv.Branch?.name ?? inv.Branch?.code ?? '').toLowerCase();
        return invNum.includes(q) || orderNum.includes(q) || owner.includes(q) || branch.includes(q);
      })
    : invoices;
  const recentInvoices = filteredRecent.slice(0, 25);

  const handleUnblock = async (invoiceId: string) => {
    try {
      await invoicesApi.unblock(invoiceId);
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal unblock');
    }
  };

  const openInvoice = (inv: any) => {
    navigate(`/dashboard/orders-invoices?tab=invoices&invoice_id=${inv.id}`);
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  const scopeLabel = user?.role === 'role_invoice_saudi' ? 'Semua wilayah' : 'Cabang Anda';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoice Dashboard</h1>
          <p className="text-slate-600 mt-1">
            {user?.role === 'role_invoice_saudi'
              ? 'Semua invoice seluruh wilayah. Input pembayaran SAR/USD otomatis update invoice.'
              : `Rekapitulasi pekerjaan invoice ${scopeLabel.toLowerCase()}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>
            <Receipt className="w-4 h-4 mr-2" />
            Semua Invoice
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hover className="p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-amber-100 text-amber-600 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending Verifikasi</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{pendingVerification.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Bukti bayar perlu diverifikasi</p>
            </div>
          </div>
        </Card>
        <Card hover className="p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-100 text-emerald-600 shrink-0">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Terverifikasi Hari Ini</p>
              <p className="text-xl font-bold tabular-nums text-slate-900 mt-1">{verifiedToday.length} invoice</p>
              <p className="text-xs text-slate-500 mt-0.5">{verifiedToday.length ? formatIDR(verifiedTodayAmount) : '–'}</p>
            </div>
          </div>
        </Card>
        <Card hover className="p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-sky-100 text-sky-600 shrink-0">
              <Receipt className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Invoice</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{summary?.total_invoices ?? invoices.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">{scopeLabel}</p>
            </div>
          </div>
        </Card>
        <Card hover className="p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-red-100 text-red-600 shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Terblokir (DP Overdue)</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{blockedInvoices.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Bisa diaktifkan kembali</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Ringkasan nominal (summary) */}
      {summary && (summary.total_amount > 0 || summary.total_paid > 0) && (
        <Card className="border-primary-100 bg-primary-50/20">
          <div className="flex flex-wrap items-center gap-6 py-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium text-stone-700">Total Tagihan:</span>
              <span className="font-bold tabular-nums text-stone-900">{formatIDR(summary.total_amount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-stone-700">Total Terbayar:</span>
              <span className="font-bold tabular-nums text-stone-900">{formatIDR(summary.total_paid)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-stone-700">Sisa:</span>
              <span className="font-bold tabular-nums text-stone-900">{formatIDR(summary.total_remaining)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Invoice Terbaru (wilayah) – data invoice lengkap */}
      <Card>
        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Invoice Terbaru (wilayah)
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Cari no. invoice, order, owner, cabang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
        {recentInvoices.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            {invoices.length === 0 ? 'Belum ada invoice.' : 'Tidak ada hasil untuk pencarian ini.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">No. Invoice</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Owner</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Cabang</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Total</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Terbayar</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Sisa</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Jatuh Tempo DP</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">No. Order</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => {
                  const total = parseFloat(inv.total_amount || 0);
                  const paid = parseFloat(inv.paid_amount || 0);
                  const remaining = total - paid;
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-slate-900">{inv.invoice_number || '–'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={inv.status === 'paid' || inv.status === 'completed' ? 'success' : inv.status === 'overdue' ? 'error' : 'warning'}>
                          {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{inv.User?.name ?? inv.Order?.User?.name ?? '–'}</td>
                      <td className="py-3 px-4 text-slate-600">{inv.Branch?.name ?? inv.Branch?.code ?? '–'}</td>
                      <td className="py-3 px-4 text-right font-medium tabular-nums">{formatIDR(total)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-700">{formatIDR(paid)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-700">{formatIDR(remaining)}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(inv.due_date_dp)}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-xs">{inv.Order?.order_number ?? '–'}</td>
                      <td className="py-3 px-4">
                        <Button size="sm" variant="outline" onClick={() => openInvoice(inv)}>
                          <Eye className="w-4 h-4 mr-1" /> Buka
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {invoices.length > 0 && (
          <div className="p-3 border-t border-slate-100 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>
              Lihat semua invoice <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </Card>

      {/* Pending Verifikasi – tampilkan data invoice (no. invoice utama) */}
      {pendingVerification.length > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Pending Verifikasi Bukti Bayar
          </h3>
          <div className="space-y-3">
            {pendingVerification.slice(0, 10).map((inv) => {
              const proof = inv.PaymentProofs?.find((p: any) => !p.verified_at);
              return (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {inv.invoice_number || '–'}
                      <span className="text-slate-500 font-normal ml-2">Order: {inv.Order?.order_number ?? '–'}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {inv.User?.name ?? inv.Order?.User?.name} · Cabang: {inv.Branch?.name ?? inv.Branch?.code ?? '–'} · Total {formatIDR(inv.total_amount)}
                    </p>
                    {proof && (
                      <p className="text-xs text-slate-500 mt-1">
                        Klaim: {formatIDR(proof.amount)} · {proof.bank_name || '-'}
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => navigate('/dashboard/orders-invoices?tab=invoices')}>
                    <Eye className="w-4 h-4 mr-2" /> Verifikasi
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Invoice Terblokir – data invoice lengkap */}
      {blockedInvoices.length > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Invoice Terblokir (DP lewat waktu)
          </h3>
          <p className="text-sm text-slate-600 mb-4">Aktifkan kembali agar owner bisa upload bukti bayar.</p>
          <div className="space-y-3">
            {blockedInvoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-red-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-900">
                    {inv.invoice_number || '–'}
                    <span className="text-slate-500 font-normal ml-2">Order: {inv.Order?.order_number ?? '–'}</span>
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {inv.User?.name ?? inv.Order?.User?.name} · Cabang: {inv.Branch?.name ?? inv.Branch?.code ?? '–'} · {formatIDR(inv.total_amount)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleUnblock(inv.id)}>
                  <Unlock className="w-4 h-4 mr-2" /> Aktifkan Kembali
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {invoices.length === 0 && !loading && (
        <Card>
          <p className="text-slate-600 text-center py-8">Belum ada invoice. Buat order lalu buat invoice dari menu Order / Invoices.</p>
        </Card>
      )}
    </div>
  );
};

export default InvoiceDashboard;
