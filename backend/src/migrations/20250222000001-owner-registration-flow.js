'use strict';

/** owner_profiles: kolom bukti bayar pendaftaran + MOU hasil generate sistem */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'owner_profiles';
    await queryInterface.addColumn(table, 'registration_payment_proof_url', { type: Sequelize.STRING(500), allowNull: true });
    await queryInterface.addColumn(table, 'registration_payment_verified_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn(table, 'registration_payment_verified_by', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn(table, 'mou_generated_url', { type: Sequelize.STRING(500), allowNull: true });
  },

  async down(queryInterface) {
    const table = 'owner_profiles';
    await queryInterface.removeColumn(table, 'registration_payment_proof_url');
    await queryInterface.removeColumn(table, 'registration_payment_verified_at');
    await queryInterface.removeColumn(table, 'registration_payment_verified_by');
    await queryInterface.removeColumn(table, 'mou_generated_url');
  }
};
