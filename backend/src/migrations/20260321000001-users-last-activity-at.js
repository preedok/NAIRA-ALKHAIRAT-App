'use strict';

/** Tambah last_activity_at di users untuk deteksi online (realtime). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [cols] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_activity_at';
    `);
    if (!cols || cols.length === 0) {
      await queryInterface.addColumn('users', 'last_activity_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'last_activity_at');
  }
};
