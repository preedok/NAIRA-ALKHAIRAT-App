const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const { REFUND_STATUS, REFUND_SOURCE } = require('../constants');

const Refund = sequelize.define('Refund', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoice_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'invoices', key: 'id' }
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'orders', key: 'id' }
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  bank_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nama bank untuk transfer refund (diisi owner)'
  },
  account_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Nomor rekening untuk refund (diisi owner)'
  },
  source: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: REFUND_SOURCE.CANCEL,
    comment: 'cancel = refund saat batalkan order; balance = tarik saldo'
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(Object.values(REFUND_STATUS)),
    allowNull: false,
    defaultValue: REFUND_STATUS.REQUESTED
  },
  reason: {
    type: DataTypes.TEXT
  },
  requested_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  approved_by: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' }
  },
  approved_at: {
    type: DataTypes.DATE
  },
  rejection_reason: {
    type: DataTypes.TEXT
  },
  refunded_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'refunds',
  underscored: true,
  timestamps: true
});

module.exports = Refund;
