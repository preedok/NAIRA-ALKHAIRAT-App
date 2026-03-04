import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Unlock,
  Search,
  ChevronRight,
  FileText,
  DollarSign,
  Wallet
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl } from '../../../components/common';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import ContentLoading from '../../../components/common/ContentLoading';
import Table from '../../../components/common/Table';
import { formatIDR, formatInvoiceNumberDisplay } from '../../../utils';
import type { TableColumn } from '../../../types';
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

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
        const owner = (inv.User?.name ?? inv.Order?.User?.name ?? '').toLowerCase();
        const branch = (inv.Branch?.name ?? inv.Branch?.code ?? '').toLowerCase();
        return invNum.includes(q) || owner.includes(q) || branch.includes(q);
      })
    : invoices;
  const totalFiltered = filteredRecent.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
  const pagedInvoices = filteredRecent.slice((page - 1) * limit, page * limit);

  const invoiceTableColumns: TableColumn[] = [
    { id: 'invoice_number', label: 'No. Invoice', align: 'left' },
    { id: 'status', label: 'Status', align: 'left' },
    { id: 'owner', label: 'Owner', align: 'left' },
    { id: 'company', label: 'Perusahaan', align: 'left' },
    { id: 'total', label: 'Total', align: 'right' },
    { id: 'paid', label: 'Terbayar', align: 'right' },
    { id: 'remaining', label: 'Sisa', align: 'right' },
    { id: 'due_date_dp', label: 'Jatuh Tempo DP', align: 'left' },
    { id: 'actions', label: 'Aksi', align: 'left' }
  ];

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

  const scopeLabel = user?.role === 'invoice_saudi' ? 'Semua wilayah' : 'Cabang Anda';

  const invoiceSubtitle = user?.role === 'invoice_saudi'
    ? 'Semua invoice seluruh wilayah. Input pembayaran SAR/USD/IDR + upload bukti bayar; sistem update sisa tagihan otomatis.'
    : `Rekapitulasi pekerjaan invoice ${scopeLabel.toLowerCase()}.`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoice Dashboard"
        subtitle={invoiceSubtitle}
        right={
          <>
            <AutoRefreshControl onRefresh={fetchData} disabled={loading} size="sm" />
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>
              <Receipt className="w-4 h-4 mr-2" />
              Semua Invoice
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pending Verifikasi" value={pendingVerification.length} subtitle="Bukti bayar perlu diverifikasi" iconClassName="bg-amber-100 text-amber-600" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Terverifikasi Hari Ini" value={`${verifiedToday.length} invoice`} subtitle={verifiedToday.length ? formatIDR(verifiedTodayAmount) : '–'} iconClassName="bg-emerald-100 text-emerald-600" />
        <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Invoice" value={summary?.total_invoices ?? invoices.length} subtitle={scopeLabel} iconClassName="bg-sky-100 text-sky-600" />
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="Terblokir (DP Overdue)" value={blockedInvoices.length} subtitle="Bisa diaktifkan kembali" iconClassName="bg-red-100 text-red-600" />
      </div>

      {/* Ringkasan nominal (summary) — pakai StatCard agar seragam */}
      {summary && (summary.total_amount > 0 || summary.total_paid > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Tagihan" value={formatIDR(summary.total_amount)} />
          <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Total Terbayar" value={formatIDR(summary.total_paid)} />
          <StatCard icon={<Wallet className="w-5 h-5" />} label="Sisa" value={formatIDR(summary.total_remaining)} />
        </div>
      )}

      {/* Invoice Terbaru (wilayah) – data invoice lengkap */}
      <Card>
        <div className="p-4 border-b border-slate-100">
          <CardSectionHeader
            icon={<FileText className="w-6 h-6" />}
            title="Invoice Terbaru (wilayah)"
            subtitle="Invoice di wilayah Anda. Cari no. invoice, order, owner, atau cabang."
            right={
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
            }
            className="mb-0"
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 relative min-h-[200px]">
          {loading ? (
            <ContentLoading />
          ) : (
        <Table
          columns={invoiceTableColumns}
          data={pagedInvoices}
          emptyMessage={invoices.length === 0 ? 'Belum ada invoice.' : 'Tidak ada hasil untuk pencarian ini.'}
          stickyActionsColumn
          pagination={
            totalFiltered > 0
              ? {
                  total: totalFiltered,
                  page,
                  limit,
                  totalPages,
                  onPageChange: setPage,
                  onLimitChange: (l) => { setLimit(l); setPage(1); }
                }
              : undefined
          }
          renderRow={(inv) => {
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
                <td className="py-3 px-4 text-slate-700 align-top">{inv.User?.name ?? inv.Order?.User?.name ?? '–'}</td>
                <td className="py-3 px-4 align-top text-sm">
                  <div>{inv.User?.company_name || inv.User?.name || inv.Branch?.name || '–'}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{[inv.Branch?.Provinsi?.Wilayah?.name, inv.Branch?.Provinsi?.name, inv.Branch?.city].filter(Boolean).join(' · ') || '–'}</div>
                </td>
                <td className="py-3 px-4 text-right font-medium tabular-nums">{formatIDR(total)}</td>
                <td className="py-3 px-4 text-right tabular-nums text-emerald-700">{formatIDR(paid)}</td>
                <td className="py-3 px-4 text-right tabular-nums text-slate-700">{formatIDR(remaining)}</td>
                <td className="py-3 px-4 text-slate-600">{formatDate(inv.due_date_dp)}</td>
                <td className="py-3 px-4">
                  <Button size="sm" variant="outline" onClick={() => openInvoice(inv)}>
                    <Eye className="w-4 h-4 mr-1" /> Buka
                  </Button>
                </td>
              </tr>
            );
          }}
        />
          )}
        </div>
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
                      {formatInvoiceNumberDisplay(inv, INVOICE_STATUS_LABELS)}
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
                    {formatInvoiceNumberDisplay(inv, INVOICE_STATUS_LABELS)}
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
