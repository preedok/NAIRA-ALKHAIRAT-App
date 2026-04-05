'use strict';

/**
 * Hapus SEMUA data di database KECUALI:
 * - User internal / master (semua role KECUALI partner owner: owner_mou, owner_non_mou, owner)
 * - banks (daftar bank)
 * - accounting_bank_accounts (rekening bank)
 * - wilayah, provinsi, kabupaten (master lokasi)
 *
 * Juga mengosongkan: cabang (branches), produk, akuntansi (COA, jurnal, dll.), transaksi,
 * owner_profiles, maskapai, modul Accurate/Purchasing jika ada.
 *
 * Wajib: CONFIRM=YES
 *
 * PowerShell:
 *   cd backend
 *   $env:CONFIRM="YES"; node scripts/clean-data-keep-users-banks-wilayah.js
 *
 * Atau: npm run clean:data-keep-users-banks-wilayah
 *   (set CONFIRM=YES di environment)
 */
require('dotenv').config();
const path = require('path');

if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch (e) { /* ignore */ }
}

const { sequelize } = require('../src/models');

const OWNER_ROLES = ['owner_mou', 'owner_non_mou', 'owner'];

/** Urutan DELETE: anak (FK) dulu. Tabel opsional: error "does not exist" diabaikan. */
const TABLES_DELETE_ORDER = [
  'reconciliation_logs',
  'payment_reallocations',
  'payment_proofs',
  'invoice_status_histories',
  'invoice_files',
  'refunds',
  'order_cancellation_requests',
  'order_revisions',
  'owner_balance_transactions',
  'hotel_progress',
  'ticket_progress',
  'visa_progress',
  'bus_progress',
  'order_items',
  'invoices',
  'orders',
  'notifications',
  'audit_logs',
  'maintenance_notices',
  'system_logs',
  'financial_report_presets',

  // Accurate (anak → induk)
  'accurate_depreciation_schedule',
  'accurate_fixed_assets',
  'accurate_cash_transactions',
  'accurate_e_faktur',
  'accurate_tax_configs',
  'accurate_stock_mutation_lines',
  'accurate_stock_mutations',
  'accurate_inventory_balances',
  'accurate_warehouses',
  'accurate_supplier_payments',
  'accurate_purchase_invoices',
  'accurate_po_items',
  'accurate_purchase_orders',
  'accurate_sales_returns',
  'accurate_quotation_items',
  'accurate_quotations',

  // Purchasing
  'purchase_payments',
  'purchase_invoice_lines',
  'purchase_invoices',
  'purchase_order_lines',
  'purchase_orders',

  'accounting_audit_logs',
  'journal_entry_lines',
  'journal_entries',
  'account_mappings',
  'accounting_customers',
  'accounting_suppliers',
  'accounting_exchange_rates',

  'hotel_monthly_prices',
  'product_availability',
  'hotel_room_inventory',
  'hotel_seasons',
  'visa_season_quota',
  'visa_seasons',
  'bus_season_quota',
  'bus_seasons',
  'ticket_season_quota',
  'ticket_seasons',
  'product_prices',
  'business_rule_configs',
  'products',
  'maskapai',
  'app_settings'
];

const CHART_OF_ACCOUNTS = 'chart_of_accounts';

async function delTable(name) {
  try {
    await sequelize.query(`DELETE FROM "${name}"`);
    console.log(`  ✓ ${name}`);
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log(`  - ${name} (skip)`);
    } else {
      console.error(`  ✗ ${name}:`, err.message);
    }
  }
}

async function run() {
  if (sequelize.getDialect() !== 'postgres') {
    console.error('Script ini hanya untuk PostgreSQL.');
    process.exit(1);
  }

  if (String(process.env.CONFIRM || '').toUpperCase() !== 'YES') {
    console.log('STOP: Set CONFIRM=YES untuk menjalankan penghapusan ini.');
    console.log('  $env:CONFIRM="YES"; node scripts/clean-data-keep-users-banks-wilayah.js');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    console.log('Terhubung ke database.\n');
  } catch (err) {
    console.error('Gagal koneksi PostgreSQL. Periksa DATABASE_URL / DB_* di backend/.env');
    console.error(err.message);
    process.exit(1);
  }

  console.log('=== Fase 1: Transaksi, Accurate, Purchasing, produk, log ===\n');
  for (const t of TABLES_DELETE_ORDER) {
    await delTable(t);
  }

  console.log('\n=== Fase 2: Lepaskan FK rekening & cabang ke COA/cabang ===\n');
  try {
    await sequelize.query(`
      UPDATE accounting_bank_accounts SET gl_account_id = NULL, branch_id = NULL
    `);
    console.log('  ✓ accounting_bank_accounts: gl_account_id, branch_id → NULL');
  } catch (err) {
    console.error('  ✗ accounting_bank_accounts:', err.message);
  }

  console.log('\n=== Fase 3: Chart of accounts & periode fiskal ===\n');
  try {
    await sequelize.query(`DELETE FROM "${CHART_OF_ACCOUNTS}"`);
    console.log(`  ✓ ${CHART_OF_ACCOUNTS}`);
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log(`  - ${CHART_OF_ACCOUNTS} (skip)`);
    } else {
      console.error(`  ✗ ${CHART_OF_ACCOUNTS}:`, err.message);
    }
  }
  await delTable('accounting_periods');
  await delTable('accounting_fiscal_years');

  console.log('\n=== Fase 4: Owner profiles & user partner ===\n');
  await delTable('owner_profiles');
  try {
    await sequelize.query(`
      DELETE FROM users WHERE role IN ('owner_mou', 'owner_non_mou', 'owner')
    `);
    console.log('  ✓ users (owner_mou / owner_non_mou / owner)');
  } catch (err) {
    console.error('  ✗ users (owner):', err.message);
    await sequelize.close();
    process.exit(1);
  }

  console.log('\n=== Fase 5: Cabang (data dihapus; user internal tetap, branch_id di-null) ===\n');
  try {
    await sequelize.query(`UPDATE users SET branch_id = NULL WHERE branch_id IS NOT NULL`);
    console.log('  ✓ users.branch_id → NULL');
  } catch (err) {
    console.error('  ✗ users.branch_id:', err.message);
  }
  await delTable('branches');

  console.log('\nSelesai. Data yang TETAP:');
  console.log('  - users (selain role owner_mou, owner_non_mou, owner)');
  console.log('  - banks, accounting_bank_accounts');
  console.log('  - wilayah, provinsi, kabupaten');
  console.log('\nIsi ulang cabang/COA/produk jika perlu: npm run seed, seed:accounting, seed:branches, dll.');
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
