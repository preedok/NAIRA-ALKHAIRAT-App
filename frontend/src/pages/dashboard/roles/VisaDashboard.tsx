import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, RefreshCw, ClipboardList, Inbox, Send, Loader2, CheckCircle, Check } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import StatCard from '../../../components/common/StatCard';
import CardSectionHeader from '../../../components/common/CardSectionHeader';
import { visaApi } from '../../../services/api';
import type { VisaDashboardData } from '../../../services/api';

const RECAP_STATUS_LABELS: Record<string, string> = {
  document_received: 'Dok. Diterima',
  submitted: 'Terkirim',
  in_process: 'Proses',
  approved: 'Disetujui',
  issued: 'Terbit'
};

const STATUS_ORDER = ['document_received', 'submitted', 'in_process', 'approved', 'issued'];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  document_received: <Inbox className="h-6 w-6" />,
  submitted: <Send className="h-6 w-6" />,
  in_process: <Loader2 className="h-6 w-6" />,
  approved: <Check className="h-6 w-6" />,
  issued: <CheckCircle className="h-6 w-6" />
};

const STATUS_COLORS: Record<string, string> = {
  document_received: 'bg-sky-100 text-sky-600',
  submitted: 'bg-violet-100 text-violet-600',
  in_process: 'bg-amber-100 text-amber-600',
  approved: 'bg-teal-100 text-teal-600',
  issued: 'bg-emerald-100 text-emerald-600'
};

const VisaDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<VisaDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await visaApi.getDashboard();
      if (res.data.success && res.data.data) setData(res.data.data);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  const byStatus = data?.by_status || {};
  const totalInvoices = data?.total_invoices ?? 0;
  const totalItems = data?.total_visa_items ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-sky-100 rounded-2xl shadow-sm shrink-0">
            <FileText className="w-8 h-8 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Visa</h1>
            <p className="text-slate-600 text-sm mt-1">Rekap statistik pekerjaan visa (penerbitan & dokumen Nusuk) cabang Anda.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading} className="rounded-xl">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Invoice" value={totalInvoices} subtitle="Invoice dengan item visa" iconClassName="bg-slate-100 text-slate-600" />
          <StatCard icon={<FileText className="w-5 h-5" />} label="Item Visa" value={totalItems} subtitle="Item visa di cabang" iconClassName="bg-sky-100 text-sky-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Per Status</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {STATUS_ORDER.map((status) => (
              <StatCard
                key={status}
                icon={STATUS_ICONS[status] || <FileText className="w-5 h-5" />}
                label={RECAP_STATUS_LABELS[status] || status}
                value={byStatus[status] ?? 0}
              />
            ))}
          </div>
        </div>
      </div>

      <Card className="p-6 rounded-2xl border border-slate-200/80 shadow-sm bg-white">
        <CardSectionHeader
          icon={<FileText className="w-6 h-6" />}
          title="Progress Visa"
          subtitle="Kelola invoice visa, update status, dan upload dokumen terbit di menu Progress Visa."
          right={
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/progress-visa')} className="rounded-xl">
              <FileText className="w-4 h-4 mr-2" /> Buka Progress Visa
            </Button>
          }
        />
      </Card>
    </div>
  );
};

export default VisaDashboard;
