import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type OrderDraftItemType = 'hotel' | 'visa' | 'ticket' | 'bus' | 'package';

export interface OrderDraftItem {
  id: string;
  type: OrderDraftItemType;
  product_id: string;
  product_name: string;
  /** Harga per unit dalam IDR (form order hitung total dari sini) */
  unit_price_idr: number;
  quantity: number;
  /** Untuk hotel: breakdown kamar (satu line quad default kalau tidak ada) */
  room_breakdown?: { id: string; room_type: string; quantity: number; unit_price: number; with_meal?: boolean }[];
  check_in?: string;
  check_out?: string;
}

/** Input untuk addItem: id dan room_breakdown[].id opsional */
export type OrderDraftItemInput = Omit<OrderDraftItem, 'id' | 'room_breakdown'> & {
  room_breakdown?: { id?: string; room_type: string; quantity: number; unit_price: number; with_meal?: boolean }[];
};

interface OrderDraftContextType {
  items: OrderDraftItem[];
  count: number;
  addItem: (item: OrderDraftItemInput) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

const OrderDraftContext = createContext<OrderDraftContextType | undefined>(undefined);

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const OrderDraftProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<OrderDraftItem[]>([]);

  const addItem = useCallback((item: OrderDraftItemInput) => {
    const newItem: OrderDraftItem = {
      ...item,
      id: `draft-${uid()}`,
      room_breakdown: item.room_breakdown?.map((l) => ({ ...l, id: l.id || `rl-${uid()}` })) ?? (item.type === 'hotel' ? [{ id: `rl-${uid()}`, room_type: 'quad', quantity: 1, unit_price: item.unit_price_idr, with_meal: false }] : undefined)
    };
    setItems((prev) => [...prev, newItem]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const value: OrderDraftContextType = {
    items,
    count: items.length,
    addItem,
    removeItem,
    clear
  };

  return <OrderDraftContext.Provider value={value}>{children}</OrderDraftContext.Provider>;
};

export function useOrderDraft(): OrderDraftContextType {
  const ctx = useContext(OrderDraftContext);
  if (ctx === undefined) {
    throw new Error('useOrderDraft must be used within OrderDraftProvider');
  }
  return ctx;
}

export function useOrderDraftOptional(): OrderDraftContextType | undefined {
  return useContext(OrderDraftContext);
}
