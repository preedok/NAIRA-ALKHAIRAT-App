import React, { useState, useEffect, useCallback } from 'react';
import { List, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { productsApi } from '../../../services/api';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl } from '../../../components/common';
import BusPage from './BusPage';
import BusCalendarView from './BusCalendarView';
import type { BusProduct } from './BusCalendarView';

const TABS = [
  { id: 'list', label: 'Daftar Bus', icon: List },
  { id: 'calendar', label: 'Kalender', icon: CalendarIcon }
] as const;

type TabId = (typeof TABS)[number]['id'];

const ProductBusPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('list');
  const [busProducts, setBusProducts] = useState<BusProduct[]>([]);
  const [busLoading, setBusLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchBusProducts = useCallback(() => {
    setBusLoading(true);
    const params = {
      type: 'bus' as const,
      with_prices: 'true' as const,
      include_inactive: 'false' as const,
      limit: 500,
      ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' as const } : {})
    };
    productsApi
      .list(params)
      .then((res) => {
        if (res.data?.data) setBusProducts((res.data.data as BusProduct[]) || []);
      })
      .catch(() => setBusProducts([]))
      .finally(() => setBusLoading(false));
  }, [user?.role]);

  useEffect(() => {
    fetchBusProducts();
  }, [fetchBusProducts]);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((r) => r + 1);
    fetchBusProducts();
  }, [fetchBusProducts]);

  return (
    <div className="flex flex-col min-h-0 space-y-4">
      <PageHeader
        title="Bus Saudi"
        subtitle="Pilih tipe perjalanan (jemput saja / pulang saja / pulang pergi), lalu isi harga per rute dalam IDR, SAR, atau USD. Data tampil di tabel dan dipakai untuk order."
        right={<AutoRefreshControl onRefresh={handleRefresh} disabled={busLoading} />}
      />

      <nav
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
        aria-label="Tab Bus"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 border-2 ${
              activeTab === id
                ? 'border-[#0D1A63] bg-[#0D1A63]/5 text-[#0D1A63] shadow-sm'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800'
            }`}
          >
            <Icon className={`w-5 h-5 shrink-0 ${activeTab === id ? 'text-[#0D1A63]' : 'text-stone-500'}`} />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-[420px]">
        {activeTab === 'list' && (
          <BusPage embedInProducts refreshTrigger={refreshTrigger} />
        )}
        {activeTab === 'calendar' && (
          <BusCalendarView
            busProducts={busLoading ? [] : busProducts}
            onAddQuotaClick={() => setActiveTab('list')}
          />
        )}
      </div>
    </div>
  );
};

export default ProductBusPage;
