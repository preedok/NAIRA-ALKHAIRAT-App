'use strict';

/**
 * Accurate Online module: Penjualan, Pembelian, Persediaan, Perpajakan, Kas & Bank, Aset Tetap.
 * Akuntansi & jurnal memakai existing journal_entries, chart_of_accounts, accounting_periods.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ========== PENJUALAN ==========
    await queryInterface.createTable('accurate_quotations', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      quotation_number: { type: Sequelize.STRING(50), allowNull: false },
      customer_id: { type: Sequelize.UUID, references: { model: 'accounting_customers', key: 'id' }, onDelete: 'SET NULL' },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' }, onDelete: 'SET NULL' },
      quotation_date: { type: Sequelize.DATEONLY, allowNull: false },
      valid_until: { type: Sequelize.DATEONLY },
      status: { type: Sequelize.STRING(30), defaultValue: 'draft' },
      subtotal: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      discount_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      tax_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      total_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      notes: { type: Sequelize.TEXT },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('accurate_quotations', ['quotation_number'], { unique: true });

    await queryInterface.createTable('accurate_quotation_items', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      quotation_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accurate_quotations', key: 'id' }, onDelete: 'CASCADE' },
      product_id: { type: Sequelize.UUID, references: { model: 'products', key: 'id' }, onDelete: 'SET NULL' },
      description: { type: Sequelize.STRING(500) },
      quantity: { type: Sequelize.DECIMAL(18, 4), defaultValue: 1 },
      unit_price: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      discount_percent: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
      amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('accurate_sales_returns', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      return_number: { type: Sequelize.STRING(50), allowNull: false },
      sales_invoice_id: { type: Sequelize.UUID },
      customer_id: { type: Sequelize.UUID, references: { model: 'accounting_customers', key: 'id' } },
      return_date: { type: Sequelize.DATEONLY, allowNull: false },
      status: { type: Sequelize.STRING(30), defaultValue: 'draft' },
      total_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // ========== PEMBELIAN ==========
    await queryInterface.createTable('accurate_purchase_orders', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      po_number: { type: Sequelize.STRING(50), allowNull: false },
      supplier_id: { type: Sequelize.UUID, references: { model: 'accounting_suppliers', key: 'id' }, onDelete: 'SET NULL' },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' } },
      order_date: { type: Sequelize.DATEONLY, allowNull: false },
      expected_date: { type: Sequelize.DATEONLY },
      status: { type: Sequelize.STRING(30), defaultValue: 'draft' },
      subtotal: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      tax_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      total_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      notes: { type: Sequelize.TEXT },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('accurate_purchase_orders', ['po_number'], { unique: true });

    await queryInterface.createTable('accurate_po_items', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      purchase_order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accurate_purchase_orders', key: 'id' }, onDelete: 'CASCADE' },
      product_id: { type: Sequelize.UUID, references: { model: 'products', key: 'id' } },
      description: { type: Sequelize.STRING(500) },
      quantity: { type: Sequelize.DECIMAL(18, 4), defaultValue: 1 },
      unit_price: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('accurate_purchase_invoices', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      invoice_number: { type: Sequelize.STRING(50), allowNull: false },
      supplier_id: { type: Sequelize.UUID, references: { model: 'accounting_suppliers', key: 'id' } },
      purchase_order_id: { type: Sequelize.UUID, references: { model: 'accurate_purchase_orders', key: 'id' } },
      invoice_date: { type: Sequelize.DATEONLY, allowNull: false },
      due_date: { type: Sequelize.DATEONLY },
      status: { type: Sequelize.STRING(30), defaultValue: 'draft' },
      subtotal: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      tax_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      total_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      journal_entry_id: { type: Sequelize.UUID, references: { model: 'journal_entries', key: 'id' } },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('accurate_supplier_payments', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      payment_number: { type: Sequelize.STRING(50), allowNull: false },
      supplier_id: { type: Sequelize.UUID, references: { model: 'accounting_suppliers', key: 'id' } },
      payment_date: { type: Sequelize.DATEONLY, allowNull: false },
      amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      bank_account_id: { type: Sequelize.UUID, references: { model: 'accounting_bank_accounts', key: 'id' } },
      notes: { type: Sequelize.TEXT },
      journal_entry_id: { type: Sequelize.UUID, references: { model: 'journal_entries', key: 'id' } },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // ========== PERSEDIAAN ==========
    await queryInterface.createTable('accurate_warehouses', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(50), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' } },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('accurate_inventory_balances', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      warehouse_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accurate_warehouses', key: 'id' }, onDelete: 'CASCADE' },
      product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
      quantity: { type: Sequelize.DECIMAL(18, 4), defaultValue: 0 },
      valuation_method: { type: Sequelize.STRING(20), defaultValue: 'average' },
      unit_cost: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      min_stock: { type: Sequelize.DECIMAL(18, 4), defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('accurate_inventory_balances', ['warehouse_id', 'product_id'], { unique: true });

    await queryInterface.createTable('accurate_stock_mutations', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      mutation_number: { type: Sequelize.STRING(50), allowNull: false },
      warehouse_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accurate_warehouses', key: 'id' } },
      mutation_date: { type: Sequelize.DATEONLY, allowNull: false },
      mutation_type: { type: Sequelize.STRING(30), allowNull: false },
      source_type: { type: Sequelize.STRING(50) },
      source_id: { type: Sequelize.UUID },
      status: { type: Sequelize.STRING(30), defaultValue: 'draft' },
      notes: { type: Sequelize.TEXT },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('accurate_stock_mutation_lines', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      stock_mutation_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accurate_stock_mutations', key: 'id' }, onDelete: 'CASCADE' },
      product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' } },
      quantity_in: { type: Sequelize.DECIMAL(18, 4), defaultValue: 0 },
      quantity_out: { type: Sequelize.DECIMAL(18, 4), defaultValue: 0 },
      unit_cost: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // ========== PERPAJAKAN ==========
    await queryInterface.createTable('accurate_tax_configs', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      config_key: { type: Sequelize.STRING(100), allowNull: false },
      config_value: { type: Sequelize.TEXT },
      description: { type: Sequelize.STRING(255) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('accurate_e_faktur', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      faktur_number: { type: Sequelize.STRING(50), allowNull: false },
      source_type: { type: Sequelize.STRING(50) },
      source_id: { type: Sequelize.UUID },
      tax_period: { type: Sequelize.STRING(7) },
      npwp: { type: Sequelize.STRING(30) },
      amount_dpp: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      amount_ppn: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      status: { type: Sequelize.STRING(30), defaultValue: 'draft' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // ========== KAS & BANK ==========
    await queryInterface.createTable('accurate_cash_transactions', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      transaction_number: { type: Sequelize.STRING(50), allowNull: false },
      transaction_date: { type: Sequelize.DATEONLY, allowNull: false },
      transaction_type: { type: Sequelize.STRING(30), allowNull: false },
      bank_account_id: { type: Sequelize.UUID, references: { model: 'accounting_bank_accounts', key: 'id' } },
      amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      description: { type: Sequelize.TEXT },
      journal_entry_id: { type: Sequelize.UUID, references: { model: 'journal_entries', key: 'id' } },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // ========== ASET TETAP ==========
    await queryInterface.createTable('accurate_fixed_assets', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      asset_code: { type: Sequelize.STRING(50), allowNull: false },
      asset_name: { type: Sequelize.STRING(255), allowNull: false },
      category: { type: Sequelize.STRING(50) },
      purchase_date: { type: Sequelize.DATEONLY },
      acquisition_cost: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      residual_value: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      useful_life_years: { type: Sequelize.INTEGER, defaultValue: 1 },
      depreciation_method: { type: Sequelize.STRING(30), defaultValue: 'straight_line' },
      asset_account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' } },
      accumulated_depreciation_account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' } },
      expense_account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' } },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' } },
      status: { type: Sequelize.STRING(30), defaultValue: 'active' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('accurate_fixed_assets', ['asset_code'], { unique: true });

    await queryInterface.createTable('accurate_depreciation_schedule', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      fixed_asset_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accurate_fixed_assets', key: 'id' }, onDelete: 'CASCADE' },
      period_id: { type: Sequelize.UUID, references: { model: 'accounting_periods', key: 'id' } },
      period_label: { type: Sequelize.STRING(20) },
      depreciation_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      accumulated_depreciation: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      journal_entry_id: { type: Sequelize.UUID, references: { model: 'journal_entries', key: 'id' } },
      posted_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('accurate_depreciation_schedule');
    await queryInterface.dropTable('accurate_fixed_assets');
    await queryInterface.dropTable('accurate_cash_transactions');
    await queryInterface.dropTable('accurate_e_faktur');
    await queryInterface.dropTable('accurate_tax_configs');
    await queryInterface.dropTable('accurate_stock_mutation_lines');
    await queryInterface.dropTable('accurate_stock_mutations');
    await queryInterface.dropTable('accurate_inventory_balances');
    await queryInterface.dropTable('accurate_warehouses');
    await queryInterface.dropTable('accurate_supplier_payments');
    await queryInterface.dropTable('accurate_purchase_invoices');
    await queryInterface.dropTable('accurate_po_items');
    await queryInterface.dropTable('accurate_purchase_orders');
    await queryInterface.dropTable('accurate_sales_returns');
    await queryInterface.dropTable('accurate_quotation_items');
    await queryInterface.dropTable('accurate_quotations');
  }
};
