const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccountingBankAccount = sequelize.define('AccountingBankAccount', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code: { type: DataTypes.STRING(50), allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  bank_name: { type: DataTypes.STRING(100) },
  account_number: { type: DataTypes.STRING(50) },
  currency: { type: DataTypes.STRING(5), defaultValue: 'IDR' },
  gl_account_id: { type: DataTypes.UUID },
  branch_id: { type: DataTypes.UUID },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'accounting_bank_accounts', underscored: true, timestamps: true });

module.exports = AccountingBankAccount;
