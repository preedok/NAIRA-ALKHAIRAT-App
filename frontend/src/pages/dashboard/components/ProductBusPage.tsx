import React, { useState, useEffect, useCallback } from 'react';
import { List, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { productsApi } from '../../../services/api';
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

  return (
    <div className="flex flex-col min-h-0">
      <div className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-3 bg-gradient-to-b from-white via-white to-transparent">
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
                  ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${activeTab === id ? 'text-primary-600' : 'text-stone-500'}`} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-h-[420px] pt-2">
        {activeTab === 'list' && <BusPage embedInProducts />}
        {activeTab === 'calendar' && (
          <BusCalendarView busProducts={busLoading ? [] : busProducts} />
        )}
      </div>
    </div>
  );
};

export default ProductBusPage;
