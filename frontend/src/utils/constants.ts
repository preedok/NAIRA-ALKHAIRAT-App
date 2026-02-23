/**
 * Constants
 * Application-wide constants and configurations
 */

// ============================================
// API CONFIGURATION
// ============================================

// Use relative path in dev (proxy to backend) when REACT_APP_API_URL not set
export const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

// ============================================
// CURRENCY
// ============================================

export const CURRENCIES = {
  IDR: 'IDR',
  SAR: 'SAR',
  USD: 'USD'
} as const;

export const EXCHANGE_RATES = {
  SAR_TO_IDR: 4200, // 1 SAR = 4,200 IDR (example rate)
  USD_TO_IDR: 15800, // 1 USD = 15,800 IDR (example rate)
  USD_TO_SAR: 3.75 // 1 USD = 3.75 SAR (example rate)
};

// ============================================
// ORDER STATUS
// ============================================

export const ORDER_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  tentative: 'Tentative',
  confirmed: 'Confirmed',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  blocked: 'Blocked'
};

export const ORDER_STATUS_COLORS = {
  draft: 'default',
  pending: 'warning',
  confirmed: 'success',
  processing: 'info',
  completed: 'success',
  cancelled: 'error'
} as const;

// ============================================
// INVOICE STATUS
// ============================================

export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  TENTATIVE: 'tentative',           // Tagihan DP
  PARTIAL_PAID: 'partial_paid',     // Pembayaran DP
  PAID: 'paid',                     // Lunas
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
  CANCELED: 'canceled',
  REFUNDED: 'refunded',
  ORDER_UPDATED: 'order_updated',
  OVERPAID: 'overpaid',
  OVERPAID_TRANSFERRED: 'overpaid_transferred',
  OVERPAID_RECEIVED: 'overpaid_received',
  REFUND_CANCELED: 'refund_canceled',
  OVERPAID_REFUND_PENDING: 'overpaid_refund_pending'
} as const;

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
  overpaid_transferred: 'Pindahan (Sumber)',
  overpaid_received: 'Pindahan (Penerima)',
  refund_canceled: 'Refund Dibatalkan',
  overpaid_refund_pending: 'Sisa Pengembalian'
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  tentative: 'default',
  partial_paid: 'warning',
  paid: 'success',
  processing: 'info',
  completed: 'success',
  overdue: 'error',
  canceled: 'error',
  refunded: 'default',
  order_updated: 'warning',
  overpaid: 'warning',
  overpaid_transferred: 'info',
  overpaid_received: 'info',
  refund_canceled: 'error',
  overpaid_refund_pending: 'warning'
};

// ============================================
// PAYMENT METHODS
// ============================================

export const PAYMENT_METHODS = {
  BANK_TRANSFER: 'bank_transfer',
  CASH: 'cash',
  CREDIT_CARD: 'credit_card'
} as const;

export const PAYMENT_METHOD_LABELS = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  credit_card: 'Credit Card'
};

// ============================================
// USER ROLES
// ============================================

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_PUSAT: 'admin_pusat',
  ROLE_INVOICE: 'role_invoice',
  ROLE_HOTEL: 'role_hotel',
  ROLE_BUS: 'role_bus',
  ROLE_ACCOUNTING: 'role_accounting',
  OWNER: 'owner'
} as const;

// ============================================
// HOTEL LOCATIONS
// ============================================

export const HOTEL_LOCATIONS = {
  MAKKAH: 'makkah',
  MADINAH: 'madinah'
} as const;

export const HOTEL_LOCATION_LABELS = {
  makkah: 'Mekkah',
  madinah: 'Madinah'
};

// ============================================
// STAR RATINGS
// ============================================

export const STAR_RATINGS = {
  ONE: '1_star',
  TWO: '2_star',
  THREE: '3_star',
  FOUR: '4_star',
  FIVE: '5_star',
  UNRATED: 'unrated'
} as const;

export const STAR_RATING_LABELS = {
  '1_star': '1 Star',
  '2_star': '2 Star',
  '3_star': '3 Star',
  '4_star': '4 Star',
  '5_star': '5 Star',
  unrated: 'Unrated'
};

// ============================================
// VISA TYPES
// ============================================

export const VISA_TYPES = {
  UMROH: 'umroh',
  HAJJ: 'hajj',
  TOURIST: 'tourist',
  BUSINESS: 'business'
} as const;

export const VISA_TYPE_LABELS = {
  umroh: 'Umroh',
  hajj: 'Hajj',
  tourist: 'Tourist',
  business: 'Business'
};

// ============================================
// BUS TYPES
// ============================================

export const BUS_TYPES = {
  STANDARD: 'standard',
  PREMIUM: 'premium',
  VIP: 'vip',
  EXECUTIVE: 'executive'
} as const;

export const BUS_TYPE_LABELS = {
  standard: 'Standard',
  premium: 'Premium',
  vip: 'VIP',
  executive: 'Executive'
};

// ============================================
// FLIGHT CLASSES
// ============================================

export const FLIGHT_CLASSES = {
  ECONOMY: 'economy',
  BUSINESS: 'business',
  FIRST: 'first'
} as const;

export const FLIGHT_CLASS_LABELS = {
  economy: 'Economy',
  business: 'Business',
  first: 'First Class'
};

// ============================================
// FILE UPLOAD
// ============================================

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

// ============================================
// PAGINATION
// ============================================

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ============================================
// DATE FORMATS
// ============================================

export const DATE_FORMAT = 'DD/MM/YYYY';
export const DATE_TIME_FORMAT = 'DD/MM/YYYY HH:mm';
export const TIME_FORMAT = 'HH:mm';

// ============================================
// MINIMUM DEPOSIT PERCENTAGE
// ============================================

export const MINIMUM_DEPOSIT_PERCENTAGE = 30; // 30% minimum deposit

// ============================================
// ROUTES
// ============================================

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  HOTELS: '/dashboard/hotels',
  VISA: '/dashboard/visa',
  TICKETS: '/dashboard/tickets',
  BUS: '/dashboard/bus',
  PACKAGES: '/dashboard/packages',
  ORDERS: '/dashboard/orders-invoices',
  INVOICES: '/dashboard/orders-invoices',
  USERS: '/dashboard/users',
  BRANCHES: '/dashboard/branches',
  REPORTS: '/dashboard/reports',
  SETTINGS: '/dashboard/settings',
  PROFILE: '/dashboard/profile',
  SUPER_ADMIN_LOGS: '/dashboard/super-admin/logs',
  SUPER_ADMIN_MAINTENANCE: '/dashboard/super-admin/maintenance'
} as const;

// Chart colors for donut/pie (Recharts)
export const DONUT_COLORS = ['#059669', '#0891b2', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#0d9488'];