import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  Receipt, 
  Package, 
  DollarSign, 
  Plus,
  MapPin,
  Bell,
  FileText,
  Eye,
  Sparkles,
  Wallet
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import ContentLoading from '../../../components/common/ContentLoading';
import { AutoRefreshControl } from '../../../components/common';
import { InvoiceNumberCell } from '../../../components/common/InvoiceNumberCell';
import { getEffectiveInvoiceStatusLabel, getEffectiveInvoiceStatusBadgeVariant } from '../../../components/common/InvoiceStatusRefundCell';
import { NominalDisplay } from '../../../components/common';
import { INVOICE_STATUS_LABELS as INVOICE_STATUS_LABELS_GLOBAL } from '../../../utils/constants';
import { getDisplayRemaining } from '../../../utils/invoiceTableHelpers';
import { invoicesApi, ownersApi, type InvoicesSummaryData } from '../../../services/api';

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<InvoicesSummaryData | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerProfile, setOwnerProfile] = useState<{ mou_generated_url?: string } | null>(null);
  const [balanceData, setBalanceData] = useState<{ balance: number; transactions: Array<{ id: string; amount: number; type: string; notes?: string; created_at: string }> } | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, listRes, meRes, balanceRes] = await Promise.all([
        invoicesApi.getSummary({}),
        invoicesApi.list({ limit: 10, sort_by: 'created_at', sort_order: 'desc' }),
        ownersApi.getMe().catch(() => ({ data: { success: false, data: undefined } })),
        ownersApi.getMyBalance().catch(() => ({ data: { success: false, data: undefined } }))
      ]);
      if (summaryRes.data.success && summaryRes.data.data) setSummary(summaryRes.data.data);
      if (listRes.data.success && Array.isArray(listRes.data.data)) setRecentInvoices(listRes.data.data);
      const meData = (meRes.data as { success?: boolean; data?: { mou_generated_url?: string } } | undefined)?.data;
      if (meData) setOwnerProfile(meData);
      const bal = (balanceRes.data as { success?: boolean; data?: { balance: number; transactions: any[] } } | undefined)?.data;
      if (bal) setBalanceData({ balance: bal.balance ?? 0, transactions: bal.transactions ?? [] });
      else setBalanceData(null);
    } catch {
      setSummary(null);
      setRecentInvoices([]);
      setBalanceData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const pendingCount = summary ? (summary.by_invoice_status?.tentative || 0) + (summary.by_invoice_status?.partial_paid || 0) : 0;
  const stats = [
    {
      title: 'Total Trip',
      value: loading ? '...' : String(summary?.total_orders ?? 0),
      subtitle: 'Trip Anda',
      trend: 'up' as const,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'from-blue-800 to-blue-600'
    },
    {
      title: 'Total Dibayar',
      value: loading ? '...' : <NominalDisplay amount={summary?.total_paid ?? 0} currency="IDR" />,
      subtitle: 'Sudah dibayar ke Bintang Global',
      trend: 'up' as const,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Total Invoice',
      value: loading ? '...' : String(summary?.total_invoices ?? 0),
      subtitle: 'Invoice Anda',
      trend: 'up' as const,
      icon: <Receipt className="w-6 h-6" />,
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Belum Lunas',
      value: loading ? '...' : `${pendingCount} invoice`,
      subtitle: <><NominalDisplay amount={summary?.total_remaining ?? 0} currency="IDR" /> outstanding</>,
      trend: 'neutral' as const,
      icon: <Receipt className="w-6 h-6" />,
      color: 'from-orange-500 to-red-500'
    }
  ];

  const hasSpecialPrice = user?.has_special_price || false;

  const isLunas = (inv: any) => (inv.status || '').toLowerCase() === 'paid' || parseFloat(inv.remaining_amount || 0) <= 0;
  const pendingPayments = recentInvoices.filter((inv) => !isLunas(inv));
  const INVOICE_STATUS_LABELS: Record<string, string> = {
    tentative: 'Tagihan DP',
    partial_paid: 'Pembayaran DP',
    paid: 'Lunas',
    canceled: 'Dibatalkan',
    overdue: 'Overdue',
    order_updated: 'Invoice Diupdate'
  };

  const getStatusBadge = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
    const map: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
      completed: 'success',
      processing: 'info',
      confirmed: 'success',
      pending: 'warning',
      cancelled: 'error',
      tentative: 'warning',
      definite: 'info',
      lunas: 'success'
    };
    return map[status] || 'default';
  };

  return (
    <div className="space-y-8 w-full">
      <div className="flex justify-end">
        <AutoRefreshControl onRefresh={fetchDashboard} disabled={loading} size="sm" />
      </div>
      {/* Notifikasi: Akun telah diaktivasi, MoU tersedia */}
      {ownerProfile?.mou_generated_url && (
        <Card className="bg-primary-50 border-primary-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-stone-900">Akun Anda telah diaktivasi</p>
                <p className="text-sm text-slate-600 mt-0.5">Surat MoU dan password baru telah dikirim ke email Anda. Anda juga dapat melihat dan mengunduh surat MoU di aplikasi.</p>
              </div>
            </div>
            <Button variant="primary" onClick={() => navigate('/dashboard/profile')} className="gap-2 shrink-0">
              <FileText className="w-4 h-4" />
              Lihat MoU di Profil
            </Button>
          </div>
        </Card>
      )}

      {/* Travel-style Hero */}
      <div className="travel-hero-bg rounded-travel-lg p-6 sm:p-8 border border-stone-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-primary-600 font-semibold text-sm uppercase tracking-wide">Selamat datang</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
              {user?.company_name || user?.name}
            </h1>
            <p className="text-stone-600 mt-1 flex items-center gap-2 flex-wrap">
              <span>{user?.name}</span>
              {hasSpecialPrice && (
                <Badge variant="success" className="text-xs">⭐ Harga Khusus</Badge>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <Button variant="primary" className="w-full gap-2" onClick={() => navigate('/dashboard/orders-invoices')}>
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Buat Pesanan</span>
              <span className="sm:hidden">Pesan</span>
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard/products')}>
              <Package className="w-5 h-5 sm:mr-1" />
              <span className="hidden sm:inline">Lihat Paket</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard
            key={index}
            icon={stat.icon}
            label={stat.title}
            value={stat.value}
            subtitle={stat.subtitle}
            iconClassName={[
              'bg-blue-100 text-blue-800',
              'bg-sky-100 text-sky-600',
              'bg-violet-100 text-violet-600',
              'bg-amber-100 text-amber-600'
            ][index]}
            onClick={() => navigate('/dashboard/orders-invoices')}
            action={<div onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="gap-1 w-full justify-center" onClick={() => navigate('/dashboard/orders-invoices')}><Eye className="w-4 h-4" /> Lihat</Button></div>}
          />
        ))}
      </div>

      {/* Saldo Akun */}
      <Card className="travel-card border-emerald-200 bg-emerald-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">Saldo Akun</h3>
              <p className="text-sm text-stone-600 mt-0.5">Dana dari pembatalan order. Bisa dialokasikan ke tagihan invoice atau dipakai untuk pesanan.</p>
              {loading ? (
                <p className="text-stone-500 mt-2">Memuat...</p>
              ) : (
                <p className="text-2xl font-bold text-emerald-700 mt-2"><NominalDisplay amount={balanceData?.balance ?? 0} currency="IDR" /></p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/orders-invoices')} className="gap-1">
              <Receipt className="w-4 h-4" />
              Alokasi ke Invoice
            </Button>
          </div>
        </div>
        {balanceData && balanceData.transactions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-emerald-200/80">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Riwayat terakhir</p>
            <ul className="space-y-2 max-h-32 overflow-y-auto">
              {balanceData.transactions.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-sm py-1">
                  <span className="text-stone-600 truncate flex-1 min-w-0">{t.notes || (Number(t.amount) >= 0 ? 'Kredit' : 'Debit')}</span>
                  <span className={`shrink-0 font-medium ${Number(t.amount) >= 0 ? 'text-emerald-600' : 'text-stone-700'}`}>
                    {Number(t.amount) >= 0 ? '+' : ''}<NominalDisplay amount={Math.abs(Number(t.amount))} currency="IDR" />
                  </span>
                  <span className="text-stone-400 text-xs shrink-0">{formatDate(t.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Quick Actions - full width */}
      <Card className="travel-card">
        <CardSectionHeader title="Aksi Cepat" subtitle="Pesan baru, paket, invoice, lacak, asisten AI." className="mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full">
          <button
            type="button"
            onClick={() => navigate('/dashboard/ai-chat')}
            className="w-full flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-primary-200 bg-primary-50/50 hover:border-primary-400 hover:bg-primary-100/50 transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-6 h-6 text-primary-600" />
            <span className="text-sm font-medium text-stone-700">Asisten AI</span>
            <span className="text-xs text-stone-500">Tanya & nego, isi order</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/orders-invoices')}
            className="w-full flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-stone-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all active:scale-[0.98]"
          >
            <Plus className="w-6 h-6 text-primary-500" />
            <span className="text-sm font-medium text-stone-700">Pesan Baru</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/products')}
            className="w-full flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-stone-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all active:scale-[0.98]"
          >
            <Package className="w-6 h-6 text-primary-500" />
            <span className="text-sm font-medium text-stone-700">Paket</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/orders-invoices')}
            className="w-full flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-stone-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all active:scale-[0.98]"
          >
            <Receipt className="w-6 h-6 text-primary-500" />
            <span className="text-sm font-medium text-stone-700">Invoice</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/orders-invoices')}
            className="w-full flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-stone-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all active:scale-[0.98]"
          >
            <MapPin className="w-6 h-6 text-primary-500" />
            <span className="text-sm font-medium text-stone-700">Lacak</span>
          </button>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Paket - CTA */}
        <div className="lg:col-span-2">
          <Card className="travel-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Paket</h3>
              <Button variant="primary" size="sm" className="w-full sm:w-auto" onClick={() => navigate('/dashboard/products')}>Lihat Semua Paket</Button>
            </div>
            <p className="text-sm text-stone-600">Lihat paket umroh & travel untuk membuat pesanan baru.</p>
          </Card>
        </div>

        {/* Notifikasi */}
        <div>
          <Card className="travel-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Notifikasi</h3>
              <Bell className="w-5 h-5 text-stone-400" />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-stone-500">Belum ada notifikasi.</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Invoice Saya - data owner */}
      <Card className="travel-card">
        <CardSectionHeader icon={<Receipt className="w-6 h-6" />} title="Invoice Saya" subtitle="Daftar invoice Anda. Buat pesanan untuk membuat invoice." right={<Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>Lihat Semua</Button>} className="mb-4" />
        <div className="space-y-4">
          {loading ? (
            <ContentLoading minHeight={120} />
          ) : recentInvoices.length === 0 ? (
            <p className="text-stone-500 py-4">Belum ada invoice. Buat pesanan untuk membuat invoice.</p>
          ) : (
            recentInvoices.slice(0, 5).map((inv) => (
            <div key={inv.id} className="p-4 sm:p-5 bg-stone-50 rounded-travel border border-stone-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <div className="font-semibold text-stone-900 font-mono"><InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS_GLOBAL} compact /></div>
                    <Badge variant={getEffectiveInvoiceStatusBadgeVariant(inv)}>{getEffectiveInvoiceStatusLabel(inv)}</Badge>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">{formatDate(inv.issued_at || inv.created_at)}</p>
                </div>
                <p className="text-lg font-bold text-primary-600"><NominalDisplay amount={parseFloat(inv.total_amount || 0)} currency="IDR" /></p>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => navigate('/dashboard/orders-invoices')}>
                Detail Invoice
              </Button>
            </div>
            ))
          )}
        </div>
      </Card>

      {/* Pembayaran Tertunda & Keberangkatan */}
      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="travel-card">
          <CardSectionHeader icon={<Receipt className="w-6 h-6" />} title="Pembayaran Tertunda" subtitle="Invoice yang belum lunas. Upload bukti bayar sebelum jatuh tempo." right={<Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>Semua</Button>} className="mb-4" />
          <div className="space-y-4">
            {pendingPayments.length === 0 ? (
              <p className="text-stone-500 py-4">Tidak ada pembayaran tertunda.</p>
            ) : (
              pendingPayments.slice(0, 5).map((inv) => {
                const due = inv.due_date_dp ? new Date(inv.due_date_dp) : null;
                const now = new Date();
                const daysLeft = due ? Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;
                const urgent = daysLeft !== null && daysLeft <= 3;
                return (
                  <div key={inv.id} className={`p-4 rounded-travel border-2 ${urgent ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-stone-900 font-mono"><InvoiceNumberCell inv={inv} statusLabels={INVOICE_STATUS_LABELS_GLOBAL} compact /></div>
                      </div>
                      <Badge variant={getEffectiveInvoiceStatusBadgeVariant(inv)}>{getEffectiveInvoiceStatusLabel(inv)}</Badge>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Total</span>
                        <span className="font-semibold text-stone-900"><NominalDisplay amount={parseFloat(inv.total_amount || 0)} currency="IDR" /></span>
                      </div>
                      {parseFloat(inv.paid_amount || 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-600">Terbayar</span>
                          <span className="font-semibold text-primary-600"><NominalDisplay amount={parseFloat(inv.paid_amount || 0)} currency="IDR" /></span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Sisa</span>
                        <span className="font-bold text-red-600"><NominalDisplay amount={getDisplayRemaining(inv)} currency="IDR" /></span>
                      </div>
                    </div>
                    {due && (
                      <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                        <span className="text-sm text-stone-600">Jatuh tempo: {formatDate(inv.due_date_dp)}</span>
                        {urgent && daysLeft !== null && <Badge variant="error" size="sm">{daysLeft} hari</Badge>}
                      </div>
                    )}
                    {!isLunas(inv) && (
                      <Button variant="primary" size="sm" className="w-full mt-3" onClick={() => navigate('/dashboard/orders-invoices')}>
                        Upload Bukti Bayar
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="travel-card">
          <CardSectionHeader icon={<MapPin className="w-6 h-6" />} title="Jadwal Keberangkatan" subtitle="Lihat invoice untuk detail perjalanan." right={<Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>Semua</Button>} className="mb-4" />
          <div className="space-y-4">
            <p className="text-stone-500 py-4 text-sm">Lihat invoice untuk detail perjalanan.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OwnerDashboard;