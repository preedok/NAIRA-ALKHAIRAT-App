'use strict';

/**
 * Harga per item disimpan dalam mata uang yang dipilih (unit_price_currency).
 * unit_price = nilai asli; konversi ke IDR hanya untuk total order/invoice.
 * Jika kurs berubah, hanya nilai konversi yang berubah, harga asli tetap.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('order_items');
    if (!tableInfo.unit_price_currency) {
      await queryInterface.addColumn(
        'order_items',
        'unit_price_currency',
        {
          type: Sequelize.STRING(3),
          allowNull: false,
          defaultValue: 'IDR',
          comment: 'Mata uang dari unit_price (IDR, SAR, USD). Harga asli tidak berubah saat kurs berubah.'
        }
      );
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('order_items');
    if (tableInfo.unit_price_currency) {
      await queryInterface.removeColumn('order_items', 'unit_price_currency');
    }
  }
};
