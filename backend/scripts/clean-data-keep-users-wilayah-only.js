'use strict';

/**
 * Hapus SEMUA data transaksional & master lain di database,
 * KECUALI:
 * - tabel `users`
 * - tabel `wilayah`
 *
 * Yang DIHAPUS (baris datanya, bukan tabelnya):
 * - orders, invoices, payment_proofs, refunds, reallocations, notifications, logs, dll.
 * - products & product_prices, business_rules, seasons/quota, payroll, accounting, bank statements, dll.
 * - master cabang & provinsi & owner_profiles.
 *
 * Cara pakai (dari folder backend):
 *   PowerShell:
 *     cd c:\dev\BGG_App\backend
 *     $env:CONFIRM=\"YES\"
 *     node scripts/clean-data-keep-users-wilayah-only.js
 */

require('dotenv').config();
const path = require('path');

if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
  } catch (e) {}
}

const { sequelize } = require('../src/models');

// Urutan hapus: child dulu (FK), baru parent. Case-sensitive untuk PostgreSQL.
const TABLES_DELETE_ORDER = [
  // Pembayaran / refund / invoice file
  'payment_reallocations',
  'payment_proofs',
  'invoice_files',
  'refunds',
  'owner_balance_transactions',

  // Accounting
  'journal_entry_lines',
  'journal_entries',
  'account_mappings',
  'accounting_periods',
  'accounting_fiscal_years',

  // Progress per divisi
  'hotel_progress',
  'ticket_progress',
  'visa_progress',
  'bus_progress',

  // Core order/invoice
  'order_items',
  'invoices',
  'orders',

  // App-level logs/settings
  'notifications',
  'audit_logs',
  'maintenance_notices',
  'system_logs',
  'financial_report_presets',

  // Product master & pricing
  'product_availability',
  'hotel_room_inventory',
  'hotel_seasons',
  'visa_seasons',
  'visa_season_quotas',
  'bus_seasons',
  'bus_season_quotas',
  'ticket_seasons',
  'ticket_season_quotas',
  'product_prices',
  'business_rule_configs',
  'products',
  'app_settings',

  // Bank master
  'accounting_bank_accounts',
  'banks',

  // Master owner & cabang/provinsi
  'owner_profiles',
  'branches',
  'provinsi'
];

// chart_of_accounts punya self-reference (parent_id): hapus anak dulu
const CHART_OF_ACCOUNTS_TABLE = 'chart_of_accounts';

async function run() {
  const dialect = sequelize.getDialect();
  if (dialect !== 'postgres') {
    console.error('Script ini hanya untuk PostgreSQL.');
    process.exit(1);
  }

  if (String(process.env.CONFIRM || '').toUpperCase() !== 'YES') {
    console.log('STOP: Script ini DESTRUKTIF dan akan menghapus hampir semua data.');
    console.log('Jika Anda yakin, set env CONFIRM=YES lalu jalankan lagi.');
    console.log('Contoh PowerShell:');
    console.log('  cd c:\\dev\\BGG_App\\backend');
    console.log('  $env:CONFIRM=\"YES\"; node scripts/clean-data-keep-users-wilayah-only.js');
    process.exit(1);
  }

  console.log('Menghapus SEMUA data non-master (tetap: tabel users & wilayah)...\n');

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

  console.log('\nSelesai.');
  console.log('Tabel yang TETAP ADA datanya:');
  console.log('  - users');
  console.log('  - wilayah');
  console.log('Tabel lain sudah dikosongkan (data dihapus).');

  await sequelize.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

