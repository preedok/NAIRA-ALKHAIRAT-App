'use strict';

/** Add payment_currency & amount_original to payment_proofs for Saudi (SAR/USD) payments */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('payment_proofs');
    if (!tableInfo.payment_currency) {
      await queryInterface.addColumn('payment_proofs', 'payment_currency', {
        type: Sequelize.STRING(5),
        allowNull: true,
        defaultValue: 'IDR'
      });
    }
    if (!tableInfo.amount_original) {
      await queryInterface.addColumn('payment_proofs', 'amount_original', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('payment_proofs');
    if (tableInfo.payment_currency) await queryInterface.removeColumn('payment_proofs', 'payment_currency');
    if (tableInfo.amount_original) await queryInterface.removeColumn('payment_proofs', 'amount_original');
  }
};
