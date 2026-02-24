'use strict';

/**
 * Migrasi: update user dengan role role_invoice ke invoice_koordinator.
 * role_invoice dihapus dari aplikasi; pakai invoice_koordinator saja.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [results] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'role_invoice'`
    );
    if (!results || results.length === 0) return;

    await queryInterface.sequelize.query(
      `UPDATE users SET role = 'invoice_koordinator', updated_at = NOW() WHERE role = 'role_invoice'`
    );
  },

  async down(queryInterface, Sequelize) {
    // Tidak revert otomatis
  }
};
