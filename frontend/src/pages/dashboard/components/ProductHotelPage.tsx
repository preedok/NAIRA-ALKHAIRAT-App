import React, { useState, useEffect, useCallback } from 'react';
import { List, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { productsApi } from '../../../services/api';
import PageHeader from '../../../components/common/PageHeader';
import AutoRefreshControl from '../../../components/common/AutoRefreshControl';
import { FilterIconButton } from '../../../components/common';
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterActive, setFilterActive] = useState(false);

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

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((r) => r + 1);
    fetchHotels();
  }, [fetchHotels]);

  return (
    <div className="flex flex-col min-h-0 space-y-4">
      <PageHeader
        title="Hotel"
        subtitle="Harga & ketersediaan dikelola Admin Pusat"
        right={
          <div className="flex items-center gap-2">
            <AutoRefreshControl onRefresh={handleRefresh} disabled={hotelsLoading} />
            {activeTab === 'list' && (
              <FilterIconButton
                open={filterOpen}
                onToggle={() => setFilterOpen((v) => !v)}
                hasActiveFilters={filterActive}
              />
            )}
          </div>
        }
      />

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
          <HotelsPage
            embedInProducts
            openSeasonsForHotelId={openSeasonsForHotelId}
            refreshTrigger={refreshTrigger}
            embedFilterOpen={filterOpen}
            embedFilterOnToggle={() => setFilterOpen((v) => !v)}
            onFilterActiveChange={setFilterActive}
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
