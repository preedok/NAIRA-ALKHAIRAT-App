'use strict';

/** Keterangan teks untuk invoice (disalin ke invoices.notes saat invoice dibuat / disinkronkan). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'orders',
      'invoice_keterangan',
      {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Keterangan invoice (form); disalin ke invoice.notes saat diterbitkan'
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'invoice_keterangan');
  }
};
