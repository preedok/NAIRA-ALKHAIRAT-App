import React, { useState, useEffect, useCallback } from 'react';
import { List, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { productsApi } from '../../../services/api';
import HotelsPage from './HotelsPage';
import HotelCalendarView from './HotelCalendarView';
import type { HotelProduct } from './HotelsPage';

const TABS = [
  { id: 'list', label: 'Daftar Hotel', icon: List },
  { id: 'calendar', label: 'Kalender', icon: CalendarIcon }
] as const;

type TabId = typeof TABS[number]['id'];

const ProductHotelPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('list');
  const [hotels, setHotels] = useState<HotelProduct[]>([]);
  const [hotelsLoading, setHotelsLoading] = useState(true);
  const [openSeasonsForHotelId, setOpenSeasonsForHotelId] = useState<string | null>(null);

  const canAddRoom = user?.role === 'super_admin' || user?.role === 'admin_pusat';

  const fetchHotels = useCallback(() => {
    setHotelsLoading(true);
    const params = {
      type: 'hotel' as const,
      with_prices: 'true' as const,
      limit: 500,
      page: 1,
      sort_by: 'code',
      sort_order: 'asc' as const,
      ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' as const } : {})
    };
    productsApi
      .list(params)
      .then((res) => {
        if (res.data?.data) setHotels((res.data.data as HotelProduct[]) || []);
      })
      .catch(() => setHotels([]))
      .finally(() => setHotelsLoading(false));
  }, [user?.role]);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels]);

  const handleOpenSeasonsModal = (hotel: HotelProduct, _date?: string, _seasonId?: string) => {
    setOpenSeasonsForHotelId(hotel.id);
    setActiveTab('list');
    setTimeout(() => setOpenSeasonsForHotelId(null), 800);
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-3 bg-gradient-to-b from-white via-white to-transparent">
        <nav
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
          aria-label="Tab Hotel"
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
        {activeTab === 'list' && (
          <HotelsPage
            embedInProducts
            openSeasonsForHotelId={openSeasonsForHotelId}
          />
        )}
        {activeTab === 'calendar' && (
          <HotelCalendarView
            hotels={hotelsLoading ? [] : hotels}
            canAddRoom={canAddRoom}
            onOpenSeasonsModal={canAddRoom ? handleOpenSeasonsModal : undefined}
          />
        )}
      </div>
    </div>
  );
};

export default ProductHotelPage;
