'use strict';

/** Tambah kolom keterangan workflow pembatalan invoice (jadikan saldo / refund / alihkan ke invoice lain). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'invoices',
      'cancellation_handling_note',
      { type: Sequelize.TEXT, allowNull: true, comment: 'Keterangan saat invoice dibatalkan: dipindah ke saldo, refund, atau alihkan ke invoice lain' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'cancellation_handling_note');
  }
};
