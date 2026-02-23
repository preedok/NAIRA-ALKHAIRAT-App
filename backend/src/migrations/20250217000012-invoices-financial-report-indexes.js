'use strict';

/** Index untuk mempercepat query laporan keuangan (financial report, aging) */
module.exports = {
  async up(queryInterface) {
    try {
      await queryInterface.addIndex('invoices', ['issued_at'], { name: 'invoices_issued_at_idx' });
    } catch (e) {
      if (!e.message?.includes('already exists')) throw e;
    }
    try {
      await queryInterface.addIndex('invoices', ['branch_id', 'status'], { name: 'invoices_branch_status_idx' });
    } catch (e) {
      if (!e.message?.includes('already exists')) throw e;
    }
    try {
      await queryInterface.addIndex('invoices', ['owner_id'], { name: 'invoices_owner_id_idx' });
    } catch (e) {
      if (!e.message?.includes('already exists')) throw e;
    }
    try {
      await queryInterface.addIndex('invoices', ['paid_amount'], { name: 'invoices_paid_amount_idx' });
    } catch (e) {
      if (!e.message?.includes('already exists')) throw e;
    }
    try {
      await queryInterface.addIndex('invoices', ['created_at'], { name: 'invoices_created_at_idx' });
    } catch (e) {
      if (!e.message?.includes('already exists')) throw e;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('invoices', 'invoices_issued_at_idx');
    } catch (_) {}
    try {
      await queryInterface.removeIndex('invoices', 'invoices_branch_status_idx');
    } catch (_) {}
    try {
      await queryInterface.removeIndex('invoices', 'invoices_owner_id_idx');
    } catch (_) {}
    try {
      await queryInterface.removeIndex('invoices', 'invoices_paid_amount_idx');
    } catch (_) {}
    try {
      await queryInterface.removeIndex('invoices', 'invoices_created_at_idx');
    } catch (_) {}
  }
};
