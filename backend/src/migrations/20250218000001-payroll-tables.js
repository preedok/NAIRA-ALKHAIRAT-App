'use strict';

/**
 * Payroll: settings, employee salaries, payroll runs, payroll items.
 * Slip gaji digenerate otomatis; notifikasi ke semua role kecuali owner.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new notification trigger enum value (PostgreSQL)
    try {
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_notifications_trigger\" ADD VALUE IF NOT EXISTS 'payroll_slip_issued';"
      );
    } catch (e) {
      // If enum doesn't exist or already has value, ignore
    }

    // Payroll settings (global or per branch): method scheduled/manual, day of month
    await queryInterface.createTable('payroll_settings', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      method: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'manual' },
      payroll_day_of_month: { type: Sequelize.INTEGER, allowNull: true },
      run_time: { type: Sequelize.STRING(5), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      company_name_slip: { type: Sequelize.STRING(255), allowNull: true },
      company_address_slip: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('payroll_settings', ['branch_id'], { unique: true, name: 'payroll_settings_branch_id_unique' });

    // Employee salary template (base + allowances + deductions) for payroll run
    await queryInterface.createTable('employee_salaries', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      base_salary: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      allowances: { type: Sequelize.JSONB, defaultValue: [] },
      deductions: { type: Sequelize.JSONB, defaultValue: [] },
      effective_from: { type: Sequelize.DATEONLY, allowNull: true },
      effective_to: { type: Sequelize.DATEONLY, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('employee_salaries', ['user_id']);

    // Payroll run (one period: month/year)
    await queryInterface.createTable('payroll_runs', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      period_month: { type: Sequelize.INTEGER, allowNull: false },
      period_year: { type: Sequelize.INTEGER, allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
      method: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'manual' },
      branch_id: { type: Sequelize.UUID, references: { model: 'branches', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      total_amount: { type: Sequelize.DECIMAL(18, 2), defaultValue: 0 },
      created_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      processed_at: { type: Sequelize.DATE, allowNull: true },
      finalized_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('payroll_runs', ['period_year', 'period_month']);
    await queryInterface.addIndex('payroll_runs', ['branch_id']);
    await queryInterface.addIndex('payroll_runs', ['period_year', 'period_month', 'branch_id'], { unique: true, name: 'payroll_runs_period_branch_unique' });

    // Payroll item (per employee in a run)
    await queryInterface.createTable('payroll_items', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      payroll_run_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'payroll_runs', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      base_salary: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      allowances: { type: Sequelize.JSONB, defaultValue: [] },
      deductions: { type: Sequelize.JSONB, defaultValue: [] },
      gross: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      total_deductions: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      net: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      slip_file_path: { type: Sequelize.STRING(500), allowNull: true },
      slip_generated_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('payroll_items', ['payroll_run_id']);
    await queryInterface.addIndex('payroll_items', ['user_id']);
    await queryInterface.addIndex('payroll_items', ['payroll_run_id', 'user_id'], { unique: true, name: 'payroll_items_run_user_unique' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payroll_items');
    await queryInterface.dropTable('payroll_runs');
    await queryInterface.dropTable('employee_salaries');
    await queryInterface.dropTable('payroll_settings');
  }
};
