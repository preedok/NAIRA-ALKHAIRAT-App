'use strict';

/** Add verified_status to payment_proofs: pending | verified | rejected (admin cabang cek transfer) */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('payment_proofs');
    if (!tableInfo.verified_status) {
      await queryInterface.addColumn('payment_proofs', 'verified_status', {
        type: Sequelize.STRING(20),
        defaultValue: 'pending',
        allowNull: true
      });
      await queryInterface.sequelize.query(
        "UPDATE payment_proofs SET verified_status = CASE WHEN verified_by IS NOT NULL AND verified_at IS NOT NULL THEN 'verified' ELSE 'pending' END WHERE verified_status IS NULL;"
      );
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('payment_proofs');
    if (tableInfo.verified_status) {
      await queryInterface.removeColumn('payment_proofs', 'verified_status');
    }
  }
};
