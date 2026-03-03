const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccountingSupplier = sequelize.define('AccountingSupplier', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code: { type: DataTypes.STRING(50), allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  supplier_type: { type: DataTypes.STRING(30), allowNull: false },
  currency: { type: DataTypes.STRING(5), defaultValue: 'IDR' },
  term_of_payment_days: { type: DataTypes.INTEGER, defaultValue: 0 },
  payable_account_id: { type: DataTypes.UUID },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  meta: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'accounting_suppliers', underscored: true, timestamps: true });

module.exports = AccountingSupplier;
