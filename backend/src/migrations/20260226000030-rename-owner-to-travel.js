'use strict';

/**
 * Rename owner -> travel: tables, columns, and user role.
 * - owner_profiles -> travel_profiles
 * - owner_balance_transactions -> travel_balance_transactions (and owner_id -> travel_id)
 * - orders.owner_id -> travel_id
 * - invoices.owner_id -> travel_id
 * - refunds.owner_id -> travel_id
 * - product_prices.owner_id -> travel_id
 * - accounting_customers.owner_profile_id -> travel_profile_id (FK to travel_profiles)
 * - users.role: 'owner' -> 'travel'
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    // 1. Rename table owner_profiles -> travel_profiles
    await queryInterface.renameTable('owner_profiles', 'travel_profiles');

    // 2. Rename table owner_balance_transactions -> travel_balance_transactions
    await queryInterface.renameTable('owner_balance_transactions', 'travel_balance_transactions');

    // 3. In travel_balance_transactions: owner_id -> travel_id
    await queryInterface.renameColumn('travel_balance_transactions', 'owner_id', 'travel_id');

    // 4. orders: owner_id -> travel_id
    await queryInterface.renameColumn('orders', 'owner_id', 'travel_id');

    // 5. invoices: owner_id -> travel_id
    await queryInterface.renameColumn('invoices', 'owner_id', 'travel_id');

    // 6. refunds: owner_id -> travel_id
    await queryInterface.renameColumn('refunds', 'owner_id', 'travel_id');

    // 7. product_prices: owner_id -> travel_id
    await queryInterface.renameColumn('product_prices', 'owner_id', 'travel_id');

    // 8. accounting_customers: owner_profile_id -> travel_profile_id (references travel_profiles now)
    try {
      await queryInterface.renameColumn('accounting_customers', 'owner_profile_id', 'travel_profile_id');
    } catch (e) {
      if (!e.message || !e.message.includes('does not exist')) throw e;
    }

    // 9. Drop old index invoices_owner_id_idx if exists, add invoices_travel_id_idx
    try {
      await queryInterface.removeIndex('invoices', 'invoices_owner_id_idx');
    } catch (_) {}
    try {
      await queryInterface.addIndex('invoices', ['travel_id'], { name: 'invoices_travel_id_idx' });
    } catch (_) {}

    // 10. users.role: 'owner' -> 'travel'
    await queryInterface.sequelize.query("UPDATE users SET role = 'travel' WHERE role = 'owner'");
  },

  async down(queryInterface, Sequelize) {
    // users.role: 'travel' -> 'owner'
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

    await queryInterface.renameTable('travel_balance_transactions', 'owner_balance_transactions');
    await queryInterface.renameTable('travel_profiles', 'owner_profiles');
  }
};
