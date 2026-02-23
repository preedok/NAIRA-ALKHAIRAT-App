const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const JournalEntryLine = sequelize.define('JournalEntryLine', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  journal_entry_id: { type: DataTypes.UUID, allowNull: false },
  account_id: { type: DataTypes.UUID, allowNull: false },
  debit_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  credit_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  line_description: { type: DataTypes.TEXT },
  cost_center: { type: DataTypes.STRING(50) },
  reference_type: { type: DataTypes.STRING(50) },
  reference_id: { type: DataTypes.UUID },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'journal_entry_lines', underscored: true, timestamps: true });

module.exports = JournalEntryLine;
