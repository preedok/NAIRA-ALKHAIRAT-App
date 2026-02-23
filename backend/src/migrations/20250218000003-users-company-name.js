'use strict';

/**
 * Tambah kolom company_name di users jika belum ada (untuk owner).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const [cols] = await q.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'company_name';
    `);
    if (cols && cols.length > 0) return;
    await queryInterface.addColumn('users', 'company_name', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'company_name').catch(() => {});
  }
};
