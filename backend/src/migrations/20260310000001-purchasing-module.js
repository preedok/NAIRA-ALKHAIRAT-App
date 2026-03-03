'use strict';

/**
 * Modul Pembelian (Purchasing) untuk role accounting.
 * Tabel: purchase_orders, purchase_order_lines, purchase_invoices, purchase_invoice_lines, purchase_payments.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('purchase_orders', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      po_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      supplier_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accounting_suppliers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      order_date: { type: Sequelize.DATEONLY, allowNull: false },
      expected_date: { type: Sequelize.DATEONLY },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'draft' },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      subtotal: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      tax_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      total_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      approved_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      sent_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('purchase_orders', ['supplier_id']);
    await queryInterface.addIndex('purchase_orders', ['status']);
    await queryInterface.addIndex('purchase_orders', ['order_date']);

    await queryInterface.createTable('purchase_order_lines', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      purchase_order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'purchase_orders', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      line_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      description: { type: Sequelize.STRING(500) },
      quantity: { type: Sequelize.DECIMAL(18, 4), allowNull: false, defaultValue: 1 },
      unit: { type: Sequelize.STRING(20), defaultValue: 'pcs' },
      unit_price: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      tax_rate: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('purchase_order_lines', ['purchase_order_id']);

    await queryInterface.createTable('purchase_invoices', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      invoice_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      supplier_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accounting_suppliers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      purchase_order_id: { type: Sequelize.UUID, references: { model: 'purchase_orders', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      invoice_date: { type: Sequelize.DATEONLY, allowNull: false },
      due_date: { type: Sequelize.DATEONLY },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'draft' },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      subtotal: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      tax_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      total_amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      paid_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      remaining_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      journal_entry_id: { type: Sequelize.UUID, references: { model: 'journal_entries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      notes: { type: Sequelize.TEXT },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      approved_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      posted_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      posted_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('purchase_invoices', ['supplier_id']);
    await queryInterface.addIndex('purchase_invoices', ['status']);
    await queryInterface.addIndex('purchase_invoices', ['invoice_date']);

    await queryInterface.createTable('purchase_invoice_lines', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      purchase_invoice_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'purchase_invoices', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      line_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      description: { type: Sequelize.STRING(500) },
      quantity: { type: Sequelize.DECIMAL(18, 4), allowNull: false, defaultValue: 1 },
      unit: { type: Sequelize.STRING(20), defaultValue: 'pcs' },
      unit_price: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      purchase_order_line_id: { type: Sequelize.UUID, references: { model: 'purchase_order_lines', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('purchase_invoice_lines', ['purchase_invoice_id']);

    await queryInterface.createTable('purchase_payments', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      payment_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      purchase_invoice_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'purchase_invoices', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      supplier_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accounting_suppliers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      payment_date: { type: Sequelize.DATEONLY, allowNull: false },
      amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      payment_method: { type: Sequelize.STRING(30), defaultValue: 'transfer' },
      bank_account_id: { type: Sequelize.UUID, references: { model: 'accounting_bank_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      journal_entry_id: { type: Sequelize.UUID, references: { model: 'journal_entries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      status: { type: Sequelize.STRING(30), defaultValue: 'draft' },
      reference_number: { type: Sequelize.STRING(100) },
      notes: { type: Sequelize.TEXT },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      posted_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      posted_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('purchase_payments', ['purchase_invoice_id']);
    await queryInterface.addIndex('purchase_payments', ['supplier_id']);
    await queryInterface.addIndex('purchase_payments', ['payment_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('purchase_payments');
    await queryInterface.dropTable('purchase_invoice_lines');
    await queryInterface.dropTable('purchase_invoices');
    await queryInterface.dropTable('purchase_order_lines');
    await queryInterface.dropTable('purchase_orders');
  }
};
