'use strict';

/** Tambah status invoice: order_updated, overpaid, overpaid_transferred, overpaid_received, refund_canceled, overpaid_refund_pending */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'postgres') return;

    const newValues = [
      'order_updated',
      'overpaid',
      'overpaid_transferred',
      'overpaid_received',
      'refund_canceled',
      'overpaid_refund_pending'
    ];

    for (const val of newValues) {
      await queryInterface.sequelize.query(
        `DO $$ BEGIN
          ALTER TYPE "enum_invoices_status" ADD VALUE '${val}';
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;`
      );
    }
  },

  async down() {
    // PostgreSQL tidak mendukung DROP VALUE dari enum. Rollback manual jika perlu.
  }
};
