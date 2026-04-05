'use strict';

/** Rekening pengirim (sisi BGG) + metadata saat admin menyelesaikan transfer refund / penarikan saldo. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('refunds');
    if (!tableInfo.payout_sender_bank_name) {
      await queryInterface.addColumn('refunds', 'payout_sender_bank_name', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }
    if (!tableInfo.payout_sender_account_number) {
      await queryInterface.addColumn('refunds', 'payout_sender_account_number', {
        type: Sequelize.STRING(50),
        allowNull: true
      });
    }
    if (!tableInfo.payout_sender_account_holder) {
      await queryInterface.addColumn('refunds', 'payout_sender_account_holder', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('refunds');
    if (tableInfo.payout_sender_account_holder) {
      await queryInterface.removeColumn('refunds', 'payout_sender_account_holder');
    }
    if (tableInfo.payout_sender_account_number) {
      await queryInterface.removeColumn('refunds', 'payout_sender_account_number');
    }
    if (tableInfo.payout_sender_bank_name) {
      await queryInterface.removeColumn('refunds', 'payout_sender_bank_name');
    }
  }
};
