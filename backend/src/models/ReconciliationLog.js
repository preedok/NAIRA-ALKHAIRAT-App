const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ReconciliationLog = sequelize.define('ReconciliationLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  upload_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'bank_statement_uploads', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  bank_statement_line_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'bank_statement_lines', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  payment_proof_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'payment_proofs', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  match_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'exact | fuzzy | manual'
  },
  matched_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  matched_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'reconciliation_logs',
  underscored: true,
  timestamps: true
});

module.exports = ReconciliationLog;
