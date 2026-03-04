/**
 * BINTANG GLOBAL - Constants
 * Sesuai Master Business Process
 */

// Workflow: Pusat + Koordinator per wilayah. Hotel/Bus/Invoice Saudi di Saudi Arabia.
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_PUSAT: 'admin_pusat',
  // Koordinator per wilayah (invoice / tiket / visa — admin_koordinator dihapus)
  INVOICE_KOORDINATOR: 'invoice_koordinator',
  TIKET_KOORDINATOR: 'tiket_koordinator',
  VISA_KOORDINATOR: 'visa_koordinator',
  // Saudi Arabia: hotel, bus, invoice
  ROLE_HOTEL: 'role_hotel',
  ROLE_BUS: 'role_bus',
  ROLE_INVOICE_SAUDI: 'invoice_saudi',
  ROLE_ACCOUNTING: 'role_accounting',
  OWNER: 'owner',
  // Deprecated (tetap di enum DB untuk kompatibilitas, tidak dipakai)
  ADMIN_PROVINSI: 'admin_provinsi',
  ADMIN_WILAYAH: 'admin_wilayah',
  ADMIN_CABANG: 'admin_cabang',
  ROLE_HANDLING: 'handling'
};

// PROSES A - Registrasi & Aktivasi Owner (Partner)
// Flow: Daftar (pilih cabang + upload bukti bayar) → admin verifikasi bukti bayar → admin aktivasi (cabang otomatis dari pendaftaran, generate password + MOU)
/** Biaya MoU pendaftaran partner (IDR). Wajib dibayar & di-upload buktinya sebelum akun diaktifkan. */
const MOU_REGISTRATION_FEE_IDR = 25_000_000;

const OWNER_STATUS = {
  PENDING_REGISTRATION_PAYMENT: 'pending_registration_payment',   // setelah daftar, wajib upload bukti bayar
  PENDING_REGISTRATION_VERIFICATION: 'pending_registration_verification', // bukti diupload, menunggu admin
  DEPOSIT_VERIFIED: 'deposit_verified',   // bukti disetujui
  ASSIGNED_TO_BRANCH: 'assigned_to_branch',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  // Legacy (tetap di enum untuk migrasi)
  REGISTERED_PENDING_MOU: 'registered_pending_mou',
  PENDING_MOU_APPROVAL: 'pending_mou_approval',
  PENDING_DEPOSIT_PAYMENT: 'pending_deposit_payment',
  PENDING_DEPOSIT_VERIFICATION: 'pending_deposit_verification'
};

// IV. Status Invoice (Blueprint) - Lengkap
const INVOICE_STATUS = {
  DRAFT: 'draft',
  TENTATIVE: 'tentative',           // Tagihan DP - menunggu pembayaran DP
  PARTIAL_PAID: 'partial_paid',    // Pembayaran DP - DP sudah dibayar
  PAID: 'paid',                    // Lunas
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
  CANCELED: 'canceled',
  CANCELLED_REFUND: 'cancelled_refund',  // Invoice dibatalkan dan ada pembayaran (jumlah refund disimpan di cancelled_refund_amount)
  REFUNDED: 'refunded',
  ORDER_UPDATED: 'order_updated',   // Order diupdate, invoice perlu penyesuaian
  OVERPAID: 'overpaid',             // Kelebihan bayar
  OVERPAID_TRANSFERRED: 'overpaid_transferred',  // Pindahan overpaid (sumber/dipindahkan)
  OVERPAID_RECEIVED: 'overpaid_received',        // Menerima pindahan overpaid
  REFUND_CANCELED: 'refund_canceled',            // Refund dibatalkan
  OVERPAID_REFUND_PENDING: 'overpaid_refund_pending'  // Kelebihan bayar - sisa pengembalian
};

// VII. Status Refund
const REFUND_STATUS = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUNDED: 'refunded'
};

// Sumber permintaan refund: cancel = saat batalkan order; balance = tarik saldo
const REFUND_SOURCE = {
  CANCEL: 'cancel',
  BALANCE: 'balance'
};

// VI. Hotel progress (Role Hotel)
const HOTEL_PROGRESS_STATUS = {
  WAITING_CONFIRMATION: 'waiting_confirmation',
  CONFIRMED: 'confirmed',
  ROOM_ASSIGNED: 'room_assigned',
  COMPLETED: 'completed'
};

const ROOM_STATUS = {
  AVAILABLE: 'available',
  BOOKED: 'booked',
  OCCUPIED: 'occupied'
};

// VI. Visa progress (Role Visa)
const VISA_PROGRESS_STATUS = {
  DOCUMENT_RECEIVED: 'document_received',
  SUBMITTED: 'submitted',
  IN_PROCESS: 'in_process',
  APPROVED: 'approved',
  ISSUED: 'issued'
};

// VI. Bus progress (Role Bus Saudi) - tiket bis, kedatangan, keberangkatan, kepulangan
const BUS_TICKET_STATUS = {
  PENDING: 'pending',
  ISSUED: 'issued'
};
const BUS_TRIP_STATUS = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed'
};

