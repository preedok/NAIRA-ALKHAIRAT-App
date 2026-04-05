'use strict';

/**
 * Hapus SEMUA data order & invoice serta data yang berhubungan.
 * Juga: audit log, system log, jurnal (baris + header) bila tidak terblokir FK modul lain.
 * TETAP: chart_of_accounts, COA, master bank, products, users, branches, owner_profiles,
 * product_prices, business_rules, periode fiskal, dll.
 *
 * Cara pakai (dari folder backend):
 *   node scripts/clear-orders-invoices.js
 */
require('dotenv').config();
const path = require('path');
if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch (e) {}
}

const { sequelize } = require('../src/models');

// Urutan hapus: child dulu (FK), baru parent. Case-sensitive untuk PostgreSQL.
const TABLES_IN_ORDER = [
  'reconciliation_logs',    // payment_proof_id
  'payment_reallocations',  // source/target invoice
  'payment_proofs',         // invoice_id
  'invoice_status_histories', // invoice_id
  'invoice_files',          // invoice_id, order_id
  'refunds',                // invoice_id, order_id
  'order_cancellation_requests', // order_id, invoice_id
  'order_revisions',        // order_id, invoice_id
  'owner_balance_transactions', // reference_type order/invoice
  'visa_progress',          // order_item_id
  'ticket_progress',        // order_item_id
  'hotel_progress',         // order_item_id
  'bus_progress',           // order_item_id
  'order_items',            // order_id
  'invoices',               // order_id
  'orders',
  'notifications',          // data JSON sering berisi order_id/invoice_id
  'audit_logs',
  'system_logs',
  'accounting_audit_logs'
];

/** Kolom journal_entry_id di modul Accurate/Purchasing — di-null-kan sebelum hapus jurnal. */
const TABLES_NULL_JOURNAL_ENTRY_ID = [
  'accurate_depreciation_schedule',
  'accurate_cash_transactions',
  'accurate_supplier_payments',
  'accurate_purchase_invoices',
  'purchase_invoices',
  'purchase_payments'
];

const JOURNAL_AFTER_ORDER = ['journal_entry_lines', 'journal_entries'];

async function run() {
  const dialect = sequelize.getDialect();
  if (dialect !== 'postgres') {
    console.error('Script ini hanya untuk PostgreSQL.');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
  } catch (err) {
    console.error('Gagal koneksi database:', err.message);
    process.exit(1);
  }

  console.log('Menghapus data order, invoice, log transaksi, dan jurnal (jika memungkinkan)...');
  console.log('(Tetap: products, users, branches, COA, bank master, product_prices, owner_profiles)\n');

  for (const table of TABLES_IN_ORDER) {
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

  console.log('\nLepaskan referensi jurnal dari modul lain (jika ada):');
  for (const table of TABLES_NULL_JOURNAL_ENTRY_ID) {
    try {
      await sequelize.query(
        `UPDATE "${table}" SET journal_entry_id = NULL WHERE journal_entry_id IS NOT NULL`
      );
      console.log(`  ✓ ${table}.journal_entry_id → NULL`);
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        console.log(`  - ${table} (skip)`);
      } else if (err.message && err.message.includes('column') && err.message.includes('does not exist')) {
        console.log(`  - ${table} (kolom tidak ada, skip)`);
      } else {
        console.warn(`  ⚠ ${table}:`, err.message);
      }
    }
  }

  console.log('\nJurnal umum (transaksi keuangan tersimpan di sini):');
  for (const table of JOURNAL_AFTER_ORDER) {
    try {
      await sequelize.query(`DELETE FROM "${table}"`);
      console.log(`  ✓ ${table}`);
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        console.log(`  - ${table} (skip)`);
      } else {
        console.warn(`  ⚠ ${table}: ${err.message}`);
        console.warn('     (Ada tabel lain yang masih mereferensi jurnal, mis. Accurate/Purchasing — hapus/null-kan manual jika perlu.)');
      }
    }
  }

  console.log('\nSelesai. Data order, invoice, dan terkait sudah dihapus.');
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
