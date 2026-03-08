'use strict';

/**
 * Kosongkan lagi semua data order dan invoice (jika masih ada sisa).
 * Urutan: child dulu, lalu invoices, terakhir orders.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const dialect = q.getDialect();

    if (dialect !== 'postgres') {
      throw new Error('Migration ini hanya untuk PostgreSQL');
    }

    await q.query('DELETE FROM payment_reallocations');
    await q.query('DELETE FROM payment_proofs');
    await q.query('DELETE FROM invoice_files');
    await q.query('DELETE FROM invoice_status_histories');
    await q.query('UPDATE refunds SET invoice_id = NULL WHERE invoice_id IS NOT NULL');
    await q.query('UPDATE refunds SET order_id = NULL WHERE order_id IS NOT NULL');
    await q.query('DELETE FROM order_revisions');
    await q.query('DELETE FROM hotel_progress');
    await q.query('DELETE FROM visa_progress');
    await q.query('DELETE FROM ticket_progress');
    await q.query('DELETE FROM bus_progress');
    await q.query('DELETE FROM order_items');
    await q.query('DELETE FROM invoices');
    await q.query('DELETE FROM orders');
  },

  async down() {
    return;
  }
};
