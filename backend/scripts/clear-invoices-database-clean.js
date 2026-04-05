'use strict';

/**
 * Hapus SEMUA invoice beserta data yang terhubung: order, order_items, progress produk,
 * bukti bayar, refund, pemindahan dana, riwayat status invoice, file invoice, revisi order,
 * permintaan pembatalan, transaksi saldo owner (seluruh baris di owner_balance_transactions),
 * notifikasi, audit log — agar database bersih dari alur invoice/order.
 *
 * TETAP: users, branches, products, product_prices, owner_profiles, musim hotel, COA, bank master, dll.
 *
 * Wajib konfirmasi (cegah salah jalankan):
 *   Linux/macOS:  CONFIRM=YES node scripts/clear-invoices-database-clean.js
 *   Windows PS:   $env:CONFIRM='YES'; node scripts/clear-invoices-database-clean.js
 *   npm:          CONFIRM=YES npm run clear:invoices-database-clean
 *
 * Atau pakai skrip lama tanpa guard: npm run clear:orders-invoices
 */

require('dotenv').config();
const path = require('path');
if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch (e) { /* ignore */ }
}

if (process.env.CONFIRM !== 'YES') {
  console.error('Ditolak: set CONFIRM=YES untuk menghapus semua data invoice & order terkait.');
  console.error('Lihat komentar di atas file ini.');
  process.exit(1);
}

const { sequelize } = require('../src/models');

const TABLES_IN_ORDER = [
  'reconciliation_logs',
  'payment_reallocations',
  'payment_proofs',
  'invoice_status_histories',
  'invoice_files',
  'refunds',
  'order_cancellation_requests',
  'order_revisions',
  'owner_balance_transactions',
  'visa_progress',
  'ticket_progress',
  'hotel_progress',
  'bus_progress',
  'order_items',
  'invoices',
  'orders',
  'notifications',
  'audit_logs',
  'system_logs',
  'accounting_audit_logs'
];

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
  if (sequelize.getDialect() !== 'postgres') {
    console.error('Script ini hanya untuk PostgreSQL.');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
  } catch (err) {
    console.error('Gagal koneksi database:', err.message);
    process.exit(1);
  }

  console.log('CONFIRM=YES — Menghapus semua invoice, order, dan data terkait...\n');

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

  console.log('\nNull-kan journal_entry_id di modul lain (jika ada):');
  for (const table of TABLES_NULL_JOURNAL_ENTRY_ID) {
    try {
      await sequelize.query(
        `UPDATE "${table}" SET journal_entry_id = NULL WHERE journal_entry_id IS NOT NULL`
      );
      console.log(`  ✓ ${table}`);
    } catch (err) {
      if (err.message && (err.message.includes('does not exist') || err.message.includes('column') && err.message.includes('does not exist'))) {
        console.log(`  - ${table} (skip)`);
      } else {
        console.warn(`  ⚠ ${table}:`, err.message);
      }
    }
  }

  console.log('\nHapus jurnal umum (jika tidak terblokir FK lain):');
  for (const table of JOURNAL_AFTER_ORDER) {
    try {
      await sequelize.query(`DELETE FROM "${table}"`);
      console.log(`  ✓ ${table}`);
    } catch (err) {
      if (err.message && err.message.includes('does not exist')) {
        console.log(`  - ${table} (skip)`);
      } else {
        console.warn(`  ⚠ ${table}: ${err.message}`);
      }
    }
  }

  console.log('\nSelesai. Database bersih dari invoice, order, dan relasi utama di atas.');
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
