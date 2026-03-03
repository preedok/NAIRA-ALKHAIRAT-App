import React, { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Hotel, FileText, Plane, Bus, Package, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import Button from '../../../components/common/Button';
import HotelsPage from './HotelsPage';
import VisaPage from './VisaPage';
import TicketsPage from './TicketsPage';
import BusPage from './BusPage';
import PackagesPage from './PackagesPage';

const TABS = [
  { id: 'hotels', label: 'Hotel', icon: Hotel },
  { id: 'visa', label: 'Visa', icon: FileText },
  { id: 'tickets', label: 'Tiket', icon: Plane },
  { id: 'bus', label: 'Bus', icon: Bus },
  { id: 'packages', label: 'Paket', icon: Package }
] as const;

type TabId = typeof TABS[number]['id'];

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { count: draftCount } = useOrderDraft();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => {
    const t = searchParams.get('tab') as TabId | null;
    return t && TABS.some((x) => x.id === t) ? t : 'hotels';
  }, [searchParams]);

  const setTab = (id: TabId) => {
    setSearchParams({ tab: id });
  };

  const canAddToOrder = user?.role === 'owner' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const showDraftBar = canAddToOrder && draftCount > 0;

  return (
    <div className="flex flex-col min-h-0">
      {/* Bar: Buat invoice (N item) - tampil jika owner/invoice_koordinator dan ada item di draft */}
      {showDraftBar && (
        <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 pb-2 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-primary-50 border border-primary-200">
            <span className="text-sm font-medium text-primary-800 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary-600" />
              {draftCount} item dipilih
            </span>
            <Button
              variant="primary"
              size="sm"
              className="shrink-0"
              onClick={() => navigate('/dashboard/orders/new')}
            >
              Lanjut ke form order
            </Button>
          </div>
        </div>
      )}

      {/* Sticky tab navigation */}
      <div className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-3 bg-gradient-to-b from-white via-white to-transparent">
        <nav
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
          aria-label="Tab produk"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 border-2 ${
                tab === id
                  ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${tab === id ? 'text-primary-600' : 'text-stone-500'}`} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content - consistent padding and min height */}
      <div className="flex-1 min-h-[420px] pt-2">
        {tab === 'hotels' && <HotelsPage embedInProducts />}
        {tab === 'visa' && <VisaPage embedInProducts />}
        {tab === 'tickets' && <TicketsPage embedInProducts />}
        {tab === 'bus' && <BusPage embedInProducts />}
        {tab === 'packages' && <PackagesPage />}
      </div>
    </div>
  );
};

export default ProductsPage;
