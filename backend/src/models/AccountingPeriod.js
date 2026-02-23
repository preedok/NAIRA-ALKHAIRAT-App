const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccountingPeriod = sequelize.define('AccountingPeriod', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  fiscal_year_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'accounting_fiscal_years', key: 'id' } },
  period_number: { type: DataTypes.INTEGER, allowNull: false },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  is_locked: { type: DataTypes.BOOLEAN, defaultValue: false },
  locked_at: { type: DataTypes.DATE },
  locked_by: { type: DataTypes.UUID }
}, { tableName: 'accounting_periods', underscored: true, timestamps: true });

module.exports = AccountingPeriod;
