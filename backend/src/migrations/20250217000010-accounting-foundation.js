'use strict';

/**
 * Accounting System Foundation
 * Chart of Accounts, Fiscal Period, Account Mapping, Master Data
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fiscal Year
    await queryInterface.createTable('accounting_fiscal_years', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      is_closed: { type: Sequelize.BOOLEAN, defaultValue: false },
      closed_at: { type: Sequelize.DATE },
      closed_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Accounting Period (monthly)
    await queryInterface.createTable('accounting_periods', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      fiscal_year_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'accounting_fiscal_years', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      period_number: { type: Sequelize.INTEGER, allowNull: false },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      is_locked: { type: Sequelize.BOOLEAN, defaultValue: false },
      locked_at: { type: Sequelize.DATE },
      locked_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('accounting_periods', ['fiscal_year_id', 'period_number'], { unique: true });

    // Chart of Accounts (multi-level)
    await queryInterface.createTable('chart_of_accounts', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      parent_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      code: { type: Sequelize.STRING(50), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      account_type: { type: Sequelize.STRING(30), allowNull: false }, // asset, liability, equity, revenue, expense
      level: { type: Sequelize.INTEGER, defaultValue: 1 },
      is_header: { type: Sequelize.BOOLEAN, defaultValue: false },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      updated_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('chart_of_accounts', ['code'], { unique: true });

    // Account Mapping per jenis transaksi
    await queryInterface.createTable('account_mappings', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      mapping_type: { type: Sequelize.STRING(50), allowNull: false }, // sales_hotel, sales_visa, sales_ticket, sales_bus, sales_handling, purchase_hotel, purchase_bus, payroll, etc
      debit_account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      credit_account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      description: { type: Sequelize.TEXT },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Master Customer B2B (extend atau link ke OwnerProfile)
    await queryInterface.createTable('accounting_customers', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      owner_profile_id: { type: Sequelize.UUID, references: { model: 'owner_profiles', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      wilayah_id: { type: Sequelize.UUID, references: { model: 'wilayah', key: 'id' } },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' } },
      code: { type: Sequelize.STRING(50), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      company_name: { type: Sequelize.STRING(255) },
      term_of_payment_days: { type: Sequelize.INTEGER, defaultValue: 0 },
      credit_limit: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      receivable_account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' } },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Master Supplier (vendor Saudi & lokal)
    await queryInterface.createTable('accounting_suppliers', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(50), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      supplier_type: { type: Sequelize.STRING(30), allowNull: false }, // hotel_saudi, bus_saudi, vendor_local
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      term_of_payment_days: { type: Sequelize.INTEGER, defaultValue: 0 },
      payable_account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' } },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      meta: { type: Sequelize.JSONB, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Exchange Rates (multi-currency)
    await queryInterface.createTable('accounting_exchange_rates', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      from_currency: { type: Sequelize.STRING(5), allowNull: false },
      to_currency: { type: Sequelize.STRING(5), allowNull: false },
      rate: { type: Sequelize.DECIMAL(18, 6), allowNull: false },
      effective_date: { type: Sequelize.DATEONLY, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('accounting_exchange_rates', ['from_currency', 'to_currency', 'effective_date']);

    // Journal Entries (GL)
    await queryInterface.createTable('journal_entries', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      journal_number: { type: Sequelize.STRING(50), allowNull: false },
      period_id: { type: Sequelize.UUID, references: { model: 'accounting_periods', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      entry_date: { type: Sequelize.DATEONLY, allowNull: false },
      journal_type: { type: Sequelize.STRING(30), allowNull: false }, // manual, sales, purchase, payroll, bank, adjustment, recurring, reversal
      source_type: { type: Sequelize.STRING(50) }, // invoice, payment, vendor_invoice, payroll_run, etc
      source_id: { type: Sequelize.UUID },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' } },
      wilayah_id: { type: Sequelize.UUID, references: { model: 'wilayah', key: 'id' } },
      description: { type: Sequelize.TEXT },
      status: { type: Sequelize.STRING(30), defaultValue: 'draft' }, // draft, submitted, approved, posted, reversed
      total_debit: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      total_credit: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      approved_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      posted_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      posted_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('journal_entries', ['journal_number'], { unique: true });
    await queryInterface.addIndex('journal_entries', ['period_id', 'entry_date']);

    // Journal Entry Lines
    await queryInterface.createTable('journal_entry_lines', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      journal_entry_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'journal_entries', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      account_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'chart_of_accounts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      debit_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      credit_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      line_description: { type: Sequelize.TEXT },
      cost_center: { type: Sequelize.STRING(50) },
      reference_type: { type: Sequelize.STRING(50) },
      reference_id: { type: Sequelize.UUID },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Bank Accounts (multi rekening)
    await queryInterface.createTable('accounting_bank_accounts', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(50), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      bank_name: { type: Sequelize.STRING(100) },
      account_number: { type: Sequelize.STRING(50) },
      currency: { type: Sequelize.STRING(5), defaultValue: 'IDR' },
      gl_account_id: { type: Sequelize.UUID, references: { model: 'chart_of_accounts', key: 'id' } },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' } },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Accounting Audit Log (full audit trail)
    await queryInterface.createTable('accounting_audit_logs', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      entity_type: { type: Sequelize.STRING(50), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      action: { type: Sequelize.STRING(30), allowNull: false }, // create, update, approve, post, reverse, delete
      old_values: { type: Sequelize.JSONB },
      new_values: { type: Sequelize.JSONB },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
      ip_address: { type: Sequelize.STRING(45) },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('accounting_audit_logs', ['entity_type', 'entity_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('accounting_audit_logs');
    await queryInterface.dropTable('accounting_bank_accounts');
    await queryInterface.dropTable('journal_entry_lines');
    await queryInterface.dropTable('journal_entries');
    await queryInterface.dropTable('accounting_exchange_rates');
    await queryInterface.dropTable('accounting_suppliers');
    await queryInterface.dropTable('accounting_customers');
    await queryInterface.dropTable('account_mappings');
    await queryInterface.dropTable('chart_of_accounts');
    await queryInterface.dropTable('accounting_periods');
    await queryInterface.dropTable('accounting_fiscal_years');
  }
};
