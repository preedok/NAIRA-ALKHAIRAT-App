import React, { useState, useEffect } from 'react';
import { Download, Calendar } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
import Table from '../../../components/common/Table';
import type { TableColumn } from '../../../types';
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
      <PageHeader
        title="Slip Gaji Saya"
        subtitle="Daftar slip gaji yang telah diterbitkan untuk Anda"
      />

      <Card>
        {loading ? (
          <p className="text-slate-500 py-8 text-center">Memuat...</p>
        ) : (
          <Table<MySlipItem>
            columns={[
              { id: 'periode', label: 'Periode', align: 'left' },
              { id: 'thp', label: 'Take home pay', align: 'right' },
              { id: 'terbit', label: 'Tanggal terbit', align: 'left' },
              { id: 'aksi', label: 'Aksi', align: 'center' }
            ] as TableColumn[]}
            data={slips}
            emptyMessage="Belum ada slip gaji"
            renderRow={(s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {MONTH_NAMES[s.period_month - 1]} {s.period_year}
                  </span>
                </td>
                <td className="py-3 px-4 font-medium text-emerald-700 text-right">{formatIDR(s.net)}</td>
                <td className="py-3 px-4 text-slate-600">
                  {s.slip_generated_at ? new Date(s.slip_generated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                </td>
                <td className="py-3 px-4">
                  <Button variant="ghost" size="sm" onClick={() => openSlipPdf(s.id)}>
                    <Download className="w-4 h-4 mr-1" /> Lihat slip
                  </Button>
                </td>
              </tr>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default MySlipGajiPage;
