'use strict';

/**
 * order_items.currency_rates_override: JSONB optional.
 * Jika order sudah ada pembayaran DP dan item ini ditambah setelahnya, pakai kurs terbaru (disimpan di sini).
 * Null = pakai kurs order (orders.currency_rates_override).
 * Format: { "SAR_TO_IDR": number, "USD_TO_IDR": number }
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('order_items');
    if (!tableInfo.currency_rates_override) {
      await queryInterface.addColumn('order_items', 'currency_rates_override', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Kurs untuk item ini (jika ditambah setelah DP). Kosong = pakai kurs order.'
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('order_items');
    if (tableInfo.currency_rates_override) {
      await queryInterface.removeColumn('order_items', 'currency_rates_override');
    }
  }
};
