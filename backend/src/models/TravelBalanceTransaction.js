const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const TravelBalanceTransaction = sequelize.define('TravelBalanceTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  travel_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    comment: 'Positive = credit (saldo naik), negative = debit (saldo turun)'
  },
  type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'cancel_credit, allocation, refund_debit, adjustment'
  },
  reference_type: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'order, invoice, refund'
  },
  reference_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'travel_balance_transactions',
  underscored: true,
  timestamps: true
});

module.exports = TravelBalanceTransaction;
