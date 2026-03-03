'use strict';

/**
 * Rename roles: role_invoice_saudi → invoice_saudi, role_handling → handling.
 * Menambah nilai enum baru lalu update baris yang ada.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    const newValues = ['invoice_saudi', 'handling'];
    for (const val of newValues) {
      try {
        await q.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS '${val}'`);
      } catch (e) {
        try {
          await q.query(`ALTER TYPE user_role ADD VALUE '${val}'`);
        } catch (_) {}
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
