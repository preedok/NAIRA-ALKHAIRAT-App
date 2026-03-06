-- =============================================================================
-- BGG App - Database Schema (PostgreSQL)
-- Skema database terbaru untuk workflow project (Invoice, Order, Refund, Progress,
-- Accounting, Purchasing, dll). Berdasarkan Sequelize models + migrations.
--
-- Nama database: sama dengan DB_NAME di backend/.env (default: db_bgg_group)
--
-- Catatan:
-- - Untuk environment baru: disarankan jalankan migrations (npm run migrate)
--   dari folder backend agar history migrasi tercatat.
-- - File ini berguna sebagai referensi skema final dan dokumentasi.
-- =============================================================================

-- Buat database dulu jika belum ada (jalankan saat terhubung ke 'postgres'):
-- CREATE DATABASE db_bgg_group;
-- Lalu connect ke db_bgg_group sebelum menjalankan skema di bawah.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- ENUM types (used by Sequelize; values from constants)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE enum_users_role AS ENUM (
    'super_admin', 'admin_pusat', 'invoice_koordinator', 'tiket_koordinator', 'visa_koordinator',
    'role_hotel', 'role_bus', 'invoice_saudi', 'role_accounting', 'owner',
    'admin_provinsi', 'admin_wilayah', 'admin_cabang', 'handling'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_owner_profiles_status AS ENUM (
    'pending_registration_payment', 'pending_registration_verification', 'deposit_verified',
    'assigned_to_branch', 'active', 'rejected',
    'registered_pending_mou', 'pending_mou_approval', 'pending_deposit_payment', 'pending_deposit_verification'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_orders_status AS ENUM ('draft', 'tentative', 'confirmed', 'processing', 'completed', 'cancelled', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_invoices_status AS ENUM (
    'draft', 'tentative', 'partial_paid', 'paid', 'processing', 'completed', 'overdue',
    'canceled', 'cancelled', 'cancelled_refund', 'refunded', 'order_updated', 'overpaid',
    'overpaid_transferred', 'overpaid_received', 'refund_canceled', 'overpaid_refund_pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_payment_proofs_payment_type AS ENUM ('dp', 'partial', 'full');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_payment_proofs_payment_location AS ENUM ('indonesia', 'saudi');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_refunds_status AS ENUM ('requested', 'approved', 'rejected', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_order_items_type AS ENUM ('hotel', 'visa', 'ticket', 'bus', 'handling', 'package');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_products_type AS ENUM ('hotel', 'visa', 'ticket', 'bus', 'handling', 'package');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_hotel_progress_status AS ENUM ('waiting_confirmation', 'confirmed', 'room_assigned', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_hotel_progress_meal_status AS ENUM ('pending', 'confirmed', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Master: wilayah, provinsi, kabupaten
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wilayah (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provinsi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  wilayah_id UUID REFERENCES wilayah(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kabupaten (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode VARCHAR(20) NOT NULL UNIQUE,
  nama VARCHAR(150) NOT NULL,
  provinsi_id UUID NOT NULL REFERENCES provinsi(id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Branches
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  region VARCHAR(100),
  provinsi_id UUID REFERENCES provinsi(id) ON UPDATE CASCADE ON DELETE SET NULL,
  manager_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  koordinator_provinsi VARCHAR(255),
  koordinator_provinsi_phone VARCHAR(50),
  koordinator_provinsi_email VARCHAR(255),
  koordinator_wilayah VARCHAR(255),
  koordinator_wilayah_phone VARCHAR(50),
  koordinator_wilayah_email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL,
  branch_id UUID REFERENCES branches(id) ON UPDATE CASCADE ON DELETE SET NULL,
  wilayah_id UUID REFERENCES wilayah(id) ON UPDATE CASCADE ON DELETE SET NULL,
  region VARCHAR(100),
  company_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Owner profiles (partner registration & activation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owner_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_registration_payment',
  address TEXT,
  operational_region VARCHAR(255),
  whatsapp VARCHAR(50),
  npwp VARCHAR(50),
  legal_doc_url VARCHAR(500),
  mou_template_downloaded_at TIMESTAMPTZ,
  mou_signed_url VARCHAR(500),
  mou_uploaded_at TIMESTAMPTZ,
  mou_rejected_reason TEXT,
  deposit_amount DECIMAL(18,2),
  deposit_proof_url VARCHAR(500),
  deposit_verified_at TIMESTAMPTZ,
  deposit_verified_by UUID REFERENCES users(id),
  preferred_branch_id UUID REFERENCES branches(id) ON UPDATE CASCADE ON DELETE SET NULL,
  assigned_branch_id UUID REFERENCES branches(id),
  assigned_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES users(id),
  has_special_price BOOLEAN DEFAULT false,
  registration_payment_proof_url VARCHAR(500),
  registration_payment_amount DECIMAL(18,2),
  registration_payment_verified_at TIMESTAMPTZ,
  registration_payment_verified_by UUID REFERENCES users(id),
  mou_generated_url VARCHAR(500),
  activation_generated_password VARCHAR(255),
  balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Products (master)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_package BOOLEAN DEFAULT false,
  meta JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  total_jamaah INTEGER DEFAULT 0,
  subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
  discount DECIMAL(18,2) DEFAULT 0,
  penalty_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'IDR',
  status VARCHAR(50) DEFAULT 'draft',
  blocked_at TIMESTAMPTZ,
  blocked_reason VARCHAR(255),
  unblocked_by UUID REFERENCES users(id),
  unblocked_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  notes TEXT,
  currency_rates_override JSONB,
  dp_payment_status VARCHAR(20),
  dp_percentage_paid DECIMAL(5,2),
  total_amount_idr DECIMAL(18,2),
  total_amount_sar DECIMAL(18,2),
  order_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Order items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  product_ref_id UUID REFERENCES products(id),
  product_ref_type VARCHAR(50),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(18,2) NOT NULL,
  unit_price_currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
  subtotal DECIMAL(18,2) NOT NULL,
  manifest_file_url VARCHAR(500),
  jamaah_data_type VARCHAR(20),
  jamaah_data_value TEXT,
  jamaah_uploaded_at TIMESTAMPTZ,
  jamaah_uploaded_by UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  meta JSONB DEFAULT '{}',
  currency_rates_override JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Invoices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES users(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  total_amount DECIMAL(18,2) NOT NULL,
  dp_percentage INTEGER NOT NULL DEFAULT 30,
  dp_amount DECIMAL(18,2) NOT NULL,
  paid_amount DECIMAL(18,2) DEFAULT 0,
  remaining_amount DECIMAL(18,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  due_date_dp DATE,
  due_date_full DATE,
  auto_cancel_at TIMESTAMPTZ,
  is_overdue BOOLEAN DEFAULT false,
  overdue_activated_by UUID REFERENCES users(id),
  overdue_activated_at TIMESTAMPTZ,
  terms JSONB DEFAULT '[]',
  notes TEXT,
  is_blocked BOOLEAN DEFAULT false,
  unblocked_by UUID REFERENCES users(id),
  unblocked_at TIMESTAMPTZ,
  overpaid_amount DECIMAL(18,2) DEFAULT 0,
  overpaid_handling VARCHAR(50),
  order_updated_at TIMESTAMPTZ,
  total_amount_idr DECIMAL(18,2),
  total_amount_sar DECIMAL(18,2),
  paid_amount_idr DECIMAL(18,2) DEFAULT 0,
  paid_amount_sar DECIMAL(18,2) DEFAULT 0,
  last_order_revision_id UUID,
  cancelled_refund_amount DECIMAL(18,2),
  cancellation_handling_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Banks (master)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Accounting: chart of accounts, fiscal years, periods
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_fiscal_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fiscal_year_id UUID NOT NULL REFERENCES accounting_fiscal_years(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  period_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES chart_of_accounts(id) ON UPDATE CASCADE ON DELETE SET NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  level INTEGER DEFAULT 1,
  is_header BOOLEAN DEFAULT false,
  currency VARCHAR(5) DEFAULT 'IDR',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  currency VARCHAR(5) DEFAULT 'IDR',
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  branch_id UUID REFERENCES branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  supplier_type VARCHAR(30) NOT NULL,
  currency VARCHAR(5) DEFAULT 'IDR',
  term_of_payment_days INTEGER DEFAULT 0,
  payable_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_profile_id UUID REFERENCES owner_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
  wilayah_id UUID REFERENCES wilayah(id),
  branch_id UUID REFERENCES branches(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  term_of_payment_days INTEGER DEFAULT 0,
  credit_limit DECIMAL(18,2) DEFAULT 0,
  receivable_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency VARCHAR(5) NOT NULL,
  to_currency VARCHAR(5) NOT NULL,
  rate DECIMAL(18,6) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Payment proofs (bukti bayar invoice)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE CASCADE,
  payment_type VARCHAR(20) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  payment_currency VARCHAR(5) DEFAULT 'IDR',
  amount_original DECIMAL(18,2),
  amount_idr DECIMAL(18,2),
  amount_sar DECIMAL(18,2),
  bank_id UUID REFERENCES banks(id) ON UPDATE CASCADE ON DELETE SET NULL,
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  sender_account_name VARCHAR(255),
  sender_account_number VARCHAR(50),
  recipient_bank_account_id UUID REFERENCES accounting_bank_accounts(id) ON UPDATE CASCADE ON DELETE SET NULL,
  transfer_date DATE,
  proof_file_url VARCHAR(500) NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  verified_status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  issued_by UUID REFERENCES users(id),
  payment_location VARCHAR(20) DEFAULT 'indonesia',
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Refunds
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id),
  order_id UUID REFERENCES orders(id),
  owner_id UUID REFERENCES users(id),
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  account_holder_name VARCHAR(100),
  source VARCHAR(20) DEFAULT 'cancel',
  amount DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'requested',
  reason TEXT,
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  refunded_at TIMESTAMPTZ,
  proof_file_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Invoice files (PDF metadata), status history, reallocations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL UNIQUE REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  is_example BOOLEAN DEFAULT false,
  generated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_status_histories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL,
  changed_by UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  reason VARCHAR(100),
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_reallocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_invoice_id UUID NOT NULL REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  target_invoice_id UUID NOT NULL REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount DECIMAL(18,2) NOT NULL,
  performed_by UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Order revisions (audit trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE SET NULL,
  revision_number INTEGER NOT NULL,
  snapshot_before JSONB,
  snapshot_after JSONB,
  changed_by UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Owner balance (saldo dari pembatalan / alokasi)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owner_balance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(18,2) NOT NULL,
  balance_after DECIMAL(18,2),
  type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Progress: hotel, ticket, visa, bus
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotel_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'waiting_confirmation',
  room_number VARCHAR(50),
  meal_status VARCHAR(20) DEFAULT 'pending',
  check_in_date DATE,
  check_out_date DATE,
  check_in_time VARCHAR(5),
  check_out_time VARCHAR(5),
  notes TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visa_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'document_received',
  notes TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bus_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Product prices, availability, seasons (hotel, visa, bus, ticket)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  branch_id UUID REFERENCES branches(id),
  owner_id UUID REFERENCES users(id),
  unit_price DECIMAL(18,2) NOT NULL,
  currency VARCHAR(5) DEFAULT 'IDR',
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  is_available BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotel_seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotel_room_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  season_id UUID NOT NULL REFERENCES hotel_seasons(id),
  room_type VARCHAR(50),
  total_rooms INTEGER DEFAULT 0,
  booked_rooms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visa_seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visa_season_quota (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  season_id UUID NOT NULL REFERENCES visa_seasons(id),
  quota INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bus_seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bus_season_quota (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  season_id UUID NOT NULL REFERENCES bus_seasons(id),
  quota INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_season_quota (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  season_id UUID NOT NULL REFERENCES ticket_seasons(id),
  bandara_code VARCHAR(10),
  period_type VARCHAR(20),
  period_value VARCHAR(20),
  quota INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Accounting: journal entries, mappings, customers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mapping_type VARCHAR(50) NOT NULL,
  debit_account_id UUID REFERENCES chart_of_accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  credit_account_id UUID REFERENCES chart_of_accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_number VARCHAR(50) NOT NULL UNIQUE,
  period_id UUID REFERENCES accounting_periods(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  entry_date DATE NOT NULL,
  journal_type VARCHAR(30) NOT NULL,
  source_type VARCHAR(50),
  source_id UUID,
  branch_id UUID REFERENCES branches(id),
  wilayah_id UUID REFERENCES wilayah(id),
  description TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  total_debit DECIMAL(18,2) DEFAULT 0,
  total_credit DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(5) DEFAULT 'IDR',
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON UPDATE CASCADE ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  debit_amount DECIMAL(18,2) DEFAULT 0,
  credit_amount DECIMAL(18,2) DEFAULT 0,
  line_description TEXT,
  cost_center VARCHAR(50),
  reference_type VARCHAR(50),
  reference_id UUID,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Business rules, notifications, audit, system
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_rule_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  key VARCHAR(100) NOT NULL,
  value JSONB,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255),
  body TEXT,
  read_at TIMESTAMPTZ,
  trigger_type VARCHAR(50),
  reference_type VARCHAR(50),
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  branch_id UUID REFERENCES branches(id),
  action VARCHAR(100),
  entity_type VARCHAR(100),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level VARCHAR(20),
  message TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255),
  message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_report_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Purchasing (PO, invoice, payment)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES accounting_suppliers(id),
  product_id UUID REFERENCES products(id),
  branch_id UUID REFERENCES branches(id),
  order_number VARCHAR(50),
  order_date DATE,
  status VARCHAR(30) DEFAULT 'draft',
  total_amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(5) DEFAULT 'IDR',
  notes TEXT,
  proof_file_url VARCHAR(500),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
  account_id UUID REFERENCES chart_of_accounts(id),
  description TEXT,
  quantity DECIMAL(18,2) DEFAULT 1,
  unit_price DECIMAL(18,2) DEFAULT 0,
  amount DECIMAL(18,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES accounting_suppliers(id),
  product_id UUID REFERENCES products(id),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  branch_id UUID REFERENCES branches(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  invoice_number VARCHAR(50),
  invoice_date DATE,
  status VARCHAR(30) DEFAULT 'draft',
  total_amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(5) DEFAULT 'IDR',
  proof_file_url VARCHAR(500),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON UPDATE CASCADE ON DELETE CASCADE,
  purchase_order_line_id UUID REFERENCES purchase_order_lines(id),
  account_id UUID REFERENCES chart_of_accounts(id),
  description TEXT,
  quantity DECIMAL(18,2) DEFAULT 1,
  unit_price DECIMAL(18,2) DEFAULT 0,
  amount DECIMAL(18,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id),
  supplier_id UUID NOT NULL REFERENCES accounting_suppliers(id),
  bank_account_id UUID REFERENCES accounting_bank_accounts(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  payment_date DATE,
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(5) DEFAULT 'IDR',
  reference VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Indexes (common lookups)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id ON invoices(owner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch_id ON invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_orders_owner_id ON orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_invoice_id ON payment_proofs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refunds_invoice_id ON refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reallocations_source ON payment_reallocations(source_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reallocations_target ON payment_reallocations(target_invoice_id);

-- =============================================================================
-- End of schema
-- =============================================================================
