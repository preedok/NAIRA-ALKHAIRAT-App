'use strict';

/**
 * Pastikan kolom proof_file_name, proof_file_content_type, proof_file_data ada di payment_proofs.
 * Idempotent: hanya menambah jika kolom belum ada (untuk VPS yang belum jalankan migration sebelumnya).
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'payment_proofs';
    let tableInfo;
    try {
      tableInfo = await queryInterface.describeTable(table);
    } catch (e) {
      return;
    }
    if (!tableInfo.proof_file_name) {
      await queryInterface.addColumn(table, 'proof_file_name', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }
    if (!tableInfo.proof_file_content_type) {
      await queryInterface.addColumn(table, 'proof_file_content_type', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }
    if (!tableInfo.proof_file_data) {
      await queryInterface.addColumn(table, 'proof_file_data', {
        type: Sequelize.BLOB,
        allowNull: true
      });
    }
  },

  async down() {}
};
