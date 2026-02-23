const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const JournalEntry = sequelize.define('JournalEntry', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  journal_number: { type: DataTypes.STRING(50), allowNull: false },
  period_id: { type: DataTypes.UUID, allowNull: false },
  entry_date: { type: DataTypes.DATEONLY, allowNull: false },
  journal_type: { type: DataTypes.STRING(30), allowNull: false },
  source_type: { type: DataTypes.STRING(50) },
  source_id: { type: DataTypes.UUID },
  branch_id: { type: DataTypes.UUID },
  wilayah_id: { type: DataTypes.UUID },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(30), defaultValue: 'draft' },
  total_debit: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  total_credit: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  currency: { type: DataTypes.STRING(5), defaultValue: 'IDR' },
  created_by: { type: DataTypes.UUID },
  approved_by: { type: DataTypes.UUID },
  posted_by: { type: DataTypes.UUID },
  posted_at: { type: DataTypes.DATE }
}, { tableName: 'journal_entries', underscored: true, timestamps: true });

module.exports = JournalEntry;
