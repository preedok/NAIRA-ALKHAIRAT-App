export type PurchaseStatus = 'paid' | 'pending';
export type SalesStatus = 'paid' | 'partial' | 'unpaid';

export type PurchaseItem = {
  id: string;
  date: string;
  vendor: string;
  category: string;
  description: string;
  amount: number;
  status: PurchaseStatus;
};

export type SalesItem = {
  id: string;
  date: string;
  customerName: string;
  product: string;
  invoiceNo: string;
  amount: number;
  status: SalesStatus;
};

const PURCHASES_KEY = 'naira_finance_purchases';
const SALES_KEY = 'naira_finance_sales';

export const defaultPurchases: PurchaseItem[] = [
  { id: 'PUR-001', date: '2026-04-08', vendor: 'Hotel Zamzam', category: 'Akomodasi', description: 'DP hotel kloter April', amount: 5200000, status: 'paid' },
  { id: 'PUR-002', date: '2026-04-12', vendor: 'Saudia Airlines', category: 'Tiket', description: 'Pembelian tiket group', amount: 12800000, status: 'pending' },
  { id: 'PUR-003', date: '2026-04-13', vendor: 'Vendor Bus Madinah', category: 'Transport', description: 'Sewa bus city tour', amount: 3400000, status: 'paid' }
];

export const defaultSales: SalesItem[] = [
  { id: 'SAL-001', date: '2026-04-10', customerName: 'Ahmad Fauzi', product: 'Paket Umroh Ramadhan', invoiceNo: 'INV-2026-014', amount: 35000000, status: 'partial' },
  { id: 'SAL-002', date: '2026-04-11', customerName: 'Siti Rahma', product: 'Paket Umroh Plus Turki', invoiceNo: 'INV-2026-028', amount: 38900000, status: 'paid' },
  { id: 'SAL-003', date: '2026-04-13', customerName: 'Budi Santoso', product: 'Paket Umroh Liburan', invoiceNo: 'INV-2026-031', amount: 29900000, status: 'unpaid' }
];

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadPurchases(): PurchaseItem[] {
  if (typeof window === 'undefined') return defaultPurchases;
  return parseJson<PurchaseItem[]>(window.localStorage.getItem(PURCHASES_KEY), defaultPurchases);
}

export function savePurchases(items: PurchaseItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PURCHASES_KEY, JSON.stringify(items));
}

export function loadSales(): SalesItem[] {
  if (typeof window === 'undefined') return defaultSales;
  return parseJson<SalesItem[]>(window.localStorage.getItem(SALES_KEY), defaultSales);
}

export function saveSales(items: SalesItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SALES_KEY, JSON.stringify(items));
}

export function getFinanceSummary(purchases: PurchaseItem[], sales: SalesItem[]) {
  const totalPurchases = purchases.reduce((sum, row) => sum + row.amount, 0);
  const totalSales = sales.reduce((sum, row) => sum + row.amount, 0);
  return {
    totalPurchases,
    totalSales,
    grossProfit: totalSales - totalPurchases
  };
}
