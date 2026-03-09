'use strict';

/**
 * View master lokasi: Wilayah → Provinsi → Kabupaten (Kota) terhubung.
 * Digunakan modul untuk lookup satu tempat: dari kode kota dapat provinsi & wilayah, atau sebaliknya.
 * CREATE VIEW v_master_lokasi (wilayah_id, wilayah_name, provinsi_id, provinsi_kode, provinsi_name, kabupaten_id, kabupaten_kode, kabupaten_nama)
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE VIEW v_master_lokasi AS
      SELECT
        w.id AS wilayah_id,
        w.name AS wilayah_name,
        p.id AS provinsi_id,
        p.kode AS provinsi_kode,
        p.name AS provinsi_name,
        k.id AS kabupaten_id,
        k.kode AS kabupaten_kode,
        k.nama AS kabupaten_nama
      FROM kabupaten k
      INNER JOIN provinsi p ON p.id = k.provinsi_id
      LEFT JOIN wilayah w ON w.id = p.wilayah_id
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP VIEW IF EXISTS v_master_lokasi');
  }
};
