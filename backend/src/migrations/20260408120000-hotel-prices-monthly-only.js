'use strict';

/**
 * Harga hotel: sumber kebenaran = hotel_monthly_prices (SAR per malam per bulan kalender).
 * Hapus baris product_prices untuk produk hotel (harga kamar/makan legacy).
 * Bersihkan meta.meal_price / meal_price_type di products hotel (makan dari grid __meal__).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM product_prices
      WHERE product_id IN (SELECT id FROM products WHERE type = 'hotel')
    `);
    await queryInterface.sequelize.query(`
      UPDATE products
      SET meta = COALESCE(meta, '{}'::jsonb)
        - 'meal_price'
        - 'meal_price_type'
      WHERE type = 'hotel'
    `);
  },

  async down() {
    // Tidak mengembalikan data terhapus.
  }
};
