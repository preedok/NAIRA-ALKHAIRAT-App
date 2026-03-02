/**
 * Hapus data database SELAIN user divisi + owner.
 *
 * TETAP ADA:
 * - users: hanya role divisi & owner
 * - owner_profiles: hanya untuk user owner yang tetap
 * - master wilayah/provinsi/branches (agar relasi user tidak rusak)
 *
 * Yang dihapus: orders, invoices, payment proofs, refunds, notifikasi, log,
 * progress hotel/visa/tiket/bus, accounting, products & product_prices, business_rules, dll.
 *
 * Cara pakai:
 *   Dari folder backend:
 *     node scripts/clean-data-keep-division-owner-users.js
 *
 * Safety:
 *   Set env CONFIRM=YES untuk benar-benar jalan.
 *   Contoh PowerShell:
 *     $env:CONFIRM="YES"; node scripts/clean-data-keep-division-owner-users.js
 */
'use strict';
require('dotenv').config();
const path = require('path');

if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
  } catch (e) {}
}

const { sequelize } = require('../src/models');

// Role yang dianggap "divisi + owner"
const KEEP_ROLES = [
  'owner',
  'admin_koordinator',
  'invoice_koordinator',
  'tiket_koordinator',
  'visa_koordinator',
  'role_hotel',
  'role_bus',
  'role_invoice_saudi',
  'role_accounting',
  'role_handling'
];

// Hapus: child dulu (FK), baru parent. Case-sensitive untuk PostgreSQL.
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

  if (String(process.env.CONFIRM || '').toUpperCase() !== 'YES') {
    console.log('STOP: Script ini DESTRUKTIF dan akan menghapus banyak data.');
    console.log('Jika Anda yakin, set env CONFIRM=YES lalu jalankan lagi.');
    console.log('Contoh PowerShell:  $env:CONFIRM="YES"; node scripts/clean-data-keep-division-owner-users.js');
    process.exit(1);
  }

  console.log('Menghapus data non-master (tetap: users divisi+owner, owner_profiles owner, wilayah/provinsi/branches)...\n');

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

  // Keep only division+owner users
  console.log('\nMenyisakan user role divisi + owner...');
  const keepRolesSql = KEEP_ROLES.map((r) => `'${r.replace(/'/g, "''")}'`).join(', ');

  // Null-kan field owner_profiles yang mereferensikan user non-keep (agar tidak terhalang FK saat delete users)
  try {
    await sequelize.query(`
      UPDATE "owner_profiles"
      SET
        deposit_verified_by = NULL,
        activated_by = NULL,
        registration_payment_verified_by = NULL
      WHERE
        (deposit_verified_by IS NOT NULL AND deposit_verified_by NOT IN (SELECT id FROM "users" WHERE role IN (${keepRolesSql})))
        OR (activated_by IS NOT NULL AND activated_by NOT IN (SELECT id FROM "users" WHERE role IN (${keepRolesSql})))
        OR (registration_payment_verified_by IS NOT NULL AND registration_payment_verified_by NOT IN (SELECT id FROM "users" WHERE role IN (${keepRolesSql})))
    `);
    console.log('  ✓ owner_profiles (unlink verified/activated by)');
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log('  - owner_profiles (tabel tidak ada, skip)');
    } else {
      console.error('  ✗ owner_profiles (unlink):', err.message);
    }
  }

  // Hapus owner_profiles untuk user yang tidak disisakan
  try {
    await sequelize.query(`
      DELETE FROM "owner_profiles"
      WHERE user_id NOT IN (SELECT id FROM "users" WHERE role IN (${keepRolesSql}))
    `);
    console.log('  ✓ owner_profiles (delete non-keep)');
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log('  - owner_profiles (tabel tidak ada, skip)');
    } else {
      console.error('  ✗ owner_profiles (delete):', err.message);
    }
  }

  // Hapus user selain role yang disisakan
  const [before] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM "users"`);
  try {
    await sequelize.query(`
      DELETE FROM "users"
      WHERE role NOT IN (${keepRolesSql})
    `);
    console.log('  ✓ users (delete non-keep)');
  } catch (err) {
    console.error('  ✗ users:', err.message);
  }
  const [after] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM "users"`);

  console.log('\nSelesai.');
  console.log(`Users sebelum: ${before?.[0]?.n ?? '-'}`);
  console.log(`Users sesudah: ${after?.[0]?.n ?? '-'}`);
  console.log('\nYang tetap ada: users (role divisi+owner), dan owner_profiles untuk owner yang tersisa; master wilayah/provinsi/branches.');

  await sequelize.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

