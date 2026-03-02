'use strict';

/**
 * Hapus modul penggajian (payroll) dan rekening koran (bank statement) beserta rekonsiliasi.
 * Drop tables: reconciliation_logs, bank_statement_lines, bank_statement_uploads,
 * payroll_items, payroll_runs, employee_salaries, payroll_settings.
 */
module.exports = {
  async up(queryInterface) {
    // Rekonsiliasi dulu (FK ke bank_statement_*)
    await queryInterface.dropTable('reconciliation_logs').catch(() => {});
    await queryInterface.dropTable('bank_statement_lines').catch(() => {});
    await queryInterface.dropTable('bank_statement_uploads').catch(() => {});

    // Payroll: item -> run -> employee_salaries, payroll_settings
    await queryInterface.dropTable('payroll_items').catch(() => {});
    await queryInterface.dropTable('payroll_runs').catch(() => {});
    await queryInterface.dropTable('employee_salaries').catch(() => {});
    await queryInterface.dropTable('payroll_settings').catch(() => {});
  },

  async down() {
    // Tidak di-revert: gunakan migration asli payroll & bank-statement jika perlu restore.
  }
};
