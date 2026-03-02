'use strict';

/**
 * Hapus SEMUA data order & invoice serta data yang berhubungan.
 * TETAP: products, users, branches, wilayah, provinsi, owner_profiles,
 * product_prices, business_rules, dan data master lainnya.
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
  'refunds',                // invoice_id, order_id
  'invoice_files',          // invoice_id, order_id
  'owner_balance_transactions', // reference_type order/invoice
  'visa_progress',          // order_item_id
  'ticket_progress',        // order_item_id
  'hotel_progress',         // order_item_id
  'bus_progress',           // order_item_id
  'order_items',            // order_id
  'invoices',               // order_id
  'orders',
  'notifications'           // data JSON sering berisi order_id/invoice_id
];

async function run() {
  const dialect = sequelize.getDialect();
  if (dialect !== 'postgres') {
    console.error('Script ini hanya untuk PostgreSQL.');
    process.exit(1);
  }

  console.log('Menghapus data order, invoice, dan data terkait...');
  console.log('(Tetap: products, users, branches, product_prices, owner_profiles, data master)\n');

  for (const table of TABLES_IN_ORDER) {
    try {
      const [r] = await sequelize.query(`DELETE FROM "${table}"`);
      console.log(`  ✓ ${table}`);
    } catch (err) {
      console.error(`  ✗ ${table}:`, err.message);
    }
  }

  console.log('\nSelesai. Data order & invoice sudah dihapus.');
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
