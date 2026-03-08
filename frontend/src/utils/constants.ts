/**
 * Constants
 * Application-wide constants and configurations
 */

// ============================================
// AUTOCOMPLETE (seragam di seluruh app)
// ============================================
/** Teks placeholder/empty untuk filter: "Semua [x]" */
export const AUTOCOMPLETE_FILTER = {
  SEMUA_WILAYAH: 'Semua wilayah',
  SEMUA_PROVINSI: 'Semua provinsi',
  SEMUA_CABANG: 'Semua cabang',
  SEMUA_STATUS: 'Semua status',
  SEMUA_PROGRESS: 'Semua progress',
  SEMUA_OWNER: 'Semua owner',
  SEMUA: 'Semua'
} as const;
/** Teks placeholder/empty untuk form: "Pilih [x]..." */
export const AUTOCOMPLETE_PILIH = {
  PILIH: 'Pilih...',
  PILIH_ROLE: 'Pilih role...',
  PILIH_WILAYAH: 'Pilih wilayah...',
  PILIH_PROVINSI: 'Pilih provinsi...',
  PILIH_CABANG: 'Pilih cabang...',
  PILIH_OWNER: 'Pilih owner...',
  PILIH_KABUPATEN: 'Pilih kabupaten/kota...',
  PILIH_ALASAN: 'Pilih alasan (jika tolak)...',
  CARI: 'Cari...',
  TIDAK_ADA_HASIL: 'Tidak ada hasil'
} as const;

// ============================================
// API CONFIGURATION
// ============================================

// Use relative path in dev (proxy to backend) when REACT_APP_API_URL not set
export const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

// ============================================
// CURRENCY
// ============================================

export const CURRENCIES = {
  IDR: 'IDR',
  SAR: 'SAR',
  USD: 'USD'
} as const;

/** Satu sumber untuk opsi mata uang (dropdown + format). Dipakai di seluruh app (product, order, invoice). */
export const CURRENCY_OPTIONS = [
  { id: 'IDR' as const, label: 'Rupiah (IDR)', symbol: 'Rp', locale: 'id-ID' },
  { id: 'SAR' as const, label: 'Riyal Saudi (SAR)', symbol: 'SAR', locale: 'en-US' },
  { id: 'USD' as const, label: 'US Dollar (USD)', symbol: '$', locale: 'en-US' }
] as const;

export type CurrencyId = typeof CURRENCY_OPTIONS[number]['id'];

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
  CANCELLED_REFUND: 'cancelled_refund',
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
  cancelled_refund: 'Dibatalkan Refund',
  refunded: 'Refund Dana',
  order_updated: 'Order Diupdate',
  overpaid: 'Kelebihan Bayar',
  overpaid_transferred: 'Pindahan (Sumber)',
  overpaid_received: 'Pindahan (Penerima)',
  refund_canceled: 'Dibatalkan refund',
  overpaid_refund_pending: 'Sisa Pengembalian'
};

/** Definisi kolom "No. Invoice" untuk tabel – satu acuan di semua halaman (Invoice, Report, Accounting, Dashboard, Work). */
export const INVOICE_TABLE_COLUMN_INVOICE = { id: 'invoice_number', label: 'No. Invoice', align: 'left' as const };

/** Definisi kolom "Bukti Bayar" untuk tabel – seragam di semua halaman yang menampilkan daftar invoice. */
export const INVOICE_TABLE_COLUMN_PROOF = { id: 'proof', label: 'Bukti Bayar', align: 'left' as const };

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  tentative: 'default',
  partial_paid: 'warning',
  paid: 'success',
  processing: 'info',
  completed: 'success',
  overdue: 'error',
  canceled: 'error',
  cancelled_refund: 'error',
  refunded: 'default',
  order_updated: 'warning',
  overpaid: 'warning',
  overpaid_transferred: 'info',
  overpaid_received: 'info',
  refund_canceled: 'error',
  overpaid_refund_pending: 'warning'
};

/** Label status proses refund (sama di seluruh app: menu Invoice, Report, Accounting, dll). */
export const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  refunded: 'Sudah direfund'
};

/** Status pembatalan: jadikan saldo akun (tampil di Status · Dibayar). */
export const CANCELLATION_TO_BALANCE_LABEL = 'Direfund ke saldo akun';

/** Badge status saat refund disetujui/diproses (bukan Tagihan DP / Pembayaran DP). */
export const REFUND_IN_PROCESS_LABEL = 'Refund diproses';

/** Label pemindahan dana: invoice pengirim / penerima (tampil di Status · Dibayar). */
export const REALLOCATION_OUT_LABEL = 'Dana dipindahkan ke';
export const REALLOCATION_IN_LABEL = 'Dana diterima dari';

/** Badge status saat invoice dibatalkan dan dana dipindahkan ke invoice lain (bukan Tagihan DP). */
export const REALLOCATION_OUT_STATUS_LABEL = 'Dana dipindahkan ke invoice lain';

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
  ROLE_HOTEL: 'role_hotel',
  ROLE_BUS: 'role_bus',
  ROLE_ACCOUNTING: 'role_accounting',
  OWNER_MOU: 'owner_mou',
  OWNER_NON_MOU: 'owner_non_mou'
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
  REPORTS: '/dashboard/reports',
  SETTINGS: '/dashboard/settings',
  PROFILE: '/dashboard/profile',
  SUPER_ADMIN_LOGS: '/dashboard/super-admin/logs',
  SUPER_ADMIN_MAINTENANCE: '/dashboard/super-admin/maintenance'
} as const;

// Chart colors for donut/pie (Recharts)
export const DONUT_COLORS = ['#059669', '#0891b2', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#0d9488'];