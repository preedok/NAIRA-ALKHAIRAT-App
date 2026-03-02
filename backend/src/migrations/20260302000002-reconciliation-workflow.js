'use strict';

/**
 * Workflow rekonsiliasi end-to-end:
 * - bank_statement_lines: status staging (unreconciled/matched/suggested/unmatched), link ke payment_proof, match_type
 * - bank_statement_uploads: finalized_at, finalized_by
 * - reconciliation_logs: audit trail setelah finalize (bank_line <-> payment_proof)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'bank_statement_lines',
      'reconciliation_status',
      { type: Sequelize.STRING(20), allowNull: true, defaultValue: 'unreconciled', comment: 'unreconciled | matched | suggested | unmatched' }
    );
    await queryInterface.addColumn(
      'bank_statement_lines',
      'matched_payment_proof_id',
      { type: Sequelize.UUID, allowNull: true, references: { model: 'payment_proofs', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }
    );
    await queryInterface.addColumn(
      'bank_statement_lines',
      'match_type',
      { type: Sequelize.STRING(20), allowNull: true, comment: 'exact | fuzzy | manual' }
    );
    await queryInterface.addColumn(
      'bank_statement_lines',
      'reconciled_at',
      { type: Sequelize.DATE, allowNull: true }
    );
    await queryInterface.addColumn(
      'bank_statement_lines',
      'reconciled_by',
      { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }
    );
    await queryInterface.addIndex('bank_statement_lines', ['reconciliation_status']);
    await queryInterface.addIndex('bank_statement_lines', ['matched_payment_proof_id']);

    await queryInterface.addColumn(
      'bank_statement_uploads',
      'finalized_at',
      { type: Sequelize.DATE, allowNull: true }
    );
    await queryInterface.addColumn(
      'bank_statement_uploads',
      'finalized_by',
      { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }
    );

    await queryInterface.createTable('reconciliation_logs', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      upload_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'bank_statement_uploads', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      bank_statement_line_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'bank_statement_lines', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      payment_proof_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'payment_proofs', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      match_type: { type: Sequelize.STRING(20), allowNull: true, comment: 'exact | fuzzy | manual' },
      matched_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      matched_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('reconciliation_logs', ['upload_id']);
    await queryInterface.addIndex('reconciliation_logs', ['bank_statement_line_id']);
    await queryInterface.addIndex('reconciliation_logs', ['payment_proof_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reconciliation_logs');
    await queryInterface.removeColumn('bank_statement_uploads', 'finalized_by');
    await queryInterface.removeColumn('bank_statement_uploads', 'finalized_at');
    await queryInterface.removeColumn('bank_statement_lines', 'reconciled_by');
    await queryInterface.removeColumn('bank_statement_lines', 'reconciled_at');
    await queryInterface.removeColumn('bank_statement_lines', 'match_type');
    await queryInterface.removeColumn('bank_statement_lines', 'matched_payment_proof_id');
    await queryInterface.removeColumn('bank_statement_lines', 'reconciliation_status');
  }
};
