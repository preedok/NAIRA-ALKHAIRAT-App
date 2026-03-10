'use strict';

/**
 * Sync otomatis: isi provinsi.wilayah_id dan branch.provinsi_id yang masih null.
 * - Provinsi wilayah_id null → diisi dari mapping nama/kode ke wilayah.
 * - Branch provinsi_id null → diisi dari Branch.code = Kabupaten.kode atau Branch.city ≈ Kabupaten.nama.
 * Idempotent: aman dijalankan setiap migrate. Sumber kebenaran: utils/locationMaster.runFullSync().
 */
module.exports = {
  async up(queryInterface) {
    const path = require('path');
    const { runFullSync } = require(path.join(__dirname, '../utils/locationMaster'));
    try {
      await runFullSync();
    } catch (err) {
      console.warn('Migration sync-wilayah-provinsi-branch (non-fatal):', err && err.message);
    }
  },

  async down() {
    // Sync is idempotent fill of nulls; no need to revert.
  }
};
