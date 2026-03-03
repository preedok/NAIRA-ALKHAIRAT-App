const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const PurchaseInvoiceLine = sequelize.define('PurchaseInvoiceLine', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  purchase_invoice_id: { type: DataTypes.UUID, allowNull: false },
  line_number: { type: DataTypes.INTEGER, defaultValue: 1 },
  description: { type: DataTypes.STRING(500) },
  quantity: { type: DataTypes.DECIMAL(18, 4), defaultValue: 1 },
  unit: { type: DataTypes.STRING(20), defaultValue: 'pcs' },
  unit_price: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  purchase_order_line_id: { type: DataTypes.UUID },
  account_id: { type: DataTypes.UUID }
}, { tableName: 'purchase_invoice_lines', underscored: true, timestamps: true });

module.exports = PurchaseInvoiceLine;
