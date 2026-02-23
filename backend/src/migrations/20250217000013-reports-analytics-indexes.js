'use strict';

/** Index untuk Reports & Analytics: orders dan system_logs */
module.exports = {
  async up(queryInterface) {
    try {
      await queryInterface.addIndex('orders', ['branch_id', 'created_at'], { name: 'orders_branch_created_idx' });
    } catch (e) {
      if (!e.message?.includes('already exists')) throw e;
    }
    try {
      await queryInterface.addIndex('orders', ['created_at'], { name: 'orders_created_at_idx' });
    } catch (e) {
      if (!e.message?.includes('already exists')) throw e;
    }
    try {
      await queryInterface.addIndex('system_logs', ['created_at'], { name: 'system_logs_created_at_idx' });
    } catch (e) {
      if (!e.message?.includes('already exists')) throw e;
    }
    try {
      await queryInterface.addIndex('system_logs', ['source', 'level'], { name: 'system_logs_source_level_idx' });
    } catch (e) {
      if (!e.message?.includes('already exists')) throw e;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('orders', 'orders_branch_created_idx');
    } catch (_) {}
    try {
      await queryInterface.removeIndex('orders', 'orders_created_at_idx');
    } catch (_) {}
    try {
      await queryInterface.removeIndex('system_logs', 'system_logs_created_at_idx');
    } catch (_) {}
    try {
      await queryInterface.removeIndex('system_logs', 'system_logs_source_level_idx');
    } catch (_) {}
  }
};
