'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE invoices i
      SET status = 'refund_canceled',
          updated_at = NOW()
      WHERE LOWER(COALESCE(i.status, '')) = 'cancelled_refund'
        AND EXISTS (
          SELECT 1
          FROM refunds r
          WHERE r.invoice_id = i.id
            AND COALESCE(r.source, '') = 'cancel'
            AND LOWER(COALESCE(r.status, '')) = 'rejected'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM refunds r2
          WHERE r2.invoice_id = i.id
            AND COALESCE(r2.source, '') = 'cancel'
            AND LOWER(COALESCE(r2.status, '')) IN ('requested', 'approved', 'refunded')
        );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE invoices
      SET status = 'cancelled_refund',
          updated_at = NOW()
      WHERE LOWER(COALESCE(status, '')) = 'refund_canceled';
    `);
  }
};
