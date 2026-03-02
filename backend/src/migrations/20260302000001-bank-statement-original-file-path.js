'use strict';

/**
 * Simpan path file asli rekening koran yang diunggah (PDF/Excel) untuk referensi dan audit.
 * Pencocokan rekon tetap memakai data ter-parse; file asli dipakai untuk verifikasi manual atau ML nanti.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'bank_statement_uploads',
      'original_file_path',
      { type: Sequelize.STRING(500), allowNull: true, comment: 'Path relatif file asli (dari upload root)' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bank_statement_uploads', 'original_file_path');
  }
};
