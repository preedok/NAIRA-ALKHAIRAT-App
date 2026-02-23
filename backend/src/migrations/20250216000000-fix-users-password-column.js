'use strict';

/**
 * Ensure users table has column "password_hash".
 * Fixes: column User.password_hash does not exist
 * (e.g. when DB was created with camelCase column "passwordhash")
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const [tables] = await q.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users';
    `);
    if (!tables || tables.length === 0) return; // tabel users belum ada (akan dibuat oleh sync)

    const [rows] = await q.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('password_hash', 'passwordhash', 'password');
    `);
    const columns = (rows || []).map(r => r.column_name);

    if (columns.includes('password_hash')) {
      return; // already correct
    }

    if (columns.includes('passwordhash')) {
      await queryInterface.renameColumn('users', 'passwordhash', 'password_hash');
      return;
    }

    if (columns.includes('password')) {
      await queryInterface.renameColumn('users', 'password', 'password_hash');
      return;
    }

    await queryInterface.addColumn('users', 'password_hash', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'password_hash';
    `);
    if ((rows || []).length === 0) return;
    await queryInterface.renameColumn('users', 'password_hash', 'passwordhash').catch(() => {});
  }
};