// VI. Handling progress (Role Handling) - status disimpan di OrderItem.meta.handling_status
const HANDLING_PROGRESS_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
};

// Bus Saudi: workflow perjalanan (sama konsep tiket)
const BUS_TRIP_TYPES = ['one_way', 'return_only', 'round_trip'];

// Rute bus: full, bandara–hotel (Jeddah→Mekkah / Madinah), antar hotel (Mekkah↔Madinah)
const BUS_ROUTE_FULL = 'full_route';
const BUS_ROUTE_BANDARA_MAKKAH = 'bandara_makkah';
const BUS_ROUTE_BANDARA_MADINAH = 'bandara_madinah';
const BUS_ROUTE_BANDARA_MADINAH_ONLY = 'bandara_madinah_only';
const BUS_ROUTE_HOTEL_MAKKAH_MADINAH = 'hotel_makkah_madinah';
const BUS_ROUTE_HOTEL_MADINAH_MAKKAH = 'hotel_madinah_makkah';
const BUS_ROUTE_TYPES = [BUS_ROUTE_FULL, BUS_ROUTE_BANDARA_MAKKAH, BUS_ROUTE_BANDARA_MADINAH, BUS_ROUTE_BANDARA_MADINAH_ONLY, BUS_ROUTE_HOTEL_MAKKAH_MADINAH, BUS_ROUTE_HOTEL_MADINAH_MAKKAH];

// VI. Ticket progress (Role Tiket)
const TICKET_PROGRESS_STATUS = {
  PENDING: 'pending',
  DATA_RECEIVED: 'data_received',
  SEAT_RESERVED: 'seat_reserved',
  BOOKING: 'booking',
  PAYMENT_AIRLINE: 'payment_airline',
  TICKET_ISSUED: 'ticket_issued'
};

// Order item types
const ORDER_ITEM_TYPE = {
  HOTEL: 'hotel',
  VISA: 'visa',
  TICKET: 'ticket',
  BUS: 'bus',
  HANDLING: 'handling',
  PACKAGE: 'package'
};

// Jenis produk visa (admin pusat): only = Visa Only, tasreh = Visa + Tasreh, premium = Visa Premium
const VISA_KIND = {
  ONLY: 'only',
  TASREH: 'tasreh',
  PREMIUM: 'premium'
};

// Bandara untuk produk tiket: harga dan kuota seat per bandara (bukan per wilayah)
const BANDARA_TIKET = [
  { code: 'BTH', name: 'Batam' },
  { code: 'CGK', name: 'Jakarta' },
  { code: 'SBY', name: 'Surabaya' },
  { code: 'UPG', name: 'Makassar' }
];
const BANDARA_TIKET_CODES = BANDARA_TIKET.map(b => b.code);

// Periode harga/kuota tiket per bandara: default, per bulan (YYYY-MM), per minggu (YYYY-MM-DD Senin), per hari (YYYY-MM-DD)
const TICKET_PERIOD_TYPES = ['default', 'month', 'week', 'day'];

// Workflow tiket: pergi saja / pulang saja / pulang pergi
const TICKET_TRIP_ONE_WAY = 'one_way';
const TICKET_TRIP_RETURN_ONLY = 'return_only';
const TICKET_TRIP_ROUND_TRIP = 'round_trip';
const TICKET_TRIP_TYPES = [TICKET_TRIP_ONE_WAY, TICKET_TRIP_RETURN_ONLY, TICKET_TRIP_ROUND_TRIP];

// Room types for hotel (single, double, triple, quad, quint) → kapasitas jamaah per kamar
const ROOM_TYPES = ['single', 'double', 'triple', 'quad', 'quint'];
const ROOM_CAPACITY = { single: 1, double: 2, triple: 3, quad: 4, quint: 5 };

// Order status (add blocked)
const ORDER_STATUS = {
  DRAFT: 'draft',
  TENTATIVE: 'tentative',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked'
};

// Status pembayaran DP order (untuk filter tampil: tagihan_dp = hanya owner/accounting/admin/invoice; pembayaran_dp = tampil di Invoice + Progress divisi)
const DP_PAYMENT_STATUS = {
  TAGIHAN_DP: 'tagihan_dp',       // Belum ada bukti bayar DP - tampil hanya owner, accounting, admin_pusat, invoice_saudi, invoice_koordinator
  PEMBAYARAN_DP: 'pembayaran_dp'  // Sudah ada bukti bayar DP - tampil di menu Invoice dan Progress masing-masing divisi
};

