/* eslint-disable no-console */
'use strict';

require('dotenv').config();
const { sequelize } = require('../src/models');

async function tableExists(tableName) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${tableName}' LIMIT 1`
  );
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${tableName}' AND column_name='${columnName}' LIMIT 1`
  );
  return rows.length > 0;
}

async function ensureKotaColumn(tableName) {
  if (!(await tableExists(tableName))) return;
  const hasBranch = await columnExists(tableName, 'branch_id');
  const hasKota = await columnExists(tableName, 'kota_id');
  if (!hasBranch || hasKota) return;
  await sequelize.query(`ALTER TABLE "${tableName}" ADD COLUMN kota_id UUID`);
  await sequelize.query(`UPDATE "${tableName}" SET kota_id = branch_id WHERE kota_id IS NULL`);
  console.log(`  + ${tableName}.kota_id (copied from branch_id)`);
}

async function run() {
  await sequelize.authenticate();
  console.log('Applying kota compatibility hotfix...');

  // Keep legacy branches table, expose kotas view for new code paths.
  if (!(await tableExists('kotas')) && (await tableExists('branches'))) {
    await sequelize.query('CREATE VIEW kotas AS SELECT * FROM branches');
    console.log('  + created view kotas -> branches');
  }

  const branchTables = [
    'users', 'orders', 'invoices', 'audit_logs', 'accounting_bank_accounts',
    'product_prices', 'hotel_monthly_prices', 'journal_entries', 'business_rule_configs',
    'payment_proofs', 'refunds', 'order_cancellation_requests', 'order_revisions',
    'owner_balance_transactions', 'purchase_orders', 'purchase_invoices', 'purchase_payments',
    'accurate_purchase_invoices', 'accurate_supplier_payments', 'accurate_cash_transactions',
    'accurate_depreciation_schedule', 'payroll_periods', 'payroll_entries', 'payroll_settings'
  ];
  for (const t of branchTables) await ensureKotaColumn(t);

  if (await tableExists('owner_profiles')) {
    if ((await columnExists('owner_profiles', 'preferred_branch_id')) && !(await columnExists('owner_profiles', 'preferred_kota_id'))) {
      await sequelize.query('ALTER TABLE owner_profiles ADD COLUMN preferred_kota_id UUID');
      await sequelize.query('UPDATE owner_profiles SET preferred_kota_id = preferred_branch_id WHERE preferred_kota_id IS NULL');
      console.log('  + owner_profiles.preferred_kota_id');
    }
    if ((await columnExists('owner_profiles', 'assigned_branch_id')) && !(await columnExists('owner_profiles', 'assigned_kota_id'))) {
      await sequelize.query('ALTER TABLE owner_profiles ADD COLUMN assigned_kota_id UUID');
      await sequelize.query('UPDATE owner_profiles SET assigned_kota_id = assigned_branch_id WHERE assigned_kota_id IS NULL');
      console.log('  + owner_profiles.assigned_kota_id');
    }
  }

  console.log('Kota hotfix done.');
  await sequelize.close();
}

run().catch(async (err) => {
  console.error('Kota hotfix failed:', err.message);
  try { await sequelize.close(); } catch (_) {}
  process.exit(1);
});

