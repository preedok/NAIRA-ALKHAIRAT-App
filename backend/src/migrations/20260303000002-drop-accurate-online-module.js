'use strict';

/**
 * Hapus modul Accurate Online (penjualan, pembelian, persediaan, perpajakan, kas & bank, aset tetap).
 * Drop semua tabel accurate_* dalam urutan child dulu.
 */
module.exports = {
  async up(queryInterface) {
    const tables = [
      'accurate_depreciation_schedule',
      'accurate_fixed_assets',
      'accurate_cash_transactions',
      'accurate_e_faktur',
      'accurate_tax_configs',
      'accurate_stock_mutation_lines',
      'accurate_stock_mutations',
      'accurate_inventory_balances',
      'accurate_warehouses',
      'accurate_supplier_payments',
      'accurate_purchase_invoices',
      'accurate_po_items',
      'accurate_purchase_orders',
      'accurate_sales_returns',
      'accurate_quotation_items',
      'accurate_quotations'
    ];
    for (const table of tables) {
      await queryInterface.dropTable(table).catch(() => {});
    }
  },

  async down() {
    // Tidak di-revert: gunakan migration 20260226000020 jika perlu restore.
  }
};
