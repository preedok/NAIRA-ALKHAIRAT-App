'use strict';

/**
 * Tambah account_holder_name di refunds untuk data rekening lengkap (proses refund oleh accounting).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('refunds');
    if (!tableInfo.account_holder_name) {
      await queryInterface.addColumn('refunds', 'account_holder_name', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('refunds');
    if (tableInfo.account_holder_name) {
      await queryInterface.removeColumn('refunds', 'account_holder_name');
    }
  }
};
