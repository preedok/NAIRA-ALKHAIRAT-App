'use strict';

/**
 * Dokumentasi di DB: harga per baris order_items dipakai laporan export (PDF/Excel).
 * Tidak menambah kolom baru — unit_price & subtotal sudah ada sejak tabel order_items.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN order_items.unit_price IS 'Harga satuan (sesuai unit_price_currency); dipakai export daftar invoice sebagai kolom Harga per item.';
      COMMENT ON COLUMN order_items.subtotal IS 'Total baris order item; dipakai export daftar invoice sebagai kolom Subtotal.';
      COMMENT ON COLUMN order_items.unit_price_currency IS 'Mata uang unit_price; dasar konversi IDR/SAR/USD di laporan.';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN order_items.unit_price IS NULL;
      COMMENT ON COLUMN order_items.subtotal IS NULL;
      COMMENT ON COLUMN order_items.unit_price_currency IS NULL;
    `);
  }
};
