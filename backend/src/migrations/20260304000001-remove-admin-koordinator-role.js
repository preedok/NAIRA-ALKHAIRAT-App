'use strict';

/**
 * Hapus role admin_koordinator: migrasi user yang masih pakai role itu ke invoice_koordinator.
 * Visa/tiket/invoice koordinator dipakai langsung tanpa admin_koordinator.
 */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'admin_koordinator'`
    );
    if (!rows || rows.length === 0) return;

    await queryInterface.sequelize.query(
      `UPDATE users SET role = 'invoice_koordinator', updated_at = NOW() WHERE role = 'admin_koordinator'`
    );
  },

  async down() {
    // Tidak revert: user yang sudah diubah ke invoice_koordinator tetap.
  }
};
