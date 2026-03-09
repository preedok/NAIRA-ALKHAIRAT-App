'use strict';

/** Tambah hotel_document_url di hotel_progress untuk file info hotel yang digenerate otomatis (setelah penetapan room + selesai makan). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'hotel_progress';
    try {
      const desc = await queryInterface.describeTable(table);
      if (!desc.hotel_document_url) {
        await queryInterface.addColumn(table, 'hotel_document_url', {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: 'Path file PDF info hotel (auto-generate saat room number + meal selesai)'
        });
      }
    } catch (e) {
      // table might not exist in some envs
    }
  },
  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('hotel_progress', 'hotel_document_url');
    } catch (e) {}
  }
};
