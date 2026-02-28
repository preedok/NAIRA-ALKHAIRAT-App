const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const BankStatementLine = sequelize.define('BankStatementLine', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  upload_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'bank_statement_uploads', key: 'id' }
  },
  transaction_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reference_number: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  amount_debit: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  amount_credit: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    comment: 'Nilai mutlak; positif = penerimaan (kredit), negatif = pengeluaran (debit)'
  },
  balance_after: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },
  row_index: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'bank_statement_lines',
  underscored: true,
  timestamps: true
});

module.exports = BankStatementLine;
