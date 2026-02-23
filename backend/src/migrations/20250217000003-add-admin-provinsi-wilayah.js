'use strict';

/**
 * Add admin_provinsi and admin_wilayah roles + region column for admin_provinsi
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;

    try {
      await q.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin_provinsi'`);
    } catch (e) {
      try { await q.query(`ALTER TYPE user_role ADD VALUE 'admin_provinsi'`); } catch (_) {}
    }
    try {
      await q.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin_wilayah'`);
    } catch (e) {
      try { await q.query(`ALTER TYPE user_role ADD VALUE 'admin_wilayah'`); } catch (_) {}
    }

    const [cols] = await q.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'region';
    `);
    if (!cols || cols.length === 0) {
      await queryInterface.addColumn('users', 'region', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'For admin_provinsi: province/region scope'
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'region').catch(() => {});
  }
};
