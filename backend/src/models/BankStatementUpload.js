const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const BankStatementUpload = sequelize.define('BankStatementUpload', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Label/ nama upload (mis. Rekening Koran Maret 2026)'
  },
  period_from: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  period_to: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  original_file_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Path relatif file asli (dari upload root) untuk referensi/audit'
  },
  uploaded_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  finalized_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Waktu user menekan Finalize rekonsiliasi'
  },
  finalized_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  }
}, {
  tableName: 'bank_statement_uploads',
  underscored: true,
  timestamps: true
});

module.exports = BankStatementUpload;
