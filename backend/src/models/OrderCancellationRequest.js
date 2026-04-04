const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const OrderCancellationRequest = sequelize.define(
  'OrderCancellationRequest',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    invoice_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending'
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    },
    owner_note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    tableName: 'order_cancellation_requests',
    underscored: true,
    timestamps: true
  }
);

module.exports = OrderCancellationRequest;
