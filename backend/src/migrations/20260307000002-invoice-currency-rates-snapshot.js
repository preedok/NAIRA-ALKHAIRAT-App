'use strict';

/** Snapshot kurs global saat invoice dibuat; dipakai jika sudah ada pembayaran (agar kurs tetap). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'invoices',
      'currency_rates_snapshot',
      {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Kurs global saat invoice dibuat; dipakai bila sudah ada pembayaran dan order tidak punya kurs khusus'
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'currency_rates_snapshot');
  }
};
