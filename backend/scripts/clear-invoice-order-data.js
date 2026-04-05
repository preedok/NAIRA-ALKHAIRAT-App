/**
 * @deprecated Gunakan scripts/clear-invoices-database-clean.js (CONFIRM=YES) atau npm run clear:orders-invoices.
 * Skrip ini tidak menghapus refund/pemindahan dana/notifikasi secara lengkap.
 */
require('dotenv').config();
const path = require('path');
const config = require(path.join(__dirname, '../src/config/database.js'));

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];
const { Sequelize } = require('sequelize');

let sequelize;
if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], { dialect: 'postgres', logging: false });
} else {
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port || 5432,
    dialect: 'postgres',
    logging: false
  });
}

async function run() {
  const q = sequelize.getQueryInterface();
  try {
    console.log('Menghapus data invoice & order...');
    await sequelize.query('DELETE FROM payment_reallocations');
    await sequelize.query('DELETE FROM payment_proofs');
    await sequelize.query('DELETE FROM invoice_files');
    await sequelize.query('DELETE FROM invoice_status_histories');
    await sequelize.query('UPDATE refunds SET invoice_id = NULL, order_id = NULL WHERE invoice_id IS NOT NULL OR order_id IS NOT NULL');
    await sequelize.query('DELETE FROM order_revisions');
    await sequelize.query('DELETE FROM hotel_progress');
    await sequelize.query('DELETE FROM visa_progress');
    await sequelize.query('DELETE FROM ticket_progress');
    await sequelize.query('DELETE FROM bus_progress');
    await sequelize.query('DELETE FROM order_items');
    await sequelize.query('DELETE FROM invoices');
    await sequelize.query('DELETE FROM orders');
    console.log('Selesai. Data invoice dan order sudah dikosongkan.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
