'use strict';

/**
 * Add owner_mou and owner_non_mou to enum_users_role.
 * Migrate existing users with role 'owner' to 'owner_mou'.
 */
const ENUM_TYPE = 'enum_users_role';

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    const newValues = ['owner_mou', 'owner_non_mou'];
    for (const val of newValues) {
      try {
        await q.query(`ALTER TYPE "${ENUM_TYPE}" ADD VALUE '${val}'`);
      } catch (e) {
        if (!String(e.message || '').includes('already exists')) throw e;
      }
    }
    await q.query(`UPDATE users SET role = 'owner_mou', updated_at = NOW() WHERE role = 'owner'`);
  },

  async down() {
    // PostgreSQL cannot remove enum values; leave owner_mou/owner_non_mou in enum.
    // Optionally: UPDATE users SET role = 'owner' WHERE role IN ('owner_mou','owner_non_mou');
  }
};
