const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const InstallmentItem = sequelize.define('InstallmentItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  plan_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'installment_plans', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'invoices', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  installment_no: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  due_date: { type: DataTypes.DATEONLY, allowNull: false },
  paid_at: { type: DataTypes.DATE, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'late'),
    defaultValue: 'pending',
    allowNull: false
  }
}, {
  tableName: 'installment_items',
  underscored: true,
  timestamps: true
});

module.exports = InstallmentItem;
