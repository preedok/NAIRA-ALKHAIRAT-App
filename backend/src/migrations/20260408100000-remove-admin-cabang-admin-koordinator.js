'use strict';

/**
 * Hapus pemakaian role admin_cabang dan admin_koordinator (legacy).
 * Semua user dengan role tersebut diubah ke invoice_koordinator (sama arah migrasi admin_koordinator sebelumnya).
 * Nilai enum PostgreSQL untuk role lama dapat tetap ada; aplikasi tidak lagi mendefinisikan admin_cabang di ROLES.
 */
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query(`
      UPDATE "users"
      SET role = 'invoice_koordinator', updated_at = NOW()
      WHERE role IN ('admin_cabang', 'admin_koordinator')
    `);
  },

  async down() {
    // Tidak di-revert: role legacy tidak dipulihkan.
  }
};
