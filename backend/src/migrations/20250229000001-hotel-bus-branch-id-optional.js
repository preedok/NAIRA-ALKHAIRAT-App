'use strict';

/**
 * Dokumentasi: role_hotel dan role_bus boleh punya branch_id NULL.
 * Backend (getHotelBranchIds / getBusBranchIds) mengatasi scope: super_admin = semua cabang,
 * admin_koordinator = wilayah, tanpa cabang/wilayah = fallback semua cabang.
 * Memastikan kolom users.branch_id tetap nullable (biasanya sudah).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        ALTER TABLE users ALTER COLUMN branch_id DROP NOT NULL;
      `);
    }
    // sqlite / mysql: branch_id umumnya sudah nullable
  },

  async down(queryInterface, Sequelize) {
    // Tidak revert: membiarkan branch_id nullable untuk role_hotel/role_bus
  }
};
