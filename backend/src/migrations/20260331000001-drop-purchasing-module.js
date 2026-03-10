'use strict';

/**
 * Hapus modul Pembelian (Purchasing) untuk role accounting.
 * Drop tabel: purchase_payments, purchase_invoice_lines, purchase_invoices, purchase_order_lines, purchase_orders, accounting_suppliers.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('purchase_payments');
    await queryInterface.dropTable('purchase_invoice_lines');
    await queryInterface.dropTable('purchase_invoices');
    await queryInterface.dropTable('purchase_order_lines');
    await queryInterface.dropTable('purchase_orders');
    await queryInterface.dropTable('accounting_suppliers');
  },

  async down() {
    // Recreate tables would require full schema from 20260310000001-purchasing-module + 20260311000001 + 20260312000001 + 20260313000001; not implemented.
    throw new Error('down() not supported for drop-purchasing-module');
  }
};
