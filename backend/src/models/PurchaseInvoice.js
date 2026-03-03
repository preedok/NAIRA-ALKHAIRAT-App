'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const PurchaseInvoice = sequelize.define('PurchaseInvoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  invoice_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  supplier_id: { type: DataTypes.UUID, allowNull: false },
  product_id: { type: DataTypes.UUID },
  purchase_order_id: { type: DataTypes.UUID },
  branch_id: { type: DataTypes.UUID },
  invoice_date: { type: DataTypes.DATEONLY, allowNull: false },
  due_date: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'draft' },
  currency: { type: DataTypes.STRING(5), defaultValue: 'IDR' },
  subtotal: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  tax_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  total_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  paid_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  remaining_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  journal_entry_id: { type: DataTypes.UUID },
  notes: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.UUID },
  approved_by: { type: DataTypes.UUID },
  posted_by: { type: DataTypes.UUID },
  posted_at: { type: DataTypes.DATE }
}, { tableName: 'purchase_invoices', underscored: true, timestamps: true });

module.exports = PurchaseInvoice;
