import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { accountingApi, type MySlipItem } from '../../../services/api';
import { formatIDR } from '../../../utils';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const MySlipGajiPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [slips, setSlips] = useState<MySlipItem[]>([]);

  useEffect(() => {
    setLoading(true);
    accountingApi.payroll.getMySlips()
      .then((r) => {
        if (r.data.success) setSlips(r.data.data || []);
        else setSlips([]);
      })
      .catch(() => setSlips([]))
      .finally(() => setLoading(false));
  }, []);

  const openSlipPdf = async (itemId: string) => {
    try {
      const res = await accountingApi.payroll.getMySlipPdf(itemId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      alert('Slip tidak dapat dibuka.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-8 h-8 text-emerald-600" />
            Slip Gaji Saya
          </h1>
          <p className="text-slate-600 mt-1">Daftar slip gaji yang telah diterbitkan untuk Anda</p>
        </div>
      </div>

      <Card>
        {loading ? (
          <p className="text-slate-500 py-8 text-center">Memuat...</p>
        ) : slips.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">Belum ada slip gaji</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="pb-2 pr-4">Periode</th>
                  <th className="pb-2 pr-4">Take home pay</th>
                  <th className="pb-2 pr-4">Tanggal terbit</th>
                  <th className="pb-2 pr-4 w-32">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {MONTH_NAMES[s.period_month - 1]} {s.period_year}
                    </td>
                    <td className="py-3 pr-4 font-medium text-emerald-700">{formatIDR(s.net)}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {s.slip_generated_at ? new Date(s.slip_generated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="py-3 pr-4">
                      <Button variant="ghost" size="sm" onClick={() => openSlipPdf(s.id)}>
                        <Download className="w-4 h-4 mr-1" /> Lihat slip
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MySlipGajiPage;
