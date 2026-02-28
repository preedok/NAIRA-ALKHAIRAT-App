import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3, Receipt, ShoppingCart, Package, FileCheck, Wallet, Building2,
  ChevronRight, BookOpen, FileText, Percent
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import { accountingApi } from '../../../services/api';
import { formatIDR } from '../../../utils';

const MODULES = [
  { id: 'akuntansi', title: 'Akuntansi & Laporan Keuangan', path: 'akuntansi', icon: BookOpen, color: 'from-blue-500 to-cyan-500', desc: 'Jurnal otomatis, Laporan laba rugi, neraca, arus kas, Buku besar & trial balance real-time' },
  { id: 'penjualan', title: 'Penjualan', path: 'penjualan', icon: Receipt, color: 'from-emerald-500 to-teal-500', desc: 'Invoice & faktur pajak, Penawaran (quotation), Retur penjualan, Multi harga & diskon' },
  { id: 'pembelian', title: 'Pembelian', path: 'pembelian', icon: ShoppingCart, color: 'from-amber-500 to-orange-500', desc: 'Purchase order (PO), Faktur pembelian, Retur pembelian, Hutang & pembayaran supplier' },
  { id: 'persediaan', title: 'Persediaan / Inventory', path: 'persediaan', icon: Package, color: 'from-violet-500 to-purple-500', desc: 'Stok masuk–keluar otomatis, Multi gudang, Penilaian (FIFO/Average), Minimum stok & laporan mutasi' },
  { id: 'perpajakan', title: 'Perpajakan', path: 'perpajakan', icon: Percent, color: 'from-rose-500 to-pink-500', desc: 'PPN, e-Faktur, Bukti potong, Laporan pajak siap ekspor' },
  { id: 'kas-bank', title: 'Kas & Bank', path: 'kas-bank', icon: Wallet, color: 'from-sky-500 to-blue-600', desc: 'Kas masuk / keluar, Rekonsiliasi bank, Multi rekening' },
  { id: 'aset-tetap', title: 'Aset Tetap', path: 'aset-tetap', icon: Building2, color: 'from-slate-600 to-slate-700', desc: 'Pencatatan aset, Penyusutan otomatis' }
] as const;

const AccurateOnlinePage: React.FC = () => {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const [dashboard, setDashboard] = useState<{ penjualan?: { quotations: number }; pembelian?: { purchase_orders: number }; persediaan?: { warehouses: number }; aset_tetap?: { fixed_assets: number } } | null>(null);

  useEffect(() => {
    accountingApi.accurate.getDashboard().then((r) => { if (r.data.success && r.data.data) setDashboard(r.data.data); }).catch(() => setDashboard(null));
  }, []);

  if (section) {
    const mod = MODULES.find((m) => m.path === section);
    if (mod) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <button type="button" onClick={() => navigate('/dashboard/accounting/accurate')} className="hover:text-slate-700">Accurate Online</button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-700 font-medium">{mod.title}</span>
          </div>
          <Card className="p-8 text-center">
            <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${mod.color} text-white mb-4`}>
              <mod.icon className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{mod.title}</h1>
            <p className="text-slate-600 mt-2 max-w-xl mx-auto">{mod.desc}</p>
            <p className="text-slate-500 text-sm mt-4">Modul dalam pengembangan. Fitur akan dilengkapi bertahap.</p>
          </Card>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accurate Online</h1>
        <p className="text-slate-600 text-sm mt-1">Modul akuntansi lengkap: Akuntansi & Laporan, Penjualan, Pembelian, Persediaan, Perpajakan, Kas & Bank, Aset Tetap.</p>
      </div>

      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase">Penawaran</p>
            <p className="text-xl font-bold text-slate-900">{dashboard.penjualan?.quotations ?? 0}</p>
          </Card>
          <Card className="p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase">Purchase Order</p>
            <p className="text-xl font-bold text-slate-900">{dashboard.pembelian?.purchase_orders ?? 0}</p>
          </Card>
          <Card className="p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase">Gudang</p>
            <p className="text-xl font-bold text-slate-900">{dashboard.persediaan?.warehouses ?? 0}</p>
          </Card>
          <Card className="p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase">Aset Tetap</p>
            <p className="text-xl font-bold text-slate-900">{dashboard.aset_tetap?.fixed_assets ?? 0}</p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MODULES.map((m) => (
          <Card key={m.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <button
              type="button"
              className="w-full text-left p-5"
              onClick={() => navigate(`/dashboard/accounting/accurate/${m.path}`)}
            >
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${m.color} text-white mb-4`}>
                <m.icon className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">{m.title}</h2>
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">{m.desc}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 mt-3">
                Buka <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AccurateOnlinePage;
