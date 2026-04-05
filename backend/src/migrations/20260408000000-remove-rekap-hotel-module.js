'use strict';

/**
 * Hapus modul Rekap Hotel dari DB:
 * - DROP TABLE rekap_hotel (jika ada)
 * - Hapus user ber-role role_rekap_hotel
 * Migrasi pembuatan tabel/enum modul ini telah dihapus dari repo; hanya penghapusan yang tersisa.
 * Nilai enum PostgreSQL 'role_rekap_hotel' bisa tetap ada (penghapusan enum tidak didukung aman).
 */
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    try {
      await q.query('DROP TABLE IF EXISTS "rekap_hotel" CASCADE');
    } catch (e) {
      if (!String(e.message || '').includes('does not exist')) throw e;
    }
    try {
      await q.query(`DELETE FROM "users" WHERE role = 'role_rekap_hotel'`);
    } catch (e) {
      if (!String(e.message || '').includes('does not exist') && !String(e.message || '').includes('invalid input value for enum')) throw e;
    }
  },

  async down() {
    // Modul dihapus permanen; tidak di-restore.
  }
};
