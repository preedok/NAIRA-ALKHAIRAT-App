'use strict';

/** Tambah proof_file_url di refunds untuk bukti bayar refund (upload oleh accounting). Setelah proses refund selesai, bukti dikirim ke email pemesan. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('refunds');
    if (!tableInfo.proof_file_url) {
      await queryInterface.addColumn('refunds', 'proof_file_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'URL path bukti transfer refund (upload oleh role accounting)'
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('refunds');
    if (tableInfo.proof_file_url) {
      await queryInterface.removeColumn('refunds', 'proof_file_url');
    }
  }
};
