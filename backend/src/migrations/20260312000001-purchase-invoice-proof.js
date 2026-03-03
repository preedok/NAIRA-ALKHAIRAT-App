'use strict';

/** Tambah kolom bukti pembelian (proof_file_path) pada purchase_invoices. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'purchase_invoices',
      'proof_file_path',
      { type: Sequelize.STRING(500), allowNull: true }
    );
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('purchase_invoices', 'proof_file_path');
  }
};
