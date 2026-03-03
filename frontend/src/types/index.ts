/**
 * BINTANG GLOBAL - Complete TypeScript Types
 * Sesuai dengan final business flow
 */

import type { ReactNode } from 'react';

// ==================== USER & AUTH ====================

export type UserRole = 
  | 'super_admin'
  | 'admin_pusat'
  | 'invoice_koordinator'
  | 'tiket_koordinator'
  | 'visa_koordinator'
  | 'invoice_saudi'
  | 'handling'
  | 'admin_cabang'
  | 'owner'
  | 'role_hotel'
  | 'role_bus'
  | 'role_accounting';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branch_id?: string;
  branch_name?: string;
  wilayah_id?: string; // For koordinator: scope to this region
  company_name?: string; // For owner
  is_active: boolean;
  has_special_price?: boolean; // For owner - dapat harga khusus
  owner_status?: OwnerStatus; // For owner - dari Master Business Process
  created_at: string;
  last_login?: string;
}

// PROSES A – Registrasi & Aktivasi Owner (Master Business Process)
export type OwnerStatus =
  | 'pending_registration_payment'
  | 'pending_registration_verification'
  | 'deposit_verified'
  | 'assigned_to_branch'
  | 'active'
  | 'rejected'
  | 'registered_pending_mou'
  | 'pending_mou_approval'
  | 'pending_deposit_payment'
  | 'pending_deposit_verification';

export const OWNER_STATUS_LABELS: Record<OwnerStatus, string> = {
  pending_registration_payment: 'Upload Bukti Bayar Pendaftaran',
  pending_registration_verification: 'Menunggu Verifikasi Admin',
  deposit_verified: 'Bukti Disetujui',
  assigned_to_branch: 'Ditugaskan ke Cabang',
  active: 'Aktif',
  rejected: 'Ditolak',
  registered_pending_mou: 'Registrasi – Pending MoU',
  pending_mou_approval: 'Pending Approval MoU',
  pending_deposit_payment: 'Pending Pembayaran Deposit',
  pending_deposit_verification: 'Pending Verifikasi Deposit'
};

export const ROLE_NAMES: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin_pusat: 'Admin Pusat',
  invoice_koordinator: 'Invoice Koordinator',
  tiket_koordinator: 'Tiket Koordinator',
  visa_koordinator: 'Visa Koordinator',
  invoice_saudi: 'Invoice Saudi',
  handling: 'Handling',
  admin_cabang: 'Admin Cabang',
  owner: 'Owner',
  role_hotel: 'Hotel',
  role_bus: 'Bus',
  role_accounting: 'Accounting'
};

export const KOORDINATOR_ROLES: UserRole[] = ['invoice_koordinator', 'tiket_koordinator', 'visa_koordinator'];
export function isKoordinatorRole(role: UserRole): boolean {
  return KOORDINATOR_ROLES.includes(role);
}

// Sidebar menu item (icon is ReactNode from layout). If children is set, path is used for default/active match.
export interface MenuItem {
  title: string;
  icon: ReactNode;
  path: string;
  roles: UserRole[];
  badge?: string;
  /** Submenu items (collapse). When present, this item expands to show children. */
  children?: MenuItem[];
}

// ==================== BRANCH ====================

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  region: string;
  manager_name: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
}

// ==================== HOTEL ====================

export type RoomType = 'single' | 'double' | 'triple' | 'quad' | 'quint';
export type MealPlan = 'room_only' | 'BB' | 'FB';
export type PriceVariant = 'lasten' | 'harian';
export type HotelLocation = 'makkah' | 'madinah';

export interface Hotel {
  id: string;
  name: string;
  name_ar: string;
  location: HotelLocation;
  address: string;
  distance_from_haram: number; // in KM
  star_rating: number; // 1-5
  description: string;
  facilities: string[];
  images: string[];
  is_active: boolean;
}

export interface HotelRoom {
  id: string;
  hotel_id: string;
  room_type: RoomType;
  capacity: number;
  total_quota: number;
  available_quota: number;
  description: string;
  amenities: string[];
  is_active: boolean;
}

export interface HotelPrice {
  id: string;
  hotel_id: string;
  room_id: string;
  price_variant: PriceVariant;
  price_per_room_sar: number;
  meal_plan: MealPlan;
  meal_price_per_person_sar?: number;
  is_general_price: boolean; // true = set by Super Admin/Admin Pusat
  owner_id?: string; // if special price for specific owner
  approved_by?: string; // Admin Cabang/Pusat who approved
  effective_date: string;
  notes?: string;
}

export interface RoomAllocation {
  id: string;
  order_id: string;
  hotel_id: string;
  room_id: string;
  room_number?: string; // Allocated room number
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  status: 'booked' | 'allocated' | 'occupied' | 'checkout' | 'available';
  allocated_at?: string;
  allocated_by?: string;
}

