'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  po_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  supplier_id: { type: DataTypes.UUID, allowNull: false },
  product_id: { type: DataTypes.UUID },
  branch_id: { type: DataTypes.UUID },
  order_date: { type: DataTypes.DATEONLY, allowNull: false },
  expected_date: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'draft' },
  currency: { type: DataTypes.STRING(5), defaultValue: 'IDR' },
  subtotal: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  tax_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  total_amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  notes: { type: DataTypes.TEXT },
  proof_file_path: { type: DataTypes.STRING(500) },
  created_by: { type: DataTypes.UUID },
  approved_by: { type: DataTypes.UUID },
  sent_at: { type: DataTypes.DATE }
}, { tableName: 'purchase_orders', underscored: true, timestamps: true });

module.exports = PurchaseOrder;
