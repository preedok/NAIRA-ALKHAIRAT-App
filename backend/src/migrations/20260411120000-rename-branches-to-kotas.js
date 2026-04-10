'use strict';

/**
 * Master cabang → kota (DB): tabel branches → kotas, FK branch_id → kota_id,
 * owner_profiles.preferred/assigned_branch_id → preferred_kota_id / assigned_kota_id.
 * Index ekspresi hotel_monthly_prices di-drop lalu dibuat ulang dengan kota_id.
 */
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;

    const tableExists = async (name) => {
      const [rows] = await q.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :name`,
        { replacements: { name } }
      );
      return rows && rows.length > 0;
    };

    const columnExists = async (table, col) => {
      const [rows] = await q.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table AND column_name = :col`,
        { replacements: { table, col } }
      );
      return rows && rows.length > 0;
    };

    if (await tableExists('branches')) {
      await q.query('ALTER TABLE branches RENAME TO kotas;');
    }

    if (!(await tableExists('kotas'))) {
      return;
    }

    await q.query('DROP INDEX IF EXISTS uq_hmp_layer_month_variant');

    const renameBranchId = async (table) => {
      if (!(await tableExists(table))) return;
      if (await columnExists(table, 'branch_id') && !(await columnExists(table, 'kota_id'))) {
        await q.query(`ALTER TABLE "${table}" RENAME COLUMN branch_id TO kota_id`);
      }
    };

    const tables = [
      'users',
      'orders',
      'invoices',
      'audit_logs',
      'accounting_bank_accounts',
      'product_prices',
      'hotel_monthly_prices',
      'journal_entries',
      'business_rule_configs',
      'payroll_settings',
      'payroll_runs',
      'purchase_orders',
      'purchase_invoices',
      'accurate_quotations',
      'accurate_purchase_orders',
      'accurate_warehouses',
      'accurate_fixed_assets'
    ];
    for (const t of tables) {
      await renameBranchId(t);
    }

    if (await tableExists('owner_profiles')) {
      if (await columnExists('owner_profiles', 'preferred_branch_id') && !(await columnExists('owner_profiles', 'preferred_kota_id'))) {
        await q.query('ALTER TABLE owner_profiles RENAME COLUMN preferred_branch_id TO preferred_kota_id');
      }
      if (await columnExists('owner_profiles', 'assigned_branch_id') && !(await columnExists('owner_profiles', 'assigned_kota_id'))) {
        await q.query('ALTER TABLE owner_profiles RENAME COLUMN assigned_branch_id TO assigned_kota_id');
      }
    }

    await q.query('DROP INDEX IF EXISTS orders_branch_created_idx');
    await q.query('CREATE INDEX IF NOT EXISTS orders_kota_created_idx ON orders (kota_id, created_at)').catch(() => {});

    await q.query('DROP INDEX IF EXISTS invoices_branch_status_idx');
    await q.query('CREATE INDEX IF NOT EXISTS invoices_kota_status_idx ON invoices (kota_id, status)').catch(() => {});

    await q.query('DROP INDEX IF EXISTS payroll_settings_branch_id_unique').catch(() => {});
    await q.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS payroll_settings_kota_id_unique ON payroll_settings (kota_id)'
    ).catch(() => {});

    await q.query('DROP INDEX IF EXISTS payroll_runs_period_branch_unique').catch(() => {});
    await q.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_period_kota_unique ON payroll_runs (period_year, period_month, kota_id)'
    ).catch(() => {});

    await q.query('DROP INDEX IF EXISTS idx_hmp_branch_owner').catch(() => {});
    await q.query('CREATE INDEX IF NOT EXISTS idx_hmp_kota_owner ON hotel_monthly_prices (kota_id, owner_id)').catch(() => {});

    const hasOwnerScope = await columnExists('hotel_monthly_prices', 'owner_type_scope');
    const hasComponent = await columnExists('hotel_monthly_prices', 'component');
    if (hasOwnerScope && hasComponent) {
      await q.query(`
        CREATE UNIQUE INDEX uq_hmp_layer_month_variant
        ON hotel_monthly_prices (
          product_id,
          COALESCE(kota_id, '00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
          year_month,
          currency,
          room_type,
          with_meal,
          component,
          owner_type_scope
        )
      `).catch(() => {});
    } else if (hasComponent) {
      await q.query(`
        CREATE UNIQUE INDEX uq_hmp_layer_month_variant
        ON hotel_monthly_prices (
          product_id,
          COALESCE(kota_id, '00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
          year_month,
          currency,
          room_type,
          with_meal,
          component
        )
      `).catch(() => {});
    } else {
      await q.query(`
        CREATE UNIQUE INDEX uq_hmp_layer_month_variant
        ON hotel_monthly_prices (
          product_id,
          COALESCE(kota_id, '00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
          year_month,
          currency,
          room_type,
          with_meal
        )
      `).catch(() => {});
    }
  },

  async down() {
    throw new Error('Migration branches→kotas tidak didukung rollback otomatis.');
  }
};
