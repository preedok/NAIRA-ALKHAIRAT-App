'use strict';

/**
 * Backfill data lama agar export invoice (PDF/Excel) bisa tampil lengkap:
 * - unit_price_currency default ke IDR jika null/kosong
 * - subtotal fallback dari quantity * unit_price jika null
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE order_items
      SET unit_price_currency = 'IDR'
      WHERE unit_price_currency IS NULL OR trim(unit_price_currency) = '';
    `);

    await queryInterface.sequelize.query(`
      UPDATE order_items
      SET subtotal = COALESCE(quantity, 0) * COALESCE(unit_price, 0)
      WHERE subtotal IS NULL;
    `);
  },

  async down() {
    // no-op: backfill data tidak dibalik agar histori harga tetap konsisten
  }
};
