import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  RefreshCw,
  Eye,
  Download,
  Unlock
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { formatIDR } from '../../../utils';
import { invoicesApi, ordersApi } from '../../../services/api';

const InvoiceDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, ordRes] = await Promise.all([
        invoicesApi.list({}),
        ordersApi.list({})
      ]);
      if (invRes.data.success) setInvoices(invRes.data.data || []);
      if (ordRes.data.success) setOrders(ordRes.data.data || []);
    } catch {
      setInvoices([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pendingVerification = invoices.filter(
    inv => (inv.PaymentProofs?.length > 0) && inv.PaymentProofs.some((p: any) => !p.verified_at)
  );
  const blockedInvoices = invoices.filter(inv => inv.is_blocked);
  const today = new Date().toISOString().slice(0, 10);
  const verifiedToday = invoices.filter(
    inv => inv.PaymentProofs?.some((p: any) => p.verified_at && String(p.verified_at).slice(0, 10) === today)
  );

  const stats = [
    {
      title: 'Pending Verification',
      value: String(pendingVerification.length),
      subtitle: 'Bukti bayar perlu diverifikasi',
      icon: <Clock className="w-6 h-6" />,
      color: 'from-yellow-500 to-orange-500',
      urgent: pendingVerification.length > 0
    },
    {
      title: 'Verified Today',
      value: String(verifiedToday.length),
      subtitle: verifiedToday.length ? formatIDR(verifiedToday.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0)) : '-',
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'from-emerald-500 to-teal-500'
    },
    {
      title: 'Total Invoices',
      value: String(invoices.length),
      subtitle: user?.role === 'role_invoice_saudi' ? 'Semua wilayah' : 'Cabang Anda',
      icon: <Receipt className="w-6 h-6" />,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Blocked (Overdue DP)',
      value: String(blockedInvoices.length),
      subtitle: 'Bisa diaktifkan kembali',
      icon: <AlertCircle className="w-6 h-6" />,
      color: 'from-red-500 to-pink-500'
    }
  ];

  const handleUnblock = async (invoiceId: string) => {
    try {
      await invoicesApi.unblock(invoiceId);
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal unblock');
    }
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoice Dashboard</h1>
          <p className="text-slate-600 mt-1">
            {user?.role === 'role_invoice_saudi' ? 'Semua invoice seluruh wilayah. Input pembayaran SAR/USD otomatis update invoice.' : 'Rekapitulasi pekerjaan invoice cabang Anda'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>
            <Receipt className="w-4 h-4 mr-2" />
            Semua Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/orders-invoices')}>
            <Receipt className="w-4 h-4 mr-2" />
            Order
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} hover className={stat.urgent ? 'border-2 border-yellow-300' : ''}>
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white`}>{stat.icon}</div>
              {stat.urgent && <Badge variant="warning" size="sm">Perhatian</Badge>}
            </div>
            <p className="text-sm text-slate-600 mb-1">{stat.title}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.subtitle}</p>
          </Card>
        ))}
      </div>

      {pendingVerification.length > 0 && (
        <Card>
          <h3 className="text-xl font-bold text-slate-900 mb-4">Pending Verifikasi Bukti Bayar</h3>
          <div className="space-y-3">
            {pendingVerification.slice(0, 10).map((inv) => {
              const proof = inv.PaymentProofs?.find((p: any) => !p.verified_at);
              return (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-slate-900">{inv.invoice_number} · {inv.Order?.order_number}</p>
                    <p className="text-sm text-slate-600">{inv.User?.name} · Total {formatIDR(inv.total_amount)}</p>
                    {proof && <p className="text-xs text-slate-500 mt-1">Klaim: {formatIDR(proof.amount)} · {proof.bank_name || '-'}</p>}
                  </div>
                  <Button size="sm" onClick={() => navigate(`/dashboard/orders-invoices?tab=invoices`)}>
                    <Eye className="w-4 h-4 mr-2" /> Verifikasi
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {blockedInvoices.length > 0 && (
        <Card>
          <h3 className="text-xl font-bold text-slate-900 mb-4">Invoice Terblokir (DP lewat waktu)</h3>
          <p className="text-sm text-slate-600 mb-4">Aktifkan kembali agar owner bisa upload bukti bayar.</p>
          <div className="space-y-3">
            {blockedInvoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-red-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-900">{inv.invoice_number} · {inv.Order?.order_number}</p>
                  <p className="text-sm text-slate-600">{inv.User?.name} · {formatIDR(inv.total_amount)}</p>
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
