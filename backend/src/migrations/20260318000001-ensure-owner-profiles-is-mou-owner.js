'use strict';

/**
 * Pastikan kolom is_mou_owner ada di owner_profiles (idempotent untuk production).
 * Menangani kasus: column "is_mou_owner" of relation "owner_profiles" does not exist.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE owner_profiles
      ADD COLUMN IF NOT EXISTS is_mou_owner BOOLEAN NOT NULL DEFAULT false
    `);
    await queryInterface.sequelize.query(`
      UPDATE owner_profiles SET is_mou_owner = true
    `);
  },

  async down() {
    // optional: remove column only if you need rollback
  }
};
