'use strict';

/**
 * Hapus semua data invoice dan data yang mengacu ke invoice.
 * Urutan: child dulu (payment_reallocations, payment_proofs, invoice_files, invoice_status_histories),
 * lalu unlink refunds & order_revisions, terakhir invoices.
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
    await q.query('UPDATE order_revisions SET invoice_id = NULL WHERE invoice_id IS NOT NULL');
    await q.query('DELETE FROM invoices');
  },

  async down(queryInterface, Sequelize) {
    return;
  }
};
