import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  TrendingUp,
  Scale,
  ArrowLeftRight,
  ClipboardList,
  ChevronRight
} from 'lucide-react';
import Card from '../../../components/common/Card';

const FEATURES = [
  {
    id: 'jurnal',
    title: 'Jurnal Umum',
    desc: 'Pencatatan jurnal otomatis dari transaksi bisnis.',
    icon: BookOpen,
    path: null,
    comingSoon: true
  },
  {
    id: 'laba-rugi',
    title: 'Laporan Laba Rugi',
    desc: 'Laporan laba rugi periodik berdasarkan jurnal.',
    icon: TrendingUp,
    path: null,
    comingSoon: true
  },
  {
    id: 'neraca',
    title: 'Neraca',
    desc: 'Laporan posisi keuangan (aset, kewajiban, ekuitas).',
    icon: Scale,
    path: null,
    comingSoon: true
  },
  {
    id: 'arus-kas',
    title: 'Laporan Arus Kas',
    desc: 'Arus kas masuk dan keluar per periode.',
    icon: ArrowLeftRight,
    path: null,
    comingSoon: true
  },
  {
    id: 'buku-besar',
    title: 'Buku Besar',
    desc: 'Detail mutasi per akun (general ledger).',
    icon: BookOpen,
    path: null,
    comingSoon: true
  },
  {
    id: 'trial',
    title: 'Trial Balance',
    desc: 'Neraca percobaan real-time per periode.',
    icon: ClipboardList,
    path: null,
    comingSoon: true
  }
];

const AccurateAkuntansiPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Akuntansi & Laporan Keuangan</h2>
        <p className="text-sm text-slate-600 mt-0.5">Jurnal otomatis, laporan laba rugi, neraca, arus kas, buku besar & trial balance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <button
                type="button"
                className={`w-full text-left p-4 ${f.path ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => f.path && navigate(f.path)}
                disabled={!!f.comingSoon}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900">{f.title}</h3>
                    <p className="text-sm text-slate-600 mt-0.5">{f.desc}</p>
                    {f.path && !f.comingSoon && (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 mt-2">
                        Buka <ChevronRight className="w-4 h-4" />
                      </span>
                    )}
                    {f.comingSoon && (
                      <span className="inline-block mt-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Segera hadir</span>
                    )}
                  </div>
                </div>
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AccurateAkuntansiPage;
