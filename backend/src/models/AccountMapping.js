const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccountMapping = sequelize.define('AccountMapping', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  mapping_type: { type: DataTypes.STRING(50), allowNull: false },
  debit_account_id: { type: DataTypes.UUID },
  credit_account_id: { type: DataTypes.UUID },
  description: { type: DataTypes.TEXT },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'account_mappings', underscored: true, timestamps: true });

module.exports = AccountMapping;
