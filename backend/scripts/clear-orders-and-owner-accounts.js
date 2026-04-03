'use strict';

/**
 * Hapus SEMUA data order & invoice + akun owner (owner_mou, owner_non_mou, owner legacy)
 * dan data yang terikat owner (owner_profiles, harga khusus owner, notifikasi/audit owner, rekap_hotel oleh owner).
 *
 * TETAP: cabang, wilayah, provinsi, kabupaten, user selain owner, products, product_prices (tanpa owner_id),
 * business_rules, accounting master, dll.
 *
 * Wajib set env: CONFIRM=YES
 *
 *   cd backend && CONFIRM=YES node scripts/clear-orders-and-owner-accounts.js
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

/** Urutan hapus: anak FK dulu (sama inti dengan clear-orders-invoices + tabel tambahan jika ada). */
const TABLES_ORDER_INVOICE_FIRST = [
  'reconciliation_logs',
  'payment_reallocations',
  'payment_proofs',
  'invoice_status_histories',
  'invoice_files',
  'refunds',
  'order_revisions',
  'owner_balance_transactions',
  'visa_progress',
  'ticket_progress',
  'hotel_progress',
  'bus_progress',
  'order_items',
  'invoices',
  'orders'
];

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
    console.log('STOP: Set CONFIRM=YES untuk menjalankan penghapusan besar ini.');
    console.log('  CONFIRM=YES node scripts/clear-orders-and-owner-accounts.js');
    process.exit(1);
  }

  console.log('=== Fase 1: Order, invoice, dan data terkait ===\n');
  for (const t of TABLES_ORDER_INVOICE_FIRST) {
    await delTable(t);
  }

  console.log('\n=== Fase 2: Data terkait owner (bukan akun user) ===\n');

  try {
    await sequelize.query(`DELETE FROM "hotel_monthly_prices" WHERE owner_id IS NOT NULL`);
    console.log('  ✓ hotel_monthly_prices (baris dengan owner_id)');
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log('  - hotel_monthly_prices (skip)');
    } else {
      console.error('  ✗ hotel_monthly_prices:', err.message);
    }
  }

  try {
    await sequelize.query(`
      DELETE FROM "product_prices" WHERE owner_id IS NOT NULL
    `);
    console.log('  ✓ product_prices (baris dengan owner_id)');
  } catch (err) {
    console.error('  ✗ product_prices:', err.message);
  }

  const ownerSub = `(SELECT id FROM users WHERE role IN ('owner_mou', 'owner_non_mou', 'owner'))`;

  try {
    await sequelize.query(`DELETE FROM "notifications" WHERE user_id IN ${ownerSub}`);
    console.log('  ✓ notifications (untuk user owner)');
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log('  - notifications (skip)');
    } else {
      console.error('  ✗ notifications:', err.message);
    }
  }

  try {
    await sequelize.query(`DELETE FROM "owner_profiles" WHERE user_id IN ${ownerSub}`);
    console.log('  ✓ owner_profiles');
  } catch (err) {
    console.error('  ✗ owner_profiles:', err.message);
  }

  try {
    await sequelize.query(`DELETE FROM "audit_logs" WHERE user_id IN ${ownerSub}`);
    console.log('  ✓ audit_logs (untuk user owner)');
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log('  - audit_logs (skip)');
    } else {
      console.error('  ✗ audit_logs:', err.message);
    }
  }

  try {
    await sequelize.query(`DELETE FROM "rekap_hotel" WHERE created_by IN ${ownerSub}`);
    console.log('  ✓ rekap_hotel (baris yang dibuat user owner)');
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      console.log('  - rekap_hotel (skip)');
    } else {
      console.error('  ✗ rekap_hotel:', err.message);
    }
  }

  const nullifyCols = [
    ['products', 'created_by'],
    ['product_prices', 'created_by'],
    ['business_rule_configs', 'updated_by'],
    ['maintenance_notices', 'created_by'],
    ['journal_entries', 'created_by'],
    ['journal_entries', 'approved_by'],
    ['journal_entries', 'posted_by'],
    ['product_availability', 'updated_by']
  ];

  console.log('\n=== Fase 3: Lepaskan referensi user owner di kolom lain ===\n');
  for (const [table, col] of nullifyCols) {
    try {
      await sequelize.query(`
        UPDATE "${table}" SET "${col}" = NULL
        WHERE "${col}" IN ${ownerSub}
      `);
      console.log(`  ✓ ${table}.${col} → NULL`);
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        console.log(`  - ${table}.${col} (skip)`);
      } else {
        console.log(`  - ${table}.${col}: ${err.message}`);
      }
    }
  }

  console.log('\n=== Fase 4: Hapus user owner ===\n');
  try {
    await sequelize.query(`
      DELETE FROM users WHERE role IN ('owner_mou', 'owner_non_mou', 'owner')
    `);
    console.log('  ✓ users (role owner_mou / owner_non_mou / owner)');
  } catch (err) {
    console.error('  ✗ users:', err.message);
    console.error('    Jika masih gagal, cek FK lain ke users (mis. payroll, purchasing) dan hapus/null-kan manual.');
    await sequelize.close();
    process.exit(1);
  }

  console.log('\nSelesai: order/invoice kosong; akun owner & profil/harga khusus owner dihapus.');
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