// ==================== VISA ====================

export type VisaType = 'umroh' | 'hajj' | 'tourist' | 'business';

export interface VisaPackage {
  id: string;
  name: string;
  type: VisaType;
  duration_days: number;
  processing_time_days: number;
  requirements: string[];
  price_usd: number;
  is_general_price: boolean;
  owner_id?: string; // special price
  approved_by?: string;
  total_quota: number;
  used_quota: number;
  is_active: boolean;
}

export interface VisaApplication {
  id: string;
  order_id: string;
  visa_package_id: string;
  applicant_name: string;
  passport_number: string;
  documents_uploaded: boolean;
  documents: VisaDocument[];
  status: 'pending' | 'documents_received' | 'verified' | 'processing' | 'approved' | 'issued' | 'rejected';
  progress_notes: string;
  estimated_issue_date?: string;
  issued_date?: string;
  processed_by?: string;
  visa_file_url?: string; // ZIP file
}

export interface VisaDocument {
  type: 'ktp' | 'passport' | 'photo' | 'other';
  filename: string;
  url: string;
  uploaded_at: string;
}

// ==================== TICKET ====================

export interface Flight {
  id: string;
  airline: string;
  flight_number: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  class_type: 'economy' | 'business' | 'first';
  total_seats: number;
  available_seats: number;
  price_idr: number;
  is_general_price: boolean;
  owner_id?: string;
  approved_by?: string;
  is_active: boolean;
}

export interface TicketBooking {
  id: string;
  order_id: string;
  flight_id: string;
  passenger_name: string;
  passport_number: string;
  seat_number?: string;
  pnr?: string;
  booking_code?: string;
  status: 'pending' | 'data_received' | 'booking' | 'payment_airline' | 'issued';
  progress_notes: string;
  estimated_issue_date?: string;
  issued_date?: string;
  processed_by?: string;
  ticket_file_url?: string;
}

// ==================== BUS ====================

export type BusType = 'standard' | 'premium' | 'vip' | 'executive';

export interface Bus {
  id: string;
  code: string;
  name: string;
  type: BusType;
  capacity: number;
  available_seats: number;
  base_price_idr: number;
  penalty_per_person_idr: number; // Default: 500000
  minimum_pack: number; // Default: 35
  route: string;
  status: 'available' | 'in_service' | 'maintenance';
  is_active: boolean;
}

export interface BusSeatAllocation {
  id: string;
  order_id: string;
  bus_id: string;
  seat_numbers: string[];
  passenger_count: number;
  penalty_amount?: number; // If < 35 or > 35
  status: 'booked' | 'allocated' | 'departed' | 'in_transit' | 'arrived';
  departure_status?: string;
}

// ==================== PACKAGE ====================

export interface Package {
  id: string;
  code: string;
  name: string;
  description: string;
  duration_days: number;
  includes: {
    hotel: boolean;
    visa: boolean;
    ticket: boolean;
    meal: boolean;
    bus: boolean;
    handling: boolean;
  };
  price_per_pack?: number;
  price_per_person?: number;
  base_price_idr: number;
  special_price_idr?: number;
  is_promo: boolean;
  is_super_promo: boolean; // 50% DP required
  valid_from: string;
  valid_until: string;
  quota_total: number;
  quota_sold: number;
  is_featured: boolean;
  is_active: boolean;
  created_by: string; // Super Admin/Admin Pusat
}

// ==================== ORDER ====================

export type OrderItemType = 'hotel' | 'visa' | 'ticket' | 'bus' | 'package';
export type OrderStatus = 'draft' | 'tentative' | 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';

/** Simplified order for list/table display (dashboard, reports) */
export interface OrderListItem {
  id: string;
  order_number: string;
  owner_name: string;
  package_name: string;
  amount: string;
  status: OrderStatus;
  date: string;
}

export interface OrderItem {
  id: string;
  type: OrderItemType;
  
  // Hotel specific
  hotel_id?: string;
  room_id?: string;
  room_type?: RoomType;
  check_in_date?: string;
  check_out_date?: string;
  nights?: number;
  meal_plan?: MealPlan;
  price_variant?: PriceVariant;
  
  // Visa specific (must have hotel)
  visa_package_id?: string;
  
  // Ticket specific
  flight_id?: string;
  
  // Bus specific
  bus_id?: string;
  passenger_count?: number;
  
  // Package specific
  package_id?: string;
  
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
}

export interface Order {
  id: string;
  order_number: string;
  owner_id: string;
  owner_name: string;
  branch_id: string;
  items: OrderItem[];
  total_jamaah: number;
  subtotal: number;
  discount?: number;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  created_by: string; // owner_id or invoice staff
  updated_at?: string;
  notes?: string;
}

// ==================== INVOICE ====================
// Sesuai Master Business Process IV & V

