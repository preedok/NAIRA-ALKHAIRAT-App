/**
 * Pastikan kolom owner_name_manual / owner_phone_manual / owner_input_mode ada
 * di tabel orders & invoices (VPS yang gagal migrate penuh).
 * Idempoten. Jalankan dari folder backend: node scripts/ensure-invoice-order-owner-manual-columns.js
 */
require('dotenv').config();
const path = require('path');
const { Sequelize } = require('sequelize');
const sequelize = require(path.join(__dirname, '../src/config/sequelize'));
const migration = require(path.join(__dirname, '../src/migrations/20260409120000-ensure-invoice-order-owner-manual-columns.js'));

async function main() {
  const qi = sequelize.getQueryInterface();
  await migration.up(qi, Sequelize);
  console.log('ensure-invoice-order-owner-manual-columns: selesai.');
  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await sequelize.close();
  } catch (_) { /* */ }
  process.exit(1);
});
