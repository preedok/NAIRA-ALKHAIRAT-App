'use strict';

/**
 * Rekening Koran: upload data bank (Excel) untuk rekonsiliasi dengan penerimaan yang dicatat di sistem.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_statement_uploads', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING(255), allowNull: true, comment: 'Label/ nama upload (mis. Rekening Koran Maret 2026)' },
      period_from: { type: Sequelize.DATEONLY, allowNull: true, comment: 'Periode awal transaksi' },
      period_to: { type: Sequelize.DATEONLY, allowNull: true, comment: 'Periode akhir transaksi' },
      file_name: { type: Sequelize.STRING(255), allowNull: true },
      uploaded_by: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('bank_statement_uploads', ['uploaded_by']);
    await queryInterface.addIndex('bank_statement_uploads', ['period_from', 'period_to']);

    await queryInterface.createTable('bank_statement_lines', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      upload_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'bank_statement_uploads', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      transaction_date: { type: Sequelize.DATEONLY, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      reference_number: { type: Sequelize.STRING(100), allowNull: true },
      amount_debit: { type: Sequelize.DECIMAL(18, 2), allowNull: true, defaultValue: 0 },
      amount_credit: { type: Sequelize.DECIMAL(18, 2), allowNull: true, defaultValue: 0 },
      amount: { type: Sequelize.DECIMAL(18, 2), allowNull: false, comment: 'Nilai mutlak; positif = penerimaan (kredit), negatif = pengeluaran (debit)' },
      balance_after: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
      row_index: { type: Sequelize.INTEGER, allowNull: true, comment: 'Urutan baris di file asal' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('bank_statement_lines', ['upload_id']);
    await queryInterface.addIndex('bank_statement_lines', ['upload_id', 'transaction_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bank_statement_lines');
    await queryInterface.dropTable('bank_statement_uploads');
  }
};
