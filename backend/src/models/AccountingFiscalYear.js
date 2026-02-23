const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccountingFiscalYear = sequelize.define('AccountingFiscalYear', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  is_closed: { type: DataTypes.BOOLEAN, defaultValue: false },
  closed_at: { type: DataTypes.DATE },
  closed_by: { type: DataTypes.UUID }
}, { tableName: 'accounting_fiscal_years', underscored: true, timestamps: true });

module.exports = AccountingFiscalYear;
