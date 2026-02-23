import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, RefreshCw, ClipboardList } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
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
  const totalOrders = data?.total_orders ?? 0;
  const totalItems = data?.total_visa_items ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Visa</h1>
          <p className="text-slate-600 mt-1">Rekap statistik pekerjaan visa (penerbitan & dokumen Nusuk) cabang Anda.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <ClipboardList className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Order</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalOrders}</div>
          <p className="text-xs text-slate-500 mt-1">Order dengan item visa</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Total Item Visa</div>
          <div className="text-2xl font-bold text-slate-900">{totalItems}</div>
          <p className="text-xs text-slate-500 mt-1">Item visa di cabang</p>
        </Card>
        {STATUS_ORDER.map((status) => (
          <Card key={status} className="p-4">
            <div className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">{RECAP_STATUS_LABELS[status] || status}</div>
            <div className="text-xl font-bold text-slate-800">{byStatus[status] ?? 0}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Pekerjaan Visa</h3>
            <p className="text-sm text-slate-600 mt-0.5">Kelola order visa, update status, dan upload dokumen terbit di menu Visa.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/dashboard/visa')}>
            <FileText className="w-4 h-4 mr-2" /> Buka Menu Visa
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default VisaDashboard;
