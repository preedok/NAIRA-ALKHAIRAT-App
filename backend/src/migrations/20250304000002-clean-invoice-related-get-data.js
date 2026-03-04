'use strict';

/**
 * Hapus data yang masih tampil di GET dan berhubungan dengan invoice (setelah invoice dihapus).
 * - refunds source=cancel (refund dari pembatalan invoice)
 * - owner_balance_transactions reference_type='invoice'
 * - notifications yang menyimpan invoice_id di data (JSONB)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const dialect = q.getDialect();

    if (dialect !== 'postgres') {
      throw new Error('Migration ini hanya untuk PostgreSQL');
    }

    await q.query("DELETE FROM refunds WHERE source = 'cancel'");
    await q.query("DELETE FROM owner_balance_transactions WHERE reference_type = 'invoice'");
    await q.query(`DELETE FROM notifications WHERE (data->>'invoice_id') IS NOT NULL AND (data->>'invoice_id') != ''`);
  },

  async down(queryInterface, Sequelize) {
    return;
  }
};
