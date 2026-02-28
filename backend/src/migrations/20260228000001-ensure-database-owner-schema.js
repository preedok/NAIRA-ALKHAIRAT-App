'use strict';

/**
 * Ensure database schema matches API: owner_profiles, owner_id, role 'owner'.
 * If DB was migrated to travel_* (by 20260226000030), revert to owner_*.
 * Idempotent: safe to run when DB already has owner schema.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [tables] = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'travel_profiles'"
    );
    const hasTravelProfiles = Array.isArray(tables) && tables.length > 0;

    if (!hasTravelProfiles) {
      // DB already has owner schema, nothing to do
      return;
    }

    // Revert travel -> owner (same as down() of 20260226000030)
    await queryInterface.sequelize.query("UPDATE users SET role = 'owner' WHERE role = 'travel'");

    try {
      await queryInterface.removeIndex('invoices', 'invoices_travel_id_idx');
    } catch (_) {}

    try {
      await queryInterface.renameColumn('accounting_customers', 'travel_profile_id', 'owner_profile_id');
    } catch (e) {
      if (!e.message || !e.message.includes('does not exist')) throw e;
    }

    await queryInterface.renameColumn('product_prices', 'travel_id', 'owner_id');
    await queryInterface.renameColumn('refunds', 'travel_id', 'owner_id');
    await queryInterface.renameColumn('invoices', 'travel_id', 'owner_id');
    await queryInterface.renameColumn('orders', 'travel_id', 'owner_id');
    await queryInterface.renameColumn('travel_balance_transactions', 'travel_id', 'owner_id');
    try {
      await queryInterface.addIndex('invoices', ['owner_id'], { name: 'invoices_owner_id_idx' });
    } catch (_) {}

    try {
      await queryInterface.renameTable('travel_balance_transactions', 'owner_balance_transactions');
    } catch (e) {
      if (e.message && e.message.includes('already exists')) {
        await queryInterface.sequelize.query(
          'INSERT INTO owner_balance_transactions SELECT * FROM travel_balance_transactions ON CONFLICT (id) DO NOTHING'
        );
        await queryInterface.dropTable('travel_balance_transactions');
      } else throw e;
    }

    const [op] = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'owner_profiles'"
    );
    if (Array.isArray(op) && op.length > 0) {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS owner_profiles CASCADE');
    }
    await queryInterface.renameTable('travel_profiles', 'owner_profiles');
  },

  async down(queryInterface, Sequelize) {
    // This migration only normalizes to owner; down would require re-applying travel rename.
    // No-op to avoid breaking migrate:undo on other migrations.
  }
};
