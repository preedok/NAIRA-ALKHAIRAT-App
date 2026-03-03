'use strict';

/**
 * Rename roles: role_invoice_saudi → invoice_saudi, role_handling → handling.
 * Nama tipe enum di PostgreSQL dari Sequelize: enum_users_role (bukan user_role).
 */
const ENUM_TYPE = 'enum_users_role';

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const newValues = ['invoice_saudi', 'handling'];
    for (const val of newValues) {
      try {
        await q.query(`ALTER TYPE "${ENUM_TYPE}" ADD VALUE IF NOT EXISTS '${val}'`);
      } catch (e) {
        try {
          await q.query(`ALTER TYPE "${ENUM_TYPE}" ADD VALUE '${val}'`);
        } catch (err) {
          if (!String(err.message || '').includes('already exists')) throw err;
        }
      }
    }
    await q.query(`UPDATE users SET role = 'invoice_saudi', updated_at = NOW() WHERE role = 'role_invoice_saudi'`);
    await q.query(`UPDATE users SET role = 'handling', updated_at = NOW() WHERE role = 'role_handling'`);
  },

  async down(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    await q.query(`UPDATE users SET role = 'role_invoice_saudi', updated_at = NOW() WHERE role = 'invoice_saudi'`);
    await q.query(`UPDATE users SET role = 'role_handling', updated_at = NOW() WHERE role = 'handling'`);
  }
};
