const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const InstallmentPlan = sequelize.define('InstallmentPlan', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'orders', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  total_amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  installment_months: { type: DataTypes.INTEGER, allowNull: false },
  per_installment_amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  first_due_date: { type: DataTypes.DATEONLY, allowNull: false },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'defaulted', 'cancelled'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'installment_plans',
  underscored: true,
  timestamps: true
});

module.exports = InstallmentPlan;
