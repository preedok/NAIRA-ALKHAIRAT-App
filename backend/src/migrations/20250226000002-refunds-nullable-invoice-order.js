'use strict';

/**
 * Pastikan refunds.invoice_id dan order_id nullable (untuk refund dari saldo).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE refunds ALTER COLUMN invoice_id DROP NOT NULL');
    await queryInterface.sequelize.query('ALTER TABLE refunds ALTER COLUMN order_id DROP NOT NULL');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE refunds ALTER COLUMN invoice_id SET NOT NULL');
    await queryInterface.sequelize.query('ALTER TABLE refunds ALTER COLUMN order_id SET NOT NULL');
  }
};
