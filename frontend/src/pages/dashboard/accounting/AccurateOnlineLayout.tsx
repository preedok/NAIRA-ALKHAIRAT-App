import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Receipt,
  ShoppingCart,
  Package,
  Percent,
  Wallet,
  Building2,
  Landmark
} from 'lucide-react';
import Card from '../../../components/common/Card';
import { accountingApi } from '../../../services/api';

const SECTIONS = [
  { id: 'akuntansi', title: 'Akuntansi & Laporan', path: 'akuntansi', icon: BookOpen },
  { id: 'penjualan', title: 'Penjualan', path: 'penjualan', icon: Receipt },
  { id: 'pembelian', title: 'Pembelian', path: 'pembelian', icon: ShoppingCart },
  { id: 'persediaan', title: 'Persediaan', path: 'persediaan', icon: Package },
  { id: 'perpajakan', title: 'Perpajakan', path: 'perpajakan', icon: Percent },
  { id: 'kas-bank', title: 'Kas & Bank', path: 'kas-bank', icon: Wallet },
  { id: 'aset-tetap', title: 'Aset Tetap', path: 'aset-tetap', icon: Building2 }
];

const AccurateOnlineLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [dashboard, setDashboard] = useState<{
    penjualan?: { quotations: number };
    pembelian?: { purchase_orders: number };
    persediaan?: { warehouses: number };
    aset_tetap?: { fixed_assets: number };
  } | null>(null);

  const basePath = '/dashboard/accounting/accurate';
  const currentSection = location.pathname.replace(basePath, '').replace(/^\//, '') || 'akuntansi';

  useEffect(() => {
    accountingApi.accurate.getDashboard().then((r) => {
      if (r.data.success && r.data.data) setDashboard(r.data.data);
    }).catch(() => setDashboard(null));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-slate-600">
            <Landmark className="w-5 h-5 text-primary-600" />
            <h1 className="text-xl font-bold text-slate-900">Accurate Online</h1>
          </div>
        </div>
        <p className="text-sm text-slate-600">Modul akuntansi: Jurnal, Laporan, Penjualan, Pembelian, Persediaan, Perpajakan, Kas & Bank, Aset Tetap.</p>

        {dashboard && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 rounded-xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Penawaran</p>
              <p className="text-lg font-bold text-slate-900">{dashboard.penjualan?.quotations ?? 0}</p>
            </Card>
            <Card className="p-3 rounded-xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Purchase Order</p>
              <p className="text-lg font-bold text-slate-900">{dashboard.pembelian?.purchase_orders ?? 0}</p>
            </Card>
            <Card className="p-3 rounded-xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Gudang</p>
              <p className="text-lg font-bold text-slate-900">{dashboard.persediaan?.warehouses ?? 0}</p>
            </Card>
            <Card className="p-3 rounded-xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase">Aset Tetap</p>
              <p className="text-lg font-bold text-slate-900">{dashboard.aset_tetap?.fixed_assets ?? 0}</p>
            </Card>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {SECTIONS.map((s) => {
            const isActive = currentSection === s.path;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`${basePath}/${s.path}`)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.title}
              </button>
            );
          })}
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default AccurateOnlineLayout;
