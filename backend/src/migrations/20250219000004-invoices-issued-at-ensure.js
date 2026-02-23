'use strict';

/** Pastikan kolom issued_at ada di invoices (untuk Laporan Keuangan). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('invoices');
    if (!tableInfo.issued_at) {
      await queryInterface.addColumn('invoices', 'issued_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('invoices');
    if (tableInfo.issued_at) {
      await queryInterface.removeColumn('invoices', 'issued_at');
    }
  }
};
