import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, X, ChevronDown, ChevronUp, Hotel, FileText, Plane, Bus, Package, HandHelping } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrderDraft, type OrderDraftItem, type OrderDraftItemType } from '../contexts/OrderDraftContext';
import Button from './common/Button';

const TYPE_LABELS: Record<OrderDraftItemType, string> = {
  hotel: 'Hotel',
  visa: 'Visa',
  ticket: 'Tiket',
  bus: 'Bus',
  siskopatuh: 'Siskopatuh',
  handling: 'Handling',
  package: 'Paket'
};

const TYPE_ICONS: Record<OrderDraftItemType, React.ReactNode> = {
  hotel: <Hotel className="w-4 h-4" />,
  visa: <FileText className="w-4 h-4" />,
  ticket: <Plane className="w-4 h-4" />,
  bus: <Bus className="w-4 h-4" />,
  siskopatuh: <FileText className="w-4 h-4" />,
  handling: <HandHelping className="w-4 h-4" />,
  package: <Package className="w-4 h-4" />
};

const ProductDraftBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { items, count, removeItem } = useOrderDraft();
  const [expanded, setExpanded] = useState(true);

  const canAddToOrder = user?.role === 'owner_mou' || user?.role === 'owner_non_mou' || user?.role === 'invoice_koordinator' || user?.role === 'invoice_saudi';
  const onProductsPath = location.pathname.startsWith('/dashboard/products');
  const showBar = onProductsPath && canAddToOrder && count > 0;

  if (!showBar) return null;

  const summary = (item: OrderDraftItem) => {
    const qty = item.type === 'hotel' && item.room_breakdown?.length
      ? item.room_breakdown.reduce((s, r) => s + r.quantity, 0)
      : item.quantity;
    return `${item.product_name} (${qty})`;
  };

  return (
    <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 pb-2 bg-white border-b border-slate-200 shadow-sm">
      <div className="rounded-xl bg-primary-50 border border-primary-200 overflow-hidden">
        <div className="flex items-center justify-between gap-3 py-2 px-3">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-2 text-left flex-1 min-w-0"
          >
            <ShoppingCart className="w-5 h-5 text-primary-600 shrink-0" />
            <span className="text-sm font-medium text-primary-800">
              {count} item dipilih — klik untuk {expanded ? 'sembunyikan' : 'lihat'}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 text-primary-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-primary-600 shrink-0" />}
          </button>
          <Button
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={() => navigate('/dashboard/orders/new')}
          >
            Lanjut ke form order
          </Button>
        </div>
        {expanded && (
          <div className="px-3 pb-3 pt-0 border-t border-primary-100">
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white border border-primary-100 text-sm"
                >
                  <span className="text-primary-600 shrink-0">{TYPE_ICONS[item.type]}</span>
                  <span className="text-slate-700 truncate flex-1 min-w-0" title={item.product_name}>
                    {summary(item)}
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">{TYPE_LABELS[item.type]}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                    title="Hapus dari draft"
                    aria-label="Hapus"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDraftBar;
