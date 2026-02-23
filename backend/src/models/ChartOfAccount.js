const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ChartOfAccount = sequelize.define('ChartOfAccount', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  parent_id: { type: DataTypes.UUID },
  code: { type: DataTypes.STRING(50), allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  account_type: { type: DataTypes.STRING(30), allowNull: false },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  is_header: { type: DataTypes.BOOLEAN, defaultValue: false },
  currency: { type: DataTypes.STRING(5), defaultValue: 'IDR' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  created_by: { type: DataTypes.UUID },
  updated_by: { type: DataTypes.UUID }
}, { tableName: 'chart_of_accounts', underscored: true, timestamps: true });

module.exports = ChartOfAccount;