// Business rule keys (configurable by pusat / cabang)
const BUSINESS_RULE_KEYS = {
  BUS_MIN_PACK: 'bus_min_pack',
  BUS_PENALTY_IDR: 'bus_penalty_idr',
  HANDLING_DEFAULT_SAR: 'handling_default_sar',
  REQUIRE_HOTEL_WITH_VISA: 'require_hotel_with_visa',
  DP_GRACE_HOURS: 'dp_grace_hours',
  DP_DUE_DAYS: 'dp_due_days',
  CURRENCY_RATES: 'currency_rates',
  REGISTRATION_DEPOSIT_IDR: 'registration_deposit_idr',
  COMPANY_NAME: 'company_name',
  COMPANY_ADDRESS: 'company_address',
  NOTIFICATION_ORDER: 'notification_order',
  NOTIFICATION_PAYMENT: 'notification_payment',
  NOTIFICATION_INVOICE: 'notification_invoice',
  VISA_DEFAULT_IDR: 'visa_default_idr',
  TICKET_DEFAULT_IDR: 'ticket_default_idr',
  TICKET_GENERAL_IDR: 'ticket_general_idr',
  TICKET_LION_IDR: 'ticket_lion_idr',
  TICKET_SUPER_AIR_JET_IDR: 'ticket_super_air_jet_idr',
  TICKET_GARUDA_IDR: 'ticket_garuda_idr',
  MIN_DP_PERCENTAGE: 'min_dp_percentage',
  BANK_ACCOUNTS: 'bank_accounts',
  BUS_MENENGAH_PRICE_IDR: 'bus_menengah_price_idr',
  BUS_KECIL_PRICE_IDR: 'bus_kecil_price_idr'
};

// Notifikasi trigger (VIII)
const NOTIFICATION_TRIGGER = {
  INVOICE_CREATED: 'invoice_created',
  DP_RECEIVED: 'dp_received',
  OVERDUE: 'overdue',
  LUNAS: 'lunas',
  HOTEL_CONFIRMED: 'hotel_confirmed',
  VISA_ISSUED: 'visa_issued',
  TICKET_ISSUED: 'ticket_issued',
  ORDER_COMPLETED: 'order_completed',
  CANCEL: 'cancel',
  REFUND: 'refund'
};

// Accounting Document Workflow
const ACCOUNTING_DOC_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  APPROVED: 'approved',
  POSTED_TO_GL: 'posted_to_gl',
  CLOSED: 'closed'
};

// Journal Entry Status
const JOURNAL_ENTRY_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  POSTED: 'posted',
  REVERSED: 'reversed'
};

// Account Types (Chart of Accounts)
const ACCOUNT_TYPE = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense'
};

// Account Mapping Types
const ACCOUNT_MAPPING_TYPE = {
  SALES_HOTEL: 'sales_hotel',
  SALES_VISA: 'sales_visa',
  SALES_TICKET: 'sales_ticket',
  SALES_BUS: 'sales_bus',
  SALES_HANDLING: 'sales_handling',
  PURCHASE_HOTEL: 'purchase_hotel',
  PURCHASE_BUS: 'purchase_bus',
  CASH_RECEIPT: 'cash_receipt',
  CASH_DISBURSEMENT: 'cash_disbursement',
  BANK_TRANSFER: 'bank_transfer'
};

// Business rules
const BUSINESS_RULES = {
  DP_PERCENTAGE_NORMAL: 30,
  DP_PERCENTAGE_SUPER_PROMO: 50,
  DP_GRACE_HOURS: 24,        // Invoice tentative batal jika belum DP dalam 24 jam
  DP_DUE_DAYS: 3,            // Tenggat DP 3 hari
  BUS_MIN_PACK: 35,
  CURRENCY: ['IDR', 'SAR'],
  REGISTRATION_DEPOSIT_IDR: 25000000,
  MIN_DP_PERCENTAGE: 30,
  BANK_ACCOUNTS: []  // [{ bank_name, account_number, account_name, currency? }]
};

module.exports = {
  ROLES,
  MOU_REGISTRATION_FEE_IDR,
  OWNER_STATUS,
  INVOICE_STATUS,
  HANDLING_PROGRESS_STATUS,
  REFUND_STATUS,
  REFUND_SOURCE,
  ACCOUNTING_DOC_STATUS,
  JOURNAL_ENTRY_STATUS,
  ACCOUNT_TYPE,
  ACCOUNT_MAPPING_TYPE,
  HOTEL_PROGRESS_STATUS,
  ROOM_STATUS,
  BUS_TICKET_STATUS,
  BUS_TRIP_STATUS,
  BUS_TRIP_TYPES,
  BUS_ROUTE_TYPES,
  VISA_PROGRESS_STATUS,
  TICKET_PROGRESS_STATUS,
  ORDER_ITEM_TYPE,
  VISA_KIND,
  BANDARA_TIKET,
  BANDARA_TIKET_CODES,
  TICKET_PERIOD_TYPES,
  TICKET_TRIP_ONE_WAY,
  TICKET_TRIP_RETURN_ONLY,
  TICKET_TRIP_ROUND_TRIP,
  TICKET_TRIP_TYPES,
  ORDER_STATUS,
  DP_PAYMENT_STATUS,
  ROOM_TYPES,
  ROOM_CAPACITY,
  BUSINESS_RULE_KEYS,
  NOTIFICATION_TRIGGER,
  BUSINESS_RULES
};
