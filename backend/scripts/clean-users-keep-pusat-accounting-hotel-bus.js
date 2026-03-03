/**
 * Hapus semua user di database KECUALI role: admin_pusat, role_accounting, role_hotel, role_bus.
 *
 * Langkah:
 * 1. Hapus data transaksional yang mereferensikan user (agar FK tidak error).
 * 2. Null-kan referensi user di owner_profiles (deposit_verified_by, activated_by, dll).
 * 3. Hapus owner_profiles untuk user yang akan dihapus.
 * 4. Hapus user yang role-nya BUKAN keempat role di atas.
 *
 * Cara pakai (dari folder backend):
 *   PowerShell:
 *     $env:CONFIRM="YES"; node scripts/clean-users-keep-pusat-accounting-hotel-bus.js
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

const KEEP_ROLES = [
  'admin_pusat',
  'role_accounting',
  'role_hotel',
  'role_bus'
];

// Urutan hapus: child dulu (FK), baru parent. Hapus data yang bisa mereferensikan user yang akan dihapus.
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
  'hotel_progress',
  'ticket_progress',
  'visa_progress',
  'bus_progress',
  'order_items',
  'invoice_status_history',
  'order_revisions',
  'invoices',
  'orders',
  'notifications',
  'audit_logs',
  'maintenance_notices',
  'system_logs',
  'financial_report_presets',
  'product_availability',
  'hotel_room_inventory',
  'hotel_seasons',
  'visa_season_quotas',
  'visa_seasons',
  'bus_season_quotas',
  'bus_seasons',
  'ticket_season_quotas',
  'ticket_seasons',
  'product_prices',
  'business_rule_configs',
  'products',
  'app_settings'
];

async function run() {
  const dialect = sequelize.getDialect();
  if (dialect !== 'postgres') {
    console.error('Script ini hanya untuk PostgreSQL.');
    process.exit(1);
  }

  if (String(process.env.CONFIRM || '').toUpperCase() !== 'YES') {
    console.log('STOP: Script ini akan menghapus semua user KECUALI admin_pusat, accounting, hotel, bus.');
    console.log('Data transaksional (orders, invoices, dll) juga akan dihapus agar tidak ada FK error.');
    console.log('Set env CONFIRM=YES lalu jalankan lagi.');
    console.log('Contoh PowerShell:  $env:CONFIRM="YES"; node scripts/clean-users-keep-pusat-accounting-hotel-bus.js');
    process.exit(1);
  }

  const keepRolesSql = KEEP_ROLES.map((r) => `'${r.replace(/'/g, "''")}'`).join(', ');

  console.log('Langkah 1: Hapus data transaksional...\n');
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

  try {
    await sequelize.query(`DELETE FROM "chart_of_accounts" WHERE parent_id IS NOT NULL`);
    await sequelize.query(`DELETE FROM "chart_of_accounts"`);
    console.log('  ✓ chart_of_accounts');
  } catch (err) {
    if (!err.message || !err.message.includes('does not exist')) console.error('  ✗ chart_of_accounts:', err.message);
  }

  console.log('\nLangkah 2: Null-kan referensi user di owner_profiles...');
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

  console.log('\nLangkah 3: Hapus owner_profiles untuk user yang akan dihapus...');
  try {
    const [opResult] = await sequelize.query(`
      DELETE FROM "owner_profiles"
      WHERE user_id NOT IN (SELECT id FROM "users" WHERE role IN (${keepRolesSql}))
    `);
    console.log('  ✓ owner_profiles (delete non-keep)');
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log('  - owner_profiles (tabel tidak ada, skip)');
    } else {
      console.error('  ✗ owner_profiles (delete):', err.message);
      await sequelize.close();
      process.exit(1);
    }
  }

  console.log('\nLangkah 4: Hapus user selain admin_pusat, role_accounting, role_hotel, role_bus...');
  const [beforeRows] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM "users"`);
  const before = (beforeRows && beforeRows[0] && beforeRows[0].n) || 0;
  try {
    await sequelize.query(`
      DELETE FROM "users"
      WHERE role NOT IN (${keepRolesSql})
    `);
    console.log('  ✓ users (deleted)');
  } catch (err) {
    console.error('  ✗ users:', err.message);
    await sequelize.close();
    process.exit(1);
  }
  const [afterRows] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM "users"`);
  const after = (afterRows && afterRows[0] && afterRows[0].n) || 0;

  console.log('\nSelesai.');
  console.log(`Users sebelum: ${before}`);
  console.log(`Users sesudah: ${after} (hanya admin_pusat, accounting, hotel, bus)`);

  await sequelize.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
