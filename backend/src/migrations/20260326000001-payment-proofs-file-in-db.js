'use strict';

/**
 * Simpan file bukti bayar di database (proof_file_name, proof_file_content_type, proof_file_data)
 * agar file tetap bisa ditampilkan/diunduh meski file di disk hilang.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'payment_proofs';
    const tableInfo = await queryInterface.describeTable(table);
    if (!tableInfo.proof_file_name) {
      await queryInterface.addColumn(table, 'proof_file_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Nama file asli saat upload'
      });
    }
    if (!tableInfo.proof_file_content_type) {
      await queryInterface.addColumn(table, 'proof_file_content_type', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'MIME type file (image/jpeg, application/pdf, dll)'
      });
    }
    if (!tableInfo.proof_file_data) {
      await queryInterface.addColumn(table, 'proof_file_data', {
        type: Sequelize.BLOB,
        allowNull: true,
        comment: 'Isi file bukti bayar (untuk tampil/unduh dari DB jika ada)'
      });
    }
  },

  async down(queryInterface) {
    const table = 'payment_proofs';
    const tableInfo = await queryInterface.describeTable(table);
    if (tableInfo.proof_file_name) await queryInterface.removeColumn(table, 'proof_file_name');
    if (tableInfo.proof_file_content_type) await queryInterface.removeColumn(table, 'proof_file_content_type');
    if (tableInfo.proof_file_data) await queryInterface.removeColumn(table, 'proof_file_data');
  }
};
