'use strict';

/**
 * Pastikan kolom is_mou_owner ada di owner_profiles (untuk production yang belum jalankan 20260307000001).
 * Aman dijalankan berulang: ADD COLUMN IF NOT EXISTS, lalu set owner lama = MOU.
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
    // Tidak revert
  }
};
