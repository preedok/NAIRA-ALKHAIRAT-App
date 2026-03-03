'use strict';

/**
 * Tambah product_id ke purchase_orders dan purchase_invoices agar pembelian bisa per product (hotel, visa, ticket, bus, handling).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'purchase_orders',
      'product_id',
      { type: Sequelize.UUID, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }
    );
    await queryInterface.addIndex('purchase_orders', ['product_id']);

    await queryInterface.addColumn(
      'purchase_invoices',
      'product_id',
      { type: Sequelize.UUID, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }
    );
    await queryInterface.addIndex('purchase_invoices', ['product_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('purchase_orders', 'purchase_orders_product_id');
    await queryInterface.removeColumn('purchase_orders', 'product_id');
    await queryInterface.removeIndex('purchase_invoices', 'purchase_invoices_product_id');
    await queryInterface.removeColumn('purchase_invoices', 'product_id');
  }
};
