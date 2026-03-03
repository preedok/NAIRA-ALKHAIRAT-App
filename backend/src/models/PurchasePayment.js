const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const PurchasePayment = sequelize.define('PurchasePayment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  payment_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  purchase_invoice_id: { type: DataTypes.UUID, allowNull: false },
  supplier_id: { type: DataTypes.UUID, allowNull: false },
  payment_date: { type: DataTypes.DATEONLY, allowNull: false },
  amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
  currency: { type: DataTypes.STRING(5), defaultValue: 'IDR' },
  payment_method: { type: DataTypes.STRING(30), defaultValue: 'transfer' },
  bank_account_id: { type: DataTypes.UUID },
  journal_entry_id: { type: DataTypes.UUID },
  status: { type: DataTypes.STRING(30), defaultValue: 'draft' },
  reference_number: { type: DataTypes.STRING(100) },
  notes: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.UUID },
  posted_by: { type: DataTypes.UUID },
  posted_at: { type: DataTypes.DATE }
}, { tableName: 'purchase_payments', underscored: true, timestamps: true });

module.exports = PurchasePayment;