export type InvoiceStatus =
  | 'draft'
  | 'tentative'
  | 'partial_paid'
  | 'paid'
  | 'processing'
  | 'completed'
  | 'overdue'
  | 'canceled'
  | 'refunded'
  | 'order_updated'
  | 'overpaid'
  | 'overpaid_transferred'
  | 'overpaid_received'
  | 'refund_canceled'
  | 'overpaid_refund_pending';
export type PaymentStatus = 'unpaid' | 'dp_paid' | 'partial' | 'paid';

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  owner_id: string;
  owner_name: string;
  
  // Amounts
  total_amount: number;
  dp_percentage: number; // 30% or 50% for super promo
  dp_amount: number;
  paid_amount: number;
  remaining_amount: number;
  
  // Status
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  
  // Dates
  issued_date: string;
  due_date_dp: string; // 3 days after issued
  due_date_full?: string; // 14 days for hotel, 30 days for promo
  
  // Payment proofs
  payments: PaymentProof[];
  
  // Terms & conditions
  terms: string[];
  notes?: string;
  
  // Auto-cancel
  auto_cancel_at?: string; // 24 hours after issued if no DP
  is_overdue: boolean;
  overdue_activated_by?: string; // Invoice role who activated
  
  created_at: string;
  updated_at?: string;
}

export interface PaymentProof {
  id: string;
  invoice_id: string;
  payment_type: 'dp' | 'partial' | 'full';
  amount: number;
  bank_name: string;
  account_number: string;
  transfer_date: string;
  proof_file_url: string;
  uploaded_by: string;
  uploaded_at: string;
  verified_by?: string;
  verified_at?: string;
  notes?: string;
}

// ==================== REFUND ====================
// Master Business Process VII

export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'refunded';

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  requested: 'Diajukan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  refunded: 'Sudah Direfund'
};

// ==================== ROLE PROGRESS (Hotel, Visa, Tiket) ====================
// Master Business Process VI

export type HotelProgressStatus = 'waiting_confirmation' | 'confirmed' | 'room_assigned' | 'completed';
export type VisaProgressStatus = 'document_received' | 'submitted' | 'in_process' | 'approved' | 'issued';
export type TicketProgressStatus = 'seat_reserved' | 'ticket_issued';

// ==================== HANDLING (by Hotel role) ====================

export type HandlingStatus = 
  | 'preparation'
  | 'departed'
  | 'arrived_saudi'
  | 'checkin_makkah'
  | 'umroh_makkah'
  | 'checkout_makkah'
  | 'checkin_madinah'
  | 'umroh_madinah'
  | 'checkout_madinah'
  | 'return_journey'
  | 'arrived_indonesia'
  | 'completed';

export type HandlingLocation = 
  | 'indonesia'
  | 'in_flight'
  | 'jeddah'
  | 'makkah'
  | 'madinah';

export interface HandlingProgress {
  id: string;
  order_id: string;
  group_name: string;
  total_jamaah: number;
  status: HandlingStatus;
  location: HandlingLocation;
  progress_percentage: number;
  departure_date?: string;
  return_date?: string;
  current_hotel?: string;
  notes?: string;
  timeline: HandlingTimeline[];
  updated_by: string; // Hotel role
  updated_at: string;
}

export interface HandlingTimeline {
  status: HandlingStatus;
  location: HandlingLocation;
  timestamp: string;
  notes?: string;
  updated_by: string;
}

// ==================== NOTIFICATION ====================

export type NotificationType = 
  | 'invoice_new'
  | 'payment_reminder'
  | 'payment_received'
  | 'invoice_lunas'
  | 'order_cancelled'
  | 'visa_issued'
  | 'ticket_issued'
  | 'hotel_allocated'
  | 'bus_allocated'
  | 'handling_update'
  | 'overdue_warning';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  whatsapp_sent: boolean;
  whatsapp_sent_at?: string;
  email_sent: boolean;
  email_sent_at?: string;
  read: boolean;
  read_at?: string;
  data?: any; // Additional data (order_id, invoice_id, files, etc)
  created_at: string;
}

// ==================== EXPORT/REPORT ====================

export type ExportPeriod = 'daily' | 'weekly' | 'monthly';
export type ExportFormat = 'excel' | 'pdf';

export interface ExportRequest {
  role: UserRole;
  branch_id?: string;
  product_types?: OrderItemType[];
  period: ExportPeriod;
  start_date: string;
  end_date: string;
  format: ExportFormat;
}

// ==================== TABLE ====================

export interface TableColumn {
  id: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** Backend field name for server-side sort (default: id) */
  sortKey?: string;
}

// ==================== COMMON ====================

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';
export type BadgeSize = 'sm' | 'md' | 'lg';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  divider?: boolean;
  danger?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// ==================== AUTH ====================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token?: string;
  };
}