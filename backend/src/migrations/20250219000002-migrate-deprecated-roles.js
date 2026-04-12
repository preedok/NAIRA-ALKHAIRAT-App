'use strict';

/**
 * Migrasi: update user dengan role deprecated ke role pengganti.
 * - admin_cabang → admin_koordinator (scope nanti pakai wilayah_id)
 * - role_visa → visa_koordinator
 * - role_ticket → tiket_koordinator
 * Setelah migrasi, aplikasi tidak lagi menggunakan role lama.
 */
const ENUM_TYPE = 'enum_users_role';

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface.sequelize;
    for (const val of ['admin_koordinator', 'visa_koordinator', 'tiket_koordinator']) {
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

    const [results] = await q.query(
      `SELECT id, role FROM users WHERE role IN ('admin_cabang', 'role_visa', 'role_ticket')`
    );
    if (!results || results.length === 0) return;

    for (const row of results) {
      let newRole = null;
      if (row.role === 'admin_cabang') newRole = 'admin_koordinator';
      if (row.role === 'role_visa') newRole = 'visa_koordinator';
      if (row.role === 'role_ticket') newRole = 'tiket_koordinator';
      if (newRole) {
        await q.query(
          `UPDATE users SET role = :newRole, updated_at = NOW() WHERE id = :id`,
          { replacements: { newRole, id: row.id } }
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Tidak revert otomatis (revert manual jika perlu)
  }
};
