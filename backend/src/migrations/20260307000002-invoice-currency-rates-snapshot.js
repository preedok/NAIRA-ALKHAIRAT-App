'use strict';

/** Snapshot kurs global saat invoice dibuat; dipakai jika sudah ada pembayaran (agar kurs tetap). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency_rates_snapshot JSONB NULL;'
      );
    } else {
      await queryInterface.addColumn(
        'invoices',
        'currency_rates_snapshot',
        {
          type: Sequelize.JSONB,
          allowNull: true,
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'currency_rates_snapshot');
  }
};
