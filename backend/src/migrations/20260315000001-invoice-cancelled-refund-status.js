'use strict';

/** Tambah status invoice cancelled_refund dan kolom cancelled_refund_amount (jumlah yang akan/direfund saat invoice dibatalkan dengan pembayaran). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        `DO $$ BEGIN
          ALTER TYPE "enum_invoices_status" ADD VALUE 'cancelled_refund';
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;`
      );
    }
    await queryInterface.addColumn(
      'invoices',
      'cancelled_refund_amount',
      { type: Sequelize.DECIMAL(18, 2), allowNull: true, comment: 'Jumlah pembayaran yang akan/direfund saat invoice dibatalkan (status cancelled_refund)' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'cancelled_refund_amount');
    // PostgreSQL tidak mendukung DROP VALUE dari enum. Rollback manual jika perlu.
  }
};
