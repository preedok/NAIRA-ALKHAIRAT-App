const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccurateQuotation = sequelize.define('AccurateQuotation', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  quotation_number: { type: DataTypes.STRING(50), allowNull: false },
  customer_id: { type: DataTypes.UUID },
  branch_id: { type: DataTypes.UUID },
  quotation_date: { type: DataTypes.DATEONLY, allowNull: false },
  valid_until: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING(30), defaultValue: 'draft' },
  subtotal: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  discount_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  tax_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  total_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  currency: { type: DataTypes.STRING(5), defaultValue: 'IDR' },
  notes: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.UUID }
}, { tableName: 'accurate_quotations', underscored: true, timestamps: true });

module.exports = AccurateQuotation;
