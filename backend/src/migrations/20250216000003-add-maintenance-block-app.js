'use strict';

/**
 * Tambah kolom block_app ke maintenance_notices.
 * Jika true dan notice aktif, semua role kecuali super_admin hanya melihat halaman maintenance.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'maintenance_notices';
    const [cols] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'block_app';
    `);
    if (cols && cols.length > 0) return;
    await queryInterface.addColumn(table, 'block_app', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('maintenance_notices', 'block_app');
  }
};
