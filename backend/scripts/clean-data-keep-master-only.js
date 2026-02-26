/**
 * Hapus semua data di database KECUALI data master:
 * - Data wilayah (wilayah, provinsi, branches/cabang)
 * - Data user (semua role termasuk divisi dan owner)
 * - Data owner (owner_profiles)
 *
 * Yang dihapus: orders, invoices, payment proofs, refunds, notifikasi, log,
 * progress hotel/visa/tiket/bus, accounting transaksional, payroll runs,
 * products & product_prices, business_rules, dll.
 *
 * Cara pakai:
 *   Dari folder backend:  node scripts/clean-data-keep-master-only.js
 *   Dari root project:    node backend/scripts/clean-data-keep-master-only.js
 *   Atau:                npm run clean:data-keep-master   (dari folder backend)
 */
require('dotenv').config();
const path = require('path');

// Load env from backend folder if run from root
if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
  } catch (e) {}
}

const { sequelize } = require('../src/models');

const TABLES_DELETE_ORDER = [
  'payment_reallocations',
  'payment_proofs',
  'invoice_files',
  'refunds',
  'owner_balance_transactions',
  'journal_entry_lines',
  'journal_entries',
  'account_mappings',
  'accounting_periods',
  'accounting_fiscal_years',
  'payroll_items',
  'payroll_runs',
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
  'employee_salaries',
  'payroll_settings',
  'product_availability',
  'hotel_room_inventory',
  'hotel_seasons',
  'product_prices',
  'business_rule_configs',
  'products',
  'app_settings'
];

// chart_of_accounts punya self-reference (parent_id): hapus anak dulu
const CHART_OF_ACCOUNTS_TABLE = 'chart_of_accounts';

async function run() {
  const dialect = sequelize.getDialect();
  if (dialect !== 'postgres') {
    console.error('Script ini hanya untuk PostgreSQL.');
    process.exit(1);
  }

  console.log('Menghapus data transaksional & non-master (tetap: wilayah, provinsi, branches, users, owner_profiles)...\n');

  for (const table of TABLES_DELETE_ORDER) {
    try {
      await sequelize.query(`DELETE FROM "${table}"`);
      console.log(`  ✓ ${table}`);
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        console.log(`  - ${table} (tabel tidak ada, skip)`);
      } else {
        console.error(`  ✗ ${table}:`, err.message);
      }
    }
  }

  // chart_of_accounts: hapus anak (parent_id IS NOT NULL) dulu, lalu sisanya
  try {
    await sequelize.query(`DELETE FROM "${CHART_OF_ACCOUNTS_TABLE}" WHERE parent_id IS NOT NULL`);
    await sequelize.query(`DELETE FROM "${CHART_OF_ACCOUNTS_TABLE}"`);
    console.log(`  ✓ ${CHART_OF_ACCOUNTS_TABLE}`);
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log(`  - ${CHART_OF_ACCOUNTS_TABLE} (tabel tidak ada, skip)`);
    } else {
      console.error(`  ✗ ${CHART_OF_ACCOUNTS_TABLE}:`, err.message);
    }
  }

  console.log('\nSelesai. Data yang TETAP ADA:');
  console.log('  - wilayah, provinsi, branches (cabang)');
  console.log('  - users (semua role: super_admin, admin_pusat, koordinator, role hotel/visa/tiket/bus, accounting, owner, dll)');
  console.log('  - owner_profiles');
  console.log('\nJalankan seed jika perlu mengisi ulang produk & contoh: npm run seed');
  await sequelize.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
