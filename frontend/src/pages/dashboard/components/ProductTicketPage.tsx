import React, { useState, useEffect, useCallback } from 'react';
import { List, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { productsApi } from '../../../services/api';
import { getProductListOwnerId } from '../../../utils/productHelpers';
import PageHeader from '../../../components/common/PageHeader';
import { AutoRefreshControl } from '../../../components/common';
import TicketsPage from './TicketsPage';
import TicketCalendarView from './TicketCalendarView';
import type { TicketProduct } from './TicketCalendarView';

const TABS = [
  { id: 'list', label: 'Daftar Tiket', icon: List },
  { id: 'calendar', label: 'Kalender', icon: CalendarIcon }
] as const;

type TabId = (typeof TABS)[number]['id'];

const ProductTicketPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('list');
  const [ticketProducts, setTicketProducts] = useState<TicketProduct[]>([]);
  const [ticketLoading, setTicketLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterActive, setFilterActive] = useState(false);

  const fetchTicketProducts = useCallback(() => {
    setTicketLoading(true);
    const ownerId = getProductListOwnerId(user);
    const params: Record<string, string | number | boolean | undefined> = {
      type: 'ticket',
      with_prices: 'true',
      include_inactive: 'false',
      limit: 500,
      ...(user?.role === 'role_hotel' ? { view_as_pusat: 'true' } : {}),
      ...(ownerId ? { owner_id: ownerId } : {})
    };
    if (ownerId && user?.branch_id) params.branch_id = user.branch_id;
    productsApi
      .list(params)
      .then((res) => {
        if (res.data?.data) setTicketProducts((res.data.data as TicketProduct[]) || []);
      })
      .catch(() => setTicketProducts([]))
      .finally(() => setTicketLoading(false));
  }, [user?.role]);

  useEffect(() => {
    fetchTicketProducts();
  }, [fetchTicketProducts]);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((r) => r + 1);
    fetchTicketProducts();
  }, [fetchTicketProducts]);

  return (
    <div className="flex flex-col min-h-0 space-y-4">
      <PageHeader
        title="Tiket"
        subtitle="Harga dan kuota seat per bandara: default, per bulan, per minggu, per hari. Pekerjaan tiket di menu Tiket."
        right={<AutoRefreshControl onRefresh={handleRefresh} disabled={ticketLoading} />}
      />

      <nav
        className="grid grid-cols-2 gap-2 w-full"
        aria-label="Tab Tiket"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
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
          <TicketsPage embedInProducts refreshTrigger={refreshTrigger} />
        )}
        {activeTab === 'calendar' && (
          <TicketCalendarView
            ticketProducts={ticketLoading ? [] : ticketProducts}
            onAddQuotaClick={() => setActiveTab('list')}
          />
        )}
      </div>
    </div>
  );
};

export default ProductTicketPage;
