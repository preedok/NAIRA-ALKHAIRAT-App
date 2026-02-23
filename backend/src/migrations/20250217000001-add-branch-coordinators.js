'use strict';

/**
 * Menambah kolom Koordinator Provinsi dan Koordinator Wilayah ke tabel branches.
 * Struktur: Bintang Global Group - Nama Cabang, Wilayah, Manager, Kontak, Account, Koordinator Provinsi, Koordinator Wilayah.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = [
      { name: 'koordinator_provinsi', type: Sequelize.STRING(255) },
      { name: 'koordinator_provinsi_phone', type: Sequelize.STRING(50) },
      { name: 'koordinator_provinsi_email', type: Sequelize.STRING(255) },
      { name: 'koordinator_wilayah', type: Sequelize.STRING(255) },
      { name: 'koordinator_wilayah_phone', type: Sequelize.STRING(50) },
      { name: 'koordinator_wilayah_email', type: Sequelize.STRING(255) }
    ];

    for (const col of cols) {
      const [exists] = await queryInterface.sequelize.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = '${col.name}';
      `);
      if (!exists || exists.length === 0) {
        await queryInterface.addColumn('branches', col.name, {
          type: col.type,
          allowNull: true
        });
      }
    }
  },

  async down(queryInterface) {
    const cols = [
      'koordinator_provinsi',
      'koordinator_provinsi_phone',
      'koordinator_provinsi_email',
      'koordinator_wilayah',
      'koordinator_wilayah_phone',
      'koordinator_wilayah_email'
    ];
    for (const col of cols) {
      await queryInterface.removeColumn('branches', col).catch(() => {});
    }
  }
};
