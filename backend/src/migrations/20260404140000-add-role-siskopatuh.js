'use strict';

/** Role divisi Siskopatuh (workflow mirip handling). */
const ENUM_TYPE = 'enum_users_role';

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    try {
      await q.query(`ALTER TYPE "${ENUM_TYPE}" ADD VALUE 'role_siskopatuh'`);
    } catch (e) {
      if (!String(e.message || '').includes('already exists')) throw e;
    }
  },

  async down() {
    // PostgreSQL tidak bisa menghapus nilai enum dengan aman.
  }
};
