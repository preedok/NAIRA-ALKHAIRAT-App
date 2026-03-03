'use strict';

/**
 * Tambah bank_id di payment_proofs (FK ke banks) untuk pembayaran transfer — pilih bank dari master.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'payment_proofs',
      'bank_id',
      { type: Sequelize.UUID, allowNull: true, references: { model: 'banks', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }
    );
    await queryInterface.addIndex('payment_proofs', ['bank_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('payment_proofs', 'bank_id');
  }
};
