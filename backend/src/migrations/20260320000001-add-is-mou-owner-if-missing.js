'use strict';

/**
 * Tambah kolom is_mou_owner jika belum ada (production fix).
 * Idempotent: cek dulu, tambah hanya jika belum ada.
 */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'owner_profiles' AND column_name = 'is_mou_owner'
      LIMIT 1
    `);
    if (rows && rows.length > 0) {
      return;
    }
    await queryInterface.sequelize.query(`
      ALTER TABLE owner_profiles
      ADD COLUMN is_mou_owner BOOLEAN NOT NULL DEFAULT false
    `);
    await queryInterface.sequelize.query(`
      UPDATE owner_profiles SET is_mou_owner = true
    `);
  },

  async down() {}
};
