'use strict';

/**
 * orders.currency_rates_override: JSONB optional.
 * Jika diisi oleh invoice koordinator di form order, kurs order ini dipakai (bukan kurs global admin).
 * Format: { "SAR_TO_IDR": number, "USD_TO_IDR": number }
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('orders');
    if (!tableInfo.currency_rates_override) {
      await queryInterface.addColumn('orders', 'currency_rates_override', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Kurs khusus order: SAR_TO_IDR, USD_TO_IDR. Kosong = pakai kurs global.'
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('orders');
    if (tableInfo.currency_rates_override) {
      await queryInterface.removeColumn('orders', 'currency_rates_override');
    }
  }
};
