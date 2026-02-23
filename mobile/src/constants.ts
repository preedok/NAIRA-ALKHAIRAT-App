/** Status invoice - label untuk tampilan */
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  tentative: 'Tagihan DP',
  partial_paid: 'Pembayaran DP',
  paid: 'Lunas',
  processing: 'Processing',
  completed: 'Completed',
  overdue: 'Overdue',
  canceled: 'Dibatalkan',
  refunded: 'Refund Dana',
  order_updated: 'Order Diupdate',
  overpaid: 'Kelebihan Bayar',
};

/** Warna status untuk badge/chip */
export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  tentative: '#f59e0b',
  partial_paid: '#f59e0b',
  paid: '#059669',
  processing: '#0ea5e9',
  completed: '#059669',
  overdue: '#dc2626',
  canceled: '#dc2626',
  refunded: '#64748b',
  order_updated: '#f59e0b',
  overpaid: '#f59e0b',
};

export const COLORS = {
  primary: '#047857',
  primaryLight: '#d1fae5',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
};
